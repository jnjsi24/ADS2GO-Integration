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
    enum: ['VIDEO', 'IMAGE'], // define formats your backend supports
    required: true
  },
  mediaFile: {
    type: String,
    required: true
  },

  // Plan-related fields
  numberOfDevices: { type: Number, required: true },
  adLengthSeconds: { type: Number, required: true },
  playsPerDayPerDevice: { type: Number, required: true },
  totalPlaysPerDay: { type: Number, required: true },
  pricePerPlay: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
  price: { type: Number, required: true }, // total ad price
  durationDays: { type: Number, required: true },

  // Approval & tracking
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'RUNNING', 'ENDED'],
    default: 'PENDING',
    required: true
  },
  adStatus: {
    type: String,
    enum: ['INACTIVE', 'ACTIVE', 'FINISHED'], // internal deployment tracking
    default: 'INACTIVE'
  },
  paymentStatus: {
    type: String,
    enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'],
    default: 'PENDING'
  },

  impressions: { type: Number, default: 0 },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true }, // calculated based on startTime + plan duration
  reasonForReject: { type: String, default: null },
  approveTime: { type: Date, default: null },
  rejectTime: { type: Date, default: null }
}, { timestamps: true });

/**
 * Pre-save validation: ensure referenced docs exist
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
 * Post-save auto-deployment logic
 */
AdSchema.post('save', async function (doc) {
  if (doc.adStatus === 'ACTIVE' && doc.paymentStatus === 'PAID') {
    const Material = require('./Material');
    const AdsDeployment = require('./adsDeployment');

    try {
      console.log(`🔄 Starting deployment for Ad ${doc._id}`);
      
      const material = await Material.findById(doc.materialId);
      if (!material) {
        console.error(`❌ Cannot deploy Ad ${doc._id}: Material not found`);
        return;
      }
      
      if (!material.driverId) {
        console.error(`❌ Cannot deploy Ad ${doc._id}: No driver assigned to material`);
        return;
      }

      // Determine deployment method based on material type
      if (material.materialType === 'HEADDRESS') {
        // HEADDRESS ads → use addToHEADDRESS method (shared across tablet slots)
        console.log(`🔄 Deploying HEADDRESS Ad ${doc._id} to material ${material.materialId}`);
        try {
          const deployment = await AdsDeployment.addToHEADDRESS(
            material.materialId, // Use string materialId, not ObjectId _id
            material.driverId,
            doc._id,
            doc.startTime,
            doc.endTime
          );
          
          if (!deployment) {
            throw new Error('Deployment returned null');
          }
          
          console.log(`✅ HEADDRESS Ad ${doc._id} added to deployment ${deployment.adDeploymentId || deployment._id}`);
          console.log(`📋 Deployment details:`, {
            materialId: deployment.materialId,
            driverId: deployment.driverId,
            lcdSlotsCount: deployment.lcdSlots.length,
            slots: deployment.lcdSlots.map(s => ({
              slotNumber: s.slotNumber,
              adId: s.adId,
              status: s.status
            }))
          });
        } catch (error) {
          console.error(`❌ Error deploying HEADDRESS Ad ${doc._id}:`, error.message);
        }
        return;
      }
      
      if (material.materialType === 'LCD') {
        // LCD ads → use addToLCD method for single deployment doc
        console.log(`🔄 Deploying LCD Ad ${doc._id} to material ${material.materialId}`);
        try {
          const deployment = await AdsDeployment.addToLCD(
            material.materialId, // Use string materialId, not ObjectId _id
            material.driverId,
            doc._id,
            doc.startTime,
            doc.endTime
          );
        
          if (!deployment) {
            throw new Error('Deployment returned null');
          }
          
          console.log(`✅ LCD Ad ${doc._id} added to deployment ${deployment.adDeploymentId || deployment._id}`);
          console.log(`📋 Deployment details:`, {
            materialId: deployment.materialId,
            driverId: deployment.driverId,
            lcdSlotsCount: deployment.lcdSlots.length,
            slots: deployment.lcdSlots.map(s => ({
              slotNumber: s.slotNumber,
              adId: s.adId,
              status: s.status
            }))
          });
        } catch (error) {
          console.error(`❌ Error deploying LCD Ad ${doc._id}:`, error.message);
        }
        return;
      }
      
      // Standard non-LCD ads → create new deployment directly
      console.log(`🔄 Deploying non-LCD Ad ${doc._id}`);
      await AdsDeployment.create({
        adId: doc._id,
        materialId: material.materialId, // Use string materialId, not ObjectId _id
        driverId: material.driverId,
        startTime: doc.startTime,
        endTime: doc.endTime,
        deployedAt: new Date(),
        currentStatus: 'DEPLOYED'
      });
      console.log(`✅ Non-LCD Ad ${doc._id} deployed successfully`);

    } catch (err) {
      console.error(`❌ Failed to deploy Ad ${doc._id}: ${err.message}`);
    }
  }
});

module.exports = mongoose.model('Ad', AdSchema);
