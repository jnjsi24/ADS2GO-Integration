const Ad = require('../models/Ad');
const { checkAuth, checkAdmin } = require('../middleware/auth');

const adResolvers = {
  Query: {
    getAllAds: async (_, __, { user }) => {
      checkAdmin(user);
      return await Ad.find({})
        .populate('userId')
        .populate('riderId')
        .populate('materialId')
        .populate('planId');
    },

    getAdsByUser: async (_, { userId }, { user }) => {
      checkAdmin(user);
      return await Ad.find({ userId })
        .populate('materialId')
        .populate('planId');
    },

    getMyAds: async (_, __, { user }) => {
      checkAuth(user);
      return await Ad.find({ userId: user.id })
        .populate('materialId')
        .populate('planId');
    },

    getAdById: async (_, { id }, { user }) => {
      checkAuth(user);
      const ad = await Ad.findById(id)
        .populate('materialId')
        .populate('planId');

      if (!ad) throw new Error('Ad not found');
      if (
        ad.userId.toString() !== user.id &&
        user.role !== 'ADMIN' &&
        user.role !== 'SUPERADMIN'
      ) {
        throw new Error('Not authorized to view this ad');
      }
      return ad;
    },
  },

  Mutation: {
    createAd: async (_, { input }, { user }) => {
      checkAuth(user);

      if (!['DIGITAL', 'NON_DIGITAL'].includes(input.adType)) {
        throw new Error('Invalid adType. Must be either DIGITAL or NON_DIGITAL.');
      }

      const ad = new Ad({
        ...input,
        userId: user.id, // override userId for security
        status: 'PENDING'
      });
      return await ad.save();
    },

    updateAd: async (_, { id, input }, { user }) => {
      checkAuth(user);
      const ad = await Ad.findById(id);
      if (!ad) throw new Error('Ad not found');

      // Admin or Superadmin privileges
      if (user.role === 'ADMIN' || user.role === 'SUPERADMIN') {
        if (input.status) ad.status = input.status;
        if (input.price !== undefined) ad.price = input.price;
        if (input.startTime !== undefined) ad.startTime = input.startTime;
        if (input.adType !== undefined) {
          if (!['DIGITAL', 'NON_DIGITAL'].includes(input.adType)) {
            throw new Error('Invalid adType');
          }
          ad.adType = input.adType;
        }
      } else {
        // Regular users can only update their own ad's non-status fields
        if (ad.userId.toString() !== user.id) {
          throw new Error('Not authorized to update this ad');
        }

        if (input.status && input.status !== ad.status) {
          throw new Error('You are not authorized to update the status');
        }

        if (input.title !== undefined) ad.title = input.title;
        if (input.description !== undefined) ad.description = input.description;
        if (input.adFormat !== undefined) ad.adFormat = input.adFormat;
        if (input.mediaFile !== undefined) ad.mediaFile = input.mediaFile;
        if (input.materialId !== undefined) ad.materialId = input.materialId;
        if (input.planId !== undefined) ad.planId = input.planId;
        if (input.price !== undefined) ad.price = input.price;
        if (input.startTime !== undefined) ad.startTime = input.startTime;
        if (input.adType !== undefined) {
          if (!['DIGITAL', 'NON_DIGITAL'].includes(input.adType)) {
            throw new Error('Invalid adType');
          }
          ad.adType = input.adType;
        }
      }

      await ad.save();
      return ad;
    },

    deleteAd: async (_, { id }, { user }) => {
      checkAdmin(user);
      const result = await Ad.findByIdAndDelete(id);
      return !!result;
    }
  }
};

module.exports = adResolvers;
