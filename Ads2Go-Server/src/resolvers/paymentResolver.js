const Payment = require('../models/Payment');
const Ad = require('../models/Ad');
const { checkAuth, checkAdmin } = require('../middleware/auth');

const paymentResolvers = {
  Query: {
    getPaymentsByUser: async (_, __, { user }) => {
      checkAuth(user);
      return await Payment.find({ userId: user.id })
        .sort({ createdAt: -1 })
        .populate('adsId'); // Populate ad data
    },

    getAllPayments: async (_, __, { user }) => {
      checkAdmin(user);
      return await Payment.find()
        .sort({ createdAt: -1 })
        .populate('adsId'); // Populate ad data
    },
  },

  Mutation: {
    createPayment: async (_, { input }, { user }) => {
      checkAuth(user);
      const { adsId, paymentType, amount, receiptId } = input;

      if (amount <= 0) throw new Error('Amount must be positive');
      if (!receiptId.trim()) throw new Error('Receipt ID is required');

      const existing = await Payment.findOne({ receiptId });
      if (existing) throw new Error('Duplicate receipt ID');

      const ad = await Ad.findById(adsId);
      if (!ad) throw new Error('Ad not found');
      if (ad.status !== 'APPROVED') throw new Error('Ad must be approved before making a payment');
      if (ad.userId.toString() !== user.id) throw new Error('You are not authorized to pay for this ad');
      if (amount !== ad.price) throw new Error(`Amount must match ad price: ₱${ad.price}`);

      const existingPaid = await Payment.findOne({ adsId, paymentStatus: 'PAID' });
      if (existingPaid) throw new Error('This ad is already paid');

      const newPayment = new Payment({
        userId: user.id,
        adsId,
        paymentType,
        amount,
        receiptId,
        paymentStatus: 'PENDING',
      });

      await newPayment.save();
      await newPayment.populate('adsId');

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

  // ✅ Custom nested resolver
  Payment: {
    ad: async (parent) => {
      return await Ad.findById(parent.adsId);
    },
  },
};

module.exports = paymentResolvers;
