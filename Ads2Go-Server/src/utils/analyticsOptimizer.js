/**
 * Analytics Optimizer - Future-proof performance and accuracy improvements
 * 
 * Features:
 * - Query optimization with proper indexes
 * - Smart caching with TTL management
 * - Performance monitoring
 * - Data validation
 * - Error handling
 * - Rate limiting support
 */

const mongoose = require('mongoose');
const { getPhilippinesMidnight: getPHMidnight } = require('./dateUtils');

class AnalyticsOptimizer {
  constructor() {
    this.queryCache = new Map();
    this.performanceMetrics = new Map();
    this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    this.MAX_CACHE_SIZE = 1000; // Maximum cache entries
  }

  /**
   * Initialize database indexes for optimal query performance
   */
  static async initializeIndexes() {
    try {
      const UserAnalytics = require('../models/userAnalytics');
      const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
      const Ad = require('../models/Ad');

      console.log('🔧 [AnalyticsOptimizer] Initializing database indexes...');

      // UserAnalytics indexes
      await UserAnalytics.collection.createIndex({ userId: 1 }, { unique: true });
      await UserAnalytics.collection.createIndex({ 'dailyStats.date': 1 });
      await UserAnalytics.collection.createIndex({ 'dailyStats.ads.adId': 1 });
      await UserAnalytics.collection.createIndex({ lastUpdated: -1 });
      await UserAnalytics.collection.createIndex({ lastSyncTimestamp: -1 });
      await UserAnalytics.collection.createIndex({ lastAnalyticsAccess: -1 });
      
      // Compound index for common queries
      await UserAnalytics.collection.createIndex({ 
        userId: 1, 
        'dailyStats.date': 1 
      });

      // DeviceDataHistoryV2 indexes
      await DeviceDataHistoryV2.collection.createIndex({ materialId: 1 });
      await DeviceDataHistoryV2.collection.createIndex({ 'dailyData.date': 1 });
      await DeviceDataHistoryV2.collection.createIndex({ 
        materialId: 1, 
        'dailyData.date': 1 
      });
      await DeviceDataHistoryV2.collection.createIndex({ 
        'dailyData.adPerformance.userId': 1,
        'dailyData.date': 1
      });
      await DeviceDataHistoryV2.collection.createIndex({ 
        'dailyData.qrScans.userId': 1,
        'dailyData.date': 1
      });

      // Ad indexes for filtering
      await Ad.collection.createIndex({ userId: 1, isArchived: 1, adStatus: 1 });
      await Ad.collection.createIndex({ userId: 1, paymentStatus: 1, adStatus: 1 });

      console.log('✅ [AnalyticsOptimizer] Database indexes initialized successfully');
    } catch (error) {
      console.error('❌ [AnalyticsOptimizer] Error initializing indexes:', error);
      // Don't throw - indexes might already exist
    }
  }

  /**
   * Get midnight in Philippines timezone (UTC+8) for a given date.
   * Delegates to dateUtils.getPhilippinesMidnight (single source of truth).
   */
  static getPhilippinesMidnight(date = new Date()) {
    return getPHMidnight(date);
  }

