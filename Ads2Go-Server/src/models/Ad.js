// models/Ad.js
const mongoose = require('mongoose');

const AdSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    default: null
  },
  materialId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Material',
    required: true
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdsPlan',
    required: true
  },

  // Ad details
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  adType: {
    type: String,
    enum: ['DIGITAL', 'NON_DIGITAL'],
    required: true
  },
  adFormat: {
    type: String,
    required: true
  },
  mediaFile: {
    type: String,
    required: true
  },

  // Plan-related fields
  numberOfDevices: { type: Number, required: true },
  adLengthMinutes: { type: Number, required: true },
  playsPerDayPerDevice: { type: Number, required: true },
  totalPlaysPerDay: { type: Number, required: true },
  pricePerPlay: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
  price: { type: Number, required: true },
  durationType: {
    type: String,
    enum: ['WEEKLY', 'MONTHLY', 'YEARLY'],
    required: true
  },

  // Approval & tracking
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'RUNNING', 'ENDED'],
    default: 'PENDING',
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'],
    default: 'PENDING'
  },
  adStatus: {
    type: String,
    enum: ['INACTIVE', 'ACTIVE', 'FINISHED'],
    default: 'INACTIVE'
  },

  impressions: { type: Number, default: 0 },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  reasonForReject: { type: String, default: null },
  approveTime: { type: Date, default: null },
  rejectTime: { type: Date, default: null }
}, { timestamps: true });

/**
 * ✅ Pre-save validation: ensure referenced docs exist
 */
AdSchema.pre('save', async function (next) {
  try {
    const Material = mongoose.model('Material');
    const Plan = mongoose.model('AdsPlan');
    const User = mongoose.model('User');

    const [materialExists, planExists, userExists] = await Promise.all([
      Material.exists({ _id: this.materialId }),
      Plan.exists({ _id: this.planId }),
      User.exists({ _id: this.userId })
    ]);

    if (!materialExists) throw new Error('Material not found');
    if (!planExists) throw new Error('Plan not found');
    if (!userExists) throw new Error('User not found');

    next();
  } catch (err) {
    next(err);
  }
});

/**
 * ✅ Post-save auto-deployment logic
 */
AdSchema.post('save', async function (doc) {
  if (doc.adStatus === 'ACTIVE') {
    const Material = require('./Material');
    const AdsDeployment = require('./adsDeployment');

    try {
      const material = await Material.findById(doc.materialId);
      if (!material || !material.driverId) {
        console.error(`❌ Cannot deploy Ad ${doc._id}: no driver assigned to material`);
        return;
      }

      // Non-LCD ads → create new deployment directly
      if (!material.isLCD) {
        await AdsDeployment.create({
          adId: doc._id,
          materialId: material._id,
          driverId: material.driverId,
          startTime: doc.startTime,
          endTime: doc.endTime,
          deployedAt: new Date(),
          currentStatus: 'DEPLOYED'
        });
        console.log(`✅ Non-LCD Ad ${doc._id} deployed successfully`);
        return;
      }

      // LCD ads → use addToLCD method for single deployment doc
      const deployment = await AdsDeployment.addToLCD(
        material._id,
        material.driverId,
        doc._id,
        doc.startTime,
        doc.endTime
      );
      console.log(`✅ LCD Ad ${doc._id} added to deployment ${deployment.adDeploymentId}`);

    } catch (err) {
      console.error(`❌ Failed to deploy Ad ${doc._id}: ${err.message}`);
    }
  }
});

module.exports = mongoose.model('Ad', AdSchema);
