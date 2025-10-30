const mongoose = require('mongoose');

// Location point schema (GeoJSON format)
const LocationPointSchema = new mongoose.Schema({
  type: { type: String, default: 'Point' },
  coordinates: { 
    type: [Number], 
    required: true,
    validate: {
      validator: function(v) {
        return v && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number';
      },
      message: 'Coordinates must be an array of exactly 2 numbers [longitude, latitude]'
    }
  },
  accuracy: { type: Number, default: 0 },
  altitude: { type: Number, default: 0 },
  speed: { type: Number, default: 0 },
  heading: { type: Number, default: 0 },
  timestamp: { type: Date, required: true },
  address: { type: String, default: '' }
}, { _id: false });

// Hourly stats schema
const HourlyStatsSchema = new mongoose.Schema({
  hour: { type: Number, required: true, min: 0, max: 23 },
  adPlays: { type: Number, default: 0 },
  qrScans: { type: Number, default: 0 },
  distanceTraveled: { type: Number, default: 0 },
  hoursOnline: { type: Number, default: 0 },
  averageSpeed: { type: Number, default: 0 },
  maxSpeed: { type: Number, default: 0 },
  locationCount: { type: Number, default: 0 },
  activity: { type: Number, default: 0 }
}, { _id: false });

// Ad performance schema
const AdPerformanceSchema = new mongoose.Schema({
  adId: { type: String, required: true },
  userId: { type: String, required: true, index: true },
  adTitle: { type: String, required: true },
  playCount: { type: Number, default: 0 },
  totalViewTime: { type: Number, default: 0 },
  averageViewTime: { type: Number, default: 0 },
  completionRate: { type: Number, default: 0 },
  firstPlayed: { type: Date },
  lastPlayed: { type: Date },
  impressions: { type: Number, default: 0 }
}, { _id: false });

// Daily summary schema
const DailySummarySchema = new mongoose.Schema({
  totalAdPlays: { type: Number, default: 0 },
  totalQRScans: { type: Number, default: 0 },
  totalDistanceTraveled: { type: Number, default: 0 },
  totalHoursOnline: { type: Number, default: 0 },
  averageSpeed: { type: Number, default: 0 },
  maxSpeed: { type: Number, default: 0 },
  complianceRate: { type: Number, default: 0 },
  adCompletionRate: { type: Number, default: 0 },
  totalAdImpressions: { type: Number, default: 0 },
  totalAdPlayTime: { type: Number, default: 0 }
}, { _id: false });

// Hours tracking schema
const HoursTrackingSchema = new mongoose.Schema({
  deviceTimezone: { type: String, default: 'Asia/Manila' },
  sessionStartTime: { type: Date },
  sessionEndTime: { type: Date },
  lastOnlineUpdate: { type: Date },
  offlinePeriods: [{
    startTime: { type: Date },
    endTime: { type: Date },
    duration: { type: Number, default: 0 }
  }],
  complianceStatus: { 
    type: String, 
    enum: ['COMPLIANT', 'NON_COMPLIANT', 'PENDING'],
    default: 'PENDING'
  },
  targetHours: { type: Number, default: 8 },
  precision: { type: String, default: '30s' },
  totalOnlineHours: { type: Number, default: 0 }
}, { _id: false });

