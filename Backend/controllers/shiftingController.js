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
    // PHASE 1: FILL PRIMARY ROLES & COMPULSORY SUPERVISOR PROMOTION
    // ============================================================

    // 1.1 Assign Supervisor (Primary)
    if (primarySupervisors.length > 0) {
      const s = primarySupervisors[0];
      assignments.Supervisor = s.toObject();
      assignedIds.add(s._id.toString());
    }

    // 1.2 Assign Air Boy (Primary Only)
    if (primaryAirBoys.length > 0) {
      const a = primaryAirBoys[0];
      assignments.Air = a.toObject();
      assignedIds.add(a._id.toString());
    }

    // 1.3 Handle Supervisor Vacancy (Compulsory - Promote primary operator if no primary supervisor is present)
    if (!assignments.Supervisor) {
      // Prefer operator with nozzle restriction
      const index = primaryOperators.findIndex(op => op.nozzleRestriction === true);
      const candidate = index !== -1 ? primaryOperators.splice(index, 1)[0] : primaryOperators.shift();
      if (candidate) {
        const sObj = candidate.toObject();
        sObj.promotedToSupervisor = true;
        assignments.Supervisor = sObj;
        assignedIds.add(candidate._id.toString());
      }
    }

    // ============================================================
    // PHASE 2: OPTIMAL OPERATOR ASSIGNMENT (BACKTRACKING)
    // ============================================================
    const nozzles = ['N1', 'N2', 'N3', 'N4', 'N5', 'N6'];
    let bestNozzleAssignment = {};
    let maxNozzlesFilled = -1;

    const assignNozzles = (nozzleIndex, currentAssign, assignedOperatorIds) => {
      if (nozzleIndex === nozzles.length) {
        const filledCount = Object.keys(currentAssign).length;
        if (filledCount > maxNozzlesFilled) {
          maxNozzlesFilled = filledCount;
          bestNozzleAssignment = { ...currentAssign };
        }
        return;
      }

      const nozzle = nozzles[nozzleIndex];

      // Option 1: Try assigning an eligible and unassigned operator to this nozzle
      for (const op of primaryOperators) {
        const opId = op._id.toString();
        if (!assignedOperatorIds.has(opId) && canAssignToNozzle(op, nozzle)) {
          currentAssign[nozzle] = op;
          assignedOperatorIds.add(opId);

          assignNozzles(nozzleIndex + 1, currentAssign, assignedOperatorIds);

          // Backtrack
          delete currentAssign[nozzle];
          assignedOperatorIds.delete(opId);
        }
      }

      // Option 2: Leave this nozzle empty (to explore other configurations)
      assignNozzles(nozzleIndex + 1, currentAssign, assignedOperatorIds);
    };

    // Run the search to find the assignment that fills the maximum nozzles
    assignNozzles(0, {}, new Set());

    // Apply the best nozzle assignment
    for (const nozzle of nozzles) {
      if (bestNozzleAssignment[nozzle]) {
        const op = bestNozzleAssignment[nozzle];
        assignments[nozzle] = op.toObject();
        assignedIds.add(op._id.toString());
      }
    }

    // Get primary operators that were not assigned to any nozzle or promoted to Supervisor
    const leftoverOperators = primaryOperators.filter(op => !isAssigned(op._id));

    // ============================================================
    // PHASE 3: INTERNAL PROMOTION & EXTRA
    // ============================================================

    // 3.1 Promote to Air Boy if vacant
    if (!assignments.Air) {
      // Prefer restricted operator for Air
      const index = leftoverOperators.findIndex(op => op.nozzleRestriction === true);
      const candidate = index !== -1 ? leftoverOperators.splice(index, 1)[0] : leftoverOperators.shift();
      if (candidate) {
        const aObj = candidate.toObject();
        aObj.promotedToAir = true;
        assignments.Air = aObj;
        assignedIds.add(candidate._id.toString());
      }
    }

    // 3.2 Assign to Extra if any leftover primary operators remain
    if (leftoverOperators.length > 0) {
      const extraCandidate = leftoverOperators.shift();
      assignments.Extra = extraCandidate.toObject();
      assignedIds.add(extraCandidate._id.toString());
    }

    // ============================================================
    // PHASE 4: ASSIGN OVERTIME (OT)
    // ============================================================

    // 4.1 OT for Air Boy (Backup Shift)
    if (!assignments.Air && totalOTCount < MAX_TOTAL_OT) {
      const backupAir = backupAirBoys.find(ab => !isAssigned(ab._id));
      if (backupAir) {
        const airObj = backupAir.toObject();
        airObj.name = `${airObj.name} (OT)`;
        airObj.isOvertime = true;
        assignments.Air = airObj;
        assignedIds.add(backupAir._id.toString());
        totalOTCount++;
      }
    }

    // Adjacent OT check helper
    const isAdjacentNozzleOT = (nozzleKey, overtimeSet) => {
      if (nozzleKey === 'N1' && overtimeSet.has('N2')) return true;
      if (nozzleKey === 'N2' && overtimeSet.has('N1')) return true;
      if (nozzleKey === 'N3' && overtimeSet.has('N4')) return true;
      if (nozzleKey === 'N4' && overtimeSet.has('N3')) return true;
      if (nozzleKey === 'N5' && overtimeSet.has('N6')) return true;
      if (nozzleKey === 'N6' && overtimeSet.has('N5')) return true;
      return false;
    };

    const isHangingEligible = (op) => op.gender?.toLowerCase() !== 'female' && op.hangingRestriction !== true;

    // 4.2 Fill empty nozzles with OT (prioritizing N5/N6)
    const nozzleOrderForOT = ['N5', 'N6', 'N1', 'N2', 'N3', 'N4'];
    for (const nozzle of nozzleOrderForOT) {
      if (assignments[nozzle]) continue; // Already filled
      if (totalOTCount >= MAX_TOTAL_OT) break;

      // Check OT Pair Blocking
      if (isAdjacentNozzleOT(nozzle, overtimeNozzles)) continue;

      const otCandidate = backupOperators.find(op => 
        !isAssigned(op._id) && 
        op.nozzleRestriction !== true &&
        ((nozzle === 'N5' || nozzle === 'N6') ? isHangingEligible(op) : true)
      );

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

    // ============================================================
    // 5. RESPONSE
    // ============================================================
    const assignedCount = nozzles.reduce((acc, key) => assignments[key] ? acc + 1 : acc, 0);

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

