//adResolver.js

const Ad = require('../models/Ad');
const User = require('../models/User');
const Plan = require('../models/AdsPlan');
const Payment = require('../models/Payment');
const { checkAuth, checkAdmin } = require('../middleware/auth');

const adResolvers = {
  Query: {
    getAllAds: async (_, __, { user }) => {
      checkAdmin(user);
      return await Ad.find({})
        .populate('userId')
        .populate('driverId')
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

    getPaidAds: async (_, __, { user }) => {
      checkAdmin(user);
      return await Ad.find({ status: 'PAID' })
        .populate('userId')
        .populate('materialId')
        .populate('planId');
    },

    getDeployableAds: async (_, __, { user }) => {
      checkAdmin(user);
      // Ads that are paid but not yet deployed
      return await Ad.find({ 
        status: 'PAID',
        deployedTime: null 
      })
        .populate('userId')
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
        paidTime: null,
        deployedTime: null,
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
          } else if (input.status === 'PAID') {
            ad.paidTime = new Date();
          } else if (input.status === 'DEPLOYED') {
            ad.deployedTime = new Date();
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

        // Users cannot update paid or deployed ads
        if (['PAID', 'DEPLOYED', 'RUNNING'].includes(ad.status)) {
          throw new Error('Cannot update ads that are paid, deployed, or running');
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

    markAdAsPaid: async (_, { adId }, { user }) => {
      checkAdmin(user); // Only admin can mark as paid
      
      const ad = await Ad.findById(adId);
      if (!ad) throw new Error('Ad not found');
      
      if (ad.status !== 'APPROVED') {
        throw new Error('Ad must be approved before marking as paid');
      }

      // Verify payment exists and is paid
      const payment = await Payment.findOne({ adsId: adId, paymentStatus: 'PAID' });
      if (!payment) throw new Error('No valid payment found for this ad');

      ad.status = 'PAID';
      ad.paidTime = new Date();
      
      await ad.save();
      return ad;
    },

    markAdAsDeployed: async (_, { adId }, { user }) => {
      checkAdmin(user); // Only admin can mark as deployed
      
      const ad = await Ad.findById(adId);
      if (!ad) throw new Error('Ad not found');
      
      if (ad.status !== 'PAID') {
        throw new Error('Ad must be paid before marking as deployed');
      }

      ad.status = 'DEPLOYED';
      ad.deployedTime = new Date();
      
      await ad.save();
      return ad;
    },

    deleteAd: async (_, { id }, { user }) => {
      checkAdmin(user);
      
      const ad = await Ad.findById(id);
      if (!ad) throw new Error('Ad not found');
      
      // Don't allow deletion of paid or deployed ads
      if (['PAID', 'DEPLOYED', 'RUNNING'].includes(ad.status)) {
        throw new Error('Cannot delete ads that are paid, deployed, or running');
      }
      
      const result = await Ad.findByIdAndDelete(id);
      return !!result;
    }
  }
};

module.exports = adResolvers;