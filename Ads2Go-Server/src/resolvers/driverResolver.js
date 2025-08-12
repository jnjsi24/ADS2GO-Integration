
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Driver = require('../models/Driver');
const Material = require('../models/Material'); 
const { JWT_SECRET } = require('../middleware/auth');
const EmailService = require('../utils/emailService');
const validator = require('validator');

const MAX_LOGIN_ATTEMPTS = 100;
const LOCK_TIME = 2 * 60 * 60 * 1000; // 2 hours

const VEHICLE_MATERIAL_MAP = {
  CAR: ['LCD', 'STICKER', 'HEADDRESS'],
  BUS: ['LCD', 'STICKER'],
  ETRIKE: ['STICKER', 'HEADDRESS'],
  JEEP: ['STICKER'],
  MOTORCYCLE: ['LCD', 'BANNER']
};

const ALLOWED_VEHICLE_TYPES = Object.keys(VEHICLE_MATERIAL_MAP);

const checkAuth = (user) => {
  if (!user) throw new Error('Not authenticated');
  return user;
};

const checkAdmin = (user) => {
  checkAuth(user);
  if (user.role !== 'ADMIN') throw new Error('Not authorized. Admin access required.');
  return user;
};

const generateDriverId = async () => {
  const lastDriver = await Driver.findOne().sort({ createdAt: -1 });
  if (!lastDriver || !lastDriver.driverId) return 'DRV-001';
  const lastNum = parseInt(lastDriver.driverId.split('-')[1], 10);
  const nextNum = lastNum + 1;
  return `DRV-${String(nextNum).padStart(3, '0')}`;
};

// Helper function for automatic material assignment
async function assignMaterialToDriver(driver) {
  const allowedTypes = VEHICLE_MATERIAL_MAP[driver.vehicleType];
  if (!allowedTypes) {
    console.warn(`No allowed materials for vehicle type ${driver.vehicleType}`);
    return;
  }

  const availableMaterials = await Material.find({
    vehicleType: driver.vehicleType,
    materialType: { $in: allowedTypes },
    driverId: null, // unassigned materials only
  });

  if (!availableMaterials.length) {
    console.warn(`No available materials to assign to driver ${driver.driverId}`);
    return;
  }

  const materialToAssign = availableMaterials[0];
  materialToAssign.driverId = driver._id;
  await materialToAssign.save();

  if (!driver.installedMaterialType) {
    driver.installedMaterialType = materialToAssign.materialType;
    await driver.save();
  }
}

