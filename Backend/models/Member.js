const mongoose = require('mongoose');

const MemberSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['operator', 'supervisor', 'air boy'],
    default: 'operator' 
  },
  shift: { 
    type: String, 
    enum: ['morning', 'evening'],
    default: 'morning' 
  },
  available: { 
    type: String, 
    enum: ['present', 'absent'],
    default: 'present' 
  },
  avatar: { type: String, default: null },
  phoneNumber: { type: String, required: true },
  gender: { 
    type: String, 
    enum: ['male', 'female'],
    default: 'male' 
  },
  // NEW FIELD: Nozzle 5 & 6 Restriction
  nozzleRestriction: { 
    type: Boolean, 
    default: false,
    // If true, member CANNOT be assigned to nozzle 5 or 6
  }
}, { timestamps: true });

// Index for faster queries
MemberSchema.index({ shift: 1, available: 1, role: 1 });

module.exports = mongoose.model('Member', MemberSchema);