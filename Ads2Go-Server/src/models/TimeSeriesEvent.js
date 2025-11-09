const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Base schema for all time-series events
const TimeSeriesEventSchema = new Schema({
  // Event metadata
  eventType: {
    type: String,
    required: true,
    enum: ['AD_PLAYBACK', 'QR_SCAN', 'DEVICE_STATUS', 'MATERIAL_USAGE'],
    index: true
  },
  timestamp: {
    type: Date,
    required: true,
    index: true
  },
  
  // Common identifiers
  materialId: {
    type: String,
    index: true
  },
  deviceId: {
    type: String,
    index: true
  },
  userId: {
    type: String,
    index: true
  },
  adId: {
    type: String,
    index: true
  },
  
  // Event-specific data (using schema-less for flexibility)
  data: {
    type: Schema.Types.Mixed,
    required: true
  },
  
  // Metadata for query optimization
  metadata: {
    date: {
      type: Date,
      required: true,
      index: true
    },
    hour: {
      type: Number,
      index: true
    },
    dayOfWeek: {
      type: Number,
      index: true
    },
    isWeekend: {
      type: Boolean,
      index: true
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number] // [longitude, latitude]
      }
    },
    locationName: String
  }
}, {
  timestamps: true,
  // Enable sharding
  shardKey: { materialId: 1, timestamp: 1 }
});

// 2dsphere index for location-based queries
TimeSeriesEventSchema.index({ 'metadata.location': '2dsphere' });

// Compound index for common query patterns
TimeSeriesEventSchema.index({ eventType: 1, timestamp: -1 });
TimeSeriesEventSchema.index({ materialId: 1, timestamp: -1 });
TimeSeriesEventSchema.index({ deviceId: 1, timestamp: -1 });
TimeSeriesEventSchema.index({ userId: 1, timestamp: -1 });
TimeSeriesEventSchema.index({ 'metadata.date': 1, eventType: 1 });

// TTL index for automatic data expiration (1 year retention)
TimeSeriesEventSchema.index(
  { timestamp: 1 },
  { 
    expireAfterSeconds: 60 * 60 * 24 * 365, // 1 year
    partialFilterExpression: { 
      eventType: { $in: ['AD_PLAYBACK', 'QR_SCAN'] } 
    }
  }
);

/**
 * Prepare an event document for bulk operations without saving it
 * @param {string} eventType - Type of the event
 * @param {Object} data - Event data
 * @param {Object} metadata - Additional metadata
 * @returns {Object} Prepared event document
 */
TimeSeriesEventSchema.statics.prepareEvent = function(eventType, data, metadata = {}) {
  const now = new Date();
  return {
    eventType,
    timestamp: now,
    data,
    metadata: {
      date: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      hour: now.getHours(),
      dayOfWeek: now.getDay(),
      isWeekend: [0, 6].includes(now.getDay()),
      ...metadata
    },
    // Copy common fields from data to top level for indexing
    materialId: data.materialId,
    deviceId: data.deviceId,
    userId: data.userId,
    adId: data.adId,
    createdAt: now,
    updatedAt: now
  };
};

/**
 * Create and save a new event
 * @param {string} eventType - Type of the event
 * @param {Object} data - Event data
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Document>} The created event document
 */
TimeSeriesEventSchema.statics.createEvent = async function(eventType, data, metadata = {}) {
  const event = new this(this.prepareEvent(eventType, data, metadata));
  return event.save();
};

// Example method for querying events
TimeSeriesEventSchema.statics.findByMaterial = function(materialId, startDate, endDate, options = {}) {
  const query = {
    materialId,
    timestamp: {
      $gte: startDate,
      $lte: endDate
    }
  };
  
  if (options.eventType) {
    query.eventType = options.eventType;
  }
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(options.limit || 1000);
};

module.exports = mongoose.models.TimeSeriesEvent || 
  mongoose.model('TimeSeriesEvent', TimeSeriesEventSchema, 'time_series_events');
