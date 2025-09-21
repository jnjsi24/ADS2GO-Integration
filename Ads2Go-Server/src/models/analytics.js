const mongoose = require('mongoose');

// GPS Location Schema
const LocationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['Point'],
    default: 'Point'
  },
  coordinates: {
    type: [Number], // [longitude, latitude]
    required: true,
    index: '2dsphere'
  },
  accuracy: { type: Number, min: 0 },
  altitude: { type: Number },
  speed: { type: Number, min: 0 }, // km/h
  heading: { type: Number, min: 0, max: 360 }, // degrees
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

// Device Information Schema
const DeviceInfoSchema = new mongoose.Schema({
  deviceId: { type: String, required: true },
  deviceName: { type: String },
  deviceType: { type: String, enum: ['mobile', 'tablet', 'desktop', 'unknown'] },
  osName: { type: String },
  osVersion: { type: String },
  platform: { type: String },
  brand: { type: String },
  modelName: { type: String },
  screenWidth: { type: Number },
  screenHeight: { type: Number },
  screenScale: { type: Number }
}, { _id: false });

// Ad Playback Schema
const AdPlaybackSchema = new mongoose.Schema({
  adId: { type: String, required: true },
  adTitle: { type: String, required: true },
  adDuration: { type: Number, required: true }, // in seconds
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  viewTime: { type: Number, default: 0 }, // actual time viewed in seconds
  completionRate: { type: Number, default: 0 }, // percentage
  impressions: { type: Number, default: 1 },
  slotNumber: { type: Number, required: true, min: 1, max: 2 }
}, { _id: false });

// QR Scan Schema
const QRScanSchema = new mongoose.Schema({
  adId: { type: String, required: true },
  adTitle: { type: String, required: true },
  scanTimestamp: { type: Date, default: Date.now },
  qrCodeUrl: { type: String },
  userAgent: { type: String },
  deviceType: { type: String },
  browser: { type: String },
  operatingSystem: { type: String },
  ipAddress: { type: String },
  country: { type: String },
  city: { type: String },
  location: LocationSchema,
  timeOnPage: { type: Number, default: 0 },
  converted: { type: Boolean, default: false },
  conversionType: { type: String },
  conversionValue: { type: Number, default: 0 }
}, { _id: false });

// Network Status Schema
const NetworkStatusSchema = new mongoose.Schema({
  isOnline: { type: Boolean, default: true },
  connectionType: { type: String },
  signalStrength: { type: Number, min: 0, max: 5 },
  lastSeen: { type: Date, default: Date.now }
}, { _id: false });

// Daily Session Schema
const DailySessionSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  totalHoursOnline: { type: Number, default: 0 },
  totalDistanceTraveled: { type: Number, default: 0 },
  totalAdPlayTime: { type: Number, default: 0 }, // in seconds
  totalQRScans: { type: Number, default: 0 },
  totalAdImpressions: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { _id: false });

// Main Analytics Schema
const AnalyticsSchema = new mongoose.Schema({
  // Device and Material Identification
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
    required: true,
    min: 1,
    max: 2,
    index: true
  },
  carGroupId: { 
    type: String,
    index: true
  },
  driverId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Driver',
    index: true
  },
  
  // Ad and User References
  adId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Ad',
    index: true
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    index: true
  },
  adDeploymentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'AdsDeployment',
    index: true
  },

  // Current Status
  isOnline: { type: Boolean, default: false },
  currentLocation: LocationSchema,
  networkStatus: NetworkStatusSchema,
  
  // Device Information
  deviceInfo: DeviceInfoSchema,
  
  // Ad Playback Analytics
  adPlaybacks: [AdPlaybackSchema],
  totalAdPlayTime: { type: Number, default: 0 }, // lifetime total in seconds
  totalAdImpressions: { type: Number, default: 0 },
  averageAdCompletionRate: { type: Number, default: 0 },
  currentAd: AdPlaybackSchema,
  
  // QR Scan Analytics
  qrScans: [QRScanSchema],
  totalQRScans: { type: Number, default: 0 },
  qrScanConversionRate: { type: Number, default: 0 },
  lastQRScan: { type: Date },
  
  // Location and Movement Analytics
  totalDistanceTraveled: { type: Number, default: 0 }, // lifetime total in km
  averageSpeed: { type: Number, default: 0 }, // km/h
  maxSpeed: { type: Number, default: 0 }, // km/h
  locationHistory: [LocationSchema],
  
  // Daily Sessions
  currentSession: DailySessionSchema,
  dailySessions: [DailySessionSchema],
  
  // Performance Metrics
  uptimePercentage: { type: Number, min: 0, max: 100, default: 0 },
  complianceRate: { type: Number, min: 0, max: 100, default: 0 },
  averageDailyHours: { type: Number, default: 0 },
  
  // Engagement Metrics
  totalInteractions: { type: Number, default: 0 },
  totalScreenTaps: { type: Number, default: 0 },
  totalDebugActivations: { type: Number, default: 0 },
  
  // Error Tracking
  errorLogs: [{
    timestamp: { type: Date, default: Date.now },
    errorType: { type: String },
    errorMessage: { type: String },
    severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
    resolved: { type: Boolean, default: false }
  }],
  
  // System Fields
  isActive: { type: Boolean, default: true },
  lastUpdated: { type: Date, default: Date.now },
  metadata: { type: mongoose.Schema.Types.Mixed }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
