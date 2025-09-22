const mongoose = require('mongoose');

const QRScanTrackingSchema = new mongoose.Schema({
  // Ad and Material Information
  adId: {
    type: String,
    required: true,
    index: true
  },
  adTitle: {
    type: String,
    required: true
  },
  materialId: {
    type: String,
    required: true,
    index: true
  },
  slotNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 2
  },
  
  // Scan Information
  scanTimestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  qrCodeUrl: {
    type: String,
    required: true
  },
  website: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Allow empty website
        return /^https?:\/\/.+/.test(v); // Must be a valid URL if provided
      },
      message: 'Website must be a valid URL starting with http:// or https://'
    }
  },
  redirectUrl: {
    type: String,
    required: false, // Make it optional since it might not always be provided
    trim: true
  },
  
  // Device and User Information
  userAgent: {
    type: String,
    trim: true
  },
  deviceType: {
    type: String,
    enum: ['mobile', 'tablet', 'desktop', 'unknown'],
    default: 'unknown'
  },
  browser: {
    type: String,
    trim: true
  },
  operatingSystem: {
    type: String,
    trim: true
  },
  
  // Location Information (if available)
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere'
    }
  },
  ipAddress: {
    type: String,
    trim: true
  },
  country: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    trim: true
  },
  
  // Engagement Data
  timeOnPage: {
    type: Number,
    min: 0,
    default: 0 // in seconds
  },
  actionsTaken: [{
    action: {
      type: String,
      enum: ['page_view', 'button_click', 'link_click', 'form_submit', 'download'],
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    details: {
      type: String,
      trim: true
    }
  }],
  
  // Conversion Tracking
  converted: {
    type: Boolean,
    default: false
  },
  conversionType: {
    type: String,
    enum: ['purchase', 'signup', 'download', 'contact', 'other'],
    trim: true
  },
  conversionValue: {
    type: Number,
    min: 0,
    default: 0
  },
  
  // Referral Information
  referrer: {
    type: String,
    trim: true
  },
  utmSource: {
    type: String,
    trim: true
  },
  utmMedium: {
    type: String,
    trim: true
  },
  utmCampaign: {
    type: String,
    trim: true
  },
  
  // Android Player Data
  deviceInfo: {
    deviceId: { type: String },
    deviceName: { type: String },
    deviceType: { type: String },
    osName: { type: String },
    osVersion: { type: String },
    platform: { type: String },
    brand: { type: String },
    modelName: { type: String }
  },
  gpsData: {
    lat: { type: Number },
    lng: { type: Number },
    speed: { type: Number },
    heading: { type: Number },
    accuracy: { type: Number },
    altitude: { type: Number }
  },
  registrationData: {
    deviceId: { type: String },
    carGroupId: { type: String },
    isRegistered: { type: Boolean }
  },
  networkStatus: {
    type: Boolean,
    default: false
  },
  isOffline: {
    type: Boolean,
    default: false
  },
  screenData: {
    width: { type: Number },
    height: { type: Number },
    scale: { type: Number }
  },

  // System Fields
  isActive: {
    type: Boolean,
    default: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
QRScanTrackingSchema.index({ adId: 1, scanTimestamp: -1 });
QRScanTrackingSchema.index({ materialId: 1, scanTimestamp: -1 });
QRScanTrackingSchema.index({ scanTimestamp: -1 });
QRScanTrackingSchema.index({ converted: 1 });
QRScanTrackingSchema.index({ 'location.coordinates': '2dsphere' });

// Virtual for scan date (date only, no time)
QRScanTrackingSchema.virtual('scanDate').get(function() {
  return this.scanTimestamp.toISOString().split('T')[0];
});

// Virtual for device detection
QRScanTrackingSchema.virtual('isMobile').get(function() {
  return this.deviceType === 'mobile';
});

// Methods
QRScanTrackingSchema.methods.addAction = function(action, details = '') {
  this.actionsTaken.push({
    action,
    details,
    timestamp: new Date()
  });
  return this.save();
};

QRScanTrackingSchema.methods.markConversion = function(conversionType, value = 0) {
  this.converted = true;
  this.conversionType = conversionType;
  this.conversionValue = value;
  return this.save();
};

QRScanTrackingSchema.methods.updateTimeOnPage = function(timeInSeconds) {
  this.timeOnPage = timeInSeconds;
  return this.save();
};

// Static methods
QRScanTrackingSchema.statics.getScanStats = function(adId, startDate, endDate) {
  const query = { adId };
  if (startDate && endDate) {
    query.scanTimestamp = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  return this.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        totalScans: { $sum: 1 },
        uniqueDevices: { $addToSet: '$userAgent' },
        totalConversions: { $sum: { $cond: ['$converted', 1, 0] } },
        averageTimeOnPage: { $avg: '$timeOnPage' },
        totalConversionValue: { $sum: '$conversionValue' }
      }
    },
    {
      $project: {
        _id: 0,
        totalScans: 1,
        uniqueDevices: { $size: '$uniqueDevices' },
        totalConversions: 1,
        conversionRate: {
          $multiply: [
            { $divide: ['$totalConversions', '$totalScans'] },
            100
          ]
        },
        averageTimeOnPage: { $round: ['$averageTimeOnPage', 2] },
        totalConversionValue: 1
      }
    }
  ]);
};

QRScanTrackingSchema.statics.getTopPerformingAds = function(limit = 10, startDate, endDate) {
  const query = {};
  if (startDate && endDate) {
    query.scanTimestamp = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  return this.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$adId',
        adTitle: { $first: '$adTitle' },
        totalScans: { $sum: 1 },
        totalConversions: { $sum: { $cond: ['$converted', 1, 0] } },
        averageTimeOnPage: { $avg: '$timeOnPage' },
        totalConversionValue: { $sum: '$conversionValue' }
      }
    },
    {
      $addFields: {
        conversionRate: {
          $multiply: [
            { $divide: ['$totalConversions', '$totalScans'] },
            100
          ]
        }
      }
    },
    { $sort: { totalScans: -1 } },
    { $limit: limit }
  ]);
};

QRScanTrackingSchema.statics.getScansByLocation = function(materialId, startDate, endDate) {
  const query = { materialId };
  if (startDate && endDate) {
    query.scanTimestamp = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  return this.aggregate([
    { $match: query },
    {
      $group: {
        _id: {
          city: '$city',
          country: '$country'
        },
        totalScans: { $sum: 1 },
        uniqueDevices: { $addToSet: '$userAgent' }
      }
    },
    {
      $project: {
        _id: 0,
        city: '$_id.city',
        country: '$_id.country',
        totalScans: 1,
        uniqueDevices: { $size: '$uniqueDevices' }
      }
    },
    { $sort: { totalScans: -1 } }
  ]);
};

// DEPRECATED: QRScanTracking model is no longer used
// QR scans are now handled directly in the analytics collection
// This model is kept for reference but should not be used
// module.exports = mongoose.models.QRScanTracking || mongoose.model('QRScanTracking', QRScanTrackingSchema);

// Return a dummy model that doesn't create a collection
module.exports = {
  find: () => Promise.resolve([]),
  findOne: () => Promise.resolve(null),
  create: () => Promise.reject(new Error('QRScanTracking model is deprecated - use analytics collection instead')),
  save: () => Promise.reject(new Error('QRScanTracking model is deprecated - use analytics collection instead')),
  deleteMany: () => Promise.resolve({ deletedCount: 0 }),
  countDocuments: () => Promise.resolve(0),
  aggregate: () => Promise.resolve([])
};
