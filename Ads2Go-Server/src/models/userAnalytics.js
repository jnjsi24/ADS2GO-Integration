const mongoose = require('mongoose');

// Ad analytics schema for individual ads within a user's analytics
const AdAnalyticsSchema = new mongoose.Schema({
  adId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Ad',
    required: true
  },
  adTitle: {
    type: String,
    required: true
  },
  adDeploymentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'AdsDeployment'
  },
  
  // Materials array - each ad can have multiple materials
  materials: [{
    materialId: { 
      type: String, 
      required: true
    },
    materialType: { 
      type: String, 
      default: 'HEADDRESS' 
    },
    slotNumber: { 
      type: Number, 
      required: true 
    },
    deviceId: { 
      type: String, 
      required: true 
    },
    carGroupId: { 
      type: String 
    },
    driverId: { 
      type: String 
    },
    isOnline: { 
      type: Boolean, 
      default: false 
    },
    currentLocation: {
      type: { type: String, default: 'Point' },
      coordinates: { type: [Number] },
      accuracy: { type: Number, default: 0 },
      altitude: { type: Number, default: 0 },
      speed: { type: Number, default: 0 },
      heading: { type: Number, default: 0 },
      timestamp: { type: Date, default: Date.now },
      address: { type: String, default: '' }
    },
    networkStatus: {
      isOnline: { type: Boolean, default: false },
      lastSeen: { type: Date, default: Date.now }
    },
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
    
    // Ad playback data
    adPlaybacks: [{
      adId: { type: String, required: true },
      adTitle: { type: String, required: true },
      startTime: { type: Date, required: true },
      endTime: { type: Date },
      viewTime: { type: Number, default: 0 },
      completionRate: { type: Number, default: 0 },
      impressions: { type: Number, default: 0 },
      slotNumber: { type: Number },
      isOffline: { type: Boolean, default: false },
      queuedTimestamp: { type: Date }
    }],
    
    // QR scan data
    qrScans: [{
      adId: { type: String, required: true },
      adTitle: { type: String, required: true },
      scanTimestamp: { type: Date, required: true },
      qrCode: { type: String },
      location: {
        type: { type: String, default: 'Point' },
        coordinates: { type: [Number] },
        accuracy: { type: Number, default: 0 },
        address: { type: String, default: '' }
      },
      isOffline: { type: Boolean, default: false },
      queuedTimestamp: { type: Date }
    }],
    
    // Aggregated metrics for this material
    totalAdPlayTime: { type: Number, default: 0 },
    totalAdImpressions: { type: Number, default: 0 },
    averageAdCompletionRate: { type: Number, default: 0 },
    currentAd: {
      adId: { type: String },
      adTitle: { type: String },
      slotNumber: { type: Number },
      startTime: { type: Date }
    },
    totalQRScans: { type: Number, default: 0 },
    qrScanConversionRate: { type: Number, default: 0 },
    lastQRScan: { type: Date },
    qrScansByAd: [{
      adId: { type: String, required: true },
      adTitle: { type: String, required: true },
      scanCount: { type: Number, default: 0 },
      firstScanned: { type: Date },
      lastScanned: { type: Date }
    }],
    
    // Location and movement data
    totalDistanceTraveled: { type: Number, default: 0 },
    averageSpeed: { type: Number, default: 0 },
    maxSpeed: { type: Number, default: 0 },
    uptimePercentage: { type: Number, default: 0 },
    complianceRate: { type: Number, default: 0 },
    averageDailyHours: { type: Number, default: 0 },
    
    // Interaction data
    totalInteractions: { type: Number, default: 0 },
    totalScreenTaps: { type: Number, default: 0 },
    totalDebugActivations: { type: Number, default: 0 },
    
    // Daily sessions for this material
    dailySessions: [{
      date: { type: Date, required: true },
      startTime: { type: Date },
      endTime: { type: Date },
      totalHours: { type: Number, default: 0 },
      adPlays: { type: Number, default: 0 },
      qrScans: { type: Number, default: 0 },
      distanceTraveled: { type: Number, default: 0 },
      averageSpeed: { type: Number, default: 0 },
      maxSpeed: { type: Number, default: 0 },
      uptimePercentage: { type: Number, default: 0 },
      complianceRate: { type: Number, default: 0 }
    }],
    
    // Location history for this material
    locationHistory: [{
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
    }],
    
    // Network status for this material
    networkStatus: {
      isOnline: { type: Boolean, default: false },
      lastSeen: { type: Date, default: Date.now },
      connectionType: { type: String },
      signalStrength: { type: Number }
    },
    
    // Device information for this material
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
    
    // System fields
    isActive: { type: Boolean, default: true },
    lastSeen: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  }],
  
  // Ad-level aggregated analytics
  totalMaterials: { type: Number, default: 0 },
  totalDevices: { type: Number, default: 0 },
  totalAdPlayTime: { type: Number, default: 0 },
  totalAdImpressions: { type: Number, default: 0 },
  totalQRScans: { type: Number, default: 0 },
  averageAdCompletionRate: { type: Number, default: 0 },
  qrScanConversionRate: { type: Number, default: 0 },
  
  // Ad performance by material
  materialPerformance: [{
    materialId: { type: String, required: true },
    slotNumber: { type: Number, required: true },
    materialName: { type: String },
    totalDevices: { type: Number, default: 0 },
    onlineDevices: { type: Number, default: 0 },
    totalAdPlayTime: { type: Number, default: 0 },
    totalAdImpressions: { type: Number, default: 0 },
    totalQRScans: { type: Number, default: 0 },
    averageCompletionRate: { type: Number, default: 0 },
    lastActivity: { type: Date }
  }],
  
  // Error logs for this ad
  errorLogs: [{
    timestamp: { type: Date, default: Date.now },
    level: { type: String, enum: ['error', 'warning', 'info'], default: 'error' },
    message: { type: String, required: true },
    materialId: { type: String },
    deviceId: { type: String },
    stack: { type: String }
  }],
  
  // System fields
  isActive: { type: Boolean, default: true },
  lastUpdated: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { _id: true });

