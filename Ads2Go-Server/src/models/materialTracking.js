const mongoose = require('mongoose');

const ErrorLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  message: { type: String, trim: true },
  details: { type: mongoose.Schema.Types.Mixed }
});

const MaterialTrackingSchema = new mongoose.Schema({
  // 1. Material & Driver References
  materialId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Material', 
    required: true,
    index: true
  },
  driverId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Driver',
    index: true 
  },
  deploymentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'AdsDeployment',
    index: true 
  },

  // 2. Location & Movement
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
      index: '2dsphere'
    }
  },
  address: { type: String, trim: true },
  speed: { type: Number, min: 0 }, // km/h
  heading: { type: Number, min: 0, max: 360 }, // degrees
  accuracy: { type: Number, min: 0 }, // meters
  altitude: { type: Number },
  totalDistanceTraveled: { type: Number, min: 0 },
  lastKnownLocationTime: { type: Date },

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
  lastInspectionDate: Date,
  
  // 8. Additional Metadata
  batteryLevel: { type: Number, min: 0, max: 100 }, // percentage
  signalStrength: { type: Number, min: 0, max: 5 }, // 0-5 bars
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  
  // 9. System Fields
  isActive: { type: Boolean, default: true },
  metadata: { type: mongoose.Schema.Types.Mixed }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Geospatial index for location-based queries
MaterialTrackingSchema.index({ location: '2dsphere' });

// Compound index for common queries
MaterialTrackingSchema.index({ materialId: 1, lastKnownLocationTime: -1 });
MaterialTrackingSchema.index({ driverId: 1, lastKnownLocationTime: -1 });

// Virtual for getting latitude
MaterialTrackingSchema.virtual('latitude').get(function() {
  return this.location?.coordinates?.[1];
});

// Virtual for getting longitude
MaterialTrackingSchema.virtual('longitude').get(function() {
  return this.location?.coordinates?.[0];
});

module.exports = mongoose.model('MaterialTracking', MaterialTrackingSchema);