AnalyticsSchema.index({ deviceId: 1, lastUpdated: -1 });
AnalyticsSchema.index({ materialId: 1, lastUpdated: -1 });
AnalyticsSchema.index({ driverId: 1, lastUpdated: -1 });
AnalyticsSchema.index({ userId: 1, lastUpdated: -1 });
AnalyticsSchema.index({ adId: 1, lastUpdated: -1 });
AnalyticsSchema.index({ adDeploymentId: 1, lastUpdated: -1 });
AnalyticsSchema.index({ 'currentLocation.coordinates': '2dsphere' });
AnalyticsSchema.index({ 'dailySessions.date': -1 });
AnalyticsSchema.index({ isOnline: 1 });
AnalyticsSchema.index({ 'adPlaybacks.adId': 1 });
AnalyticsSchema.index({ 'qrScans.adId': 1 });

// Virtual for current hours today
AnalyticsSchema.virtual('currentHoursToday').get(function() {
  if (!this.currentSession || !this.currentSession.startTime) return 0;
  
  const now = new Date();
  const startTime = new Date(this.currentSession.startTime);
  const hoursDiff = (now - startTime) / (1000 * 60 * 60);
  
  return Math.round(hoursDiff * 100) / 100;
});

// Virtual for hours remaining to meet target
AnalyticsSchema.virtual('hoursRemaining').get(function() {
  const targetHours = this.currentSession?.targetHours || 8;
  const currentHours = this.currentHoursToday;
  return Math.max(0, targetHours - currentHours);
});

// Virtual for compliance status
AnalyticsSchema.virtual('isCompliantToday').get(function() {
  return this.currentHoursToday >= (this.currentSession?.targetHours || 8);
});

// Virtual for ad performance score
AnalyticsSchema.virtual('adPerformanceScore').get(function() {
  if (this.totalAdImpressions === 0) return 0;
  return Math.round((this.averageAdCompletionRate * this.uptimePercentage) / 100);
});

// Virtual for QR scan performance score
AnalyticsSchema.virtual('qrPerformanceScore').get(function() {
  if (this.totalQRScans === 0) return 0;
  return Math.round((this.qrScanConversionRate * this.uptimePercentage) / 100);
});

// Methods
AnalyticsSchema.methods.addAdPlayback = function(adId, adTitle, adDuration, viewTime = 0) {
  const playback = {
    adId,
    adTitle,
    adDuration,
    startTime: new Date(),
    endTime: new Date(Date.now() + adDuration * 1000),
    viewTime,
    completionRate: adDuration > 0 ? Math.min(100, (viewTime / adDuration) * 100) : 0,
    impressions: 1,
    slotNumber: this.slotNumber
  };
  
  this.adPlaybacks.push(playback);
  this.currentAd = playback;
  this.totalAdImpressions += 1;
  this.totalAdPlayTime += viewTime;
  
  // Update average completion rate
  const totalCompletion = this.adPlaybacks.reduce((sum, ad) => sum + ad.completionRate, 0);
  this.averageAdCompletionRate = this.adPlaybacks.length > 0 ? totalCompletion / this.adPlaybacks.length : 0;
  
  return this.save();
};