// Add virtual for display label
AdAnalyticsSchema.virtual('displayLabel').get(function() {
  return `${this.adTitle} (${this.totalMaterials} materials, ${this.totalAdImpressions} impressions)`;
});

// Add toString method for better console display
AdAnalyticsSchema.methods.toString = function() {
  return `${this.adTitle} (${this.totalMaterials} materials, ${this.totalAdImpressions} impressions)`;
};

// Main UserAnalytics Schema - groups all ads by user
const UserAnalyticsSchema = new mongoose.Schema({
  // User reference
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  
  // Array of ads for this user
  ads: [AdAnalyticsSchema],
  
  // User-level aggregated analytics
  totalAds: { type: Number, default: 0 },
  totalMaterials: { type: Number, default: 0 },
  totalDevices: { type: Number, default: 0 },
  totalAdPlayTime: { type: Number, default: 0 },
  totalAdImpressions: { type: Number, default: 0 },
  totalQRScans: { type: Number, default: 0 },
  averageAdCompletionRate: { type: Number, default: 0 },
  qrScanConversionRate: { type: Number, default: 0 },
  
  // User performance by ad
  adPerformance: [{
    adId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ad', required: true },
    adTitle: { type: String, required: true },
    totalMaterials: { type: Number, default: 0 },
    totalDevices: { type: Number, default: 0 },
    totalAdPlayTime: { type: Number, default: 0 },
    totalAdImpressions: { type: Number, default: 0 },
    totalQRScans: { type: Number, default: 0 },
    averageCompletionRate: { type: Number, default: 0 },
    lastActivity: { type: Date }
  }],
  
  // Error logs for this user
  errorLogs: [{
    timestamp: { type: Date, default: Date.now },
    level: { type: String, enum: ['error', 'warning', 'info'], default: 'error' },
    message: { type: String, required: true },
    adId: { type: String },
    materialId: { type: String },
    deviceId: { type: String },
    stack: { type: String }
  }],
  
  // System fields
  isActive: { type: Boolean, default: true },
  lastUpdated: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add virtual for display label
UserAnalyticsSchema.virtual('displayLabel').get(function() {
  return `User ${this.userId} (${this.totalAds} ads, ${this.totalAdImpressions} impressions)`;
});

// Add toString method for better console display
UserAnalyticsSchema.methods.toString = function() {
  return `User ${this.userId} (${this.totalAds} ads, ${this.totalAdImpressions} impressions)`;
};

// Indexes for efficient queries
UserAnalyticsSchema.index({ userId: 1 });
UserAnalyticsSchema.index({ 'ads.adId': 1 });
UserAnalyticsSchema.index({ 'ads.materials.materialId': 1 });
UserAnalyticsSchema.index({ lastUpdated: -1 });
UserAnalyticsSchema.index({ createdAt: -1 });

// Static methods for creating and managing user analytics
UserAnalyticsSchema.statics.createOrUpdateUserAnalytics = async function(userId, adId, adTitle, materialId, slotNumber, deviceId, additionalData = {}) {
  // Find existing user analytics document
  let userAnalytics = await this.findOne({ userId });
  
  if (!userAnalytics) {
    // Create new user analytics document
    userAnalytics = new this({
      userId,
      ads: [],
      totalAds: 0,
      totalMaterials: 0,
      totalDevices: 0,
      totalAdPlayTime: 0,
      totalAdImpressions: 0,
      totalQRScans: 0,
      averageAdCompletionRate: 0,
      qrScanConversionRate: 0,
      adPerformance: [],
      isActive: true
    });
  }
  
  // Find or create ad analytics
  let adAnalytics = userAnalytics.ads.find(ad => ad.adId.toString() === adId.toString());
  
  if (!adAnalytics) {
    // Create new ad analytics
    adAnalytics = {
      adId,
      adTitle,
      adDeploymentId: additionalData.adDeploymentId || null,
      materials: [],
      totalMaterials: 0,
      totalDevices: 0,
      totalAdPlayTime: 0,
      totalAdImpressions: 0,
      totalQRScans: 0,
      averageAdCompletionRate: 0,
      qrScanConversionRate: 0,
      materialPerformance: [],
      errorLogs: [],
      isActive: true,
      lastUpdated: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    userAnalytics.ads.push(adAnalytics);
  }
  
  // Add or update material data
  const materialData = {
    materialId,
    materialType: additionalData.materialType || 'HEADDRESS',
    slotNumber,
    deviceId,
    carGroupId: additionalData.carGroupId || null,
    driverId: additionalData.driverId || null,
    isOnline: additionalData.isOnline || false,
    currentLocation: additionalData.currentLocation || null,
    networkStatus: additionalData.networkStatus || { isOnline: false, lastSeen: new Date() },
    deviceInfo: additionalData.deviceInfo || null,
    adPlaybacks: [],
    totalAdPlayTime: 0,
    totalAdImpressions: 0,
    averageAdCompletionRate: 0,
    currentAd: null,
    qrScans: [],
    totalQRScans: 0,
    qrScanConversionRate: 0,
    lastQRScan: null,
    qrScansByAd: [],
    totalDistanceTraveled: 0,
    averageSpeed: 0,
    maxSpeed: 0,
    uptimePercentage: 0,
    complianceRate: 0,
    averageDailyHours: 0,
    totalInteractions: 0,
    totalScreenTaps: 0,
    totalDebugActivations: 0,
    dailySessions: [],
    locationHistory: [],
    isActive: true,
    lastSeen: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  // Add or update material
  await userAnalytics.addMaterial(adId, materialData);
  
  return userAnalytics;
};

// Instance methods
UserAnalyticsSchema.methods.addMaterial = async function(adId, materialData) {
  const adIndex = this.ads.findIndex(ad => ad.adId.toString() === adId.toString());
  
  if (adIndex >= 0) {
    const materialIndex = this.ads[adIndex].materials.findIndex(m => m.materialId === materialData.materialId);
    
    if (materialIndex >= 0) {
      // Update existing material
      this.ads[adIndex].materials[materialIndex] = materialData;
    } else {
      // Add new material
      this.ads[adIndex].materials.push(materialData);
    }
    
    // Update ad totals
    this.ads[adIndex].totalMaterials = this.ads[adIndex].materials.length;
    this.ads[adIndex].updatedAt = new Date();
  }
  
  // Update user totals
  this.updateUserTotals();
  this.updatedAt = new Date();
  
  await this.save();
};

UserAnalyticsSchema.methods.updateUserTotals = function() {
  this.totalAds = this.ads.length;
  this.totalMaterials = this.ads.reduce((sum, ad) => sum + ad.totalMaterials, 0);
  this.totalDevices = this.ads.reduce((sum, ad) => sum + ad.totalDevices, 0);
  this.totalAdPlayTime = this.ads.reduce((sum, ad) => sum + ad.totalAdPlayTime, 0);
  this.totalAdImpressions = this.ads.reduce((sum, ad) => sum + ad.totalAdImpressions, 0);
  this.totalQRScans = this.ads.reduce((sum, ad) => sum + ad.totalQRScans, 0);
  
  // Calculate averages
  this.averageAdCompletionRate = this.ads.length > 0 
    ? this.ads.reduce((sum, ad) => sum + ad.averageAdCompletionRate, 0) / this.ads.length 
    : 0;
  
  this.qrScanConversionRate = this.totalAdImpressions > 0 
    ? (this.totalQRScans / this.totalAdImpressions) * 100 
    : 0;
};

module.exports = mongoose.model('UserAnalytics', UserAnalyticsSchema);
