const mongoose = require('mongoose');

// Driver Route Schema
const DriverRouteSchema = new mongoose.Schema({
  startLocation: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: [Number], // [lng, lat]
    address: String,
    timestamp: Date
  },
  endLocation: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: [Number], // [lng, lat]
    address: String,
    timestamp: Date
  },
  distance: Number, // km
  duration: Number, // minutes
  averageSpeed: Number, // km/h
  maxSpeed: Number, // km/h
  routePoints: [{
    coordinates: [Number],
    timestamp: Date,
    speed: Number,
    heading: Number
  }]
}, { _id: false });

// Driver Performance Schema
const DriverPerformanceSchema = new mongoose.Schema({
  date: Date,
  totalDistance: Number, // km
  totalHours: Number, // hours worked
  averageSpeed: Number, // km/h
  maxSpeed: Number, // km/h
  totalAdImpressions: Number,
  totalQRScans: Number,
  earnings: Number,
  complianceScore: Number, // 0-100
  safetyScore: Number, // 0-100 based on speed violations
  routes: [DriverRouteSchema]
}, { _id: false });

const DriverAnalyticsSchema = new mongoose.Schema({
  // Driver Reference
  driverId: {
    type: String, // DRV-001, not ObjectId
    required: true,
    index: true
  },
  
  // Current Status
  isOnline: { type: Boolean, default: false },
  currentLocation: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: [Number], // [lng, lat]
    accuracy: Number,
    speed: Number, // km/h
    heading: Number, // degrees
    timestamp: Date
  },
  
  // Material & Vehicle Info
  materialId: { type: String }, // DGL-HEADDRESS-CAR-001, not ObjectId
  vehiclePlateNumber: String,
  vehicleType: String,
  
  // Daily Performance Tracking
  currentDay: DriverPerformanceSchema,
  dailyPerformance: [DriverPerformanceSchema],
  
  // Route Analytics
  totalRoutes: { type: Number, default: 0 },
  totalDistanceTraveled: { type: Number, default: 0 }, // lifetime km
  totalHoursWorked: { type: Number, default: 0 }, // lifetime hours
  averageDailyDistance: { type: Number, default: 0 },
  averageDailyHours: { type: Number, default: 0 },
  
  // Speed Analytics
  averageSpeed: { type: Number, default: 0 }, // lifetime average
  maxSpeed: { type: Number, default: 0 }, // lifetime max
  speedViolations: [{
    timestamp: Date,
    speed: Number,
    limit: Number,
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: [Number]
    },
    severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'] }
  }],
  
  // Ad Performance (aggregated from device analytics)
  totalAdImpressions: { type: Number, default: 0 },
  totalQRScans: { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 },
  
  // Compliance & Safety Metrics
  complianceRate: { type: Number, default: 0 }, // percentage
  safetyScore: { type: Number, default: 100 }, // starts at 100, decreases with violations
  uptimePercentage: { type: Number, default: 0 },
  
  // Location History
  locationHistory: [{
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: [Number],
    timestamp: Date,
    speed: Number,
    heading: Number,
    accuracy: Number
  }],
  
  // Popular Routes (most frequent paths)
  popularRoutes: [{
    startArea: String,
    endArea: String,
    frequency: Number,
    averageDistance: Number,
    averageDuration: Number
  }],
  
  // Time-based Analytics
  peakHours: [Number], // hours of day when most active
  peakDays: [String], // days of week when most active
  workingHours: {
    start: String, // "08:00"
    end: String,   // "17:00"
    average: Number // average hours per day
  },
  
  // Performance Trends
  weeklyTrends: [{
    week: String, // "2024-W01"
    distance: Number,
    hours: Number,
    earnings: Number,
    compliance: Number
  }],
  
  monthlyTrends: [{
    month: String, // "2024-01"
    distance: Number,
    hours: Number,
    earnings: Number,
    compliance: Number
  }],
  
  // System Fields
  lastUpdated: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
