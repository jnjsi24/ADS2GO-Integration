// AdsDeployment.js

const mongoose = require('mongoose');

const AdsDeploymentSchema = new mongoose.Schema({
  adDeploymentId: {
    type: String,
    required: true,
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
  adId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ad',
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
  currentStatus: {
    type: String,
    enum: ['SCHEDULED', 'RUNNING','PAID', 'COMPLETED', 'PAUSED', 'CANCELLED', 'REMOVED'],
    default: 'SCHEDULED',
    required: true
  },
  lastFrameUpdate: {
    type: Date,
    default: null // Only for LCD materials with real-time refresh
  },
  deployedAt: {
    type: Date,
    default: null // When the deployment actually started
  },
  completedAt: {
    type: Date,
    default: null // When the deployment was completed
  },
  removedAt: {
    type: Date,
    default: null // When the deployment was removed by admin override
  },
  removedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // Admin who removed this deployment
  },
  removalReason: {
    type: String,
    default: null // Reason for removal
  },
  displaySlot: {
    type: Number,
    min: 1,
    max: 5,
    default: null // For LCD materials, which slot (1-5) this ad occupies
  }
}, { timestamps: true });

// Index for efficient queries
AdsDeploymentSchema.index({ adId: 1 });
AdsDeploymentSchema.index({ driverId: 1 });
AdsDeploymentSchema.index({ materialId: 1 });
AdsDeploymentSchema.index({ currentStatus: 1 });
AdsDeploymentSchema.index({ startTime: 1, endTime: 1 });
AdsDeploymentSchema.index({ materialId: 1, currentStatus: 1 });
AdsDeploymentSchema.index({ materialId: 1, displaySlot: 1 });

// Generate unique deployment ID before saving
AdsDeploymentSchema.pre('save', function(next) {
  if (!this.adDeploymentId) {
    this.adDeploymentId = `ADM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  next();
});

// Static method to get LCD deployments with slot management
AdsDeploymentSchema.statics.getLCDDeployments = async function(materialId) {
  return await this.find({ 
    materialId,
    currentStatus: { $in: ['SCHEDULED', 'RUNNING'] },
    displaySlot: { $ne: null }
  })
  .populate('adId')
  .populate('driverId')
  .sort({ displaySlot: 1 });
};

// Static method to get next available slot for LCD
AdsDeploymentSchema.statics.getNextAvailableSlot = async function(materialId) {
  const activeDeployments = await this.find({
    materialId,
    currentStatus: { $in: ['SCHEDULED', 'RUNNING'] },
    displaySlot: { $ne: null }
  }).select('displaySlot');

  const occupiedSlots = activeDeployments.map(d => d.displaySlot);
  
  for (let slot = 1; slot <= 5; slot++) {
    if (!occupiedSlots.includes(slot)) {
      return slot;
    }
  }
  
  return null; // All slots occupied
};

module.exports = mongoose.model('AdsDeployment', AdsDeploymentSchema);