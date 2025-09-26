const mongoose = require('mongoose');

const newsletterSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  subscribedAt: {
    type: Date,
    default: Date.now
  },
  unsubscribedAt: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  source: {
    type: String,
    enum: ['landing_page', 'contact_form', 'registration', 'manual', 'existing_user_migration'],
    default: 'landing_page'
  },
  preferences: {
    frequency: {
      type: String,
      enum: ['weekly', 'monthly', 'quarterly'],
      default: 'monthly'
    },
    categories: [{
      type: String,
      enum: ['product_updates', 'industry_news', 'promotions', 'company_news']
    }]
  },
  lastEmailSent: {
    type: Date,
    default: null
  },
  emailCount: {
    type: Number,
    default: 0
  },
  metadata: {
    ipAddress: String,
    userAgent: String,
    referrer: String
  }
}, {
  timestamps: true
});

// Index for efficient queries
newsletterSchema.index({ email: 1, isActive: 1 });
newsletterSchema.index({ subscribedAt: -1 });
newsletterSchema.index({ source: 1 });

// Virtual for subscription duration
newsletterSchema.virtual('subscriptionDuration').get(function() {
  if (!this.isActive && this.unsubscribedAt) {
    return this.unsubscribedAt - this.subscribedAt;
  }
  return Date.now() - this.subscribedAt;
});

// Method to check if email is valid
newsletterSchema.statics.isValidEmail = function(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Method to get active subscribers count
newsletterSchema.statics.getActiveSubscribersCount = function() {
  return this.countDocuments({ isActive: true });
};

// Method to get subscribers by source
newsletterSchema.statics.getSubscribersBySource = function() {
  return this.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$source', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
};

// Pre-save middleware to validate email
newsletterSchema.pre('save', function(next) {
  if (!Newsletter.isValidEmail(this.email)) {
    const error = new Error('Invalid email format');
    return next(error);
  }
  next();
});

const Newsletter = mongoose.model('Newsletter', newsletterSchema);

module.exports = Newsletter;
