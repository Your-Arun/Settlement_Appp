const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  morningTime: { type: String, default: "06:00" },
  eveningTime: { type: String, default: "14:30" },
  nightTime: { type: String, default: "23:00" }
});

module.exports = mongoose.model('Settings', settingsSchema);