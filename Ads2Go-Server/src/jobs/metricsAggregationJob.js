const { CronJob } = require('cron');
const MetricsAggregator = require('../services/MetricsAggregator');
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
    new transports.File({ filename: 'metrics-aggregation-job.log' })
  ]
});

class MetricsAggregationJob {
  constructor() {
    this.job = null;
    this.isRunning = false;
  }

  /**
   * Start the scheduled job
   * @param {string} schedule - Cron schedule expression (default: every hour at minute 5)
   */
  start(schedule = '5 * * * *') {
    if (this.job) {
      logger.warn('Metrics aggregation job is already running');
      return;
    }

    this.job = new CronJob(
      schedule,
      async () => {
        if (this.isRunning) {
          logger.warn('Previous metrics aggregation job is still running, skipping this run');
          return;
        }

        this.isRunning = true;
        const startTime = Date.now();
        
        try {
          logger.info('Starting metrics aggregation job...');
          await MetricsAggregator.runAllAggregations();
          const duration = Math.round((Date.now() - startTime) / 1000);
          logger.info(`Metrics aggregation completed in ${duration} seconds`);
        } catch (error) {
          logger.error('Error in metrics aggregation job:', error);
        } finally {
          this.isRunning = false;
        }
      },
      null, // onComplete
      true, // start
      'UTC' // timeZone
    );

    logger.info(`Metrics aggregation job started with schedule: ${schedule}`);
  }

  /**
   * Stop the scheduled job
   */
  stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
      logger.info('Metrics aggregation job stopped');
    }
  }

  /**
   * Run the job immediately
   */
  async runNow() {
    if (this.isRunning) {
      throw new Error('Job is already running');
    }

    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      logger.info('Running metrics aggregation job now...');
      await MetricsAggregator.runAllAggregations();
      const duration = Math.round((Date.now() - startTime) / 1000);
      logger.info(`Metrics aggregation completed in ${duration} seconds`);
      return { success: true, duration };
    } catch (error) {
      logger.error('Error running metrics aggregation job:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }
}

// Export a singleton instance
const metricsAggregationJob = new MetricsAggregationJob();

// Start the job when this module is loaded (if enabled)
if (process.env.ENABLE_METRICS_AGGREGATION === 'true') {
  metricsAggregationJob.start(process.env.METRICS_AGGREGATION_SCHEDULE);
}

module.exports = metricsAggregationJob;
