// Ad.js

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

  // Tracking fields
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'RUNNING', 'ENDED'],
    default: 'PENDING',
    required: true
  },

  // ✅ New fields
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

// Optional: pre-save hook to validate existence of referenced documents
AdSchema.pre('save', async function(next) {
  const Material = mongoose.model('Material');
  const Plan = mongoose.model('AdsPlan');
  const User = mongoose.model('User');

  const materialExists = await Material.exists({ _id: this.materialId });
  if (!materialExists) throw new Error('Material not found');

  const planExists = await Plan.exists({ _id: this.planId });
  if (!planExists) throw new Error('Plan not found');

  const userExists = await User.exists({ _id: this.userId });
  if (!userExists) throw new Error('User not found');

  next();
});

// ✅ Auto-deploy hook when ad becomes ACTIVE
AdSchema.post('save', async function (doc) {
  if (doc.adStatus === 'ACTIVE') {
    const Material = require('./Material');
    const AdsDeployment = require('./adsDeployment');

    const material = await Material.findById(doc.materialId);
    if (!material || !material.driverId) {
      console.error(`❌ Cannot deploy Ad ${doc._id}: no driver assigned to material`);
      return;
    }

    // If material is NON-LCD, keep old flow
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

    // ✅ For LCD, use addToLCD to ensure a single deployment document
    try {
      const deployment = await AdsDeployment.addToLCD(
        material._id,
        material.driverId,
        doc._id,
        doc.startTime,
        doc.endTime
      );
      console.log(`✅ LCD Ad ${doc._id} added to deployment ${deployment.adDeploymentId}`);
    } catch (err) {
      console.error(`❌ Failed to deploy LCD Ad ${doc._id}: ${err.message}`);
    }
  }
});

module.exports = mongoose.model('Ad', AdSchema);

