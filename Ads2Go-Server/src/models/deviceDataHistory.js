const mongoose = require('mongoose');

// Location Point Schema for historical data
const LocationPointSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['Point'],
    default: 'Point'
  },
  coordinates: {
    type: [Number], // [longitude, latitude]
    required: true
  },
  timestamp: { type: Date, default: Date.now },
  speed: { type: Number, default: 0 },
  heading: { type: Number, default: 0 },
  accuracy: { type: Number, default: 0 },
  address: { type: String, trim: true }
}, { _id: false });

// Hourly Stats Schema
const HourlyStatsSchema = new mongoose.Schema({
  hour: { type: Number, required: true, min: 0, max: 23 },
  adPlays: { type: Number, default: 0 },
  qrScans: { type: Number, default: 0 },
  distance: { type: Number, default: 0 }, // in km
  onlineMinutes: { type: Number, default: 0 },
  averageSpeed: { type: Number, default: 0 }, // km/h
  adImpressions: { type: Number, default: 0 },
  adPlayTime: { type: Number, default: 0 } // in seconds
}, { _id: false });

// Ad Performance Schema
const AdPerformanceSchema = new mongoose.Schema({
  adId: { type: String, required: true },
  adTitle: { type: String, required: true },
  playCount: { type: Number, default: 0 },
  totalViewTime: { type: Number, default: 0 }, // in seconds
  averageViewTime: { type: Number, default: 0 },
  completionRate: { type: Number, default: 0 },
  firstPlayed: { type: Date },
  lastPlayed: { type: Date },
  impressions: { type: Number, default: 0 }
}, { _id: false });

// Daily Summary Schema
const DailySummarySchema = new mongoose.Schema({
  peakHours: [{ type: Number, min: 0, max: 23 }],
  averageSpeed: { type: Number, default: 0 }, // km/h
  maxSpeed: { type: Number, default: 0 }, // km/h
  complianceRate: { type: Number, default: 0 }, // percentage
  adCompletionRate: { type: Number, default: 0 }, // percentage
  totalAdImpressions: { type: Number, default: 0 },
  totalAdPlayTime: { type: Number, default: 0 }, // in seconds
  uptimePercentage: { type: Number, default: 0 }, // percentage
  totalInteractions: { type: Number, default: 0 },
  totalScreenTaps: { type: Number, default: 0 },
  totalDebugActivations: { type: Number, default: 0 }
}, { _id: false });

