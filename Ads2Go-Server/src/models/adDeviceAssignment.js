const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * AdDeviceAssignment Schema
 * 
 * Tracks the history of device assignments for advertisements.
 * This allows us to:
 * 1. Show complete ad history across all device assignments
 * 2. Aggregate analytics from multiple devices the ad has been deployed on
 * 3. Provide audit trail for device changes
 * 
 * NOTE: This is part of the device reassignment analytics fix
 * @see DEVICE_REASSIGNMENT_FIX.md for implementation details
 */
const AdDeviceAssignmentSchema = new Schema({
  // Ad reference
  adId: {
    type: Schema.Types.ObjectId,
    ref: 'Ad',
    required: true,
    index: true
  },
  
  // User reference (for faster queries)
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Material (device) reference
  materialId: {
    type: Schema.Types.ObjectId,
    ref: 'Material',
    required: true,
    index: true
  },
  
  // Material ID string (for easy querying and matching with analytics data)
  materialIdString: {
    type: String,
    required: true,
    index: true
  },
  
  // Assignment timestamp
  assignedAt: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  
  // Unassignment timestamp (null if currently assigned)
  unassignedAt: {
    type: Date,
    default: null,
    index: true
  },
  
  // Type of assignment
  assignmentType: {
    type: String,
    enum: ['INITIAL', 'REASSIGNMENT', 'MANUAL', 'AUTO_ROTATION'],
    required: true,
    default: 'INITIAL'
  },
  
  // Admin who made the assignment (if manual)
  assignedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  
  // Reason for assignment/reassignment
  reason: {
    type: String,
    default: null
  },
  
  // Slot number assigned (1 or 2 for LCD, 1-5 for LED)
  slotNumber: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  },
  
  // Is this the current assignment?
  isCurrent: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true,  // Adds createdAt and updatedAt
  collection: 'addeviceassignments'
});

// Compound indexes for efficient queries
AdDeviceAssignmentSchema.index({ adId: 1, isCurrent: 1 });
AdDeviceAssignmentSchema.index({ userId: 1, materialIdString: 1 });
AdDeviceAssignmentSchema.index({ adId: 1, assignedAt: -1 });
AdDeviceAssignmentSchema.index({ userId: 1, isCurrent: 1 });

/**
 * Static method to create initial assignment when ad is created
 * @param {ObjectId} adId - Ad ID
 * @param {ObjectId} userId - User ID
 * @param {Array<Object>} materials - Array of material objects with _id and materialId
 * @returns {Promise<Array>} Created assignment documents
 */
AdDeviceAssignmentSchema.statics.createInitialAssignments = async function(adId, userId, materials) {
  try {
    const assignments = materials.map(material => ({
      adId,
      userId,
      materialId: material._id,
      materialIdString: material.materialId,
      assignedAt: new Date(),
      assignmentType: 'INITIAL',
      isCurrent: true
    }));
    
    return await this.insertMany(assignments);
  } catch (error) {
    console.error('❌ [AdDeviceAssignment] Error creating initial assignments:', error);
    throw error;
  }
};

/**
 * Static method to handle device reassignment
 * @param {ObjectId} adId - Ad ID
 * @param {ObjectId} userId - User ID
 * @param {Array<Object>} oldMaterials - Array of old material objects
 * @param {Array<Object>} newMaterials - Array of new material objects
 * @param {ObjectId} assignedBy - Admin ID who made the change
 * @param {String} reason - Reason for reassignment
 * @returns {Promise<Object>} Result with unassigned and assigned counts
 */
AdDeviceAssignmentSchema.statics.reassignDevices = async function(adId, userId, oldMaterials, newMaterials, assignedBy = null, reason = null) {
  try {
    const now = new Date();
    
    // 1. Mark old assignments as inactive
    const oldMaterialIds = oldMaterials.map(m => m._id);
    const unassignResult = await this.updateMany(
      {
        adId,
        materialId: { $in: oldMaterialIds },
        isCurrent: true
      },
      {
        $set: {
          unassignedAt: now,
          isCurrent: false
        }
      }
    );
    
    // 2. Create new assignments
    const newAssignments = newMaterials.map(material => ({
      adId,
      userId,
      materialId: material._id,
      materialIdString: material.materialId,
      assignedAt: now,
      assignmentType: 'REASSIGNMENT',
      assignedBy,
      reason,
      isCurrent: true
    }));
    
    const assignResult = await this.insertMany(newAssignments);
    
    console.log(`✅ [AdDeviceAssignment] Reassignment complete:`, {
      adId: adId.toString(),
      unassigned: unassignResult.modifiedCount,
      assigned: assignResult.length
    });
    
    return {
      unassigned: unassignResult.modifiedCount,
      assigned: assignResult.length
    };
  } catch (error) {
    console.error('❌ [AdDeviceAssignment] Error during reassignment:', error);
    throw error;
  }
};

/**
 * Static method to get all devices an ad has been on
 * @param {ObjectId} adId - Ad ID
 * @returns {Promise<Array>} Array of device assignments with date ranges
 */
AdDeviceAssignmentSchema.statics.getAdHistory = async function(adId) {
  try {
    const assignments = await this.find({ adId })
      .populate('materialId', 'materialId materialName materialType vehicleType')
      .sort({ assignedAt: -1 })
      .lean();
    
    return assignments.map(assignment => ({
      materialId: assignment.materialId?.materialId || assignment.materialIdString,
      materialName: assignment.materialId?.materialName || 'Unknown Device',
      materialType: assignment.materialId?.materialType,
      vehicleType: assignment.materialId?.vehicleType,
      assignedAt: assignment.assignedAt,
      unassignedAt: assignment.unassignedAt,
      duration: assignment.unassignedAt 
        ? Math.floor((assignment.unassignedAt - assignment.assignedAt) / (1000 * 60 * 60 * 24)) 
        : null, // days
      isCurrent: assignment.isCurrent,
      assignmentType: assignment.assignmentType
    }));
  } catch (error) {
    console.error('❌ [AdDeviceAssignment] Error getting ad history:', error);
    throw error;
  }
};

/**
 * Static method to get all material IDs (device IDs) an ad has been on
 * Useful for aggregating analytics across all devices
 * @param {ObjectId} adId - Ad ID
 * @returns {Promise<Array<String>>} Array of materialId strings
 */
AdDeviceAssignmentSchema.statics.getAllMaterialIdsForAd = async function(adId) {
  try {
    const assignments = await this.find({ adId }).distinct('materialIdString');
    return assignments;
  } catch (error) {
    console.error('❌ [AdDeviceAssignment] Error getting material IDs:', error);
    throw error;
  }
};

/**
 * Instance method to end this assignment
 * @param {ObjectId} adminId - Admin who is ending the assignment
 * @param {String} reason - Reason for ending
 * @returns {Promise<Document>} Updated document
 */
AdDeviceAssignmentSchema.methods.endAssignment = async function(adminId = null, reason = null) {
  this.unassignedAt = new Date();
  this.isCurrent = false;
  if (reason) {
    this.reason = reason;
  }
  return await this.save();
};

const AdDeviceAssignment = mongoose.model('AdDeviceAssignment', AdDeviceAssignmentSchema);

module.exports = AdDeviceAssignment;
