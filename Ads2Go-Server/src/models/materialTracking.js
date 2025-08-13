// src/models/MaterialTracking.js
const mongoose = require('mongoose');

const ErrorLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  message: String
});

const MaterialTrackingSchema = new mongoose.Schema({
  // 1. Material & Driver References
  materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver' },
  deploymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'AdsDeployment' },

  // 2. Location & Movement
  gps: {
    lat: Number,
    lng: Number
  },
  speed: Number, // km/h
  totalDistanceTraveled: Number,
  lastKnownLocationTime: Date,

  // 3. Device Status
  deviceStatus: { type: String, enum: ['ONLINE', 'OFFLINE'] },
  lastHeartbeat: Date,
  currentAdId: { type: mongoose.Schema.Types.ObjectId, ref: 'AdsDeployment' },
  adStartTime: Date,
  adLoopCount: Number,

  // 4. Ad Performance Metrics
  totalAdImpressions: Number,
  totalViewCount: Number,
  averageViewTime: Number,

  // 5. Engagement Metrics
  qrCodeScans: Number,
  interactions: Number,

  // 6. Operational Analytics
  uptimePercentage: Number,
  lastMaintenanceDate: Date,
  errorLogs: [ErrorLogSchema],

  // 7. Non-Digital Tracking Fields
  materialCondition: { type: String, enum: ['GOOD', 'FADED', 'DAMAGED', 'REMOVED'] },
  inspectionPhotos: [String],
  lastInspectionDate: Date
}, { timestamps: true });

module.exports = mongoose.model('MaterialTracking', MaterialTrackingSchema);
