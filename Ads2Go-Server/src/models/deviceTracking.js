const mongoose = require('mongoose');
//for data history
// Location Point Schema for real-time data
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

// Hourly Stats Schema for current day
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

// Ad Playback Schema for real-time tracking
const AdPlaybackSchema = new mongoose.Schema({
  adId: { type: String, required: true },
  adTitle: { type: String, required: true },
  adDuration: { type: Number, required: true }, // in seconds
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  viewTime: { type: Number, default: 0 }, // actual time viewed in seconds
  completionRate: { type: Number, default: 0 }, // percentage
  impressions: { type: Number, default: 1 },
  slotNumber: { type: Number, required: true, min: 1, max: 5 }
}, { _id: false });

// QR Scan Schema for real-time tracking
const QRScanSchema = new mongoose.Schema({
  adId: { type: String, required: true },
  adTitle: { type: String, required: true },
  scanTimestamp: { type: Date, default: Date.now },
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
}, { _id: false });

// Device Info Schema
const DeviceInfoSchema = new mongoose.Schema({
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
}, { _id: false });

// Network Status Schema
const NetworkStatusSchema = new mongoose.Schema({
  isOnline: { type: Boolean, default: true },
  connectionType: { type: String },
  signalStrength: { type: Number, min: 0, max: 5 },
  lastSeen: { type: Date, default: Date.now }
}, { _id: false });

