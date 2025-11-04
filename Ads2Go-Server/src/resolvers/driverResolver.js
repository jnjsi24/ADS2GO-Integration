const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Driver = require('../models/Driver');
const Material = require('../models/Material');
const AdsDeployment = require('../models/adsDeployment');
const { JWT_SECRET, checkAdmin } = require('../middleware/auth');
const { checkDriverAuth } = require('../middleware/driverAuth');
const { verifyDriverForMaterialAssignment } = require('../middleware/driverMaterialAuth');
const EmailService = require('../utils/emailService');
const validator = require('validator');
const { GraphQLUpload } = require('graphql-upload');
const { uploadToFirebase, ALLOWED_MIME_TYPES, MAX_FILE_SIZE } = require('../utils/firebaseStorage');
const DriverSalaryService = require('../services/driverSalaryService');

// ===== VEHICLE MATERIAL MAP =====
const VEHICLE_MATERIAL_MAP = {
  CAR: ['LCD', 'STICKER', 'HEADDRESS'],
  BUS: ['LCD', 'STICKER'],
  E_TRIKE: ['STICKER', 'HEADDRESS'],
  JEEP: ['STICKER'],
  MOTORCYCLE: ['LCD', 'BANNER']
};

const ALLOWED_VEHICLE_TYPES = Object.keys(VEHICLE_MATERIAL_MAP);

// ===== Helper: Enhanced Password Validation =====
const isValidPassword = (password) => {
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  
  return password.length >= 8 && hasUppercase && hasLowercase && hasNumber && hasSpecialChar;
};

// ===== Helper: Generate Unique Driver ID =====
const generateDriverId = async () => {
  let newId;
  let exists = true;
  while (exists) {
    const lastDriver = await Driver.findOne().sort({ createdAt: -1 });
    if (!lastDriver || !lastDriver.driverId) {
      newId = 'DRV-001';
    } else {
      const lastNum = parseInt(lastDriver.driverId.split('-')[1], 10);
      newId = `DRV-${String(lastNum + 1).padStart(3, '0')}`;
    }
    exists = await Driver.findOne({ driverId: newId });
  }
  return newId;
};

// ===== Helper: Assign Material to Driver =====
async function assignMaterialToDriver(driver) {
  // Verify driver is eligible for material assignment
  if (driver.accountStatus !== 'ACTIVE' || driver.reviewStatus !== 'APPROVED' || !driver.isEmailVerified) {
    throw new Error('Driver must be approved and email verified before material assignment');
  }

  const allowedTypes = VEHICLE_MATERIAL_MAP[driver.vehicleType];
  if (!allowedTypes || !allowedTypes.length) {
    throw new Error(`No allowed material types found for vehicle type: ${driver.vehicleType}`);
  }

  // Check if driver already has a material assigned
  if (driver.materialId) {
    const existingMaterial = await Material.findOne({ 
      _id: driver.materialId,
      isArchived: { $ne: true } // ✅ Exclude archived materials
    });
    if (existingMaterial) {
      throw new Error('Driver already has an assigned material');
    }
  }

  // Get available materials, considering driver's preferred types or admin overrides
  const materialTypesToSearch = driver.adminOverride && driver.adminOverrideMaterialType
    ? driver.adminOverrideMaterialType
    : driver.preferredMaterialType.length 
      ? driver.preferredMaterialType 
      : allowedTypes;

  // ✅ Exclude archived materials - they should be treated as deleted
  const availableMaterials = await Material.find({
    vehicleType: driver.vehicleType,
    materialType: { $in: materialTypesToSearch },
    driverId: null,
    isArchived: { $ne: true } // Exclude archived materials
  }).sort({ createdAt: 1 }); // Get oldest material first

  if (!availableMaterials.length) {
    throw new Error('No available materials matching the criteria');
  }

  const materialToAssign = availableMaterials[0];
  
  // Use a transaction to ensure both operations succeed or fail together
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Assign material to driver
    materialToAssign.driverId = driver.driverId;
    materialToAssign.assignedDate = new Date(); // ✅ Set assignedDate when material is assigned
    materialToAssign.mountedAt = null; // Will be set by admin when actually mounted
    await materialToAssign.save({ session });

    // Update driver's material reference
    driver.materialId = materialToAssign._id;
    driver.installedMaterialType = null; // Will be set when material is actually mounted
    await driver.save({ session });

    await session.commitTransaction();
    session.endSession();

    return materialToAssign;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
}

