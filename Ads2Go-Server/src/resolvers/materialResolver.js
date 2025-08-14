
const Material = require('../models/Material');
const Driver = require('../models/Driver');
const Tablet = require('../models/Tablet'); // new model for tablets
const { checkAdmin } = require('../middleware/auth');

const allowedMaterialsByVehicle = {
  CAR: ['POSTER', 'LCD', 'STICKER', 'HEADDRESS', 'BANNER'],
  BUS: ['STICKER', 'LCD_HEADDRESS'],
  JEEP: ['POSTER', 'STICKER'],
  MOTOR: ['LCD', 'BANNER'],
  E_TRIKE: ['BANNER', 'LCD'],
};

const materialResolvers = {
  Query: {
    getAllMaterials: async (_, __, context) => {
      checkAdmin(context.user);
      return await Material.find().sort({ createdAt: -1 });
    },

    getMaterialsByCategory: async (_, { category }) => {
      if (!['DIGITAL', 'NON_DIGITAL'].includes(category)) {
        throw new Error('Invalid material category');
      }
      return await Material.find({ category }).sort({ createdAt: -1 });
    },

    getMaterialById: async (_, { id }, context) => {
      checkAdmin(context.user);
      const material = await Material.findById(id);
      if (!material) throw new Error('Material not found');
      return material;
    },
  },

  Mutation: {
    createMaterial: async (_, { input }, context) => {
      checkAdmin(context.user);

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

      // 🚀 Auto-create two tablets for CAR with LCD_HEADDRESS
      if (vehicleType === 'CAR' && materialType === 'HEADDRESS') {
        const tabletsToCreate = [
          { carGroupId: material._id.toString(), tabletNumber: 1, status: 'OFFLINE', lastSeen: null },
          { carGroupId: material._id.toString(), tabletNumber: 2, status: 'OFFLINE', lastSeen: null }
        ];

        await Tablet.insertMany(
          tabletsToCreate.map(t => ({
            ...t,
            materialId: material._id,
            gps: { lat: null, lng: null }
          }))
        );
      }

      return material;
    },

    updateMaterial: async (_, { id, input }, context) => {
      checkAdmin(context.user);

      if (input.vehicleType && input.materialType) {
        const allowed = allowedMaterialsByVehicle[input.vehicleType];
        if (!allowed.includes(input.materialType)) {
          throw new Error(
            `${input.materialType} is not allowed for vehicle type ${input.vehicleType}`
          );
        }
      }

      const material = await Material.findById(id);
      if (!material) throw new Error('Material not found');

      const categoryChanged = input.category !== undefined && input.category !== material.category;
      const materialTypeChanged = input.materialType !== undefined && input.materialType !== material.materialType;
      const vehicleTypeChanged = input.vehicleType !== undefined && input.vehicleType !== material.vehicleType;

      Object.keys(input).forEach((key) => {
        material[key] = input[key];
      });

      if (categoryChanged || materialTypeChanged || vehicleTypeChanged) {
        material.materialId = undefined;
      }

      await material.save();
      return material;
    },

    deleteMaterial: async (_, { id }, context) => {
      checkAdmin(context.user);

      const deleted = await Material.findByIdAndDelete(id);
      if (!deleted) throw new Error('Material not found or already deleted');

      // Also remove tablets linked to this material
      await Tablet.deleteMany({ materialId: id });

      return 'Material deleted successfully.';
    },

    assignMaterialToDriver: async (_, { driverId }, context) => {
      checkAdmin(context.user);

      const driver = await Driver.findById(driverId);
      if (!driver) throw new Error('Driver not found');

      const allowedTypes = allowedMaterialsByVehicle[driver.vehicleType];
      if (!allowedTypes) {
        throw new Error(`No allowed materials for vehicle type ${driver.vehicleType}`);
      }

      const availableMaterials = await Material.find({
        vehicleType: driver.vehicleType,
        materialType: { $in: allowedTypes },
        driverId: null,
      });

      if (!availableMaterials.length) {
        throw new Error('No available materials to assign');
      }

      const assignedMaterial = availableMaterials[0];
      assignedMaterial.driverId = driver._id;
      await assignedMaterial.save();

      return assignedMaterial;
    }
  },

  Material: {
    id: (parent) => parent._id.toString(),
    materialId: (parent) => parent.materialId,
  },
};

module.exports = materialResolvers;

