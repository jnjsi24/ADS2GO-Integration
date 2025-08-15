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
  removalReason: {
    type: String,
    default: null
  }
}, { _id: true });

const AdsDeploymentSchema = new mongoose.Schema({
  adDeploymentId: {
    type: String,
    required: false, // <-- changed from true to false
    unique: true,
    trim: true
  },
  materialId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Material',
    required: true
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    required: true
  },
  
  // For LCD materials - store as array
  lcdSlots: {
    type: [LCDSlotSchema],
    default: [],
    validate: {
      validator: function(slots) {
        // Ensure no duplicate slot numbers
        const slotNumbers = slots.map(slot => slot.slotNumber);
        return slotNumbers.length === new Set(slotNumbers).size;
      },
      message: 'Duplicate slot numbers are not allowed'
    }
  },
  
  // For non-LCD materials - single ad deployment
  adId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ad',
    required: function() {
      return this.lcdSlots.length === 0; // Required only if no LCD slots
    }
  },
  
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  currentStatus: {
    type: String,
    enum: ['SCHEDULED', 'RUNNING', 'PAID', 'COMPLETED', 'PAUSED', 'CANCELLED', 'REMOVED'],
    default: 'SCHEDULED',
    required: true
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
  }
}, { timestamps: true });

// Indexes for efficient queries
AdsDeploymentSchema.index({ adId: 1 });
AdsDeploymentSchema.index({ driverId: 1 });
AdsDeploymentSchema.index({ materialId: 1 });
AdsDeploymentSchema.index({ currentStatus: 1 });
AdsDeploymentSchema.index({ startTime: 1, endTime: 1 });
AdsDeploymentSchema.index({ materialId: 1, currentStatus: 1 });
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
AdsDeploymentSchema.statics.getNextAvailableSlot = async function(materialId) {
  const deployment = await this.findOne({
    materialId,
    lcdSlots: { $exists: true, $ne: [] }
  });

  if (!deployment) return 1; // First slot if no deployment exists

  const activeSlots = deployment.lcdSlots
    .filter(slot => ['SCHEDULED', 'RUNNING'].includes(slot.status))
    .map(slot => slot.slotNumber);

  for (let slot = 1; slot <= 5; slot++) {
    if (!activeSlots.includes(slot)) {
      return slot;
    }
  }
  
  return null; // All slots occupied
};

// Static method to add ad to LCD material
AdsDeploymentSchema.statics.addToLCD = async function(materialId, driverId, adId, startTime, endTime) {
  // Check if payment exists and is paid
  const Payment = mongoose.model('Payment');
  // REMOVE or COMMENT OUT this payment check
  // const payment = await Payment.findOne({ adsId: adId, paymentStatus: 'PAID' });
  // if (!payment) {
  //     throw new Error('Payment required before deployment. Ad must be paid first.');
  // }

  // Get next available slot
  const nextSlot = await this.getNextAvailableSlot(materialId);
  if (!nextSlot) {
    throw new Error('All LCD slots (1-5) are occupied. Use override function to remove ads first.');
  }

  // Find or create deployment for this material-driver combination
  let deployment = await this.findOne({ materialId, driverId });
  
  if (!deployment) {
    deployment = new this({
      materialId,
      driverId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      currentStatus: 'SCHEDULED',
      lcdSlots: []
    });
  }

  // Add new slot
  const newSlot = {
    adId,
    slotNumber: nextSlot,
    status: new Date(startTime) <= new Date() ? 'RUNNING' : 'SCHEDULED',
    deployedAt: new Date(startTime) <= new Date() ? new Date() : null
  };

  deployment.lcdSlots.push(newSlot);
  
  // Update overall deployment status
  if (deployment.lcdSlots.some(slot => slot.status === 'RUNNING')) {
    deployment.currentStatus = 'RUNNING';
  }

  await deployment.save();
  return deployment;
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

module.exports = mongoose.model('AdsDeployment', AdsDeploymentSchema);
