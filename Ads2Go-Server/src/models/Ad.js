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
  userDesiredStartTime: { type: Date, default: null }, // User's desired start time (7 days after admin review)
  reasonForReject: { type: String, default: null },
  approveTime: { type: Date, default: null },
  rejectTime: { type: Date, default: null },
  
  // Deployment tracking
  deploymentStatus: { 
    type: String, 
    enum: ['PENDING', 'DEPLOYING', 'DEPLOYED', 'FAILED'], 
    default: 'PENDING' 
  },
  deploymentAttempts: { type: Number, default: 0 },
  lastDeploymentAttempt: { type: Date, default: null }
}, { timestamps: true });

/**
 * Pre-validate: business validations that are not covered by simple schema types
 */
AdSchema.pre('validate', function (next) {
  try {
    // Validate media file extension (simple whitelist based on URL/filename)
    if (this.mediaFile) {
      const allowed = ['jpg', 'jpeg', 'png', 'mp4', 'mov', 'webm', 'avi'];
      const match = String(this.mediaFile).toLowerCase().match(/\.([a-z0-9]+)(?:\?|#|$)/);
      const ext = match ? match[1] : '';
      if (!allowed.includes(ext)) {
        return next(new Error('Unsupported media file type. Allowed: JPG, JPEG, PNG, MP4, MOV, WEBM, AVI'));
      }
    }

    // Validate start and end times only if startTime was modified
    if (this.startTime && this.endTime && this.isModified('startTime')) {
      const now = new Date();
      const end = new Date(this.endTime);
      
      // Get today's date in UTC to avoid timezone issues
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      
      // Use startTime for validation (no 7-day buffer, so startTime = userDesiredStartTime)
      const start = new Date(this.startTime);
      const startDate = new Date(start);
      startDate.setUTCHours(0, 0, 0, 0);

      console.log('Date validation (startTime modified):', {
        now: now.toISOString(),
        today: today.toISOString(),
        startTime: this.startTime ? new Date(this.startTime).toISOString() : 'null',
        userDesiredStartTime: this.userDesiredStartTime ? new Date(this.userDesiredStartTime).toISOString() : 'null',
        start: start.toISOString(),
        startDate: startDate.toISOString(),
        end: end.toISOString(),
        startDateLessThanToday: startDate < today,
        isModified: this.isModified('startTime')
      });

      if (startDate < today) {
        return next(new Error('Start time must be today or later'));
      }
      if (end <= start) {
        return next(new Error('End time must be after start time'));
      }
    } else if (this.startTime && this.endTime) {
      console.log('Date validation skipped (startTime not modified):', {
        isModified: this.isModified('startTime'),
        startTime: this.startTime ? new Date(this.startTime).toISOString() : 'null'
      });
    }

    next();
  } catch (e) {
    next(e);
  }
});

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
      
      // Check deployment status to prevent race conditions
      if (doc.deploymentStatus === 'DEPLOYING' || doc.deploymentStatus === 'DEPLOYED') {
        console.log(`ℹ️ Ad ${doc._id} deployment already in progress or completed (status: ${doc.deploymentStatus}), skipping`);
        return;
      }
      
      // Check if this ad is already deployed to prevent duplicate deployments
      const existingDeployment = await AdsDeployment.findOne({
        $or: [
          { 'lcdSlots.adId': doc._id },
          { 'headressSlots.adId': doc._id }
        ]
      });
      
      if (existingDeployment) {
        console.log(`ℹ️ Ad ${doc._id} is already deployed, updating status to DEPLOYED`);
        await Ad.findByIdAndUpdate(doc._id, { 
          deploymentStatus: 'DEPLOYED',
          lastDeploymentAttempt: new Date()
        });
        return;
      }
      
      // Mark as deploying to prevent race conditions
      await Ad.findByIdAndUpdate(doc._id, { 
        deploymentStatus: 'DEPLOYING',
        deploymentAttempts: (doc.deploymentAttempts || 0) + 1,
        lastDeploymentAttempt: new Date()
      });
      
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
          
          // Mark deployment as successful
          await Ad.findByIdAndUpdate(doc._id, { 
            deploymentStatus: 'DEPLOYED',
            lastDeploymentAttempt: new Date()
          });
        } catch (error) {
          console.error(`❌ Error deploying HEADDRESS Ad ${doc._id}:`, error.message);
          // Mark deployment as failed
          await Ad.findByIdAndUpdate(doc._id, { 
            deploymentStatus: 'FAILED',
            lastDeploymentAttempt: new Date()
          });
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
          
          // Mark deployment as successful
          await Ad.findByIdAndUpdate(doc._id, { 
            deploymentStatus: 'DEPLOYED',
            lastDeploymentAttempt: new Date()
          });
        } catch (error) {
          console.error(`❌ Error deploying LCD Ad ${doc._id}:`, error.message);
          // Mark deployment as failed
          await Ad.findByIdAndUpdate(doc._id, { 
            deploymentStatus: 'FAILED',
            lastDeploymentAttempt: new Date()
          });
        }
        return;
      }
      
      // Standard non-LCD ads → create new deployment directly
      console.log(`🔄 Deploying non-LCD Ad ${doc._id}`);
      try {
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
        
        // Mark deployment as successful
        await Ad.findByIdAndUpdate(doc._id, { 
          deploymentStatus: 'DEPLOYED',
          lastDeploymentAttempt: new Date()
        });
      } catch (error) {
        console.error(`❌ Error deploying non-LCD Ad ${doc._id}:`, error.message);
        // Mark deployment as failed
        await Ad.findByIdAndUpdate(doc._id, { 
          deploymentStatus: 'FAILED',
          lastDeploymentAttempt: new Date()
        });
      }

    } catch (err) {
      console.error(`❌ Failed to deploy Ad ${doc._id}: ${err.message}`);
      // Mark deployment as failed
      await Ad.findByIdAndUpdate(doc._id, { 
        deploymentStatus: 'FAILED',
        lastDeploymentAttempt: new Date()
      });
    }
  }
});

module.exports = mongoose.model('Ad', AdSchema);