DriverAnalyticsSchema.index({ driverId: 1, lastUpdated: -1 });
DriverAnalyticsSchema.index({ 'currentLocation.coordinates': '2dsphere' });
DriverAnalyticsSchema.index({ 'locationHistory.coordinates': '2dsphere' });
DriverAnalyticsSchema.index({ 'dailyPerformance.date': -1 });
DriverAnalyticsSchema.index({ isOnline: 1 });

// Virtual for current day performance
DriverAnalyticsSchema.virtual('todayPerformance').get(function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todayData = this.dailyPerformance.find(day => 
    day.date && day.date.toDateString() === today.toDateString()
  );
  
  return todayData || {
    date: today,
    totalDistance: 0,
    totalHours: 0,
    averageSpeed: 0,
    maxSpeed: 0,
    totalAdImpressions: 0,
    totalQRScans: 0,
    earnings: 0,
    complianceScore: 100,
    safetyScore: 100
  };
});

// Methods
DriverAnalyticsSchema.methods.updateLocation = function(lat, lng, speed, heading, accuracy) {
  const location = {
    type: 'Point',
    coordinates: [lng, lat],
    timestamp: new Date(),
    speed: speed || 0,
    heading: heading || 0,
    accuracy: accuracy || 0
  };
  
  this.currentLocation = location;
  this.locationHistory.push(location);
  
  // Update speed metrics
  if (speed > this.maxSpeed) {
    this.maxSpeed = speed;
  }
  
  // Check for speed violations (assuming 60 km/h limit)
  if (speed > 60) {
    this.speedViolations.push({
      timestamp: new Date(),
      speed: speed,
      limit: 60,
      location: location,
      severity: speed > 80 ? 'HIGH' : speed > 70 ? 'MEDIUM' : 'LOW'
    });
    
    // Update safety score
    this.safetyScore = Math.max(0, this.safetyScore - (speed > 80 ? 5 : 2));
  }
  
  return this.save();
};

DriverAnalyticsSchema.methods.addRoute = function(routeData) {
  this.totalRoutes += 1;
  this.totalDistanceTraveled += routeData.distance;
  
  // Add to current day performance
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let todayPerformance = this.dailyPerformance.find(day => 
    day.date && day.date.toDateString() === today.toDateString()
  );
  
  if (!todayPerformance) {
    todayPerformance = {
      date: today,
      totalDistance: 0,
      totalHours: 0,
      averageSpeed: 0,
      maxSpeed: 0,
      totalAdImpressions: 0,
      totalQRScans: 0,
      earnings: 0,
      complianceScore: 100,
      safetyScore: 100,
      routes: []
    };
    this.dailyPerformance.push(todayPerformance);
  }
  
  todayPerformance.routes.push(routeData);
  todayPerformance.totalDistance += routeData.distance;
  todayPerformance.totalHours += routeData.duration / 60; // convert minutes to hours
  
  // Update averages
  this.averageDailyDistance = this.totalDistanceTraveled / this.totalRoutes;
  this.averageDailyHours = this.totalHoursWorked / this.totalRoutes;
  
  return this.save();
};

// Static methods
DriverAnalyticsSchema.statics.getDriverPerformance = function(driverId, startDate, endDate) {
  return this.findOne({ driverId })
    .select('dailyPerformance locationHistory speedViolations')
    .where('dailyPerformance.date').gte(startDate).lte(endDate);
};

DriverAnalyticsSchema.statics.getTopPerformers = function(limit = 10) {
  return this.find({ isActive: true })
    .sort({ 'totalDistanceTraveled': -1, 'complianceRate': -1 })
    .limit(limit)
    .populate('driverId', 'firstName lastName vehiclePlateNumber');
};

module.exports = mongoose.models.DriverAnalytics || mongoose.model('DriverAnalytics', DriverAnalyticsSchema);
