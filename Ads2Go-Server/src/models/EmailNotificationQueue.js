const mongoose = require('mongoose');

const EmailNotificationQueueSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userRole: {
    type: String,
    required: true,
    enum: ['USER', 'DRIVER', 'ADMIN', 'SUPERADMIN']
  },
  email: {
    type: String,
    required: true
  },
  firstName: {
    type: String,
    required: true
  },
  notificationType: {
    type: String,
    required: true,
    enum: [
      'AD_APPROVAL',
      'AD_REJECTION', 
      'PAYMENT_CONFIRMATION',
      'PROFILE_CHANGE',
      'MATERIAL_ASSIGNMENT',
      'DRIVER_STATUS_CHANGE',
      'NEW_AD_SUBMISSION',
      'NEW_USER_REGISTRATION',
      'NEW_DRIVER_APPLICATION',
      'PAYMENT_SUCCESS',
      'PAYMENT_FAILURE',
      'PAYMENT_ISSUE',
      'SYSTEM_ALERT',
      'ADMIN_ACTIVITY',
      'CRITICAL_ISSUE',
      'SYSTEM_REPORT',
      'SECURITY_ALERT',
      'DATABASE_ISSUE',
      'REPORT_STATUS_UPDATE',
      'NEW_USER_REPORT'
    ]
  },
  emailData: {
    subject: String,
    html: String,
    // Store any additional data needed for the email template
    templateData: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  priority: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'MEDIUM'
  },
  attempts: {
    type: Number,
    default: 0
  },
  maxAttempts: {
    type: Number,
    default: 3
  },
  status: {
    type: String,
    enum: ['PENDING', 'SENT', 'FAILED', 'CANCELLED'],
    default: 'PENDING'
  },
  lastAttemptAt: Date,
  sentAt: Date,
  errorMessage: String,
  // Store the original notification data for reference
  originalNotificationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserNotifications.notifications'
  }
}, {
  timestamps: true
});

// Index for efficient queries
EmailNotificationQueueSchema.index({ userId: 1, status: 1 });
EmailNotificationQueueSchema.index({ createdAt: 1 });
EmailNotificationQueueSchema.index({ priority: 1, status: 1 });

module.exports = mongoose.model('EmailNotificationQueue', EmailNotificationQueueSchema);