// ===== RESOLVERS =====
const resolvers = {
Upload: GraphQLUpload,

  Query: {
    checkDriverVerificationStatus: async (_, { driverId }) => {
      try {
        console.log('Checking verification status for driverId:', driverId);
        const driver = await Driver.findOne({ driverId });

        if (!driver) {
          console.log('Driver not found with driverId:', driverId);
          return { 
            status: 'not_found',
            isEmailVerified: false,
            message: 'Driver not found'
          };
        }

        console.log('Found driver with status:', driver.accountStatus);
        return {
          status: driver.accountStatus?.toLowerCase() || 'pending',
          isEmailVerified: driver.isEmailVerified || false,
          message: 'Status retrieved successfully'
        };
      } catch (error) {
        console.error('Error checking driver verification status:', error);
        throw new Error('Failed to check verification status');
      }
    },
    
    getDriverByVerificationCode: async (_, { email, verificationCode }) => {
      try {
        const normalizedEmail = email.toLowerCase().trim();
        const driver = await Driver.findOne({ 
          email: normalizedEmail,
          emailVerificationCode: verificationCode
        });

        if (!driver) {
          throw new Error('Driver not found with the provided credentials');
        }

        return driver;
      } catch (error) {
        console.error('Error getting driver by verification code:', error);
        throw new Error('Failed to retrieve driver information');
      }
    },
    getAllDrivers: async (_, { includeArchived = false }, { user }) => {
      checkAdmin(user);
      // ✅ Exclude archived by default - only include if explicitly requested
      const query = {};
      if (!includeArchived) {
        query.isArchived = { $ne: true };
      }
      return Driver.find(query)
        .select('+createdAt +updatedAt +lastLogin +dateJoined +approvalDate')
        .populate({
          path: 'material',
          model: 'Material',
          select: 'materialId materialType category description mountedAt dismountedAt'
        });
    },

    getDriverById: async (_, { driverId }, { user }) => {
      checkAdmin(user);
      const driver = await Driver.findOne({ driverId });
      if (!driver) throw new Error('Driver not found');
      // ✅ Check if driver is archived - treat as deleted
      if (driver.isArchived) {
        throw new Error('This driver has been archived and is no longer accessible');
      }
      return driver;
    },

    // Get driver profile (accessible by driver themselves or admin)
    getDriver: async (_, { driverId }, { user, driver }) => {
      try {
        // Check if user is admin or if driver is requesting their own profile
        if (!user && !driver) {
          throw new Error('Unauthorized access');
        }

        // If driver is authenticated, always use the driver's own ID from context
        // to avoid mismatches or spoofed IDs from the client
        const effectiveDriverId = driver ? driver.driverId : driverId;
        
        // If a driver is authenticated but the requested ID doesn't match, log it and continue with effectiveDriverId
        if (driver && driver.driverId !== driverId) {
          console.warn('getDriver: driverId mismatch; using context driverId instead', {
            requested: driverId,
            contextDriverId: driver.driverId,
          });
        }

        // Find driver by driverId (not _id)
        const driverProfile = await Driver.findOne({ driverId: effectiveDriverId }).select('-password');
        
        if (!driverProfile) {
          throw new Error('Driver not found');
        }

        // ✅ Check if driver is archived - treat as deleted
        if (driverProfile.isArchived) {
          throw new Error('This account has been archived and is no longer accessible');
        }

        console.log(`✅ Found driver profile for ${effectiveDriverId}`);
        
        return {
          success: true,
          message: 'Driver profile retrieved successfully',
          driver: driverProfile
        };

      } catch (error) {
        console.error('Error fetching driver profile:', error);
        return {
          success: false,
          message: error.message,
          driver: null
        };
      }
    },

    getPendingDrivers: async (_, __, { user }) => {
      checkAdmin(user);
      return Driver.find({ accountStatus: "PENDING", reviewStatus: "PENDING" });
    },

    getDriversWithPendingEdits: async (_, __, { user }) => {
      checkAdmin(user);
      return Driver.find({ editRequestStatus: "PENDING" });
    },
    
    getDriverWithMaterial: async (_, { driverId }, { user, driver }) => {
      // Allow admins to query any driver, or drivers to query their own details
      if (user?.role !== 'ADMIN' && driver?.driverId !== driverId) {
        throw new Error('Not authorized');
      }
      
      const driverData = await Driver.findOne({ driverId })
        .populate({
          path: 'material',
          model: 'Material',
          select: 'materialId materialType category mountedAt dismountedAt'
        });
        
      if (!driverData) {
        throw new Error('Driver not found');
      }
      
      return driverData;
    },
  },

  Mutation: {
    // ===== DRIVER SELF MUTATIONS =====
createDriver: async (_, { input }) => {
  try {
    // Validate email
    if (!validator.isEmail(input.email)) throw new Error("Invalid email format");
    const normalizedEmail = input.email.toLowerCase().trim();

    // Check if email exists
    const existing = await Driver.findOne({ email: normalizedEmail });
    if (existing) throw new Error("Driver with this email already exists");

    // Validate required fields with name regex
    const nameRegex = /^[A-Za-z\s.'-]+$/;
    
    if (!input.firstName || !input.firstName.trim()) {
      throw new Error("First name is required");
    }
    if (!nameRegex.test(input.firstName.trim())) {
      throw new Error("First name cannot contain numbers or symbols");
    }
    
    if (!input.lastName || !input.lastName.trim()) {
      throw new Error("Last name is required");
    }
    if (!nameRegex.test(input.lastName.trim())) {
      throw new Error("Last name cannot contain numbers or symbols");
    }
    
    if (!input.address || !input.address.trim()) {
      throw new Error("Address is required");
    }

    // Enhanced password validation
    if (!input.password || !input.password.trim()) {
      throw new Error("Password cannot be empty");
    }
    if (!isValidPassword(input.password.trim())) {
      throw new Error("Password must be at least 8 characters long and include uppercase, lowercase, number, and special character");
    }

    // Validate contact number (accepted: 09123456789, +639123456789, 639123456789, or 9123456789)
    if (!input.contactNumber || !input.contactNumber.trim()) {
      throw new Error("Contact number is required");
    }

    // Clean input
    let cleanNumber = input.contactNumber.replace(/[^\d+]/g, '');

    // Check accepted formats
    let isValidContact = false;
    if (/^09\d{9}$/.test(cleanNumber)) {
      isValidContact = true;
    } else if (/^\+639\d{9}$/.test(cleanNumber)) {
      isValidContact = true;
    } else if (/^639\d{9}$/.test(cleanNumber)) {
      isValidContact = true;
    } else if (/^9\d{9}$/.test(cleanNumber)) {
      isValidContact = true;
    }

    if (!isValidContact) {
      throw new Error('Invalid Philippine mobile number. Must be 11 digits starting with 09, or 10 digits starting with 9. Accepted: 09123456789, +639123456789, 639123456789, or 9123456789');
    }

    // Normalize to +63 format for storage
    let normalizedContact = cleanNumber;
    if (!normalizedContact.startsWith('+63')) {
      normalizedContact = normalizedContact.startsWith('0')
        ? '+63' + normalizedContact.substring(1)
        : '+63' + normalizedContact;
    }

    // Validate vehicle type
    if (!Object.keys(VEHICLE_MATERIAL_MAP).includes(input.vehicleType)) {
      throw new Error(`Invalid vehicle type. Allowed: ${Object.keys(VEHICLE_MATERIAL_MAP).join(', ')}`);
    }

    // Validate other required vehicle fields
    if (!input.vehicleModel || !input.vehicleModel.trim()) {
      throw new Error("Vehicle model is required");
    }
    if (!input.vehicleYear) {
      throw new Error("Vehicle year is required");
    }
    if (!input.vehiclePlateNumber || !input.vehiclePlateNumber.trim()) {
      throw new Error("Vehicle plate number is required");
    }
    if (!input.licenseNumber || !input.licenseNumber.trim()) {
      throw new Error("License number is required");
    }
    if (!input.preferredMaterialType || input.preferredMaterialType.length === 0) {
      throw new Error("At least one preferred material type is required");
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const driverId = await generateDriverId();
    const qrCodeIdentifier = `QR-${driverId}-${Date.now()}`;

    // Handle file uploads to Firebase Storage with proper folder structure
    // Support new split uploads while remaining backward compatible with legacy fields
    const [
      legacyLicenseUrl,
      vehiclePhotoUrl,
      legacyOrCrUrl,
      profilePictureUrl,
      licenseFrontUrl,
      licenseBackUrl,
      orUrl,
      crUrl,
    ] = await Promise.all([
      input.licensePicture ? uploadToFirebase(input.licensePicture, 'drivers', normalizedEmail, 'licenses') : null,
      input.vehiclePhoto ? uploadToFirebase(input.vehiclePhoto, 'drivers', normalizedEmail, 'vehicles') : null,
      input.orCrPicture ? uploadToFirebase(input.orCrPicture, 'drivers', normalizedEmail, 'documents') : null,
      input.profilePicture ? uploadToFirebase(input.profilePicture, 'drivers', normalizedEmail, 'profiles') : null,
      input.licenseFront ? uploadToFirebase(input.licenseFront, 'drivers', normalizedEmail, 'licenses/front') : null,
      input.licenseBack ? uploadToFirebase(input.licenseBack, 'drivers', normalizedEmail, 'licenses/back') : null,
      input.orPicture ? uploadToFirebase(input.orPicture, 'drivers', normalizedEmail, 'documents/or') : null,
      input.crPicture ? uploadToFirebase(input.crPicture, 'drivers', normalizedEmail, 'documents/cr') : null,
    ]);

    // Create driver (PENDING until approved)
    const newDriver = new Driver({
      driverId,
      qrCodeIdentifier,
      firstName: input.firstName.trim(),
      middleName: input.middleName?.trim() || null,
      lastName: input.lastName.trim(),
      contactNumber: input.contactNumber.trim(),
      email: normalizedEmail,
      password: input.password.trim(),
      address: input.address.trim(), // Now required
      licenseNumber: input.licenseNumber.trim(),
      // If new split fields provided, store them; otherwise keep legacy single URL
      licensePictureURL: legacyLicenseUrl?.url || null,
      licenseFrontURL: licenseFrontUrl?.url || null,
      licenseBackURL: licenseBackUrl?.url || null,
      vehiclePlateNumber: input.vehiclePlateNumber.trim(),
      vehicleType: input.vehicleType,
      vehicleModel: input.vehicleModel.trim(),
      vehicleYear: input.vehicleYear,
      vehiclePhotoURL: vehiclePhotoUrl?.url || null,
      orCrPictureURL: legacyOrCrUrl?.url || null,
      orPictureURL: orUrl?.url || null,
      crPictureURL: crUrl?.url || null,
      preferredMaterialType: Array.isArray(input.preferredMaterialType) ? input.preferredMaterialType : [],
      profilePicture: profilePictureUrl?.url || null,
      accountStatus: 'PENDING',
      reviewStatus: 'PENDING',
      isEmailVerified: false,
      dateJoined: new Date(),
      currentBalance: 0,
      totalEarnings: 0,
      emailVerificationCode: verificationCode,
      emailVerificationCodeExpires: new Date(Date.now() + 15 * 60 * 1000),
    });

    await EmailService.sendVerificationEmail(newDriver.email, verificationCode);
    console.log(`Verification code for ${newDriver.email}: ${verificationCode}`);

    await newDriver.save();

    // Send notification to admins about new driver application
    try {
      const NotificationService = require('../services/notifications/NotificationService');
      await NotificationService.sendNewDriverApplicationNotification(newDriver._id);
      console.log(`✅ Sent new driver application notification for driver: ${newDriver._id}`);
    } catch (notificationError) {
      console.error('❌ Error sending new driver application notification:', notificationError);
      // Don't fail the driver creation if notification fails
    }

    const token = jwt.sign(
      { driverId: newDriver._id.toString(), tokenVersion: newDriver.tokenVersion },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return { success: true, message: "Driver created successfully", token, driver: newDriver };
  } catch (error) {
    console.error("createDriver error:", error);
    return { success: false, message: error.message, token: null, driver: null };
  }
},

    loginDriver: async (_, { email, password, deviceInfo }) => {
      try {
        console.log(`Driver login attempt from: ${deviceInfo.deviceType} - ${deviceInfo.deviceName}`);

        const normalizedEmail = email.toLowerCase().trim();
        const driver = await Driver.findOne({ email: normalizedEmail }).select('+password');

        if (!driver) return { success: false, message: 'Driver not found', token: null, driver: null };

        // ✅ Check if driver is archived (scheduled for deletion)
        if (driver.isArchived) {
          return { 
            success: false, 
            message: 'This account has been deleted and is no longer accessible', 
            token: null, 
            driver: null 
          };
        }

        // Account lock check
        if (driver.accountLocked && driver.lockUntil && driver.lockUntil > new Date()) {
          return { success: false, message: 'Account temporarily locked. Try again later.', token: null, driver: null };
        } else if (driver.accountLocked && driver.lockUntil && driver.lockUntil <= new Date()) {
          driver.accountLocked = false;
          driver.loginAttempts = 0;
          driver.lockUntil = null;
          await driver.save();
        }

        // Return driver data even when email is not verified so mobile app can redirect to OTP page
        if (!driver.isEmailVerified) {
          // Generate a temporary token for email verification purposes
          const tempToken = jwt.sign(
            { driverId: driver.driverId, email: driver.email, isTemp: true },
            JWT_SECRET,
            { expiresIn: '1h' } // Short-lived token just for verification
          );
          
          return { 
            success: false, 
            message: 'Please verify your email before logging in', 
            token: tempToken, 
            driver: {
              id: driver._id.toString(),
              driverId: driver.driverId,
              firstName: driver.firstName,
              lastName: driver.lastName,
              email: driver.email,
              accountStatus: driver.accountStatus,
              isEmailVerified: driver.isEmailVerified
            },
            needsEmailVerification: true
          };
        }
        
        // Provide specific messages for different account statuses
        if (driver.accountStatus !== 'ACTIVE') {
          let statusMessage = '';
          switch (driver.accountStatus) {
            case 'PENDING':
              statusMessage = 'Your account is still under review. Please wait for approval.';
              break;
            case 'SUSPENDED':
              statusMessage = 'Your account has been suspended. Please contact support for assistance.';
              break;
            case 'REJECTED':
              statusMessage = 'Your account application was rejected. Please contact support for more information.';
              break;
            case 'RESUBMITTED':
              statusMessage = 'Your account is being reviewed after resubmission. Please wait for approval.';
              break;
            default:
              statusMessage = `Your account status is ${driver.accountStatus}. Please contact support for assistance.`;
          }
          return { success: false, message: statusMessage, token: null, driver: null };
        }

        const valid = await bcrypt.compare(password.trim(), driver.password);
        if (!valid) {
          driver.loginAttempts = (driver.loginAttempts || 0) + 1;
          const MAX_LOGIN_ATTEMPTS = 5;
          const LOCK_TIME = 1 * 60 * 60 * 1000;

          if (driver.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
            driver.accountLocked = true;
            driver.lockUntil = new Date(Date.now() + LOCK_TIME);
          }
          await driver.save();
          return { success: false, message: 'Incorrect password', token: null, driver: null };
        }

        driver.loginAttempts = 0;
        driver.accountLocked = false;
        driver.lockUntil = null;
        driver.lastLogin = new Date();
        await driver.save();

        const token = jwt.sign({
          driverId: driver.driverId, // Use the string driverId (DRV-002) instead of MongoDB _id
          email: driver.email,
          role: 'DRIVER',
          tokenVersion: driver.tokenVersion,
        }, JWT_SECRET, { expiresIn: '1d' });

        console.log('Login successful for driver:', driver.driverId);

        return { success: true, message: 'Login successful', token, driver };
      } catch (error) {
        console.error('loginDriver error:', error);
        return { success: false, message: 'Failed to login', token: null, driver: null };
      }
    },

    verifyDriverEmail: async (_, { code }) => {
      try {
        const driver = await Driver.findOne({ emailVerificationCode: code });
        if (!driver) return { success: false, message: "Invalid verification code", driver: null };
        if (driver.emailVerificationCodeExpires < new Date()) return { success: false, message: "Code expired", driver: null };

        driver.isEmailVerified = true;
        driver.emailVerificationCode = null;
        driver.emailVerificationCodeExpires = null;
        await driver.save();

        return { success: true, message: "Email verified successfully", driver };
      } catch (error) {
        console.error("verifyDriverEmail error:", error);
        return { success: false, message: "Failed to verify email", driver: null };
      }
    },

    resendDriverVerificationCode: async (_, { email }) => {
      try {
        const normalizedEmail = email.toLowerCase().trim();
        const driver = await Driver.findOne({ email: normalizedEmail });
        if (!driver) return { success: false, message: "Driver not found" };

        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        driver.emailVerificationCode = verificationCode;
        driver.emailVerificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);
        await driver.save();

        await EmailService.sendVerificationEmail(driver.email, verificationCode);
        console.log(`Verification code for ${driver.email}: ${verificationCode}`);

        return { success: true, message: "Verification code resent successfully" };
      } catch (error) {
        console.error("resendDriverVerificationCode error:", error);
        return { success: false, message: "Failed to resend verification code" };
      }
    },

    // ===== UPDATED PASSWORD RESET MUTATIONS =====
    requestDriverPasswordReset: async (_, { email }) => {
      try {
        const normalizedEmail = email.toLowerCase().trim();
        const driver = await Driver.findOne({ email: normalizedEmail });
        
        if (!driver) {
          return {
            success: false,
            message: "No driver found with this email"
          };
        }

        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Set reset code and expiration (15 minutes)
        driver.emailVerificationCode = resetCode;
        driver.emailVerificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000);
        
        await driver.save();
        
        // Send reset email
        await EmailService.sendVerificationEmail(driver.email, resetCode);
        console.log(`Password reset code for ${driver.email}: ${resetCode}`);

        return {
          success: true,
          message: "Password reset code sent to your email"
        };
      } catch (error) {
        console.error('requestDriverPasswordReset error:', error);
        return {
          success: false,
          message: error.message || 'Failed to send password reset code'
        };
      }
    },

    resetDriverPasswordWithCode: async (_, { token, newPassword }) => {
      try {
        // Find driver with valid reset token
        const driver = await Driver.findOne({
          emailVerificationCode: token.trim(),
          emailVerificationCodeExpires: { $gt: new Date() }
        });

        if (!driver) {
          return {
            success: false,
            message: "Invalid or expired reset token"
          };
        }

        // Log the verification code for debugging
        console.log(`Password reset verification code for ${driver.email}: ${token.trim()}`);

        // Enhanced password validation
        if (!newPassword || !isValidPassword(newPassword)) {
          return {
            success: false,
            message: "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character"
          };
        }

        // Update password (pre-save hook will hash it)
        driver.password = newPassword;
        driver.emailVerificationCode = null;
        driver.emailVerificationCodeExpires = null;
        
        // Reset any login attempts
        driver.loginAttempts = 0;
        driver.accountLocked = false;
        driver.lockUntil = null;

        await driver.save();

        return {
          success: true,
          message: "Password reset successfully"
        };
      } catch (error) {
        console.error('resetDriverPasswordWithCode error:', error);
        return {
          success: false,
          message: error.message || 'Failed to reset password'
        };
      }
    },

    approveDriver: async (_, { driverId, materialTypeOverride }, { user }) => {
  try {
    checkAdmin(user);

    const driver = await Driver.findOne({ driverId });
    if (!driver) {
      return { success: false, message: 'Driver not found', driver: null };
    }

    // If driver is already approved, no need to re-approve
    if (driver.accountStatus === 'ACTIVE' && driver.reviewStatus === 'APPROVED') {
      return { success: false, message: 'Driver is already approved', driver };
    }

    // Check if driver can be approved
    if (!driver.isEmailVerified) {
      return { 
        success: false, 
        message: 'Cannot approve driver. Email must be verified first.',
        driver 
      };
    }

    // Use override material types if provided, otherwise use driver's preferences
    const materialTypesToUse = materialTypeOverride?.length > 0 
      ? materialTypeOverride 
      : driver.preferredMaterialType;

    // Find an available material
    const availableMaterials = await Material.find({
      vehicleType: driver.vehicleType,
      materialType: { $in: materialTypesToUse },
      driverId: null
    }).sort({ createdAt: 1 });

    if (availableMaterials.length === 0) {
      return { 
        success: false, 
        message: `Cannot approve driver. No available ${materialTypesToUse.join('/')} materials for vehicle type ${driver.vehicleType}.`,
        driver 
      };
    }

    // Assign the first available material first to ensure it's available
    const materialToAssign = availableMaterials[0];

    // ✅ Validate salary pricing configuration before approving driver
    try {
      await DriverSalaryService.validatePricingConfiguration(
        driver.vehicleType,
        materialToAssign.category,
        materialToAssign.materialType
      );
      console.log(`✅ Salary pricing validated for driver ${driver.driverId}: ${materialToAssign.materialType} (${materialToAssign.category}) on ${driver.vehicleType}`);
    } catch (pricingError) {
      console.error(`❌ Salary pricing validation failed for driver ${driver.driverId}:`, pricingError.message);
      return { 
        success: false, 
        message: `Cannot approve driver. ${pricingError.message}. Please create a salary pricing configuration for ${materialToAssign.materialType} (${materialToAssign.category}) on ${driver.vehicleType} before approving this driver.`,
        driver 
      };
    }
    materialToAssign.driverId = driver.driverId;
    materialToAssign.assignedDate = new Date(); // ✅ Set assignedDate on FIRST assignment (driver approval)
    materialToAssign.mountedAt = null; // Will be set by admin when actually mounted
    materialToAssign.dismountedAt = null;
    await materialToAssign.save();

    // Generate QR code identifier for approved drivers
    if (!driver.qrCodeIdentifier) {
      driver.qrCodeIdentifier = `QR-${driver.driverId}-${Date.now()}`;
    }

    // Then update driver status to approved with the assigned material
    driver.accountStatus = 'ACTIVE';
    driver.reviewStatus = 'APPROVED';
    driver.approvalDate = new Date();
    driver.materialId = materialToAssign._id;
    driver.installedMaterialType = null; // Will be set when material is actually mounted

    if (materialTypeOverride?.length > 0) {
      driver.adminOverride = true;
      driver.adminOverrideMaterialType = materialTypeOverride;
    }

    await driver.save();

    const updatedDriver = await Driver.findOne({ driverId })
      .populate({ path: 'material', select: 'materialId materialType vehicleType' });

    console.log(`Driver ${driver.driverId} approved and material assigned.`);

    // Send driver approval notification
    try {
      const NotificationService = require('../services/notifications/NotificationService');
      await NotificationService.sendDriverStatusChangeNotification(driver._id, 'APPROVED');
      console.log('✅ Driver approval notification sent successfully');
    } catch (notificationError) {
      console.error('❌ Error sending driver approval notification:', notificationError);
      // Don't fail the approval if notification fails
    }

    // Send material assignment notification (both in-app and email)
    try {
      const DriverNotificationService = require('../services/notifications/DriverNotificationService');
      await DriverNotificationService.sendMaterialAssignmentNotification(
        driver._id, 
        materialToAssign._id, 
        materialToAssign.materialId
      );
      console.log('✅ Material assignment notification sent successfully');
    } catch (notificationError) {
      console.error('❌ Error sending material assignment notification:', notificationError);
      // Don't fail the approval if notification fails
    }

    // Send notification to Super Admin
    try {
      const NotificationService = require('../services/notifications/NotificationService');
      console.log('🔔 DriverResolver: Sending driver approval notification to Super Admin');
      await NotificationService.sendDriverApprovalBySuperAdmin(driver.driverId, user.id);
      console.log('✅ DriverResolver: Super Admin notification sent successfully');
    } catch (notificationError) {
      console.error('❌ DriverResolver: Error sending Super Admin notification:', notificationError);
      // Don't fail the approval if notification fails
    }

    return { 
      success: true, 
      message: 'Driver approved and material assigned successfully',
      driver: updatedDriver
    };
  } catch (error) {
    console.error('approveDriver error:', error);
    return { 
      success: false, 
      message: error.message || 'Failed to approve driver',
      driver: null
    };
  }
},

    // ===== FIXED REJECT DRIVER MUTATION =====
    rejectDriver: async (_, { driverId, reason }, { user }) => {
      try {
        checkAdmin(user);

        const driver = await Driver.findOne({ driverId });
        if (!driver) {
          return { 
            success: false, 
            message: 'Driver not found',
            driver: null
          };
        }

        // Update driver status to rejected
        driver.accountStatus = 'REJECTED';
        driver.reviewStatus = 'REJECTED';
        driver.rejectedReason = reason;
        
        // If driver had any materials assigned, unassign them
        if (driver.materialId) {
          await Material.updateMany(
            { driverId: driver.driverId },
            { $set: { driverId: null } }
          );
          driver.materialId = null;
          driver.installedMaterialType = null;
        }

        await driver.save();

        console.log(`Driver ${driver.driverId} rejected. Reason: ${reason}`);

        // Send driver rejection notification
        try {
          const NotificationService = require('../services/notifications/NotificationService');
          await NotificationService.sendDriverStatusChangeNotification(driver._id, 'REJECTED', reason);
          console.log('✅ Driver rejection notification sent successfully');
        } catch (notificationError) {
          console.error('❌ Error sending driver rejection notification:', notificationError);
          // Don't fail the rejection if notification fails
        }

        // Send notification to Super Admin
        try {
          const NotificationService = require('../services/notifications/NotificationService');
          console.log('🔔 DriverResolver: Sending driver rejection notification to Super Admin');
          await NotificationService.sendDriverRejectionBySuperAdmin(driver.driverId, user.id, reason);
          console.log('✅ DriverResolver: Super Admin notification sent successfully');
        } catch (notificationError) {
          console.error('❌ DriverResolver: Error sending Super Admin notification:', notificationError);
          // Don't fail the rejection if notification fails
        }

        return {
          success: true,
          message: 'Driver rejected successfully',
          driver
        };
      } catch (error) {
        console.error('rejectDriver error:', error);
        return {
          success: false,
          message: error.message || 'Failed to reject driver',
          driver: null
        };
      }
    },

    updateDriver: async (_, { driverId, input }, { user }) => {
      try {
        checkAdmin(user);
        const driver = await Driver.findOne({ driverId });
        if (!driver) {
          return { 
            success: false, 
            message: "Driver not found", 
            driver: null 
          };
        }

        // Track status changes for notifications
        const oldStatus = driver.accountStatus;
        const oldReviewStatus = driver.reviewStatus;

        Object.assign(driver, input);
        await driver.save();

        // Send notification if status changed
        if ((input.accountStatus && input.accountStatus !== oldStatus) || 
            (input.reviewStatus && input.reviewStatus !== oldReviewStatus)) {
          try {
            const NotificationService = require('../services/notifications/NotificationService');
            const newStatus = input.accountStatus || driver.accountStatus;
            const reason = input.rejectedReason || driver.rejectedReason;
            await NotificationService.sendDriverStatusChangeNotification(driver._id, newStatus, reason);
            console.log('✅ Driver status change notification sent successfully');
          } catch (notificationError) {
            console.error('❌ Error sending driver status change notification:', notificationError);
            // Don't fail the update if notification fails
          }
        }

        return { 
          success: true, 
          message: "Driver updated successfully", 
          driver 
        };
      } catch (error) {
        console.error('updateDriver error:', error);
        return {
          success: false,
          message: error.message || 'Failed to update driver',
          driver: null
        };
      }
    },

    resubmitDriver: async (_, { driverId, input }, { driver, user }) => {
      try {
        // Either the authenticated driver or an admin can trigger a resubmission
        if (!(user?.role === 'ADMIN' || driver?.driverId === driverId)) {
          throw new Error('Not authorized');
        }

        const existing = await Driver.findOne({ driverId });
        if (!existing) {
          return { success: false, message: 'Driver not found', driver: null };
        }

        const normalizedEmail = existing.email.toLowerCase().trim();

        // Upload new files if provided
        const [
          profileUrl,
          legacyLicenseUrl,
          licenseFrontUrl,
          licenseBackUrl,
          vehiclePhotoUrl,
          legacyOrCrUrl,
          orUrl,
          crUrl,
        ] = await Promise.all([
          input.profilePicture ? uploadToFirebase(input.profilePicture, 'drivers', normalizedEmail, 'profiles') : null,
          input.licensePicture ? uploadToFirebase(input.licensePicture, 'drivers', normalizedEmail, 'licenses') : null,
          input.licenseFront ? uploadToFirebase(input.licenseFront, 'drivers', normalizedEmail, 'licenses/front') : null,
          input.licenseBack ? uploadToFirebase(input.licenseBack, 'drivers', normalizedEmail, 'licenses/back') : null,
          input.vehiclePhoto ? uploadToFirebase(input.vehiclePhoto, 'drivers', normalizedEmail, 'vehicles') : null,
          input.orCrPicture ? uploadToFirebase(input.orCrPicture, 'drivers', normalizedEmail, 'documents') : null,
          input.orPicture ? uploadToFirebase(input.orPicture, 'drivers', normalizedEmail, 'documents/or') : null,
          input.crPicture ? uploadToFirebase(input.crPicture, 'drivers', normalizedEmail, 'documents/cr') : null,
        ]);

        // Update basic fields if provided
        existing.firstName = input.firstName?.trim() || existing.firstName;
        existing.middleName = input.middleName?.trim() || existing.middleName;
        existing.lastName = input.lastName?.trim() || existing.lastName;
        existing.contactNumber = input.contactNumber?.trim() || existing.contactNumber;
        existing.email = input.email ? input.email.toLowerCase().trim() : existing.email;
        existing.address = input.address?.trim() || existing.address;
        existing.licenseNumber = input.licenseNumber?.trim() || existing.licenseNumber;
        existing.vehiclePlateNumber = input.vehiclePlateNumber?.trim() || existing.vehiclePlateNumber;
        existing.vehicleType = input.vehicleType || existing.vehicleType;
        existing.vehicleModel = input.vehicleModel?.trim() || existing.vehicleModel;
        existing.vehicleYear = input.vehicleYear || existing.vehicleYear;
        existing.preferredMaterialType = Array.isArray(input.preferredMaterialType)
          ? input.preferredMaterialType
          : existing.preferredMaterialType;

        // Apply uploaded file URLs if present
        existing.profilePicture = profileUrl?.url ?? existing.profilePicture;
        existing.licensePictureURL = legacyLicenseUrl?.url ?? existing.licensePictureURL;
        existing.licenseFrontURL = licenseFrontUrl?.url ?? existing.licenseFrontURL;
        existing.licenseBackURL = licenseBackUrl?.url ?? existing.licenseBackURL;
        existing.vehiclePhotoURL = vehiclePhotoUrl?.url ?? existing.vehiclePhotoURL;
        existing.orCrPictureURL = legacyOrCrUrl?.url ?? existing.orCrPictureURL;
        existing.orPictureURL = orUrl?.url ?? existing.orPictureURL;
        existing.crPictureURL = crUrl?.url ?? existing.crPictureURL;

        // Mark as resubmitted for review
        existing.accountStatus = 'RESUBMITTED';
        existing.reviewStatus = 'RESUBMITTED';

        await existing.save();

        return { success: true, message: 'Driver resubmitted successfully', driver: existing };
      } catch (error) {
        console.error('resubmitDriver error:', error);
        return { success: false, message: error.message || 'Failed to resubmit driver', driver: null };
      }
    },

    deleteDriver: async (_, { driverId }, { user }) => {
      try {
        checkAdmin(user);
        const driver = await Driver.findOne({ driverId });
        if (!driver) {
          return { 
            success: false, 
            message: "Driver not found" 
          };
        }

        // Check if already archived
        if (driver.isArchived) {
          return {
            success: false,
            message: 'Driver is already archived'
          };
        }

        console.log(`🗑️ Archiving driver: ${driverId} (${driver.fullName}) - 30-day deferred deletion`);

        // ✅ Issue 4: Check for deployed ads and log warning
        const deployedAds = await AdsDeployment.find({ 
          driverId: driver.driverId,
          currentStatus: 'RUNNING'
        });
        
        if (deployedAds.length > 0) {
          console.warn(`⚠️ WARNING: Driver ${driverId} (${driver.fullName}) has ${deployedAds.length} currently deployed ad(s). Proceeding with deletion anyway.`);
          console.warn(`   Deployed ads will remain associated with archived driver until removed manually.`);
          deployedAds.forEach((deployment, index) => {
            console.warn(`   Deployment ${index + 1}: Material ${deployment.materialId}, Status: ${deployment.currentStatus}`);
          });
        }

        // ✅ ARCHIVE INSTEAD OF DELETE (30-day deferred deletion like Facebook)
        const now = new Date();
        const deletionDate = new Date(now);
        deletionDate.setDate(deletionDate.getDate() + 30); // 30 days from now

        driver.isArchived = true;
        driver.archivedAt = now;
        driver.scheduledDeletionDate = deletionDate;
        driver.tokenVersion += 1; // Invalidate all sessions
        
        await driver.save();

        // ✅ Issue 3: Unassign materials immediately when driver is deleted
        const materialsUnassigned = await Material.updateMany(
          { driverId: driver.driverId },
          { 
            $set: { 
              driverId: null,
              dismountedAt: now
            } 
          }
        );

        console.log(`✅ Driver ${driverId} archived successfully. Scheduled for permanent deletion on: ${deletionDate.toISOString()}`);
        console.log(`📦 Unassigned ${materialsUnassigned.modifiedCount} material(s) immediately (Issue 3 fixed)`);
        
        if (deployedAds.length > 0) {
          console.log(`⚠️ Note: ${deployedAds.length} deployed ad(s) still active - may need manual cleanup`);
        }

        return { 
          success: true, 
          message: "Driver archived successfully. Scheduled for deletion in 30 days." 
        };
      } catch (error) {
        console.error('deleteDriver error:', error);
        return {
          success: false,
          message: error.message || 'Failed to archive driver'
        };
      }
    },

    restoreDriver: async (_, { driverId }, { user }) => {
      try {
        checkAdmin(user);
        const driver = await Driver.findOne({ driverId });
        if (!driver) {
          return { 
            success: false, 
            message: "Driver not found" 
          };
        }

        if (!driver.isArchived) {
          return {
            success: false,
            message: 'Driver is not archived'
          };
        }

        console.log(`✅ Restoring driver: ${driverId} (${driver.fullName})`);

        driver.isArchived = false;
        driver.archivedAt = null;
        driver.scheduledDeletionDate = null;
        driver.tokenVersion += 1; // Invalidate all sessions
        
        await driver.save();

        console.log(`✅ Driver ${driverId} restored successfully`);

        return { 
          success: true, 
          message: "Driver restored successfully." 
        };
      } catch (error) {
        console.error('restoreDriver error:', error);
        return {
          success: false,
          message: error.message || 'Failed to restore driver'
        };
      }
    },

    unassignAndReassignMaterials: async (_, { driverId }, { user }) => {
      try {
        checkAdmin(user);
        const driver = await Driver.findOne({ driverId });
        if (!driver) throw new Error('Driver not found');

        let assignedMaterials = await Material.find({ driverId: driver.driverId });

        if (!assignedMaterials.length && driver.installedMaterialType) {
          assignedMaterials = [{ _id: null, materialType: driver.installedMaterialType, vehicleType: driver.vehicleType }];
        }

        if (!assignedMaterials.length) {
          return { success: false, message: 'No materials assigned', driver, reassignedMaterials: [] };
        }

        for (let mat of assignedMaterials) {
          if (mat._id) {
            mat.driverId = null;
            await mat.save();
          }
        }

        driver.installedMaterialType = null;
        await driver.save();

        const reassignedList = [];
        for (let mat of assignedMaterials) {
          const eligibleDriver = await Driver.findOne({
            vehicleType: mat.vehicleType,
            accountStatus: 'ACTIVE',
            driverId: { $ne: driver.driverId },
            $or: [
              { preferredMaterialType: mat.materialType },
              { adminOverrideMaterialType: mat.materialType }
            ]
          });

          if (eligibleDriver) {
            if (mat._id) {
              mat.driverId = eligibleDriver.driverId;
              await mat.save();
            }
            if (!eligibleDriver.installedMaterialType) {
              eligibleDriver.installedMaterialType = mat.materialType;
              await eligibleDriver.save();
            }
            reassignedList.push({ id: mat._id, materialType: mat.materialType, vehicleType: mat.vehicleType, newDriverId: eligibleDriver.driverId });
          } else {
            reassignedList.push({ id: mat._id, materialType: mat.materialType, vehicleType: mat.vehicleType, newDriverId: null });
          }
        }

        return { success: true, message: 'Materials unassigned and reassigned', driver, reassignedMaterials: reassignedList };
      } catch (error) {
        console.error('unassignAndReassignMaterials error:', error);
        return {
          success: false,
          message: error.message || 'Failed to unassign and reassign materials',
          driver: null,
          reassignedMaterials: []
        };
      }
    },

    approveDriverEditRequest: async (_, { id }, { user }) => {
      try {
        checkAdmin(user);

        const driver = await Driver.findOne({ driverId: id });
        if (!driver) return { success: false, message: "Driver not found" };
        if (driver.editRequestStatus !== "PENDING") return { success: false, message: "No pending edit request" };

        const editData = driver.editRequestData || {};

        // Only overwrite fields if they exist in the edit request
        driver.firstName = editData.firstName ?? driver.firstName;
        driver.middleName = editData.middleName ?? driver.middleName;
        driver.lastName = editData.lastName ?? driver.lastName;
        driver.contactNumber = editData.contactNumber ?? driver.contactNumber;
        driver.email = editData.email ?? driver.email;
        driver.address = editData.address ?? driver.address;
        driver.profilePicture = editData.profilePicture ?? driver.profilePicture;
        driver.licenseNumber = editData.licenseNumber ?? driver.licenseNumber;
        driver.licensePictureURL = editData.licensePictureURL ?? driver.licensePictureURL;
        driver.licenseFrontURL = editData.licenseFrontURL ?? driver.licenseFrontURL;
        driver.licenseBackURL = editData.licenseBackURL ?? driver.licenseBackURL;
        driver.vehiclePlateNumber = editData.vehiclePlateNumber ?? driver.vehiclePlateNumber;
        driver.vehicleType = editData.vehicleType ?? driver.vehicleType;
        driver.vehicleModel = editData.vehicleModel ?? driver.vehicleModel;
        driver.vehicleYear = editData.vehicleYear ?? driver.vehicleYear;
        driver.vehiclePhotoURL = editData.vehiclePhotoURL ?? driver.vehiclePhotoURL;
        driver.orCrPictureURL = editData.orCrPictureURL ?? driver.orCrPictureURL;
        driver.orPictureURL = editData.orPictureURL ?? driver.orPictureURL;
        driver.crPictureURL = editData.crPictureURL ?? driver.crPictureURL;
        driver.preferredMaterialType = editData.preferredMaterialType ?? driver.preferredMaterialType;

        driver.editRequestData = null;
        driver.editRequestStatus = "APPROVED";

        await driver.save();

        return { success: true, message: "Edit request approved", driver };
      } catch (error) {
        console.error('approveDriverEditRequest error:', error);
        return {
          success: false,
          message: error.message || 'Failed to approve edit request',
          driver: null
        };
      }
    },

    rejectDriverEditRequest: async (_, { id, reason }, { user }) => {
      try {
        checkAdmin(user);

        const driver = await Driver.findOne({ driverId: id });
        if (!driver) return { success: false, message: "Driver not found" };
        if (driver.editRequestStatus !== "PENDING") return { success: false, message: "No pending edit request" };

        driver.editRequestStatus = "REJECTED";
        driver.editRequestData = null;
        if (reason) driver.rejectedReason = reason;

        await driver.save();

        return { success: true, message: reason || "Edit request rejected", driver };
      } catch (error) {
        console.error('rejectDriverEditRequest error:', error);
        return {
          success: false,
          message: error.message || 'Failed to reject edit request',
          driver: null
        };
      }
    },

    requestDriverEdit: async (_, { input }, { driver }) => {
      try {
        checkDriverAuth(driver);

        const reason = input.reason?.trim();
        if (!reason) {
          return { success: false, message: "You must provide a reason for the edit request", driver: null };
        }

        if (driver.editRequestStatus === "PENDING") {
          return { success: false, message: "You already have a pending edit request", driver };
        }

        // Upload any provided files and store resulting URLs in editRequestData
        const normalizedEmail = driver.email.toLowerCase().trim();
        const [
          profileUrl,
          legacyLicenseUrl,
          licenseFrontUrl,
          licenseBackUrl,
          vehiclePhotoUrl,
          legacyOrCrUrl,
          orUrl,
          crUrl,
        ] = await Promise.all([
          input.profilePicture ? uploadToFirebase(input.profilePicture, 'drivers', normalizedEmail, 'profiles') : null,
          input.licensePicture ? uploadToFirebase(input.licensePicture, 'drivers', normalizedEmail, 'licenses') : null,
          input.licenseFront ? uploadToFirebase(input.licenseFront, 'drivers', normalizedEmail, 'licenses/front') : null,
          input.licenseBack ? uploadToFirebase(input.licenseBack, 'drivers', normalizedEmail, 'licenses/back') : null,
          input.vehiclePhoto ? uploadToFirebase(input.vehiclePhoto, 'drivers', normalizedEmail, 'vehicles') : null,
          input.orCrPicture ? uploadToFirebase(input.orCrPicture, 'drivers', normalizedEmail, 'documents') : null,
          input.orPicture ? uploadToFirebase(input.orPicture, 'drivers', normalizedEmail, 'documents/or') : null,
          input.crPicture ? uploadToFirebase(input.crPicture, 'drivers', normalizedEmail, 'documents/cr') : null,
        ]);

        const { reason: _ignored, profilePicture, licensePicture, licenseFront, licenseBack, vehiclePhoto, orCrPicture, orPicture, crPicture, ...fields } = input || {};

        driver.editRequestData = {
          ...fields,
          reason,
          profilePicture: profileUrl?.url || undefined,
          licensePictureURL: legacyLicenseUrl?.url || undefined,
          licenseFrontURL: licenseFrontUrl?.url || undefined,
          licenseBackURL: licenseBackUrl?.url || undefined,
          vehiclePhotoURL: vehiclePhotoUrl?.url || undefined,
          orCrPictureURL: legacyOrCrUrl?.url || undefined,
          orPictureURL: orUrl?.url || undefined,
          crPictureURL: crUrl?.url || undefined,
        };
        driver.editRequestStatus = "PENDING";

        await driver.save();

        return { success: true, message: "Edit request submitted", driver };
      } catch (error) {
        console.error("requestDriverEdit error:", error);
        return { success: false, message: "Failed to submit edit request", driver: null };
      }
    },

    // TEMPORARY: Reset password for development
    resetDriverPassword: async (_, { email, newPassword }) => {
      try {
        const driver = await Driver.findOne({ email: email.toLowerCase().trim() });
        if (!driver) {
          return { success: false, message: 'Driver not found', driver: null };
        }
        
        console.log('Original password:', newPassword);
        
        // Set the password directly - the pre-save hook will hash it
        driver.password = newPassword;
        await driver.save();
        
        // Verify the password using the model's comparePassword method
        const isMatch = await driver.comparePassword(newPassword);
        console.log('Password verification using model method:', isMatch);
        
        // Get the driver again to see the hashed password
        const updatedDriver = await Driver.findById(driver._id).select('+password');
        console.log('Hashed password in DB:', updatedDriver.password);
        
        return { 
          success: true, 
          message: 'Password reset successfully',
          driver: updatedDriver
        };
      } catch (error) {
        console.error('Error resetting password:', error);
        return { 
          success: false, 
          message: 'Failed to reset password', 
          error: error.message,
          driver: null
        };
      }
    },

    // ===== UPDATE DRIVER PUSH TOKEN =====
    updateDriverPushToken: async (_, { driverId, pushToken }, { user }) => {
      try {
        console.log(`Updating push token for driver ${driverId}`);
        
        const driver = await Driver.findOne({ driverId });
        if (!driver) {
          throw new Error('Driver not found');
        }

        driver.pushToken = pushToken;
        await driver.save();

        console.log(`✅ Push token updated for driver ${driverId}`);
        
        return { 
          success: true, 
          message: 'Push token updated successfully' 
        };
      } catch (error) {
        console.error('updateDriverPushToken error:', error);
        return { 
          success: false, 
          message: error.message || 'Failed to update push token'
        };
      }
    },
  },

  Driver: {
    fullName: (driver) => [driver.firstName, driver.middleName, driver.lastName].filter(Boolean).join(' '),
    profilePicture: (driver) => driver.profilePicture || null,
    material: async (driver) => {
      if (!driver.materialId) return null;
      try {
        return await Material.findById(driver.materialId);
      } catch (error) {
        console.error('Error fetching material:', error);
        return null;
      }
    },
    createdAt: (driver) => {
      if (!driver.createdAt) return null;
      return driver.createdAt.toISOString();
    },
    updatedAt: (driver) => {
      if (!driver.updatedAt) return null;
      return driver.updatedAt.toISOString();
    },
    lastLogin: (driver) => {
      if (!driver.lastLogin) return null;
      return driver.lastLogin.toISOString();
    },
    dateJoined: (driver) => {
      if (!driver.dateJoined) return null;
      return driver.dateJoined.toISOString();
    },
    approvalDate: (driver) => {
      if (!driver.approvalDate) return null;
      return driver.approvalDate.toISOString();
    },
    archivedAt: (driver) => {
      if (!driver.archivedAt) return null;
      return driver.archivedAt.toISOString();
    },
    scheduledDeletionDate: (driver) => {
      if (!driver.scheduledDeletionDate) return null;
      return driver.scheduledDeletionDate.toISOString();
    }
  },
};

module.exports = resolvers;