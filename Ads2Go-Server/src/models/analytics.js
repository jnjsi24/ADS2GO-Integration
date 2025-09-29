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
  materialId: { type: String, required: false }, // Made optional for backward compatibility
  slotNumber: { type: Number, required: false }, // Made optional for backward compatibility
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
  location: LocationSchema,
  timeOnPage: { type: Number, default: 0 },
  converted: { type: Boolean, default: false },
  conversionType: { type: String },
  conversionValue: { type: Number, default: 0 },
  // Additional fields from Android player
  deviceInfo: { type: mongoose.Schema.Types.Mixed },
  gpsData: { type: mongoose.Schema.Types.Mixed },
  registrationData: { type: mongoose.Schema.Types.Mixed },
  networkStatus: { type: mongoose.Schema.Types.Mixed },
  isOffline: { type: Boolean, default: false },
  screenData: { type: mongoose.Schema.Types.Mixed },
  metadata: { type: mongoose.Schema.Types.Mixed }
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

// Location History Schema
const LocationHistorySchema = new mongoose.Schema({
  location: LocationSchema,
  timestamp: { type: Date, default: Date.now },
  eventType: { type: String, enum: ['GPS_UPDATE', 'MANUAL_UPDATE', 'SYSTEM_UPDATE'] }
}, { _id: false });

