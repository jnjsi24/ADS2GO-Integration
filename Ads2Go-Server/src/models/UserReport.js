const mongoose = require('mongoose');

const userReportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
    enum: ['BUG', 'PAYMENT', 'ACCOUNT', 'CONTENT_VIOLATION', 'FEATURE_REQUEST', 'OTHER'],
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
  resolvedAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
userReportSchema.index({ userId: 1, createdAt: -1 });
userReportSchema.index({ status: 1, priority: 1 });
userReportSchema.index({ reportType: 1, status: 1 });

// Virtual for user relationship
userReportSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Pre-save middleware to set resolvedAt when status changes to RESOLVED or CLOSED
userReportSchema.pre('save', function(next) {
  if (this.isModified('status') && ['RESOLVED', 'CLOSED'].includes(this.status) && !this.resolvedAt) {
    this.resolvedAt = new Date();
  }
  next();
});

// Instance methods
userReportSchema.methods.canBeModifiedByUser = function() {
  return this.status === 'PENDING';
};

userReportSchema.methods.canBeDeletedByUser = function() {
  return this.status === 'PENDING';
};

// Static methods
userReportSchema.statics.getUserReports = function(userId, filters = {}, options = {}) {
  const query = { userId };
  
  if (filters.reportType) {
    query.reportType = filters.reportType;
  }
  
  if (filters.status) {
    query.status = filters.status;
  }
  
  
  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) {
      query.createdAt.$gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      query.createdAt.$lte = new Date(filters.endDate);
    }
  }
  
  return this.find(query)
    .populate('user', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .limit(options.limit || 50)
    .skip(options.offset || 0);
};

userReportSchema.statics.getUserReportCount = function(userId, filters = {}) {
  const query = { userId };
  
  if (filters.reportType) {
    query.reportType = filters.reportType;
  }
  
  if (filters.status) {
    query.status = filters.status;
  }
  
  
  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) {
      query.createdAt.$gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      query.createdAt.$lte = new Date(filters.endDate);
    }
  }
  
  return this.countDocuments(query);
};

module.exports = mongoose.model('UserReport', userReportSchema);