const resolvers = {
  Query: {
    getAllDrivers: async (_, __, { user }) => {
      checkAdmin(user);
      return await Driver.find({});
    },
    getDriverById: async (_, { driverId }, { user }) => {
      checkAdmin(user);
      const driver = await Driver.findOne({ driverId });
      if (!driver) throw new Error('Driver not found');
      return driver;
    },
  },

  Mutation: {
    createDriver: async (_, { input }) => {
      const {
        firstName,
        lastName,
        contactNumber,
        email,
        password,
        address,
        licenseNumber,
        licensePictureURL,
        vehiclePlateNumber,
        vehicleType,
        vehicleModel,
        vehicleYear,
        vehiclePhotoURL,
        orCrPictureURL,
        preferredMaterialType 
      } = input;

      if (!validator.isEmail(email)) throw new Error('Invalid email address');
      if (await Driver.findOne({ email: email.toLowerCase().trim() })) throw new Error('Driver with this email already exists');
      if (!password || password.length < 6) throw new Error('Password must be at least 6 characters');

      let normalizedNumber = contactNumber.replace(/\s/g, '');
      const phoneRegex = /^(\+63|0)?\d{10}$/;
      if (!phoneRegex.test(normalizedNumber)) throw new Error('Invalid Philippine mobile number');
      if (!normalizedNumber.startsWith('+63')) {
        normalizedNumber = normalizedNumber.startsWith('0')
          ? '+63' + normalizedNumber.substring(1)
          : '+63' + normalizedNumber;
      }

      if (!ALLOWED_VEHICLE_TYPES.includes(vehicleType)) {
        throw new Error(`Invalid vehicle type. Allowed types: ${ALLOWED_VEHICLE_TYPES.join(', ')}`);
      }

      if (
        preferredMaterialType &&
        !preferredMaterialType.every((m) => VEHICLE_MATERIAL_MAP[vehicleType]?.includes(m))
      ) {
        throw new Error(
          `One or more preferred materials are invalid for vehicle type "${vehicleType}". Allowed: ${VEHICLE_MATERIAL_MAP[vehicleType].join(', ')}`
        );
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const verificationCode = EmailService.generateVerificationCode();
      const driverId = await generateDriverId();
      const qrCodeIdentifier = `QR-${Date.now()}`;

      const newDriver = new Driver({
        driverId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        contactNumber: normalizedNumber,
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        address: address.trim(),
        licenseNumber: licenseNumber.trim(),
        licensePictureURL: licensePictureURL.trim(),
        vehiclePlateNumber: vehiclePlateNumber.trim(),
        vehicleType: vehicleType.trim(),
        vehicleModel: vehicleModel.trim(),
        vehicleYear,
        vehiclePhotoURL: vehiclePhotoURL.trim(),
        orCrPictureURL: orCrPictureURL.trim(),
        qrCodeIdentifier,
        installedMaterialType: null,
        preferredMaterialType: preferredMaterialType || null,
        accountStatus: 'PENDING',
        isEmailVerified: false,
        emailVerificationCode: verificationCode,
        emailVerificationCodeExpires: new Date(Date.now() + 15 * 60 * 1000),
        tokenVersion: 0,
      });

      await EmailService.sendVerificationEmail(newDriver.email, verificationCode);
      await newDriver.save();

      return {
        success: true,
        message: 'Driver created successfully. Please verify your email.',
        token: null,
        driver: newDriver,
      };
    },

    verifyDriverEmail: async (_, { code }) => {
      const driver = await Driver.findOne({ emailVerificationCode: code });

      if (!driver) {
        return {
          success: false,
          message: 'Invalid or expired verification code',
          token: null,
          driver: null,
        };
      }

      if (new Date(driver.emailVerificationCodeExpires) < new Date()) {
        return {
          success: false,
          message: 'Verification code has expired',
          token: null,
          driver: null,
        };
      }

      driver.isEmailVerified = true;
      driver.accountStatus = 'PENDING';
      driver.emailVerificationCode = null;
      driver.emailVerificationCodeExpires = null;
      await driver.save();

      return {
        success: true,
        message: 'Email verified successfully',
        token: null,
        driver,
      };
    },

    approveDriver: async (_, { driverId, materialTypeOverride }, { user }) => {
      checkAdmin(user);

      const driver = await Driver.findOne({ driverId });
      if (!driver) throw new Error('Driver not found');

      driver.accountStatus = 'ACTIVE';
      driver.approvalDate = new Date();

      if (materialTypeOverride?.length) {
        if (!materialTypeOverride.every(m => VEHICLE_MATERIAL_MAP[driver.vehicleType]?.includes(m))) {
          throw new Error('One or more override materials are invalid for this vehicle type');
        }
        driver.preferredMaterialType = materialTypeOverride;
        driver.installedMaterialType = materialTypeOverride[0];
        driver.adminOverrideMaterialType = true;
      } else if (driver.preferredMaterialType?.length) {
        driver.installedMaterialType = driver.preferredMaterialType[0];
      }

      await driver.save();

      await assignMaterialToDriver(driver);

      return { success: true, message: 'Driver approved.', token: null, driver };
    },

    rejectDriver: async (_, { driverId, reason }, { user }) => {
      checkAdmin(user);
      const driver = await Driver.findOne({ driverId });
      if (!driver) throw new Error('Driver not found');

      driver.accountStatus = 'REJECTED';
      driver.rejectedReason = reason;
      await driver.save();

      return { success: true, message: 'Driver rejected.', token: null, driver: null };
    },

    resubmitDriver: async (_, { driverId, input }, { user }) => {
      checkAuth(user);
      const driver = await Driver.findOne({ driverId });
      if (!driver) throw new Error('Driver not found');
      if (String(driver._id) !== String(user.driverId) && user.role !== 'ADMIN') {
        throw new Error('Unauthorized resubmission attempt');
      }

      Object.assign(driver, input);
      driver.accountStatus = 'RESUBMITTED';
      await driver.save();

      return { success: true, message: 'Requirements resubmitted.', token: null, driver };
    },

    loginDriver: async (_, { email, password }) => {
      const normalizedEmail = email.toLowerCase().trim();

      const driver = await Driver.findOne({ email: normalizedEmail });
      if (!driver) {
        return { success: false, message: "Invalid email or password", token: null, driver: null };
      }

      const isMatch = await bcrypt.compare(password, driver.password);
      if (!isMatch) {
        return { success: false, message: "Invalid email or password", token: null, driver: null };
      }

      if (driver.accountStatus === "PENDING") {
        return { success: false, message: "Please wait for your requirements validation", token: null, driver: null };
      }

      if (driver.accountStatus !== "ACTIVE") {
        return { success: false, message: "Account not active. Please verify email", token: null, driver: null };
      }

      const token = jwt.sign({ id: driver.id }, JWT_SECRET, { expiresIn: "7d" });

      driver.lastLogin = new Date();
      await driver.save();

      return {
        success: true,
        message: "Login successful",
        token,
        driver,
      };
    },

    deleteDriver: async (_, { driverId }, { user }) => {
      checkAdmin(user);
      const driver = await Driver.findOne({ driverId });
      if (!driver) throw new Error('Driver not found');
      await Driver.deleteOne({ driverId });
      return { success: true, message: 'Driver deleted successfully', token: null, driver: null };
    },
  },
};

module.exports = resolvers;
