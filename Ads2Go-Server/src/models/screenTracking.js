const mongoose = require('mongoose');

const LocationPointSchema = new mongoose.Schema({
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
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
  // Screen identification
  deviceId: { 
    type: String, 
    required: false, // Made optional - will be set when device registers
    unique: true,
    sparse: true, // Allow multiple null values
    index: true
  },
  materialId: { 
    type: String, 
    required: true,
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
  slotNumber: { 
    type: Number, 
    required: false, // Only for HEADDRESS
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
    adPlayCount: { type: Number, default: 0 }, // Number of ads played
    lastAdPlayed: { type: Date },
    brightness: { type: Number, min: 0, max: 100, default: 100 }, // Screen brightness
    volume: { type: Number, min: 0, max: 100, default: 50 }, // Audio volume
    isDisplaying: { type: Boolean, default: true }, // Currently showing ads
    maintenanceMode: { type: Boolean, default: false }, // Under maintenance
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
ScreenTrackingSchema.index({ 'currentLocation': '2dsphere' });

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
    lat,
    lng,
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
      const distance = this.calculateDistance(prevPoint.lat, prevPoint.lng, lat, lng);
      this.currentSession.totalDistanceTraveled += distance;
      this.totalDistanceTraveled += distance;
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

// Static methods
ScreenTrackingSchema.statics.findByDeviceId = function(deviceId) {
  return this.findOne({ deviceId });
};

ScreenTrackingSchema.statics.findByMaterial = function(materialId) {
  return this.find({ materialId });
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
