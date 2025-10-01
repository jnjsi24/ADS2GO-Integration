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
  
  // Screen tracking fields (consolidated from ScreenTracking)
  materialId: { 
    type: String, 
    required: false,
    index: true
  },
  screenType: { 
    type: String, 
    required: false,
    enum: ['HEADDRESS', 'LCD', 'BILLBOARD', 'DIGITAL_DISPLAY'],
    default: 'HEADDRESS'
  },
  carGroupId: { 
    type: String, 
    required: false
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
  
  // Screen-specific tracking (from ScreenTracking)
  screenMetrics: {
    displayHours: { type: Number, default: 0 }, // Hours displaying ads
    adPlayCount: { type: Number, default: 0 }, // Total number of ads played
    lastAdPlayed: { type: Date },
    brightness: { type: Number, min: 0, max: 100, default: 100 }, // Screen brightness
    volume: { type: Number, min: 0, max: 100, default: 50 }, // Audio volume
    isDisplaying: { type: Boolean, default: true }, // Currently showing ads
    maintenanceMode: { type: Boolean, default: false }, // Under maintenance
    
    // Enhanced ad tracking
    currentAd: {
      adId: { type: String },
      adTitle: { type: String },
      adDuration: { type: Number }, // in seconds
      startTime: { type: Date },
      endTime: { type: Date },
      impressions: { type: Number, default: 0 }, // How many times this ad was shown
      totalViewTime: { type: Number, default: 0 }, // Total time viewed in seconds
      completionRate: { type: Number, default: 0 }, // Percentage of ad completed
      // Real-time playback fields
      currentTime: { type: Number, default: 0 }, // Current playback time in seconds
      state: { type: String, enum: ['playing', 'paused', 'buffering', 'loading', 'ended'], default: 'loading' },
      progress: { type: Number, default: 0, min: 0, max: 100 } // Progress percentage
    },
    
    // Daily ad statistics
    dailyAdStats: {
      date: { type: Date },
      totalAdsPlayed: { type: Number, default: 0 },
      totalDisplayTime: { type: Number, default: 0 }, // in seconds
      uniqueAdsPlayed: { type: Number, default: 0 },
      averageAdDuration: { type: Number, default: 0 },
      adCompletionRate: { type: Number, default: 0 },
    }
  },
  
  // Daily session tracking (from ScreenTracking)
  currentSession: {
    date: { type: Date, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    totalHoursOnline: { type: Number, default: 0 }, // in hours
    totalDistanceTraveled: { type: Number, default: 0 }, // in km
    locationHistory: [LocationPointSchema],
    isActive: { type: Boolean, default: true },
    targetHours: { type: Number, default: 8 }, // 8 hours target
    complianceStatus: { 
      type: String, 
      enum: ['COMPLIANT', 'NON_COMPLIANT', 'PENDING'],
      default: 'PENDING'
    }
  },
  
  // Lifetime totals (from ScreenTracking)
  totalHoursOnline: { type: Number, default: 0 }, // lifetime total
  totalDistanceTraveled: { type: Number, default: 0 }, // lifetime total
  averageDailyHours: { type: Number, default: 0 },
  complianceRate: { type: Number, default: 0 }, // percentage of days meeting 8-hour target
  
  // Alerts and notifications (from ScreenTracking)
  alerts: [{
    type: { 
      type: String, 
      enum: ['LOW_HOURS', 'OFFLINE_TOO_LONG', 'OUT_OF_ROUTE', 'SPEED_VIOLATION', 'DISPLAY_OFFLINE', 'LOW_BRIGHTNESS', 'MAINTENANCE_NEEDED', 'AD_PLAYBACK_ERROR'],
      required: true 
    },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    isResolved: { type: Boolean, default: false },
    severity: { 
      type: String, 
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM'
    }
  }],
  
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
DeviceTrackingSchema.index({ materialId: 1, date: -1 });
DeviceTrackingSchema.index({ screenType: 1 });
DeviceTrackingSchema.index({ carGroupId: 1 });
DeviceTrackingSchema.index({ 'currentSession.date': 1 });
DeviceTrackingSchema.index({ 'currentSession.complianceStatus': 1 });

// Virtual for formatted date
DeviceTrackingSchema.virtual('dateString').get(function() {
  return this.date.toISOString().split('T')[0];
});

// Virtual for current hour
DeviceTrackingSchema.virtual('currentHour').get(function() {
  return new Date().getHours();
});

// Virtual for current hours today (from ScreenTracking)
DeviceTrackingSchema.virtual('currentHoursToday').get(function() {
  if (!this.currentSession || !this.currentSession.startTime) return 0;
  
  const now = new Date();
  const startTime = new Date(this.currentSession.startTime);
  
  // Check if this is a new day - if so, reset to 8 hours
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sessionDate = new Date(this.currentSession.date);
  sessionDate.setHours(0, 0, 0, 0);
  
  // If it's a new day, return 8 hours (fresh start)
  if (sessionDate.getTime() !== today.getTime()) {
    return 8;
  }
  
  // Count hours if device is online (either WebSocket connected or database shows online)
  // If not online, return the last recorded hours
  if (!this.isOnline) {
    return this.currentSession.totalHoursOnline || 0;
  }
  
  // Calculate hours since session start, but only if online
  const hoursDiff = (now - startTime) / (1000 * 60 * 60);
  const totalHours = Math.min(8, Math.max(0, hoursDiff)); // Cap at 8 hours max
  
  return Math.round(totalHours * 100) / 100; // Round to 2 decimal places
});

// Virtual for hours remaining to meet target (from ScreenTracking)
DeviceTrackingSchema.virtual('hoursRemaining').get(function() {
  const targetHours = this.currentSession?.targetHours || 8;
  const currentHours = this.currentHoursToday;
  
  // If it's a new day, show 8 hours remaining
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sessionDate = new Date(this.currentSession?.date);
  if (sessionDate) {
    sessionDate.setHours(0, 0, 0, 0);
    if (sessionDate.getTime() !== today.getTime()) {
      return 8;
    }
  }
  
  return Math.max(0, targetHours - currentHours);
});

// Virtual for compliance status (from ScreenTracking)
DeviceTrackingSchema.virtual('isCompliantToday').get(function() {
  return this.currentHoursToday >= (this.currentSession?.targetHours || 8);
});

// Virtual for display status (from ScreenTracking)
DeviceTrackingSchema.virtual('displayStatus').get(function() {
  if (!this.isOnline) return 'OFFLINE';
  if (this.screenMetrics?.maintenanceMode) return 'MAINTENANCE';
  if (!this.screenMetrics?.isDisplaying) return 'DISPLAY_OFF';
  return 'ACTIVE';
});

// Compound unique index for deviceId + date (one record per device per day)
DeviceTrackingSchema.index({ deviceId: 1, date: 1 }, { unique: true });

// Static methods
DeviceTrackingSchema.statics.findByDeviceId = function(deviceId) {
  const today = new Date().toISOString().split('T')[0];
  
  // First try to find today's record
  return this.findOne({ deviceId, date: today }).then(device => {
    if (device) {
      return device;
    }
    
    // If no record for today, find the most recent record for this device
    return this.findOne({ deviceId }).sort({ date: -1 });
  });
};

DeviceTrackingSchema.statics.findByDeviceSlot = function(deviceSlot) {
  const today = new Date().toISOString().split('T')[0];
  return this.find({ deviceSlot, date: today });
};

DeviceTrackingSchema.statics.getCurrentDayData = function() {
  const today = new Date().toISOString().split('T')[0];
  return this.find({ date: today });
};

// Static methods from ScreenTracking
DeviceTrackingSchema.statics.findByMaterial = function(materialId) {
  return this.findOne({ materialId });
};

DeviceTrackingSchema.statics.findByMaterialAndSlot = function(materialId, slotNumber) {
  return this.findOne({ materialId, deviceSlot: slotNumber });
};

DeviceTrackingSchema.statics.findOnlineScreens = function() {
  return this.find({ isOnline: true });
};

DeviceTrackingSchema.statics.findByScreenType = function(screenType) {
  return this.find({ screenType });
};

DeviceTrackingSchema.statics.findNonCompliantDrivers = function(date = new Date()) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  return this.find({
    screenType: 'HEADDRESS',
    'currentSession.date': startOfDay,
    'currentSession.complianceStatus': 'NON_COMPLIANT'
  });
};

DeviceTrackingSchema.statics.findDisplayIssues = function() {
  return this.find({
    $or: [
      { 'screenMetrics.isDisplaying': false },
      { 'screenMetrics.maintenanceMode': true },
      { 'screenMetrics.brightness': { $lt: 50 } }
    ]
  });
};

// Helper method to handle version conflicts
DeviceTrackingSchema.methods.saveWithRetry = function(maxRetries = 3) {
  return new Promise((resolve, reject) => {
    let retries = 0;
    
    const attemptSave = () => {
      this.save()
        .then(resolve)
        .catch(error => {
          if (error.name === 'VersionError' && retries < maxRetries) {
            retries++;
            console.log(`Version conflict detected, retrying save (attempt ${retries}/${maxRetries})`);
            // Reload the document to get the latest version
            this.constructor.findById(this._id)
              .then(doc => {
                if (doc) {
                  // Merge the changes
                  Object.assign(this, doc.toObject());
                  attemptSave();
                } else {
                  reject(new Error('Document not found during retry'));
                }
              })
              .catch(reject);
          } else {
            reject(error);
          }
        });
    };
    
    attemptSave();
  });
};

// Instance methods
DeviceTrackingSchema.methods.updateLocation = function(lat, lng, speed = 0, heading = 0, accuracy = 0, address = '') {
  const newLocation = {
    type: 'Point',
    coordinates: [lng, lat],
    timestamp: new Date(),
    speed,
    heading,
    accuracy,
    address
  };
  
  // Use findByIdAndUpdate to avoid version conflicts
  return this.constructor.findByIdAndUpdate(
    this._id,
    {
      $set: {
        currentLocation: newLocation,
        lastSeen: new Date()
      },
      $push: {
        locationHistory: {
          $each: [newLocation],
          $slice: -100 // Keep only last 100 entries
        }
      }
    },
    { 
      new: true,
      runValidators: true
    }
  );
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
  return this.saveWithRetry();
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
  return this.saveWithRetry();
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

// Method to reset daily session (from ScreenTracking)
DeviceTrackingSchema.methods.resetDailySession = function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Check if we need to reset (new day)
  const sessionDate = new Date(this.currentSession?.date);
  if (sessionDate) {
    sessionDate.setHours(0, 0, 0, 0);
    if (sessionDate.getTime() !== today.getTime()) {
      // Reset for new day
      this.currentSession = {
        date: today,
        startTime: new Date(),
        endTime: null,
        totalHoursOnline: 0,
        totalDistanceTraveled: 0,
        isActive: true,
        targetHours: 8,
        complianceStatus: 'PENDING',
        locationHistory: []
      };
      
      // Also reset the current location to prevent invalid distance calculations
      this.currentLocation = null;
      
      // Reset total distance as well
      this.totalDistanceTraveled = 0;
      
      return true; // Session was reset
    }
  }
  
  return false; // No reset needed
};

// Method to start daily session (from ScreenTracking)
DeviceTrackingSchema.methods.startDailySession = function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  this.currentSession = {
    date: today,
    startTime: new Date(),
    totalHoursOnline: 0,
    totalDistanceTraveled: 0,
    locationHistory: [],
    isActive: true,
    targetHours: 8,
    complianceStatus: 'PENDING'
  };
  
  return this.save();
};

