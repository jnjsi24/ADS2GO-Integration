const TimeSeriesEvent = require('../models/TimeSeriesEvent');
const { EventEmitter } = require('events');

class TimeSeriesService extends EventEmitter {
  constructor() {
    super();
    this.pendingWrites = [];
    this.batchSize = 100;
    this.batchTimeout = 1000; // 1 second
    this.batchTimer = null;
  }

  /**
   * Record a new time-series event
   * @param {string} eventType - Type of the event (AD_PLAYBACK, QR_SCAN, etc.)
   * @param {Object} data - Event-specific data
   * @param {Object} metadata - Additional metadata for query optimization
   * @returns {Promise<Document>} - The created event document
   */
  async recordEvent(eventType, data, metadata = {}) {
    try {
      const event = await TimeSeriesEvent.createEvent(eventType, data, metadata);
      this.emit('eventRecorded', event);
      return event;
    } catch (error) {
      console.error('Error recording event:', error);
      throw error;
    }
  }

  /**
   * Record multiple events in a batch
   * @param {Array} events - Array of { eventType, data, metadata } objects
   * @returns {Promise<Array>} - Array of created event documents
   */
  async recordEvents(events) {
    if (!Array.isArray(events) || events.length === 0) {
      return [];
    }

    try {
      const eventDocs = await Promise.all(
        events.map(({ eventType, data, metadata }) => 
          TimeSeriesEvent.createEvent(eventType, data, metadata)
        )
      );
      
      this.emit('eventsRecorded', eventDocs);
      return eventDocs;
    } catch (error) {
      console.error('Error recording batch events:', error);
      throw error;
    }
  }

  /**
   * Queue an event for batch processing
   * @param {string} eventType - Type of the event
   * @param {Object} data - Event data
   * @param {Object} metadata - Event metadata
   */
  queueEvent(eventType, data, metadata = {}) {
    this.pendingWrites.push({ eventType, data, metadata });
    
    // If we've reached batch size, process immediately
    if (this.pendingWrites.length >= this.batchSize) {
      this.processBatch();
      return;
    }
    
    // Otherwise, set a timer if one isn't already set
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.processBatch(), this.batchTimeout);
    }
  }

  /**
   * Process the current batch of queued events
   * @private
   */
  async processBatch() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.pendingWrites.length === 0) {
      return;
    }

    // Get the current batch and clear the queue
    const batch = [...this.pendingWrites];
    this.pendingWrites = [];

    try {
      const results = await this.recordEvents(batch);
      this.emit('batchProcessed', { success: true, count: results.length });
    } catch (error) {
      console.error('Error processing batch:', error);
      this.emit('batchError', { error, batch });
      
      // Optionally implement retry logic here
    }
  }

  /**
   * Get events with filtering and pagination
   * @param {Object} filter - MongoDB query filter
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Query results with pagination info
   */
  async getEvents(filter = {}, options = {}) {
    const {
      page = 1,
      limit = 100,
      sort = { timestamp: -1 },
      select = {},
      lean = true
    } = options;

    const skip = (page - 1) * limit;
    
    const [total, items] = await Promise.all([
      TimeSeriesEvent.countDocuments(filter),
      TimeSeriesEvent.find(filter)
        .select(select)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(lean)
    ]);

    const totalPages = Math.ceil(total / limit);
    
    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    };
  }

  /**
   * Get aggregated metrics for a time period
   * @param {Date} startDate - Start of time period
   * @param {Date} endDate - End of time period
   * @param {Object} groupBy - Fields to group by
   * @param {Object} match - Additional match criteria
   * @returns {Promise<Array>} - Aggregated results
   */
  async getAggregatedMetrics(startDate, endDate, groupBy = {}, match = {}) {
    const pipeline = [
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate },
          ...match
        }
      },
      {
        $group: {
          _id: groupBy,
          count: { $sum: 1 },
          // Add more aggregations as needed
          firstSeen: { $min: '$timestamp' },
          lastSeen: { $max: '$timestamp' }
        }
      },
      { $sort: { '_id': 1 } }
    ];

    return TimeSeriesEvent.aggregate(pipeline);
  }
}

// Export a singleton instance
module.exports = new TimeSeriesService();
