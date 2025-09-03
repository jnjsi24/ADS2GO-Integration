// AdsDeployment.js

const mongoose = require('mongoose');

// Individual deployment slot schema for LCD materials
const LCDSlotSchema = new mongoose.Schema({
  adId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ad',
    required: true
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
  adId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ad',
    required: function() {
      return this.lcdSlots.length === 0;
    }
  },
}, { timestamps: true });

// Indexes for efficient queries
AdsDeploymentSchema.index({ adId: 1 });
AdsDeploymentSchema.index({ driverId: 1 });
AdsDeploymentSchema.index({ materialId: 1 });
AdsDeploymentSchema.index({ 'lcdSlots.slotNumber': 1, materialId: 1 });

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
  .populate({
    path: 'lcdSlots.adId',
    populate: {
      path: 'planId',
      model: 'AdsPlan'
    }
  })
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

    // Find existing deployment for this material-driver
    let deployment = await this.findOne({ materialId, driverId });
    
    // If no deployment exists, create a new one
    if (!deployment) {
      console.log(`ℹ️  No existing deployment found, creating new one for material ${materialId}`);
      deployment = new this({
        materialId,
        driverId,
        lcdSlots: []
      });
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

    // Fetch the ad to get the mediaFile
    const Ad = require('./Ad');
    const ad = await Ad.findById(adId);
    if (!ad) {
      throw new Error(`Ad ${adId} not found`);
    }

    // Create new ad slot (this slot number is just for tracking, both tablet slots will use this ad)
    const newSlot = {
      adId,
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

    // Find existing deployment for this material-driver
    let deployment = await this.findOne({ materialId, driverId });
    
    // If no deployment exists, create a new one
    if (!deployment) {
      console.log(`ℹ️  No existing deployment found, creating new one for material ${materialId}`);
      deployment = new this({
        materialId,
        driverId,
        lcdSlots: []
      });
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

    // Fetch the ad to get the mediaFile
    const Ad = require('./Ad');
    const ad = await Ad.findById(adId);
    if (!ad) {
      throw new Error(`Ad ${adId} not found`);
    }

    // Create new ad slot
    const newSlot = {
      adId,
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
  
  // Mark specified ads as removed
  deployment.lcdSlots.forEach(slot => {
    if (adIds.includes(slot.adId.toString()) && ['SCHEDULED', 'RUNNING'].includes(slot.status)) {
      slot.status = 'REMOVED';
      slot.removedAt = new Date();
      slot.removedBy = removedBy;
      slot.removalReason = reason || 'Admin override';
      removedSlots.push(slot);
    }
  });

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

// Safe export to prevent OverwriteModelError in nodemon
module.exports = mongoose.models.AdsDeployment || mongoose.model('AdsDeployment', AdsDeploymentSchema);