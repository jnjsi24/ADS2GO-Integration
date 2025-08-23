const Payment = require('../models/Payment');
const Ad = require('../models/Ad');
const AdsPlan = require('../models/AdsPlan');
const { checkAuth, checkAdmin } = require('../middleware/auth');
const mongoose = require('mongoose');

const paymentResolvers = {
  Query: {
    getAllPayments: async (_, { paymentStatus }, { user }) => {
    checkAdmin(user);

    const filter = {};
    if (paymentStatus) {
      filter.paymentStatus = paymentStatus; // filter by status if provided
    }

    return await Payment.find(filter).sort({ createdAt: -1 });
  },

  

  getPaymentsByUser: async (_, { paymentStatus }, { user }) => {
      checkAuth(user);

      // Ensure correct type for userId
      const userIdFilter = mongoose.Types.ObjectId.isValid(user.id)
        ? new mongoose.Types.ObjectId(user.id)
        : user.id;

      const filter = { userId: userIdFilter };

      // Add paymentStatus filter if provided
      if (paymentStatus) {
        filter.paymentStatus = paymentStatus;
      }

      // Fetch payments
      const payments = await Payment.find(filter).sort({ createdAt: -1 });

      // Populate durationDays from adsId and planID
      const results = await Promise.all(
        payments.map(async (p) => {
          const ad = await Ad.findById(p.adsId).select('id title durationDays');
          const plan = await AdsPlan.findById(p.planID).select('id title durationDays');
          return {
            ...p.toObject(),
            adsId: ad,
            planID: plan,
          };
        })
      );

      return results;
    },


    getPaymentById: async (_, { id }, { user }) => {
      checkAuth(user);
      const payment = await Payment.findById(id);
      if (!payment) throw new Error('Payment not found');
      if (
        payment.userId.toString() !== user.id &&
        !['ADMIN', 'SUPERADMIN'].includes(user.role)
      ) throw new Error('Not authorized to view this payment');
      return payment;
    },

    getUserAdsWithPayments: async (_, __, { user }) => {
      checkAuth(user);
      const ads = await Ad.find({ userId: user.id }).sort({ createdAt: -1 });
      const payments = await Payment.find({
        adsId: { $in: ads.map(ad => ad._id) },
      });

      return ads.map(ad => ({
        ad,
        payment: payments.find(p => p.adsId.toString() === ad._id.toString()) || null,
      }));
    },
  },

  Mutation: {
    createPayment: async (_, { input }, { user }) => {
      checkAuth(user);

      const { adsId, paymentType, paymentDate } = input;

      const ad = await Ad.findById(adsId);
      if (!ad) throw new Error('Ad not found');
      if (ad.status !== 'APPROVED') throw new Error('Ad is not approved');

      const existingPayment = await Payment.findOne({ adsId });
      if (existingPayment) throw new Error('A payment already exists for this ad.');

      let receiptId;
      let isUnique = false;
      while (!isUnique) {
        const randomNum = Math.floor(1000 + Math.random() * 9000); // 4 digits
        receiptId = `REC-${randomNum}`;
        const duplicate = await Payment.findOne({ receiptId });
        if (!duplicate) isUnique = true;
      }

      const newPayment = new Payment({
        adsId,
        planID: ad.planId,
        userId: user.id,
        paymentType,
        receiptId,
        paymentDate: paymentDate || new Date().toISOString(),
        amount: ad.price,
        paymentStatus: 'PAID'
      });

      await newPayment.save();

      ad.paymentStatus = 'PAID';
      await ad.save();

      return {
        success: true,
        message: 'Payment created successfully',
        payment: newPayment
      };
    },

    deletePayment: async (_, { id }, { user }) => {
      checkAuth(user);

      const payment = await Payment.findById(id);
      if (!payment) throw new Error('Payment not found');
      if (payment.userId.toString() !== user.id) throw new Error('Not authorized');
      if (payment.paymentStatus === 'PAID') throw new Error('Cannot delete a paid payment');

      await Payment.findByIdAndDelete(id);

      return {
        success: true,
        message: 'Payment deleted successfully',
        payment: null,
      };
    },

    // ✅ Added updatePayment for admin
    updatePayment: async (_, { id, input }, { user }) => {
      checkAdmin(user); // only admin can update

      const payment = await Payment.findById(id);
      if (!payment) throw new Error('Payment not found');

      payment.paymentStatus = input.paymentStatus;
      await payment.save();

      return {
        success: true,
        message: 'Payment updated successfully',
        payment,
      };
    },
  },

  Payment: {
    adsId: async (parent) => {
      const ad = await Ad.findById(parent.adsId);
      return ad || null;
    },
    planID: async (parent) => {
      const plan = await AdsPlan.findById(parent.planID);
      return plan || null;
    },
  },
};

module.exports = paymentResolvers;
