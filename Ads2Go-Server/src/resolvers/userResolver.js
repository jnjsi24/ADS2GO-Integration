const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Ad = require('../models/Ad');
const { JWT_SECRET } = require('../middleware/auth');
const { validateUserInput, checkPasswordStrength } = require('../utils/validations');
const EmailService = require('../utils/emailService');
const validator = require('validator');

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 2 * 60 * 60 * 1000; // 2 hours

const checkAuth = (user) => {
  if (!user) throw new Error('Not authenticated');
  return user;
};



const resolvers = {
  Query: {
    getOwnUserDetails: async (_, __, { user }) => {
      checkAuth(user);
      const userRecord = await User.findById(user.id);
      if (!userRecord) throw new Error('User not found');
      return userRecord;
    },

    checkPasswordStrength: (_, { password }) => checkPasswordStrength(password),
  },

  Mutation: {


    createUser: async (_, { input }) => {
      try {
        const validationErrors = validateUserInput(input);
        if (validationErrors.length > 0) throw new Error(validationErrors.join(', '));

        const {
          firstName, middleName, lastName,
          companyName, companyAddress, contactNumber,
          email, password, houseAddress
        } = input;

        let normalizedNumber = contactNumber.replace(/\s/g, '');
        const phoneRegex = /^(\+63|0)?\d{10}$/;
        if (!phoneRegex.test(normalizedNumber)) throw new Error('Invalid Philippine mobile number');
        if (!normalizedNumber.startsWith('+63')) {
          normalizedNumber = normalizedNumber.startsWith('0') ? '+63' + normalizedNumber.substring(1) : '+63' + normalizedNumber;
        }

        if (await User.findOne({ email })) throw new Error('User with this email already exists');

        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationCode = EmailService.generateVerificationCode();

        console.log(`📩 Verification code for ${email}: ${verificationCode}`);

        const newUser = new User({
          firstName: firstName.trim(),
          middleName: middleName?.trim() || null,
          lastName: lastName.trim(),
          companyName: companyName.trim(),
          companyAddress: companyAddress.trim(),
          houseAddress,
          contactNumber: normalizedNumber,
          email: email.toLowerCase().trim(),
          password: hashedPassword,
          role: 'USER',
          isEmailVerified: false,
          emailVerificationCode: verificationCode,
          emailVerificationCodeExpires: new Date(Date.now() + 15 * 60 * 1000),
        });

        await EmailService.sendVerificationEmail(newUser.email, verificationCode);
        await newUser.save();

        const token = jwt.sign({
          userId: newUser.id,
          email: newUser.email,
          role: newUser.role,
          isEmailVerified: newUser.isEmailVerified,
          tokenVersion: newUser.tokenVersion,
        }, JWT_SECRET, { expiresIn: '1d' });

        return { token, user: newUser };
      } catch (error) {
        throw error;
      }
    },

    loginUser: async (_, { email, password, deviceInfo }) => {
      console.log(`User login from: ${deviceInfo.deviceType} - ${deviceInfo.deviceName}`);

      const user = await User.findOne({ email });
      if (!user || user.role !== 'USER') throw new Error('No user found with this email');

      if (user.isLocked()) throw new Error('Account is temporarily locked. Please try again later');

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        user.loginAttempts += 1;
        if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
          user.accountLocked = true;
          user.lockUntil = new Date(Date.now() + LOCK_TIME);
        }
        await user.save();
        throw new Error('Invalid password');
      }

      user.loginAttempts = 0;
      user.accountLocked = false;
      user.lockUntil = null;
      user.lastLogin = new Date();
      await user.save();

      const token = jwt.sign({
        userId: user.id,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        tokenVersion: user.tokenVersion,
      }, JWT_SECRET, { expiresIn: '1d' });

      return { token, user };
    },



    verifyEmail: async (_, { code }) => {
      const userToVerify = await User.findOne({ emailVerificationCode: code.trim() });
      if (!userToVerify) throw new Error('Invalid verification code');
      if (new Date() > userToVerify.emailVerificationCodeExpires) throw new Error('Verification code has expired');

      userToVerify.isEmailVerified = true;
      userToVerify.emailVerificationCode = null;
      await userToVerify.save();

      const token = jwt.sign({
        id: userToVerify._id,
        email: userToVerify.email,
        role: userToVerify.role,
        isEmailVerified: true,
        tokenVersion: userToVerify.tokenVersion,
      }, JWT_SECRET, { expiresIn: '30d' });

      return { success: true, message: 'Email verified successfully', token };
    },

    resendVerificationCode: async (_, { email }) => {
      const user = await User.findOne({ email });
      if (!user) throw new Error('User not found');

      const newVerificationCode = EmailService.generateVerificationCode();
      user.emailVerificationCode = newVerificationCode;
      user.emailVerificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000);

      await EmailService.sendVerificationEmail(user.email, newVerificationCode);
      await user.save();

      return { success: true, message: 'New verification code sent to your email' };
    },

    changePassword: async (_, { currentPassword, newPassword }, { user }) => {
      checkAuth(user);
      const userRecord = await User.findById(user.id);
      if (!userRecord) throw new Error('User not found');

      const valid = await bcrypt.compare(currentPassword, userRecord.password);
      if (!valid) throw new Error('Current password is incorrect');

      const passwordStrength = checkPasswordStrength(newPassword);
      if (!passwordStrength.strong) throw new Error('New password does not meet strength requirements');

      userRecord.password = await bcrypt.hash(newPassword, 12);
      await userRecord.save();

      return true;
    },

    updateUser: async (_, { input }, { user }) => {
      checkAuth(user);
      const userRecord = await User.findById(user.id);
      if (!userRecord) throw new Error('User not found');

      if ('password' in input && (!input.password || input.password.trim() === '')) {
        throw new Error('Password cannot be empty if provided');
      }

      if ('houseAddress' in input && (!input.houseAddress || input.houseAddress.trim() === '')) {
        throw new Error('House address cannot be empty if provided');
      }

      const {
        firstName, middleName, lastName,
        companyName, companyAddress,
        contactNumber, email, password, houseAddress
      } = input;

      let normalizedNumber = contactNumber ? contactNumber.replace(/\s/g, '') : null;
      if (normalizedNumber && !/^(\+63|0)?\d{10}$/.test(normalizedNumber)) {
        throw new Error('Invalid Philippine mobile number');
      }
      if (normalizedNumber && !normalizedNumber.startsWith('+63')) {
        normalizedNumber = normalizedNumber.startsWith('0')
          ? '+63' + normalizedNumber.substring(1)
          : '+63' + normalizedNumber;
      }

      if (email && email !== userRecord.email) {
        if (!validator.isEmail(email)) throw new Error('Invalid email address');
        const existingUser = await User.findOne({ email });
        if (existingUser) throw new Error('Email already in use');
        userRecord.email = email.toLowerCase();
      }

      if (firstName) userRecord.firstName = firstName.trim();
      if (middleName !== undefined) userRecord.middleName = middleName ? middleName.trim() : null;
      if (lastName) userRecord.lastName = lastName.trim();
      if (companyName) userRecord.companyName = companyName.trim();
      if (companyAddress) userRecord.companyAddress = companyAddress.trim();
      if (normalizedNumber) userRecord.contactNumber = normalizedNumber;
      if (houseAddress !== undefined) userRecord.houseAddress = houseAddress ? houseAddress.trim() : userRecord.houseAddress;
      if (password) userRecord.password = await bcrypt.hash(password, 10);

      await userRecord.save();

      return {
        success: true,
        message: 'User updated successfully',
        user: userRecord,
      };
    },






    logout: async (_, __, { user }) => {
      checkAuth(user);
      return true;
    },

    logoutAllSessions: async (_, __, { user }) => {
      checkAuth(user);
      await User.findByIdAndUpdate(user.id, { $inc: { tokenVersion: 1 } });
      return true;
    },

    requestPasswordReset: async (_, { email }) => {
      const user = await User.findOne({ email: email.toLowerCase().trim() });
      if (!user) throw new Error("No user found with this email");

      const resetCode = EmailService.generateVerificationCode();
      user.emailVerificationCode = resetCode;
      user.emailVerificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

      await user.save();
      await EmailService.sendVerificationEmail(user.email, resetCode);

      return true;
    },

    resetPassword: async (_, { token, newPassword }) => {
  const user = await User.findOne({
    emailVerificationCode: token.trim(),
    emailVerificationCodeExpires: { $gt: new Date() }
  });

  if (!user) throw new Error('Invalid or expired reset token');

  // 🔽 Log the verification code and email here
  console.log(`📩 Verification code for ${user.email}: ${token.trim()}`);

  const strength = checkPasswordStrength(newPassword);
  if (!strength.strong) throw new Error('Password too weak');

  user.password = await bcrypt.hash(newPassword, 12);
  user.emailVerificationCode = null;
  user.emailVerificationCodeExpires = null;

  await user.save();
  return true;
},
  },

  User: {
    ads: async (parent) => {
      return await Ad.find({ userId: parent.id });
    }
  }
};

module.exports = resolvers;
