const mongoose = require('mongoose');

const MaterialUsageHistorySchema = new mongoose.Schema({
  materialId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Material',
    required: true,
    index: true
  },
  driverId: {
    type: String, // Store as system driverId (e.g., DRV-001)
    required: true,
    index: true
  },
  driverInfo: {
    driverId: String,
    fullName: String,
    email: String,
    contactNumber: String,
    vehiclePlateNumber: String
  },
  assignedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  unassignedAt: {
    type: Date,
    default: null
  },
  mountedAt: {
    type: Date,
    default: null
  },
  dismountedAt: {
    type: Date,
    default: null
  },
  usageDuration: {
    type: Number, // in days
    default: null
  },
  assignmentReason: {
    type: String,
    enum: ['INITIAL_ASSIGNMENT', 'REASSIGNMENT', 'MANUAL_ASSIGNMENT'],
    default: 'INITIAL_ASSIGNMENT'
  },
  unassignmentReason: {
    type: String,
    enum: ['DRIVER_LEAVE', 'MATERIAL_DAMAGE', 'REASSIGNMENT', 'MANUAL_REMOVAL', 'SYSTEM_UPDATE', 'CUSTOM'],
    default: null
  },
  customDismountReason: {
    type: String,
    trim: true
  },
  assignedByAdmin: {
    adminId: String,
    adminName: String,
    adminEmail: String
  },
  unassignedByAdmin: {
    adminId: String,
    adminName: String,
    adminEmail: String
  },
  notes: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
MaterialUsageHistorySchema.index({ materialId: 1, assignedAt: -1 });
MaterialUsageHistorySchema.index({ driverId: 1, assignedAt: -1 });
MaterialUsageHistorySchema.index({ assignedAt: -1 });
MaterialUsageHistorySchema.index({ isActive: 1 });

// Virtual to calculate usage duration
MaterialUsageHistorySchema.virtual('calculatedUsageDuration').get(function() {
  if (this.assignedAt && this.unassignedAt) {
    const diffTime = Math.abs(this.unassignedAt - this.assignedAt);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Convert to days
  }
  return null;
});

// Static method to create a usage history entry
MaterialUsageHistorySchema.statics.createUsageEntry = async function(materialId, driverId, driverInfo, assignmentReason = 'INITIAL_ASSIGNMENT', assignedByAdmin = null) {
  const usageEntry = new this({
    materialId,
    driverId,
    driverInfo,
    assignmentReason,
    assignedByAdmin
    // mountedAt will be set when the material is actually mounted
  });
  
  return await usageEntry.save();
};

// Static method to end a usage entry
MaterialUsageHistorySchema.statics.endUsageEntry = async function(materialId, driverId, unassignmentReason = 'REASSIGNMENT', notes = '', dismountedDate = null, customDismountReason = null, unassignedByAdmin = null) {
  const usageEntry = await this.findOne({
    materialId,
    driverId,
    isActive: true
  });
  
  if (usageEntry) {
    usageEntry.unassignedAt = new Date();
    // Use the provided dismounted date or the current date if not provided
    usageEntry.dismountedAt = dismountedDate || new Date();
    usageEntry.unassignmentReason = unassignmentReason;
    usageEntry.customDismountReason = customDismountReason;
    usageEntry.unassignedByAdmin = unassignedByAdmin;
    usageEntry.notes = notes;
    usageEntry.isActive = false;
    usageEntry.usageDuration = usageEntry.calculatedUsageDuration;
    
    return await usageEntry.save();
  }
  
  return null;
};

// Static method to get usage history for a material
MaterialUsageHistorySchema.statics.getMaterialUsageHistory = async function(materialId) {
  const records = await this.find({ materialId })
    .sort({ assignedAt: -1 })
    .lean();
  
  // Ensure proper ID conversion for GraphQL
  return records.map(record => ({
    ...record,
    id: record._id.toString()
  }));
};

// Static method to get usage history for a driver
MaterialUsageHistorySchema.statics.getDriverUsageHistory = async function(driverId) {
  const records = await this.find({ driverId })
    .populate('materialId', 'materialId materialType vehicleType category')
    .sort({ assignedAt: -1 })
    .lean();
  
  // Ensure proper ID conversion for GraphQL
  return records.map(record => ({
    ...record,
    id: record._id.toString()
  }));
};

module.exports = mongoose.models.MaterialUsageHistory || mongoose.model('MaterialUsageHistory', MaterialUsageHistorySchema);
