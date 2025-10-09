const mongoose = require('mongoose');
const GPSValidation = require('../utils/gpsValidation');
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
    required: false, // Allow null when device is unregistered
    default: null,
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
  // Get today's date as a Date object (start of day)
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Find car record that contains this device in slots for today
  let car = await this.findOne({ 
    'slots.deviceId': deviceId, 
    date: today 
  });
  
  if (car) {
    return car;
  }
  
  // If no record for today, find the most recent record for this device
  const recentCar = await this.findOne({ 'slots.deviceId': deviceId }).sort({ date: -1 });
  
  if (recentCar) {
    // Check if the recent record is from a different day
    const recentDate = new Date(recentCar.date);
    const recentDateOnly = new Date(recentDate.getFullYear(), recentDate.getMonth(), recentDate.getDate());
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    if (recentDateOnly.getTime() !== todayDateOnly.getTime()) {
      // Different day - update the existing record to today's date and reset daily data
      const todayStr = today.toISOString().split('T')[0];
      console.log(`🔄 Auto-detecting new day: Updating existing DeviceTracking record for device ${deviceId} to today: ${todayStr}`);
      console.log(`   Previous record date: ${recentDate.toISOString().split('T')[0]}`);
      console.log(`   Today's date: ${todayStr}`);
      
      // Update the existing record to today's date and reset daily data
      recentCar.date = today;
      
      // Reset daily counters for new day
      recentCar.totalAdPlays = 0;
      recentCar.totalQRScans = 0;
      recentCar.totalDistanceTraveled = 0;
      recentCar.totalHoursOnline = 0;
      recentCar.totalAdImpressions = 0;
      recentCar.totalAdPlayTime = 0;
      
      // Clear daily data arrays
      recentCar.adPlaybacks = [];
      recentCar.qrScans = [];
      recentCar.locationHistory = [];
      recentCar.hourlyStats = [];
      recentCar.adPerformance = [];
      recentCar.qrScansByAd = [];
      
      // Reset current ad
      recentCar.currentAd = null;
      
      // Reset compliance data
      recentCar.complianceData = {
        offlineIncidents: 0,
        displayIssues: 0
      };
      
      // Reset current session for new day
      recentCar.currentSession = {
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        startTime: new Date(),
        endTime: null,
        totalHoursOnline: 0,
        totalDistanceTraveled: 0,
        isActive: true,
        targetHours: 8,
        complianceStatus: 'PENDING',
        locationHistory: []
      };
      
      // Set online status for the current device
      recentCar.isOnline = true;
      recentCar.slots.forEach(slot => {
        slot.isOnline = slot.deviceId === deviceId;
        slot.lastSeen = new Date();
      });
      
      // Update lastSeen
      recentCar.lastSeen = new Date();
      
      // Save the updated record
      await recentCar.save();
      console.log(`✅ Successfully updated existing DeviceTracking record for device ${deviceId} to today's date`);
      
      return recentCar;
    } else {
      // Same day - return the existing record
      console.log(`📅 Same day detected: Using existing record for device ${deviceId}`);
      return recentCar;
    }
  }
  
  return null; // No existing record found
};

