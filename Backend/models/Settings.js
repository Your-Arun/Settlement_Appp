const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  morningTime: { type: String, default: "05:00" }, 
  eveningTime: { type: String, default: "14:00" }
});

module.exports = mongoose.model('Settings', settingsSchema);