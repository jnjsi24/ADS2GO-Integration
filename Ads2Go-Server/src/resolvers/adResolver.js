const Ad = require('../models/Ad');
const User = require('../models/User');
const Plan = require('../models/AdsPlan');
const Material = require('../models/Material');
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

    getAdById: async (_, { id }, { user }) => {
      checkAuth(user);

      // Only admins can view any ad
      if (!['ADMIN', 'SUPERADMIN'].includes(user.role)) {
        throw new Error('Not authorized to view ads');
      }

      const ad = await Ad.findById(id)
        .populate('materialId')
        .populate('planId')
        .populate('userId');

      if (!ad) throw new Error('Ad not found');
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

      if (!input.adFormat) throw new Error('adFormat is required');

      const material = await Material.findById(input.materialId);
      if (!material) throw new Error('Material not found');

      // IMPORTANT: Ensure mediaFile is a Firebase Storage URL
      if (!input.mediaFile || !input.mediaFile.startsWith('http')) {
        throw new Error('Media file must be uploaded to Firebase first');
      }

      // Calculate total price
      const totalPlaysPerDay = plan.playsPerDayPerDevice * plan.numberOfDevices;
      const totalPrice = totalPlaysPerDay * plan.pricePerPlay * plan.durationDays;

      const startTime = new Date(input.startTime);
      const endTime = new Date(startTime);
      endTime.setDate(startTime.getDate() + plan.durationDays);

      const ad = new Ad({
        ...input,
        userId: user.id,
        durationDays: plan.durationDays,
        numberOfDevices: plan.numberOfDevices,
        adLengthSeconds: plan.adLengthSeconds,
        playsPerDayPerDevice: plan.playsPerDayPerDevice,
        totalPlaysPerDay,
        pricePerPlay: plan.pricePerPlay,
        totalPrice,
        price: totalPrice,
        startTime,
        endTime,
        status: 'PENDING',
        impressions: 0,
        reasonForReject: null,
        approveTime: null,
        rejectTime: null,
      });

      const savedAd = await ad.save();

      return await Ad.findById(savedAd._id)
        .populate('planId')
        .populate('materialId')
        .populate('userId');
    },

    updateAd: async (_, { id, input }, { user }) => {
      checkAuth(user);
      const ad = await Ad.findById(id);
      if (!ad) throw new Error('Ad not found');

      const isAdmin = ['ADMIN', 'SUPERADMIN'].includes(user.role);

      const applyPlanChanges = async (planId, startTime) => {
        const plan = await Plan.findById(planId);
        if (!plan) throw new Error('Invalid plan selected');

        ad.planId = plan._id;
        ad.numberOfDevices = plan.numberOfDevices;
        ad.adLengthSeconds = plan.adLengthSeconds;
        ad.playsPerDayPerDevice = plan.playsPerDayPerDevice;
        ad.totalPlaysPerDay = plan.playsPerDayPerDevice * plan.numberOfDevices;
        ad.pricePerPlay = plan.pricePerPlay;

        const days = plan.durationDays;
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

          if (input.status === "APPROVED") {
            ad.approveTime = new Date();
            ad.rejectTime = null;
            ad.reasonForReject = null;
          } else if (input.status === "REJECTED") {
            ad.rejectTime = new Date();
            ad.approveTime = null;
            ad.reasonForReject = input.reasonForReject || "No reason provided";
          } else {
            ad.approveTime = null;
            ad.rejectTime = null;
            ad.reasonForReject = null;
          }
        }

        if (input.planId) {
          await applyPlanChanges(input.planId, input.startTime || ad.startTime);
        }

        if (input.startTime) {
          ad.startTime = new Date(input.startTime);
          if (ad.planId) {
            await applyPlanChanges(ad.planId, input.startTime);
          }
        }

        if (input.adType && ["DIGITAL", "NON_DIGITAL"].includes(input.adType)) ad.adType = input.adType;
        if (input.adFormat) ad.adFormat = input.adFormat;
        if (input.title !== undefined) ad.title = input.title;
        if (input.description !== undefined) ad.description = input.description;

        if (input.mediaFile !== undefined) {
          if (!input.mediaFile.startsWith('http')) {
            throw new Error('Media file must be a Firebase Storage URL');
          }
          ad.mediaFile = input.mediaFile;
        }

        if (input.materialId !== undefined) ad.materialId = input.materialId;

      } else {
        if (ad.userId.toString() !== user.id) throw new Error("Not authorized to update this ad");
        if (input.status && input.status !== ad.status) throw new Error("You are not authorized to update the status");

        if (input.planId) {
          await applyPlanChanges(input.planId, input.startTime || ad.startTime);
        }

        if (input.startTime) {
          ad.startTime = new Date(input.startTime);
          if (ad.planId) {
            await applyPlanChanges(ad.planId, input.startTime);
          }
        }

        if (input.adType && ["DIGITAL", "NON_DIGITAL"].includes(input.adType)) ad.adType = input.adType;
        if (input.adFormat) ad.adFormat = input.adFormat;
        if (input.title !== undefined) ad.title = input.title;
        if (input.description !== undefined) ad.description = input.description;

        if (input.mediaFile !== undefined) {
          if (!input.mediaFile.startsWith('http')) {
            throw new Error('Media file must be a Firebase Storage URL');
          }
          ad.mediaFile = input.mediaFile;
        }

        if (input.materialId !== undefined) ad.materialId = input.materialId;
      }

      await ad.save();
      return await Ad.findById(ad._id)
        .populate('materialId')
        .populate('planId')
        .populate('userId');
    },

    deleteAd: async (_, { id }, { user }) => {
      checkAdmin(user);
      const result = await Ad.findByIdAndDelete(id);
      return !!result;
    }
  },

  Ad: {
    id: (parent) => parent._id.toString(),
    userId: async (parent) => await User.findById(parent.userId),
    materialId: async (parent) => await Material.findById(parent.materialId),
    planId: async (parent) => await Plan.findById(parent.planId),
  },

  AdsPlan: {
    id: (parent) => parent._id.toString(),
  },
};

module.exports = adResolvers;
