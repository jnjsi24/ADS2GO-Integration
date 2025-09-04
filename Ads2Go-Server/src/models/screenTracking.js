const mongoose = require('mongoose');

const LocationPointSchema = new mongoose.Schema({
  // GeoJSON format for MongoDB 2dsphere index
  type: {
    type: String,
    enum: ['Point'],
    default: 'Point'
  },
  coordinates: {
    type: [Number], // [longitude, latitude] - MongoDB 2dsphere format
    required: true,
    validate: {
      validator: function(coords) {
        // Allow empty arrays for migration compatibility
        if (!coords || coords.length === 0) {
          return true;
        }
        // For non-empty arrays, validate the format
        return coords.length === 2 && 
               typeof coords[0] === 'number' && 
               typeof coords[1] === 'number' &&
               !isNaN(coords[0]) && !isNaN(coords[1]) &&
               coords[0] >= -180 && coords[0] <= 180 && // longitude
               coords[1] >= -90 && coords[1] <= 90;     // latitude
      },
      message: 'Coordinates must be [longitude, latitude] array with valid values'
    }
  },
  timestamp: { type: Date, default: Date.now },
  speed: { type: Number, min: 0 }, // km/h
  heading: { type: Number, min: 0, max: 360 }, // degrees
  accuracy: { type: Number, min: 0 }, // meters
  address: { type: String, trim: true }
}, { _id: false });

const DailySessionSchema = new mongoose.Schema({
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
}, { _id: false });

const ScreenTrackingSchema = new mongoose.Schema({
  // Screen identification - SHARED TRACKING: One record per materialId
  materialId: { 
    type: String, 
    required: true,
    unique: true, // SHARED TRACKING: Only one record per materialId
    index: true
  },
  screenType: { 
    type: String, 
    required: true,
    enum: ['HEADDRESS', 'LCD', 'BILLBOARD', 'DIGITAL_DISPLAY'],
    default: 'HEADDRESS'
  },
  carGroupId: { 
    type: String, 
    required: false // Optional for non-mobile screens
  },
  
  // Multiple devices per materialId (for Slot 1 and Slot 2)
  devices: [{
    deviceId: { 
      type: String, 
      required: true 
    },
    slotNumber: { 
      type: Number, 
      required: true,
      min: 1,
      max: 2
    },
    isOnline: { 
      type: Boolean, 
      default: false 
    },
    lastSeen: { 
      type: Date, 
      default: Date.now 
    },
    currentLocation: LocationPointSchema,
    totalHoursOnline: { type: Number, default: 0 },
    totalDistanceTraveled: { type: Number, default: 0 }
  }],
  
  // Legacy fields for backward compatibility (will be deprecated)
  deviceId: { 
    type: String, 
    required: false,
    index: true
  },
  slotNumber: { 
    type: Number, 
    required: false,
    min: 1,
    max: 2
  },

  // Current status
  isOnline: { 
    type: Boolean, 
    default: false 
  },
  currentLocation: LocationPointSchema,
  lastSeen: { 
    type: Date, 
    default: Date.now 
  },

  // Daily tracking
  currentSession: DailySessionSchema,
  dailySessions: [DailySessionSchema],

  // Performance metrics
  totalHoursOnline: { type: Number, default: 0 }, // lifetime total
  totalDistanceTraveled: { type: Number, default: 0 }, // lifetime total
  averageDailyHours: { type: Number, default: 0 },
  complianceRate: { type: Number, default: 0 }, // percentage of days meeting 8-hour target

  // Route tracking (for mobile screens only)
  currentRoute: {
    startPoint: LocationPointSchema,
    endPoint: LocationPointSchema,
    waypoints: [LocationPointSchema],
    totalDistance: { type: Number, default: 0 },
    estimatedDuration: { type: Number, default: 0 }, // in minutes
    actualDuration: { type: Number, default: 0 }, // in minutes
    status: { 
      type: String, 
      enum: ['ACTIVE', 'COMPLETED', 'CANCELLED'],
      default: 'ACTIVE'
    }
  },

  // Screen-specific tracking
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
    },
    
    // Daily ad statistics
    dailyAdStats: {
      date: { type: Date },
      totalAdsPlayed: { type: Number, default: 0 },
      totalDisplayTime: { type: Number, default: 0 }, // in seconds
      uniqueAdsPlayed: { type: Number, default: 0 },
      averageAdDuration: { type: Number, default: 0 },
      adCompletionRate: { type: Number, default: 0 },
    },
    
    // Ad performance tracking
    adPerformance: [{
      adId: { type: String, required: true },
      adTitle: { type: String, required: true },
      playCount: { type: Number, default: 0 },
      totalViewTime: { type: Number, default: 0 }, // in seconds
      averageViewTime: { type: Number, default: 0 },
      completionRate: { type: Number, default: 0 },
      firstPlayed: { type: Date },
      lastPlayed: { type: Date },
      impressions: { type: Number, default: 0 },
    }],
  },

  // Alerts and notifications
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

  // System metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
