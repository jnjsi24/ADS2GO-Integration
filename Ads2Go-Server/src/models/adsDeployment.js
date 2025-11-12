// AdsDeployment.js

const mongoose = require('mongoose');

// Individual deployment slot schema for LCD materials
const LCDSlotSchema = new mongoose.Schema({
  adId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ad',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Optional until migration runs
    index: true
  },
  slotNumber: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['SCHEDULED', 'RUNNING', 'COMPLETED', 'PAUSED', 'CANCELLED', 'REMOVED'],
    default: 'SCHEDULED'
  },
  deployedAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  removedAt: {
    type: Date,
    default: null
  },
  removedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  lastFrameUpdate: {
    type: Date,
    default: null
  },
  removalReason: {
    type: String,
    default: null
  },
  mediaFile: {
    type: String,
    required: true
  }
}, { _id: true });

const AdsDeploymentSchema = new mongoose.Schema({
  adDeploymentId: {
    type: String,
    required: false,
    unique: true,
    trim: true
  },
  materialId: {
    type: String,
    required: true
  },
  driverId: {
    type: String,  // This matches the Material model's driverId format (e.g., 'DRV-002')
    required: true,
    index: true
  },

  // For LCD materials - store as array
  lcdSlots: {
    type: [LCDSlotSchema],
    default: []
  },

  // For non-LCD materials - single ad deployment
  // Note: adId is optional - deployments can exist with empty lcdSlots and no adId
  adId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ad',
    required: false
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Optional until migration runs
    index: true
  },

  // Deployment status and timing
  startTime: {
    type: Date,
    default: null
  },
  endTime: {
    type: Date,
    default: null
  },
  currentStatus: {
    type: String,
    enum: ['RUNNING'], // Deployments are always RUNNING (empty slots filled with company ads)
    default: 'RUNNING'
  },
  lastFrameUpdate: {
    type: Date,
    default: null
  },
  deployedAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  removedAt: {
    type: Date,
    default: null
  },
  removedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  removalReason: {
    type: String,
    default: null
  },
  
  // Soft delete / Archive fields (30-day deferred deletion)
  isArchived: {
    type: Boolean,
    default: false
  },
  archivedAt: {
    type: Date,
    default: null
  },
  scheduledDeletionDate: {
    type: Date,
    default: null
  }
}, { timestamps: true });

// Indexes for efficient queries
AdsDeploymentSchema.index({ adId: 1 });
AdsDeploymentSchema.index({ userId: 1 });
AdsDeploymentSchema.index({ driverId: 1 });
AdsDeploymentSchema.index({ materialId: 1 });
AdsDeploymentSchema.index({ 'lcdSlots.slotNumber': 1, materialId: 1 });
AdsDeploymentSchema.index({ 'lcdSlots.userId': 1 });
AdsDeploymentSchema.index({ materialId: 1, userId: 1 });
AdsDeploymentSchema.index({ isArchived: 1 }); // Archive filter for queries
AdsDeploymentSchema.index({ scheduledDeletionDate: 1 }); // For deletion cron job

