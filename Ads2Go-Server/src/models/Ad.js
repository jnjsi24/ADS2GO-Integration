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
    required: false,
    default: null
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
  website: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Allow empty website
        return /^https?:\/\/.+/.test(v); // Must be a valid URL if provided
      },
      message: 'Website must be a valid URL starting with http:// or https://'
    }
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
  targetDevices: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Material' 
  }], // Array of device IDs where this ad should be deployed
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
  lastDeploymentAttempt: { type: Date, default: null },

  // Flexible ad fields
  materialType: { type: String },
  vehicleType: { type: String },
  category: { type: String }
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
      this.planId ? Plan.exists({ _id: this.planId }) : true, // Allow null planId for flexible ads
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
  // Skip deployment if we're in a transaction to prevent conflicts
  if (this.$session) {
    console.log('Skipping ad post-save deployment hook during transaction');
    return;
  }

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
      
      // Get target devices for deployment
      let targetMaterials = [];
      
      if (doc.targetDevices && doc.targetDevices.length > 0) {
        // Multi-device ad: deploy to all target devices
        console.log(`🔄 Deploying multi-device Ad ${doc._id} to ${doc.targetDevices.length} devices`);
        targetMaterials = await Material.find({ _id: { $in: doc.targetDevices } });
      } else {
        // Single device ad: deploy to primary material
        const material = await Material.findById(doc.materialId);
        if (!material) {
          console.error(`❌ Cannot deploy Ad ${doc._id}: Material not found`);
          return;
        }
        targetMaterials = [material];
      }
      
      if (targetMaterials.length === 0) {
        console.error(`❌ Cannot deploy Ad ${doc._id}: No target materials found`);
        return;
      }

      // Deploy to each target device
      let deploymentSuccess = true;
      const deploymentResults = [];
      
      for (const material of targetMaterials) {
        if (!material.driverId) {
          console.error(`❌ Cannot deploy Ad ${doc._id} to ${material.materialId}: No driver assigned`);
          deploymentSuccess = false;
          continue;
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
            
            console.log(`✅ HEADDRESS Ad ${doc._id} added to deployment ${deployment.adDeploymentId || deployment._id} for device ${material.materialId}`);
            deploymentResults.push({
              materialId: material.materialId,
              success: true,
              deploymentId: deployment.adDeploymentId || deployment._id
            });
          } catch (error) {
            console.error(`❌ Error deploying HEADDRESS Ad ${doc._id} to ${material.materialId}:`, error.message);
            deploymentSuccess = false;
            deploymentResults.push({
              materialId: material.materialId,
              success: false,
              error: error.message
            });
          }
        } else if (material.materialType === 'LCD') {
          // LCD ads → use addToLCD method
          console.log(`🔄 Deploying LCD Ad ${doc._id} to material ${material.materialId}`);
          try {
            const deployment = await AdsDeployment.addToLCD(
              material.materialId,
              material.driverId,
              doc._id,
              doc.startTime,
              doc.endTime
            );
            
            if (!deployment) {
              throw new Error('Deployment returned null');
            }
            
            console.log(`✅ LCD Ad ${doc._id} added to deployment ${deployment.adDeploymentId || deployment._id} for device ${material.materialId}`);
            deploymentResults.push({
              materialId: material.materialId,
              success: true,
              deploymentId: deployment.adDeploymentId || deployment._id
            });
          } catch (error) {
            console.error(`❌ Error deploying LCD Ad ${doc._id} to ${material.materialId}:`, error.message);
            deploymentSuccess = false;
            deploymentResults.push({
              materialId: material.materialId,
              success: false,
              error: error.message
            });
          }
        }
      }
      
      // Mark deployment status based on results
      if (deploymentSuccess) {
        await Ad.findByIdAndUpdate(doc._id, { 
          deploymentStatus: 'DEPLOYED',
          lastDeploymentAttempt: new Date()
        });
        console.log(`✅ Multi-device Ad ${doc._id} deployed successfully to ${deploymentResults.filter(r => r.success).length}/${targetMaterials.length} devices`);
      } else {
        await Ad.findByIdAndUpdate(doc._id, { 
          deploymentStatus: 'FAILED',
          lastDeploymentAttempt: new Date()
        });
        console.log(`❌ Multi-device Ad ${doc._id} deployment failed for some devices`);
        return;
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