// Material Analytics Schema - for tracking individual material performance
const MaterialAnalyticsSchema = new mongoose.Schema({
  materialId: { 
    type: String, 
    required: true,
    index: true
  },
  materialType: {
    type: String, 
    enum: ['POSTER', 'LCD', 'STICKER', 'HEADDRESS', 'BANNER'],
    required: true,
    index: true
  },
  slotNumber: { 
    type: Number, 
    required: true,
    min: 1,
    max: 5, // LCD can have up to 5 slots, others will be validated in application logic
    index: true
  },
  deviceId: { 
    type: String, 
    required: true,
    index: true
  },
  carGroupId: { 
    type: String,
    index: true
  },
  driverId: { 
    type: String,
    index: true
  },
  isOnline: { type: Boolean, default: false },
  currentLocation: LocationSchema,
  
  // Ad Playback Analytics for this material
  adPlaybacks: [AdPlaybackSchema],
  totalAdPlayTime: { type: Number, default: 0 },
  totalAdImpressions: { type: Number, default: 0 },
  averageAdCompletionRate: { type: Number, default: 0 },
  currentAd: AdPlaybackSchema,
  
  // QR Scan Analytics for this material
  qrScans: [QRScanSchema],
  totalQRScans: { type: Number, default: 0 },
  qrScanConversionRate: { type: Number, default: 0 },
  lastQRScan: { type: Date },
  
  // QR Scans per specific ad for this material
  qrScansByAd: [{
    adId: { type: String, required: true },
    adTitle: { type: String, required: true },
    scanCount: { type: Number, default: 0 },
    lastScanned: { type: Date },
    firstScanned: { type: Date }
  }],
  
  // Location and Movement Analytics for this material
  totalDistanceTraveled: { type: Number, default: 0 },
  averageSpeed: { type: Number, default: 0 },
  maxSpeed: { type: Number, default: 0 },
  uptimePercentage: { type: Number, default: 0 },
  complianceRate: { type: Number, default: 0 },
  averageDailyHours: { type: Number, default: 0 },
  
  // Interaction Analytics for this material
  totalInteractions: { type: Number, default: 0 },
  totalScreenTaps: { type: Number, default: 0 },
  totalDebugActivations: { type: Number, default: 0 },
  
  // Daily Sessions for this material
  dailySessions: [DailySessionSchema],
  
  // Location History for this material
  locationHistory: [LocationHistorySchema],
  
  // Network Status for this material
  networkStatus: NetworkStatusSchema,
  
  // Device Information for this material
  deviceInfo: DeviceInfoSchema,
  
  // System Fields
  isActive: { type: Boolean, default: true },
  lastSeen: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { _id: true });

// Main Analytics Schema - now focused on ad-level analytics
const AnalyticsSchema = new mongoose.Schema({
  // Ad and User References
  adId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Ad',
    required: true,
    index: true
  },
  adTitle: {
    type: String,
    required: true
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
  
  // Materials array - each ad can have multiple materials
  materials: [MaterialAnalyticsSchema],
  
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
AnalyticsSchema.index({ adId: 1, lastUpdated: -1 });
AnalyticsSchema.index({ userId: 1, lastUpdated: -1 });
AnalyticsSchema.index({ adDeploymentId: 1, lastUpdated: -1 });
AnalyticsSchema.index({ 'materials.materialId': 1 });
AnalyticsSchema.index({ 'materials.deviceId': 1 });
AnalyticsSchema.index({ 'materials.slotNumber': 1 });
AnalyticsSchema.index({ 'materials.driverId': 1 });
AnalyticsSchema.index({ 'materials.isOnline': 1 });
AnalyticsSchema.index({ 'materials.currentLocation.coordinates': '2dsphere' });
AnalyticsSchema.index({ 'materials.adPlaybacks.adId': 1 });
AnalyticsSchema.index({ 'materials.qrScans.adId': 1 });

// Virtual for online devices across all materials
AnalyticsSchema.virtual('onlineDevices').get(function() {
  return this.materials.filter(material => material.isOnline).length;
});

// Methods for ad-level analytics
AnalyticsSchema.methods.addMaterial = function(materialData) {
  // Check if material already exists
  const existingMaterial = this.materials.find(m => 
    m.materialId === materialData.materialId && 
    m.slotNumber === materialData.slotNumber
  );
  
  if (existingMaterial) {
    // Update existing material - preserve analytics data
    const preservedData = {
      totalQRScans: existingMaterial.totalQRScans || 0,
      totalAdPlayTime: existingMaterial.totalAdPlayTime || 0,
      totalAdImpressions: existingMaterial.totalAdImpressions || 0,
      averageAdCompletionRate: existingMaterial.averageAdCompletionRate || 0,
      qrScanConversionRate: existingMaterial.qrScanConversionRate || 0,
      lastQRScan: existingMaterial.lastQRScan,
      qrScans: existingMaterial.qrScans || [],
      qrScansByAd: existingMaterial.qrScansByAd || [],
      adPlaybacks: existingMaterial.adPlaybacks || [],
      totalDistanceTraveled: existingMaterial.totalDistanceTraveled || 0,
      averageSpeed: existingMaterial.averageSpeed || 0,
      maxSpeed: existingMaterial.maxSpeed || 0,
      uptimePercentage: existingMaterial.uptimePercentage || 0,
      complianceRate: existingMaterial.complianceRate || 0,
      averageDailyHours: existingMaterial.averageDailyHours || 0,
      totalInteractions: existingMaterial.totalInteractions || 0,
      totalScreenTaps: existingMaterial.totalScreenTaps || 0,
      totalDebugActivations: existingMaterial.totalDebugActivations || 0,
      dailySessions: existingMaterial.dailySessions || [],
      locationHistory: existingMaterial.locationHistory || [],
      lastSeen: existingMaterial.lastSeen || new Date(),
      createdAt: existingMaterial.createdAt || new Date()
    };
    
    // Merge new data with preserved analytics data
    Object.assign(existingMaterial, materialData, preservedData);
  } else {
    // Add new material
    this.materials.push(materialData);
  }
  
  // Update aggregated stats
  this.updateAggregatedStats();
  
  return this.save();
};

AnalyticsSchema.methods.updateMaterial = function(materialId, slotNumber, updateData) {
  const material = this.materials.find(m => 
    m.materialId === materialId && m.slotNumber === slotNumber
  );
  
  if (material) {
    Object.assign(material, updateData);
    this.updateAggregatedStats();
    return this.save();
  }
  
  return Promise.reject(new Error('Material not found'));
};

AnalyticsSchema.methods.addAdPlayback = function(materialId, slotNumber, adId, adTitle, adDuration, viewTime = 0) {
  const material = this.materials.find(m => 
    m.materialId === materialId && m.slotNumber === slotNumber
  );
  
  if (!material) {
    return Promise.reject(new Error('Material not found'));
  }
  
  const playback = {
    adId,
    adTitle,
    adDuration,
    startTime: new Date(),
    endTime: new Date(Date.now() + adDuration * 1000),
    viewTime,
    completionRate: adDuration > 0 ? Math.min(100, (viewTime / adDuration) * 100) : 0,
    impressions: 1,
    slotNumber: slotNumber
  };
  
  material.adPlaybacks.push(playback);
  material.currentAd = playback;
  material.totalAdImpressions += 1;
  material.totalAdPlayTime += viewTime;
  
  // Update average completion rate for this material
  const totalCompletion = material.adPlaybacks.reduce((sum, ad) => sum + ad.completionRate, 0);
  material.averageAdCompletionRate = material.adPlaybacks.length > 0 ? totalCompletion / material.adPlaybacks.length : 0;
  
  // Update aggregated stats
  this.updateAggregatedStats();
  
  return this.save();
};

AnalyticsSchema.methods.addQRScan = function(materialId, slotNumber, qrScanData) {
  const material = this.materials.find(m => 
    m.materialId === materialId && m.slotNumber === slotNumber
  );
  
  if (!material) {
    return Promise.reject(new Error('Material not found'));
  }
  
  material.qrScans.push(qrScanData);
  material.totalQRScans += 1;
  material.lastQRScan = new Date();
  
  // Update QR scans per specific ad for this material
  const existingAdScan = material.qrScansByAd.find(scan => scan.adId === qrScanData.adId);
  if (existingAdScan) {
    existingAdScan.scanCount += 1;
    existingAdScan.lastScanned = new Date();
  } else {
    material.qrScansByAd.push({
      adId: qrScanData.adId,
      adTitle: qrScanData.adTitle,
      scanCount: 1,
      lastScanned: new Date(),
      firstScanned: new Date()
    });
  }
  
  // Update aggregated stats
  this.updateAggregatedStats();
  
  return this.save();
};

AnalyticsSchema.methods.updateAggregatedStats = function() {
  // Update material performance array
  this.materialPerformance = this.materials.map(material => {
    // Ensure we're accessing the material properties correctly
    const materialId = material.materialId || material._doc?.materialId;
    const slotNumber = material.slotNumber || material._doc?.slotNumber;
    const totalQRScans = material.totalQRScans || material._doc?.totalQRScans || 0;
    const totalAdPlayTime = material.totalAdPlayTime || material._doc?.totalAdPlayTime || 0;
    const totalAdImpressions = material.totalAdImpressions || material._doc?.totalAdImpressions || 0;
    const averageAdCompletionRate = material.averageAdCompletionRate || material._doc?.averageAdCompletionRate || 0;
    const isOnline = material.isOnline || material._doc?.isOnline || false;
    const lastSeen = material.lastSeen || material._doc?.lastSeen || new Date();
    
    return {
      materialId: materialId,
      slotNumber: slotNumber,
      materialName: `${materialId}-SLOT-${slotNumber}`,
      totalDevices: 1, // Each material entry represents one device
      onlineDevices: isOnline ? 1 : 0,
      totalAdPlayTime: totalAdPlayTime,
      totalAdImpressions: totalAdImpressions,
      totalQRScans: totalQRScans,
      averageCompletionRate: averageAdCompletionRate,
      lastActivity: lastSeen
    };
  });
  
  // Update ad-level aggregated stats
  this.totalMaterials = this.materials.length;
  this.totalDevices = this.materials.length;
  this.totalAdPlayTime = this.materials.reduce((total, material) => total + (material.totalAdPlayTime || 0), 0);
  this.totalAdImpressions = this.materials.reduce((total, material) => total + (material.totalAdImpressions || 0), 0);
  this.totalQRScans = this.materials.reduce((total, material) => total + (material.totalQRScans || 0), 0);
  
  const totalCompletion = this.materials.reduce((total, material) => total + (material.averageAdCompletionRate || 0), 0);
  this.averageAdCompletionRate = this.materials.length > 0 ? totalCompletion / this.materials.length : 0;
  
  const totalConversion = this.materials.reduce((total, material) => total + (material.qrScanConversionRate || 0), 0);
  this.qrScanConversionRate = this.materials.length > 0 ? totalConversion / this.materials.length : 0;
};

// Helper method to get correct slot count for material type
AnalyticsSchema.statics.getSlotsForMaterialType = function(materialType) {
  switch (materialType) {
    case 'HEADDRESS':
      return [1, 2]; // 2 slots
    case 'LCD':
      return [1, 2, 3, 4, 5]; // 5 slots
    case 'POSTER':
    case 'STICKER':
    case 'BANNER':
    default:
      return [1]; // 1 slot
  }
};

// Validation method to ensure correct slot count per material type
AnalyticsSchema.methods.validateSlotCounts = function() {
  const materialGroups = {};
  
  // Group materials by materialId
  this.materials.forEach(material => {
    if (!materialGroups[material.materialId]) {
      materialGroups[material.materialId] = [];
    }
    materialGroups[material.materialId].push(material);
  });
  
  // Validate each material group
  for (const [materialId, materials] of Object.entries(materialGroups)) {
    // Get material type from first material (assuming all slots have same type)
    const materialType = materials[0].materialType || 'HEADDRESS'; // Default to HEADDRESS if not set
    const expectedSlots = this.constructor.getSlotsForMaterialType(materialType);
    const actualSlots = materials.map(m => m.slotNumber).sort((a, b) => a - b);
    
    if (JSON.stringify(actualSlots) !== JSON.stringify(expectedSlots)) {
      console.warn(`⚠️  Material ${materialId} has incorrect slots. Expected: [${expectedSlots.join(', ')}], Actual: [${actualSlots.join(', ')}]`);
    }
  }
};

// Static methods for creating and managing analytics
AnalyticsSchema.statics.createOrUpdateAdAnalytics = async function(adId, adTitle, materialId, slotNumber, deviceId, additionalData = {}) {
  // Find existing analytics document for this ad
  let analytics = await this.findOne({ adId });
  
  if (!analytics) {
    // Create new analytics document for this ad
    analytics = new this({
      adId,
      adTitle,
      userId: additionalData.userId || null,
      adDeploymentId: additionalData.adDeploymentId || null,
      materials: [],
      materialPerformance: [],
      isActive: true
    });
  }
  
  // Create or update material data
  const materialData = {
    materialId,
    materialType: additionalData.materialType || 'HEADDRESS', // Default to HEADDRESS if not provided
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
  await analytics.addMaterial(materialData);
  
  return analytics;
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
