const mongoose = require('mongoose');
const GPSValidation = require('../utils/gpsValidation');
const { getUTCMidnight, isSameDay } = require('../utils/dateUtils');
const { setStartTimeIfNeeded: helperSetStartTime, syncDeviceDates, validateHours, syncHoursFromSession } = require('./deviceTrackingHelpers');
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
  userId: { type: String, required: true, index: true },
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
  userId: { type: String, required: true, index: true },
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
  address: { type: String }, // Geocoded address from GPS coordinates
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
  unregisteredAt: { 
    type: Date 
  }, // ✅ FIX: Track when slot was unregistered
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
    userId: { type: String },
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
  
  // Deployed ads (synced from AdsDeployment) - shows which ads SHOULD be playing
  deployedAds: [{
    adId: { type: String, required: true },
    userId: { type: String, required: true },
    adTitle: { type: String, required: true },
    slotNumber: { type: Number, min: 1, max: 5 },
    startTime: { type: Date },
    endTime: { type: Date },
    status: { 
      type: String, 
      enum: ['SCHEDULED', 'RUNNING', 'COMPLETED', 'PAUSED', 'CANCELLED', 'REMOVED'],
      default: 'SCHEDULED'
    },
    mediaFile: { type: String },
    deployedAt: { type: Date },
    deploymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'AdsDeployment' }
  }],
  
  // Reference to current deployment
  currentDeploymentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'AdsDeployment' 
  },
  lastDeploymentSync: { type: Date },
  
  // Real-time data arrays (for current day)
  adPlaybacks: [AdPlaybackSchema],
  qrScans: [QRScanSchema],
  locationHistory: [LocationPointSchema],
  
  // Hourly breakdown (for current day)
  hourlyStats: [HourlyStatsSchema],
  
  // Ad performance tracking
  adPerformance: [{
    adId: { type: String, required: true },
    userId: { type: String, required: true },
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
    userId: { type: String, required: true },
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
    completedAt: { type: Date }, // ✅ NEW: When 8-hour requirement was completed
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
  
  // ✅ FIX: Check for sentinel value (far future date = device hasn't come online yet)
  // If startTime is > 1 year in the future, it's a sentinel value meaning "not started yet"
  const oneYearFromNow = new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000));
  if (startTime > oneYearFromNow) {
    return 0; // Device hasn't come online yet today
  }
  
  // Get device timezone from current location
  const deviceTimezone = TimezoneUtils.getDeviceTimezone(this.currentLocation);
  
  // ✅ CRITICAL FIX: Check if this is a new day FIRST (before checking online status)
  // This prevents returning stale hours from yesterday when device is offline
  // Safety check: if session date is missing, assume new day and return 0
  if (!this.currentSession.date) {
    return 0;
  }
  
  const todayInDeviceTz = TimezoneUtils.getStartOfDayInTimezone(now, deviceTimezone);
  const sessionDateInDeviceTz = TimezoneUtils.getStartOfDayInTimezone(this.currentSession.date, deviceTimezone);
  
  // If it's a new day in device timezone, return 0 hours (fresh start) - regardless of online status
  if (sessionDateInDeviceTz.getTime() !== todayInDeviceTz.getTime()) {
    return 0;
  }
  
  // ✅ FIX: If device is offline, return only the accumulated hours (don't calculate real-time)
  // BUT only if it's the same day (checked above)
  if (!this.isOnline) {
    return Math.round((this.currentSession.totalHoursOnline || 0) * 100) / 100;
  }

  // ✅ FIX: Check if ads are actually displaying before calculating real-time hours
  // Hours should only count when ad player is actively displaying ads, not just when WebSocket is connected
  // Check both screenMetrics.isDisplaying and isDisplaying - if either is explicitly false, don't count hours
  const screenMetricsDisplaying = this.screenMetrics?.isDisplaying !== false;
  const deviceDisplaying = this.isDisplaying !== false;
  const isDisplaying = screenMetricsDisplaying && deviceDisplaying;
  if (!isDisplaying) {
    // Device is online but not displaying ads - return only accumulated hours
    return Math.round((this.currentSession.totalHoursOnline || 0) * 100) / 100;
  }

  // Device is online AND displaying ads - calculate hours since last update in real-time
  let totalHours = this.currentSession.totalHoursOnline || 0;
  const lastUpdate = this.currentSession.lastOnlineUpdate || startTime;
  const hoursSinceLastUpdate = TimezoneUtils.calculateHoursInTimezone(lastUpdate, now, deviceTimezone);

  // ✅ FIX: Always add real-time hours (removed < 1 hour restriction for real-time display)
  // The hoursUpdateService updates lastOnlineUpdate every 30 seconds, so this should be small increments
  // But even if lastOnlineUpdate is stale, we still want to show real-time hours
  if (hoursSinceLastUpdate > 0) {
    totalHours += hoursSinceLastUpdate;
  }
  
  // Cap at 8 hours max per day
  totalHours = Math.min(8, Math.max(0, totalHours));
  
  // NOTE: Virtual getters should NOT modify the document!
  // Modifications should only happen in methods like calculateAndUpdateOnlineHours()
  
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
  // Get today's date as UTC midnight (consistent with rest of system)
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0));
  
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
    // Check if the recent record is from a different day using timezone-aware comparison
    const recentDate = new Date(recentCar.date);
    
    // Convert both dates to Philippines timezone (GMT+8) for comparison
    const recentDateInPH = new Date(recentDate.getTime() + (8 * 60 * 60 * 1000)); // Add 8 hours
    const todayDateInPH = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // Add 8 hours
    
    // Compare just the date parts (year, month, day) in Philippines timezone
    const recentDateOnly = new Date(recentDateInPH.getFullYear(), recentDateInPH.getMonth(), recentDateInPH.getDate());
    const todayDateOnly = new Date(todayDateInPH.getFullYear(), todayDateInPH.getMonth(), todayDateInPH.getDate());
    
    if (recentDateOnly.getTime() !== todayDateOnly.getTime()) {
      // Different day - update the existing record to today's date and reset daily data
      const todayStr = today.toISOString().split('T')[0];
      console.log(`🔄 Auto-detecting new day: Updating existing DeviceTracking record for device ${deviceId} to today: ${todayStr}`);
      console.log(`   Previous record date: ${recentDate.toISOString().split('T')[0]} (${recentDateInPH.toISOString().split('T')[0]} PH time)`);
      console.log(`   Today's date: ${todayStr} (${todayDateInPH.toISOString().split('T')[0]} PH time)`);
      
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
      
      // ⚠️ IMPORTANT: Use sentinel value (far future date) for startTime until device actually comes online
      // This prevents counting hours from midnight when devices are offline
      // The sentinel value is checked in setOnlineStatus and currentHoursToday virtual
      const farFuture = new Date('2099-12-31T23:59:59Z'); // Sentinel value - device hasn't come online yet
      
      // Reset current session for new day
      recentCar.currentSession = {
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        startTime: farFuture,  // Sentinel value - will be set to actual time when device comes online
        endTime: null,
        totalHoursOnline: 0,
        totalDistanceTraveled: 0,
        isActive: true,
        targetHours: 8,
        complianceStatus: 'PENDING',
        locationHistory: [],
        lastOnlineUpdate: null
      };
      
      // ✅ FIX: Set online status to false at midnight - devices will report online when they actually connect
      // This prevents counting hours from midnight when devices are offline
      recentCar.isOnline = false;
      recentCar.slots.forEach(slot => {
        slot.isOnline = false; // Reset all slots to offline - they will report online when connected
        slot.lastSeen = new Date();
      });
      
      // Update lastSeen
      recentCar.lastSeen = new Date();
      
      // Save the updated record with error handling
      try {
        await recentCar.save();
        console.log(`✅ Successfully updated DeviceTracking record for device ${deviceId} to new day`);
      } catch (saveError) {
        console.error(`❌ Error saving DeviceTracking record for device ${deviceId}:`, saveError.message);
        // If save fails due to validation, try to create a new record instead
        if (saveError.name === 'ValidationError') {
          console.log(`⚠️ Validation error - creating new record for device ${deviceId} instead of updating`);
          // Create a new record for today instead
          const newCar = new this({
            materialId: recentCar.materialId,
            carGroupId: recentCar.carGroupId || 'UNKNOWN',
            screenType: recentCar.screenType || 'HEADDRESS',
            date: today,
            isOnline: false,
            lastSeen: new Date(),
            slots: recentCar.slots.map(slot => ({
              ...slot.toObject(),
              isOnline: false
            })),
            currentSession: {
              date: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
              startTime: farFuture,
              endTime: null,
              totalHoursOnline: 0,
              totalDistanceTraveled: 0,
              isActive: true,
              targetHours: 8,
              complianceStatus: 'PENDING',
              locationHistory: [],
              lastOnlineUpdate: null
            }
          });
          await newCar.save();
          console.log(`✅ Created new DeviceTracking record for device ${deviceId}`);
          return newCar;
        }
        throw saveError; // Re-throw if it's not a validation error
      }
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
  // Get today's date as UTC midnight (consistent with rest of system)
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0));
  
  // First try to find today's record for this material
  let car = await this.findOne({ materialId, date: today });
  
  if (car) {
    return car;
  }
  
  // If no record for today, find the most recent record for this material
  const recentCar = await this.findOne({ materialId }).sort({ date: -1 });
  
  if (recentCar) {
    // Check if the recent record is from a different day using timezone-aware comparison
    const recentDate = new Date(recentCar.date);
    
    // Convert both dates to Philippines timezone (GMT+8) for comparison
    const recentDateInPH = new Date(recentDate.getTime() + (8 * 60 * 60 * 1000)); // Add 8 hours
    const todayDateInPH = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // Add 8 hours
    
    // Compare just the date parts (year, month, day) in Philippines timezone
    const recentDateOnly = new Date(recentDateInPH.getFullYear(), recentDateInPH.getMonth(), recentDateInPH.getDate());
    const todayDateOnly = new Date(todayDateInPH.getFullYear(), todayDateInPH.getMonth(), todayDateInPH.getDate());
    
    if (recentDateOnly.getTime() !== todayDateOnly.getTime()) {
      // Different day - update the existing record to today's date and reset daily data
      const todayStr = today.toISOString().split('T')[0];
      console.log(`🔄 Auto-detecting new day: Updating existing DeviceTracking record for ${materialId} to today: ${todayStr}`);
      console.log(`   Previous record date: ${recentDate.toISOString().split('T')[0]} (${recentDateInPH.toISOString().split('T')[0]} PH time)`);
      console.log(`   Today's date: ${todayStr} (${todayDateInPH.toISOString().split('T')[0]} PH time)`);
      
      // ⚠️ IMPORTANT: Use sentinel value (far future date) for startTime until device actually comes online
      // This prevents counting hours from midnight when devices are offline
      // The sentinel value is checked in setOnlineStatus and currentHoursToday virtual
      const farFuture = new Date('2099-12-31T23:59:59Z'); // Sentinel value - device hasn't come online yet
      
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
        startTime: farFuture,  // Sentinel value - will be set to actual time when device comes online
        endTime: null,
        totalHoursOnline: 0,
        totalDistanceTraveled: 0,
        isActive: true,
        targetHours: 8,
        complianceStatus: 'PENDING',
        locationHistory: [],
        lastOnlineUpdate: null
      };
      
      // Reset online status for new day
      recentCar.isOnline = false;
      recentCar.slots.forEach(slot => {
        slot.isOnline = false;
        slot.lastSeen = new Date();
      });
      
      // Update lastSeen
      recentCar.lastSeen = new Date();
      
      // Save the updated record with error handling
      try {
        await recentCar.save();
        console.log(`✅ Successfully updated DeviceTracking record for ${materialId} to new day`);
      } catch (saveError) {
        console.error(`❌ Error saving DeviceTracking record for ${materialId}:`, saveError.message);
        // If save fails due to validation, try to create a new record instead
        if (saveError.name === 'ValidationError') {
          console.log(`⚠️ Validation error - creating new record for ${materialId} instead of updating`);
          // Create a new record for today instead
          const newCar = new this({
            materialId: recentCar.materialId,
            carGroupId: recentCar.carGroupId || 'UNKNOWN',
            screenType: recentCar.screenType || 'HEADDRESS',
            date: today,
            isOnline: false,
            lastSeen: new Date(),
            slots: recentCar.slots.map(slot => ({
              ...slot.toObject(),
              isOnline: false
            })),
            currentSession: {
              date: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
              startTime: farFuture,
              endTime: null,
              totalHoursOnline: 0,
              totalDistanceTraveled: 0,
              isActive: true,
              targetHours: 8,
              complianceStatus: 'PENDING',
              locationHistory: [],
              lastOnlineUpdate: null
            }
          });
          await newCar.save();
          console.log(`✅ Created new DeviceTracking record for ${materialId}`);
          return newCar;
        }
        throw saveError; // Re-throw if it's not a validation error
      }
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
DeviceTrackingSchema.methods.updateSlot = async function(slotNumber, updateData) {
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
  const wasOffline = !this.isOnline;
  this.isOnline = this.slots.some(slot => slot.isOnline);
  this.lastSeen = new Date();
  
  // ✅ FIX: Use centralized startTime setting logic
  if (wasOffline && this.isOnline) {
    helperSetStartTime(this);
  }
  
  // Retry logic for version conflicts
  let retries = 3;
  while (retries > 0) {
    try {
      return await this.save();
    } catch (error) {
      if (error.name === 'VersionError' && retries > 1) {
        console.log(`Version conflict, retrying... (${4 - retries}/3)`);
        // Reload the document to get the latest version
        const freshDoc = await this.constructor.findById(this._id);
        if (freshDoc) {
          // Update the slot on the fresh document directly without recursion
          const freshSlot = freshDoc.getSlot(slotNumber);
          if (freshSlot) {
            Object.assign(freshSlot, updateData);
            freshSlot.lastSeen = new Date();
          } else {
            freshDoc.slots.push({
              slotNumber: parseInt(slotNumber),
              ...updateData,
              lastSeen: new Date()
            });
          }
          
          // Update car-level online status
          freshDoc.isOnline = freshDoc.slots.some(slot => slot.isOnline);
          freshDoc.lastSeen = new Date();
          
          // Update this document with the fresh data
          this.set(freshDoc.toObject());
          retries--;
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }
  }
  
  throw new Error('Failed to save after retries');
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
// ✅ FIX: Pre-save hook to ensure totalQRScans stays in sync, but only if it's not already set correctly
// ✅ FIX: Always sync totalQRScans with qrScans.length and repair qrScansByAd to ensure accuracy
// This ensures the count reflects all scans in the array, fixing cases where slave slots
// added scans but didn't update the count
DeviceTrackingSchema.pre('save', function(next) {
  if (this.qrScans && Array.isArray(this.qrScans)) {
    // Always sync totalQRScans with the actual array length
    // This fixes cases where scans were added but count wasn't updated (e.g., slave slot scans)
    if (this.totalQRScans !== this.qrScans.length) {
      const oldCount = this.totalQRScans;
      this.totalQRScans = this.qrScans.length;
      if (oldCount !== undefined && oldCount !== null) {
        console.log(`🔧 [DeviceTracking] Synced totalQRScans: ${oldCount} → ${this.totalQRScans} (array has ${this.qrScans.length} scans)`);
      }
    }
    
    // ✅ FIX: Repair qrScansByAd to match actual qrScans array
    // Count scans per adId in the qrScans array
    const scanCountsByAd = new Map();
    this.qrScans.forEach(scan => {
      if (scan.adId) {
        const adIdStr = scan.adId.toString ? scan.adId.toString() : String(scan.adId);
        scanCountsByAd.set(adIdStr, (scanCountsByAd.get(adIdStr) || 0) + 1);
      }
    });
    
    // Update or create qrScansByAd entries to match actual counts
    if (scanCountsByAd.size > 0) {
      scanCountsByAd.forEach((actualCount, adIdStr) => {
        const existingAdScan = this.qrScansByAd.find(scan => {
          const scanAdIdStr = scan.adId ? (scan.adId.toString ? scan.adId.toString() : String(scan.adId)) : '';
          return scanAdIdStr === adIdStr;
        });
        
        if (existingAdScan) {
          // Repair if count is wrong
          if (existingAdScan.scanCount !== actualCount) {
            const oldCount = existingAdScan.scanCount;
            existingAdScan.scanCount = actualCount;
            // Find the most recent scan for this ad to update lastScanned
            const adScans = this.qrScans.filter(scan => {
              const scanAdId = scan.adId ? (scan.adId.toString ? scan.adId.toString() : String(scan.adId)) : '';
              return scanAdId === adIdStr;
            });
            if (adScans.length > 0) {
              const mostRecentScan = adScans.reduce((latest, scan) => {
                const scanTime = scan.scanTimestamp ? new Date(scan.scanTimestamp).getTime() : 0;
                const latestTime = latest.scanTimestamp ? new Date(latest.scanTimestamp).getTime() : 0;
                return scanTime > latestTime ? scan : latest;
              });
              if (mostRecentScan.scanTimestamp) {
                existingAdScan.lastScanned = new Date(mostRecentScan.scanTimestamp);
              }
            }
            console.log(`🔧 [DeviceTracking] Repaired qrScansByAd for ad ${adIdStr}: ${oldCount} → ${actualCount}`);
          }
        } else {
          // Create new entry if missing (try to get adTitle and userId from first scan)
          const firstScan = this.qrScans.find(scan => {
            const scanAdId = scan.adId ? (scan.adId.toString ? scan.adId.toString() : String(scan.adId)) : '';
            return scanAdId === adIdStr;
          });
          
          if (firstScan) {
            this.qrScansByAd.push({
              adId: firstScan.adId,
              userId: firstScan.userId || null,
              adTitle: firstScan.adTitle || 'Unknown',
              scanCount: actualCount,
              lastScanned: firstScan.scanTimestamp ? new Date(firstScan.scanTimestamp) : new Date(),
              firstScanned: firstScan.scanTimestamp ? new Date(firstScan.scanTimestamp) : new Date()
            });
            console.log(`🔧 [DeviceTracking] Created missing qrScansByAd entry for ad ${adIdStr}: ${actualCount} scans`);
          }
        }
      });
      
      // Mark as modified if we made changes
      if (this.qrScansByAd.length > 0) {
        this.markModified('qrScansByAd');
      }
    }
  }
  next();
});

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
      
      // ⚡ PERFORMANCE OPTIMIZATION: Event-driven UserAnalytics update
      // Extract unique userIds from adPlaybacks and adPerformance
      const affectedUserIds = new Set();
      
      // Extract userIds from adPlaybacks
      if (this.adPlaybacks && Array.isArray(this.adPlaybacks)) {
        this.adPlaybacks.forEach(playback => {
          if (playback.userId) {
            affectedUserIds.add(playback.userId.toString());
          }
        });
      }
      
      // Extract userIds from adPerformance
      if (this.adPerformance && Array.isArray(this.adPerformance)) {
        this.adPerformance.forEach(perf => {
          if (perf.userId) {
            affectedUserIds.add(perf.userId.toString());
          }
        });
      }
      
      // Extract userIds from qrScans
      if (this.qrScans && Array.isArray(this.qrScans)) {
        this.qrScans.forEach(scan => {
          if (scan.userId) {
            affectedUserIds.add(scan.userId.toString());
          }
        });
      }
      
      // Import and trigger archive (use setTimeout to avoid blocking the save operation)
      setTimeout(async () => {
        try {
          const dailyArchiveJobV2 = require('../jobs/dailyArchiveJobV2');
          const dateStr = this.date.toISOString().split('T')[0];
          await dailyArchiveJobV2.archiveMaterialDataV2(this, dateStr);
          console.log(`✅ Auto-archived updated data for ${this.materialId}`);
          
          // Also trigger real-time salary update
          const realTimeSalaryUpdateService = require('../services/realTimeSalaryUpdateService');
          await realTimeSalaryUpdateService.updateSalaryCalculations(this.materialId, dateStr);
          console.log(`✅ Real-time salary update triggered for ${this.materialId}`);
          
          // ⚡ PERFORMANCE OPTIMIZATION: Event-driven UserAnalytics incremental update
          // ✅ DISABLED: incrementalUpdateUser method doesn't exist - sync jobs will handle updates
          // The sync job runs every 5 minutes and will update UserAnalytics correctly
          // Removing this call prevents errors and ensures sync jobs are the single source of truth
          // if (affectedUserIds.size > 0) {
          //   const UserAnalyticsService = require('../services/userAnalyticsService');
          //   const updatePromises = Array.from(affectedUserIds).map(userId => 
          //     UserAnalyticsService.incrementalUpdateUser(userId, this.materialId, dateStr)
          //       .catch(error => {
          //         // Don't fail if incremental update fails - background sync will handle it
          //         console.warn(`⚠️ [INCREMENTAL] Failed to update user ${userId}: ${error.message}`);
          //       })
          //   );
          //   
          //   // Execute all updates in parallel (non-blocking)
          //   Promise.all(updatePromises).then(() => {
          //     console.log(`✅ [INCREMENTAL] Updated ${affectedUserIds.size} users incrementally`);
          //   }).catch(error => {
          //     console.warn(`⚠️ [INCREMENTAL] Some incremental updates failed: ${error.message}`);
          //   });
          //   
          //   console.log(`⚡ [INCREMENTAL] Triggered incremental updates for ${affectedUserIds.size} users`);
          // }
        } catch (error) {
          console.error(`❌ Auto-archive/salary update failed for ${this.materialId}:`, error.message);
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
  // ✅ FIX: Use centralized master validation
  const validation = GPSValidation.validateLocation(lat, lng, accuracy, speed, heading);
  
  if (!validation.isValid) {
    const error = new Error(`Invalid GPS data: ${validation.errors.join(', ')}`);
    error.name = 'GPSValidationError';
    error.details = validation;
    throw error; // ✅ Fail loudly instead of silently
  }

  // Log warnings if any
  if (validation.warnings.length > 0) {
    console.log(`📍 [updateLocation] ${this.materialId}: GPS warnings - ${validation.warnings.join(', ')}`);
  }
  
  // ✅ Use sanitized values
  const sanitized = validation.sanitized;
  
  const newLocation = {
    type: 'Point',
    coordinates: [sanitized.lng, sanitized.lat], // ✅ Use sanitized
    timestamp: timestamp || new Date(),
    speed: sanitized.speed,
    heading: sanitized.heading,
    accuracy: sanitized.accuracy,
    address: address || ''
  };
  
  // Calculate distance if we have a previous location
  let distanceAdded = 0;
  if (this.currentLocation && this.locationHistory.length > 0) {
    const prevLocation = this.currentLocation;
    
    // ✅ FIX: Check time gap between locations to detect offline periods (improved logic)
    const prevTimestamp = new Date(prevLocation.timestamp);
    const currentTimestamp = new Date(newLocation.timestamp);
    const timeGapSeconds = (currentTimestamp - prevTimestamp) / 1000;
    const MAX_TIME_GAP = 300; // 300 seconds = 5 minutes (increased from 60s to reduce false breaks)
    
    // Calculate distance first to check both time and distance
    let calculatedDistance = 0;
    if (prevLocation.coordinates && prevLocation.coordinates.length >= 2) {
      calculatedDistance = GPSValidation.calculateDistance(
        prevLocation.coordinates[1], prevLocation.coordinates[0],
        lat, lng
      );
    }
    
    // ✅ IMPROVED: Only mark segment break if BOTH time gap is large AND distance jump is large
    // This prevents false segment breaks from normal GPS delays
    const MAX_DISTANCE_JUMP = 0.5; // 0.5 km = 500 meters
    
    if (timeGapSeconds > MAX_TIME_GAP && calculatedDistance > MAX_DISTANCE_JUMP) {
      // Large time gap AND large distance = device was offline and moved (real segment break)
      console.log(`⏸️ [updateLocation] ${this.materialId}: Segment break detected - time gap ${timeGapSeconds.toFixed(1)}s, distance jump ${(calculatedDistance * 1000).toFixed(1)}m - marking as segment start`);
      newLocation.isSegmentStart = true;
    } else if (timeGapSeconds > MAX_TIME_GAP) {
      // Large time gap but small distance = GPS signal loss while stationary (don't break)
      console.log(`📍 [updateLocation] ${this.materialId}: Large time gap (${timeGapSeconds.toFixed(1)}s) but small movement (${(calculatedDistance * 1000).toFixed(1)}m) - likely GPS signal loss while stationary, not breaking route`);
      // Continue normally - don't mark segment break for stationary GPS signal loss
    }
    
    // Continue with distance calculation if not a segment break
    if (!newLocation.isSegmentStart) {
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
        
        // ✅ IMPROVED FILTERING: Check GPS accuracy to prevent false distance from GPS drift
        const currentAccuracy = accuracy || 0;
        const previousAccuracy = prevLocation.accuracy || 0;
        const MAX_ACCURACY_THRESHOLD = 30; // meters - only count movements with good GPS accuracy
        const MIN_MOVEMENT_THRESHOLD = 0.008; // 0.008 km = 8 meters - filters stationary GPS drift
        
        // ✅ FIX: Calculate speed to validate movement is realistic
        const calculatedSpeed = timeGapSeconds > 0 ? (distance / timeGapSeconds) * 3600 : 0; // km/h
        const MAX_REALISTIC_SPEED = 200; // km/h - maximum realistic speed for a vehicle (increased from 150 to allow highway speeds)
        
        // Only add distance if:
        // 1. Movement is significant (more than 8 meters) - filters stationary GPS noise while capturing actual movement
        // 2. Both GPS readings have good accuracy (<30m) - filters GPS drift and jumps
        // 3. Calculated speed is realistic (<200 km/h) - prevents impossible movements from GPS jumps
        // 4. Time gap is reasonable (<300s/5min) - already checked above
        if (distance > MIN_MOVEMENT_THRESHOLD) {
          // Check if both current and previous GPS readings are accurate enough
          if (currentAccuracy < MAX_ACCURACY_THRESHOLD && previousAccuracy < MAX_ACCURACY_THRESHOLD) {
            // Check if calculated speed is realistic
            if (calculatedSpeed <= MAX_REALISTIC_SPEED) {
              distanceAdded = distance;
              this.totalDistanceTraveled += distance;
              console.log(`📍 [updateLocation] ${this.materialId}: Movement detected - ${(distance * 1000).toFixed(1)}m in ${timeGapSeconds.toFixed(1)}s (${calculatedSpeed.toFixed(1)} km/h, accuracy: curr=${currentAccuracy.toFixed(1)}m, prev=${previousAccuracy.toFixed(1)}m, total: ${this.totalDistanceTraveled.toFixed(3)}km)`);
            } else {
              console.log(`📍 [updateLocation] ${this.materialId}: Movement rejected - impossible speed (${calculatedSpeed.toFixed(1)} km/h > ${MAX_REALISTIC_SPEED} km/h) - likely GPS jump or offline period`);
            }
          } else {
            console.log(`📍 [updateLocation] ${this.materialId}: Movement rejected - poor GPS accuracy (${(distance * 1000).toFixed(1)}m movement, curr=${currentAccuracy.toFixed(1)}m, prev=${previousAccuracy.toFixed(1)}m) - likely GPS drift`);
          }
        } else {
          console.log(`📍 [updateLocation] ${this.materialId}: Movement too small (${(distance * 1000).toFixed(1)}m < 8m threshold) - ignoring GPS noise/drift`);
        }
      } else {
        console.log(`📍 [updateLocation] ${this.materialId}: Previous location invalid - skipping distance calculation`);
      }
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
    // ✅ FIX: Also update currentSession.totalDistanceTraveled
    if (this.currentSession) {
      updateData['currentSession.totalDistanceTraveled'] = (this.currentSession.totalDistanceTraveled || 0) + distanceAdded;
    }
  }
  
  // ✅ MEMORY OPTIMIZATION: Build update operation to push to root locationHistory only (removed duplicate storage)
  const updateOperation = {
    $set: updateData,
    $push: {
      locationHistory: {
        $each: [newLocation],
        $slice: -3600 // ✅ MEMORY OPTIMIZATION: Reduced from 14400 to 3600 entries (2 hours at 2s intervals instead of 8 hours)
        // This reduces memory usage by 75% per device while still maintaining 2 hours of route history
        // Old: 14,400 entries = ~4.3 MB per device (with 2 arrays = 8.6 MB)
        // New: 3,600 entries = ~1.1 MB per device (with 1 array = 1.1 MB)
        // Savings: ~7.5 MB per device (87% reduction)
      }
    }
  };
  
  // ✅ MEMORY OPTIMIZATION: Removed duplicate locationHistory storage in currentSession
  // Previously stored locationHistory in BOTH root and currentSession (doubling memory usage)
  // Now only store in root locationHistory to reduce memory by 50%
  // The currentSession can access the root locationHistory for the session's timeframe
  // Note: If session-specific history is needed, it can be filtered from root locationHistory by timestamp
  
  return this.constructor.findByIdAndUpdate(
    this._id,
    updateOperation,
    { 
      new: true,
      runValidators: true
    }
  ).then(async (updatedDoc) => {
    if (distanceAdded > 0) {
      console.log(`📍 [updateLocation] ${this.materialId}: +${distanceAdded.toFixed(3)}km (total: ${updatedDoc.totalDistanceTraveled.toFixed(3)}km)`);
    }
    
    // ✅ MEMORY OPTIMIZATION: Verify locationHistory was actually updated
    // Sometimes findByIdAndUpdate doesn't return the full updated document with arrays
    const freshDoc = await this.constructor.findById(this._id).lean();
    const historySize = freshDoc?.locationHistory?.length || 0;
    const lastPoint = historySize > 0 ? freshDoc.locationHistory[historySize - 1] : null;
    
    // ✅ MEMORY OPTIMIZATION: Only log locationHistory size (removed currentSession.locationHistory logging)
    // We no longer store duplicate locationHistory in currentSession to save memory
    if (historySize > 0) {
      console.log(`📍 [updateLocation] ${this.materialId}: locationHistory size: ${historySize}/${3600} points (max)`);
      if (lastPoint) {
        console.log(`📍 [updateLocation] ${this.materialId}: Last point - lat=${lastPoint.coordinates?.[1]?.toFixed(6)}, lng=${lastPoint.coordinates?.[0]?.toFixed(6)}, accuracy=${lastPoint.accuracy?.toFixed(1)}m`);
      }
    } else {
      console.warn(`⚠️ [updateLocation] ${this.materialId}: WARNING - locationHistory is empty!`);
    }
    
    // Return the fresh document to ensure we have the latest locationHistory
    return this.constructor.findById(this._id);
  });
};

// Note: GPS validation functions (validateCoordinates, calculateDistance) 
// are centralized in utils/gpsValidation.js and used via GPSValidation.* throughout the codebase

DeviceTrackingSchema.methods.trackAdPlayback = async function(adId, adTitle, adDuration, viewTime = 0, slotNumber = null) {
  const now = new Date();
  const completionRate = adDuration > 0 ? Math.min(100, (viewTime / adDuration) * 100) : 0;
  const slot = slotNumber || this.deviceSlot || 1;
  
  // Look up userId from Ad collection
  let userId = null;
  try {
    const Ad = require('./Ad');
    const ad = await Ad.findById(adId).select('userId');
    if (ad && ad.userId) {
      userId = ad.userId.toString();
    }
  } catch (error) {
    console.error(`❌ Error fetching userId for ad ${adId}:`, error.message);
  }
  
  // Update current ad (simplified)
  this.currentAd = {
    adId,
    userId,
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
  
  // Only create playback record if we have userId (required field)
  if (userId) {
    const playbackRecord = {
      adId,
      userId,
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
  } else {
    console.warn(`⚠️  Skipping adPlayback for ${adId} - no userId found`);
  }
  
  // Update totals
  this.totalAdPlays += 1;
  this.totalAdImpressions += 1;
  this.totalAdPlayTime += viewTime;
  
  // Clean up old ad playbacks (keep only last 800)
  this.cleanupAdPlaybacks();
  
  // Update ad performance (filter out entries without userId before adding new ones)
  this.adPerformance = this.adPerformance.filter(perf => perf.userId);
  
  // Only update adPerformance if we have userId
  if (userId) {
    let adPerf = this.adPerformance.find(ad => ad.adId === adId);
    if (!adPerf) {
      adPerf = {
        adId,
        userId,
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
  } else {
    console.warn(`⚠️  Skipping adPerformance update for ${adId} - no userId found`);
  }
  
  // Update hourly stats
  this.updateHourlyStats('adPlays', 1);
  this.updateHourlyStats('adPlayTime', viewTime);
  
  this.lastSeen = now;
  return this.saveWithRetry();
};

DeviceTrackingSchema.methods.trackQRScan = function(qrScanData) {
  // Add QR scan (only if it has userId)
  if (qrScanData.userId) {
    this.qrScans.push(qrScanData);
    this.totalQRScans += 1;
  }
  
  // Filter out entries without userId
  this.qrScansByAd = this.qrScansByAd.filter(scan => scan.userId);
  
  // Update QR scans per ad (only if qrScanData has userId)
  if (qrScanData.userId) {
    const existingAdScan = this.qrScansByAd.find(scan => scan.adId === qrScanData.adId);
    if (existingAdScan) {
      existingAdScan.scanCount += 1;
      existingAdScan.lastScanned = new Date();
    } else {
      this.qrScansByAd.push({
        adId: qrScanData.adId,
        userId: qrScanData.userId,
        adTitle: qrScanData.adTitle,
        scanCount: 1,
        lastScanned: new Date(),
        firstScanned: new Date()
      });
    }
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
    
    // ✅ Set session startTime when device comes online for the first time today
    // Check if startTime is sentinel value (far future) or not set
    if (this.currentSession) {
      const now = new Date();
      const startTime = new Date(this.currentSession.startTime);
      const oneYearFromNow = new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000));
      
      // If startTime is in far future (sentinel) or not set, set it to now
      if (!this.currentSession.startTime || startTime > oneYearFromNow) {
        this.currentSession.startTime = now;
        this.currentSession.lastOnlineUpdate = now;
        console.log(`⏰ [setOnlineStatus] ${this.materialId}: Starting session at ${now.toISOString()}`);
      }
    }
  }
  
  return this.save();
};

// ✅ FIX: Centralized reset method using helpers
DeviceTrackingSchema.methods.resetDailySession = function() {
  const { needsDailyReset } = require('./deviceTrackingHelpers');
  
  // Check if reset is needed
  if (!needsDailyReset(this)) {
    return false; // No reset needed
  }
  
  // Reset for new day
  const today = getUTCMidnight();
  const farFuture = new Date('2099-12-31T23:59:59Z'); // Sentinel value
  
  // ✅ Use centralized date sync
  syncDeviceDates(this, today);
  
  // ⚠️ IMPORTANT: Use sentinel value for startTime until device actually comes online
  // This prevents counting hours from midnight when devices are offline
  this.currentSession = {
    date: today,
    startTime: farFuture,  // Sentinel: will be set when device comes online
    endTime: null,
    totalHoursOnline: 0,
    totalDistanceTraveled: 0,
    isActive: true,
    targetHours: 8,
    complianceStatus: 'PENDING',
    locationHistory: [],
    lastOnlineUpdate: null  // ✅ FIX: Initialize to null, will be set when device comes online
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
  
  // Reset online status
  this.isOnline = false;
  if (this.slots && this.slots.length > 0) {
    this.slots.forEach(slot => {
      slot.isOnline = false;
    });
  }
  
  return true; // Session was reset
};

// Method to start daily session (from ScreenTracking)
DeviceTrackingSchema.methods.startDailySession = function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const now = new Date();
  
  this.currentSession = {
    date: today,
    startTime: now,  // ✅ FIX: Set to current time when session starts
    endTime: null,
    totalHoursOnline: 0,
    totalDistanceTraveled: 0,
    locationHistory: [],
    isActive: true,
    targetHours: 8,
    complianceStatus: 'PENDING',
    lastOnlineUpdate: now  // ✅ FIX: Initialize to now when session starts
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

  // ✅ FIX: Only count hours when ads are actually displaying
  // Hours should only accumulate when ad player is actively displaying ads, not just when WebSocket is connected
  // Check both screenMetrics.isDisplaying and isDisplaying - if either is explicitly false, don't count hours
  const screenMetricsDisplaying = this.screenMetrics?.isDisplaying !== false;
  const deviceDisplaying = this.isDisplaying !== false;
  const isDisplaying = screenMetricsDisplaying && deviceDisplaying;
  if (!isDisplaying) {
    // Device is online but not displaying ads - don't update hours
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
  
  // Use incremental tracking: only count time since last update
  const lastUpdate = this.currentSession.lastOnlineUpdate || this.currentSession.startTime;
  const hoursSinceLastUpdate = (now - new Date(lastUpdate)) / (1000 * 60 * 60);
  
  // Only add hours if this is a reasonable increment (less than 1 hour to prevent bugs)
  if (hoursSinceLastUpdate > 0 && hoursSinceLastUpdate < 1) {
    this.currentSession.totalHoursOnline = (this.currentSession.totalHoursOnline || 0) + hoursSinceLastUpdate;
  }
  
  // Update last online update time
  this.currentSession.lastOnlineUpdate = now;
  
  // Cap at 8 hours max per day
  this.currentSession.totalHoursOnline = Math.min(8, Math.max(0, this.currentSession.totalHoursOnline));
  
  // Update compliance status (only for ACTIVE sessions)
  // For active sessions: COMPLIANT if >= 8 hours, otherwise PENDING (still working towards goal)
  // For ended sessions: Status is set by endDailySession() method
  if (this.currentSession.isActive) {
    this.currentSession.complianceStatus = 
      this.currentSession.totalHoursOnline >= this.currentSession.targetHours ? 'COMPLIANT' : 'PENDING';
  }
  // If session is not active, don't change the status (it was already set by endDailySession)
  
  // Always update total lifetime hours for the current day (not cumulative)
  this.totalHoursOnline = Math.round(this.currentSession.totalHoursOnline * 100) / 100;
  
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

