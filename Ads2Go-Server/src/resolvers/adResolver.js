

////////////////////////?



//adResolver.js
const Ad = require('../models/Ad');
const User = require('../models/User');
const Plan = require('../models/AdsPlan');
const Material = require('../models/Material'); // <-- added Material model
const { checkAuth, checkAdmin } = require('../middleware/auth');

const DAYS_MAP = {
  WEEKLY: 7,
  MONTHLY: 30,
  YEARLY: 365
};

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

    getAdById: async (_, { id }, { user }) => {
      checkAuth(user);
      const ad = await Ad.findById(id)
        .populate('materialId')
        .populate('planId');

      if (!ad) throw new Error('Ad not found');
      if (ad.userId.toString() !== user.id && !['ADMIN', 'SUPERADMIN'].includes(user.role)) {
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
      if (!dbUser.isEmailVerified && !['ADMIN', 'SUPERADMIN'].includes(user.role)) {
        throw new Error('Please verify your email before creating an advertisement');
      }

      const plan = await Plan.findById(input.planId);
      if (!plan) throw new Error('Invalid plan selected');

      if (!['DIGITAL', 'NON_DIGITAL'].includes(input.adType)) {
        throw new Error('Invalid adType');
      }

      // Validate material exists
      const materialExists = await Material.exists({ _id: input.materialId });
      if (!materialExists) throw new Error('Material not found');

      // Determine number of days based on durationType
      const days = DAYS_MAP[input.durationType] || plan.durationDays || 7;

      const totalPlaysPerDay = plan.playsPerDayPerDevice * plan.numberOfDevices;
      const totalPrice = totalPlaysPerDay * plan.pricePerPlay * days;

      const startTime = new Date(input.startTime);
      const endTime = new Date(startTime);
      endTime.setDate(startTime.getDate() + days);

      const ad = new Ad({
        ...input,
        userId: user.id,
        numberOfDevices: plan.numberOfDevices,
        adLengthMinutes: plan.adLengthMinutes,
        playsPerDayPerDevice: plan.playsPerDayPerDevice,
        totalPlaysPerDay,
        pricePerPlay: plan.pricePerPlay,
        totalPrice,
        price: totalPrice,          // must set this for non-nullable field
        endTime,
        status: 'PENDING',
        impressions: 0,
        reasonForReject: null,
        approveTime: null,
        rejectTime: null
      });

      return await ad.save();
    },

    updateAd: async (_, { id, input }, { user }) => {
      checkAuth(user);
      const ad = await Ad.findById(id);
      if (!ad) throw new Error('Ad not found');

      const isAdmin = ['ADMIN', 'SUPERADMIN'].includes(user.role);

      const applyPlanChanges = async (planId, startTime, durationType) => {
        const plan = await Plan.findById(planId);
        if (!plan) throw new Error('Invalid plan selected');

        ad.planId = plan._id;
        ad.numberOfDevices = plan.numberOfDevices;
        ad.adLengthMinutes = plan.adLengthMinutes;
        ad.playsPerDayPerDevice = plan.playsPerDayPerDevice;
        ad.totalPlaysPerDay = plan.playsPerDayPerDevice * plan.numberOfDevices;
        ad.pricePerPlay = plan.pricePerPlay;

        const days = DAYS_MAP[durationType] || plan.durationDays || 7;
        ad.totalPrice = ad.totalPlaysPerDay * plan.pricePerPlay * days;
        ad.price = ad.totalPrice;

        if (startTime) {
          const endTime = new Date(startTime);
          endTime.setDate(endTime.getDate() + days);
          ad.endTime = endTime;
        }
      };

      if (input.materialId) {
        const materialExists = await Material.exists({ _id: input.materialId });
        if (!materialExists) throw new Error('Material not found');
      }

      if (isAdmin) {
        if (input.status && input.status !== ad.status) {
          ad.status = input.status;
          if (input.status === 'APPROVED') {
            ad.approveTime = new Date();
            ad.rejectTime = null;
            ad.reasonForReject = null;
          } else if (input.status === 'REJECTED') {
            ad.rejectTime = new Date();
            ad.approveTime = null;
            ad.reasonForReject = input.reasonForReject || null;
          } else {
            ad.approveTime = null;
            ad.rejectTime = null;
            ad.reasonForReject = null;
          }
        }

        if (input.planId) await applyPlanChanges(input.planId, input.startTime || ad.startTime, input.durationType);
        if (input.startTime) {
          ad.startTime = new Date(input.startTime);
          if (ad.planId) await applyPlanChanges(ad.planId, input.startTime, input.durationType);
        }

        if (input.adType && ['DIGITAL', 'NON_DIGITAL'].includes(input.adType)) ad.adType = input.adType;
        if (input.title !== undefined) ad.title = input.title;
        if (input.description !== undefined) ad.description = input.description;
        if (input.adFormat !== undefined) ad.adFormat = input.adFormat;
        if (input.mediaFile !== undefined) ad.mediaFile = input.mediaFile;
        if (input.materialId !== undefined) ad.materialId = input.materialId;
      } else {
        if (ad.userId.toString() !== user.id) throw new Error('Not authorized to update this ad');
        if (input.status && input.status !== ad.status) throw new Error('You are not authorized to update the status');

        if (input.planId) await applyPlanChanges(input.planId, input.startTime || ad.startTime, input.durationType);
        if (input.startTime) {
          ad.startTime = new Date(input.startTime);
          if (ad.planId) await applyPlanChanges(ad.planId, input.startTime, input.durationType);
        }

        if (input.adType && ['DIGITAL', 'NON_DIGITAL'].includes(input.adType)) ad.adType = input.adType;
        if (input.title !== undefined) ad.title = input.title;
        if (input.description !== undefined) ad.description = input.description;
        if (input.adFormat !== undefined) ad.adFormat = input.adFormat;
        if (input.mediaFile !== undefined) ad.mediaFile = input.mediaFile;
        if (input.materialId !== undefined) ad.materialId = input.materialId;
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


