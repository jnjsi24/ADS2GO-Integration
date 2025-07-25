const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    adsId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Ad',
    },
    paymentType: {
      type: String,
      required: true,
      enum: ['CREDIT_CARD', 'DEBIT_CARD', 'GCASH', 'PAYPAL', 'BANK_TRANSFER'],
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'Amount must be positive'],
    },
    receiptId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    paymentStatus: {
      type: String,
      required: true,
      enum: ['PENDING', 'PAID', 'FAILED'],
      default: 'PENDING',
    },
  },
  { timestamps: true }
);

const Payment = mongoose.model('Payment', PaymentSchema);

module.exports = Payment;
