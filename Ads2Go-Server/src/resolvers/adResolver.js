const Ad = require('../models/Ad');
const { checkAuth } = require('../middleware/auth');

const adResolvers = {
  Query: {
    getAllAds: async (_, __, { user }) => {
      checkAuth(user);
      return await Ad.find({});
    },
    getAdById: async (_, { id }, { user }) => {
      checkAuth(user);
      return await Ad.findById(id);
    },
    getAdsByUser: async (_, { userId }, { user }) => {
      checkAuth(user);
      return await Ad.find({ userId });
    }
  },

  Mutation: {
    createAd: async (_, { input }, { user }) => {
      checkAuth(user);
      const ad = new Ad(input);
      return await ad.save();
    },
    updateAd: async (_, { id, input }, { user }) => {
      checkAuth(user);
      const updatedAd = await Ad.findByIdAndUpdate(id, input, { new: true });
      if (!updatedAd) throw new Error('Ad not found');
      return updatedAd;
    },
    deleteAd: async (_, { id }, { user }) => {
      checkAuth(user);
      const result = await Ad.findByIdAndDelete(id);
      return !!result;
    }
  }
};

module.exports = adResolvers;
    