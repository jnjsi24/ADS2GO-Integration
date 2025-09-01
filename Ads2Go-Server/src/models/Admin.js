const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const AdminSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    minlength: [2, 'First name must be at least 2 characters long'],
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  middleName: {
    type: String,
    trim: true,
    default: null,
    minlength: [2, 'Middle name must be at least 2 characters long'],
    maxlength: [50, 'Middle name cannot exceed 50 characters']
  },  
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    minlength: [2, 'Last name must be at least 2 characters long'],
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  companyName: {
    type: String,
    required: [true, 'Company/Business name is required'],
    trim: true,
    minlength: [2, 'Company name must be at least 2 characters long']
  },
  companyAddress: {
    type: String,
    required: [true, 'Company/Business address is required'],
    trim: true,
    minlength: [10, 'Company address must be at least 10 characters long']
  },
  contactNumber: {
    type: String,
    required: [true, 'Contact number is required'],
    trim: true,
    match: [/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/, 'Please provide a valid phone number']
  },
  profilePicture: {
    type: String,
    default: null
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long']
  },
  role: {
    type: String,
    enum: ['ADMIN'],
    default: 'ADMIN'
  },
  isEmailVerified: {
    type: Boolean,
    default: true // Admins are pre-verified
  },
  permissions: {
    userManagement: {
      type: Boolean,
      default: true
    },
    adManagement: {
      type: Boolean,
      default: true
    },
    driverManagement: {
      type: Boolean,
      default: true
    },
    tabletManagement: {
      type: Boolean,
      default: true
    },
    paymentManagement: {
      type: Boolean,
      default: true
    },
    reports: {
      type: Boolean,
      default: true
    }
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  accountLocked: {
    type: Boolean,
    default: false
  },
  lockUntil: {
    type: Date,
    default: null
  },
  lastLogin: {
    type: Date,
    default: null
  },
  tokenVersion: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  methods: {
    isLocked() {
      return this.accountLocked && this.lockUntil && this.lockUntil > new Date();
    }
  }
});

// Pre-save hook to update updatedAt
AdminSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Ensure email uniqueness (case-insensitive)
AdminSchema.index({ email: 1 }, { unique: true });

const Admin = mongoose.model('Admin', AdminSchema);

module.exports = Admin;