ScreenTrackingSchema.index({ materialId: 1, slotNumber: 1 });
ScreenTrackingSchema.index({ 'currentSession.date': 1 });
ScreenTrackingSchema.index({ isOnline: 1 });
ScreenTrackingSchema.index({ 'currentLocation.coordinates': '2dsphere' });

// Virtual for current hours today
ScreenTrackingSchema.virtual('currentHoursToday').get(function() {
  if (!this.currentSession || !this.currentSession.startTime) return 0;
  
  const now = new Date();
  const startTime = new Date(this.currentSession.startTime);
  const hoursDiff = (now - startTime) / (1000 * 60 * 60);
  
  return Math.round(hoursDiff * 100) / 100; // Round to 2 decimal places
});

// Virtual for hours remaining to meet target
ScreenTrackingSchema.virtual('hoursRemaining').get(function() {
  const targetHours = this.currentSession?.targetHours || 8;
  const currentHours = this.currentHoursToday;
  return Math.max(0, targetHours - currentHours);
});

// Virtual for compliance status
ScreenTrackingSchema.virtual('isCompliantToday').get(function() {
  return this.currentHoursToday >= (this.currentSession?.targetHours || 8);
});

// Virtual for display status
ScreenTrackingSchema.virtual('displayStatus').get(function() {
  if (!this.isOnline) return 'OFFLINE';
  if (this.screenMetrics?.maintenanceMode) return 'MAINTENANCE';
  if (!this.screenMetrics?.isDisplaying) return 'DISPLAY_OFF';
  return 'ACTIVE';
});

// Virtual for easy access to current location coordinates
ScreenTrackingSchema.virtual('currentLat').get(function() {
  return this.currentLocation?.coordinates?.[1] || null;
});

ScreenTrackingSchema.virtual('currentLng').get(function() {
  return this.currentLocation?.coordinates?.[0] || null;
});

// Methods
ScreenTrackingSchema.methods.startDailySession = function() {
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

ScreenTrackingSchema.methods.updateLocation = function(lat, lng, speed = 0, heading = 0, accuracy = 0, address = '') {
  const locationPoint = {
    type: 'Point',
    coordinates: [lng, lat], // GeoJSON format: [longitude, latitude]
    timestamp: new Date(),
    speed,
    heading,
    accuracy,
    address
  };

  // Update current location
  this.currentLocation = locationPoint;
  this.lastSeen = new Date();

  // Add to current session history
  if (this.currentSession && this.currentSession.isActive) {
    this.currentSession.locationHistory.push(locationPoint);
    
    // Calculate distance traveled
    if (this.currentSession.locationHistory.length > 1) {
      const prevPoint = this.currentSession.locationHistory[this.currentSession.locationHistory.length - 2];
      
      // Check if previous point has valid coordinates
      if (prevPoint.coordinates && prevPoint.coordinates.length === 2 && 
          typeof prevPoint.coordinates[0] === 'number' && typeof prevPoint.coordinates[1] === 'number' &&
          !isNaN(prevPoint.coordinates[0]) && !isNaN(prevPoint.coordinates[1])) {
        
        // Extract coordinates from GeoJSON format: [longitude, latitude]
        const prevLng = prevPoint.coordinates[0];
        const prevLat = prevPoint.coordinates[1];
        const distance = this.calculateDistance(prevLat, prevLng, lat, lng);
        
        // Only add distance if it's a valid number
        if (!isNaN(distance) && distance >= 0) {
          this.currentSession.totalDistanceTraveled += distance;
          this.totalDistanceTraveled += distance;
        }
      }
    }
  }

  return this.save();
};

ScreenTrackingSchema.methods.endDailySession = function() {
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
    
    // Add to daily sessions history
    this.dailySessions.push(this.currentSession);
    
    // Update lifetime totals
    this.totalHoursOnline += this.currentSession.totalHoursOnline;
    
    // Calculate average daily hours (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentSessions = this.dailySessions.filter(session => 
      new Date(session.date) >= thirtyDaysAgo
    );
    
    if (recentSessions.length > 0) {
      const totalRecentHours = recentSessions.reduce((sum, session) => sum + session.totalHoursOnline, 0);
      this.averageDailyHours = Math.round((totalRecentHours / recentSessions.length) * 100) / 100;
    }
    
    // Calculate compliance rate
    const compliantDays = this.dailySessions.filter(session => 
      session.complianceStatus === 'COMPLIANT'
    ).length;
    
    this.complianceRate = this.dailySessions.length > 0 ? 
      Math.round((compliantDays / this.dailySessions.length) * 100) : 0;
  }
  
  return this.save();
};

