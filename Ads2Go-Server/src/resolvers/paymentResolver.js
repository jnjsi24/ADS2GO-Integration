const Payment = require('../models/Payment');
const Ad = require('../models/Ad');
const AdsPlan = require('../models/AdsPlan');
const { checkAuth, checkAdmin } = require('../middleware/auth');

const paymentResolvers = {
  Query: {
    getAllPayments: async (_, __, { user }) => {
      checkAdmin(user);
      return await Payment.find()
        .sort({ createdAt: -1 })
        .populate('adsId');
    },

    getPaymentsByUser: async (_, __, { user }) => {
      checkAuth(user);
      return await Payment.find({ userId: user.id })
        .sort({ createdAt: -1 })
        .populate('adsId');
    },

    getPaymentById: async (_, { id }, { user }) => {
      checkAuth(user);
      const payment = await Payment.findById(id).populate('adsId');
      if (!payment) {
        throw new Error('Payment not found');
      }
      if (
        payment.userId.toString() !== user.id &&
        user.role !== 'ADMIN' &&
        user.role !== 'SUPERADMIN'
      ) {
        throw new Error('Not authorized to view this payment');
      }
      return payment;
    }
  },

  Mutation: {
    createPayment: async (_, { input }, { user }) => {
      checkAuth(user); // Ensure the user is logged in

      const ad = await Ad.findById(input.adsId);
      if (!ad) {
        throw new Error('Ad not found');
      }

      // ✅ Validation: Only allow payment if ad is approved
      if (ad.status !== 'APPROVED') {
        throw new Error('Payment cannot be created. The ad is not yet approved.');
      }

      // Check if a payment already exists for this ad
      const existingPayment = await Payment.findOne({ adsId: input.adsId });
      if (existingPayment) {
        throw new Error('A payment for this ad already exists.');
      }

      // Check if the authenticated user is the ad owner OR an admin
      const isOwner = ad.userId.toString() === user.id;
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPERADMIN';

      if (!isOwner && !isAdmin) {
        throw new Error('Not authorized to create payment for this ad');
      }

      // Fetch the plan to get the totalPrice
      const plan = await AdsPlan.findById(ad.planId);
      if (!plan) {
        throw new Error('Associated plan not found');
      }

      // Always assign payment to the ad's owner
      const newPayment = new Payment({
        userId: ad.userId,
        adsId: ad._id,
        planID: plan._id,
        paymentDate: input.paymentDate,
        paymentType: input.paymentType,
        amount: plan.totalPrice,
        receiptId: input.receiptId,
        paymentStatus: isAdmin ? 'PAID' : 'PENDING'
      });

      await newPayment.save();

      // ✅ If admin sets payment directly to PAID, activate ad immediately
      if (newPayment.paymentStatus === 'PAID') {
        ad.adStatus = 'ACTIVE';
        ad.paymentStatus = 'PAID';
        await ad.save();
      }

      return {
        success: true,
        message: 'Payment created successfully',
        payment: newPayment,
      };
    },

    updatePayment: async (_, { id, input }, { user }) => {
      checkAdmin(user);

      const payment = await Payment.findById(id).populate('adsId');
      if (!payment) throw new Error('Payment not found');

      const { paymentStatus } = input;
      if (!['PAID', 'PENDING', 'FAILED'].includes(paymentStatus)) {
        throw new Error('Invalid payment status');
      }

      payment.paymentStatus = paymentStatus;
      await payment.save();

      // ✅ If payment is now marked PAID, activate the ad
      if (payment.paymentStatus === 'PAID') {
        const ad = await Ad.findById(payment.adsId);
        if (ad) {
          ad.adStatus = 'ACTIVE';
          ad.paymentStatus = 'PAID';
          await ad.save();
        }
      }

      return {
        success: true,
        message: 'Payment status updated successfully',
        payment,
      };
    },

    deletePayment: async (_, { id }, { user }) => {
      checkAuth(user);

      const payment = await Payment.findById(id);
      if (!payment) throw new Error('Payment not found');
      if (payment.userId.toString() !== user.id) {
        throw new Error('Not authorized to delete this payment');
      }
      if (payment.paymentStatus === 'PAID') {
        throw new Error('Cannot delete a paid payment');
      }

      await Payment.findByIdAndDelete(id);

      return {
        success: true,
        message: 'Payment deleted successfully',
        payment: null,
      };
    },
  },

  Payment: {
    plan: async (parent) => {
      return await AdsPlan.findById(parent.planID);
    }
  },
};

module.exports = paymentResolvers;