// Method to end daily session (from ScreenTracking)
DeviceTrackingSchema.methods.endDailySession = function() {
  if (this.currentSession && this.currentSession.isActive) {
    this.currentSession.endTime = new Date();
    this.currentSession.isActive = false;
    
    // Calculate total hours
    const startTime = new Date(this.currentSession.startTime);
    const endTime = new Date(this.currentSession.endTime);
    const hoursDiff = (endTime - startTime) / (1000 * 60 * 60);
    this.currentSession.totalHoursOnline = Math.round(hoursDiff * 100) / 100;
    
    // Update compliance status
    this.currentSession.complianceStatus = 
      this.currentSession.totalHoursOnline >= this.currentSession.targetHours ? 'COMPLIANT' : 'NON_COMPLIANT';
    
    // Update lifetime totals
    this.totalHoursOnline += this.currentSession.totalHoursOnline;
    
    // Calculate average daily hours (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Calculate compliance rate
    this.complianceRate = this.currentSession.complianceStatus === 'COMPLIANT' ? 100 : 0;
  }
  
  return this.save();
};

// Method to add alert (from ScreenTracking)
DeviceTrackingSchema.methods.addAlert = function(type, message, severity = 'MEDIUM') {
  // Clean up old alerts (older than 7 days) before adding new ones
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  this.alerts = this.alerts.filter(alert => alert.timestamp > sevenDaysAgo);
  
  this.alerts.push({
    type,
    message,
    timestamp: new Date(),
    isResolved: false,
    severity
  });
  
  return this.save();
};

