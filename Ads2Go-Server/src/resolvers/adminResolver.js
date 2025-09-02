const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const User = require('../models/User');
const { JWT_SECRET } = require('../middleware/auth');
const { validateUserInput, checkPasswordStrength } = require('../utils/validations');
const EmailService = require('../utils/emailService');
const validator = require('validator');

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 2 * 60 * 60 * 1000; // 2 hours

const checkAuth = (admin) => {
  if (!admin) throw new Error('Not authenticated');
  return admin;
};

const checkSuperAdmin = (admin) => {
  checkAuth(admin);
  if (admin.role !== 'SUPERADMIN') throw new Error('Not authorized. SuperAdmin access required.');
  return admin;
};

const resolvers = {
  Query: {
    getAllAdmins: async (_, __, { admin }) => {
      checkSuperAdmin(admin);
      const admins = await Admin.find({ isActive: true });
      return {
        success: true,
        message: 'Admins retrieved successfully',
        admins,
        totalCount: admins.length
      };
    },

    getAdminById: async (_, { id }, { admin }) => {
      checkSuperAdmin(admin);
      const adminRecord = await Admin.findById(id);
      if (!adminRecord) throw new Error('Admin not found');
      return adminRecord;
    },

    getOwnAdminDetails: async (_, __, { admin }) => {
      checkAuth(admin);
      const adminRecord = await Admin.findById(admin.id);
      if (!adminRecord) throw new Error('Admin not found');
      return adminRecord;
    },

    getAllUsers: async (_, __, { admin }) => {
      checkAuth(admin);
      if (admin.role !== 'ADMIN' && admin.role !== 'SUPERADMIN') {
        throw new Error('Not authorized to view users');
      }
      return await User.find({});
    },
  },

  Mutation: {
    createAdmin: async (_, { input }, { admin }) => {
      checkSuperAdmin(admin);

      const {
        firstName, middleName, lastName, email,
        password, companyName, companyAddress, contactNumber
      } = input;

      if (await Admin.findOne({ email })) throw new Error('Email already exists');

      let normalizedNumber = contactNumber.replace(/\s/g, '');
      const phoneRegex = /^(\+63|0)?\d{10}$/;
      if (!phoneRegex.test(normalizedNumber)) throw new Error('Invalid Philippine mobile number');
      if (!normalizedNumber.startsWith('+63')) {
        normalizedNumber = normalizedNumber.startsWith('0')
          ? '+63' + normalizedNumber.substring(1)
          : '+63' + normalizedNumber;
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newAdmin = new Admin({
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

      return {
        success: true,
        message: 'Admin created successfully',
        admin: newAdmin
      };
    },

    loginAdmin: async (_, { email, password, deviceInfo }) => {
      console.log(`Admin login from: ${deviceInfo.deviceType} - ${deviceInfo.deviceName}`);

      const admin = await Admin.findOne({ email });
      if (!admin || admin.role !== 'ADMIN')
        throw new Error('No admin found with this email');

      if (!admin.isActive) throw new Error('Admin account is deactivated');

      if (admin.isLocked()) throw new Error('Account is temporarily locked. Please try again later');

      const valid = await bcrypt.compare(password, admin.password);
      if (!valid) {
        admin.loginAttempts += 1;
        if (admin.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
          admin.accountLocked = true;
          admin.lockUntil = new Date(Date.now() + LOCK_TIME);
        }
        await admin.save();
        throw new Error('Invalid password');
      }

      admin.loginAttempts = 0;
      admin.accountLocked = false;
      admin.lockUntil = null;
      admin.lastLogin = new Date();
      await admin.save();

      const token = jwt.sign({
        adminId: admin.id,
        email: admin.email,
        role: admin.role,
        isEmailVerified: admin.isEmailVerified,
        tokenVersion: admin.tokenVersion,
      }, JWT_SECRET, { expiresIn: '1d' });

      return { token, admin };
    },

    updateAdmin: async (_, { adminId, input }, { admin }) => {
      checkAuth(admin);

      const isSuperAdmin = admin.role === 'SUPERADMIN';
      const isAdmin = admin.role === 'ADMIN';

      if (!isAdmin && !isSuperAdmin) {
        throw new Error('Not authorized. Admin access required.');
      }

      // If Admin, they can only update their own account
      if (isAdmin && admin.id !== adminId) {
        throw new Error('You can only update your own details');
      }

      let adminToUpdate = await Admin.findById(adminId);
      if (!adminToUpdate) throw new Error('Admin not found');
      if (isAdmin && adminToUpdate.role !== 'ADMIN') {
        throw new Error('You are not allowed to update this user');
      }

      const {
        firstName, middleName, lastName,
        companyName, companyAddress,
        contactNumber, email, password, isActive, permissions
      } = input;

      // Validate contact number if provided
      let normalizedNumber = contactNumber ? contactNumber.replace(/\s/g, '') : null;
      if (normalizedNumber) {
        const phoneRegex = /^(\+63|0)?\d{10}$/;
        if (!phoneRegex.test(normalizedNumber)) throw new Error('Invalid Philippine mobile number');
        if (!normalizedNumber.startsWith('+63')) {
          normalizedNumber = normalizedNumber.startsWith('0')
            ? '+63' + normalizedNumber.substring(1)
            : '+63' + normalizedNumber;
        }
      }

      // Validate email if provided and changed
      if (email && email !== adminToUpdate.email) {
        if (!validator.isEmail(email)) throw new Error('Invalid email address');
        const existingAdmin = await Admin.findOne({ email });
        if (existingAdmin) throw new Error('Email already in use');
        adminToUpdate.email = email.toLowerCase();
      }

      // Update fields
      if (firstName) adminToUpdate.firstName = firstName.trim();
      if (middleName !== undefined) adminToUpdate.middleName = middleName ? middleName.trim() : null;
      if (lastName) adminToUpdate.lastName = lastName.trim();
      if (companyName) adminToUpdate.companyName = companyName.trim();
      if (companyAddress) adminToUpdate.companyAddress = companyAddress.trim();
      if (normalizedNumber) adminToUpdate.contactNumber = normalizedNumber;
      if (isActive !== undefined) adminToUpdate.isActive = isActive;

      // Update permissions if provided (only SuperAdmin can do this)
      if (permissions && isSuperAdmin) {
        Object.keys(permissions).forEach(key => {
          if (permissions[key] !== undefined) {
            adminToUpdate.permissions[key] = permissions[key];
          }
        });
      }

      // Update password if provided
      if (password) {
        const strength = checkPasswordStrength(password);
        if (!strength.strong) throw new Error('Password too weak');
        adminToUpdate.password = await bcrypt.hash(password, 10);
      }

      await adminToUpdate.save();

      return {
        success: true,
        message: 'Admin details updated successfully',
        admin: adminToUpdate
      };
    },

    deleteAdmin: async (_, { id }, { admin }) => {
      checkSuperAdmin(admin);
      const adminToDelete = await Admin.findById(id);
      if (!adminToDelete) throw new Error('Admin not found');

      await Admin.findByIdAndDelete(id);
      return { 
        success: true, 
        message: 'Admin deleted successfully',
        admin: adminToDelete
      };
    },

    activateAdmin: async (_, { id }, { admin }) => {
      checkSuperAdmin(admin);
      const adminToActivate = await Admin.findById(id);
      if (!adminToActivate) throw new Error('Admin not found');

      adminToActivate.isActive = true;
      await adminToActivate.save();

      return {
        success: true,
        message: 'Admin activated successfully',
        admin: adminToActivate
      };
    },

    deactivateAdmin: async (_, { id }, { admin }) => {
      checkSuperAdmin(admin);
      const adminToDeactivate = await Admin.findById(id);
      if (!adminToDeactivate) throw new Error('Admin not found');

      adminToDeactivate.isActive = false;
      await adminToDeactivate.save();

      return {
        success: true,
        message: 'Admin deactivated successfully',
        admin: adminToDeactivate
      };
    },

    logoutAdmin: async (_, __, { admin }) => {
      checkAuth(admin);
      return true;
    },

    logoutAllAdminSessions: async (_, __, { admin }) => {
      checkAuth(admin);
      await Admin.findByIdAndUpdate(admin.id, { $inc: { tokenVersion: 1 } });
      return true;
    },

    changeAdminPassword: async (_, { currentPassword, newPassword }, { admin }) => {
      checkAuth(admin);
      const adminRecord = await Admin.findById(admin.id);
      if (!adminRecord) throw new Error('Admin not found');

      const valid = await bcrypt.compare(currentPassword, adminRecord.password);
      if (!valid) throw new Error('Current password is incorrect');

      const passwordStrength = checkPasswordStrength(newPassword);
      if (!passwordStrength.strong) throw new Error('New password does not meet strength requirements');

      adminRecord.password = await bcrypt.hash(newPassword, 12);
      await adminRecord.save();

      return true;
    },

    requestAdminPasswordReset: async (_, { email }) => {
      const admin = await Admin.findOne({ email: email.toLowerCase().trim() });
      if (!admin) throw new Error("No admin found with this email");

      const resetCode = EmailService.generateVerificationCode();
      admin.emailVerificationCode = resetCode;
      admin.emailVerificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

      await admin.save();
      await EmailService.sendVerificationEmail(admin.email, resetCode);

      return true;
    },

    resetAdminPassword: async (_, { token, newPassword }) => {
      const admin = await Admin.findOne({
        emailVerificationCode: token.trim(),
        emailVerificationCodeExpires: { $gt: new Date() }
      });

      if (!admin) throw new Error('Invalid or expired reset token');

      console.log(`📩 Verification code for ${admin.email}: ${token.trim()}`);

      const strength = checkPasswordStrength(newPassword);
      if (!strength.strong) throw new Error('Password too weak');

      admin.password = await bcrypt.hash(newPassword, 12);
      admin.emailVerificationCode = null;
      admin.emailVerificationCodeExpires = null;

      await admin.save();
      return true;
    },

    deleteUser: async (_, { id }, { admin }) => {
      console.log('🗑️ deleteUser called with context:', { admin: admin ? { id: admin.id, email: admin.email, role: admin.role } : null });
      checkAuth(admin);
      if (admin.role !== 'ADMIN' && admin.role !== 'SUPERADMIN') {
        throw new Error('Not authorized to delete users');
      }
      
      const user = await User.findById(id);
      if (!user) {
        return {
          success: false,
          message: 'User not found'
        };
      }
      
      await User.findByIdAndDelete(id);
      
      return {
        success: true,
        message: 'User deleted successfully'
      };
    },
  },
};

module.exports = resolvers;
