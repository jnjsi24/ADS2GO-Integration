const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Driver = require('../models/Driver');
const Material = require('../models/Material');
const { JWT_SECRET, checkAdmin } = require('../middleware/auth');
const { checkDriverAuth } = require('../middleware/driverAuth');
const EmailService = require('../utils/emailService');
const validator = require('validator');
const { GraphQLUpload } = require('graphql-upload');

// ===== VEHICLE MATERIAL MAP =====
const VEHICLE_MATERIAL_MAP = {
  CAR: ['LCD', 'STICKER', 'HEADDRESS'],
  BUS: ['LCD', 'STICKER'],
  E_TRIKE: ['STICKER', 'HEADDRESS'],
  JEEP: ['STICKER'],
  MOTOR: ['LCD', 'BANNER']
};

const ALLOWED_VEHICLE_TYPES = Object.keys(VEHICLE_MATERIAL_MAP);

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
  const allowedTypes = VEHICLE_MATERIAL_MAP[driver.vehicleType];
  if (!allowedTypes) return;

  const availableMaterials = await Material.find({
    vehicleType: driver.vehicleType,
    materialType: { $in: allowedTypes },
    driverId: null,
  });

  if (!availableMaterials.length) return;

  const materialToAssign = availableMaterials[0];
  materialToAssign.driverId = driver.driverId; // admin-facing driverId
  await materialToAssign.save();

  if (!driver.installedMaterialType) {
    driver.installedMaterialType = materialToAssign.materialType;
    await driver.save();
  }
  return materialToAssign;
}

