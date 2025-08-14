const mongoose = require('mongoose');

const TabletSchema = new mongoose.Schema({
  materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
  carGroupId: { type: String, required: true }, // group tablets under same car
  tabletNumber: { type: Number, enum: [1, 2], required: true },
  status: { type: String, enum: ['ONLINE', 'OFFLINE'], default: 'OFFLINE' },
  gps: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null }
  },
  lastSeen: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Tablet', TabletSchema);
