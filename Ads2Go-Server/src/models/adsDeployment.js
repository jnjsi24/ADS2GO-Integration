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
    enum: ['SCHEDULED', 'RUNNING', 'COMPLETED', 'PAUSED', 'CANCELLED'],
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
  }
}, { timestamps: true });

// Index for efficient queries
AdsDeploymentSchema.index({ adId: 1 });
AdsDeploymentSchema.index({ driverId: 1 });
AdsDeploymentSchema.index({ materialId: 1 });
AdsDeploymentSchema.index({ currentStatus: 1 });
AdsDeploymentSchema.index({ startTime: 1, endTime: 1 });

// Generate unique deployment ID before saving
AdsDeploymentSchema.pre('save', function(next) {
  if (!this.adDeploymentId) {
    this.adDeploymentId = `ADM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  next();
});

module.exports = mongoose.model('AdsDeployment', AdsDeploymentSchema);







// {
//   adDeploymentId: String,
//   materialId: ObjectId,   // link to Material
//   driverId: ObjectId,     // link to Driver
//   adId: ObjectId,         // link to Ad asset
//   startTime: Date,        // when it started showing
//   endTime: Date,          // when it should stop showing
//   currentStatus: String,  // RUNNING, SCHEDULED, COMPLETED
//   lastFrameUpdate: Date,  // for LCD only (real-time refresh timestamp)
// }