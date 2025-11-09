const mongoose = require('mongoose');
const TimeSeriesEvent = require('../models/TimeSeriesEvent');
const { createLogger, format, transports } = require('winston');

// Configure logger
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'metrics-aggregator.log' })
  ]
});

class MetricsAggregator {
  constructor() {
    this.PreAggregatedMetric = this.createPreAggregatedMetricModel();
  }

  createPreAggregatedMetricModel() {
    const schema = new mongoose.Schema({
      metricType: { type: String, required: true, index: true },
      timeWindow: { type: String, required: true, enum: ['hourly', 'daily', 'weekly', 'monthly'] },
      timestamp: { type: Date, required: true, index: true },
      dimensions: { type: Map, of: String },
      metrics: { type: Map, of: mongoose.Schema.Types.Mixed },
      lastUpdated: { type: Date, default: Date.now }
    }, { timestamps: true });

    // Compound index for fast lookups
    schema.index({ metricType: 1, timeWindow: 1, timestamp: 1 });
    
    // Add method to get metric key
    schema.methods.getMetricKey = function() {
      return `${this.metricType}:${this.timeWindow}:${this.timestamp.toISOString()}`;
    };

    return mongoose.models.PreAggregatedMetric || 
      mongoose.model('PreAggregatedMetric', schema, 'pre_aggregated_metrics');
  }

  /**
   * Aggregate ad playback metrics
   */
  async aggregateAdPlaybackMetrics(startDate, endDate) {
    const pipeline = [
      {
        $match: {
          eventType: 'AD_PLAYBACK',
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $project: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          hour: { $hour: '$timestamp' },
          materialId: 1,
          adId: 1,
          deviceId: 1,
          duration: '$data.adDuration',
          viewTime: '$data.viewTime',
          completionRate: {
            $cond: [
              { $gt: ['$data.adDuration', 0] },
              { $divide: ['$data.viewTime', '$data.adDuration'] },
              0
            ]
          }
        }
      },
      {
        $group: {
          _id: {
            date: '$date',
            hour: '$hour',
            materialId: '$materialId',
            adId: '$adId',
            deviceId: '$deviceId'
          },
          playCount: { $sum: 1 },
          totalViewTime: { $sum: '$viewTime' },
          avgViewTime: { $avg: '$viewTime' },
          avgCompletionRate: { $avg: '$completionRate' },
          uniqueDevices: { $addToSet: '$deviceId' }
        }
      },
      {
        $project: {
          _id: 0,
          timestamp: { $dateFromString: { dateString: '$_id.date' } },
          hour: '$_id.hour',
          materialId: '$_id.materialId',
          adId: '$_id.adId',
          deviceId: '$_id.deviceId',
          playCount: 1,
          totalViewTime: 1,
          avgViewTime: 1,
          avgCompletionRate: 1,
          uniqueDeviceCount: { $size: '$uniqueDevices' }
        }
      }
    ];

    try {
      const results = await TimeSeriesEvent.aggregate(pipeline);
      await this.saveAggregatedMetrics('ad_playback', 'hourly', results);
      return results;
    } catch (error) {
      logger.error('Error aggregating ad playback metrics:', error);
      throw error;
    }
  }

  /**
   * Save aggregated metrics to the database
   */
  async saveAggregatedMetrics(metricType, timeWindow, data) {
    const operations = data.map(item => {
      const dimensions = { ...item };
      const metrics = { ...item };
      
      // Remove non-dimension fields
      ['_id', 'timestamp', 'hour', 'playCount', 'totalViewTime', 'avgViewTime', 'avgCompletionRate', 'uniqueDeviceCount'].forEach(field => {
        delete metrics[field];
      });
      
      return {
        updateOne: {
          filter: {
            metricType,
            timeWindow,
            timestamp: item.timestamp,
            ...Object.entries(dimensions).reduce((acc, [key, value]) => {
              if (['_id', 'timestamp', 'hour', 'playCount', 'totalViewTime', 'avgViewTime', 'avgCompletionRate', 'uniqueDeviceCount'].includes(key)) {
                return acc;
              }
              acc[`dimensions.${key}`] = value;
              return acc;
            }, {})
          },
          update: {
            $set: {
              metricType,
              timeWindow,
              timestamp: item.timestamp,
              dimensions: new Map(Object.entries(dimensions).filter(([key]) => 
                !['_id', 'timestamp', 'hour', 'playCount', 'totalViewTime', 'avgViewTime', 'avgCompletionRate', 'uniqueDeviceCount'].includes(key)
              )),
              metrics: {
                playCount: item.playCount || 0,
                totalViewTime: item.totalViewTime || 0,
                avgViewTime: item.avgViewTime || 0,
                avgCompletionRate: item.avgCompletionRate || 0,
                uniqueDeviceCount: item.uniqueDeviceCount || 0
              },
              lastUpdated: new Date()
            },
            $setOnInsert: {
              createdAt: new Date()
            }
          },
          upsert: true
        }
      };
    });

    if (operations.length === 0) return [];

    try {
      const result = await this.PreAggregatedMetric.bulkWrite(operations, { ordered: false });
      logger.info(`Saved ${result.upsertedCount + result.modifiedCount} ${metricType} metrics`);
      return result;
    } catch (error) {
      logger.error('Error saving aggregated metrics:', error);
      throw error;
    }
  }

  /**
   * Run all aggregation jobs
   */
  async runAllAggregations() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000));
    const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    const oneWeekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

    try {
      logger.info('Starting metrics aggregation...');
      
      // Hourly aggregations (last hour)
      logger.info('Running hourly aggregations...');
      await this.aggregateAdPlaybackMetrics(oneHourAgo, now);
      
      // Daily aggregations (last 24 hours)
      logger.info('Running daily aggregations...');
      await this.aggregateAdPlaybackMetrics(oneDayAgo, now);
      
      // Weekly aggregations (last 7 days)
      logger.info('Running weekly aggregations...');
      await this.aggregateAdPlaybackMetrics(oneWeekAgo, now);
      
      logger.info('All aggregations completed successfully');
    } catch (error) {
      logger.error('Error running aggregations:', error);
      throw error;
    }
  }
}

// Export a singleton instance
module.exports = new MetricsAggregator();
