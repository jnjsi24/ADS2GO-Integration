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
    ref: 'User',
    required: true,
    unique: true
  },
  notifications: [NotificationItemSchema],
  unreadCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for efficient queries
UserNotificationsSchema.index({ userId: 1 });
UserNotificationsSchema.index({ 'notifications.createdAt': -1 });

module.exports = mongoose.model('UserNotifications', UserNotificationsSchema, 'usernotifications');
