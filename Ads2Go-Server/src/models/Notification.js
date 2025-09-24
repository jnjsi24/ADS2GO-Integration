const mongoose = require('mongoose');

// Schema for individual notification items
const NotificationItemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['SUCCESS', 'INFO', 'WARNING', 'ERROR'],
    default: 'INFO',
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      // User categories
      'AD_APPROVAL', 'AD_REJECTION', 'PAYMENT_CONFIRMATION', 'AD_PERFORMANCE',
      // Driver categories
      'MATERIAL_ASSIGNMENT', 'ROUTE_UPDATE', 'DEVICE_ISSUE', 'DRIVER_STATUS_CHANGE',
      // Admin categories
      'NEW_AD_SUBMISSION', 'NEW_USER_REGISTRATION', 'NEW_DRIVER_APPLICATION', 'PAYMENT_ISSUE', 'SYSTEM_ALERT',
      // SuperAdmin categories
      'ADMIN_ACTIVITY', 'CRITICAL_ISSUE', 'SYSTEM_REPORT', 'SECURITY_ALERT', 'DATABASE_ISSUE'
    ]
  },
  priority: {
    type: String,
    enum: ['HIGH', 'MEDIUM', 'LOW'],
    default: 'MEDIUM',
    required: true
  },
  read: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date,
    default: null
  },
  // Optional: Link to related ad
  adId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ad',
    default: null
  },
  adTitle: {
    type: String,
    default: null
  },
  // Optional: Additional data
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Main schema for user notifications (one document per user)
const UserNotificationsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Can reference User, Driver, Admin, or SuperAdmin
    required: true,
    unique: true
  },
  userRole: {
    type: String,
    required: true,
    enum: ['USER', 'DRIVER', 'ADMIN', 'SUPERADMIN']
  },
  notifications: [NotificationItemSchema],
  unreadCount: {
    type: Number,
    default: 0
  },
  notificationPreferences: {
    email: {
      type: Boolean,
      default: true
    },
    inApp: {
      type: Boolean,
      default: true
    },
    categories: [{
      type: String,
      enum: [
        'AD_APPROVAL', 'AD_REJECTION', 'PAYMENT_CONFIRMATION', 'AD_PERFORMANCE',
        'MATERIAL_ASSIGNMENT', 'ROUTE_UPDATE', 'DEVICE_ISSUE', 'DRIVER_STATUS_CHANGE',
        'NEW_AD_SUBMISSION', 'NEW_USER_REGISTRATION', 'NEW_DRIVER_APPLICATION', 'PAYMENT_ISSUE', 'SYSTEM_ALERT',
        'ADMIN_ACTIVITY', 'CRITICAL_ISSUE', 'SYSTEM_REPORT', 'SECURITY_ALERT', 'DATABASE_ISSUE'
      ]
    }]
  }
}, {
  timestamps: true
});

// Index for efficient queries
UserNotificationsSchema.index({ userId: 1 });
UserNotificationsSchema.index({ 'notifications.createdAt': -1 });

module.exports = mongoose.model('UserNotifications', UserNotificationsSchema, 'notifications');
