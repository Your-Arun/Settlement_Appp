const express = require('express');
const router = express.Router();
const controller = require('../controllers/shiftingController');
const { upload } = require('../config/cloudinary');

// ============================================
// MEMBERS (EXISTING + NEW)
// ============================================

// List all members
router.get('/shifting', controller.listMembers);

// Add new member
router.post('/shifting', upload.single('avatar'), controller.addMember);

// Update availability (present/absent) - EXISTING
router.put('/shifting/:id', controller.updateStatus);

// NEW: Full member update (edit)
router.put('/members/:id', upload.single('avatar'), controller.updateMember);

// NEW: Delete member
router.delete('/members/:id', controller.deleteMember);

// ============================================
// AUTO ASSIGNMENT (NEW)
// ============================================

// Auto-assign shift with business rules
router.post('/auto-assign', controller.autoAssign);

// ============================================
// MAPS (EXISTING)
// ============================================

// Save map snapshot
router.post('/save-map', controller.saveMap);

// Get map snapshot by date and shift
router.get('/get-map', controller.getMap);

// Get all map history
router.get('/all-maps', controller.getAllMaps);

// Delete map
router.delete('/delete-map/:id', controller.deleteMap);

// ============================================
// SETTINGS & SMS (EXISTING)
// ============================================

// Update SMS timing settings
router.post('/settings', controller.updateSettings);

// Test SMS send
router.post('/test-sms', controller.testSms);

// ============================================
// STATISTICS (NEW)
// ============================================

// Get dashboard statistics
router.get('/stats', controller.getStats);

module.exports = router;