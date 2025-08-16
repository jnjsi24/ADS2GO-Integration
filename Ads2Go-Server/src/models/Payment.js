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

// 🔹 Auto-create AdsDeployment after payment success
PaymentSchema.post('save', async function (doc) {
  if (doc.paymentStatus === 'PAID') {
    try {
      const Material = require('./Material');
      const AdsDeployment = require('./adsDeployment');
      const Ad = require('./Ad');

      // 🔍 Find the Ad linked to this Payment
      const ad = await Ad.findById(doc.adsId);
      if (!ad) {
        console.error(`❌ Payment ${doc._id} linked to invalid adsId`);
        return;
      }

      // 🔍 Find the Material for that Ad
      const material = await Material.findById(ad.materialId);
      if (!material) {
        console.error(`❌ Cannot deploy Ad ${ad._id}: material not found`);
        return;
      }

      if (!material.driverId) {
        console.error(`❌ Cannot deploy Material ${material.materialId}: no driver assigned`);
        return;
      }

      // ✅ Create AdsDeployment with startTime + endTime
      await AdsDeployment.create({
        adId: ad._id,
        materialId: material._id,
        driverId: material.driverId,
        deployedAt: new Date(),
        status: 'DEPLOYED',
        startTime: ad.startTime,   // <-- from Ad
        endTime: ad.endTime        // <-- from Ad
      });

      console.log(`✅ Ad ${ad._id} deployed successfully to driver ${material.driverId}`);
    } catch (error) {
      console.error(`❌ Error auto-deploying ad after payment:`, error);
    }
  }
});

const Payment = mongoose.model('Payment', PaymentSchema);
module.exports = Payment;