  /**
   * Optimize date range queries with proper validation
   */
  static validateAndNormalizeDateRange(startDate, endDate, period) {
    const now = new Date();
    let normalizedStartDate, normalizedEndDate;

    if (startDate && endDate) {
      normalizedStartDate = new Date(startDate);
      normalizedEndDate = new Date(endDate);
      
      // Validate dates
      if (isNaN(normalizedStartDate.getTime()) || isNaN(normalizedEndDate.getTime())) {
        throw new Error('Invalid date format');
      }
      
      // Ensure endDate is not before startDate
      if (normalizedEndDate < normalizedStartDate) {
        [normalizedStartDate, normalizedEndDate] = [normalizedEndDate, normalizedStartDate];
      }
      
      // Don't allow future dates beyond today (using Philippines timezone)
      if (normalizedStartDate > now) {
        normalizedStartDate = AnalyticsOptimizer.getPhilippinesMidnight(now);
      }
      if (normalizedEndDate > now) {
        normalizedEndDate = now;
      }
    } else if (period) {
      switch (period) {
        case '1d':
          // ✅ Use Philippines timezone: Today from midnight Philippines time (UTC+8) to now
          normalizedStartDate = this.getPhilippinesMidnight(now);
          normalizedEndDate = now;
          break;
        case '7d':
          normalizedStartDate = new Date(now);
          normalizedStartDate.setUTCDate(normalizedStartDate.getUTCDate() - 6);
          normalizedStartDate.setUTCHours(0, 0, 0, 0);
          normalizedEndDate = now;
          break;
        case '30d':
          normalizedStartDate = new Date(now);
          normalizedStartDate.setUTCDate(normalizedStartDate.getUTCDate() - 29);
          normalizedStartDate.setUTCHours(0, 0, 0, 0);
          normalizedEndDate = now;
          break;
        case 'all':
          // Return null for startDate/endDate to query all data
          // This allows fetching all historical data without date constraints
          normalizedStartDate = null;
          normalizedEndDate = null;
          break;
        default:
          // Default to last 7 days
          normalizedStartDate = new Date(now);
          normalizedStartDate.setUTCDate(normalizedStartDate.getUTCDate() - 6);
          normalizedStartDate.setUTCHours(0, 0, 0, 0);
          normalizedEndDate = now;
      }
    } else {
      // Default to last 7 days
      normalizedStartDate = new Date(now);
      normalizedStartDate.setUTCDate(normalizedStartDate.getUTCDate() - 6);
      normalizedStartDate.setUTCHours(0, 0, 0, 0);
      normalizedEndDate = now;
    }

    // 🔥 Handle null dates for "all" period
    if (normalizedStartDate === null || normalizedEndDate === null) {
      return {
        startDate: null,
        endDate: null,
        startDateStr: null,
        endDateStr: null,
        isSingleDate: false
      };
    }
    
    // 🔥 FIX: Convert to Philippine timezone before extracting date string
    // This ensures dates match the Philippine timezone used in dailyStats
    const phOffset = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
    const startDateInPH = new Date(normalizedStartDate.getTime() + phOffset);
    const endDateInPH = new Date(normalizedEndDate.getTime() + phOffset);
    
    return {
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      startDateStr: startDateInPH.toISOString().split('T')[0],
      endDateStr: endDateInPH.toISOString().split('T')[0],
      isSingleDate: startDateInPH.toISOString().split('T')[0] === endDateInPH.toISOString().split('T')[0]
    };
  }

  /**
   * Optimized aggregation pipeline with proper hints
   */
  static buildOptimizedAggregationPipeline(filters, options = {}) {
    const {
      userId,
      materialIds,
      startDate,
      endDate,
      adId,
      includeQRScans = true,
      includeAdPerformance = true
    } = filters;

    const pipeline = [];

    // Stage 1: Match by materialId (uses index)
    if (materialIds && materialIds.length > 0) {
      pipeline.push({
        $match: {
          materialId: { $in: materialIds }
        }
      });
    }

    // Stage 2: Unwind dailyData early (reduces data size)
    pipeline.push({
      $unwind: '$dailyData'
    });

    // Stage 3: Filter by date range (uses index on dailyData.date)
    if (startDate && endDate) {
      pipeline.push({
        $match: {
          'dailyData.date': {
            $gte: startDate,
            $lte: endDate
          }
        }
      });
    }

    // Stage 4: Filter by userId in adPerformance (if needed)
    if (userId && includeAdPerformance) {
      pipeline.push({
        $match: {
          'dailyData.adPerformance.userId': userId
        }
      });
    }

    // Stage 5: Filter by adId (if specified)
    if (adId && includeAdPerformance) {
      pipeline.push({
        $match: {
          'dailyData.adPerformance.adId': adId
        }
      });
    }

    // Stage 6: Project only needed fields (reduces memory)
    const projectFields = {
      materialId: 1,
      'dailyData.date': 1
    };

    if (includeAdPerformance) {
      projectFields['dailyData.adPerformance'] = 1;
    }

    if (includeQRScans) {
      projectFields['dailyData.qrScans'] = 1;
    }

    pipeline.push({
      $project: projectFields
    });

    // Stage 7: Group by date
    const groupStage = {
      _id: {
        $dateToString: { format: '%Y-%m-%d', date: '$dailyData.date' }
      },
      date: { $first: '$dailyData.date' }
    };

    if (includeAdPerformance) {
      groupStage.adsPlayed = { $sum: '$dailyData.adPerformance.playCount' };
      groupStage.displayTime = { $sum: '$dailyData.adPerformance.totalViewTime' };
      groupStage.impressions = { $sum: '$dailyData.adPerformance.impressions' };
      groupStage.completionRate = { $avg: '$dailyData.adPerformance.completionRate' };
    }

    if (includeQRScans) {
      groupStage.qrScans = { $sum: { $size: { $ifNull: ['$dailyData.qrScans', []] } } };
    }

    pipeline.push({ $group: groupStage });

    // Stage 8: Sort by date
    pipeline.push({
      $sort: { _id: 1 }
    });

    return pipeline;
  }

