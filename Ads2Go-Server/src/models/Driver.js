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
      minlength: 2,
      maxlength: 50,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    contactNumber: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    address: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
    },
    licenseNumber: {
      type: String,
      required: true,
      trim: true,
    },
    licensePictureURL: {
      type: String,
      required: true,
      trim: true,
    },
    vehiclePlateNumber: {
      type: String,
      required: true,
      trim: true,
    },
    vehicleType: {
      type: String,
      required: true,
      trim: true,
    },
    vehicleModel: {
      type: String,
      required: true,
      trim: true,
    },
    vehicleYear: {
      type: Number,
      required: true,
      min: 1900,
    },
    vehiclePhotoURL: {
      type: String,
      required: true,
      trim: true,
    },
    orCrPictureURL: {
      type: String,
      required: true,
      trim: true,
    },
    preferredMaterialType: {
  type: [String],
  enum: ['LCD', 'BANNER', 'HEADDRESS', 'STICKER'],
  required: [true, 'Preferred material type is required'],
},
    adminOverrideMaterialType: {
      type: String,
      enum: ['LCD', 'BANNER', 'HEADDRESS', 'STICKER'],
      default: null,
    },
    installedMaterialType: {
      type: String,
      enum: ['LCD', 'BANNER', 'HEADDRESS', 'STICKER'],
      default: null,
    },
    accountStatus: {
      type: String,
      enum: ['PENDING', 'ACTIVE', 'SUSPENDED'],
      default: 'PENDING',
    },
    reviewStatus: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'RESUBMITTED'],
      default: 'PENDING',
    },
    approvalDate: {
      type: Date,
      default: null,
    },
    rejectedReason: {
      type: String,
      default: null,
    },
    resubmissionFiles: {
      type: [String],
      default: [],
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
    deviceStatus: {
      type: String,
      enum: ['ONLINE', 'OFFLINE', 'ERROR'],
      default: 'OFFLINE',
    },
    qrCodeIdentifier: {
      type: String,
      required: true,
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
  { timestamps: true }
);


 

DriverSchema.methods.isLocked = function () {
  return this.accountLocked && this.lockUntil && this.lockUntil > new Date();
};

DriverSchema.methods.isActive = function () {
  return this.accountStatus === 'ACTIVE';
};

DriverSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

DriverSchema.index({ email: 1 }, { unique: true });
DriverSchema.index({ driverId: 1 }, { unique: true });

const Driver = mongoose.model('Driver', DriverSchema);
module.exports = Driver;
