const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Ad = require('../models/Ad');
const { JWT_SECRET } = require('../middleware/auth');
const { validateUserInput, checkPasswordStrength } = require('../utils/validations');
const EmailService = require('../utils/emailService');
const validator = require('validator');

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 2 * 60 * 60 * 1000;

const checkAuth = (user) => {
  if (!user) {
    throw new Error('Not authenticated');
  }
  return user;
};

const checkAdmin = (user) => {
  checkAuth(user);
  if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
    throw new Error('Not authorized. Admin access required.');
  }
  return user;
};

const resolvers = {
  Query: {
    getAllUsers: async (_, __, { user }) => {
      checkAdmin(user);
      return await User.find({}).select(
        'id firstName lastName email role isEmailVerified companyName companyAddress houseAddress contactNumber profilePicture createdAt updatedAt'
      );
    },

    getUserById: async (_, { id }, { user }) => {
      checkAdmin(user);
      return await User.findById(id);
    },

    getOwnUserDetails: async (_, __, { user }) => {
      checkAuth(user);
      const userRecord = await User.findById(user.id);
      if (!userRecord) {
        throw new Error('User not found');
      }
      return userRecord;
    },

    checkPasswordStrength: (_, { password }) => checkPasswordStrength(password),
  },

  Mutation: {
    createAdminUser: async (_, { input }, { user }) => {
      checkAuth(user);
      if (user.role !== 'SUPERADMIN') {
        throw new Error('Only superadmin can create admin accounts');
      }

      const {
        firstName, middleName, lastName, email,
        password, companyName, companyAddress, contactNumber
      } = input;

      if (await User.findOne({ email })) {
        throw new Error('Email already exists');
      }

      let normalizedNumber = contactNumber.replace(/\s/g, '');
      const phoneRegex = /^(\+63|0)?\d{10}$/;
      if (!phoneRegex.test(normalizedNumber)) {
        throw new Error('Invalid Philippine mobile number');
      }
      if (!normalizedNumber.startsWith('+63')) {
        normalizedNumber = normalizedNumber.startsWith('0')
          ? '+63' + normalizedNumber.substring(1)
          : '+63' + normalizedNumber;
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newAdmin = new User({
        firstName: firstName.trim(),
        middleName: middleName?.trim() || null,
        lastName: lastName.trim(),
        email: email.toLowerCase(),
        password: hashedPassword,
        role: 'ADMIN',
        isEmailVerified: true,
        companyName: companyName.trim(),
        companyAddress: companyAddress.trim(),
        contactNumber: normalizedNumber
      });

      await newAdmin.save();
      return { success: true, message: 'Admin created successfully', user: newAdmin };
    },

    createUser: async (_, { input }) => {
      try {
        const validationErrors = validateUserInput(input);
        if (validationErrors.length > 0) {
          throw new Error(validationErrors.join(', '));
        }

        const { firstName, middleName, lastName, companyName, companyAddress, contactNumber, email, password, houseAddress } = input;

        let normalizedNumber = contactNumber.replace(/\s/g, '');
        const phoneRegex = /^(\+63|0)?\d{10}$/;
        if (!phoneRegex.test(normalizedNumber)) {
          throw new Error('Invalid Philippine mobile number');
        }

        if (!normalizedNumber.startsWith('+63')) {
          normalizedNumber = normalizedNumber.startsWith('0')
            ? '+63' + normalizedNumber.substring(1)
            : '+63' + normalizedNumber;
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
          firstName: firstName.trim(),
          middleName: middleName?.trim() || null,
          lastName: lastName.trim(),
          companyName: companyName.trim(),
          companyAddress: companyAddress.trim(),
          contactNumber: normalizedNumber,
          email: email.toLowerCase(),
          password: hashedPassword,
          houseAddress: houseAddress?.trim() || null,
          role: 'USER',
        });

        await newUser.save();

        const token = jwt.sign(
          { userId: newUser.id, email: newUser.email, role: newUser.role, tokenVersion: newUser.tokenVersion },
          JWT_SECRET,
          { expiresIn: '1h' }
        );

        await EmailService.sendVerificationEmail(newUser.email, newUser.firstName, token);

        return { token, user: newUser };
      } catch (error) {
        console.error("Error creating user:", error);
        throw new Error(`Failed to create user: ${error.message}`);
      }
    },

    login: async (_, { input }) => {
      const { email, password, deviceInfo } = input;
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        throw new Error('Invalid credentials');
      }
      if (user.lockUntil && user.lockUntil > Date.now()) {
        const timeLeft = Math.ceil((user.lockUntil - Date.now()) / (1000 * 60));
        throw new Error(`Account locked. Try again in ${timeLeft} minutes.`);
      }
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        user.loginAttempts = (user.loginAttempts || 0) + 1;
        if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
          user.lockUntil = Date.now() + LOCK_TIME;
          user.loginAttempts = 0;
          await user.save();
          throw new Error(`Too many failed login attempts. Account locked for ${LOCK_TIME / (1000 * 60 * 60)} hours.`);
        }
        await user.save();
        throw new Error('Invalid credentials');
      }

      user.loginAttempts = 0;
      user.lockUntil = null;
      user.lastLogin = new Date().toISOString();
      await user.save();

      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role, isEmailVerified: user.isEmailVerified, tokenVersion: user.tokenVersion },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      return { token, user };
    },

    logout: async (_, __, { user }) => {
      checkAuth(user);
      const updatedUser = await User.findByIdAndUpdate(user.id, { $inc: { tokenVersion: 1 } }, { new: true });
      if (!updatedUser) {
        throw new Error('User not found during logout');
      }
      return { success: true, message: 'Logged out successfully' };
    },

    forgotPassword: async (_, { input }) => {
      const { email } = input;
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return { success: true, message: 'If an account with that email exists, a password reset link has been sent.' };
      }

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
      await EmailService.sendPasswordResetEmail(user.email, user.firstName, token);

      return { success: true, message: 'Password reset link sent to your email.' };
    },

    resetPassword: async (_, { input }) => {
      const { token, password } = input;
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (err) {
        throw new Error('Invalid or expired token.');
      }

      const user = await User.findById(decoded.userId);
      if (!user) {
        throw new Error('User not found.');
      }

      const strengthCheck = checkPasswordStrength(password);
      if (!strengthCheck.strong) {
        throw new Error(strengthCheck.errors.message || 'Password is not strong enough.');
      }

      user.password = await bcrypt.hash(password, 10);
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save();

      return { success: true, message: 'Password has been reset successfully.' };
    },

    verifyEmail: async (_, { token }) => {
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (err) {
        throw new Error('Invalid or expired verification token.');
      }

      const user = await User.findById(decoded.userId);
      if (!user) {
        throw new Error('User not found for verification.');
      }
      if (user.isEmailVerified) {
        return { success: true, message: 'Email already verified.' };
      }

      user.isEmailVerified = true;
      await user.save();

      return { success: true, message: 'Email verified successfully!' };
    },

    updateUser: async (_, { input }, { user }) => {
      checkAdmin(user);

      const { id, ...updateFields } = input;

      const filteredUpdateFields = Object.fromEntries(
        Object.entries(updateFields).filter(([_, value]) => value !== '' && value !== null && value !== undefined)
      );

      if (filteredUpdateFields.contactNumber) {
        let normalizedNumber = filteredUpdateFields.contactNumber.replace(/\s/g, '');
        const phoneRegex = /^(\+63|0)?\d{10}$/;
        if (!phoneRegex.test(normalizedNumber)) {
          throw new Error('Invalid Philippine mobile number format.');
        }
        if (!normalizedNumber.startsWith('+63')) {
          normalizedNumber = normalizedNumber.startsWith('0')
            ? '+63' + normalizedNumber.substring(1)
            : '+63' + normalizedNumber;
        }
        filteredUpdateFields.contactNumber = normalizedNumber;
      }
      
      const updatedUser = await User.findByIdAndUpdate(id, { $set: filteredUpdateFields }, { new: true });

      if (!updatedUser) {
        throw new Error('User not found or could not be updated.');
      }

      return { success: true, message: 'User updated successfully', user: updatedUser };
    },

    updateUserProfile: async (_, { input }, { user }) => {
      checkAuth(user);

      const { ...updateFields } = input; 

      const filteredUpdateFields = Object.fromEntries(
        Object.entries(updateFields).filter(([_, value]) => value !== '' && value !== null && value !== undefined)
      );

      if (filteredUpdateFields.contactNumber) {
        let normalizedNumber = filteredUpdateFields.contactNumber.replace(/\s/g, '');
        const phoneRegex = /^(\+63|0)?\d{10}$/;
        if (!phoneRegex.test(normalizedNumber)) {
          throw new Error('Invalid Philippine mobile number format.');
        }
        if (!normalizedNumber.startsWith('+63')) {
          normalizedNumber = normalizedNumber.startsWith('0')
            ? '+63' + normalizedNumber.substring(1)
            : '+63' + normalizedNumber;
        }
        filteredUpdateFields.contactNumber = normalizedNumber;
      }

      const updatedUser = await User.findByIdAndUpdate(user.id, { $set: filteredUpdateFields }, { new: true });

      if (!updatedUser) {
        throw new Error('User not found or could not be updated.');
      }

      return { success: true, message: 'Profile updated successfully', user: updatedUser };
    },

    deleteUser: async (_, { id }, { user }) => {
      checkAdmin(user);
      const deletedUser = await User.findByIdAndDelete(id);
      if (!deletedUser) {
        throw new Error('User not found or could not be deleted.');
      }

      await Ad.deleteMany({ userId: id });

      return { success: true, message: 'User and associated ads deleted successfully' };
    },
  },
};

module.exports = resolvers;