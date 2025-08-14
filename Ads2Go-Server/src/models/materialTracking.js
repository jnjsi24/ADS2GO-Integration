// src/models/MaterialTracking.js
const mongoose = require('mongoose');

const ErrorLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  message: { type: String, trim: true }
});

const MaterialTrackingSchema = new mongoose.Schema({
  // 1. Material & Driver References
  materialId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Material', 
    required: true 
  },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver' },
  deploymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'AdsDeployment' },

  // 2. Location & Movement
  gps: {
    lat: { type: Number, min: -90, max: 90 },   // validation for latitude
    lng: { type: Number, min: -180, max: 180 }  // validation for longitude
  },
  speed: { type: Number, min: 0 }, // km/h
  totalDistanceTraveled: { type: Number, min: 0 },
  lastKnownLocationTime: Date,

  // 3. Device Status
  deviceStatus: { 
    type: String, 
    enum: ['ONLINE', 'OFFLINE'], 
    default: 'OFFLINE' 
  },
  lastHeartbeat: Date,
  currentAdId: { type: mongoose.Schema.Types.ObjectId, ref: 'AdsDeployment' },
  adStartTime: Date,
  adLoopCount: { type: Number, min: 0 },

  // 4. Ad Performance Metrics
  totalAdImpressions: { type: Number, min: 0 },
  totalViewCount: { type: Number, min: 0 },
  averageViewTime: { type: Number, min: 0 }, // seconds

  // 5. Engagement Metrics
  qrCodeScans: { type: Number, min: 0 },
  interactions: { type: Number, min: 0 },

  // 6. Operational Analytics
  uptimePercentage: { type: Number, min: 0, max: 100 },
  lastMaintenanceDate: Date,
  errorLogs: [ErrorLogSchema],

  // 7. Non-Digital Tracking Fields
  materialCondition: { 
    type: String, 
    enum: ['GOOD', 'FADED', 'DAMAGED', 'REMOVED'],
    default: 'GOOD' 
  },
  inspectionPhotos: [{ type: String, trim: true }],
  lastInspectionDate: Date
}, { timestamps: true });

module.exports = mongoose.model('MaterialTracking', MaterialTrackingSchema);
