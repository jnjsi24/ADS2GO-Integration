const mongoose = require('mongoose');

/**
 * DailyUserAnalytics Model
 * 
 * PHASE 2: New flat structure for analytics data
 * - One document per user per day per ad
 * - No deeply nested arrays
 * - Optimized for fast date-range queries
 * - Supports unlimited growth (no 16MB document limit)
 * 
 * Replaces the nested dailyStats array in UserAnalytics
 */

const MaterialStatsSchema = new mongoose.Schema({
  materialId: { 
    type: String, 
    required: true 
  },
  adsPlayed: { 
    type: Number, 
    default: 0 
  },
  displayTime: { 
    type: Number, 
    default: 0 
  },
  qrScans: { 
    type: Number, 
    default: 0 
  },
  impressions: { 
    type: Number, 
    default: 0 
  },
  completionRate: { 
    type: Number, 
    default: 0 
  }
}, { _id: false });

const DailyUserAnalyticsSchema = new mongoose.Schema({
  // User reference
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true,
    index: true // Fast user queries
  },
  
  // Date (string format "2025-01-07" for easy comparison)
  date: { 
    type: String, 
    required: true,
    index: true // Fast date range queries
  },
  
  // Ad reference
  adId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Ad',
    required: true,
    index: true // Fast ad filtering
  },
  
  // Ad metadata (denormalized for performance)
  adTitle: {
    type: String,
    default: ''
  },
  
  // Flat metrics (no nested arrays)
  adsPlayed: { 
    type: Number, 
    default: 0,
    min: 0
  },
  
  displayTime: { 
    type: Number, 
    default: 0,
    min: 0
  },
  
  qrScans: { 
    type: Number, 
    default: 0,
    min: 0
  },
  
  impressions: { 
    type: Number, 
    default: 0,
    min: 0
  },
  
  completionRate: { 
    type: Number, 
    default: 0,
    min: 0,
    max: 100
  },
  
  // Material breakdown (small array, not deeply nested)
  materialStats: [MaterialStatsSchema],
  
  // Metadata
  dataSource: {
    type: String,
    enum: ['sync', 'realtime', 'migration'],
    default: 'sync'
  },
  
  lastUpdated: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  
  // Sync tracking
  lastSyncTimestamp: {
    type: Date,
    default: Date.now
  },
  
  syncVersion: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  collection: 'dailyuseranalytics'
});

// ============================================
// INDEXES FOR FAST QUERIES
// ============================================

// Compound index: userId + date (most common query)
DailyUserAnalyticsSchema.index({ userId: 1, date: -1 });

// Compound index: userId + adId + date (filter by ad)
DailyUserAnalyticsSchema.index({ userId: 1, adId: 1, date: -1 });

// Compound index: userId + date + adId (alternative query pattern)
DailyUserAnalyticsSchema.index({ userId: 1, date: -1, adId: 1 });

// Index for cleanup/archival queries
DailyUserAnalyticsSchema.index({ lastUpdated: 1 });

// ============================================
// STATIC METHODS
// ============================================

/**
 * Get analytics for a user within a date range
 */
DailyUserAnalyticsSchema.statics.getByDateRange = async function(userId, startDate, endDate, adId = null) {
  const query = {
    userId: new mongoose.Types.ObjectId(userId),
    date: { 
      $gte: startDate, 
      $lte: endDate 
    }
  };
  
  if (adId && adId !== 'all') {
    query.adId = new mongoose.Types.ObjectId(adId);
  }
  
  return this.find(query).sort({ date: -1 }).lean();
};

/**
 * Get aggregated totals for a user within a date range
 */
