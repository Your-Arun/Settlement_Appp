// ========================================
// COMPLETE MEMBER MODEL
// File: models/Member.js
// ========================================

const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  role: { 
    type: String, 
    enum: ['operator', 'supervisor', 'air boy'], 
    required: true,
    lowercase: true
  },
  shift: { 
    type: String, 
    enum: ['morning', 'evening'], 
    required: true,
    lowercase: true
  },
  phoneNumber: { 
    type: String, 
    required: true,
    unique: true
  },
  gender: { 
    type: String, 
    enum: ['male', 'female'], 
    default: 'male',
    lowercase: true
  },
  available: { 
    type: String, 
    enum: ['present', 'absent'], 
    default: 'present',
    lowercase: true
  },
  avatar: { 
    type: String,
    default: null
  },
  
  // ✅ RESTRICTIONS (3 Types)
  nozzleRestriction: { 
    type: Boolean, 
    default: false,
    description: 'Complete block from ALL nozzles (N1-N6)'
  },
  
  hangingRestriction: { 
    type: Boolean, 
    default: false,
    description: 'Block from H5/H6 only'
  },
  
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for faster queries
memberSchema.index({ shift: 1, available: 1 });
memberSchema.index({ role: 1 });

module.exports = mongoose.model('Member', memberSchema);