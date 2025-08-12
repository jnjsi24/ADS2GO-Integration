const Ad = require('../models/Ad');
const User = require('../models/User');
const Plan = require('../models/AdsPlan');
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

      const dbUser = await User.findById(user.id);
      if (!dbUser) throw new Error('User not found');

      if (!dbUser.isEmailVerified && user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
        throw new Error('Please verify your email before creating an advertisement');
      }

      const plan = await Plan.findById(input.planId);
      if (!plan) throw new Error('Invalid plan selected');

      if (!['DIGITAL', 'NON_DIGITAL'].includes(input.adType)) {
        throw new Error('Invalid adType');
      }

      const startTime = new Date(input.startTime);
      const endTime = new Date(startTime);
      endTime.setDate(startTime.getDate() + plan.durationDays);

      const ad = new Ad({
        ...input,
        userId: user.id,
        price: plan.price,
        endTime,
        status: 'PENDING',
        reasonForReject: null,
        approveTime: null,
        rejectTime: null,
      });

      return await ad.save();
    },

    updateAd: async (_, { id, input }, { user }) => {
      checkAuth(user);
      const ad = await Ad.findById(id);
      if (!ad) throw new Error('Ad not found');

      // Admin & Superadmin have full privileges
      if (user.role === 'ADMIN' || user.role === 'SUPERADMIN') {
        // Handle status changes and set approve/reject times accordingly
        if (input.status && input.status !== ad.status) {
          ad.status = input.status;

          if (input.status === 'APPROVED') {
            ad.approveTime = new Date();
            ad.rejectTime = null;
            ad.reasonForReject = null;
          } else if (input.status === 'REJECTED') {
            ad.rejectTime = new Date();
            ad.approveTime = null;
            // Optional: allow reasonForReject only if status is REJECTED
            if (input.reasonForReject) {
              ad.reasonForReject = input.reasonForReject;
            } else {
              ad.reasonForReject = null;
            }
          } else {
            // For other statuses, clear approve/reject times & reason
            ad.approveTime = null;
            ad.rejectTime = null;
            ad.reasonForReject = null;
          }
        }

        if (input.planId) {
          const plan = await Plan.findById(input.planId);
          if (!plan) throw new Error('Invalid plan selected');
          ad.planId = plan._id;
          ad.price = plan.price;
          if (ad.startTime) {
            const endTime = new Date(ad.startTime);
            endTime.setDate(endTime.getDate() + plan.durationDays);
            ad.endTime = endTime;
          }
        }

        if (input.startTime !== undefined) {
          ad.startTime = input.startTime;
          if (ad.planId) {
            const plan = await Plan.findById(ad.planId);
            if (plan) {
              const endTime = new Date(input.startTime);
              endTime.setDate(endTime.getDate() + plan.durationDays);
              ad.endTime = endTime;
            }
          }
        }

        if (input.adType !== undefined) {
          if (!['DIGITAL', 'NON_DIGITAL'].includes(input.adType)) {
            throw new Error('Invalid adType');
          }
          ad.adType = input.adType;
        }
      } 
      // Regular user
      else {
        if (ad.userId.toString() !== user.id) {
          throw new Error('Not authorized to update this ad');
        }

        if (input.status && input.status !== ad.status) {
          throw new Error('You are not authorized to update the status');
        }

        if (input.planId) {
          const plan = await Plan.findById(input.planId);
          if (!plan) throw new Error('Invalid plan selected');
          ad.planId = plan._id;
          ad.price = plan.price;
          if (ad.startTime) {
            const endTime = new Date(ad.startTime);
            endTime.setDate(endTime.getDate() + plan.durationDays);
            ad.endTime = endTime;
          }
        }

        if (input.title !== undefined) ad.title = input.title;
        if (input.description !== undefined) ad.description = input.description;
        if (input.adFormat !== undefined) ad.adFormat = input.adFormat;
        if (input.mediaFile !== undefined) ad.mediaFile = input.mediaFile;
        if (input.materialId !== undefined) ad.materialId = input.materialId;
        if (input.startTime !== undefined) {
          ad.startTime = input.startTime;
          if (ad.planId) {
            const plan = await Plan.findById(ad.planId);
            if (plan) {
              const endTime = new Date(input.startTime);
              endTime.setDate(endTime.getDate() + plan.durationDays);
              ad.endTime = endTime;
            }
          }
        }
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
