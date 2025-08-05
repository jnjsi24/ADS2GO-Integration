const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Driver = require('../models/Driver');
const { JWT_SECRET } = require('../middleware/auth');
const EmailService = require('../utils/emailService');
const validator = require('validator');

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 2 * 60 * 60 * 1000;

const checkAuth = (user) => {
  if (!user) throw new Error('Not authenticated');
  return user;
};

const checkAdmin = (user) => {
  checkAuth(user);
  if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') throw new Error('Admin access required');
  return user;
};

const generateDriverId = async () => {
  const last = await Driver.findOne().sort({ createdAt: -1 });
  if (!last || !last.driverId) return 'DRV-001';
  const num = parseInt(last.driverId.split('-')[1]);
  return `DRV-${String(num + 1).padStart(3, '0')}`;
};

const resolvers = {
  Query: {
    getAllDrivers: async (_, __, { user }) => {
      checkAdmin(user);
      return await Driver.find({});
    },
    getDriverById: async (_, { id }, { user }) => {
      checkAdmin(user);
      const driver = await Driver.findById(id);
      if (!driver) throw new Error('Driver not found');
      return driver;
    },
    getDriversWithPendingEdits: async (_, __, { user }) => {
      checkAdmin(user);
      return await Driver.find({ editRequestStatus: 'PENDING' });
    },
    getOwnDriver: async (_, __, { user }) => {
      checkAuth(user);
      const driver = await Driver.findById(user.id);
      if (!driver) throw new Error('Driver not found');
      return driver;
    },

    // ✅ NEW query to get available vehicle types
    getAvailableVehicleTypes: async () => {
      const types = await Driver.distinct('vehicleType');
      return types.sort();
    },
  },

  Mutation: {
    createDriver: async (_, { input }) => {
      const {
        firstName, lastName, contactNumber, email, password, address,
        licenseNumber, licensePictureURL, vehiclePlateNumber,
        vehicleType, vehicleModel, vehicleYear, vehiclePhotoURL,
        orCrPictureURL, qrCodeIdentifier, installedMaterialType,
      } = input;

      if (!validator.isEmail(email)) throw new Error('Invalid email');
      if (await Driver.findOne({ email })) throw new Error('Email already exists');
      if (!password || password.length < 6) throw new Error('Weak password');

      let normalized = contactNumber.replace(/\s/g, '');
      if (!/^(\+63|0)?\d{10}$/.test(normalized))
        throw new Error('Invalid PH number');
      if (!normalized.startsWith('+63')) {
        normalized = normalized.startsWith('0')
          ? '+63' + normalized.slice(1)
          : '+63' + normalized;
      }

      const verificationCode = EmailService.generateVerificationCode();
      const driverId = await generateDriverId();

      const newDriver = new Driver({
        driverId,
        firstName, lastName, contactNumber: normalized,
        email: email.toLowerCase().trim(),
        password: password.trim(),
        address, licenseNumber, licensePictureURL,
        vehiclePlateNumber, vehicleType, vehicleModel,
        vehicleYear, vehiclePhotoURL, orCrPictureURL,
        qrCodeIdentifier, installedMaterialType,
        accountStatus: 'PENDING',
        deviceStatus: 'OFFLINE',
        isEmailVerified: false,
        emailVerificationCode: verificationCode,
        emailVerificationCodeExpires: new Date(Date.now() + 15 * 60 * 1000),
        tokenVersion: 0,
      });

      try {
        await EmailService.sendVerificationEmail(newDriver.email, verificationCode);
        console.log(`✅ Verification email sent to ${newDriver.email}`);
      } catch (error) {
        console.error(`❌ Error sending verification email: ${error.message}`);
      }

      console.log(`[DEV] Verification code: ${verificationCode}`);

      await newDriver.save();

      return {
        success: true,
        message: 'Driver created successfully. Please verify your email.',
        driver: { id: newDriver._id, email: newDriver.email },
      };
    },

    loginDriver: async (_, { email, password }) => {
      const driver = await Driver.findOne({ email });
      if (!driver) throw new Error('No driver with this email');

      if (driver.accountLocked && driver.lockUntil > new Date()) {
        throw new Error('Account temporarily locked');
      }

      const isMatch = await bcrypt.compare(password, driver.password);
      if (!isMatch) {
        driver.loginAttempts += 1;
        if (driver.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
          driver.accountLocked = true;
          driver.lockUntil = new Date(Date.now() + LOCK_TIME);
        }
        await driver.save();
        throw new Error('Invalid credentials');
      }

      driver.loginAttempts = 0;
      driver.accountLocked = false;
      driver.lockUntil = null;
      driver.lastLogin = new Date();
      await driver.save();

      const token = jwt.sign(
        {
          driverId: driver.id,
          email: driver.email,
          isEmailVerified: driver.isEmailVerified,
          tokenVersion: driver.tokenVersion,
        },
        JWT_SECRET,
        { expiresIn: '1d' }
      );

      return { token, driver };
    },

    verifyDriverEmail: async (_, { code }) => {
      if (!code || !code.trim()) {
        return { success: false, message: 'Code required', driver: null };
      }

      const driver = await Driver.findOne({ emailVerificationCode: code.trim() });
      if (!driver) {
        return { success: false, message: 'Invalid code', driver: null };
      }

      if (new Date() > driver.emailVerificationCodeExpires) {
        return { success: false, message: 'Code expired', driver: null };
      }

      driver.isEmailVerified = true;
      driver.emailVerificationCode = null;
      driver.emailVerificationCodeExpires = null;
      driver.accountStatus = 'ACTIVE';
      await driver.save();

      return { success: true, message: 'Email verified', driver };
    },

    resendDriverVerificationCode: async (_, { email }) => {
      const driver = await Driver.findOne({ email });
      if (!driver) throw new Error('Driver not found');

      const newCode = EmailService.generateVerificationCode();
      driver.emailVerificationCode = newCode;
      driver.emailVerificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000);

      try {
        await EmailService.sendVerificationEmail(driver.email, newCode);
        console.log(`✅ Verification email sent to ${driver.email}`);
      } catch (error) {
        console.error(`❌ Error sending verification email: ${error.message}`);
      }

      console.log(`[DEV] Resent verification code: ${newCode}`);

      await driver.save();

      return { success: true, message: 'Code resent' };
    },

    updateDriver: async (_, { id, input }, { user }) => {
      checkAdmin(user);

      const driver = await Driver.findById(id);
      if (!driver) throw new Error('Driver not found');

      if (input.email && input.email !== driver.email) {
        if (!validator.isEmail(input.email)) throw new Error('Invalid email');
        const existing = await Driver.findOne({ email: input.email });
        if (existing && existing.id !== id) throw new Error('Email in use');
        driver.email = input.email.toLowerCase().trim();
      }

      if (input.password) {
        if (input.password.length < 6) throw new Error('Weak password');
        const salt = await bcrypt.genSalt(10);
        driver.password = await bcrypt.hash(input.password, salt);
      }

      const fields = [
        'firstName', 'lastName', 'contactNumber', 'address',
        'licenseNumber', 'licensePictureURL', 'vehiclePlateNumber',
        'vehicleType', 'vehicleModel', 'vehicleYear',
        'vehiclePhotoURL', 'orCrPictureURL', 'accountStatus',
        'deviceStatus'
      ];
      fields.forEach((field) => {
        if (input[field] !== undefined) driver[field] = input[field];
      });

      driver.updatedAt = new Date();
      await driver.save();

      return {
        success: true,
        message: 'Driver updated successfully',
        driver,
      };
    },

    requestDriverEdit: async (_, { input }, { user }) => {
      checkAuth(user);

      const driver = await Driver.findById(user.id);
      if (!driver) throw new Error('Driver not found');

      if (driver.editRequestStatus === 'PENDING') {
        throw new Error('You already have a pending edit request');
      }

      driver.editRequestStatus = 'PENDING';
      driver.editRequestData = input;
      await driver.save();

      return { success: true, message: 'Edit request submitted' };
    },

    approveDriverEditRequest: async (_, { id }, { user }) => {
      checkAdmin(user);
      const driver = await Driver.findById(id);
      if (!driver) throw new Error('Driver not found');

      if (driver.editRequestStatus !== 'PENDING' || !driver.editRequestData) {
        throw new Error('No pending edit request to approve');
      }

      const data = driver.editRequestData;
      const allowedFields = [
        'firstName', 'lastName', 'contactNumber', 'address',
        'licenseNumber', 'licensePictureURL', 'vehiclePlateNumber',
        'vehicleType', 'vehicleModel', 'vehicleYear',
        'vehiclePhotoURL', 'orCrPictureURL', 'installedMaterialType'
      ];

      allowedFields.forEach((field) => {
        if (data[field] !== undefined) {
          if (field === 'address' && typeof data[field] === 'string' && data[field].length < 10) {
            throw new Error('Address must be at least 10 characters.');
          }
          driver[field] = data[field];
        }
      });

      driver.editRequestData = null;
      driver.editRequestStatus = 'APPROVED';
      driver.updatedAt = new Date();
      await driver.save();

      return { success: true, message: 'Edit request approved', driver };
    },

    rejectDriverEditRequest: async (_, { id }, { user }) => {
      checkAdmin(user);
      const driver = await Driver.findById(id);
      if (!driver) throw new Error('Driver not found');

      driver.editRequestData = null;
      driver.editRequestStatus = 'REJECTED';
      await driver.save();

      return { success: true, message: 'Edit request rejected' };
    },

    deleteDriver: async (_, { id }, { user }) => {
      checkAdmin(user);
      const driver = await Driver.findById(id);
      if (!driver) throw new Error('Driver not found');
      await Driver.findByIdAndDelete(id);
      return { success: true, message: 'Driver deleted' };
    },
  },
};

module.exports = resolvers;
