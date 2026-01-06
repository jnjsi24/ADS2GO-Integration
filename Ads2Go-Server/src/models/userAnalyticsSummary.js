const mongoose = require('mongoose');

/**
 * UserAnalyticsSummary Model
 * 
 * PHASE 2: Lightweight summary for quick overview queries
 * - One document per user
 * - Only aggregate totals (no detailed arrays)
 * - Updated by sync job
 * - Fast queries for dashboard/overview
 * 
 * Use this for:
 * - Dashboard widgets
 * - Quick user stats
 * - Overview pages
 * 
 * Use DailyUserAnalytics for:
 * - Detailed analytics
 * - Charts and graphs
 * - Date range queries
 */

const AdSummarySchema = new mongoose.Schema({
  adId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Ad',
    required: true 
  },
  adTitle: {
    type: String,
    required: true
  },
  totalPlays: { 
    type: Number, 
    default: 0 
  },
  totalQRScans: { 
    type: Number, 
    default: 0 
  },
  totalDisplayTime: {
    type: Number,
    default: 0
  },
  totalImpressions: {
    type: Number,
    default: 0
  },
  averageCompletionRate: {
    type: Number,
    default: 0
  },
  lastActivity: { 
    type: Date 
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'],
    default: 'ACTIVE'
  }
}, { _id: false });

const DeviceSummarySchema = new mongoose.Schema({
  materialId: {
    type: String,
    required: true
  },
  totalPlays: {
    type: Number,
    default: 0
  },
  totalQRScans: {
    type: Number,
    default: 0
  },
  lastSeen: {
    type: Date
  },
  isOnline: {
    type: Boolean,
    default: false
  }
}, { _id: false });

const UserAnalyticsSummarySchema = new mongoose.Schema({
  // User reference
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true,
    unique: true, // One summary per user
    index: true
  },
  
  // User metadata (denormalized for quick access)
  userName: {
    type: String,
    default: ''
  },
  
  userEmail: {
    type: String,
    default: ''
  },
  
  // ============================================
  // AGGREGATE TOTALS (ALL-TIME)
  // ============================================
  
  totalAdsPlayed: { 
    type: Number, 
    default: 0,
    min: 0
  },
  
  totalDisplayTime: { 
    type: Number, 
    default: 0,
    min: 0
  },
  
  totalQRScans: { 
    type: Number, 
    default: 0,
    min: 0
  },
  
  totalImpressions: {
    type: Number,
    default: 0,
    min: 0
  },
  
  totalAds: { 
    type: Number, 
    default: 0,
    min: 0
  },
  
  activeAds: {
    type: Number,
    default: 0,
    min: 0
  },
  
  totalDevices: { 
    type: Number, 
    default: 0,
    min: 0
  },
  
  averageCompletionRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  // ============================================
  // LIGHTWEIGHT SUMMARIES (NO DETAILED DATA)
  // ============================================
  
  // Ad summaries (small array, max 100 ads per user typically)
  ads: [AdSummarySchema],
  
  // Device summaries (small array, max 50 devices per user typically)
  devices: [DeviceSummarySchema],
  
  // ============================================
  // METADATA
  // ============================================
  
  lastUpdated: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  
  lastSyncTimestamp: {
    type: Date,
    default: Date.now
  },
  
  syncVersion: {
    type: Number,
    default: 1
  },
  
  dataQuality: {
    isComplete: {
      type: Boolean,
      default: true
    },
    lastValidation: {
      type: Date
    },
    issues: [{
      type: String
    }]
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  collection: 'useranalyticssummary'
});

// ============================================
// INDEXES
// ============================================

// Primary index (already unique on userId)
// Index for sorting/filtering by activity
UserAnalyticsSummarySchema.index({ lastUpdated: -1 });
UserAnalyticsSummarySchema.index({ totalAdsPlayed: -1 });

// ============================================
// STATIC METHODS
// ============================================

/**
 * Get or create summary for a user
 */
UserAnalyticsSummarySchema.statics.getOrCreate = async function(userId) {
  let summary = await this.findOne({ userId });
  
  if (!summary) {
    summary = await this.create({
      userId,
      totalAdsPlayed: 0,
      totalDisplayTime: 0,
      totalQRScans: 0,
      totalImpressions: 0,
      totalAds: 0,
      activeAds: 0,
      totalDevices: 0,
      averageCompletionRate: 0,
      ads: [],
      devices: []
    });
  }
  
  return summary;
};

/**
 * Update summary from DailyUserAnalytics
 */
