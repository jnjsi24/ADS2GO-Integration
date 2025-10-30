const mongoose = require('mongoose');

const contactMessageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  status: {
    type: String,
    required: true,
    enum: ['PENDING', 'IN_PROGRESS', 'RESOLVED'],
    default: 'PENDING',
    index: true
  },
  category: {
    type: String,
    default: 'GENERAL_INQUIRIES',
    immutable: true
  },
  // Admin reply (sent once via popup)
  adminReply: {
    subject: {
      type: String,
      trim: true,
      maxlength: 200
    },
    message: {
      type: String,
      trim: true,
      maxlength: 5000
    },
    sentBy: {
      adminId: String,
      adminName: String,
      adminEmail: String
    },
    sentAt: Date
  },
  // When admin manually marks as resolved
  resolvedAt: {
    type: Date,
    default: null
  },
  resolvedBy: {
    adminId: String,
    adminName: String,
    adminEmail: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
contactMessageSchema.index({ email: 1, createdAt: -1 });
contactMessageSchema.index({ status: 1, createdAt: -1 });
contactMessageSchema.index({ createdAt: -1 });

// Pre-save middleware to set resolvedAt when status changes to RESOLVED
contactMessageSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'RESOLVED' && !this.resolvedAt) {
    this.resolvedAt = new Date();
  }
  next();
});

// Static method to get all contact messages with filters
contactMessageSchema.statics.getAllMessages = function(filters = {}, options = {}) {
  const query = {};
  
  if (filters.status) {
    query.status = filters.status;
  }
  
  if (filters.email) {
    query.email = new RegExp(filters.email, 'i');
  }
  
  if (filters.name) {
    query.name = new RegExp(filters.name, 'i');
  }
  
  const { limit = 50, offset = 0, sort = { createdAt: -1 } } = options;
  
  return this.find(query)
    .sort(sort)
    .limit(limit)
    .skip(offset);
};

// Static method to get message count by status
contactMessageSchema.statics.getStatusCounts = async function() {
  const result = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const counts = {
    pending: 0,
    inProgress: 0,
    resolved: 0,
    total: 0
  };
  
  result.forEach(item => {
    const status = item._id.toLowerCase().replace('_', '');
    counts[status] = item.count;
    counts.total += item.count;
  });
  
  return counts;
};

const ContactMessage = mongoose.model('ContactMessage', contactMessageSchema);

module.exports = ContactMessage;