// Main DeviceTracking Schema (Current Day Only)
const DeviceTrackingSchema = new mongoose.Schema({
  // Device identification
  deviceId: { 
    type: String, 
    required: true,
    unique: true,
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
    default: () => new Date().toISOString().split('T')[0],
    index: true
  },
  
  // Device info
  deviceInfo: DeviceInfoSchema,
  
  // Current status
  isOnline: { type: Boolean, default: false },
  currentLocation: LocationPointSchema,
  lastSeen: { type: Date, default: Date.now },
  
  // Network status
  networkStatus: NetworkStatusSchema,
  
  // Daily totals (real-time counters)
  totalAdPlays: { type: Number, default: 0 },
  totalQRScans: { type: Number, default: 0 },
  totalDistanceTraveled: { type: Number, default: 0 }, // in km
  totalHoursOnline: { type: Number, default: 0 }, // in hours
  totalAdImpressions: { type: Number, default: 0 },
  totalAdPlayTime: { type: Number, default: 0 }, // in seconds
  
  // Current ad being played
  currentAd: AdPlaybackSchema,
  
  // Real-time data arrays (for current day)
  adPlaybacks: [AdPlaybackSchema],
  qrScans: [QRScanSchema],
  locationHistory: [LocationPointSchema],
  
  // Hourly breakdown (for current day)
  hourlyStats: [HourlyStatsSchema],
  
  // Ad performance tracking
  adPerformance: [{
    adId: { type: String, required: true },
    adTitle: { type: String, required: true },
    playCount: { type: Number, default: 0 },
    totalViewTime: { type: Number, default: 0 },
    averageViewTime: { type: Number, default: 0 },
    completionRate: { type: Number, default: 0 },
    firstPlayed: { type: Date },
    lastPlayed: { type: Date },
    impressions: { type: Number, default: 0 }
  }],
  
  // QR scans per ad
  qrScansByAd: [{
    adId: { type: String, required: true },
    adTitle: { type: String, required: true },
    scanCount: { type: Number, default: 0 },
    lastScanned: { type: Date },
    firstScanned: { type: Date }
  }],
  
  // Compliance and alerts
  complianceData: {
    speedViolations: { type: Number, default: 0 },
    routeDeviations: { type: Number, default: 0 },
    offlineIncidents: { type: Number, default: 0 },
    displayIssues: { type: Number, default: 0 }
  },
  
  // System fields
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
DeviceTrackingSchema.index({ deviceId: 1, date: -1 });
DeviceTrackingSchema.index({ deviceSlot: 1, date: -1 });
DeviceTrackingSchema.index({ date: -1 });
DeviceTrackingSchema.index({ isOnline: 1 });
DeviceTrackingSchema.index({ 'currentLocation.coordinates': '2dsphere' });

// Virtual for formatted date
DeviceTrackingSchema.virtual('dateString').get(function() {
  return this.date.toISOString().split('T')[0];
});

// Virtual for current hour
DeviceTrackingSchema.virtual('currentHour').get(function() {
  return new Date().getHours();
});

// Static methods
DeviceTrackingSchema.statics.findByDeviceId = function(deviceId) {
  const today = new Date().toISOString().split('T')[0];
  return this.findOne({ deviceId, date: today });
};

DeviceTrackingSchema.statics.findByDeviceSlot = function(deviceSlot) {
  const today = new Date().toISOString().split('T')[0];
  return this.find({ deviceSlot, date: today });
};

DeviceTrackingSchema.statics.getCurrentDayData = function() {
  const today = new Date().toISOString().split('T')[0];
  return this.find({ date: today });
};

// Instance methods
DeviceTrackingSchema.methods.updateLocation = function(lat, lng, speed = 0, heading = 0, accuracy = 0) {
  this.currentLocation = {
    type: 'Point',
    coordinates: [lng, lat],
    timestamp: new Date(),
    speed,
    heading,
    accuracy
  };
  
  // Add to location history (keep last 100 entries)
  this.locationHistory.push(this.currentLocation);
  if (this.locationHistory.length > 100) {
    this.locationHistory = this.locationHistory.slice(-100);
  }
  
  this.lastSeen = new Date();
  return this.save();
};

DeviceTrackingSchema.methods.trackAdPlayback = function(adId, adTitle, adDuration, viewTime = 0) {
  const now = new Date();
  
  // Update current ad
  this.currentAd = {
    adId,
    adTitle,
    adDuration,
    startTime: now,
    endTime: null,
    viewTime,
    completionRate: adDuration > 0 ? Math.min(100, (viewTime / adDuration) * 100) : 0,
    impressions: 1,
    slotNumber: this.deviceSlot
  };
  
  // Add to ad playbacks
  this.adPlaybacks.push(this.currentAd);
  
  // Update totals
  this.totalAdPlays += 1;
  this.totalAdImpressions += 1;
  this.totalAdPlayTime += viewTime;
  
  // Update ad performance
  let adPerf = this.adPerformance.find(ad => ad.adId === adId);
  if (!adPerf) {
    adPerf = {
      adId,
      adTitle,
      playCount: 0,
      totalViewTime: 0,
      averageViewTime: 0,
      completionRate: 0,
      firstPlayed: now,
      lastPlayed: now,
      impressions: 0
    };
    this.adPerformance.push(adPerf);
  }
  
  adPerf.playCount += 1;
  adPerf.totalViewTime += viewTime;
  adPerf.averageViewTime = adPerf.totalViewTime / adPerf.playCount;
  adPerf.completionRate = adDuration > 0 ? Math.min(100, (adPerf.totalViewTime / (adDuration * adPerf.playCount)) * 100) : 0;
  adPerf.lastPlayed = now;
  adPerf.impressions += 1;
  
  // Update hourly stats
  this.updateHourlyStats('adPlays', 1);
  this.updateHourlyStats('adPlayTime', viewTime);
  
  this.lastSeen = now;
  return this.save();
};

DeviceTrackingSchema.methods.trackQRScan = function(qrScanData) {
  // Add QR scan
  this.qrScans.push(qrScanData);
  this.totalQRScans += 1;
  
  // Update QR scans per ad
  const existingAdScan = this.qrScansByAd.find(scan => scan.adId === qrScanData.adId);
  if (existingAdScan) {
    existingAdScan.scanCount += 1;
    existingAdScan.lastScanned = new Date();
  } else {
    this.qrScansByAd.push({
      adId: qrScanData.adId,
      adTitle: qrScanData.adTitle,
      scanCount: 1,
      lastScanned: new Date(),
      firstScanned: new Date()
    });
  }
  
  // Update hourly stats
  this.updateHourlyStats('qrScans', 1);
  
  this.lastSeen = new Date();
  return this.save();
};

DeviceTrackingSchema.methods.updateHourlyStats = function(metric, value) {
  const currentHour = new Date().getHours();
  let hourlyStat = this.hourlyStats.find(stat => stat.hour === currentHour);
  
  if (!hourlyStat) {
    hourlyStat = {
      hour: currentHour,
      adPlays: 0,
      qrScans: 0,
      distance: 0,
      onlineMinutes: 0,
      averageSpeed: 0,
      adImpressions: 0,
      adPlayTime: 0
    };
    this.hourlyStats.push(hourlyStat);
  }
  
  if (hourlyStat[metric] !== undefined) {
    hourlyStat[metric] += value;
  }
  
  // Don't save here - let the calling method handle saving
  return this;
};

DeviceTrackingSchema.methods.setOnlineStatus = function(isOnline) {
  this.isOnline = isOnline;
  this.lastSeen = new Date();
  
  if (isOnline) {
    this.networkStatus.isOnline = true;
    this.networkStatus.lastSeen = new Date();
  }
  
  return this.save();
};

module.exports = mongoose.models.DeviceTracking || mongoose.model('DeviceTracking', DeviceTrackingSchema);
