const mongoose = require('mongoose');
const Material = require('../models/Material');

module.exports = {
  Query: {
    getAllMaterials: async () => {
      return await Material.find()
        .populate('riderId')
        .populate('advertisements.advertisementId');
    },

    getMaterialById: async (_, { id }) => {
      return await Material.findById(id)
        .populate('riderId')
        .populate('advertisements.advertisementId');
    }
  },

  Mutation: {
    createMaterial: async (_, { input }) => {
      try {
        const riderId = input.riderId?.trim();
        let castedRiderId;

        try {
          castedRiderId = new mongoose.Types.ObjectId(riderId);
        } catch (err) {
          throw new Error('Invalid riderId');
        }

        const ads = (input.advertisements || []).map((ad, index) => {
          const rawId = ad.advertisementId;
          const trimmedId = rawId?.trim();
        
          let castedAdId;
          try {
            castedAdId = new mongoose.Types.ObjectId(trimmedId);
          } catch (err) {
            throw new Error(`Invalid advertisementId at index ${index}: ${rawId}`);
          }
        
          return {
            advertisementId: castedAdId,
            assignedAt: ad.assignedAt,
            removedAt: ad.removedAt
          };
        });
        

        const material = new Material({
          ...input,
          riderId: castedRiderId,
          advertisements: ads
        });

        await material.save();
        return material;
      } catch (error) {
        console.error('Error in createMaterial:', error.message);
        throw new Error('Failed to create material. ' + error.message);
      }
    },

    addAdvertisementToMaterial: async (_, { materialId, ad }) => {
      try {
        const material = await Material.findById(materialId);
        if (!material) throw new Error('Material not found');

        const trimmedAdId = ad.advertisementId?.trim();
        let castedAdId;
        try {
          castedAdId = new mongoose.Types.ObjectId(trimmedAdId);
        } catch (err) {
          throw new Error('Invalid advertisementId');
        }

        material.advertisements.push({
          advertisementId: castedAdId,
          assignedAt: ad.assignedAt,
          removedAt: ad.removedAt
        });

        await material.save();
        return material;
      } catch (error) {
        console.error('Error in addAdvertisementToMaterial:', error.message);
        throw new Error('Failed to add advertisement. ' + error.message);
      }
    },

    deleteMaterial: async (_, { id }) => {
      try {
        await Material.findByIdAndDelete(id);
        return "Material deleted successfully.";
      } catch (error) {
        console.error('Error in deleteMaterial:', error.message);
        throw new Error('Failed to delete material.');
      }
    }
  }
};
