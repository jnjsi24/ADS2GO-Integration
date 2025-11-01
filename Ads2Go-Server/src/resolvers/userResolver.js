const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Ad = require('../models/Ad');
const { JWT_SECRET } = require('../middleware/auth');
const { validateUserInput, checkPasswordStrength } = require('../utils/validations');
const EmailService = require('../utils/emailService');
const AnalyticsService = require('../services/analyticsService');
const validator = require('validator');

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 1 * 60 * 60 * 1000; // 1 hour

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

    getUserNotificationPreferences: async (_, __, { user }) => {
      try {
        console.log('🔔 getUserNotificationPreferences called for user:', user?.id);
        checkAuth(user);
        
        const userRecord = await User.findById(user.id);
        if (!userRecord) {
          console.error('❌ User not found for ID:', user.id);
          throw new Error('User not found');
        }
        
        console.log('✅ User found:', userRecord.email);
        console.log('📋 Current notification preferences:', userRecord.notificationPreferences);
        
        // Return default preferences if none exist
        if (!userRecord.notificationPreferences) {
          console.log('🔧 Returning default preferences');
          return {
            enableDesktopNotifications: false,
            enableNotificationBadge: true,
            pushNotificationTimeout: '10',
            communicationEmails: false,
            announcementsEmails: true
          };
        }
        
        return userRecord.notificationPreferences;
      } catch (error) {
        console.error('❌ Error in getUserNotificationPreferences:', error);
        throw error;
      }
    },

    getQueuedEmailStats: async (_, __, { user }) => {
      try {
        console.log('📧 getQueuedEmailStats called for user:', user?.id);
        checkAuth(user);
        
        const EnhancedEmailNotificationService = require('../services/notifications/EnhancedEmailNotificationService');
        const stats = await EnhancedEmailNotificationService.getQueuedEmailStats(user.id);
        
        console.log('📧 Queued email stats:', stats);
        return stats;
      } catch (error) {
        console.error('❌ Error in getQueuedEmailStats:', error);
        throw error;
      }
    },

        getUserAnalytics: async (_, { startDate, endDate, period, adId }, { user }) => {
          checkAuth(user);
          try {
            console.log('🔍 getUserAnalytics called for user:', user.id, 'with period:', period, 'adId:', adId, 'startDate:', startDate, 'endDate:', endDate);
            
            // Use the new UserAnalytics system
            const UserAnalyticsService = require('../services/userAnalyticsService');
            const analytics = await UserAnalyticsService.getUserAnalytics(
              user.id,
              startDate,
              endDate,
              period,
              adId
            );
            
            if (!analytics.success) {
              console.error('❌ Analytics service returned failure:', analytics.message);
              throw new Error(analytics.message || 'Failed to fetch analytics data');
            }
            
            console.log('✅ getUserAnalytics returning data for user:', user.id);
            console.log('📊 Summary data being returned:', JSON.stringify(analytics.data.summary, null, 2));
            return analytics.data;
          } catch (error) {
            console.error('❌ Error fetching user analytics:', error);
            throw new Error('Failed to fetch analytics data');
          }
        },

    getUserAdDetails: async (_, { adId }, { user }) => {
      checkAuth(user);
      try {
        const adDetails = await AnalyticsService.getUserAdDetails(user.id, adId);
        return adDetails;
      } catch (error) {
        console.error('Error fetching ad details:', error);
        throw new Error('Failed to fetch ad details');
      }
    },

    getUserMaterialsWithLocation: async (_, __, { user }) => {
      checkAuth(user);
      try {
        console.log('📍 getUserMaterialsWithLocation called for user:', user.id);
        
        const UserAnalyticsService = require('../services/userAnalyticsService');
        const result = await UserAnalyticsService.getActiveTotalMaterials(user.id);
        
        if (!result.success) {
          console.log('⚠️ No materials found for user:', user.id);
          return {
            success: true,
            message: result.message || 'No materials found',
            totalMaterials: 0,
            activeMaterials: 0,
            materials: []
          };
        }
        
        console.log(`✅ Found ${result.materials.length} materials for user ${user.id}`);
        
        return {
          success: true,
          message: 'Materials retrieved successfully',
          totalMaterials: result.totalMaterials,
          activeMaterials: result.activeMaterials,
          materials: result.materials.map(material => {
            // Helper function to validate location
            const hasValidLocation = (loc) => {
              return loc && 
                     typeof loc.lat === 'number' && 
                     typeof loc.lng === 'number' && 
                     !isNaN(loc.lat) && 
                     !isNaN(loc.lng) &&
                     loc.lat !== 0 && 
                     loc.lng !== 0 &&
                     loc.lat >= -90 && 
                     loc.lat <= 90 &&
                     loc.lng >= -180 && 
                     loc.lng <= 180;
            };

            const location = material.currentStatus?.currentLocation;
            
            return {
              materialId: material.materialId,
              materialName: `${material.materialType || 'Material'} - ${material.materialId}`,
              materialType: material.materialType,
              vehicleType: material.vehicleType,
              category: material.category,
              isOnline: material.currentStatus?.isOnline || false,
              lastSeen: material.currentStatus?.lastSeen,
              currentLocation: hasValidLocation(location) ? {
                lat: location.lat,
                lng: location.lng,
                timestamp: location.timestamp,
                speed: location.speed,
                heading: location.heading,
                accuracy: location.accuracy,
                address: location.address
              } : null,
              totalAdPlays: material.currentStatus?.totalAdPlays || 0,
              totalQRScans: material.currentStatus?.totalQRScans || 0,
              totalAdPlayTime: material.currentStatus?.totalAdPlayTime || 0,
              totalAdImpressions: material.currentStatus?.totalAdImpressions || 0,
              carGroupId: material.currentStatus?.carGroupId,
              screenType: material.currentStatus?.screenType,
              ads: material.ads || []
            };
          })
        };
      } catch (error) {
        console.error('❌ Error fetching user materials with location:', error);
        throw new Error('Failed to fetch materials with location');
      }
    },
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

        // Try to send verification email
        const emailSent = await EmailService.sendVerificationEmail(newUser.email, verificationCode);
        if (!emailSent) {
          console.error(`❌ Failed to send verification email to ${newUser.email}`);
          console.error('   User will still be created, but they may need to request a new verification code');
        }
        
        await newUser.save();

        // Subscribe user to newsletter with 'registration' source
        try {
          const Newsletter = require('../models/Newsletter');
          const existingSubscription = await Newsletter.findOne({ 
            email: newUser.email 
          });

          if (!existingSubscription) {
            // Create new newsletter subscription with 'registration' source
            const newsletter = new Newsletter({
              email: newUser.email,
              subscribedAt: new Date(),
              isActive: true,
              source: 'registration'
            });
            await newsletter.save();
            console.log(`✅ User subscribed to newsletter (registration source): ${newUser.email}`);
          } else {
            // Update existing subscription source to 'registration' if it was from contact form
            if (existingSubscription.source === 'contact_form') {
              existingSubscription.source = 'registration';
              await existingSubscription.save();
              console.log(`✅ Updated newsletter source from contact_form to registration: ${newUser.email}`);
            }
          }
        } catch (newsletterError) {
          console.error('⚠️  Newsletter subscription error during registration:', newsletterError.message);
          // Don't fail the user creation if newsletter subscription fails
        }

        // Send notification to admins about new user registration
        try {
          const NotificationService = require('../services/notifications/NotificationService');
          await NotificationService.sendNewUserRegistrationNotification(newUser._id);
          console.log(`✅ Sent new user registration notification for user: ${newUser._id}`);
        } catch (notificationError) {
          console.error('❌ Error sending new user registration notification:', notificationError);
          // Don't fail the user creation if notification fails
        }

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

    completeGoogleOAuthProfile: async (_, { input }) => {
      try {
        const {
          googleId, email, firstName, lastName, profilePicture,
          middleName, companyName, companyAddress, contactNumber, houseAddress
        } = input;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          console.log('✅ User already exists, logging them in directly');
          // User already exists, generate new token and return user data
          const token = jwt.sign({
            userId: existingUser.id,
            email: existingUser.email,
            role: existingUser.role,
            firstName: existingUser.firstName,
            lastName: existingUser.lastName,
            tokenVersion: existingUser.tokenVersion,
          }, process.env.JWT_SECRET, { expiresIn: '7d' });

          console.log('✅ Generated token for existing user:', existingUser.firstName, existingUser.lastName);
          return {
            token,
            user: existingUser
          };
        }
        
        console.log('🆕 User does not exist, creating new account');

        // Validate phone number
        let normalizedNumber = contactNumber.replace(/\s/g, '');
        const phoneRegex = /^(\+63|0)?\d{10}$/;
        if (!phoneRegex.test(normalizedNumber)) {
          throw new Error('Invalid Philippine mobile number');
        }
        if (!normalizedNumber.startsWith('+63')) {
          normalizedNumber = normalizedNumber.startsWith('0') ? '+63' + normalizedNumber.substring(1) : '+63' + normalizedNumber;
        }

        // Create new user with Google OAuth data
        const newUser = new User({
          firstName: firstName.trim(),
          middleName: middleName?.trim() || null,
          lastName: lastName?.trim() || 'User', // Provide default if Google doesn't give last name
          companyName: companyName.trim(),
          companyAddress: companyAddress.trim(),
          houseAddress: houseAddress?.trim() || null,
          contactNumber: normalizedNumber,
          email: email.toLowerCase().trim(),
          password: null, // No password for OAuth users
          role: 'USER',
          isEmailVerified: true, // Google emails are pre-verified
          profilePicture: profilePicture || null,
          googleId: googleId,
          authProvider: 'google',
          emailVerificationCode: null,
          emailVerificationCodeExpires: null,
        });

        await newUser.save();

        // Subscribe user to newsletter with 'registration' source
        try {
          const Newsletter = require('../models/Newsletter');
          const existingSubscription = await Newsletter.findOne({ 
            email: newUser.email 
          });

          if (!existingSubscription) {
            // Create new newsletter subscription with 'registration' source
            const newsletter = new Newsletter({
              email: newUser.email,
              subscribedAt: new Date(),
              isActive: true,
              source: 'registration'
            });
            await newsletter.save();
            console.log(`✅ Google OAuth user subscribed to newsletter (registration source): ${newUser.email}`);
          } else {
            // Update existing subscription source to 'registration' if it was from contact form
            if (existingSubscription.source === 'contact_form') {
              existingSubscription.source = 'registration';
              await existingSubscription.save();
              console.log(`✅ Updated newsletter source from contact_form to registration (Google OAuth): ${newUser.email}`);
            }
          }
        } catch (newsletterError) {
          console.error('⚠️  Newsletter subscription error during Google OAuth registration:', newsletterError.message);
          // Don't fail the user creation if newsletter subscription fails
        }

        // Generate JWT token
        const token = jwt.sign({
          userId: newUser.id,
          email: newUser.email,
          role: newUser.role,
          isEmailVerified: newUser.isEmailVerified,
          tokenVersion: newUser.tokenVersion,
        }, JWT_SECRET, { expiresIn: '30d' }); // 30 days for OAuth users

        return { token, user: newUser };
      } catch (error) {
        console.error('Complete Google OAuth profile error:', error);
        throw error;
      }
    },

    loginUser: async (_, { email, password, deviceInfo, keepLoggedIn = false }) => {
      console.log(`User login from: ${deviceInfo.deviceType} - ${deviceInfo.deviceName}`);

      const user = await User.findOne({ email });
      if (!user || user.role !== 'USER') throw new Error('No user found with this email');

      // Check if user is archived (scheduled for deletion)
      if (user.isArchived) {
        throw new Error('This account has been deleted and is no longer accessible');
      }

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
      }, JWT_SECRET, { expiresIn: keepLoggedIn ? '30d' : '1d' });

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
        contactNumber, email, password, houseAddress, profilePicture
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

      // Track which fields are being changed for notifications and capture old values
      const changedFields = [];
      const oldValues = {};

      if (firstName && firstName.trim() !== userRecord.firstName) {
        oldValues.firstName = userRecord.firstName;
        userRecord.firstName = firstName.trim();
        changedFields.push('firstName');
      }
      if (middleName !== undefined) {
        const newMiddleName = middleName ? middleName.trim() : null;
        if (newMiddleName !== userRecord.middleName) {
          oldValues.middleName = userRecord.middleName;
          userRecord.middleName = newMiddleName;
          changedFields.push('middleName');
        }
      }
      if (lastName && lastName.trim() !== userRecord.lastName) {
        oldValues.lastName = userRecord.lastName;
        userRecord.lastName = lastName.trim();
        changedFields.push('lastName');
      }
      if (companyName && companyName.trim() !== userRecord.companyName) {
        oldValues.companyName = userRecord.companyName;
        userRecord.companyName = companyName.trim();
        changedFields.push('companyName');
      }
      if (companyAddress && companyAddress.trim() !== userRecord.companyAddress) {
        oldValues.companyAddress = userRecord.companyAddress;
        userRecord.companyAddress = companyAddress.trim();
        changedFields.push('companyAddress');
      }
      if (normalizedNumber && normalizedNumber !== userRecord.contactNumber) {
        oldValues.contactNumber = userRecord.contactNumber;
        userRecord.contactNumber = normalizedNumber;
        changedFields.push('contactNumber');
      }
      if (houseAddress !== undefined) {
        const newHouseAddress = houseAddress ? houseAddress.trim() : null;
        if (newHouseAddress !== userRecord.houseAddress) {
          oldValues.houseAddress = userRecord.houseAddress;
          userRecord.houseAddress = newHouseAddress;
          changedFields.push('houseAddress');
        }
      }
      if (password) {
        oldValues.password = '[HIDDEN]';
        userRecord.password = await bcrypt.hash(password, 10);
        changedFields.push('password');
      }
      if (email && email !== userRecord.email) {
        oldValues.email = userRecord.email;
        changedFields.push('email');
      }
      if (profilePicture !== undefined) {
        const newProfilePicture = profilePicture ? profilePicture.trim() : null;
        if (newProfilePicture !== userRecord.profilePicture) {
          oldValues.profilePicture = userRecord.profilePicture;
          userRecord.profilePicture = newProfilePicture;
          changedFields.push('profilePicture');
        }
      }

      await userRecord.save();

      // Send profile change notification if any fields were changed
      if (changedFields.length > 0) {
        try {
          console.log('Sending profile change notification for fields:', changedFields);
          console.log('Old values:', oldValues);
          const NotificationService = require('../services/notifications/NotificationService');
          await NotificationService.sendProfileChangeNotification(user.id, changedFields, oldValues);
          console.log('✅ Profile change notification sent successfully');
        } catch (notificationError) {
          console.error('❌ Error sending profile change notification:', notificationError);
          // Don't fail the update if notification fails
        }
      }

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

    deleteOwnAccount: async (_, __, { user }) => {
      checkAuth(user);
      
      try {
        const userRecord = await User.findById(user.id);
        
        if (!userRecord) {
          return {
            success: false,
            message: 'User not found'
          };
        }
        
        // Check if already archived
        if (userRecord.isArchived) {
          return {
            success: false,
            message: 'Account is already scheduled for deletion'
          };
        }
        
        // Soft delete: Mark as archived with 30-day deletion schedule
        const now = new Date();
        const deletionDate = new Date(now);
        deletionDate.setDate(deletionDate.getDate() + 30); // 30 days from now
        
        userRecord.isArchived = true;
        userRecord.archivedAt = now;
        userRecord.scheduledDeletionDate = deletionDate;
        
        // Increment token version to invalidate all existing sessions
        userRecord.tokenVersion += 1;
        
        await userRecord.save();
        
        // Auto-unsubscribe from newsletter when account is deleted
        try {
          const Newsletter = require('../models/Newsletter');
          const newsletter = await Newsletter.findOne({ email: userRecord.email });
          
          if (newsletter && newsletter.isActive) {
            newsletter.isActive = false;
            await newsletter.save();
            console.log(`✅ Auto-unsubscribed ${userRecord.email} from newsletter (account deleted)`);
          }
        } catch (newsletterError) {
          console.error('⚠️  Newsletter unsubscribe error during account deletion:', newsletterError.message);
        }
        
        console.log(`✅ User ${userRecord.email} deleted their own account. Scheduled for permanent deletion on: ${deletionDate.toISOString()}`);
        
        return {
          success: true,
          message: 'Your account has been scheduled for deletion in 30 days. You have been logged out.'
        };
      } catch (error) {
        console.error('Error deleting own account:', error);
        return {
          success: false,
          message: 'Failed to delete account: ' + error.message
        };
      }
    },

    restoreOwnAccount: async (_, __, { user }) => {
      checkAuth(user);
      
      try {
        const userRecord = await User.findById(user.id);
        
        if (!userRecord) {
          return {
            success: false,
            message: 'User not found'
          };
        }
        
        if (!userRecord.isArchived) {
          return {
            success: false,
            message: 'Account is not archived'
          };
        }
        
        userRecord.isArchived = false;
        userRecord.archivedAt = null;
        userRecord.scheduledDeletionDate = null;
        userRecord.tokenVersion += 1; // Invalidate all sessions
        
        await userRecord.save();
        
        console.log(`✅ User ${userRecord.email} restored their own account successfully`);
        
        return {
          success: true,
          message: 'Your account has been restored successfully. You have been logged out.'
        };
      } catch (error) {
        console.error('Error restoring own account:', error);
        return {
          success: false,
          message: 'Failed to restore account: ' + error.message
        };
      }
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

    updateUserNotificationPreferences: async (_, { input }, { user }) => {
      try {
        console.log('🔔 updateUserNotificationPreferences called with:', { input, userId: user?.id });
        
        checkAuth(user);
        
        const userRecord = await User.findById(user.id);
        if (!userRecord) {
          console.error('❌ User not found for ID:', user.id);
          throw new Error('User not found');
        }

        console.log('✅ User found:', userRecord.email);

        // Initialize notification preferences if they don't exist
        if (!userRecord.notificationPreferences) {
          console.log('🔧 Initializing notification preferences');
          userRecord.notificationPreferences = {
            enableDesktopNotifications: false,
            enableNotificationBadge: true,
            pushNotificationTimeout: '10',
            communicationEmails: false,
            announcementsEmails: true
          };
        }

        // Store previous announcements emails setting
        const wasAnnouncementsEmailsEnabled = userRecord.notificationPreferences.announcementsEmails;

        // Update only the provided fields
        Object.keys(input).forEach(key => {
          if (input[key] !== undefined && input[key] !== null) {
            console.log(`🔄 Updating ${key} from ${userRecord.notificationPreferences[key]} to ${input[key]}`);
            userRecord.notificationPreferences[key] = input[key];
          }
        });

        await userRecord.save();
        console.log('✅ Notification preferences saved successfully');

        // If announcements emails were just enabled, process any queued emails
        if (!wasAnnouncementsEmailsEnabled && input.announcementsEmails === true) {
          console.log('📧 Announcements emails enabled, processing queued emails...');
          try {
            const EnhancedEmailNotificationService = require('../services/notifications/EnhancedEmailNotificationService');
            const queueResult = await EnhancedEmailNotificationService.processQueuedEmails(user.id);
            console.log('📧 Queued emails processed:', queueResult);
          } catch (queueError) {
            console.error('❌ Error processing queued emails:', queueError);
            // Don't throw error - notification preferences were still saved successfully
          }
        }

        return {
          success: true,
          message: 'Notification preferences updated successfully',
          user: userRecord
        };
      } catch (error) {
        console.error('❌ Error in updateUserNotificationPreferences:', error);
        throw error;
      }
    }
  },

  User: {
    ads: async (parent) => {
      return await Ad.find({ userId: parent.id });
    }
  }
};

module.exports = resolvers;