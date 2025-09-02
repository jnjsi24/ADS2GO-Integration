const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Pre-save hook to validate material assignment
const validateMaterialAssignment = function(next) {
  // Skip validation for new documents
  if (this.isNew) return next();

  // If materialId is being modified
  if (this.isModified('materialId') && this.materialId) {
    // Check if driver is approved and email is verified
    if (this.accountStatus !== 'ACTIVE' || this.reviewStatus !== 'APPROVED' || !this.isEmailVerified) {
      const err = new Error('Cannot assign material to an unapproved or unverified driver');
      return next(err);
    }
  }
  next();
};

// Pre-save hook to validate required fields based on status
const validateRequiredFields = function(next) {
  // Skip validation for new documents
  if (this.isNew) return next();

  // Only validate required fields if driver is being approved or is active
  if (this.accountStatus === 'ACTIVE' && this.reviewStatus === 'APPROVED') {
    if (!this.orCrPictureURL) {
      return next(new Error('orCrPictureURL is required for approved drivers'));
    }
    if (!this.qrCodeIdentifier) {
      return next(new Error('qrCodeIdentifier is required for approved drivers'));
    }
  }
  
  next();
};

const DriverSchema = new mongoose.Schema(
  {
    driverId: { type: String, unique: true, trim: true, uppercase: true },
    materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', default: null }, // Changed to ObjectId ref

    firstName: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
    middleName: { type: String, trim: true, maxlength: 50 },
    lastName: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
    contactNumber: { type: String, required: true, trim: true, match: [/^\+?[0-9]{10,15}$/, 'Invalid phone number'] },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, match: [/^\S+@\S+\.\S+$/, 'Invalid email'] },
    password: { type: String, required: true, minlength: 6, select: false },
    address: { type: String, required: true, trim: true, minlength: 10 },
    profilePicture: { type: String, trim: true, default: null }, // Stores the URL after upload processing

    licenseNumber: { type: String, required: true, trim: true, uppercase: true },
    licensePictureURL: { type: String, required: true, trim: true }, // Stores the URL after upload processing
    vehiclePlateNumber: { type: String, required: true, trim: true, uppercase: true },
    vehicleType: { type: String, required: true, enum: ['CAR', 'MOTORCYCLE', 'BUS', 'JEEP', 'E_TRIKE'], set: v => v.toUpperCase() },
    vehicleModel: { type: String, required: true, trim: true },
    vehicleYear: { type: Number, required: true, min: 1900 },
    vehiclePhotoURL: { type: String, required: true, trim: true }, // Stores the URL after upload processing
    orCrPictureURL: { type: String, required: false, trim: true }, // Stores the URL after upload processing

    accountStatus: { type: String, enum: ['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'RESUBMITTED'], default: 'PENDING' },
    reviewStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED', 'RESUBMITTED'], default: 'PENDING' },
    approvalDate: Date,
    rejectedReason: String,
    resubmissionFiles: { type: [String], default: [] },

    dateJoined: { type: Date, default: Date.now },
    currentBalance: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },

    qrCodeIdentifier: { type: String, required: false, trim: true },

    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationCode: { type: String, select: false },
    emailVerificationCodeExpires: Date,
    emailVerificationAttempts: { type: Number, default: 0 },

    loginAttempts: { type: Number, default: 0 },
    accountLocked: { type: Boolean, default: false },
    lockUntil: Date,
    lastLogin: Date,

    tokenVersion: { type: Number, default: 0 },

    // Material-related fields - updated enum values to match GraphQL schema
    installedMaterialType: { 
      type: String, 
      enum: ['LCD', 'BANNER', 'HEADDRESS', 'STICKER', 'POSTER'], // Added POSTER to match GraphQL
      default: null 
    },
    preferredMaterialType: { 
      type: [String], 
      enum: ['LCD', 'BANNER', 'HEADDRESS', 'STICKER', 'POSTER'], // Added POSTER to match GraphQL
      default: [] 
    },
    adminOverrideMaterialType: { 
      type: [String], // Changed to array to match GraphQL schema
      enum: ['LCD', 'BANNER', 'HEADDRESS', 'STICKER', 'POSTER'], // Added POSTER to match GraphQL
      default: null 
    },
    adminOverride: { type: Boolean, default: false },

    editRequestStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: null },
    editRequestData: {
      firstName: String,
      middleName: String,
      lastName: String,
      contactNumber: String,
      email: String, // Added to match GraphQL schema
      address: String,
      profilePicture: String,
      licenseNumber: String, // Added to match GraphQL schema
      licensePictureURL: String, // Added to match GraphQL schema
      vehiclePlateNumber: String, // Added to match GraphQL schema
      vehicleType: { type: String, enum: ['CAR', 'MOTORCYCLE', 'BUS', 'JEEP', 'E_TRIKE'] }, // Added to match GraphQL schema
      vehicleModel: String, // Added to match GraphQL schema
      vehicleYear: Number, // Added to match GraphQL schema
      vehiclePhotoURL: String, // Added to match GraphQL schema
      orCrPictureURL: String, // Added to match GraphQL schema
      preferredMaterialType: [String], // Added to match GraphQL schema
      reason: String // Added to match GraphQL schema
    }
  },
  {
    timestamps: true,
    // Add pre-save hooks
    pre: [
      { method: 'save', fn: validateMaterialAssignment, parallel: false },
      { method: 'save', fn: validateRequiredFields, parallel: false },
    ],
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        delete ret.password;
        delete ret.emailVerificationToken;
        delete ret.emailVerificationCode;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Virtual for full name
DriverSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.middleName ? this.middleName + ' ' : ''}${this.lastName}`;
});

// Virtual for material relationship - updated to work with ObjectId reference
DriverSchema.virtual('material', {
  ref: 'Material',
  localField: 'materialId',
  foreignField: '_id',
  justOne: true
});

// Auto-generate driverId
DriverSchema.pre('save', async function (next) {
  if (!this.driverId) {
    const lastDriver = await this.constructor.findOne().sort({ createdAt: -1 });
    if (!lastDriver || !lastDriver.driverId) {
      this.driverId = 'DRV-001';
    } else {
      const lastNum = parseInt(lastDriver.driverId.split('-')[1], 10);
      this.driverId = `DRV-${String(lastNum + 1).padStart(3, '0')}`;
    }
  }
  next();
});

// Hash password if modified
DriverSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance methods
DriverSchema.methods.isLocked = function () {
  return this.accountLocked && this.lockUntil && this.lockUntil > new Date();
};

DriverSchema.methods.isActive = function () {
  return this.accountStatus === 'ACTIVE';
};

DriverSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Add method to check if driver can be approved
DriverSchema.methods.canBeApproved = function() {
  return this.isEmailVerified && this.accountStatus === 'PENDING' && this.reviewStatus === 'PENDING';
};

// Updated method to assign material - works with ObjectId reference
DriverSchema.methods.assignMaterial = async function() {
  if (this.materialId) {
    return await mongoose.model('Material').findById(this.materialId);
  }
  return null;
};

// Indexes
DriverSchema.index({ email: 1 }, { unique: true });
DriverSchema.index({ driverId: 1 }, { unique: true });
DriverSchema.index({ accountStatus: 1, reviewStatus: 1 });
DriverSchema.index({ vehiclePlateNumber: 1 });

const Driver = mongoose.models.Driver || mongoose.model('Driver', DriverSchema);
module.exports = Driver;