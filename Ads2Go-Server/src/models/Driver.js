const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const DriverSchema = new mongoose.Schema(
  {
    driverId: { type: String, unique: true, trim: true, uppercase: true },
    materialId: { type: String, default: null }, // Reference to assigned material

    firstName: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
    middleName: { type: String, trim: true, maxlength: 50 },
    lastName: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
    contactNumber: { type: String, required: true, trim: true, match: [/^\+?[0-9]{10,15}$/, 'Invalid phone number'] },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, match: [/^\S+@\S+\.\S+$/, 'Invalid email'] },
    password: { type: String, required: true, minlength: 6, select: false },
    address: { type: String, required: true, trim: true, minlength: 10 },
    profilePicture: { type: String, trim: true, default: null },

    licenseNumber: { type: String, required: true, trim: true, uppercase: true },
    licensePictureURL: { type: String, required: true, trim: true },
    vehiclePlateNumber: { type: String, required: true, trim: true, uppercase: true },
    vehicleType: { type: String, required: true, enum: ['CAR', 'MOTOR', 'BUS', 'JEEP', 'E_TRIKE'], set: v => v.toUpperCase() },
    vehicleModel: { type: String, required: true, trim: true },
    vehicleYear: { type: Number, required: true, min: 1900 },
    vehiclePhotoURL: { type: String, required: true, trim: true },
    orCrPictureURL: { type: String, required: true, trim: true },

    accountStatus: { type: String, enum: ['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'RESUBMITTED'], default: 'PENDING' },
    reviewStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED', 'RESUBMITTED'], default: 'PENDING' },
    approvalDate: Date,
    rejectedReason: String,
    resubmissionFiles: { type: [String], default: [] },

    dateJoined: { type: Date, default: Date.now },
    currentBalance: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },

    qrCodeIdentifier: { type: String, required: true, trim: true },

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

    // ✅ NEW FIELDS
    installedMaterialType: { type: String, enum: ['LCD', 'BANNER', 'HEADDRESS', 'STICKER'], default: null },
    preferredMaterialType: { type: [String], enum: ['LCD', 'BANNER', 'HEADDRESS', 'STICKER'], default: [] },
    adminOverrideMaterialType: { type: String, enum: ['LCD', 'BANNER', 'HEADDRESS', 'STICKER'], default: null },
    adminOverride: { type: Boolean, default: false },

    editRequestStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: null },
    editRequestData: {
      firstName: String,
      middleName: String,
      lastName: String,
      contactNumber: String,
      address: String,
      profilePicture: String
    }
  },
  {
    timestamps: true,
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

// Virtual for material relationship
DriverSchema.virtual('material', {
  ref: 'Material',
  localField: 'materialId',
  foreignField: 'materialId',
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

// Add method to assign material
DriverSchema.methods.assignMaterial = async function() {
  if (this.materialId) {
    return await Material.findOne({ materialId: this.materialId });
  }
  return null;
};

// Indexes
DriverSchema.index({ email: 1 }, { unique: true });
DriverSchema.index({ driverId: 1 }, { unique: true });
DriverSchema.index({ accountStatus: 1, reviewStatus: 1 });
DriverSchema.index({ vehiclePlateNumber: 1 });

const Driver = mongoose.model('Driver', DriverSchema);
module.exports = Driver;
