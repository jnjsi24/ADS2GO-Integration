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
  materialId: { type: String, required: true },
  slotNumber: { type: Number, required: true, min: 1, max: 5 },
  adDuration: { type: Number, required: true }, // in seconds
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  viewTime: { type: Number, default: 0 }, // actual time viewed in seconds
  completionRate: { type: Number, default: 0 }, // percentage
  impressions: { type: Number, default: 1 }
}, { _id: false });

// QR Scan Schema for real-time tracking
const QRScanSchema = new mongoose.Schema({
  adId: { type: String, required: true },
  adTitle: { type: String, required: true },
  materialId: { type: String, required: true },
  slotNumber: { type: Number, required: true, min: 1, max: 5 },
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

// Slot Schema for individual devices within a car
const SlotSchema = new mongoose.Schema({
  slotNumber: { 
    type: Number, 
    required: true,
    min: 1,
    max: 5
  },
  deviceId: { 
    type: String, 
    required: true,
    index: true
  },
  isOnline: { 
    type: Boolean, 
    default: false 
  },
  lastSeen: { 
    type: Date, 
    default: Date.now 
  },
  deviceInfo: DeviceInfoSchema,
  // Basic slot status
  isDisplaying: { type: Boolean, default: false },
  brightness: { type: Number, default: 100 },
  volume: { type: Number, default: 50 },
  maintenanceMode: { type: Boolean, default: false }
}, { _id: false });

// Main DeviceTracking Schema (One document per car per day)
const DeviceTrackingSchema = new mongoose.Schema({
  // Material identification (car/vehicle)
  materialId: { 
    type: String, 
    required: true,
    index: true
  },
  carGroupId: { 
    type: String, 
    required: true
  },
  screenType: { 
    type: String, 
    required: true,
    enum: ['HEADDRESS', 'LCD', 'BILLBOARD', 'DIGITAL_DISPLAY'],
    default: 'HEADDRESS'
  },
  date: { 
    type: Date, 
    required: true,
    default: () => new Date().toISOString().split('T')[0],
    index: true
  },
  
  // Slots array - one entry per physical device in the car
  slots: [SlotSchema],
  
  // Car-level status (online if ANY slot is online)
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
  
  // Current ad being played (simplified schema for real-time updates)
  currentAd: {
    adId: { type: String },
    adTitle: { type: String },
    materialId: { type: String },
    slotNumber: { type: Number },
    adDuration: { type: Number },
    startTime: { type: Date },
    endTime: { type: Date },
    currentTime: { type: Number, default: 0 },
    state: { type: String, enum: ['loading', 'buffering', 'playing', 'paused', 'ended'], default: 'loading' },
    progress: { type: Number, default: 0 },
    viewTime: { type: Number, default: 0 },
    completionRate: { type: Number, default: 0 },
    impressions: { type: Number, default: 1 }
  },
  
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
    offlineIncidents: { type: Number, default: 0 },
    displayIssues: { type: Number, default: 0 }
  },
  
  // Basic vehicle display status
  isDisplaying: { type: Boolean, default: true },
  maintenanceMode: { type: Boolean, default: false },
  
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
    lastOnlineUpdate: { type: Date }, // Last time hours were updated while online
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
      enum: ['LOW_HOURS', 'OFFLINE_TOO_LONG', 'DISPLAY_OFFLINE', 'LOW_BRIGHTNESS', 'MAINTENANCE_NEEDED', 'AD_PLAYBACK_ERROR'],
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
// Removed old deviceId and deviceSlot indexes - now using slots array
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
  
  const TimezoneUtils = require('../utils/timezoneUtils');
  const now = new Date();
  const startTime = new Date(this.currentSession.startTime);
  
  // Get device timezone from current location
  const deviceTimezone = TimezoneUtils.getDeviceTimezone(this.currentLocation);
  
  // Check if this is a new day in device timezone - if so, return 0 hours (fresh start)
  const todayInDeviceTz = TimezoneUtils.getStartOfDayInTimezone(now, deviceTimezone);
  const sessionDateInDeviceTz = TimezoneUtils.getStartOfDayInTimezone(this.currentSession.date, deviceTimezone);
  
  // If it's a new day in device timezone, return 0 hours (fresh start)
  if (sessionDateInDeviceTz.getTime() !== todayInDeviceTz.getTime()) {
    return 0;
  }
  
  // Enhanced session management for offline/online transitions
  let totalHours = this.currentSession.totalHoursOnline || 0;
  
  if (this.isOnline) {
    // Device is online - calculate hours since last update
    const lastUpdate = this.currentSession.lastOnlineUpdate || startTime;
    const hoursSinceLastUpdate = TimezoneUtils.calculateHoursInTimezone(lastUpdate, now, deviceTimezone);
    totalHours += hoursSinceLastUpdate;
    
    // Update the last online update time
    this.currentSession.lastOnlineUpdate = now;
  }
  // If offline, return the last recorded hours (don't reset)
  
  // Cap at 8 hours max per day
  totalHours = Math.min(8, Math.max(0, totalHours));
  
  // Update the session with current total
  this.currentSession.totalHoursOnline = totalHours;
  
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

// Virtual for display status
DeviceTrackingSchema.virtual('displayStatus').get(function() {
  if (!this.isOnline) return 'OFFLINE';
  if (this.maintenanceMode) return 'MAINTENANCE';
  if (!this.isDisplaying) return 'DISPLAY_OFF';
  return 'ACTIVE';
});

// Compound unique index for materialId + date (one record per car per day)
DeviceTrackingSchema.index({ materialId: 1, date: 1 }, { unique: true });

// Index for deviceId lookups within slots
DeviceTrackingSchema.index({ 'slots.deviceId': 1 });

// Static methods
DeviceTrackingSchema.statics.findByDeviceId = async function(deviceId) {
  // Get today's date in local timezone (Philippines GMT+8)
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;
  
  // Find car record that contains this device in slots for today
  let car = await this.findOne({ 
    'slots.deviceId': deviceId, 
    date: todayStr 
  });
  
  if (car) {
    return car;
  }
  
  // If no record for today, find the most recent record for this device
  car = await this.findOne({ 'slots.deviceId': deviceId }).sort({ date: -1 });
  
  if (car) {
    // Update the existing record to today's date and reset session
    console.log(`🔄 Updating existing DeviceTracking record for device ${deviceId} to today's date: ${todayStr}`);
    
    // Update the date to today
    car.date = todayStr;
    
    // Reset the daily session for the new day
    car.currentSession = {
      date: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      startTime: new Date(),
      endTime: null,
      totalHoursOnline: 0,
      totalDistanceTraveled: 0,
      isActive: true,
      targetHours: 8,
      complianceStatus: 'PENDING',
      locationHistory: []
    };
    
    // Reset daily counters
    car.totalAdPlays = 0;
    car.totalQRScans = 0;
    car.totalDistanceTraveled = 0;
    car.totalHoursOnline = 0;
    car.totalAdImpressions = 0;
    car.totalAdPlayTime = 0;
    
    // Clear daily data arrays
    car.adPlaybacks = [];
    car.qrScans = [];
    car.locationHistory = [];
    car.hourlyStats = [];
    car.adPerformance = [];
    car.qrScansByAd = [];
    
    // Reset current ad
    car.currentAd = null;
    
    // Reset compliance data
    car.complianceData = {
      offlineIncidents: 0,
      displayIssues: 0
    };
    
    // Update lastSeen to now
    car.lastSeen = new Date();
    
    // Save the updated record
    await car.save();
    console.log(`✅ Successfully updated DeviceTracking record for device ${deviceId} to today's date`);
    
    return car;
  }
  
  return null; // No existing record found
};

DeviceTrackingSchema.statics.findByMaterialId = async function(materialId) {
  // Get today's date in local timezone (Philippines GMT+8)
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;
  
  // First try to find today's record for this material
  let car = await this.findOne({ materialId, date: todayStr });
  
  if (car) {
    return car;
  }
  
  // If no record for today, find the most recent record for this material
  car = await this.findOne({ materialId }).sort({ date: -1 });
  
  if (car) {
    // Update the existing record to today's date and reset session
    console.log(`🔄 Updating existing DeviceTracking record for ${materialId} to today's date: ${todayStr}`);
    
    // Update the date to today
    car.date = todayStr;
    
    // Reset the daily session for the new day
    car.currentSession = {
      date: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      startTime: new Date(),
      endTime: null,
      totalHoursOnline: 0,
      totalDistanceTraveled: 0,
      isActive: true,
      targetHours: 8,
      complianceStatus: 'PENDING',
      locationHistory: []
    };
    
    // Reset daily counters
    car.totalAdPlays = 0;
    car.totalQRScans = 0;
    car.totalDistanceTraveled = 0;
    car.totalHoursOnline = 0;
    car.totalAdImpressions = 0;
    car.totalAdPlayTime = 0;
    
    // Clear daily data arrays
    car.adPlaybacks = [];
    car.qrScans = [];
    car.locationHistory = [];
    car.hourlyStats = [];
    car.adPerformance = [];
    car.qrScansByAd = [];
    
    // Reset current ad
    car.currentAd = null;
    
    // Reset compliance data
    car.complianceData = {
      offlineIncidents: 0,
      displayIssues: 0
    };
    
    // Update lastSeen to now
    car.lastSeen = new Date();
    
    // Save the updated record
    await car.save();
    console.log(`✅ Successfully updated DeviceTracking record for ${materialId} to today's date`);
    
    return car;
  }
  
  return null; // No existing record found
};

// Helper method to get a specific slot
DeviceTrackingSchema.methods.getSlot = function(slotNumber) {
  return this.slots.find(slot => slot.slotNumber === slotNumber);
};

// Helper method to update a specific slot
DeviceTrackingSchema.methods.updateSlot = function(slotNumber, updateData) {
  const slot = this.getSlot(slotNumber);
  if (slot) {
    Object.assign(slot, updateData);
    slot.lastSeen = new Date();
  } else {
    // Create new slot if it doesn't exist
    this.slots.push({
      slotNumber: parseInt(slotNumber),
      ...updateData,
      lastSeen: new Date()
    });
  }
  
  // Update car-level online status
  this.isOnline = this.slots.some(slot => slot.isOnline);
  this.lastSeen = new Date();
  
  return this.save();
};

// Helper method to get slot status for dashboard
DeviceTrackingSchema.methods.getSlotStatus = function() {
  const status = {
    slot1: { online: false, deviceId: null, lastSeen: null },
    slot2: { online: false, deviceId: null, lastSeen: null }
  };
  
  this.slots.forEach(slot => {
    if (slot.slotNumber === 1) {
      status.slot1 = {
        online: slot.isOnline,
        deviceId: slot.deviceId,
        lastSeen: slot.lastSeen
      };
    } else if (slot.slotNumber === 2) {
      status.slot2 = {
        online: slot.isOnline,
        deviceId: slot.deviceId,
        lastSeen: slot.lastSeen
      };
    }
  });
  
  return status;
};

DeviceTrackingSchema.statics.findByDeviceSlot = function(deviceSlot) {
  const today = new Date().toISOString().split('T')[0];
  return this.find({ 
    'slots.slotNumber': deviceSlot, 
    date: today 
  });
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
  return this.findOne({ 
    materialId, 
    'slots.slotNumber': slotNumber 
  });
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
      { 'isDisplaying': false },
      { 'maintenanceMode': true },
      { 'slots.brightness': { $lt: 50 } }
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
DeviceTrackingSchema.methods.updateLocation = function(lat, lng, speed = 0, heading = 0, accuracy = 0, address = '', timestamp = null) {
  const newLocation = {
    type: 'Point',
    coordinates: [lng, lat],
    timestamp: timestamp || new Date(), // Use provided timestamp or current time
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
          $slice: -960 // Keep only last 960 entries (increased from 200)
        }
      }
    },
    { 
      new: true,
      runValidators: true
    }
  );
};

DeviceTrackingSchema.methods.trackAdPlayback = function(adId, adTitle, adDuration, viewTime = 0, slotNumber = null) {
  const now = new Date();
  const completionRate = adDuration > 0 ? Math.min(100, (viewTime / adDuration) * 100) : 0;
  const slot = slotNumber || this.deviceSlot || 1;
  
  // Update current ad (simplified)
  this.currentAd = {
    adId,
    adTitle,
    materialId: this.materialId,
    slotNumber: slot,
    adDuration: adDuration,
    startTime: now,
    endTime: null,
    currentTime: viewTime,
    state: 'playing',
    progress: completionRate,
    viewTime: viewTime,
    completionRate: completionRate,
    impressions: 1
  };
  
  // Create clean ad playback record (minimal data)
  const playbackRecord = {
    adId,
    adTitle,
    materialId: this.materialId,
    slotNumber: slot,
    adDuration: adDuration,
    startTime: now,
    endTime: null,
    viewTime: Math.round(viewTime * 100) / 100, // Round to 2 decimal places
    completionRate: Math.round(completionRate * 100) / 100, // Round to 2 decimal places
    impressions: 1
  };
  
  // Add to ad playbacks
  this.adPlaybacks.push(playbackRecord);
  
  // Update totals
  this.totalAdPlays += 1;
  this.totalAdImpressions += 1;
  this.totalAdPlayTime += viewTime;
  
  // Clean up old ad playbacks (keep only last 800)
  this.cleanupAdPlaybacks();
  
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
  const todayStr = today.toISOString().split('T')[0];
  
  // Check if we need to reset (new day)
  const sessionDate = new Date(this.currentSession?.date);
  if (sessionDate) {
    sessionDate.setHours(0, 0, 0, 0);
    if (sessionDate.getTime() !== today.getTime()) {
      // Reset for new day
      this.date = todayStr; // Update the main date field
      
      this.currentSession = {
        date: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        startTime: new Date(),
        endTime: null,
        totalHoursOnline: 0,
        totalDistanceTraveled: 0,
        isActive: true,
        targetHours: 8,
        complianceStatus: 'PENDING',
        locationHistory: []
      };
      
      // Reset daily counters
      this.totalAdPlays = 0;
      this.totalQRScans = 0;
      this.totalDistanceTraveled = 0;
      this.totalHoursOnline = 0;
      this.totalAdImpressions = 0;
      this.totalAdPlayTime = 0;
      
      // Clear daily data arrays
      this.adPlaybacks = [];
      this.qrScans = [];
      this.locationHistory = [];
      this.hourlyStats = [];
      this.adPerformance = [];
      this.qrScansByAd = [];
      
      // Reset current ad
      this.currentAd = null;
      
      // Reset compliance data
      this.complianceData = {
        offlineIncidents: 0,
        displayIssues: 0
      };
      
      // Also reset the current location to prevent invalid distance calculations
      this.currentLocation = null;
      
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

// Note: Ad playback tracking is now handled by the main trackAdPlayback method
// which uses the adPlaybacks array instead of screenMetrics

// Note: Driver activity tracking is now handled by the main hours tracking methods

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

// Method to clean up old ad playbacks
DeviceTrackingSchema.methods.cleanupAdPlaybacks = function() {
  if (this.adPlaybacks.length > 800) {
    this.adPlaybacks = this.adPlaybacks.slice(-800); // Keep only last 800 (8 hours × 160 plays × 5 ads)
  }
  return this;
};

module.exports = mongoose.models.DeviceTracking || mongoose.model('DeviceTracking', DeviceTrackingSchema);

