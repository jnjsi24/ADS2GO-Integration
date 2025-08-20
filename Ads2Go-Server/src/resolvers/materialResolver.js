


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

      // Ensure pre-save hook triggers
      await material.save();
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

      const categoryChanged =
        input.category !== undefined && input.category !== material.category;
      const materialTypeChanged =
        input.materialType !== undefined && input.materialType !== material.materialType;
      const vehicleTypeChanged =
        input.vehicleType !== undefined && input.vehicleType !== material.vehicleType;

      Object.keys(input).forEach((key) => {
        material[key] = input[key];
      });

      // Force re-generation of materialId if needed
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
      return 'Material deleted successfully.';
    },

    assignMaterialToDriver: async (_, { driverId }, context) => {
  checkAdmin(context.user);

  // Find driver by driverId (custom string like DRV-001)
  const driver = await Driver.findOne({ driverId });
  if (!driver) throw new Error('Driver not found');

  const allowedTypes = allowedMaterialsByVehicle[driver.vehicleType];
  if (!allowedTypes) {
    throw new Error(`No allowed materials for vehicle type ${driver.vehicleType}`);
  }

  const availableMaterials = await Material.find({
    vehicleType: driver.vehicleType,
    materialType: { $in: allowedTypes },
    driverId: null, // only unassigned
  });

  if (!availableMaterials.length) {
    throw new Error('No available materials to assign');
  }

  const assignedMaterial = availableMaterials[0];

  // ✅ Assign using the string driverId, not ObjectId
  assignedMaterial.driverId = driver.driverId;
  await assignedMaterial.save();

  return assignedMaterial;
},
  },

  Material: {
    id: (parent) => parent._id.toString(),
    materialId: (parent) => parent.materialId, // explicitly return the generated materialId
    driverId: (parent) => parent.driverId,     // always return driverId as string
  },
};

module.exports = materialResolvers;

