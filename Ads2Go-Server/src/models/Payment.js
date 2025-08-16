const mongoose = require('mongoose');
const AdsDeployment = require('./adsDeployment'); // import deployment model
const Ad = require('./Ad'); // in case we need ad info

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

// 🔹 Auto-create AdsDeployment after payment success
PaymentSchema.post('save', async function (doc) {
  if (doc.paymentStatus === 'PAID') {
    try {
      // Get Ad details
      const ad = await mongoose.model('Ad').findById(doc.adsId).populate('materialId driverId planId');
      if (!ad) {
        console.error('❌ Ad not found for deployment:', doc.adsId);
        return;
      }

      // Deployment scheduling (example: immediate run, for 30 days based on plan)
      const startTime = new Date();
      const endTime = new Date();
      endTime.setDate(startTime.getDate() + (ad.planId?.durationDays || 30));

      // Deploy ad to LCD automatically
      await AdsDeployment.addToLCD(ad.materialId, ad.driverId, ad._id, startTime, endTime);

      console.log(`✅ AdsDeployment created automatically for Ad: ${ad._id}`);
    } catch (err) {
      console.error('❌ Error auto-deploying ad after payment:', err);
    }
  }
});

const Payment = mongoose.model('Payment', PaymentSchema);
module.exports = Payment;
