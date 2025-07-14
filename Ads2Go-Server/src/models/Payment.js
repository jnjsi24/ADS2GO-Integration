const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  adsId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  paymentType: {
    type: String,
    required: true,
    enum: ['CREDIT_CARD', 'DEBIT_CARD', 'GCASH', 'PAYPAL', 'BANK_TRANSFER'], // example types
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
  },
  paymentStatus: {
    type: String,
    required: true,
    enum: ['PAID', 'PENDING', 'FAILED'],
    default: 'PENDING',
  },
}, { timestamps: true });

const Payment = mongoose.model('Payment', PaymentSchema);

module.exports = Payment;