  /**
   * Get aggregation options with performance hints
   */
  static getAggregationOptions(filters) {
    const options = {
      allowDiskUse: true, // Critical for large datasets
      maxTimeMS: 30000, // 30 seconds timeout
    };

    // Add index hints based on filters
    if (filters.materialIds && filters.materialIds.length > 0) {
      options.hint = { materialId: 1 };
    } else if (filters.startDate && filters.endDate) {
      options.hint = { 'dailyData.date': 1 };
    }

    return options;
  }

  /**
   * Cache management with LRU eviction
   */
  manageCache() {
    const now = Date.now();
    const entries = Array.from(this.queryCache.entries());
    
    // Remove expired entries
    for (const [key, value] of entries) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.queryCache.delete(key);
      }
    }

    // LRU eviction if cache is too large
    if (this.queryCache.size > this.MAX_CACHE_SIZE) {
      const sortedEntries = entries
        .filter(([_, value]) => now - value.timestamp <= this.CACHE_TTL)
        .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
      
      const toRemove = this.queryCache.size - this.MAX_CACHE_SIZE;
      for (let i = 0; i < toRemove; i++) {
        this.queryCache.delete(sortedEntries[i][0]);
      }
    }
  }

  /**
   * Get cached data with access tracking
   */
  getCached(key) {
    this.manageCache(); // Clean up expired entries
    
    const cached = this.queryCache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      cached.lastAccessed = Date.now();
      return cached.data;
    }
    
    if (cached) {
      this.queryCache.delete(key);
    }
    
    return null;
  }

  /**
   * Set cached data
   */
  setCached(key, data) {
    this.manageCache(); // Clean up before adding
    
    this.queryCache.set(key, {
      data,
      timestamp: Date.now(),
      lastAccessed: Date.now()
    });
  }

  /**
   * Track performance metrics
   */
  trackPerformance(operation, duration, metadata = {}) {
    const key = `${operation}_${Date.now()}`;
    this.performanceMetrics.set(key, {
      operation,
      duration,
      timestamp: Date.now(),
      ...metadata
    });

    // Keep only last 100 metrics
    if (this.performanceMetrics.size > 100) {
      const oldestKey = Array.from(this.performanceMetrics.keys())[0];
      this.performanceMetrics.delete(oldestKey);
    }

    // Log slow operations
    if (duration > 5000) {
      console.warn(`⚠️ [AnalyticsOptimizer] Slow operation detected: ${operation} took ${duration}ms`, metadata);
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    const metrics = Array.from(this.performanceMetrics.values());
    if (metrics.length === 0) return null;

    const avgDuration = metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length;
    const maxDuration = Math.max(...metrics.map(m => m.duration));
    const minDuration = Math.min(...metrics.map(m => m.duration));

    return {
      totalOperations: metrics.length,
      averageDuration: avgDuration,
      maxDuration,
      minDuration,
      cacheSize: this.queryCache.size,
      cacheHitRate: this.calculateCacheHitRate()
    };
  }

  /**
   * Calculate cache hit rate
   */
  calculateCacheHitRate() {
    // This would need to track hits/misses - simplified for now
    return 0;
  }

  /**
   * Clear cache for specific user
   */
  clearUserCache(userId) {
    for (const [key] of this.queryCache.entries()) {
      if (key.includes(`_${userId}_`)) {
        this.queryCache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clearAllCache() {
    this.queryCache.clear();
  }
}

// Singleton instance
const optimizer = new AnalyticsOptimizer();

module.exports = {
  AnalyticsOptimizer,
  optimizer
};

