

const Payment = require('../models/Payment');
const Ad = require('../models/Ad');
const AdsPlan = require('../models/AdsPlan');
const { checkAuth, checkAdmin } = require('../middleware/auth');

const paymentResolvers = {
  Query: {
    // Queries remain the same
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

      // The userId for the payment should always be the ad's owner, regardless of who created the payment (admin or user).
      const newPayment = new Payment({
        userId: ad.userId,
        adsId: ad._id,
        planID: plan._id,
        paymentDate: input.paymentDate,
        paymentType: input.paymentType,
        amount: plan.totalPrice, // Use the total price from the plan
        receiptId: input.receiptId,
        paymentStatus: isAdmin ? 'PAID' : 'PENDING' // Set status to PAID if created by an admin, otherwise PENDING
      });

      await newPayment.save();

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
    // Resolve the `plan` field using the `planID`
    plan: async (parent) => {
      return await AdsPlan.findById(parent.planID);
    }
  },
};

module.exports = paymentResolvers;