DeviceTrackingSchema.statics.findByMaterialId = async function(materialId) {
  // Get today's date as a Date object (start of day)
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // First try to find today's record for this material
  let car = await this.findOne({ materialId, date: today });
  if (car) {
    return car;
  }

  // If no record for today, find the most recent record for this material
  const recentCar = await this.findOne({ materialId }).sort({ date: -1 });
  
  if (recentCar) {
    // Check if the recent record is from a different day
    const recentDate = new Date(recentCar.date);
    const recentDateOnly = new Date(recentDate.getFullYear(), recentDate.getMonth(), recentDate.getDate());
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    if (recentDateOnly.getTime() !== todayDateOnly.getTime()) {
      // Different day - update the existing record to today's date and reset daily data
      const todayStr = today.toISOString().split('T')[0];
      console.log(`🔄 Auto-detecting new day: Updating existing DeviceTracking record for ${materialId} to today: ${todayStr}`);
      console.log(`   Previous record date: ${recentDate.toISOString().split('T')[0]}`);
      console.log(`   Today's date: ${todayStr}`);
      
      // Update the existing record to today's date and reset daily data
      recentCar.date = today;
      
      // Reset daily counters for new day
      recentCar.totalAdPlays = 0;
      recentCar.totalQRScans = 0;
      recentCar.totalDistanceTraveled = 0;
      recentCar.totalHoursOnline = 0;
      recentCar.totalAdImpressions = 0;
      recentCar.totalAdPlayTime = 0;
      
      // Clear daily data arrays
      recentCar.adPlaybacks = [];
      recentCar.qrScans = [];
      recentCar.locationHistory = [];
      recentCar.hourlyStats = [];
      recentCar.adPerformance = [];
      recentCar.qrScansByAd = [];
      
      // Reset current ad
      recentCar.currentAd = null;
      
      // Reset compliance data
      recentCar.complianceData = {
        offlineIncidents: 0,
        displayIssues: 0
      };
      
      // Reset current session for new day
      recentCar.currentSession = {
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        startTime: new Date(),
        endTime: null,
        totalHoursOnline: 0,
        totalDistanceTraveled: 0,
        isActive: true,
        targetHours: 8,
        complianceStatus: 'PENDING',
        locationHistory: []
      };
      
      // Reset online status for new day
      recentCar.isOnline = false;
      recentCar.slots.forEach(slot => {
        slot.isOnline = false;
        slot.lastSeen = new Date();
      });
      
      // Update lastSeen
      recentCar.lastSeen = new Date();
      
      // Save the updated record
      await recentCar.save();
      console.log(`✅ Successfully updated existing DeviceTracking record for ${materialId} to today's date`);
      
      return recentCar;
    } else {
      // Same day - return the existing record
      console.log(`📅 Same day detected: Using existing record for ${materialId}`);
      return recentCar;
    }
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

// Post-save hook to trigger archiving when DeviceTracking data changes
DeviceTrackingSchema.post('save', async function(doc) {
  try {
    // Only trigger archiving for significant data changes (not just status updates)
    if (this.isModified('totalAdPlays') || 
        this.isModified('totalQRScans') || 
        this.isModified('totalDistanceTraveled') || 
        this.isModified('totalHoursOnline') ||
        this.isModified('adPlaybacks') ||
        this.isModified('qrScans') ||
        this.isModified('locationHistory')) {
      
      console.log(`🔄 DeviceTracking data changed for ${this.materialId}, triggering archive...`);
      
      // Import and trigger archive (use setTimeout to avoid blocking the save operation)
      setTimeout(async () => {
        try {
          const dailyArchiveJobV2 = require('../jobs/dailyArchiveJobV2');
          const dateStr = this.date.toISOString().split('T')[0];
          await dailyArchiveJobV2.archiveMaterialDataV2(this, dateStr);
          console.log(`✅ Auto-archived updated data for ${this.materialId}`);
        } catch (error) {
          console.error(`❌ Auto-archive failed for ${this.materialId}:`, error.message);
        }
      }, 1000); // 1 second delay to ensure save is complete
    }
  } catch (error) {
    console.error('❌ Error in DeviceTracking post-save hook:', error.message);
  }
});

// Post-update hook to trigger archiving when DeviceTracking data is updated via updateOne, updateMany, etc.
DeviceTrackingSchema.post(['updateOne', 'updateMany', 'findOneAndUpdate'], async function(result) {
  try {
    if (result && (result.modifiedCount > 0 || result.nModified > 0)) {
      // Get the updated document(s)
      const filter = this.getFilter();
      const updatedDocs = await this.model.find(filter);
      
      for (const doc of updatedDocs) {
        console.log(`🔄 DeviceTracking data updated for ${doc.materialId}, triggering archive...`);
        
        // Import and trigger archive
        setTimeout(async () => {
          try {
            const dailyArchiveJobV2 = require('../jobs/dailyArchiveJobV2');
            const dateStr = doc.date.toISOString().split('T')[0];
            await dailyArchiveJobV2.archiveMaterialDataV2(doc, dateStr);
            console.log(`✅ Auto-archived updated data for ${doc.materialId}`);
          } catch (error) {
            console.error(`❌ Auto-archive failed for ${doc.materialId}:`, error.message);
          }
        }, 1000);
      }
    }
  } catch (error) {
    console.error('❌ Error in DeviceTracking post-update hook:', error.message);
  }
});

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
  // Enhanced GPS validation using new validation utility
  const coordValidation = GPSValidation.validateCoordinates(lat, lng);
  if (!coordValidation.isValid) {
    console.log(`📍 [updateLocation] ${this.materialId}: Invalid GPS coordinates [${lat}, ${lng}] - ${coordValidation.errors.join(', ')}`);
    return Promise.resolve(this);
  }

  const accuracyValidation = GPSValidation.validateAccuracy(accuracy);
  if (!accuracyValidation.isValid) {
    console.log(`📍 [updateLocation] ${this.materialId}: Invalid GPS accuracy (${accuracy}m) - ${accuracyValidation.message}`);
    return Promise.resolve(this);
  }

  const speedValidation = GPSValidation.validateSpeed(speed);
  if (!speedValidation.isValid) {
    console.log(`📍 [updateLocation] ${this.materialId}: Invalid speed (${speed} km/h) - ${speedValidation.message}`);
    return Promise.resolve(this);
  }

  // Log warnings if any
  if (coordValidation.warnings.length > 0) {
    console.log(`📍 [updateLocation] ${this.materialId}: GPS warnings - ${coordValidation.warnings.join(', ')}`);
  }
  
  const newLocation = {
    type: 'Point',
    coordinates: [lng, lat],
    timestamp: timestamp || new Date(), // Use provided timestamp or current time
    speed: Math.max(0, speed || 0), // Ensure non-negative speed
    heading: Math.max(0, Math.min(360, heading || 0)), // Clamp heading to 0-360
    accuracy: Math.max(0, accuracy || 0), // Ensure non-negative accuracy
    address: address || ''
  };
  
  // Calculate distance if we have a previous location
  let distanceAdded = 0;
  if (this.currentLocation && this.locationHistory.length > 0) {
    const prevLocation = this.currentLocation;
    
    // Validate previous location coordinates using enhanced validation
    const prevCoordValidation = GPSValidation.validateCoordinates(
      prevLocation.coordinates[1], 
      prevLocation.coordinates[0]
    );
    
    if (prevCoordValidation.isValid) {
      const distance = GPSValidation.calculateDistance(
        prevLocation.coordinates[1], prevLocation.coordinates[0], // lat, lng
        lat, lng
      );
      
      // Only add distance if movement is significant (more than 10 meters)
      // This filters out GPS noise when device is stationary
      if (distance > 0.01) { // 0.01 km = 10 meters
        distanceAdded = distance;
        this.totalDistanceTraveled += distance;
        console.log(`📍 [updateLocation] ${this.materialId}: Movement detected - ${(distance * 1000).toFixed(1)}m (total: ${this.totalDistanceTraveled.toFixed(3)}km)`);
      } else {
        console.log(`📍 [updateLocation] ${this.materialId}: Movement too small (${(distance * 1000).toFixed(1)}m) - ignoring GPS noise`);
      }
    } else {
      console.log(`📍 [updateLocation] ${this.materialId}: Previous location invalid - skipping distance calculation`);
    }
  }
  
  // Use findByIdAndUpdate to avoid version conflicts
  const updateData = {
    currentLocation: newLocation,
    lastSeen: new Date()
  };
  
  // Add distance if significant movement
  if (distanceAdded > 0) {
    updateData.totalDistanceTraveled = this.totalDistanceTraveled;
  }
  
  return this.constructor.findByIdAndUpdate(
    this._id,
    {
      $set: updateData,
      $push: {
        locationHistory: {
          $each: [newLocation],
          $slice: -4114 // Keep only last 4114 entries (8 hours at 7s intervals)
        }
      }
    },
    { 
      new: true,
      runValidators: true
    }
  ).then((updatedDoc) => {
    if (distanceAdded > 0) {
      console.log(`📍 [updateLocation] ${this.materialId}: +${distanceAdded.toFixed(3)}km (total: ${updatedDoc.totalDistanceTraveled.toFixed(3)}km)`);
    }
    return updatedDoc;
  });
};

// Helper method to validate GPS coordinates
DeviceTrackingSchema.methods.isValidGPSCoordinates = function(lat, lng) {
  // Check if coordinates are valid numbers
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return false;
  }
  
  // Check if coordinates are not NaN or Infinity
  if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) {
    return false;
  }
  
  // Check if coordinates are not [0,0] (GPS initialization issue)
  if (lat === 0 && lng === 0) {
    return false;
  }
  
  // Check if coordinates are within valid GPS ranges
  // Latitude: -90 to 90 degrees
  // Longitude: -180 to 180 degrees
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return false;
  }
  
  // Check if coordinates are reasonable for the Philippines region
  // Philippines is roughly: 4.5°N to 21.1°N, 116.9°E to 126.6°E
  if (lat < 4.5 || lat > 21.1 || lng < 116.9 || lng > 126.6) {
    console.log(`📍 [GPS Validation] ${this.materialId}: Coordinates [${lat}, ${lng}] outside Philippines region`);
    // Don't reject, just log - device might be traveling
  }
  
  return true;
};

// Helper method to calculate distance between two points
DeviceTrackingSchema.methods.calculateDistance = function(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
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
  const TimezoneUtils = require('../utils/timezoneUtils');
  const now = new Date();
  
  // Get device timezone from current location or default to Philippines
  const deviceTimezone = TimezoneUtils.getDeviceTimezone(this.currentLocation);
  
  // Get start of today in device timezone
  const todayInDeviceTz = TimezoneUtils.getStartOfDayInTimezone(now, deviceTimezone);
  const todayStr = todayInDeviceTz.toISOString().split('T')[0];
  
  // Check if we need to reset (new day)
  const sessionDate = new Date(this.currentSession?.date);
  if (sessionDate) {
    const sessionDateInDeviceTz = TimezoneUtils.getStartOfDayInTimezone(sessionDate, deviceTimezone);
    
    if (sessionDateInDeviceTz.getTime() !== todayInDeviceTz.getTime()) {
      // Reset for new day
      this.date = today; // Update the main date field
      
      this.currentSession = {
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
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
  
  // Always update total lifetime hours for the current day (not cumulative)
  this.totalHoursOnline = Math.round(totalHours * 100) / 100;
  
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

