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
    // ❌ ADDED: The planID field
    planID: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'AdsPlan',
    },
    paymentType: {
      type: String,
      required: true,
      enum: ['CREDIT_CARD', 'DEBIT_CARD', 'GCASH', 'PAYPAL', 'BANK_TRANSFER', 'CASH'],
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

// 🔹 Auto-activate Ad after payment is PAID
// Note: This hook is disabled during transactions to prevent conflicts
// The ad activation is now handled directly in the payment resolver
PaymentSchema.post('save', async function (doc) {
  // Skip this hook if we're in a transaction (session exists)
  if (this.$session) {
    console.log('Skipping payment post-save hook during transaction');
    return;
  }

  if (doc.paymentStatus === 'PAID') {
    try {
      const Ad = require('./Ad');
      const ad = await Ad.findById(doc.adsId);
      if (!ad) {
        console.error(`❌ Payment ${doc._id} linked to invalid adsId`);
        return;
      }

      ad.adStatus = 'ACTIVE';
      ad.paymentStatus = 'PAID';
      await ad.save(); // triggers Ad post('save') hook for auto deployment

      console.log(`✅ Ad ${doc.adsId} activated after payment and deployment triggered`);
    } catch (error) {
      console.error(`❌ Error activating Ad after payment:`, error);
    }
  }
});

const Payment = mongoose.model('Payment', PaymentSchema);
module.exports = Payment;