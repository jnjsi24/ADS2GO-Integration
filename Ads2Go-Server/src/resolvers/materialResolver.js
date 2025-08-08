const Material = require('../models/Material');
const { checkAdmin } = require('../middleware/auth');

const allowedMaterialsByVehicle = {
  CAR: ['POSTER', 'LCD', 'STICKER', 'LCD_HEADDRESS', 'BANNER'],
  BUS: ['STICKER', 'LCD_HEADDRESS'],
  JEEP: ['POSTER', 'STICKER'],
  MOTOR: ['LCD', 'BANNER'],
  E_TRIKE: ['BANNER', 'LCD'],
};

module.exports = {
  Query: {
    getAllMaterials: async (_, __, context) => {
      const { user } = context;
      checkAdmin(user);
      return await Material.find().sort({ createdAt: -1 });
    },

    getMaterialsByCategory: async (_, { category }) => {
      if (!['DIGITAL', 'NON_DIGITAL'].includes(category)) {
        throw new Error('Invalid material category');
      }
      return await Material.find({ category }).sort({ createdAt: -1 });
    },

    getMaterialById: async (_, { id }, context) => {
      const { user } = context;
      checkAdmin(user);
      const material = await Material.findById(id);
      if (!material) throw new Error('Material not found');
      return material;
    },
  },

  Mutation: {
    createMaterial: async (_, { input }, context) => {
      const { user } = context;
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
        // planId removed here
        driverId: user.id,
      });

      await material.save();
      return material;
    },

    updateMaterial: async (_, { id, input }, context) => {
      const { user } = context;
      checkAdmin(user);

      if (input.vehicleType && input.materialType) {
        const allowed = allowedMaterialsByVehicle[input.vehicleType];
        if (!allowed.includes(input.materialType)) {
          throw new Error(
            `${input.materialType} is not allowed for vehicle type ${input.vehicleType}`
          );
        }
      }

      const updated = await Material.findByIdAndUpdate(id, input, {
        new: true,
        runValidators: true,
      });

      if (!updated) throw new Error('Material not found');
      return updated;
    },

    deleteMaterial: async (_, { id }, context) => {
      const { user } = context;
      checkAdmin(user);

      const deleted = await Material.findByIdAndDelete(id);
      if (!deleted) throw new Error('Material not found or already deleted');
      return 'Material deleted successfully.';
    },
  },

  Material: {
    id: (parent) => parent._id.toString(),
  },
};