// Main DeviceDataHistory Schema
const DeviceDataHistorySchema = new mongoose.Schema({
  // Device identification
  deviceId: { 
    type: String, 
    required: true,
    index: true
  },
  deviceSlot: { 
    type: Number, 
    required: true,
    min: 1,
    max: 5,
    index: true
  },
  date: { 
    type: Date, 
    required: true,
    index: true
  },
  
  // Device info
  deviceInfo: {
    deviceName: { type: String },
    deviceType: { type: String },
    osName: { type: String },
    osVersion: { type: String },
    platform: { type: String },
    brand: { type: String },
    modelName: { type: String },
    screenWidth: { type: Number },
    screenHeight: { type: Number },
    screenScale: { type: Number }
  },
  
  // Daily totals
  totalAdPlays: { type: Number, default: 0 },
  totalQRScans: { type: Number, default: 0 },
  totalDistanceTraveled: { type: Number, default: 0 }, // in km
  totalHoursOnline: { type: Number, default: 0 }, // in hours
  
  // Enhanced hours tracking with timezone awareness
  hoursTracking: {
    deviceTimezone: { type: String, default: 'Asia/Manila' },
    sessionStartTime: { type: Date },
    sessionEndTime: { type: Date },
    lastOnlineUpdate: { type: Date },
    offlinePeriods: [{
      startTime: { type: Date },
      endTime: { type: Date },
      duration: { type: Number, default: 0 } // in hours
    }],
    complianceStatus: { 
      type: String, 
      enum: ['COMPLIANT', 'NON_COMPLIANT', 'PENDING'],
      default: 'PENDING'
    },
    targetHours: { type: Number, default: 8 },
    precision: { type: String, default: '30s' } // Update frequency used
  },
  
  // Daily summary
  dailySummary: DailySummarySchema,
  
  // Hourly breakdown
  hourlyStats: [HourlyStatsSchema],
  
  // Location data
  locationHistory: [LocationPointSchema],
  
  // Ad performance
  adPerformance: [AdPerformanceSchema],
  
  // QR scan details
  qrScans: [{
    adId: { type: String, required: true },
    adTitle: { type: String, required: true },
    scanTimestamp: { type: Date, required: true },
    qrCodeUrl: { type: String },
    website: { type: String },
    redirectUrl: { type: String },
    userAgent: { type: String },
    deviceType: { type: String },
    browser: { type: String },
    operatingSystem: { type: String },
    ipAddress: { type: String },
    country: { type: String },
    city: { type: String },
    location: LocationPointSchema,
    timeOnPage: { type: Number, default: 0 },
    converted: { type: Boolean, default: false },
    conversionType: { type: String },
    conversionValue: { type: Number, default: 0 }
  }],
  
  // Ad playback details
  adPlaybacks: [{
    adId: { type: String, required: true },
    adTitle: { type: String, required: true },
    adDuration: { type: Number, required: true }, // in seconds
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    viewTime: { type: Number, default: 0 }, // actual time viewed in seconds
    completionRate: { type: Number, default: 0 }, // percentage
    impressions: { type: Number, default: 1 },
    slotNumber: { type: Number, required: true, min: 1, max: 5 }
  }],
  
  // Network and connectivity
  networkStatus: {
    isOnline: { type: Boolean, default: true },
    connectionType: { type: String },
    signalStrength: { type: Number, min: 0, max: 5 },
    lastSeen: { type: Date, default: Date.now }
  },
  
  // Compliance and alerts
  complianceData: {
    speedViolations: { type: Number, default: 0 },
    routeDeviations: { type: Number, default: 0 },
    offlineIncidents: { type: Number, default: 0 },
    displayIssues: { type: Number, default: 0 }
  },
  
  // Metadata
  archivedAt: { type: Date, default: Date.now },
  dataSource: { type: String, default: 'deviceTracking' },
  version: { type: String, default: '1.0' }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Pre-save validation hook
DeviceDataHistorySchema.pre('save', function(next) {
  // Validate hours tracking data before saving
  const validation = this.validateHoursTracking();
  if (!validation.isValid) {
    console.warn(`⚠️ Hours tracking validation warnings for device ${this.deviceId}:`, validation.errors);
    // Don't fail the save, just log warnings
  }
  
  // Ensure totalHoursOnline matches hoursTracking.totalOnlineHours
  if (this.hoursTracking && this.hoursTracking.totalOnlineHours !== undefined) {
    this.totalHoursOnline = this.hoursTracking.totalOnlineHours;
  }
  
  next();
});

// Indexes for efficient queries
DeviceDataHistorySchema.index({ deviceId: 1, date: -1 });
DeviceDataHistorySchema.index({ deviceSlot: 1, date: -1 });
DeviceDataHistorySchema.index({ date: -1 });
DeviceDataHistorySchema.index({ deviceId: 1, deviceSlot: 1, date: -1 });
DeviceDataHistorySchema.index({ 'locationHistory.coordinates': '2dsphere' });
DeviceDataHistorySchema.index({ 'hoursTracking.deviceTimezone': 1 });
DeviceDataHistorySchema.index({ 'hoursTracking.complianceStatus': 1 });

// Virtual for formatted date
DeviceDataHistorySchema.virtual('dateString').get(function() {
  return this.date.toISOString().split('T')[0];
});

// Static methods
DeviceDataHistorySchema.statics.getDeviceHistory = function(deviceId, startDate, endDate) {
  const query = { deviceId };
  if (startDate && endDate) {
    query.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  return this.find(query).sort({ date: -1 });
};

DeviceDataHistorySchema.statics.getDeviceSlotHistory = function(deviceSlot, startDate, endDate) {
  const query = { deviceSlot };
  if (startDate && endDate) {
    query.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  return this.find(query).sort({ date: -1 });
};

DeviceDataHistorySchema.statics.getDailySummary = function(date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return this.aggregate([
    {
      $match: {
        date: {
          $gte: startOfDay,
          $lte: endOfDay
        }
      }
    },
    {
      $group: {
        _id: null,
        totalDevices: { $sum: 1 },
        totalAdPlays: { $sum: '$totalAdPlays' },
        totalQRScans: { $sum: '$totalQRScans' },
        totalDistance: { $sum: '$totalDistanceTraveled' },
        totalHoursOnline: { $sum: '$totalHoursOnline' },
        averageCompliance: { $avg: '$dailySummary.complianceRate' },
        averageAdCompletion: { $avg: '$dailySummary.adCompletionRate' }
      }
    }
  ]);
};

// Instance methods
DeviceDataHistorySchema.methods.getHourlyStats = function(hour) {
  return this.hourlyStats.find(stat => stat.hour === hour);
};

DeviceDataHistorySchema.methods.getAdPerformance = function(adId) {
  return this.adPerformance.find(ad => ad.adId === adId);
};

// Validate hours tracking data
DeviceDataHistorySchema.methods.validateHoursTracking = function() {
  const errors = [];
  
  if (this.hoursTracking) {
    const { totalOnlineHours, totalOfflineHours, targetHours, deviceTimezone } = this.hoursTracking;
    
    // Validate total hours don't exceed 24 hours
    if (totalOnlineHours + totalOfflineHours > 24) {
      errors.push(`Total hours (${totalOnlineHours + totalOfflineHours}) exceed 24 hours`);
    }
    
    // Validate online hours don't exceed target
    if (totalOnlineHours > targetHours) {
      errors.push(`Online hours (${totalOnlineHours}) exceed target (${targetHours})`);
    }
    
    // Validate timezone format
    if (deviceTimezone && !/^[A-Za-z_]+\/[A-Za-z_]+$/.test(deviceTimezone)) {
      errors.push(`Invalid timezone format: ${deviceTimezone}`);
    }
    
    // Validate compliance status
    const expectedStatus = totalOnlineHours >= targetHours ? 'COMPLIANT' : 'NON_COMPLIANT';
    if (this.hoursTracking.complianceStatus !== expectedStatus) {
      errors.push(`Compliance status mismatch: expected ${expectedStatus}, got ${this.hoursTracking.complianceStatus}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
};

// Get timezone-aware date string
DeviceDataHistorySchema.methods.getDateInTimezone = function() {
  const TimezoneUtils = require('../utils/timezoneUtils');
  const deviceTimezone = this.hoursTracking?.deviceTimezone || 'Asia/Manila';
  return TimezoneUtils.getCurrentTimeInTimezone(deviceTimezone);
};

module.exports = mongoose.models.DeviceDataHistory || mongoose.model('DeviceDataHistory', DeviceDataHistorySchema);