// Generate unique deployment ID before saving
AdsDeploymentSchema.pre('save', function(next) {
  if (!this.adDeploymentId) {
    this.adDeploymentId = `ADM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  next();
});

// Static method to get LCD deployments with populated data
AdsDeploymentSchema.statics.getLCDDeployments = async function(materialId) {
  const deployment = await this.findOne({ 
    materialId,
    lcdSlots: { $exists: true, $ne: [] }
  })
  .populate('lcdSlots.adId')
  .populate('driverId');

  return deployment ? deployment.lcdSlots : [];
};

// Static method to get next available slot for LCD
AdsDeploymentSchema.statics.getNextAvailableSlot = async function(materialId, driverId) {
  const deployment = await this.findOne({
    materialId,
    driverId
  });

  if (!deployment || !deployment.lcdSlots.length) return 1;

  const activeSlots = deployment.lcdSlots
    .filter(slot => ['SCHEDULED', 'RUNNING'].includes(slot.status))
    .map(slot => slot.slotNumber);

  for (let slot = 1; slot <= 5; slot++) {
    if (!activeSlots.includes(slot)) {
      return slot;
    }
  }
  
  return null;
};

// Static method to create or get deployment for a material (without requiring an ad)
AdsDeploymentSchema.statics.createOrGetDeployment = async function(materialId, driverId) {
  try {
    if (!materialId || typeof materialId !== 'string') {
      throw new Error('Invalid materialId - must be a string');
    }
    if (!driverId) {
      throw new Error('driverId is required');
    }

    // Find existing deployment for this material
    let deployment = await this.findOne({ materialId });
    
    // If no deployment exists, create a new one with empty slots
    if (!deployment) {
      console.log(`ℹ️  Creating new deployment for material ${materialId} with driver ${driverId}`);
      deployment = new this({
        materialId,
        driverId,
        lcdSlots: [],
        currentStatus: 'RUNNING'
      });
      await deployment.save();
      console.log(`✅ Created deployment ${deployment.adDeploymentId || deployment._id} for material ${materialId}`);
    } else {
      // If deployment exists but has different driverId, update it
      if (deployment.driverId.toString() !== driverId.toString()) {
        console.log(`ℹ️  Updating driverId from ${deployment.driverId} to ${driverId} for material ${materialId}`);
        deployment.driverId = driverId;
        await deployment.save();
      }
    }
    
    return deployment;
  } catch (error) {
    console.error(`❌ Error in createOrGetDeployment: ${error.message}`, {
      materialId,
      driverId,
      error: error.stack
    });
    throw error;
  }
};

// Static method to add ad to HEADDRESS material (shared across tablet slots)
AdsDeploymentSchema.statics.addToHEADDRESS = async function(materialId, driverId, adId, startTime, endTime) {
  try {
    console.log(`🔄 Starting HEADDRESS deployment for ad ${adId} on material ${materialId}`);
    
    // Input validation
    if (!materialId || typeof materialId !== 'string') {
      throw new Error('Invalid materialId - must be a string');
    }
    if (!driverId) {
      throw new Error('driverId is required');
    }
    if (!mongoose.Types.ObjectId.isValid(adId)) {
      throw new Error('Invalid adId');
    }
    if (!startTime || !endTime) {
      throw new Error('startTime and endTime are required');
    }

    // Find existing deployment for this material (regardless of driver)
    let deployment = await this.findOne({ materialId });
    
    // If no deployment exists, create a new one
    if (!deployment) {
      console.log(`ℹ️  No existing deployment found, creating new one for material ${materialId}`);
      deployment = new this({
        materialId,
        driverId,
        lcdSlots: []
      });
    } else {
      // If deployment exists but has different driverId, update it
      if (deployment.driverId.toString() !== driverId.toString()) {
        console.log(`ℹ️  Updating driverId from ${deployment.driverId} to ${driverId} for material ${materialId}`);
        deployment.driverId = driverId;
      }
    }

    // Convert adId to string for comparison
    const adIdStr = adId.toString();
    
    // Check if the adId already exists in the current deployment
    const isAdAlreadyDeployed = deployment.lcdSlots.some(slot => {
      const slotAdId = slot.adId?.toString();
      return slotAdId === adIdStr;
    });
    
    if (isAdAlreadyDeployed) {
      throw new Error(`Ad ${adId} is already deployed on this HEADDRESS material.`);
    }

    // Check next available slot (1-5 limit still applies)
    const activeSlots = deployment.lcdSlots
      .filter(slot => ['SCHEDULED', 'RUNNING'].includes(slot.status))
      .map(slot => slot.slotNumber);

    console.log(`ℹ️  Active slots: ${activeSlots.join(', ') || 'none'}`);

    let nextSlot = null;
    for (let i = 1; i <= 5; i++) {
      if (!activeSlots.includes(i)) {
        nextSlot = i;
        break;
      }
    }
    
    if (!nextSlot) {
      throw new Error('All HEADDRESS slots (1-5) are currently occupied.');
    }

    console.log(`ℹ️  Next available slot: ${nextSlot}`);

    // Fetch the ad to get the mediaFile and userId
    const Ad = require('./Ad');
    const ad = await Ad.findById(adId);
    if (!ad) {
      throw new Error(`Ad ${adId} not found`);
    }

    // Create new ad slot (this slot number is just for tracking, both tablet slots will use this ad)
    const newSlot = {
      adId,
      userId: ad.userId,
      slotNumber: nextSlot,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      status: new Date(startTime) <= new Date() ? 'RUNNING' : 'SCHEDULED',
      deployedAt: new Date(startTime) <= new Date() ? new Date() : null,
      mediaFile: ad.mediaFile
    };
    
    console.log(`ℹ️  Creating new slot:`, newSlot);
    
    // Add the new slot
    deployment.lcdSlots.push(newSlot);

    // Save the deployment
    const savedDeployment = await deployment.save();
    
    // Create DeviceTracking record if it doesn't exist
    try {
      const DeviceTracking = require('./deviceTracking');
      let deviceTracking = await DeviceTracking.findByMaterialId(materialId);
      
      if (!deviceTracking) {
        console.log(`📊 Creating DeviceTracking record for material ${materialId} during ad deployment`);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // ✅ FIX: Use sentinel value for startTime since device is offline
        const farFuture = new Date('2099-12-31T23:59:59Z'); // Sentinel value - device hasn't come online yet
        
        deviceTracking = new DeviceTracking({
          materialId,
          carGroupId: driverId, // Use driverId as carGroupId for now
          screenType: 'HEADDRESS',
          date: today,
          isOnline: false, // Will be true when physical device connects
          lastSeen: new Date(),
          slots: [], // Will be populated when device connects
          currentSession: {
            date: today,
            startTime: farFuture,  // ✅ FIX: Use sentinel value - will be set when device comes online
            endTime: null,
            totalHoursOnline: 0,
            totalDistanceTraveled: 0,
            targetHours: 8,
            complianceStatus: 'PENDING',
            isActive: false, // Will be true when device connects
            locationHistory: [],
            lastOnlineUpdate: null  // ✅ FIX: Initialize to null
          }
        });
        
        await deviceTracking.save();
        console.log(`✅ Created DeviceTracking record for material ${materialId}`);
      } else {
        console.log(`ℹ️ DeviceTracking already exists for material ${materialId}`);
      }
    } catch (deviceTrackingError) {
      console.error(`⚠️ Warning: Could not create DeviceTracking for material ${materialId}:`, deviceTrackingError.message);
      // Don't fail the deployment if DeviceTracking creation fails
    }
    
    // Create UserAnalytics record if it doesn't exist
    try {
      const UserAnalytics = require('./userAnalytics');
      const Ad = require('./Ad');
      const User = require('./User');
      
      // Get the ad to find the userId
      const ad = await Ad.findById(adId);
      if (ad && ad.userId) {
        let userAnalytics = await UserAnalytics.findOne({ userId: ad.userId });
        
        if (!userAnalytics) {
          // Fetch user to get userName
          const user = await User.findById(ad.userId).select('firstName lastName').lean();
          const userName = user ? `${user.firstName} ${user.lastName}`.trim() : null;
          
          console.log(`📊 Creating UserAnalytics record for user ${ad.userId} during ad deployment`);
          
          userAnalytics = new UserAnalytics({
            userId: ad.userId,
            userName: userName,
            ads: [],
            totalAds: 0,
            totalDevices: 0,
            totalAdPlays: 0,
            totalAdPlayTime: 0,
            totalAdImpressions: 0,
            totalQRScans: 0,
            averageAdCompletionRate: 0,
            qrScanConversionRate: 0,
            adPerformance: [],
            materialBreakdown: [],
            errorLogs: [],
            isActive: true
          });
          
          await userAnalytics.save();
          console.log(`✅ Created UserAnalytics record for user ${ad.userId}${userName ? ` (${userName})` : ''}`);
        } else {
          // Update userName if it's missing
          if (!userAnalytics.userName) {
            const user = await User.findById(ad.userId).select('firstName lastName').lean();
            const userName = user ? `${user.firstName} ${user.lastName}`.trim() : null;
            if (userName) {
              userAnalytics.userName = userName;
              await userAnalytics.save();
            }
          }
          console.log(`ℹ️ UserAnalytics already exists for user ${ad.userId}`);
        }
      }
    } catch (userAnalyticsError) {
      console.error(`⚠️ Warning: Could not create UserAnalytics during deployment:`, userAnalyticsError.message);
      // Don't fail the deployment if UserAnalytics creation fails
    }
    
    console.log(`✅ Successfully added ad ${adId} to slot ${nextSlot} on HEADDRESS material ${materialId} (available to both tablet slots)`);
    return savedDeployment;
    
  } catch (error) {
    console.error(`❌ Error in addToHEADDRESS: ${error.message}`, {
      materialId,
      driverId,
      adId,
      startTime,
      endTime,
      error: error.stack
    });
    throw error; // Re-throw to be handled by the caller
  }
};

// Static method to add ad to LCD material (single deployment per LCD)
AdsDeploymentSchema.statics.addToLCD = async function(materialId, driverId, adId, startTime, endTime) {
  try {
    console.log(`🔄 Starting LCD deployment for ad ${adId} on material ${materialId}`);
    
    // Input validation
    if (!materialId || typeof materialId !== 'string') {
      throw new Error('Invalid materialId - must be a string');
    }
    // Driver ID can be either a string (like 'DRV-002') or ObjectId
    if (!driverId) {
      throw new Error('driverId is required');
    }
    if (!mongoose.Types.ObjectId.isValid(adId)) {
      throw new Error('Invalid adId');
    }
    if (!startTime || !endTime) {
      throw new Error('startTime and endTime are required');
    }

    // Find existing deployment for this material (regardless of driver)
    let deployment = await this.findOne({ materialId });
    
    // If no deployment exists, create a new one
    if (!deployment) {
      console.log(`ℹ️  No existing deployment found, creating new one for material ${materialId}`);
      deployment = new this({
        materialId,
        driverId,
        lcdSlots: []
      });
    } else {
      // If deployment exists but has different driverId, update it
      if (deployment.driverId.toString() !== driverId.toString()) {
        console.log(`ℹ️  Updating driverId from ${deployment.driverId} to ${driverId} for material ${materialId}`);
        deployment.driverId = driverId;
      }
    }

    // Convert adId to string for comparison
    const adIdStr = adId.toString();
    
    // Check if the adId already exists in the current deployment
    const isAdAlreadyDeployed = deployment.lcdSlots.some(slot => {
      const slotAdId = slot.adId?.toString();
      return slotAdId === adIdStr;
    });
    
    if (isAdAlreadyDeployed) {
      throw new Error(`Ad ${adId} is already deployed on this LCD material.`);
    }

    // Check next available slot
    const activeSlots = deployment.lcdSlots
      .filter(slot => ['SCHEDULED', 'RUNNING'].includes(slot.status))
      .map(slot => slot.slotNumber);

    console.log(`ℹ️  Active slots: ${activeSlots.join(', ') || 'none'}`);

    let nextSlot = null;
    for (let i = 1; i <= 5; i++) {
      if (!activeSlots.includes(i)) {
        nextSlot = i;
        break;
      }
    }
    
    if (!nextSlot) {
      throw new Error('All LCD slots (1-5) are currently occupied.');
    }

    console.log(`ℹ️  Next available slot: ${nextSlot}`);

    // Fetch the ad to get the mediaFile and userId
    const Ad = require('./Ad');
    const ad = await Ad.findById(adId);
    if (!ad) {
      throw new Error(`Ad ${adId} not found`);
    }

    // Create new ad slot
    const newSlot = {
      adId,
      userId: ad.userId,
      slotNumber: nextSlot,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      status: new Date(startTime) <= new Date() ? 'RUNNING' : 'SCHEDULED',
      deployedAt: new Date(startTime) <= new Date() ? new Date() : null,
      mediaFile: ad.mediaFile
    };
    
    console.log(`ℹ️  Creating new slot:`, newSlot);
    
    // Add the new slot
    deployment.lcdSlots.push(newSlot);

    // Save the deployment
    const savedDeployment = await deployment.save();
    
    // Create DeviceTracking record if it doesn't exist
    try {
      const DeviceTracking = require('./deviceTracking');
      let deviceTracking = await DeviceTracking.findByMaterialId(materialId);
      
      if (!deviceTracking) {
        console.log(`📊 Creating DeviceTracking record for material ${materialId} during LCD ad deployment`);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // ✅ FIX: Use sentinel value for startTime since device is offline
        const farFuture = new Date('2099-12-31T23:59:59Z'); // Sentinel value - device hasn't come online yet
        
        deviceTracking = new DeviceTracking({
          materialId,
          carGroupId: driverId, // Use driverId as carGroupId for now
          screenType: 'LCD',
          date: today,
          isOnline: false, // Will be true when physical device connects
          lastSeen: new Date(),
          slots: [], // Will be populated when device connects
          currentSession: {
            date: today,
            startTime: farFuture,  // ✅ FIX: Use sentinel value - will be set when device comes online
            endTime: null,
            totalHoursOnline: 0,
            totalDistanceTraveled: 0,
            targetHours: 8,
            complianceStatus: 'PENDING',
            isActive: false, // Will be true when device connects
            locationHistory: [],
            lastOnlineUpdate: null  // ✅ FIX: Initialize to null
          }
        });
        
        await deviceTracking.save();
        console.log(`✅ Created DeviceTracking record for LCD material ${materialId}`);
      } else {
        console.log(`ℹ️ DeviceTracking already exists for LCD material ${materialId}`);
      }
    } catch (deviceTrackingError) {
      console.error(`⚠️ Warning: Could not create DeviceTracking for LCD material ${materialId}:`, deviceTrackingError.message);
      // Don't fail the deployment if DeviceTracking creation fails
    }
    
    // Create UserAnalytics record if it doesn't exist
    try {
      const UserAnalytics = require('./userAnalytics');
      const Ad = require('./Ad');
      
      // Get the ad to find the userId
      const ad = await Ad.findById(adId);
      if (ad && ad.userId) {
        let userAnalytics = await UserAnalytics.findOne({ userId: ad.userId });
        
        if (!userAnalytics) {
          console.log(`📊 Creating UserAnalytics record for user ${ad.userId} during LCD ad deployment`);
          
          userAnalytics = new UserAnalytics({
            userId: ad.userId,
            ads: [],
            totalAds: 0,
            totalDevices: 0,
            totalAdPlays: 0,
            totalAdPlayTime: 0,
            totalAdImpressions: 0,
            totalQRScans: 0,
            averageAdCompletionRate: 0,
            qrScanConversionRate: 0,
            adPerformance: [],
            materialBreakdown: [],
            errorLogs: [],
            isActive: true
          });
          
          await userAnalytics.save();
          console.log(`✅ Created UserAnalytics record for user ${ad.userId}`);
        } else {
          console.log(`ℹ️ UserAnalytics already exists for user ${ad.userId}`);
        }
      }
    } catch (userAnalyticsError) {
      console.error(`⚠️ Warning: Could not create UserAnalytics during LCD deployment:`, userAnalyticsError.message);
      // Don't fail the deployment if UserAnalytics creation fails
    }
    
    console.log(`✅ Successfully added ad ${adId} to slot ${nextSlot} on material ${materialId}`);
    return savedDeployment;
    
  } catch (error) {
    console.error(`❌ Error in addToLCD: ${error.message}`, {
      materialId,
      driverId,
      adId,
      startTime,
      endTime,
      error: error.stack
    });
    throw error; // Re-throw to be handled by the caller
  }
};

// Static method to remove ads from LCD
AdsDeploymentSchema.statics.removeFromLCD = async function(materialId, adIds, removedBy, reason) {
  const deployment = await this.findOne({ materialId });
  if (!deployment) {
    throw new Error('No deployment found for this material');
  }

  const removedSlots = [];
  
  // Always completely remove slots from the array (never mark as REMOVED)
  deployment.lcdSlots = deployment.lcdSlots.filter(slot => {
    const shouldRemove = adIds.includes(slot.adId.toString()) && ['SCHEDULED', 'RUNNING'].includes(slot.status);
    if (shouldRemove) {
      removedSlots.push(slot);
    }
    return !shouldRemove; // Keep slots that shouldn't be removed
  });
  
  // Reassign slot numbers after removal to fill gaps
  if (removedSlots.length > 0) {
    // Get active slots and renumber them sequentially
    const activeSlots = deployment.lcdSlots
      .filter(slot => ['SCHEDULED', 'RUNNING'].includes(slot.status))
      .sort((a, b) => {
        const dateA = a.deployedAt || a.createdAt || new Date(0);
        const dateB = b.deployedAt || b.createdAt || new Date(0);
        return new Date(dateA) - new Date(dateB);
      });
    
    activeSlots.forEach((slot, index) => {
      slot.slotNumber = index + 1;
    });
  }

  await deployment.save();
  
  // Get available slots after removal
  const availableSlots = [];
  for (let i = 1; i <= 5; i++) {
    const occupied = deployment.lcdSlots.some(slot => 
      slot.slotNumber === i && ['SCHEDULED', 'RUNNING'].includes(slot.status)
    );
    if (!occupied) availableSlots.push(i);
  }

  return {
    success: true,
    message: `Successfully removed ${removedSlots.length} ads from LCD`,
    removedSlots,
    availableSlots
  };
};

// Static method to reassign LCD slots
AdsDeploymentSchema.statics.reassignLCDSlots = async function(materialId) {
  const deployment = await this.findOne({ materialId });
  if (!deployment) {
    throw new Error('No deployment found for this material');
  }

  const activeSlots = deployment.lcdSlots
    .filter(slot => ['SCHEDULED', 'RUNNING'].includes(slot.status))
    .sort((a, b) => new Date(a.deployedAt || a.createdAt) - new Date(b.deployedAt || b.createdAt));

  const updates = [];
  
  // Reassign slots sequentially
  activeSlots.forEach((slot, index) => {
    const newSlotNumber = index + 1;
    if (slot.slotNumber !== newSlotNumber) {
      updates.push({
        adId: slot.adId,
        oldSlot: slot.slotNumber,
        newSlot: newSlotNumber
      });
      slot.slotNumber = newSlotNumber;
    }
  });

  if (updates.length > 0) {
    await deployment.save();
  }

  return {
    success: true,
    message: `Reassigned ${updates.length} LCD slots`,
    updates
  };
};

/**
 * Post-save hook to sync deployments to DeviceTracking and create analytics records
 */
AdsDeploymentSchema.post('save', async function (doc) {
  // Skip if we're in a transaction to prevent conflicts
  if (this.$session) {
    console.log('Skipping analytics creation during transaction');
    return;
  }

  try {
    // ====== SYNC DEPLOYED ADS TO DEVICE TRACKING ======
    const DeviceTracking = require('./deviceTracking');
    
    // Sync deployedAds array to DeviceTracking
    if (doc.lcdSlots && doc.lcdSlots.length > 0) {
      const deployedAds = doc.lcdSlots.map(slot => ({
        adId: slot.adId.toString(),
        userId: slot.userId.toString(),
        adTitle: slot.adTitle || '',
        slotNumber: slot.slotNumber,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: slot.status,
        mediaFile: slot.mediaFile,
        deployedAt: slot.deployedAt,
        deploymentId: doc._id
      }));
      
      await DeviceTracking.updateOne(
        { materialId: doc.materialId },
        { 
          $set: { 
            deployedAds: deployedAds,
            currentDeploymentId: doc._id,
            lastDeploymentSync: new Date()
          }
        }
      );
      
      console.log(`✅ Synced ${deployedAds.length} ads to DeviceTracking for ${doc.materialId}`);
    }
    // ====== END SYNC ======
    
    // ⚠️ DEPRECATED: Analytics collection writes removed
    // Analytics data is now tracked via DeviceTracking/DeviceDataHistoryV2
    // Deployment data will be captured when devices connect and send tracking data
    console.log(`ℹ️ Deployment created: ${doc._id} (Analytics tracking via DeviceTracking/DeviceDataHistoryV2)`);
  } catch (error) {
    console.error(`❌ Error creating analytics for deployment ${doc._id}:`, error.message);
    // Don't throw error to prevent deployment failure
  }
});

// Safe export to prevent OverwriteModelError in nodemon
module.exports = mongoose.models.AdsDeployment || mongoose.model('AdsDeployment', AdsDeploymentSchema);