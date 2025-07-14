const Payment = require('../models/Payment');
const { checkAuth } = require('../middleware/auth');

const paymentResolvers = {
  Query: {
    getPaymentsByUser: async (_, __, { user }) => {
      checkAuth(user);
      return await Payment.find({ userId: user.id });
    },
    getPaymentById: async (_, { id }, { user }) => {
      checkAuth(user);
      const payment = await Payment.findById(id);
      if (!payment) throw new Error('Payment not found');
      if (payment.userId.toString() !== user.id) throw new Error('Not authorized to view this payment');
      return payment;
    },
  },

  Mutation: {
    createPayment: async (_, { input }, { user }) => {
      checkAuth(user);

      const { adsId, paymentType, amount, receiptId } = input;

      // Basic validation example
      if (amount <= 0) throw new Error('Amount must be positive');
      if (!receiptId.trim()) throw new Error('Receipt ID is required');

      // Check for duplicate receiptId
      const existing = await Payment.findOne({ receiptId });
      if (existing) throw new Error('Duplicate receipt ID');

      const newPayment = new Payment({
        userId: user.id,
        adsId,
        paymentType,
        amount,
        receiptId,
        paymentStatus: 'PENDING', // default status
      });

      await newPayment.save();

      return {
        success: true,
        message: 'Payment created successfully',
        payment: newPayment,
      };
    },

    updatePayment: async (_, { id, input }, { user }) => {
      checkAuth(user);

      const payment = await Payment.findById(id);
      if (!payment) throw new Error('Payment not found');
      if (payment.userId.toString() !== user.id) throw new Error('Not authorized');

      if (input.paymentStatus && !['PAID', 'PENDING', 'FAILED'].includes(input.paymentStatus)) {
        throw new Error('Invalid payment status');
      }

      if (input.paymentStatus) payment.paymentStatus = input.paymentStatus;

      await payment.save();

      return {
        success: true,
        message: 'Payment updated successfully',
        payment,
      };
    },

    deletePayment: async (_, { id }, { user }) => {
      checkAuth(user);

      const payment = await Payment.findById(id);
      if (!payment) throw new Error('Payment not found');
      if (payment.userId.toString() !== user.id) throw new Error('Not authorized');

      await Payment.findByIdAndDelete(id);

      return {
        success: true,
        message: 'Payment deleted successfully',
        payment: null,
      };
    },
  },
};

module.exports = paymentResolvers;
