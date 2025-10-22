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

const DeviceComplianceSchema = new mongoose.Schema({
  // 1. Core References
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

  // 2. Inspection metadata (condition now tracked on Material, not here)
  inspectionPhotos: [{ type: String, trim: true }],
  lastInspectionDate: Date,
  
  // 3. Monthly Photo Compliance System
  monthlyPhotos: [MonthlyPhotoSchema],
  lastPhotoUpload: { type: Date },
  nextPhotoDue: { type: Date },
  photoComplianceStatus: { 
    type: String, 
    enum: ['COMPLIANT', 'NON_COMPLIANT', 'OVERDUE', 'PENDING'], 
    default: 'PENDING' 
  },
  
  // 4. Operational Management
  lastMaintenanceDate: Date,
  errorLogs: [ErrorLogSchema],
  
  // 5. System Fields
  isActive: { type: Boolean, default: true },
  metadata: { type: mongoose.Schema.Types.Mixed }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for common queries
DeviceComplianceSchema.index({ materialId: 1, lastInspectionDate: -1 });
DeviceComplianceSchema.index({ driverId: 1, lastInspectionDate: -1 });

// Index for monthly photo tracking
DeviceComplianceSchema.index({ 'monthlyPhotos.month': 1 });
DeviceComplianceSchema.index({ photoComplianceStatus: 1 });
DeviceComplianceSchema.index({ nextPhotoDue: 1 });
// materialCondition index removed; condition is stored on Material

// Virtual for current month photo status
DeviceComplianceSchema.virtual('currentMonthPhotoStatus').get(function() {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const monthPhoto = this.monthlyPhotos?.find(photo => photo.month === currentMonth);
  return monthPhoto ? monthPhoto.status : 'PENDING';
});

// Virtual for next photo due date
DeviceComplianceSchema.virtual('isPhotoOverdue').get(function() {
  if (!this.nextPhotoDue) return false;
  return new Date() > this.nextPhotoDue;
});

// Virtual for material condition status
DeviceComplianceSchema.virtual('needsInspection').get(function() {
  if (!this.lastInspectionDate) return true;
  const daysSinceInspection = (new Date() - this.lastInspectionDate) / (1000 * 60 * 60 * 24);
  return daysSinceInspection > 30; // Needs inspection if more than 30 days
});

// Methods for photo management
DeviceComplianceSchema.methods.addMonthlyPhoto = function(month, photoUrls, driverId) {
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

DeviceComplianceSchema.methods.calculateNextPhotoDue = function() {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth;
};

DeviceComplianceSchema.methods.calculatePhotoComplianceStatus = function() {
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  
  const currentEntry = this.monthlyPhotos?.find(photo => photo.month === currentMonth);
  if (currentEntry) {
    if (currentEntry.status === 'APPROVED') return 'COMPLIANT';
    if (currentEntry.status === 'PENDING') return 'PENDING';
    // REJECTED will fall through to NON_COMPLIANT/OVERDUE logic
  }
  
  if (this.nextPhotoDue && now > this.nextPhotoDue) {
    return 'OVERDUE';
  }
  
  return 'NON_COMPLIANT';
};

DeviceComplianceSchema.methods.reviewMonthlyPhoto = function(month, status, adminId, notes = '') {
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
DeviceComplianceSchema.statics.findOverduePhotos = function() {
  const now = new Date();
  return this.find({
    nextPhotoDue: { $lt: now },
    photoComplianceStatus: { $ne: 'COMPLIANT' }
  });
};

DeviceComplianceSchema.statics.findByDriverId = function(driverId) {
  return this.find({ driverId });
};

DeviceComplianceSchema.statics.findByMaterialId = function(materialId) {
  return this.find({ materialId });
};

DeviceComplianceSchema.statics.findOverdueInspections = function() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return this.find({
    $or: [
      { lastInspectionDate: { $lt: thirtyDaysAgo } },
      { lastInspectionDate: { $exists: false } }
    ]
  });
};

// Removed findByCondition; condition is tracked on Material model

module.exports = mongoose.models.DeviceCompliance || mongoose.model('DeviceCompliance', DeviceComplianceSchema);