/**
 * DeviceUnregistrationLog - Audit trail for device unregistrations
 * 
 * Tracks when devices are unregistered, by whom, and final metrics
 */

const mongoose = require('mongoose');

const DeviceUnregistrationLogSchema = new mongoose.Schema({
  deviceId: { 
    type: String, 
    required: true, 
    index: true 
  },
  materialId: { 
    type: String, 
    required: true, 
    index: true 
  },
  slotNumber: { 
    type: Number, 
    required: true 
  },
  unregisteredAt: { 
    type: Date, 
    required: true, 
    default: Date.now,
    index: true
  },
  unregisteredBy: { 
    type: String 
  }, // Admin email
  
  finalMetrics: {
    totalAdPlays: { type: Number, default: 0 },
    totalHoursOnline: { type: Number, default: 0 },
    totalQRScans: { type: Number, default: 0 },
    totalDistanceTraveled: { type: Number, default: 0 }
  },
  
  reason: { type: String }, // Optional unregistration reason
  notes: { type: String }   // Optional notes
}, {
  timestamps: true
});

// Compound index for efficient queries
DeviceUnregistrationLogSchema.index({ materialId: 1, unregisteredAt: -1 });
DeviceUnregistrationLogSchema.index({ deviceId: 1, unregisteredAt: -1 });

module.exports = mongoose.model('DeviceUnregistrationLog', DeviceUnregistrationLogSchema);