UserAnalyticsSummarySchema.statics.updateFromDaily = async function(userId) {
  const DailyUserAnalytics = require('./dailyUserAnalytics');
  
  // Aggregate totals from daily records
  const totals = await DailyUserAnalytics.aggregate([
    {
      $match: { userId: mongoose.Types.ObjectId(userId) }
    },
    {
      $group: {
        _id: null,
        totalAdsPlayed: { $sum: '$adsPlayed' },
        totalDisplayTime: { $sum: '$displayTime' },
        totalQRScans: { $sum: '$qrScans' },
        totalImpressions: { $sum: '$impressions' },
        avgCompletionRate: { $avg: '$completionRate' }
      }
    }
  ]);
  
  // Aggregate per-ad summaries
  const adSummaries = await DailyUserAnalytics.aggregate([
    {
      $match: { userId: mongoose.Types.ObjectId(userId) }
    },
    {
      $group: {
        _id: { adId: '$adId', adTitle: '$adTitle' },
        totalPlays: { $sum: '$adsPlayed' },
        totalQRScans: { $sum: '$qrScans' },
        totalDisplayTime: { $sum: '$displayTime' },
        totalImpressions: { $sum: '$impressions' },
        averageCompletionRate: { $avg: '$completionRate' },
        lastActivity: { $max: '$date' }
      }
    }
  ]);
  
  // Get unique devices count
  const deviceCount = await DailyUserAnalytics.aggregate([
    {
      $match: { userId: mongoose.Types.ObjectId(userId) }
    },
    {
      $unwind: '$materialStats'
    },
    {
      $group: {
        _id: '$materialStats.materialId'
      }
    },
    {
      $count: 'total'
    }
  ]);
  
  // Update or create summary
  const summary = totals[0] || {};
  
  return this.findOneAndUpdate(
    { userId },
    {
      $set: {
        totalAdsPlayed: summary.totalAdsPlayed || 0,
        totalDisplayTime: summary.totalDisplayTime || 0,
        totalQRScans: summary.totalQRScans || 0,
        totalImpressions: summary.totalImpressions || 0,
        averageCompletionRate: summary.avgCompletionRate || 0,
        totalAds: adSummaries.length,
        activeAds: adSummaries.filter(ad => ad.lastActivity).length,
        totalDevices: deviceCount[0]?.total || 0,
        ads: adSummaries.map(ad => ({
          adId: ad._id.adId,
          adTitle: ad._id.adTitle,
          totalPlays: ad.totalPlays,
          totalQRScans: ad.totalQRScans,
          totalDisplayTime: ad.totalDisplayTime,
          totalImpressions: ad.totalImpressions,
          averageCompletionRate: ad.averageCompletionRate,
          lastActivity: new Date(ad.lastActivity),
          status: 'ACTIVE'
        })),
        lastUpdated: new Date(),
        lastSyncTimestamp: new Date()
      },
      $inc: { syncVersion: 1 }
    },
    { 
      upsert: true, 
      new: true,
      runValidators: true
    }
  );
};

/**
 * Get top users by activity
 */
UserAnalyticsSummarySchema.statics.getTopUsers = async function(limit = 10, sortBy = 'totalAdsPlayed') {
  return this.find({})
    .sort({ [sortBy]: -1 })
    .limit(limit)
    .lean();
};

// ============================================
// INSTANCE METHODS
// ============================================

UserAnalyticsSummarySchema.methods.toPublic = function() {
  return {
    userId: this.userId,
    totalAdsPlayed: this.totalAdsPlayed,
    totalDisplayTime: this.totalDisplayTime,
    totalQRScans: this.totalQRScans,
    totalImpressions: this.totalImpressions,
    totalAds: this.totalAds,
    activeAds: this.activeAds,
    totalDevices: this.totalDevices,
    averageCompletionRate: this.averageCompletionRate,
    lastUpdated: this.lastUpdated
  };
};

// ============================================
// VIRTUALS
// ============================================

UserAnalyticsSummarySchema.virtual('qrScanRate').get(function() {
  if (this.totalAdsPlayed === 0) return 0;
  return ((this.totalQRScans / this.totalAdsPlayed) * 100).toFixed(2);
});

UserAnalyticsSummarySchema.virtual('averagePlayTimePerAd').get(function() {
  if (this.totalAdsPlayed === 0) return 0;
  return (this.totalDisplayTime / this.totalAdsPlayed).toFixed(2);
});

// ============================================
// MIDDLEWARE
// ============================================

// Pre-save validation
UserAnalyticsSummarySchema.pre('save', function(next) {
  // Ensure all metrics are non-negative
  if (this.totalAdsPlayed < 0) this.totalAdsPlayed = 0;
  if (this.totalDisplayTime < 0) this.totalDisplayTime = 0;
  if (this.totalQRScans < 0) this.totalQRScans = 0;
  if (this.totalImpressions < 0) this.totalImpressions = 0;
  if (this.totalAds < 0) this.totalAds = 0;
  if (this.activeAds < 0) this.activeAds = 0;
  if (this.totalDevices < 0) this.totalDevices = 0;
  
  // Ensure completionRate is between 0-100
  if (this.averageCompletionRate < 0) this.averageCompletionRate = 0;
  if (this.averageCompletionRate > 100) this.averageCompletionRate = 100;
  
  next();
});

// ============================================
// EXPORT MODEL
// ============================================

const UserAnalyticsSummary = mongoose.model('UserAnalyticsSummary', UserAnalyticsSummarySchema);

module.exports = UserAnalyticsSummary;

