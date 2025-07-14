const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const DriverSchema = new mongoose.Schema(
  {
    driverId: {
      type: String,
      required: [true, 'Driver ID is required'],
      unique: true,
      trim: true,
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      minlength: [2, 'First name must be at least 2 characters'],
      maxlength: [50, 'First name cannot exceed 50 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      minlength: [2, 'Last name must be at least 2 characters'],
      maxlength: [50, 'Last name cannot exceed 50 characters'],
    },
    contactNumber: {
      type: String,
      required: [true, 'Contact number is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
      minlength: [10, 'Address must be at least 10 characters'],
    },
    licenseNumber: {
      type: String,
      required: [true, 'License number is required'],
      trim: true,
    },
    licensePictureURL: {
      type: String,
      required: [true, 'License picture URL is required'],
      trim: true,
    },
    vehiclePlateNumber: {
      type: String,
      required: [true, 'Vehicle plate number is required'],
      trim: true,
    },
    vehicleType: {
      type: String,
      required: [true, 'Vehicle type is required'],
      trim: true,
    },
    vehicleModel: {
      type: String,
      required: [true, 'Vehicle model is required'],
      trim: true,
    },
    vehicleYear: {
      type: Number,
      required: [true, 'Vehicle year is required'],
      min: [1900, 'Vehicle year must be after 1900'],
    },
    vehiclePhotoURL: {
      type: String,
      required: [true, 'Vehicle photo URL is required'],
      trim: true,
    },
    orCrPictureURL: {
      type: String,
      required: [true, 'OR/CR picture URL is required'],
      trim: true,
    },
    accountStatus: {
      type: String,
      enum: ['PENDING', 'ACTIVE', 'SUSPENDED'],
      default: 'PENDING',
    },
    dateJoined: {
      type: Date,
      default: Date.now,
    },
    currentBalance: {
      type: Number,
      default: 0,
    },
    totalEarnings: {
      type: Number,
      default: 0,
    },
    totalDistanceTraveled: {
      type: Number,
      default: 0,
    },
    totalAdImpressions: {
      type: Number,
      default: 0,
    },
    installedDeviceId: {
      type: String,
      default: null,
    },
    installedMaterialType: {
      type: String,
      enum: ['LCD', 'BANNER', 'HEADDRESS', 'STICKER'],
      default: null,
    },
    deviceStatus: {
      type: String,
      enum: ['ONLINE', 'OFFLINE', 'ERROR'],
      default: 'OFFLINE',
    },
    qrCodeIdentifier: {
      type: String,
      required: [true, 'QR code identifier is required'],
      trim: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      default: null,
    },
    emailVerificationCode: {
      type: String,
      default: null,
    },
    emailVerificationCodeExpires: {
      type: Date,
      default: null,
    },
    emailVerificationAttempts: {
      type: Number,
      default: 0,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    accountLocked: {
      type: Boolean,
      default: false,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to hash password
DriverSchema.pre('save', async function (next) {
  this.updatedAt = Date.now();

  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }

  next();
});

// Custom instance methods
DriverSchema.methods.isLocked = function () {
  return this.accountLocked && this.lockUntil && this.lockUntil > new Date();
};

DriverSchema.methods.isActive = function () {
  return this.accountStatus === 'ACTIVE';
};

DriverSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Indexes
DriverSchema.index({ email: 1 }, { unique: true });
DriverSchema.index({ driverId: 1 }, { unique: true });

const Driver = mongoose.model('Driver', DriverSchema);

module.exports = Driver;
