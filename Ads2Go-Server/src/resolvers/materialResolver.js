const Material = require('../models/Material');
const Driver = require('../models/Driver');
const Tablet = require('../models/Tablet');
const { checkAdmin } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const allowedMaterialsByVehicle = {
  CAR: ['POSTER', 'LCD', 'STICKER', 'HEADDRESS', 'BANNER'],
  BUS: ['STICKER', 'HEADDRESS'],
  JEEP: ['POSTER', 'STICKER'],
  MOTOR: ['LCD', 'BANNER'],
  E_TRIKE: ['BANNER', 'LCD'],
};

const materialResolvers = {
  Query: {
    getAllMaterials: async (_, __, { user, driver }) => {
      if (!user && !driver) throw new Error("Unauthorized");

      // If driver is logged in → only return materials for their vehicle type
      if (driver) {
        return await Material.find({ vehicleType: driver.vehicleType }).sort({ createdAt: -1 });
      }

      // Admin/User can see all
      return await Material.find().sort({ createdAt: -1 });
    },

    getMaterialsByVehicleType: async (_, { vehicleType }, { user, driver }) => {
      if (!user && !driver) throw new Error("Unauthorized");

      // If driver, override the requested vehicleType with their own
      if (driver) {
        return await Material.find({ vehicleType: driver.vehicleType }).sort({ createdAt: -1 });
      }

      return await Material.find({ vehicleType }).sort({ createdAt: -1 });
    },

    getMaterialsByCategory: async (_, { category }, { user, driver }) => {
      if (!user && !driver) throw new Error("Unauthorized");

      if (!['DIGITAL', 'NON_DIGITAL'].includes(category)) {
        throw new Error('Invalid material category');
      }

      // If driver, restrict to both category and their vehicleType
      if (driver) {
        return await Material.find({
          category,
          vehicleType: driver.vehicleType,
        }).sort({ createdAt: -1 });
      }

      return await Material.find({ category }).sort({ createdAt: -1 });
    },

    getMaterialById: async (_, { id }, { user, driver }) => {
      if (!user && !driver) throw new Error("Unauthorized");

      const material = await Material.findById(id);
      if (!material) throw new Error('Material not found');

      // If driver, ensure the material matches their vehicleType
      if (driver && material.vehicleType !== driver.vehicleType) {
        throw new Error("You are not authorized to view this material");
      }

      return material;
    },
  },

  Mutation: {
    createMaterial: async (_, { input }, { user }) => {
      checkAdmin(user);

      const { vehicleType, materialType } = input;
      const allowed = allowedMaterialsByVehicle[vehicleType];
      if (!allowed.includes(materialType)) {
        throw new Error(
          `${materialType} is not allowed for vehicle type ${vehicleType}`
        );
      }

      const material = new Material({
        ...input,
        driverId: null, // unassigned on creation
      });

      await material.save();

      // Create tablet pair if the material type is HEADDRESS
      if (materialType === 'HEADDRESS') {
        const carGroupId = `GRP-${uuidv4().substring(0, 8).toUpperCase()}`;
        
        // Create a single document with both tablets
        const tabletPair = new Tablet({
          materialId: material._id,
          carGroupId,
          tablets: [
            {
              tabletNumber: 1,
              status: 'OFFLINE',
              gps: { lat: null, lng: null },
              lastSeen: null
            },
            {
              tabletNumber: 2,
              status: 'OFFLINE',
              gps: { lat: null, lng: null },
              lastSeen: null
            }
          ]
        });
        
        await tabletPair.save();
      }

      return material;
    },

    updateMaterial: async (_, { id, input }, { user }) => {
      checkAdmin(user);

      const material = await Material.findById(id);
      if (!material) throw new Error('Material not found');

      // Handle material dismounting (when driverId is set to null)
      if (input.driverId === null && material.driverId) {
        // Find and update the driver to clear the material reference
        const driver = await Driver.findOne({ driverId: material.driverId });
        if (driver) {
          driver.materialId = null;
          driver.installedMaterialType = null;
          await driver.save();
        }
        
        // Update material fields
        material.driverId = null;
        material.dismountedAt = new Date();
      } else if (input.driverId !== undefined) {
        throw new Error('Cannot assign driver through updateMaterial. Use assignMaterialToDriver mutation instead.');
      }
      
      await material.save();
      return material;
    },

    deleteMaterial: async (_, { id }, { user }) => {
      checkAdmin(user);

      const deleted = await Material.findByIdAndDelete(id);
      if (!deleted) throw new Error('Material not found or already deleted');
      return 'Material deleted successfully.';
    },

    assignMaterialToDriver: async (_, { driverId, materialId }, { user }) => {
      checkAdmin(user);

      // Find the driver
      const driver = await Driver.findOne({ driverId });
      if (!driver) throw new Error('Driver not found');

      const allowedTypes = allowedMaterialsByVehicle[driver.vehicleType] || [];
      if (allowedTypes.length === 0) {
        throw new Error(`No allowed materials for vehicle type ${driver.vehicleType}`);
      }

      // Check if this driver already has a material assigned
      const alreadyAssigned = await Material.findOne({ 
        driverId: driver.driverId,
        dismountedAt: { $exists: false } // Only consider active assignments
      });
      
      if (alreadyAssigned) {
        // If the material is already assigned to this driver, just return the current assignment
        if (materialId && alreadyAssigned._id.toString() === materialId) {
          return { 
            success: true, 
            message: 'Material already assigned to this driver',
            material: alreadyAssigned,
            driver: {
              driverId: driver.driverId,
              fullName: `${driver.firstName} ${driver.lastName}`,
              email: driver.email,
              contactNumber: driver.contactNumber,
              vehiclePlateNumber: driver.vehiclePlateNumber,
              installedMaterialType: driver.installedMaterialType
            }
          };
        }
        throw new Error('Driver already has a material assigned');
      }

      let availableMaterial;
      
      // If materialId is provided, try to assign that specific material
      if (materialId) {
        availableMaterial = await Material.findOne({
          _id: materialId,
          vehicleType: driver.vehicleType,
          materialType: { $in: allowedTypes },
          $or: [
            { driverId: null },
            { driverId: { $exists: false } },
            { 
              driverId: driver.driverId,
              dismountedAt: { $ne: null }
            }
          ]
        });
        
        if (!availableMaterial) {
          throw new Error('Specified material is not available for assignment or does not match vehicle type');
        }
      } else {
        // Find an unassigned material of allowed type
        // First try to find a material that matches the driver's preferred material type
        const preferredTypes = driver.preferredMaterialType?.length > 0 
          ? driver.preferredMaterialType 
          : allowedTypes;

        availableMaterial = await Material.findOne({
          vehicleType: driver.vehicleType,
          materialType: { $in: preferredTypes },
          $or: [
            { driverId: null },
            { driverId: { $exists: false } },
            { 
              driverId: driver.driverId, 
              dismountedAt: { $ne: null } // Allow reassigning previously used materials
            }
        ]
      }).sort({ dismountedAt: 1 }); // Prefer materials that were dismounted most recently

        if (!availableMaterial) {
          throw new Error('No available materials of the required type');
        }
      }

      // Check if the material is already assigned to another driver
      if (availableMaterial.driverId && availableMaterial.driverId !== driver.driverId) {
        // Unassign from the previous driver
        const previousDriver = await Driver.findOne({ driverId: availableMaterial.driverId });
        if (previousDriver) {
          previousDriver.materialId = null;
          previousDriver.installedMaterialType = null;
          await previousDriver.save();
        }
      }

      // Update the material with the new assignment
      availableMaterial.driverId = driver.driverId;
      availableMaterial.mountedAt = new Date();
      availableMaterial.dismountedAt = null; // Reset dismountedAt if it was set before
      
      // Update the driver with the material info
      driver.materialId = availableMaterial._id;
      driver.installedMaterialType = availableMaterial.materialType;
      
      await Promise.all([
        availableMaterial.save(),
        driver.save()
      ]);

      return {
        success: true,
        message: 'Material assigned successfully',
        material: availableMaterial,
        driver: {
          driverId: driver.driverId,
          fullName: `${driver.firstName} ${driver.lastName}`,
          email: driver.email,
          contactNumber: driver.contactNumber,
          vehiclePlateNumber: driver.vehiclePlateNumber
        }
      };
    },
  },


  Material: {
    id: (parent) => parent._id.toString(),
    materialId: (parent) => parent.materialId,
    driverId: (parent) => parent.driverId,
  },
};

module.exports = materialResolvers;
