const Member = require('../models/Member');
const MapSnapshot = require('../models/MapSnapshot');
const Settings = require('../models/Settings');
const { cloudinary } = require('../config/cloudinary');
const { sendShiftReport, restartScheduler } = require('../utils/smsBot');

// --- MEMBER LOGIC (EXISTING) ---

exports.listMembers = async (req, res) => {
  try {
    const members = await Member.find().sort({ name: 1 });
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addMember = async (req, res) => {
  try {
    const newMember = new Member({
      name: req.body.name,
      role: req.body.role,
      shift: req.body.shift,
      phoneNumber: req.body.phoneNumber,
      available: 'present',
      gender: req.body.gender || 'male',
      nozzleRestriction: req.body.nozzleRestriction === 'true' ||
        req.body.nozzleRestriction === true,
      hangingRestriction: req.body.hangingRestriction === 'true' ||  // ✅ NEW
        req.body.hangingRestriction === true,
      avatar: req.file ? req.file.path : null
    });

    const saved = await newMember.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    // Used when dragging to "Absent" or back to "Pool"
    const { id } = req.params;
    const { available } = req.body;
    await Member.findByIdAndUpdate(id, { available });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// NEW: Update Member (Full Edit)

exports.updateMember = async (req, res) => {
  try {
    const updates = {
      name: req.body.name,
      role: req.body.role,
      shift: req.body.shift,
      phoneNumber: req.body.phoneNumber,
      gender: req.body.gender,
      nozzleRestriction: req.body.nozzleRestriction === 'true' ||
        req.body.nozzleRestriction === true,
      hangingRestriction: req.body.hangingRestriction === 'true' ||  // ✅ NEW
        req.body.hangingRestriction === true,
    };

    if (req.file) {
      updates.avatar = req.file.path;
    }

    const updated = await Member.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// NEW: Delete Member
exports.deleteMember = async (req, res) => {
  try {
    const { id } = req.params;
    await Member.findByIdAndDelete(id);
    res.json({ success: true, message: 'Member deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const canAssignToNozzle = (member, nozzleKey) => {
  // RULE 1: Complete nozzle restriction (N1-N6 blocked)
  if (member.nozzleRestriction === true) {
    return false;
  }

  // RULE 2 & 3: H5/H6 restrictions (Female OR hangingRestriction)
  if (nozzleKey === 'N5' || nozzleKey === 'N6') {
    // Female blocked from H5/H6
    if (member.gender && member.gender.toLowerCase() === 'female') {
      return false;
    }
    // Hanging restriction blocked from H5/H6
    if (member.hangingRestriction === true) {
      return false;
    }
  }

  return true; // Allowed
};

// Shuffle for fair rotation
const shuffle = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};


//auto assign

exports.autoAssign = async (req, res) => {
  try {
    const { shift, date } = req.body;

    if (!shift) {
      return res.status(400).json({ success: false, message: 'Shift is required' });
    }

    // 1. FETCH DATA
    const oppositeShift = shift.toLowerCase() === 'morning' ? 'evening' : 'morning';

    const primaryStaff = await Member.find({
      shift: new RegExp(`^${shift}$`, 'i'),
      available: 'present'
    });

    const backupStaff = await Member.find({
      shift: new RegExp(`^${oppositeShift}$`, 'i'),
      available: 'present'
    });

    // 2. ORGANIZE GROUPS
    const getRoleGroup = (staffList, role) => 
      shuffle(staffList.filter(m => m.role.toLowerCase() === role));

    const primarySupervisors = getRoleGroup(primaryStaff, 'supervisor');
    const primaryAirBoys = getRoleGroup(primaryStaff, 'air boy');
    const primaryOperators = getRoleGroup(primaryStaff, 'operator'); // All Primary Ops
    
    const backupAirBoys = getRoleGroup(backupStaff, 'air boy');
    const backupOperators = getRoleGroup(backupStaff, 'operator');

    // 3. INIT STATE
    const assignments = {
      Supervisor: null, Air: null,
      N1: null, N2: null, N3: null, N4: null, N5: null, N6: null,
      Extra: null
    };
    const assignedIds = new Set();
    const overtimeNozzles = new Set();
    let totalOTCount = 0;
    const MAX_TOTAL_OT = 3; 

    // Helper to check assignment status
    const isAssigned = (id) => assignedIds.has(id.toString());

    // ============================================================
    // PHASE 1: FILL WITH PRIMARY STAFF (Strict Priority)
    // ============================================================

    // 1.1 Assign Supervisor (Primary)
    if (primarySupervisors.length > 0) {
      const s = primarySupervisors[0];
      assignments.Supervisor = s.toObject();
      assignedIds.add(s._id.toString());
    }

    // 1.2 Assign Air Boy (Primary Only - for now)
    if (primaryAirBoys.length > 0) {
      const a = primaryAirBoys[0];
      assignments.Air = a.toObject();
      assignedIds.add(a._id.toString());
    }

    // 1.3 Assign Compulsory Hanging (Primary eligible male)
    // We prioritize filling H5/N6 with a capable Primary Operator first
    const hangingPriority = Math.random() < 0.5 ? ['N5', 'N6'] : ['N6', 'N5'];
    const isHangingEligible = (op) => op.gender?.toLowerCase() !== 'female' && op.hangingRestriction !== true;

    for (const hNozzle of hangingPriority) {
      const candidate = primaryOperators.find(op => 
        !isAssigned(op._id) && 
        canAssignToNozzle(op, hNozzle)
      );
      if (candidate) {
        assignments[hNozzle] = candidate.toObject();
        assignedIds.add(candidate._id.toString());
        break; // Filled one compulsory hanging
      }
    }

    // 1.4 Assign Remaining Nozzles (Primary)
    const nozzlePriority = ['N1', 'N2', 'N3', 'N4', 'N5', 'N6'];
    for (const nozzle of nozzlePriority) {
      if (assignments[nozzle]) continue; // Skip if filled by hanging step

      const candidate = primaryOperators.find(op => 
        !isAssigned(op._id) && 
        canAssignToNozzle(op, nozzle)
      );
      if (candidate) {
        assignments[nozzle] = candidate.toObject();
        assignedIds.add(candidate._id.toString());
      }
    }

    // ============================================================
    // PHASE 2: INTERNAL PROMOTION (Fill gaps with leftover Primary)
    // ============================================================
    
    // Agar Primary Operator bacha hai, aur Supervisor/Air Boy khali hai, to promote karo
    // (Taaki hum bahar se OT na bulaye agar ghar me log hain)
    
    // 2.1 Promote to Supervisor
    if (!assignments.Supervisor) {
      const candidate = primaryOperators.find(op => !isAssigned(op._id));
      if (candidate) {
        const sObj = candidate.toObject();
        sObj.promotedToSupervisor = true;
        assignments.Supervisor = sObj;
        assignedIds.add(candidate._id.toString());
      }
    }

    // 2.2 Promote to Air Boy
    if (!assignments.Air) {
      // Prefer restricted operator for Air (since they can't nozzle)
      const candidate = primaryOperators.find(op => !isAssigned(op._id) && op.nozzleRestriction === true) 
                     || primaryOperators.find(op => !isAssigned(op._id));
      if (candidate) {
        const aObj = candidate.toObject();
        aObj.promotedToAir = true;
        assignments.Air = aObj;
        assignedIds.add(candidate._id.toString());
      }
    }

    // ============================================================
    // PHASE 3: ASSIGN EXTRA (If anyone is still left)
    // ============================================================
    const extraCandidate = primaryOperators.find(op => !isAssigned(op._id));
    if (extraCandidate) {
      assignments.Extra = extraCandidate.toObject();
      assignedIds.add(extraCandidate._id.toString());
    }

    // ============================================================
    // PHASE 4: ASSIGN OT (ONLY IF NO EXTRA)
    // ============================================================
    
    // 🛑 CRITICAL CHECK: Agar Extra banda hai, to OT allowed nahi hai.
    if (!assignments.Extra) {

      // 4.1 OT for Air Boy (Backup Shift)
      if (!assignments.Air && totalOTCount < MAX_TOTAL_OT) {
        const backupAir = backupAirBoys.find(ab => !assignedIds.has(ab._id.toString()));
        if (backupAir) {
          const airObj = backupAir.toObject();
          airObj.name = `${airObj.name} (OT)`;
          airObj.isOvertime = true;
          assignments.Air = airObj;
          assignedIds.add(backupAir._id.toString());
          totalOTCount++;
        }
      }

      // 4.2 OT for Hanging (Compulsory)
      // Check if H5/H6 are empty. If yes, fill with Backup Operator.
      for (const hNozzle of hangingPriority) {
        if (!assignments[hNozzle] && totalOTCount < MAX_TOTAL_OT) {
          const backupOp = backupOperators.find(op => 
            !isAssigned(op._id) && 
            op.nozzleRestriction !== true && 
            isHangingEligible(op)
          );
          if (backupOp) {
            const opObj = backupOp.toObject();
            opObj.name = `${opObj.name} (OT)`;
            opObj.isOvertime = true;
            assignments[hNozzle] = opObj;
            assignedIds.add(backupOp._id.toString());
            overtimeNozzles.add(hNozzle);
            totalOTCount++;
            break; // Filled one compulsory
          }
        }
      }

      // 4.3 OT for Remaining Nozzles
      if (totalOTCount < MAX_TOTAL_OT) {
        const eligibleOT = backupOperators.filter(op => op.nozzleRestriction !== true);
        
        for (const nozzle of nozzlePriority) {
          if (assignments[nozzle]) continue;
          if (totalOTCount >= MAX_TOTAL_OT) break;

          // Check OT Pair Blocking
          let canUseOT = true;
          if (nozzle === 'N1' && overtimeNozzles.has('N2')) canUseOT = false;
          if (nozzle === 'N2' && overtimeNozzles.has('N1')) canUseOT = false;
          if (nozzle === 'N3' && overtimeNozzles.has('N4')) canUseOT = false;
          if (nozzle === 'N4' && overtimeNozzles.has('N3')) canUseOT = false;
          if (nozzle === 'N5' && overtimeNozzles.has('N6')) canUseOT = false;
          if (nozzle === 'N6' && overtimeNozzles.has('N5')) canUseOT = false;

          if (canUseOT) {
            const otCandidate = eligibleOT.find(op => !isAssigned(op._id) && canAssignToNozzle(op, nozzle));
            if (otCandidate) {
              const otObj = otCandidate.toObject();
              otObj.name = `${otObj.name} (OT)`;
              otObj.isOvertime = true;
              assignments[nozzle] = otObj;
              assignedIds.add(otCandidate._id.toString());
              overtimeNozzles.add(nozzle);
              totalOTCount++;
            }
          }
        }
      }
    }

    // ============================================================
    // 5. RESPONSE
    // ============================================================
    const assignedCount = nozzlePriority.reduce((acc, key) => assignments[key] ? acc + 1 : acc, 0);

    res.json({
      success: true,
      data: {
        assignments,
        summary: {
          assigned: assignedCount,
          overtime: totalOTCount,
          extra: assignments.Extra ? 1 : 0,
          supervisorPromoted: assignments.Supervisor?.promotedToSupervisor || false,
          airBoyPromoted: assignments.Air?.promotedToAir || false
        }
      }
    });

  } catch (err) {
    console.error('Auto-assign error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// --- MAP SAVING (EXISTING + UPDATED) ---

exports.saveMap = async (req, res) => {
  try {
    const { date, shift, image, caption, assignments } = req.body;

    if (!image) return res.status(400).json({ message: "No image data" });

    // 1. Upload Base64 to Cloudinary
    const uploadRes = await cloudinary.uploader.upload(image, {
      folder: "pump_shift_maps",
      resource_type: "image"
    });

    // 2. Save/Update in DB
    const updated = await MapSnapshot.findOneAndUpdate(
      { date, shift },
      {
        image: uploadRes.secure_url,
        caption: caption || '',
        assignments: assignments || {}
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, snapshot: updated });
  } catch (err) {
    console.error("Save Map Error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getAllMaps = async (req, res) => {
  try {
    const maps = await MapSnapshot.find().sort({ createdAt: -1 });
    res.json({ success: true, maps });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteMap = async (req, res) => {
  try {
    await MapSnapshot.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- SETTINGS & SMS (EXISTING) ---

exports.updateSettings = async (req, res) => {
  try {
    const { morningTime, eveningTime } = req.body;
    const settings = await Settings.findOneAndUpdate({},
      { morningTime, eveningTime },
      { new: true, upsert: true }
    );

    // Restart Cron Jobs with new time
    await restartScheduler();

    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.testSms = async (req, res) => {
  try {
    const { shift } = req.body;
    await sendShiftReport(shift);
    res.json({ success: true, message: "SMS Triggered" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// NEW: Get Dashboard Stats
exports.getStats = async (req, res) => {
  try {
    const totalMembers = await Member.countDocuments();
    const presentToday = await Member.countDocuments({ available: 'present' });
    const absentToday = await Member.countDocuments({ available: 'absent' });

    const operators = await Member.countDocuments({ role: 'operator' });
    const supervisors = await Member.countDocuments({ role: 'supervisor' });
    const airBoys = await Member.countDocuments({ role: 'air boy' });

    const morningShift = await Member.countDocuments({ shift: 'morning' });
    const eveningShift = await Member.countDocuments({ shift: 'evening' });

    const maleOperators = await Member.countDocuments({ role: 'operator', gender: 'male' });
    const femaleOperators = await Member.countDocuments({ role: 'operator', gender: 'female' });

    const restrictedOperators = await Member.countDocuments({
      role: 'operator',
      nozzleRestriction: true
    });

    res.json({
      success: true,
      data: {
        total: { members: totalMembers, present: presentToday, absent: absentToday },
        byRole: { operators, supervisors, airBoys },
        byShift: { morning: morningShift, evening: eveningShift },
        byGender: { male: maleOperators, female: femaleOperators },
        restrictions: {
          nozzle56Restricted: restrictedOperators,
          nozzle56Eligible: maleOperators - restrictedOperators
        }
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

