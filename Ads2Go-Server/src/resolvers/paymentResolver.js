const Payment = require('../models/Payment');
const Ad = require('../models/Ad');
const AdsPlan = require('../models/AdsPlan');
const { checkAuth, checkAdmin } = require('../middleware/auth');

const paymentResolvers = {
  Query: {
    getAllPayments: async (_, __, { user }) => {
      checkAdmin(user);
      return await Payment.find().sort({ createdAt: -1 });
    },

    getPaymentsByUser: async (_, __, { user }) => {
      checkAuth(user);
      return await Payment.find({ userId: user.id }).sort({ createdAt: -1 });
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

      const { adsId, paymentType, receiptId, paymentDate } = input;

      const ad = await Ad.findById(adsId);
      if (!ad) throw new Error('Ad not found');
      if (ad.status !== 'APPROVED') throw new Error('Ad is not approved');

      const existingPayment = await Payment.findOne({ adsId });
      if (existingPayment) throw new Error('A payment already exists for this ad.');

      const newPayment = new Payment({
        adsId,
        planID: ad.planId,
        userId: user.id,
        paymentType,
        receiptId,
        paymentDate: paymentDate || new Date().toISOString(),
        amount: ad.price,
        paymentStatus: 'PENDING'
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