DailyUserAnalyticsSchema.statics.getAggregatedTotals = async function(userId, startDate, endDate, adId = null) {
  const matchStage = {
    userId: new mongoose.Types.ObjectId(userId),
    date: { 
      $gte: startDate, 
      $lte: endDate 
    }
  };
  
  if (adId && adId !== 'all') {
    matchStage.adId = new mongoose.Types.ObjectId(adId);
  }
  
  const result = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalAdsPlayed: { $sum: '$adsPlayed' },
        totalDisplayTime: { $sum: '$displayTime' },
        totalQRScans: { $sum: '$qrScans' },
        totalImpressions: { $sum: '$impressions' },
        avgCompletionRate: { $avg: '$completionRate' },
        daysWithData: { $sum: 1 }
      }
    }
  ]);
  
  return result[0] || {
    totalAdsPlayed: 0,
    totalDisplayTime: 0,
    totalQRScans: 0,
    totalImpressions: 0,
    avgCompletionRate: 0,
    daysWithData: 0
  };
};

/**
 * Get paginated daily stats
 */
DailyUserAnalyticsSchema.statics.getPaginated = async function(userId, startDate, endDate, page = 1, limit = 30, adId = null) {
  const query = {
    userId: new mongoose.Types.ObjectId(userId),
    date: { 
      $gte: startDate, 
      $lte: endDate 
    }
  };
  
  if (adId && adId !== 'all') {
    query.adId = new mongoose.Types.ObjectId(adId);
  }
  
  const skip = (page - 1) * limit;
  
  const [data, total] = await Promise.all([
    this.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(query)
  ]);
  
  return {
    data,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Upsert (update or insert) daily analytics
 */
DailyUserAnalyticsSchema.statics.upsertDailyStats = async function(userId, date, adId, stats) {
  return this.findOneAndUpdate(
    { userId, date, adId },
    {
      $set: {
        ...stats,
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
 * Bulk upsert (for sync job efficiency)
 */
DailyUserAnalyticsSchema.statics.bulkUpsert = async function(records) {
  if (!records || records.length === 0) return { ok: 1, nModified: 0 };
  
  const bulkOps = records.map(record => ({
    updateOne: {
      filter: { 
        userId: record.userId,
        date: record.date,
        adId: record.adId 
      },
      update: { 
        $set: {
          ...record,
          lastUpdated: new Date(),
          lastSyncTimestamp: new Date()
        },
        $inc: { syncVersion: 1 }
      },
      upsert: true
    }
  }));
  
  return this.bulkWrite(bulkOps, { ordered: false });
};

// ============================================
// INSTANCE METHODS
// ============================================

DailyUserAnalyticsSchema.methods.toSummary = function() {
  return {
    date: this.date,
    adsPlayed: this.adsPlayed,
    displayTime: this.displayTime,
    qrScans: this.qrScans,
    impressions: this.impressions,
    completionRate: this.completionRate
  };
};

// ============================================
// VIRTUALS
// ============================================

DailyUserAnalyticsSchema.virtual('displayDate').get(function() {
  return new Date(this.date).toLocaleDateString();
});

DailyUserAnalyticsSchema.virtual('qrScanRate').get(function() {
  if (this.adsPlayed === 0) return 0;
  return ((this.qrScans / this.adsPlayed) * 100).toFixed(2);
});

// ============================================
// MIDDLEWARE
// ============================================

// Pre-save validation
DailyUserAnalyticsSchema.pre('save', function(next) {
  // Ensure metrics are non-negative
  if (this.adsPlayed < 0) this.adsPlayed = 0;
  if (this.displayTime < 0) this.displayTime = 0;
  if (this.qrScans < 0) this.qrScans = 0;
  if (this.impressions < 0) this.impressions = 0;
  
  // Ensure completionRate is between 0-100
  if (this.completionRate < 0) this.completionRate = 0;
  if (this.completionRate > 100) this.completionRate = 100;
  
  next();
});

// ============================================
// EXPORT MODEL
// ============================================

const DailyUserAnalytics = mongoose.model('DailyUserAnalytics', DailyUserAnalyticsSchema);

module.exports = DailyUserAnalytics;