AnalyticsSchema.methods.addQRScan = function(qrScanData) {
  this.qrScans.push(qrScanData);
  this.totalQRScans += 1;
  this.lastQRScan = new Date();
  
  // Update conversion rate
  const totalConversions = this.qrScans.filter(scan => scan.converted).length;
  this.qrScanConversionRate = this.totalQRScans > 0 ? (totalConversions / this.totalQRScans) * 100 : 0;
  
  return this.save();
};

AnalyticsSchema.methods.updateLocation = function(lat, lng, speed = 0, heading = 0, accuracy = 0) {
  const location = {
    type: 'Point',
    coordinates: [lng, lat],
    accuracy,
    speed,
    heading,
    timestamp: new Date()
  };
  
  this.currentLocation = location;
  this.locationHistory.push(location);
  
  // Update speed metrics
  if (speed > this.maxSpeed) {
    this.maxSpeed = speed;
  }
  
  // Calculate average speed
  const validSpeeds = this.locationHistory.filter(loc => loc.speed > 0);
  if (validSpeeds.length > 0) {
    this.averageSpeed = validSpeeds.reduce((sum, loc) => sum + loc.speed, 0) / validSpeeds.length;
  }
  
  return this.save();
};

AnalyticsSchema.methods.addError = function(errorType, errorMessage, severity = 'MEDIUM') {
  this.errorLogs.push({
    errorType,
    errorMessage,
    severity,
    timestamp: new Date()
  });
  
  return this.save();
};

AnalyticsSchema.methods.startDailySession = function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  this.currentSession = {
    date: today,
    startTime: new Date(),
    totalHoursOnline: 0,
    totalDistanceTraveled: 0,
    totalAdPlayTime: 0,
    totalQRScans: 0,
    totalAdImpressions: 0,
    isActive: true
  };
  
  return this.save();
};

AnalyticsSchema.methods.endDailySession = function() {
  if (this.currentSession && this.currentSession.isActive) {
    this.currentSession.endTime = new Date();
    this.currentSession.isActive = false;
    
    // Calculate total hours
    const startTime = new Date(this.currentSession.startTime);
    const endTime = new Date(this.currentSession.endTime);
    const hoursDiff = (endTime - startTime) / (1000 * 60 * 60);
    this.currentSession.totalHoursOnline = Math.round(hoursDiff * 100) / 100;
    
    // Add to daily sessions history
    this.dailySessions.push(this.currentSession);
    
    // Update compliance rate
    const compliantDays = this.dailySessions.filter(session => 
      session.totalHoursOnline >= 8
    ).length;
    
    this.complianceRate = this.dailySessions.length > 0 ? 
      Math.round((compliantDays / this.dailySessions.length) * 100) : 0;
  }
  
  return this.save();
};

