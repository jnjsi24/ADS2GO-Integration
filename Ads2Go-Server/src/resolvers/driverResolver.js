
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

    getDriversWithPendingEdits: async (_, __, { user }) => {
      checkAdmin(user);
      return await Driver.find({ editRequestStatus: "PENDING" });
    },
  },

  Mutation: {
    createDriver: async (_, { input }) => {
      try {
        if (!validator.isEmail(input.email)) {
          return { success: false, message: "Invalid email format", token: null, driver: null };
        }

        const existingDriver = await Driver.findOne({ email: input.email.toLowerCase() });
        if (existingDriver) {
          return { success: false, message: "Email is already registered", token: null, driver: null };
        }

        if (!ALLOWED_VEHICLE_TYPES.includes(input.vehicleType)) {
          return { success: false, message: `Invalid vehicle type. Allowed types: ${ALLOWED_VEHICLE_TYPES.join(', ')}`, token: null, driver: null };
        }

        const driverId = await generateDriverId();
        const hashedPassword = await bcrypt.hash(input.password, 10);

        const newDriver = new Driver({
          driverId,
          firstName: input.firstName,
          lastName: input.lastName,
          contactNumber: input.contactNumber,
          email: input.email.toLowerCase(),
          password: hashedPassword,
          address: input.address,
          licenseNumber: input.licenseNumber,
          licensePictureURL: input.licensePictureURL,
          vehiclePlateNumber: input.vehiclePlateNumber,
          vehicleType: input.vehicleType,
          vehicleModel: input.vehicleModel,
          vehicleYear: input.vehicleYear,
          vehiclePhotoURL: input.vehiclePhotoURL,
          orCrPictureURL: input.orCrPictureURL,
          preferredMaterialType: input.preferredMaterialType,
          accountStatus: 'PENDING',
          qrCodeIdentifier: `QR-${driverId}`,
          isEmailVerified: false,
          dateJoined: new Date(),
          currentBalance: 0,
          totalEarnings: 0,
        });

        await newDriver.save();
        await assignMaterialToDriver(newDriver);

        return { success: true, message: "Driver created successfully", token: null, driver: newDriver };
      } catch (error) {
        console.error("createDriver error:", error);
        return { success: false, message: error.message || "Failed to create driver", token: null, driver: null };
      }
    },

    approveDriver: async (_, { driverId }, { user }) => {
      checkAdmin(user);
      try {
        const driver = await Driver.findOne({ driverId });
        if (!driver) return { success: false, message: "Driver not found", driver: null };

        driver.accountStatus = "ACTIVE";
        driver.reviewStatus = "APPROVED";
        driver.approvalDate = new Date();
        driver.adminOverride = false;
        driver.adminOverrideMaterialType = null;
        await driver.save();

        return { success: true, message: "Driver approved successfully", driver };
      } catch (error) {
        console.error("approveDriver error:", error);
        return { success: false, message: "Failed to approve driver", driver: null };
      }
    },

    updateDriver: async (_, { driverId, input }, { user }) => {
      checkAdmin(user);
      try {
        const driver = await Driver.findOne({ driverId });
        if (!driver) return { success: false, message: "Driver not found", token: null, driver: null };

        Object.keys(input).forEach(key => {
          if (input[key] !== undefined) driver[key] = input[key];
        });

        await driver.save();
        return { success: true, message: "Driver updated successfully", token: null, driver };
      } catch (error) {
        console.error("updateDriver error:", error);
        return { success: false, message: error.message || "Failed to update driver", token: null, driver: null };
      }
    },

    deleteDriver: async (_, { driverId }, { user }) => {
      checkAdmin(user);
      try {
        const driver = await Driver.findOne({ driverId });
        if (!driver) return { success: false, message: "Driver not found" };

        await Material.updateMany({ driverId: driver._id }, { $set: { driverId: null } });
        await driver.deleteOne();

        return { success: true, message: "Driver deleted successfully" };
      } catch (error) {
        console.error("deleteDriver error:", error);
        return { success: false, message: "Failed to delete driver" };
      }
    },

    loginDriver: async (_, { email, password }) => {
      try {
        const driver = await Driver.findOne({ email: email.toLowerCase() });
        if (!driver) return { success: false, message: "Driver not found", token: null, driver: null };
        if (driver.accountStatus !== 'ACTIVE') return { success: false, message: `Account is ${driver.accountStatus}.`, token: null, driver: null };
        if (!driver.isEmailVerified) return { success: false, message: "Email is not verified.", token: null, driver: null };

        const validPassword = await bcrypt.compare(password, driver.password);
        if (!validPassword) return { success: false, message: "Incorrect password.", token: null, driver: null };

        const token = jwt.sign({ id: driver._id, email: driver.email, role: 'DRIVER' }, JWT_SECRET, { expiresIn: '7d' });
        return { success: true, message: "Login successful", token, driver };
      } catch (error) {
        console.error("loginDriver error:", error);
        return { success: false, message: "Failed to login", token: null, driver: null };
      }
    },

    resendDriverVerificationCode: async (_, { email }) => {
      try {
        const driver = await Driver.findOne({ email: email.toLowerCase() });
        if (!driver) return { success: false, message: "Driver with this email does not exist" };

        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        driver.emailVerificationCode = verificationCode;
        driver.emailVerificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);
        await driver.save();
        await EmailService.sendVerificationEmail(driver.email, verificationCode);

        return { success: true, message: "Verification code resent successfully" };
      } catch (error) {
        console.error("resendDriverVerificationCode error:", error);
        return { success: false, message: "Failed to resend verification code" };
      }
    },

    verifyDriverEmail: async (_, { code }) => {
      try {
        const driver = await Driver.findOne({ emailVerificationCode: code });
        if (!driver) return { success: false, message: "Invalid verification code.", driver: null };
        if (driver.emailVerificationCodeExpires < new Date()) return { success: false, message: "Verification code has expired.", driver: null };

        driver.isEmailVerified = true;
        driver.accountStatus = 'ACTIVE';
        driver.emailVerificationCode = null;
        driver.emailVerificationCodeExpires = null;
        await driver.save();

        return { success: true, message: "Email verified successfully.", driver };
      } catch (error) {
        console.error("verifyDriverEmail error:", error);
        return { success: false, message: "Failed to verify email.", driver: null };
      }
    },

    // UPDATED unassignAndReassignMaterials mutation
    unassignAndReassignMaterials: async (_, { driverId }, { user }) => {
      checkAdmin(user);
      const driver = await Driver.findOne({ driverId });
      if (!driver) throw new Error('Driver not found');

      let assignedMaterials = await Material.find({ driverId: driver._id });

      // Handle case where installedMaterialType exists but no Material documents found
      if (!assignedMaterials.length && driver.installedMaterialType) {
        assignedMaterials = [{
          _id: null,
          materialType: driver.installedMaterialType,
          vehicleType: driver.vehicleType,
        }];
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
          _id: { $ne: driver._id },
          $or: [
            { preferredMaterialType: mat.materialType },
            { adminOverrideMaterialType: mat.materialType }
          ]
        });

        if (eligibleDriver) {
          if (mat._id) {
            mat.driverId = eligibleDriver._id;
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
    },

    approveDriverEditRequest: async (_, { id }, { user }) => {
      checkAdmin(user);
      const driver = await Driver.findOne({ driverId: id });
      if (!driver) return { success: false, message: "Driver not found" };
      if (driver.editRequestStatus !== "PENDING") return { success: false, message: "No pending edit request" };

      if (driver.editRequestData) {
        Object.assign(driver, driver.editRequestData);
      }

      driver.editRequestData = null;
      driver.editRequestStatus = "APPROVED";
      await driver.save();

      return { success: true, message: "Edit request approved", driver };
    },

    rejectDriverEditRequest: async (_, { id, reason }, { user }) => {
      checkAdmin(user);
      const driver = await Driver.findOne({ driverId: id });
      if (!driver) return { success: false, message: "Driver not found" };
      if (driver.editRequestStatus !== "PENDING") return { success: false, message: "No pending edit request" };

      driver.editRequestStatus = "REJECTED";
      driver.editRequestData = null;
      if (reason) driver.rejectedReason = reason;
      await driver.save();

      return { success: true, message: reason || "Edit request rejected", driver };
    },

    requestDriverEdit: async (_, { input }, { user }) => {
      try {
        if (!user) throw new Error("Not authenticated");

        const driver = await Driver.findById(user.id);
        if (!driver) return { success: false, message: "Driver not found", driver: null };

        if (driver.editRequestStatus === "PENDING") {
          return { success: false, message: "You already have a pending edit request", driver };
        }

        driver.editRequestData = { ...input };
        driver.editRequestStatus = "PENDING";
        await driver.save();

        return { success: true, message: "Edit request submitted successfully", driver };
      } catch (error) {
        console.error("requestDriverEdit error:", error);
        return { success: false, message: "Failed to submit edit request", driver: null };
      }
    },
  },
};

module.exports = resolvers;