ScreenTrackingSchema.methods.calculateDistance = function(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = this.deg2rad(lat2 - lat1);
  const dLng = this.deg2rad(lng2 - lng1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in kilometers
  return Math.round(distance * 1000) / 1000; // Round to 3 decimal places
};

ScreenTrackingSchema.methods.deg2rad = function(deg) {
  return deg * (Math.PI/180);
};

ScreenTrackingSchema.methods.addAlert = function(type, message, severity = 'MEDIUM') {
  this.alerts.push({
    type,
    message,
    timestamp: new Date(),
    isResolved: false,
    severity
  });
  
  return this.save();
};

// Helper method to get formatted location data for API responses
ScreenTrackingSchema.methods.getFormattedLocation = function() {
  if (!this.currentLocation) return null;
  
  // Check if coordinates exist and are valid
  if (!this.currentLocation.coordinates || 
      this.currentLocation.coordinates.length !== 2 ||
      typeof this.currentLocation.coordinates[0] !== 'number' ||
      typeof this.currentLocation.coordinates[1] !== 'number' ||
      isNaN(this.currentLocation.coordinates[0]) ||
      isNaN(this.currentLocation.coordinates[1])) {
    return null;
  }
  
  return {
    lat: this.currentLocation.coordinates[1], // latitude
    lng: this.currentLocation.coordinates[0], // longitude
    timestamp: this.currentLocation.timestamp,
    speed: this.currentLocation.speed,
    heading: this.currentLocation.heading,
    accuracy: this.currentLocation.accuracy,
    address: this.currentLocation.address
  };
};

// Helper method to clean up invalid location history entries
ScreenTrackingSchema.methods.cleanupLocationHistory = function() {
  let cleaned = false;
  
  // Clean current session location history
  if (this.currentSession && this.currentSession.locationHistory) {
    const originalLength = this.currentSession.locationHistory.length;
    this.currentSession.locationHistory = this.currentSession.locationHistory.filter(point => {
      return point.coordinates && 
             point.coordinates.length === 2 && 
             typeof point.coordinates[0] === 'number' && 
             typeof point.coordinates[1] === 'number' &&
             !isNaN(point.coordinates[0]) && !isNaN(point.coordinates[1]);
    });
    
    if (this.currentSession.locationHistory.length !== originalLength) {
      cleaned = true;
    }
  }
  
  // Clean daily sessions location history
  if (this.dailySessions && this.dailySessions.length > 0) {
    for (const session of this.dailySessions) {
      if (session.locationHistory) {
        const originalLength = session.locationHistory.length;
        session.locationHistory = session.locationHistory.filter(point => {
          return point.coordinates && 
                 point.coordinates.length === 2 && 
                 typeof point.coordinates[0] === 'number' && 
                 typeof point.coordinates[1] === 'number' &&
                 !isNaN(point.coordinates[0]) && !isNaN(point.coordinates[1]);
        });
        
        if (session.locationHistory.length !== originalLength) {
          cleaned = true;
        }
      }
    }
  }
  
  return cleaned;
};

// Method to track ad playback
ScreenTrackingSchema.methods.trackAdPlayback = function(adId, adTitle, adDuration, viewTime = 0) {
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
    completionRate: adDuration > 0 ? Math.min(100, ((this.screenMetrics.currentAd?.totalViewTime || 0) + viewTime) / adDuration * 100) : 0
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
  let adPerformance = this.screenMetrics.adPerformance.find(ad => ad.adId === adId);
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
    this.screenMetrics.adPerformance.push(adPerformance);
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
    this.screenMetrics.adPerformance.reduce((sum, ad) => sum + ad.completionRate, 0) / this.screenMetrics.adPerformance.length;
  
  return this.save();
};

// Method to end ad playback
ScreenTrackingSchema.methods.endAdPlayback = function() {
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

// Method to update driver activity hours
ScreenTrackingSchema.methods.updateDriverActivity = function(isActive = true) {
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

// Static methods
ScreenTrackingSchema.statics.findByDeviceId = function(deviceId) {
  return this.findOne({ deviceId });
};

// SHARED TRACKING: Find by materialId only (shared across slots)
ScreenTrackingSchema.statics.findByMaterial = function(materialId) {
  return this.findOne({ materialId });
};

// Legacy method for backward compatibility
ScreenTrackingSchema.statics.findByMaterialAndSlot = function(materialId, slotNumber) {
  return this.findOne({ materialId }); // Now just finds by materialId
};

ScreenTrackingSchema.statics.findOnlineScreens = function() {
  return this.find({ isOnline: true });
};

ScreenTrackingSchema.statics.findByScreenType = function(screenType) {
  return this.find({ screenType });
};

ScreenTrackingSchema.statics.findNonCompliantDrivers = function(date = new Date()) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  return this.find({
    screenType: 'HEADDRESS',
    'currentSession.date': startOfDay,
    'currentSession.complianceStatus': 'NON_COMPLIANT'
  });
};

ScreenTrackingSchema.statics.findDisplayIssues = function() {
  return this.find({
    $or: [
      { 'screenMetrics.isDisplaying': false },
      { 'screenMetrics.maintenanceMode': true },
      { 'screenMetrics.brightness': { $lt: 50 } }
    ]
  });
};

module.exports = mongoose.models.ScreenTracking || mongoose.model('ScreenTracking', ScreenTrackingSchema);