// Static methods for analytics queries
AnalyticsSchema.statics.getDeviceAnalytics = function(deviceId, startDate, endDate) {
  const query = { deviceId };
  if (startDate && endDate) {
    query.lastUpdated = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  return this.findOne(query);
};

// Get analytics for specific user's ads
AnalyticsSchema.statics.getUserAdAnalytics = function(userId, startDate, endDate) {
  const matchStage = { userId: userId };
  if (startDate && endDate) {
    matchStage.lastUpdated = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  return this.aggregate([
    { $match: matchStage },
    { $unwind: '$adPlaybacks' },
    {
      $group: {
        _id: '$adPlaybacks.adId',
        adTitle: { $first: '$adPlaybacks.adTitle' },
        totalImpressions: { $sum: '$adPlaybacks.impressions' },
        totalViewTime: { $sum: '$adPlaybacks.viewTime' },
        averageCompletionRate: { $avg: '$adPlaybacks.completionRate' },
        totalDevices: { $addToSet: '$deviceId' },
        totalMaterials: { $addToSet: '$materialId' },
        firstPlayed: { $min: '$adPlaybacks.startTime' },
        lastPlayed: { $max: '$adPlaybacks.startTime' }
      }
    },
    {
      $addFields: {
        uniqueDevices: { $size: '$totalDevices' },
        uniqueMaterials: { $size: '$totalMaterials' }
      }
    },
    { $sort: { totalImpressions: -1 } }
  ]);
};

// Get QR scan analytics for user's ads
AnalyticsSchema.statics.getUserQRScanAnalytics = function(userId, startDate, endDate) {
  const matchStage = { userId: userId };
  if (startDate && endDate) {
    matchStage.lastUpdated = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  return this.aggregate([
    { $match: matchStage },
    { $unwind: '$qrScans' },
    {
      $group: {
        _id: '$qrScans.adId',
        adTitle: { $first: '$qrScans.adTitle' },
        totalScans: { $sum: 1 },
        totalConversions: { $sum: { $cond: ['$qrScans.converted', 1, 0] } },
        averageTimeOnPage: { $avg: '$qrScans.timeOnPage' },
        totalDevices: { $addToSet: '$deviceId' },
        totalMaterials: { $addToSet: '$materialId' },
        firstScan: { $min: '$qrScans.scanTimestamp' },
        lastScan: { $max: '$qrScans.scanTimestamp' }
      }
    },
    {
      $addFields: {
        uniqueDevices: { $size: '$totalDevices' },
        uniqueMaterials: { $size: '$totalMaterials' },
        conversionRate: {
          $multiply: [
            { $divide: ['$totalConversions', '$totalScans'] },
            100
          ]
        }
      }
    },
    { $sort: { totalScans: -1 } }
  ]);
};

// Get comprehensive user analytics
AnalyticsSchema.statics.getUserAnalytics = function(userId, startDate, endDate) {
  const matchStage = { userId: userId };
  if (startDate && endDate) {
    matchStage.lastUpdated = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalDevices: { $addToSet: '$deviceId' },
        totalMaterials: { $addToSet: '$materialId' },
        totalAdImpressions: { $sum: '$totalAdImpressions' },
        totalQRScans: { $sum: '$totalQRScans' },
        totalAdPlayTime: { $sum: '$totalAdPlayTime' },
        averageUptime: { $avg: '$uptimePercentage' },
        averageCompliance: { $avg: '$complianceRate' },
        totalDistanceTraveled: { $sum: '$totalDistanceTraveled' }
      }
    },
    {
      $addFields: {
        uniqueDevices: { $size: '$totalDevices' },
        uniqueMaterials: { $size: '$totalMaterials' }
      }
    }
  ]);
};

AnalyticsSchema.statics.getMaterialAnalytics = function(materialId, startDate, endDate) {
  const query = { materialId };
  if (startDate && endDate) {
    query.lastUpdated = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  return this.find(query);
};

AnalyticsSchema.statics.getDriverAnalytics = function(driverId, startDate, endDate) {
  const query = { driverId };
  if (startDate && endDate) {
    query.lastUpdated = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  return this.find(query);
};

AnalyticsSchema.statics.getTopPerformingAds = function(limit = 10, startDate, endDate) {
  const matchStage = {};
  if (startDate && endDate) {
    matchStage.lastUpdated = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  return this.aggregate([
    { $match: matchStage },
    { $unwind: '$adPlaybacks' },
    {
      $group: {
        _id: '$adPlaybacks.adId',
        adTitle: { $first: '$adPlaybacks.adTitle' },
        totalImpressions: { $sum: '$adPlaybacks.impressions' },
        totalViewTime: { $sum: '$adPlaybacks.viewTime' },
        averageCompletionRate: { $avg: '$adPlaybacks.completionRate' },
        totalDevices: { $addToSet: '$deviceId' }
      }
    },
    {
      $addFields: {
        uniqueDevices: { $size: '$totalDevices' }
      }
    },
    { $sort: { totalImpressions: -1 } },
    { $limit: limit }
  ]);
};

AnalyticsSchema.statics.getLocationAnalytics = function(startDate, endDate) {
  const matchStage = {
    'currentLocation.coordinates': { $exists: true }
  };
  
  if (startDate && endDate) {
    matchStage.lastUpdated = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          lat: { $arrayElemAt: ['$currentLocation.coordinates', 1] },
          lng: { $arrayElemAt: ['$currentLocation.coordinates', 0] }
        },
        totalDevices: { $addToSet: '$deviceId' },
        totalQRScans: { $sum: '$totalQRScans' },
        totalAdImpressions: { $sum: '$totalAdImpressions' },
        averageUptime: { $avg: '$uptimePercentage' }
      }
    },
    {
      $addFields: {
        uniqueDevices: { $size: '$totalDevices' }
      }
    },
    { $sort: { totalQRScans: -1 } }
  ]);
};

module.exports = mongoose.models.Analytics || mongoose.model('Analytics', AnalyticsSchema);