// ===== RESOLVERS =====
const resolvers = {
Upload: GraphQLUpload,

  Query: {
    getAllDrivers: async (_, __, { user }) => {
      checkAdmin(user);
      return Driver.find({})
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
      return driver;
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

        // Validate vehicle type
        if (!Object.keys(VEHICLE_MATERIAL_MAP).includes(input.vehicleType)) {
          throw new Error(`Invalid vehicle type. Allowed: ${Object.keys(VEHICLE_MATERIAL_MAP).join(', ')}`);
        }

        // Check for available materials
        const availableMaterials = await Material.find({
          vehicleType: input.vehicleType,
          materialType: { $in: Array.isArray(input.preferredMaterialType) ? input.preferredMaterialType : [] },
          driverId: null
        }).limit(1);

        if (availableMaterials.length === 0) {
          throw new Error('No available materials for the selected vehicle and material types. Please contact support.');
        }

        // Validate password
        if (!input.password || !input.password.trim()) throw new Error("Password cannot be empty");

        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const driverId = await generateDriverId();
        const qrCodeIdentifier = `QR-${driverId}-${Date.now()}`;

        // Handle file uploads
        const profilePictureURL = await saveFile(input.profilePicture);
        const vehiclePhotoURL = await saveFile(input.vehiclePhoto);
        const licensePictureURL = await saveFile(input.licensePicture);
        const orCrPictureURL = await saveFile(input.orCrPicture);

        // Create driver
        const newDriver = new Driver({
          driverId,
          qrCodeIdentifier,
          firstName: input.firstName.trim(),
          middleName: input.middleName?.trim() || null,
          lastName: input.lastName.trim(),
          contactNumber: input.contactNumber.trim(),
          email: normalizedEmail,
          password: input.password.trim(),
          address: input.address?.trim() || null,
          licenseNumber: input.licenseNumber?.trim() || null,
          licensePictureURL,
          vehiclePlateNumber: input.vehiclePlateNumber?.trim() || null,
          vehicleType: input.vehicleType,
          vehicleModel: input.vehicleModel?.trim() || null,
          vehicleYear: input.vehicleYear,
          vehiclePhotoURL,
          orCrPictureURL,
          preferredMaterialType: Array.isArray(input.preferredMaterialType) ? input.preferredMaterialType : [],
          profilePicture: profilePictureURL,
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
        console.log(`📩 Verification code for ${newDriver.email}: ${verificationCode}`);

        await newDriver.save();

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

        // Account lock check
        if (driver.accountLocked && driver.lockUntil && driver.lockUntil > new Date()) {
          return { success: false, message: 'Account temporarily locked. Try again later.', token: null, driver: null };
        } else if (driver.accountLocked && driver.lockUntil && driver.lockUntil <= new Date()) {
          driver.accountLocked = false;
          driver.loginAttempts = 0;
          driver.lockUntil = null;
          await driver.save();
        }

        if (!driver.isEmailVerified) return { success: false, message: 'Please verify your email before logging in', token: null, driver: null };
        if (driver.accountStatus !== 'ACTIVE') return { success: false, message: `Driver account is ${driver.accountStatus}`, token: null, driver: null };

        const valid = await bcrypt.compare(password.trim(), driver.password);
        if (!valid) {
          driver.loginAttempts = (driver.loginAttempts || 0) + 1;
          const MAX_LOGIN_ATTEMPTS = 5;
          const LOCK_TIME = 2 * 60 * 60 * 1000;

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
          driverId: driver._id.toString(),
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
        console.log(`📩 Verification code for ${driver.email}: ${verificationCode}`);

        return { success: true, message: "Verification code resent successfully" };
      } catch (error) {
        console.error("resendDriverVerificationCode error:", error);
        return { success: false, message: "Failed to resend verification code" };
      }
    },

    // ===== ADMIN MUTATIONS =====
    approveDriver: async (_, { driverId, materialTypeOverride }, { user }) => {
      try {
        checkAdmin(user);

        const driver = await Driver.findOne({ driverId });
        if (!driver) {
          return { success: false, message: 'Driver not found', driver: null };
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

        // Check if there are available materials for the selected types
        const availableMaterials = await Material.find({
          vehicleType: driver.vehicleType,
          materialType: { $in: materialTypesToUse },
          driverId: null
        }).sort({ createdAt: 1 });

        if (availableMaterials.length === 0) {
          // If no materials available, check if driver already has a material assigned
          if (driver.materialId) {
            // Driver already has a material, proceed with approval
            driver.accountStatus = 'ACTIVE';
            driver.reviewStatus = 'APPROVED';
            driver.approvalDate = new Date();
            await driver.save();
            
            const updatedDriver = await Driver.findOne({ driverId })
              .populate({
                path: 'material',
                select: 'materialId materialType vehicleType'
              });
            
            return { 
              success: true, 
              message: 'Driver approved with existing material assignment',
              driver: updatedDriver
            };
          }
          
          return { 
            success: false, 
            message: 'Cannot approve driver. No available materials for the selected vehicle and material types.',
            driver 
          };
        }

        // Update driver status
        driver.accountStatus = 'ACTIVE';
        driver.reviewStatus = 'APPROVED';
        driver.approvalDate = new Date();
        
        // Assign the first available material
        const materialToAssign = availableMaterials[0];
        
        // Only assign the driver ID to the material, don't set mountedAt yet
        materialToAssign.driverId = driver.driverId;
        materialToAssign.mountedAt = null; // Will be set when material is actually mounted
        materialToAssign.dismountedAt = null;
        await materialToAssign.save();

        // Update driver's material reference but don't set installedMaterialType yet
        driver.materialId = materialToAssign._id;
        driver.installedMaterialType = null; // Will be set when material is actually mounted
        
        // Handle admin override if needed
        if (materialTypeOverride?.length > 0) {
          driver.adminOverride = true;
          driver.adminOverrideMaterialType = materialTypeOverride;
        }
        
        await driver.save();
        
        // Get the updated driver with material details
        const updatedDriver = await Driver.findOne({ driverId })
          .populate({
            path: 'material',
            select: 'materialId materialType vehicleType'
          });
        
        console.log(`Successfully approved driver ${driver.driverId} and assigned material ${materialToAssign.materialId}`);
        
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

        Object.assign(driver, input);
        await driver.save();

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

        // Unassign any materials first
        await Material.updateMany(
          { driverId: driver.driverId }, 
          { $set: { driverId: null } }
        );
        
        await driver.deleteOne();

        return { 
          success: true, 
          message: "Driver deleted successfully" 
        };
      } catch (error) {
        console.error('deleteDriver error:', error);
        return {
          success: false,
          message: error.message || 'Failed to delete driver'
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
        driver.vehiclePlateNumber = editData.vehiclePlateNumber ?? driver.vehiclePlateNumber;
        driver.vehicleType = editData.vehicleType ?? driver.vehicleType;
        driver.vehicleModel = editData.vehicleModel ?? driver.vehicleModel;
        driver.vehicleYear = editData.vehicleYear ?? driver.vehicleYear;
        driver.vehiclePhotoURL = editData.vehiclePhotoURL ?? driver.vehiclePhotoURL;
        driver.orCrPictureURL = editData.orCrPictureURL ?? driver.orCrPictureURL;
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

        // Store all edit data including reason
        const { reason: _, ...editData } = input;
        driver.editRequestData = { ...editData, reason }; // include reason in editRequestData
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
    }
  },
};

module.exports = resolvers;