// Method to track ad playback (from ScreenTracking)
DeviceTrackingSchema.methods.trackAdPlayback = function(adId, adTitle, adDuration, viewTime = 0) {
  const now = new Date();
  
  // Update current ad
  this.screenMetrics.currentAd = {
    adId,
    adTitle,
    adDuration,
    startTime: now,
    endTime: null,
    impressions: (this.screenMetrics.currentAd?.impressions || 0) + 1,
    totalViewTime: (this.screenMetrics.currentAd?.totalViewTime || 0) + viewTime,
    completionRate: adDuration > 0 ? Math.min(100, ((this.screenMetrics.currentAd?.totalViewTime || 0) + viewTime) / adDuration * 100) : 0,
    // Real-time playback fields
    currentTime: 0,
    state: 'playing',
    progress: 0
  };
  
  // Update total ad play count
  this.screenMetrics.adPlayCount += 1;
  this.screenMetrics.lastAdPlayed = now;
  
  // Update daily ad stats
  if (!this.screenMetrics.dailyAdStats || 
      !this.screenMetrics.dailyAdStats.date || 
      this.screenMetrics.dailyAdStats.date.toDateString() !== now.toDateString()) {
    this.screenMetrics.dailyAdStats = {
      date: now,
      totalAdsPlayed: 0,
      totalDisplayTime: 0,
      uniqueAdsPlayed: 0,
      averageAdDuration: 0,
      adCompletionRate: 0
    };
  }
  
  this.screenMetrics.dailyAdStats.totalAdsPlayed += 1;
  this.screenMetrics.dailyAdStats.totalDisplayTime += viewTime;
  
  // Update ad performance tracking
  let adPerformance = this.adPerformance.find(ad => ad.adId === adId);
  if (!adPerformance) {
    adPerformance = {
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
    this.adPerformance.push(adPerformance);
    this.screenMetrics.dailyAdStats.uniqueAdsPlayed += 1;
  }
  
  adPerformance.playCount += 1;
  adPerformance.totalViewTime += viewTime;
  adPerformance.averageViewTime = adPerformance.totalViewTime / adPerformance.playCount;
  adPerformance.completionRate = adDuration > 0 ? Math.min(100, adPerformance.totalViewTime / adDuration * 100) : 0;
  adPerformance.lastPlayed = now;
  adPerformance.impressions += 1;
  
  // Update daily stats
  this.screenMetrics.dailyAdStats.averageAdDuration = 
    this.screenMetrics.dailyAdStats.totalDisplayTime / this.screenMetrics.dailyAdStats.totalAdsPlayed;
  this.screenMetrics.dailyAdStats.adCompletionRate = 
    this.adPerformance.reduce((sum, ad) => sum + ad.completionRate, 0) / this.adPerformance.length;
  
  return this.save();
};

// Method to end ad playback (from ScreenTracking)
DeviceTrackingSchema.methods.endAdPlayback = function() {
  if (this.screenMetrics.currentAd && this.screenMetrics.currentAd.startTime) {
    const now = new Date();
    const totalViewTime = (now - this.screenMetrics.currentAd.startTime) / 1000; // in seconds
    
    this.screenMetrics.currentAd.endTime = now;
    this.screenMetrics.currentAd.totalViewTime = totalViewTime;
    
    if (this.screenMetrics.currentAd.adDuration > 0) {
      this.screenMetrics.currentAd.completionRate = Math.min(100, totalViewTime / this.screenMetrics.currentAd.adDuration * 100);
    }
  }
  
  return this.save();
};

// Method to update driver activity hours (from ScreenTracking)
DeviceTrackingSchema.methods.updateDriverActivity = function(isActive = true) {
  const now = new Date();
  
  if (!this.screenMetrics.dailyAdStats || 
      !this.screenMetrics.dailyAdStats.date || 
      this.screenMetrics.dailyAdStats.date.toDateString() !== now.toDateString()) {
    this.screenMetrics.dailyAdStats = {
      date: now,
      totalAdsPlayed: 0,
      totalDisplayTime: 0,
      uniqueAdsPlayed: 0,
      averageAdDuration: 0,
      adCompletionRate: 0
    };
  }
  
  // Update display hours based on activity
  if (isActive) {
    this.screenMetrics.displayHours += 0.5 / 3600; // Add 30 seconds in hours
  }
  
  // Update current session hours
  if (this.currentSession && this.currentSession.isActive) {
    this.currentSession.totalHoursOnline += 0.5 / 3600; // Add 30 seconds in hours
  }
  
  // Update total lifetime hours
  this.totalHoursOnline += 0.5 / 3600;
  
  return this.save();
};

// Method to calculate and update online hours based on session time
DeviceTrackingSchema.methods.calculateAndUpdateOnlineHours = function() {
  const now = new Date();
  
  // Only calculate if device is online and has a current session
  if (!this.isOnline || !this.currentSession || !this.currentSession.isActive) {
    return this;
  }
  
  // Check if this is a new day - if so, reset session
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sessionDate = new Date(this.currentSession.date);
  sessionDate.setHours(0, 0, 0, 0);
  
  if (sessionDate.getTime() !== today.getTime()) {
    // New day - reset session
    this.resetDailySession();
    return this;
  }
  
  // Calculate hours since session start
  const startTime = new Date(this.currentSession.startTime);
  const hoursDiff = (now - startTime) / (1000 * 60 * 60); // Convert to hours
  const totalHours = Math.min(8, Math.max(0, hoursDiff)); // Cap at 8 hours max
  
  // Update current session hours
  this.currentSession.totalHoursOnline = Math.round(totalHours * 100) / 100;
  
  // Update compliance status
  this.currentSession.complianceStatus = 
    this.currentSession.totalHoursOnline >= this.currentSession.targetHours ? 'COMPLIANT' : 'NON_COMPLIANT';
  
  // Update total lifetime hours (only if this is more than what we had before)
  if (totalHours > this.totalHoursOnline) {
    this.totalHoursOnline = Math.round(totalHours * 100) / 100;
  }
  
  // Update average daily hours
  this.averageDailyHours = this.totalHoursOnline;
  
  // Update compliance rate
  this.complianceRate = this.currentSession.complianceStatus === 'COMPLIANT' ? 100 : 0;
  
  return this;
};

module.exports = mongoose.models.DeviceTracking || mongoose.model('DeviceTracking', DeviceTrackingSchema);