// Daily data schema (for the array)
const DailyDataSchema = new mongoose.Schema({
  date: { 
    type: Date, 
    required: true,
    index: true
  },
  
  // Daily totals
  totalAdPlays: { type: Number, default: 0 },
  totalQRScans: { type: Number, default: 0 },
  totalDistanceTraveled: { type: Number, default: 0 },
  totalHoursOnline: { type: Number, default: 0 },
  totalAdImpressions: { type: Number, default: 0 },
  totalAdPlayTime: { type: Number, default: 0 },
  
  // Enhanced hours tracking
  hoursTracking: HoursTrackingSchema,
  
  // Daily summary
  dailySummary: DailySummarySchema,
  
  // Hourly breakdown
  hourlyStats: [HourlyStatsSchema],
  
  // Location data (limited to 14400 entries for 8 hours at 2s intervals)
  locationHistory: [LocationPointSchema],
  
  // Ad performance
  adPerformance: [AdPerformanceSchema],
  
  // QR scan details
  qrScans: [{
    adId: { type: String, required: true },
    userId: { type: String, required: false }, // Optional until migration runs
    adTitle: { type: String, required: true },
    materialId: { type: String, required: true },
    slotNumber: { type: Number, required: true, min: 1, max: 5 },
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
    address: { type: String }, // Geocoded address from GPS coordinates
    timeOnPage: { type: Number, default: 0 },
    converted: { type: Boolean, default: false },
    conversionType: { type: String },
    conversionValue: { type: Number, default: 0 }
  }],
  
  // Ad playback details (limited to 800 entries)
  adPlaybacks: [{
    adId: { type: String, required: true },
    userId: { type: String, required: false }, // Optional until migration runs
    adTitle: { type: String, required: true },
    materialId: { type: String, required: true },
    slotNumber: { type: Number, required: true, min: 1, max: 5 },
    adDuration: { type: Number, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    viewTime: { type: Number, default: 0 },
    completionRate: { type: Number, default: 0 },
    impressions: { type: Number, default: 1 }
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
    offlineIncidents: { type: Number, default: 0 },
    displayIssues: { type: Number, default: 0 }
  },
  
  // Basic vehicle display status
  isDisplaying: { type: Boolean, default: true },
  maintenanceMode: { type: Boolean, default: false },
  
  // QR scans per ad
  qrScansByAd: [{
    adId: { type: String, required: true },
    userId: { type: String, required: false }, // Optional until migration runs
    adTitle: { type: String, required: true },
    scanCount: { type: Number, default: 0 },
    lastScanned: { type: Date },
    firstScanned: { type: Date }
  }],
  
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
    deploymentId: { type: String }
  }],
  
  // Reference to current deployment
  currentDeploymentId: { type: String },
  lastDeploymentSync: { type: Date },
  
  // Metadata
  archivedAt: { type: Date, default: Date.now },
  dataSource: { type: String, default: 'deviceTracking' },
  version: { type: String, default: '4.0' },
  
  // Enhanced tracking timestamps
  lastDataUpdate: { type: Date, default: Date.now },
  lastArchiveUpdate: { type: Date, default: Date.now },
  updateCount: { type: Number, default: 1 },
  lastUpdateSource: { type: String, default: 'initial' },
  lastUpdateType: { type: String, default: 'create' }
}, { 
  _id: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add virtual property for better display in UI
DailyDataSchema.virtual('displayLabel').get(function() {
  if (this.date) {
    const dateStr = this.date.toISOString().split('T')[0];
    return `${dateStr} (${this.totalAdPlays || 0} plays, ${this.locationHistory?.length || 0} locs)`;
  }
  return 'Unknown Date';
});

// Add toString method for better console display
DailyDataSchema.methods.toString = function() {
  if (this.date) {
    const dateStr = this.date.toISOString().split('T')[0];
    return `${dateStr} (${this.totalAdPlays || 0} plays, ${this.locationHistory?.length || 0} locs)`;
  }
  return 'Unknown Date';
};

// Main DeviceDataHistoryV2 Schema
const DeviceDataHistoryV2Schema = new mongoose.Schema({
  // Material identification (unique per material)
  materialId: { 
    type: String, 
    required: true,
    unique: true // Unique constraint automatically creates an index, no need for 'index: true'
  },
  carGroupId: { 
    type: String, 
    required: true
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
  
  // Array of daily data
  dailyData: [DailyDataSchema],
  
  // Lifetime totals (aggregated from dailyData)
  lifetimeTotals: {
    totalAdPlays: { type: Number, default: 0 },
    totalQRScans: { type: Number, default: 0 },
    totalDistanceTraveled: { type: Number, default: 0 },
    totalHoursOnline: { type: Number, default: 0 },
    totalAdImpressions: { type: Number, default: 0 },
    totalAdPlayTime: { type: Number, default: 0 },
    totalDays: { type: Number, default: 0 },
    averageDailyHours: { type: Number, default: 0 },
    complianceRate: { type: Number, default: 0 }
  },
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastDataUpdate: { type: Date, default: Date.now },
  lastArchiveUpdate: { type: Date, default: Date.now },
  totalUpdates: { type: Number, default: 0 }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
// Note: materialId already has a unique index from schema definition, no need to index again
DeviceDataHistoryV2Schema.index({ carGroupId: 1 });
DeviceDataHistoryV2Schema.index({ updatedAt: -1 });
DeviceDataHistoryV2Schema.index({ 'dailyData.date': -1 });
DeviceDataHistoryV2Schema.index({ 'dailyData.date': 1, materialId: 1 });
DeviceDataHistoryV2Schema.index({ materialId: 1, carGroupId: 1 }); // Composite for search
// Indexes to support userId-scoped analytics queries
DeviceDataHistoryV2Schema.index({ 'dailyData.adPerformance.userId': 1, 'dailyData.date': 1 });
DeviceDataHistoryV2Schema.index({ 'dailyData.qrScans.userId': 1, 'dailyData.date': 1 });
DeviceDataHistoryV2Schema.index({ 'dailyData.adPlaybacks.userId': 1, 'dailyData.date': 1 });
// ✅ NEW: Index for ad-specific analytics queries (CRITICAL for fast ad analytics)
DeviceDataHistoryV2Schema.index({ 'dailyData.adPlaybacks.adId': 1 });
DeviceDataHistoryV2Schema.index({ 'dailyData.qrScansByAd.adId': 1 });
DeviceDataHistoryV2Schema.index({ materialId: 1, 'dailyData.adPlaybacks.adId': 1 }); // Compound for multi-material ad queries

// Virtual field: Get latest daily data
DeviceDataHistoryV2Schema.virtual('latestDailyData').get(function() {
  if (this.dailyData && this.dailyData.length > 0) {
    return this.dailyData.sort((a, b) => b.date - a.date)[0];
  }
  return null;
});

// Virtual field: Get date range
DeviceDataHistoryV2Schema.virtual('dateRange').get(function() {
  if (this.dailyData && this.dailyData.length > 0) {
    const sorted = this.dailyData.sort((a, b) => a.date - b.date);
    return {
      start: sorted[0].date,
      end: sorted[sorted.length - 1].date,
      days: this.dailyData.length
    };
  }
  return null;
});

// Static methods
DeviceDataHistoryV2Schema.statics.getDailyData = function(materialId, date) {
  return this.findOne(
    { 
      materialId,
      'dailyData.date': new Date(date)
    },
    { 'dailyData.$': 1 }
  );
};

DeviceDataHistoryV2Schema.statics.getDateRange = function(materialId, startDate, endDate) {
  return this.findOne(
    { 
      materialId,
      'dailyData.date': {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    },
    { 
      dailyData: {
        $filter: {
          input: '$dailyData',
          cond: {
            $and: [
              { $gte: ['$$this.date', new Date(startDate)] },
              { $lte: ['$$this.date', new Date(endDate)] }
            ]
          }
        }
      }
    }
  );
};

// Instance methods
DeviceDataHistoryV2Schema.methods.addDailyData = function(dailyData) {
  // Check if data for this date already exists
  const existingIndex = this.dailyData.findIndex(d => 
    d.date.toDateString() === dailyData.date.toDateString()
  );
  
  if (existingIndex >= 0) {
    // Update existing daily data
    this.dailyData[existingIndex] = dailyData;
  } else {
    // Add new daily data
    this.dailyData.push(dailyData);
  }
  
  // Sort by date
  this.dailyData.sort((a, b) => a.date - b.date);
  
  // Update lifetime totals
  this.updateLifetimeTotals();
  
  return this;
};

DeviceDataHistoryV2Schema.methods.updateLifetimeTotals = function() {
  if (this.dailyData && this.dailyData.length > 0) {
    // ✅ FIXED: Calculate compliance rate based on days with 8+ hours
    const compliantDays = this.dailyData.filter(day => {
      // Check if day has hoursTracking with COMPLIANT status
      if (day.hoursTracking && day.hoursTracking.complianceStatus === 'COMPLIANT') {
        return true;
      }
      // Fallback: check if totalHoursOnline >= 8
      return (day.totalHoursOnline || 0) >= 8;
    }).length;
    
    const totalDays = this.dailyData.length;
    const compliancePercentage = totalDays > 0 ? (compliantDays / totalDays) * 100 : 0;
    
    this.lifetimeTotals = {
      totalAdPlays: this.dailyData.reduce((sum, day) => sum + (day.totalAdPlays || 0), 0),
      totalQRScans: this.dailyData.reduce((sum, day) => sum + (day.totalQRScans || 0), 0),
      totalDistanceTraveled: this.dailyData.reduce((sum, day) => sum + (day.totalDistanceTraveled || 0), 0),
      totalHoursOnline: this.dailyData.reduce((sum, day) => sum + (day.totalHoursOnline || 0), 0),
      totalAdImpressions: this.dailyData.reduce((sum, day) => sum + (day.totalAdImpressions || 0), 0),
      totalAdPlayTime: this.dailyData.reduce((sum, day) => sum + (day.totalAdPlayTime || 0), 0),
      totalDays: totalDays,
      averageDailyHours: this.dailyData.reduce((sum, day) => sum + (day.totalHoursOnline || 0), 0) / totalDays,
      complianceRate: Math.round(compliancePercentage * 100) / 100 // ✅ Fixed: % of days meeting 8-hour target
    };
  }
  
  return this;
};

// Post-save hook to trigger real-time salary updates when tracking data changes
DeviceDataHistoryV2Schema.post('save', async function(doc) {
  try {
    // Only trigger salary updates for significant data changes
    if (this.isModified('dailyData') || this.isModified('lifetimeTotals')) {
      console.log(`💰 DeviceDataHistoryV2 data changed for ${this.materialId}, triggering salary update...`);
      
      // Import and trigger salary update (use setTimeout to avoid blocking the save operation)
      setTimeout(async () => {
        try {
          const realTimeSalaryUpdateService = require('../services/realTimeSalaryUpdateService');
          
          // Get the latest daily data date
          if (this.dailyData && this.dailyData.length > 0) {
            const latestDailyData = this.dailyData.sort((a, b) => b.date - a.date)[0];
            const dateStr = latestDailyData.date.toISOString().split('T')[0];
            
            await realTimeSalaryUpdateService.updateSalaryCalculations(this.materialId, dateStr);
            console.log(`✅ Real-time salary update triggered for ${this.materialId} on ${dateStr}`);
          }
        } catch (error) {
          console.error(`❌ Real-time salary update failed for ${this.materialId}:`, error.message);
        }
      }, 2000); // 2 second delay to ensure save is complete
    }
  } catch (error) {
    console.error('❌ Error in DeviceDataHistoryV2 post-save hook:', error.message);
  }
});

// ⚡ PERFORMANCE INDEXES - Critical for fast analytics queries
// Note: 'dailyData.date' already indexed at line 302, removed duplicate
DeviceDataHistoryV2Schema.index({ 'dailyData.adPerformance.userId': 1 }); // User filter
DeviceDataHistoryV2Schema.index({ 'dailyData.adPerformance.adId': 1 }); // Ad filter
DeviceDataHistoryV2Schema.index({ 
  'dailyData.date': 1, 
  'dailyData.adPerformance.userId': 1 
}); // Compound: Date + User (most common query)
DeviceDataHistoryV2Schema.index({ 
  'dailyData.date': 1, 
  'dailyData.adPerformance.userId': 1,
  'dailyData.adPerformance.adId': 1
}); // Compound: Date + User + Ad (filtered query)

module.exports = mongoose.model('DeviceDataHistoryV2', DeviceDataHistoryV2Schema);
