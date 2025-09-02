const mongoose = require('mongoose');

const ErrorLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  message: { type: String, trim: true },
  details: { type: mongoose.Schema.Types.Mixed }
});

const MonthlyPhotoSchema = new mongoose.Schema({
  month: { 
    type: String, 
    required: true,
    validate: {
      validator: function(v) {
        return /^\d{4}-\d{2}$/.test(v); // YYYY-MM format
      },
      message: 'Month must be in YYYY-MM format'
    }
  },
  photoUrls: [{ 
    type: String, 
    trim: true,
    validate: {
      validator: function(v) {
        return v.startsWith('https://firebasestorage.googleapis.com/');
      },
      message: 'Photo URLs must be valid Firebase Storage URLs'
    }
  }],
  uploadedAt: { type: Date, default: Date.now },
  uploadedBy: { type: String, required: true }, // driverId
  status: { 
    type: String, 
    enum: ['PENDING', 'APPROVED', 'REJECTED'], 
    default: 'PENDING' 
  },
  adminNotes: { type: String, trim: true },
  reviewedBy: { type: String }, // adminId
  reviewedAt: { type: Date }
}, { _id: false });

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
  
  // 8. Monthly Photo Tracking (NEW)
  monthlyPhotos: [MonthlyPhotoSchema],
  lastPhotoUpload: { type: Date },
  nextPhotoDue: { type: Date },
  photoComplianceStatus: { 
    type: String, 
    enum: ['COMPLIANT', 'NON_COMPLIANT', 'OVERDUE'], 
    default: 'COMPLIANT' 
  },
  
  // 9. Additional Metadata
  batteryLevel: { type: Number, min: 0, max: 100 }, // percentage
  signalStrength: { type: Number, min: 0, max: 5 }, // 0-5 bars
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  
  // 10. System Fields
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

// Index for monthly photo tracking
MaterialTrackingSchema.index({ 'monthlyPhotos.month': 1 });
MaterialTrackingSchema.index({ photoComplianceStatus: 1 });
MaterialTrackingSchema.index({ nextPhotoDue: 1 });

// Virtual for getting latitude
MaterialTrackingSchema.virtual('latitude').get(function() {
  return this.location?.coordinates?.[1];
});

// Virtual for getting longitude
MaterialTrackingSchema.virtual('longitude').get(function() {
  return this.location?.coordinates?.[0];
});

// Virtual for current month photo status
MaterialTrackingSchema.virtual('currentMonthPhotoStatus').get(function() {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const monthPhoto = this.monthlyPhotos?.find(photo => photo.month === currentMonth);
  return monthPhoto ? monthPhoto.status : 'PENDING';
});

// Virtual for next photo due date
MaterialTrackingSchema.virtual('isPhotoOverdue').get(function() {
  if (!this.nextPhotoDue) return false;
  return new Date() > this.nextPhotoDue;
});

// Methods for photo management
MaterialTrackingSchema.methods.addMonthlyPhoto = function(month, photoUrls, driverId) {
  // Remove existing photos for this month if they exist
  this.monthlyPhotos = this.monthlyPhotos.filter(photo => photo.month !== month);
  
  // Add new monthly photo
  this.monthlyPhotos.push({
    month,
    photoUrls,
    uploadedAt: new Date(),
    uploadedBy: driverId,
    status: 'PENDING'
  });
  
  // Update tracking fields
  this.lastPhotoUpload = new Date();
  this.nextPhotoDue = this.calculateNextPhotoDue();
  this.photoComplianceStatus = this.calculatePhotoComplianceStatus();
  
  return this.save();
};

MaterialTrackingSchema.methods.calculateNextPhotoDue = function() {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth;
};

MaterialTrackingSchema.methods.calculatePhotoComplianceStatus = function() {
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  
  // Check if current month photo exists
  const hasCurrentMonthPhoto = this.monthlyPhotos?.some(photo => 
    photo.month === currentMonth && photo.status !== 'REJECTED'
  );
  
  if (hasCurrentMonthPhoto) {
    return 'COMPLIANT';
  }
  
  // Check if overdue
  if (this.nextPhotoDue && now > this.nextPhotoDue) {
    return 'OVERDUE';
  }
  
  return 'NON_COMPLIANT';
};

MaterialTrackingSchema.methods.reviewMonthlyPhoto = function(month, status, adminId, notes = '') {
  const monthPhoto = this.monthlyPhotos?.find(photo => photo.month === month);
  if (!monthPhoto) {
    throw new Error(`No photo found for month ${month}`);
  }
  
  monthPhoto.status = status;
  monthPhoto.reviewedBy = adminId;
  monthPhoto.reviewedAt = new Date();
  monthPhoto.adminNotes = notes;
  
  // Update compliance status
  this.photoComplianceStatus = this.calculatePhotoComplianceStatus();
  
  return this.save();
};

// Static methods
MaterialTrackingSchema.statics.findOverduePhotos = function() {
  const now = new Date();
  return this.find({
    nextPhotoDue: { $lt: now },
    photoComplianceStatus: { $ne: 'COMPLIANT' }
  });
};

MaterialTrackingSchema.statics.findByDriverId = function(driverId) {
  return this.find({ driverId });
};

MaterialTrackingSchema.statics.findByMaterialId = function(materialId) {
  return this.find({ materialId });
};

module.exports = mongoose.models.MaterialTracking || mongoose.model('MaterialTracking', MaterialTrackingSchema);
