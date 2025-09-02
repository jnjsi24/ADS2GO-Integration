const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const SuperAdmin = require('../models/SuperAdmin');
const Admin = require('../models/Admin');
const { JWT_SECRET } = require('../middleware/auth');
const { validateUserInput, checkPasswordStrength } = require('../utils/validations');
const EmailService = require('../utils/emailService');
const validator = require('validator');

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 2 * 60 * 60 * 1000; // 2 hours

const checkAuth = (superAdmin) => {
  if (!superAdmin) throw new Error('Not authenticated');
  return superAdmin;
};

const resolvers = {
  Query: {
    getAllSuperAdmins: async (_, __, { superAdmin }) => {
      checkAuth(superAdmin);
      const superAdmins = await SuperAdmin.find({ isActive: true });
      return {
        success: true,
        message: 'SuperAdmins retrieved successfully',
        superAdmins,
        totalCount: superAdmins.length
      };
    },

    getSuperAdminById: async (_, { id }, { superAdmin }) => {
      checkAuth(superAdmin);
      const superAdminRecord = await SuperAdmin.findById(id);
      if (!superAdminRecord) throw new Error('SuperAdmin not found');
      return superAdminRecord;
    },

    getOwnSuperAdminDetails: async (_, __, { superAdmin }) => {
      checkAuth(superAdmin);
      const superAdminRecord = await SuperAdmin.findById(superAdmin.id);
      if (!superAdminRecord) throw new Error('SuperAdmin not found');
      return superAdminRecord;
    },

    getAllAdmins: async (_, __, { superAdmin }) => {
      checkAuth(superAdmin);
      if (superAdmin.role !== 'SUPERADMIN') {
        throw new Error('Not authorized to view admins');
      }
      const admins = await Admin.find({ isActive: true });
      return {
        success: true,
        message: 'Admins retrieved successfully',
        admins,
        totalCount: admins.length
      };
    },
  },

  Mutation: {
    createSuperAdmin: async (_, { input }, { superAdmin }) => {
      // Only existing SuperAdmins can create new SuperAdmins
      checkAuth(superAdmin);

      const {
        firstName, middleName, lastName, email,
        password, companyName, companyAddress, contactNumber
      } = input;

      if (await SuperAdmin.findOne({ email })) throw new Error('Email already exists');

      let normalizedNumber = contactNumber.replace(/\s/g, '');
      const phoneRegex = /^(\+63|0)?\d{10}$/;
      if (!phoneRegex.test(normalizedNumber)) throw new Error('Invalid Philippine mobile number');
      if (!normalizedNumber.startsWith('+63')) {
        normalizedNumber = normalizedNumber.startsWith('0')
          ? '+63' + normalizedNumber.substring(1)
          : '+63' + normalizedNumber;
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newSuperAdmin = new SuperAdmin({
        firstName: firstName.trim(),
        middleName: middleName?.trim() || null,
        lastName: lastName.trim(),
        email: email.toLowerCase(),
        password: hashedPassword,
        role: 'SUPERADMIN',
        isEmailVerified: true,
        companyName: companyName.trim(),
        companyAddress: companyAddress.trim(),
        contactNumber: normalizedNumber
      });

      await newSuperAdmin.save();

      return {
        success: true,
        message: 'SuperAdmin created successfully',
        superAdmin: newSuperAdmin
      };
    },

    loginSuperAdmin: async (_, { email, password, deviceInfo }) => {
      console.log(`SuperAdmin login from: ${deviceInfo.deviceType} - ${deviceInfo.deviceName}`);

      const superAdmin = await SuperAdmin.findOne({ email });
      if (!superAdmin || superAdmin.role !== 'SUPERADMIN')
        throw new Error('No superadmin found with this email');

      if (!superAdmin.isActive) throw new Error('SuperAdmin account is deactivated');

      if (superAdmin.isLocked()) throw new Error('Account is temporarily locked. Please try again later');

      const valid = await bcrypt.compare(password, superAdmin.password);
      if (!valid) {
        superAdmin.loginAttempts += 1;
        if (superAdmin.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
          superAdmin.accountLocked = true;
          superAdmin.lockUntil = new Date(Date.now() + LOCK_TIME);
        }
        await superAdmin.save();
        throw new Error('Invalid password');
      }

      superAdmin.loginAttempts = 0;
      superAdmin.accountLocked = false;
      superAdmin.lockUntil = null;
      superAdmin.lastLogin = new Date();
      await superAdmin.save();

      const token = jwt.sign({
        superAdminId: superAdmin.id,
        email: superAdmin.email,
        role: superAdmin.role,
        isEmailVerified: superAdmin.isEmailVerified,
        tokenVersion: superAdmin.tokenVersion,
      }, JWT_SECRET, { expiresIn: '1d' });

      return { token, superAdmin };
    },

    updateSuperAdmin: async (_, { superAdminId, input }, { superAdmin }) => {
      checkAuth(superAdmin);

      // SuperAdmins can only update their own account or other SuperAdmins
      if (superAdmin.id !== superAdminId) {
        throw new Error('You can only update your own details');
      }

      let superAdminToUpdate = await SuperAdmin.findById(superAdminId);
      if (!superAdminToUpdate) throw new Error('SuperAdmin not found');

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
      if (email && email !== superAdminToUpdate.email) {
        if (!validator.isEmail(email)) throw new Error('Invalid email address');
        const existingSuperAdmin = await SuperAdmin.findOne({ email });
        if (existingSuperAdmin) throw new Error('Email already in use');
        superAdminToUpdate.email = email.toLowerCase();
      }

      // Update fields
      if (firstName) superAdminToUpdate.firstName = firstName.trim();
      if (middleName !== undefined) superAdminToUpdate.middleName = middleName ? middleName.trim() : null;
      if (lastName) superAdminToUpdate.lastName = lastName.trim();
      if (companyName) superAdminToUpdate.companyName = companyName.trim();
      if (companyAddress) superAdminToUpdate.companyAddress = companyAddress.trim();
      if (normalizedNumber) superAdminToUpdate.contactNumber = normalizedNumber;
      if (isActive !== undefined) superAdminToUpdate.isActive = isActive;

      // Update permissions if provided
      if (permissions) {
        Object.keys(permissions).forEach(key => {
          if (permissions[key] !== undefined) {
            superAdminToUpdate.permissions[key] = permissions[key];
          }
        });
      }

      // Update password if provided
      if (password) {
        const strength = checkPasswordStrength(password);
        if (!strength.strong) throw new Error('Password too weak');
        superAdminToUpdate.password = await bcrypt.hash(password, 10);
      }

      await superAdminToUpdate.save();

      return {
        success: true,
        message: 'SuperAdmin details updated successfully',
        superAdmin: superAdminToUpdate
      };
    },

    deleteSuperAdmin: async (_, { id }, { superAdmin }) => {
      checkAuth(superAdmin);
      
      // Prevent self-deletion
      if (superAdmin.id === id) {
        throw new Error('Cannot delete your own account');
      }

      const superAdminToDelete = await SuperAdmin.findById(id);
      if (!superAdminToDelete) throw new Error('SuperAdmin not found');

      await SuperAdmin.findByIdAndDelete(id);
      return { 
        success: true, 
        message: 'SuperAdmin deleted successfully',
        superAdmin: superAdminToDelete
      };
    },

    activateSuperAdmin: async (_, { id }, { superAdmin }) => {
      checkAuth(superAdmin);
      const superAdminToActivate = await SuperAdmin.findById(id);
      if (!superAdminToActivate) throw new Error('SuperAdmin not found');

      superAdminToActivate.isActive = true;
      await superAdminToActivate.save();

      return {
        success: true,
        message: 'SuperAdmin activated successfully',
        superAdmin: superAdminToActivate
      };
    },

    deactivateSuperAdmin: async (_, { id }, { superAdmin }) => {
      checkAuth(superAdmin);
      
      // Prevent self-deactivation
      if (superAdmin.id === id) {
        throw new Error('Cannot deactivate your own account');
      }

      const superAdminToDeactivate = await SuperAdmin.findById(id);
      if (!superAdminToDeactivate) throw new Error('SuperAdmin not found');

      superAdminToDeactivate.isActive = false;
      await superAdminToDeactivate.save();

      return {
        success: true,
        message: 'SuperAdmin deactivated successfully',
        superAdmin: superAdminToDeactivate
      };
    },

    logoutSuperAdmin: async (_, __, { superAdmin }) => {
      checkAuth(superAdmin);
      return true;
    },

    logoutAllSuperAdminSessions: async (_, __, { superAdmin }) => {
      checkAuth(superAdmin);
      await SuperAdmin.findByIdAndUpdate(superAdmin.id, { $inc: { tokenVersion: 1 } });
      return true;
    },

    changeSuperAdminPassword: async (_, { currentPassword, newPassword }, { superAdmin }) => {
      checkAuth(superAdmin);
      const superAdminRecord = await SuperAdmin.findById(superAdmin.id);
      if (!superAdminRecord) throw new Error('SuperAdmin not found');

      const valid = await bcrypt.compare(currentPassword, superAdminRecord.password);
      if (!valid) throw new Error('Current password is incorrect');

      const passwordStrength = checkPasswordStrength(newPassword);
      if (!passwordStrength.strong) throw new Error('New password does not meet strength requirements');

      superAdminRecord.password = await bcrypt.hash(newPassword, 12);
      await superAdminRecord.save();

      return true;
    },

    requestSuperAdminPasswordReset: async (_, { email }) => {
      const superAdmin = await SuperAdmin.findOne({ email: email.toLowerCase().trim() });
      if (!superAdmin) throw new Error("No superadmin found with this email");

      const resetCode = EmailService.generateVerificationCode();
      superAdmin.emailVerificationCode = resetCode;
      superAdmin.emailVerificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

      await superAdmin.save();
      await EmailService.sendVerificationEmail(superAdmin.email, resetCode);

      return true;
    },

    resetSuperAdminPassword: async (_, { token, newPassword }) => {
      const superAdmin = await SuperAdmin.findOne({
        emailVerificationCode: token.trim(),
        emailVerificationCodeExpires: { $gt: new Date() }
      });

      if (!superAdmin) throw new Error('Invalid or expired reset token');

      console.log(`📩 Verification code for ${superAdmin.email}: ${token.trim()}`);

      const strength = checkPasswordStrength(newPassword);
      if (!strength.strong) throw new Error('Password too weak');

      superAdmin.password = await bcrypt.hash(newPassword, 12);
      superAdmin.emailVerificationCode = null;
      superAdmin.emailVerificationCodeExpires = null;

      await superAdmin.save();
      return true;
    },

    // Admin management mutations (for SuperAdmins)
    createAdmin: async (_, { input }, { superAdmin }) => {
      checkAuth(superAdmin);
      if (superAdmin.role !== 'SUPERADMIN') {
        throw new Error('Not authorized to create admins');
      }

      const {
        firstName, middleName, lastName, email,
        password, companyName, companyAddress, contactNumber, profilePicture
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
        contactNumber: normalizedNumber,
        profilePicture: profilePicture || null
      });

      await newAdmin.save();

      return {
        success: true,
        message: 'Admin created successfully',
        admin: newAdmin
      };
    },

    updateAdmin: async (_, { adminId, input }, { superAdmin }) => {
      checkAuth(superAdmin);
      if (superAdmin.role !== 'SUPERADMIN') {
        throw new Error('Not authorized to update admins');
      }

      let adminToUpdate = await Admin.findById(adminId);
      if (!adminToUpdate) throw new Error('Admin not found');

      const {
        firstName, middleName, lastName,
        companyName, companyAddress,
        contactNumber, email, password, profilePicture, isActive, permissions
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
      if (profilePicture !== undefined) adminToUpdate.profilePicture = profilePicture;
      if (isActive !== undefined) adminToUpdate.isActive = isActive;

      // Update permissions if provided
      if (permissions) {
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

    deleteAdmin: async (_, { id }, { superAdmin }) => {
      checkAuth(superAdmin);
      if (superAdmin.role !== 'SUPERADMIN') {
        throw new Error('Not authorized to delete admins');
      }

      const adminToDelete = await Admin.findById(id);
      if (!adminToDelete) throw new Error('Admin not found');

      await Admin.findByIdAndDelete(id);
      return { 
        success: true, 
        message: 'Admin deleted successfully',
        admin: adminToDelete
      };
    },

    activateAdmin: async (_, { id }, { superAdmin }) => {
      checkAuth(superAdmin);
      if (superAdmin.role !== 'SUPERADMIN') {
        throw new Error('Not authorized to activate admins');
      }

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

    deactivateAdmin: async (_, { id }, { superAdmin }) => {
      checkAuth(superAdmin);
      if (superAdmin.role !== 'SUPERADMIN') {
        throw new Error('Not authorized to deactivate admins');
      }

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

    // Note: deleteUser is handled by adminResolver for both ADMIN and SUPERADMIN roles
  },
};

module.exports = resolvers;
