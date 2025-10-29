const mongoose = require('mongoose');

const driverReportSchema = new mongoose.Schema({
  driverId: {
    type: String,
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  reportType: {
    type: String,
    required: true,
    enum: ['BUG', 'PAYMENT', 'ACCOUNT', 'VEHICLE_ISSUE', 'MATERIAL_ISSUE', 'APP_ISSUE', 'REQUEST_ACCOUNT_CLOSURE', 'UPDATE_PROFILE_DETAILS', 'OTHER'],
    index: true
  },
  status: {
    type: String,
    required: true,
    enum: ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    default: 'PENDING',
    index: true
  },
  attachments: [{
    type: String,
    validate: {
      validator: function(v) {
        // Validate that attachments are URLs (could be Firebase Storage URLs)
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: 'Attachments must be valid URLs'
    }
  }],
  adminNotes: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  adminNotesUpdatedAt: {
    type: Date,
    default: null
  },
  adminNotesBy: {
    adminId: String,
    adminName: String,
    adminEmail: String
  },
  resolvedAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
driverReportSchema.index({ driverId: 1, createdAt: -1 });
driverReportSchema.index({ status: 1, createdAt: -1 });
driverReportSchema.index({ reportType: 1, status: 1 });

// Static methods for queries
driverReportSchema.statics.getDriverReports = function(driverId, filters = {}, options = {}) {
  const query = { driverId };
  
  // Apply filters
  if (filters.reportType) query.reportType = filters.reportType;
  if (filters.status) query.status = filters.status;
  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
  }
  
  const { limit = 50, offset = 0 } = options;
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit);
};

driverReportSchema.statics.getDriverReportCount = function(driverId, filters = {}) {
  const query = { driverId };
  
  if (filters.reportType) query.reportType = filters.reportType;
  if (filters.status) query.status = filters.status;
  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
  }
  
  return this.countDocuments(query);
};

driverReportSchema.statics.getAllReports = function(filters = {}, options = {}) {
  const query = {};
  
  if (filters.reportType) query.reportType = filters.reportType;
  if (filters.status) query.status = filters.status;
  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
  }
  
  const { limit = 50, offset = 0 } = options;
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit);
};

driverReportSchema.statics.getAllReportsCount = function(filters = {}) {
  const query = {};
  
  if (filters.reportType) query.reportType = filters.reportType;
  if (filters.status) query.status = filters.status;
  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
  }
  
  return this.countDocuments(query);
};

module.exports = mongoose.model('DriverReport', driverReportSchema);

