const mongoose = require('mongoose');

const MapSnapshotSchema = new mongoose.Schema({
  date: { type: String, required: true }, // YYYY-MM-DD
  shift: { type: String, required: true }, // Morning / Evening
  image: { type: String, required: true }, // Cloudinary URL
  caption: { type: String, default: "" },
  assignments: { type: Object, default: {} } // Saves who was where
}, { timestamps: true });

// Ensure unique map per date+shift (Upsert logic uses this)
MapSnapshotSchema.index({ date: 1, shift: 1 }, { unique: true });

module.exports = mongoose.model('MapSnapshot', MapSnapshotSchema);