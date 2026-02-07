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
    // Mobile sends file via Multer
    const avatarUrl = req.file ? req.file.path : null;

    const newMember = new Member({
      name: req.body.name,
      role: req.body.role || 'operator',
      shift: req.body.shift || 'morning',
      phoneNumber: req.body.phoneNumber,
      available: 'present',
      gender: req.body.gender || 'male',
      nozzleRestriction: req.body.nozzleRestriction === 'true' || req.body.nozzleRestriction === true,
      avatar: avatarUrl
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
    const { id } = req.params;
    const updates = {};
    
    if (req.body.name) updates.name = req.body.name;
    if (req.body.role) updates.role = req.body.role;
    if (req.body.shift) updates.shift = req.body.shift;
    if (req.body.gender) updates.gender = req.body.gender;
    if (req.body.phoneNumber) updates.phoneNumber = req.body.phoneNumber;
    if (req.body.nozzleRestriction !== undefined) {
      updates.nozzleRestriction = req.body.nozzleRestriction === 'true' || req.body.nozzleRestriction === true;
    }
    
    // Handle avatar upload if new file
    if (req.file) {
      updates.avatar = req.file.path;
    }

    const updated = await Member.findByIdAndUpdate(id, updates, { new: true });
    res.json({ success: true, member: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

// Check conditions (Gender/Restriction)
const canAssignToNozzle = (member, nozzleKey) => {
  if (nozzleKey === 'N5' || nozzleKey === 'N6') {
    // H5/H6: Must be Male AND Not Restricted
    const isMale = member.gender && member.gender.toLowerCase() === 'male';
    const isRestricted = member.nozzleRestriction === true; 
    return isMale && !isRestricted;
  }
  return true; // N1-N4: Anyone
};

// Shuffle array for fair rotation
const shuffle = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j] , arr[i]];
  }
  return arr;
};

exports.autoAssign = async (req, res) => {
  try {
    const { shift, date } = req.body;

    if (!shift) {
      return res.status(400).json({ success: false, message: 'Shift is required' });
    }

    // 1. FETCH MEMBERS
    const oppositeShift = shift.toLowerCase() === 'morning' ? 'evening' : 'morning';

    // Primary Shift (Current)
    const primaryStaff = await Member.find({
      shift: new RegExp(`^${shift}$`, 'i'),
      available: 'present'
    });

    // Backup Shift (Opposite - for OT)
    const backupStaff = await Member.find({
      shift: new RegExp(`^${oppositeShift}$`, 'i'),
      available: 'present'
    });

    // 2. ORGANIZE BY ROLES
    const getRoleGroup = (staffList, role) => 
      shuffle(staffList.filter(m => m.role.toLowerCase() === role));

    // Primary shift roles
    const primarySupervisors = getRoleGroup(primaryStaff, 'supervisor');
    const primaryAirBoys = getRoleGroup(primaryStaff, 'air boy');
    const primaryOperators = getRoleGroup(primaryStaff, 'operator');
    
    // Backup shift operators (for OT)
    const backupOperators = getRoleGroup(backupStaff, 'operator');

    // 3. INIT STATE
    const assignments = {
      Supervisor: null, 
      Air: null,
      N1: null, N2: null, N3: null, N4: null, N5: null, N6: null,
      Extra: null
    };

    const assignedIds = new Set();
    const overtimeNozzles = new Set(); // Track which nozzles have OT
    
    let totalOTCount = 0;
    const MAX_TOTAL_OT = 4;

    // 4. ASSIGN SUPERVISOR (COMPULSORY - Can be operator if no supervisor)
    if (primarySupervisors.length > 0) {
      assignments.Supervisor = primarySupervisors[0];
      assignedIds.add(primarySupervisors[0]._id.toString());
    } else {
      // ✅ Rule 4: If no supervisor, promote an operator
      const backupSupervisor = primaryOperators.find(op => !assignedIds.has(op._id.toString()));
      if (backupSupervisor) {
        const supervisorObj = backupSupervisor.toObject();
        supervisorObj.promotedToSupervisor = true; // Flag for info
        assignments.Supervisor = supervisorObj;
        assignedIds.add(supervisorObj._id.toString());
      }
    }

    // 5. ASSIGN AIR BOY
    if (primaryAirBoys.length > 0) {
      assignments.Air = primaryAirBoys[0];
      assignedIds.add(primaryAirBoys[0]._id.toString());
    }

    // 6. HELPER FUNCTION: Assign to nozzle
    const assignToNozzle = (nozzleKey, operators, isOT = false) => {
      const candidate = operators.find(op => 
        !assignedIds.has(op._id.toString()) && canAssignToNozzle(op, nozzleKey)
      );

      if (candidate) {
        let staffObj = candidate.toObject();
        
        if (isOT) {
          staffObj.name = `${staffObj.name} (OT)`;
          staffObj.isOvertime = true;
          overtimeNozzles.add(nozzleKey);
          totalOTCount++;
        }
        
        assignments[nozzleKey] = staffObj;
        assignedIds.add(staffObj._id.toString());
        return true;
      }
      return false;
    };

    // 7. ASSIGN NOZZLES IN PRIORITY ORDER
    // Priority: N1, N2, N3, N4, N5, N6
    
    const nozzlePriority = ['N1', 'N2', 'N3', 'N4', 'N5', 'N6'];

    // PASS 1: Assign from PRIMARY SHIFT ONLY
    for (const nozzle of nozzlePriority) {
      assignToNozzle(nozzle, primaryOperators, false);
    }

    // PASS 2: Fill remaining with OVERTIME (with restrictions)
    if (totalOTCount < MAX_TOTAL_OT) {
      for (const nozzle of nozzlePriority) {
        // Skip if already assigned
        if (assignments[nozzle]) continue;
        
        // Skip if total OT limit reached
        if (totalOTCount >= MAX_TOTAL_OT) break;

        // ✅ Rule 3: Check OT pair restrictions
        let canUseOT = true;

        if (nozzle === 'N1' && overtimeNozzles.has('N2')) canUseOT = false;
        if (nozzle === 'N2' && overtimeNozzles.has('N1')) canUseOT = false;
        if (nozzle === 'N3' && overtimeNozzles.has('N4')) canUseOT = false;
        if (nozzle === 'N4' && overtimeNozzles.has('N3')) canUseOT = false;
        if (nozzle === 'N5' && overtimeNozzles.has('N6')) canUseOT = false;
        if (nozzle === 'N6' && overtimeNozzles.has('N5')) canUseOT = false;

        if (canUseOT) {
          assignToNozzle(nozzle, backupOperators, true);
        }
      }
    }

    // 8. ASSIGN EXTRA OPERATOR
    const extraCandidate = primaryOperators.find(op => !assignedIds.has(op._id.toString()));
    if (extraCandidate) {
      assignments.Extra = extraCandidate.toObject();
      assignedIds.add(extraCandidate._id.toString());
    }

    // 9. CALCULATE SUMMARY
    const assignedCount = ['N1', 'N2', 'N3', 'N4', 'N5', 'N6'].reduce((acc, key) => 
      assignments[key] ? acc + 1 : acc, 0
    );

    // 10. RESPONSE
    res.json({
      success: true,
      data: {
        assignments,
        summary: {
          totalOperators: primaryOperators.length,
          assigned: assignedCount,
          overtime: totalOTCount,
          extra: assignments.Extra ? 1 : 0,
          supervisorPromoted: assignments.Supervisor?.promotedToSupervisor || false
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