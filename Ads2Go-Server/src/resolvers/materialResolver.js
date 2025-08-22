const Material = require('../models/Material');
const Driver = require('../models/Driver');
const { checkAdmin } = require('../middleware/auth');

const allowedMaterialsByVehicle = {
  CAR: ['POSTER', 'LCD', 'STICKER', 'HEADDRESS', 'BANNER'],
  BUS: ['STICKER', 'HEADDRESS'],
  JEEP: ['POSTER', 'STICKER'],
  MOTOR: ['LCD', 'BANNER'],
  E_TRIKE: ['BANNER', 'LCD'],
};

const materialResolvers = {
  Query: {
  // Admin-only
  getAllMaterials: async (_, __, { user }) => {
    checkAdmin(user); // only admin can access
    return await Material.find().sort({ createdAt: -1 });
  },

  getMaterialsByVehicleType: async (_, { vehicleType }, { user }) => {
    checkAdmin(user); // admin-only
    return await Material.find({ vehicleType }).sort({ createdAt: -1 });
  },

  getMaterialsByCategory: async (_, { category }, { user }) => {
    checkAdmin(user); // admin-only
    if (!['DIGITAL', 'NON_DIGITAL'].includes(category)) {
      throw new Error('Invalid material category');
    }
    return await Material.find({ category }).sort({ createdAt: -1 });
  },

  // Accessible by User & Driver (login required)
  getMaterialsByCategoryAndVehicle: async (_, { category, vehicleType }, { user, driver }) => {
    if (!user && !driver) throw new Error("Unauthorized");

    if (driver) vehicleType = driver.vehicleType; // driver always sees their own vehicle type

    if (!['DIGITAL', 'NON_DIGITAL'].includes(category)) {
      throw new Error('Invalid material category');
    }

    return await Material.find({ category, vehicleType }).sort({ createdAt: -1 });
  },

  getMaterialById: async (_, { id }, { user }) => {
    checkAdmin(user); // admin-only
    const material = await Material.findById(id);
    if (!material) throw new Error('Material not found');
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
      return material;
    },

    updateMaterial: async (_, { id, input }, { user }) => {
      checkAdmin(user);

      // Only allow updating driverId to null (unlinking driver)
      const updateFields = {};
      if (input.driverId === null) {
        updateFields.driverId = null;
        updateFields.dismountedAt = new Date();
      } else if (input.driverId !== undefined) {
        throw new Error('Cannot assign driver through updateMaterial. Use assignMaterialToDriver mutation instead.');
      }

      const material = await Material.findById(id);
      if (!material) throw new Error('Material not found');

      // Only update the allowed fields
      Object.assign(material, updateFields);
      
      await material.save();
      return material;
    },

    deleteMaterial: async (_, { id }, { user }) => {
      checkAdmin(user);

      const deleted = await Material.findByIdAndDelete(id);
      if (!deleted) throw new Error('Material not found or already deleted');
      return 'Material deleted successfully.';
    },

    assignMaterialToDriver: async (_, { driverId }, { user }) => {
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
        return { 
          success: true, 
          message: 'Driver already has a material assigned',
          material: alreadyAssigned,
          driver: {
            driverId: driver.driverId,
            fullName: `${driver.firstName} ${driver.lastName}`,
            email: driver.email,
            contactNumber: driver.contactNumber,
            vehiclePlateNumber: driver.vehiclePlateNumber
          }
        };
      }

      // Find an unassigned material of allowed type
      // First try to find a material that matches the driver's preferred material type
      const preferredTypes = driver.preferredMaterialType?.length > 0 
        ? driver.preferredMaterialType 
        : allowedTypes;

      const availableMaterial = await Material.findOne({
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
        throw new Error(`No available ${preferredTypes.join('/')} materials for ${driver.vehicleType} to assign`);
      }

      // Assign driver
      availableMaterial.driverId = driver.driverId;
      availableMaterial.mountedAt = new Date();
      availableMaterial.dismountedAt = null; // Clear dismountedAt when reassigning
      await availableMaterial.save();

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
