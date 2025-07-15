const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Driver = require('../models/Driver');
const { JWT_SECRET } = require('../middleware/auth');
const EmailService = require('../utils/emailService');
const validator = require('validator');

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 2 * 60 * 60 * 1000; // 2 hours

const checkAuth = (user) => {
  if (!user) throw new Error('Not authenticated');
  return user;
};

const checkAdmin = (user) => {
  checkAuth(user);
  if (user.role !== 'ADMIN') throw new Error('Not authorized. Admin access required.');
  return user;
};

// Utility: auto-generate driverId like DRV-001
const generateDriverId = async () => {
  const lastDriver = await Driver.findOne().sort({ createdAt: -1 });
  if (!lastDriver || !lastDriver.driverId) return 'DRV-001';
  const lastNum = parseInt(lastDriver.driverId.split('-')[1]);
  const nextNum = lastNum + 1;
  return `DRV-${String(nextNum).padStart(3, '0')}`;
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
        qrCodeIdentifier,
        installedMaterialType, // Optional
      } = input;

      if (!validator.isEmail(email)) throw new Error('Invalid email address');
      if (await Driver.findOne({ email })) throw new Error('Driver with this email already exists');
      if (!password || password.length < 6) throw new Error('Password must be at least 6 characters');

      let normalizedNumber = contactNumber.replace(/\s/g, '');
      const phoneRegex = /^(\+63|0)?\d{10}$/;
      if (!phoneRegex.test(normalizedNumber)) throw new Error('Invalid Philippine mobile number');
      if (!normalizedNumber.startsWith('+63')) {
        normalizedNumber = normalizedNumber.startsWith('0')
          ? '+63' + normalizedNumber.substring(1)
          : '+63' + normalizedNumber;
      }

      const verificationCode = EmailService.generateVerificationCode();
      const driverId = await generateDriverId();

      const newDriver = new Driver({
        driverId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        contactNumber: normalizedNumber,
        email: email.toLowerCase().trim(),
        password: password.trim(),
        address: address.trim(),
        licenseNumber: licenseNumber.trim(),
        licensePictureURL: licensePictureURL.trim(),
        vehiclePlateNumber: vehiclePlateNumber.trim(),
        vehicleType: vehicleType.trim(),
        vehicleModel: vehicleModel.trim(),
        vehicleYear,
        vehiclePhotoURL: vehiclePhotoURL.trim(),
        orCrPictureURL: orCrPictureURL.trim(),
        qrCodeIdentifier: qrCodeIdentifier.trim(),
        installedMaterialType: installedMaterialType || null, // Default to null if not provided
        accountStatus: 'PENDING',
        deviceStatus: 'OFFLINE',
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
        driver: newDriver,
      };
    },

    loginDriver: async (_, { email, password }) => {
      const driver = await Driver.findOne({ email });
      if (!driver) throw new Error('No driver found with this email');

      if (driver.accountLocked && driver.lockUntil && driver.lockUntil > new Date()) {
        throw new Error('Account is temporarily locked. Please try again later.');
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

      const freshDriver = await Driver.findById(driver._id);

      const token = jwt.sign(
        {
          driverId: freshDriver.id,
          email: freshDriver.email,
          isEmailVerified: freshDriver.isEmailVerified,
          tokenVersion: freshDriver.tokenVersion,
        },
        JWT_SECRET,
        { expiresIn: '1d' }
      );

      return { token, driver: freshDriver };
    },

    verifyDriverEmail: async (_, { code }) => {
      try {
        if (!code || !code.trim()) {
          return {
            success: false,
            message: 'Verification code is required.',
            driver: null,
          };
        }

        const driver = await Driver.findOne({ emailVerificationCode: code.trim() });
        if (!driver) {
          return {
            success: false,
            message: 'Invalid verification code.',
            driver: null,
          };
        }

        if (new Date() > driver.emailVerificationCodeExpires) {
          return {
            success: false,
            message: 'Verification code has expired.',
            driver: null,
          };
        }

        driver.isEmailVerified = true;
        driver.emailVerificationCode = null;
        driver.emailVerificationCodeExpires = null;
        driver.accountStatus = 'ACTIVE';
        await driver.save();

        return {
          success: true,
          message: 'Email verified successfully.',
          driver,
        };
      } catch (err) {
        console.error('verifyDriverEmail unexpected error:', err);
        return {
          success: false,
          message: 'An unexpected error occurred. Please try again.',
          driver: null,
        };
      }
    },

    resendDriverVerificationCode: async (_, { email }) => {
      const driver = await Driver.findOne({ email });
      if (!driver) throw new Error('Driver not found');

      // Clear expired code if any
      if (
        driver.emailVerificationCodeExpires &&
        new Date() > driver.emailVerificationCodeExpires
      ) {
        driver.emailVerificationCode = null;
        driver.emailVerificationCodeExpires = null;
      }

      // Generate and send new code
      const newCode = EmailService.generateVerificationCode();
      driver.emailVerificationCode = newCode;
      driver.emailVerificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000);

      await EmailService.sendVerificationEmail(driver.email, newCode);
      await driver.save();

      return {
        success: true,
        message: 'New verification code sent to your email',
      };
    },

    deleteDriver: async (_, { id }, { user }) => {
      checkAdmin(user);
      const driver = await Driver.findById(id);
      if (!driver) throw new Error('Driver not found');
      await Driver.findByIdAndDelete(id);
      return { success: true, message: 'Driver deleted successfully' };
    },
  },
};

module.exports = resolvers;
