const mongoose = require('mongoose');
const MaterialAvailability = require('../models/MaterialAvailability');
const Material = require('../models/Material');
const Ad = require('../models/Ad');

class MaterialAvailabilityService {
  
  /**
   * Initialize availability tracking for a material
   */
  static async initializeMaterialAvailability(materialId) {
    try {
      const existing = await MaterialAvailability.findOne({ materialId });
      if (existing) return existing;
      
      const availability = new MaterialAvailability({
        materialId,
        totalSlots: 5,
        occupiedSlots: 0,
        availableSlots: 5,
        nextAvailableDate: new Date(),
        allSlotsFreeDate: new Date(),
        status: 'AVAILABLE'
      });
      
      return await availability.save();
    } catch (error) {
      console.error('Error initializing material availability:', error);
      throw error;
    }
  }
  
  /**
   * Get availability for multiple materials
   */
  static async getMaterialsAvailability(materialIds) {
    try {
      const availabilities = await MaterialAvailability.find({ 
        materialId: { $in: materialIds } 
      }).populate('materialId', 'materialId materialType vehicleType category');
      
      return availabilities.map(avail => ({
        materialId: avail.materialId._id,
        materialInfo: avail.materialId,
        totalSlots: avail.totalSlots,
        occupiedSlots: avail.occupiedSlots,
        availableSlots: avail.availableSlots,
        nextAvailableDate: avail.nextAvailableDate,
        allSlotsFreeDate: avail.allSlotsFreeDate,
        status: avail.status,
        canAcceptAd: avail.availableSlots > 0 && avail.status === 'AVAILABLE'
      }));
    } catch (error) {
      console.error('Error getting materials availability:', error);
      throw error;
    }
  }
  
  /**
   * Removed validatePlanAvailability - no longer using AdsPlan
   */
  static async validatePlanAvailability(planId, desiredStartDate) {
    throw new Error('AdsPlan functionality has been removed');
  }
  
  /**
   * Removed assignAdToMaterials - no longer using AdsPlan
   */
  static async assignAdToMaterials(adId, planId, startTime, endTime) {
    throw new Error('AdsPlan functionality has been removed');
  }
  
  /**
   * Remove ad from materials
   */
  static async removeAdFromMaterials(adId) {
    try {
        const adObjectId = mongoose.Types.ObjectId.isValid(adId)
        ? new mongoose.Types.ObjectId(adId)
        : adId;
      
      const availabilities = await MaterialAvailability.find({
        $or: [
          { 'currentAds.adId': adObjectId },
          { 'scheduledAds.adId': adObjectId }
        ]
      });
      
      for (const availability of availabilities) {
        availability.removeAd(adObjectId);
        await availability.save();
      }
      
      return { success: true, removedFrom: availabilities.length };
    } catch (error) {
      console.error('Error removing ad from materials:', error);
      throw error;
    }
  }
  
  /**
   * Removed getNextAvailableSlots - no longer using AdsPlan
   */
  static async getNextAvailableSlots(planId) {
    throw new Error('AdsPlan functionality has been removed');
  }
  
  /**
   * Update material availability when ad status changes
   */
  static async updateAdStatus(adId, newStatus) {
    try {
      const ad = await Ad.findById(adId);
      if (!ad) return { success: false, message: 'Ad not found' };
      
      if (newStatus === 'ACTIVE' && ad.status !== 'ACTIVE') {
        // Ad is being activated - material assignment is handled by ad deployment service
        // Removed planId reference - no longer using AdsPlan
        return { success: true, message: 'Ad activation handled by deployment service' };
      } else if (newStatus === 'INACTIVE' && ad.status === 'ACTIVE') {
        // Ad is being deactivated, remove from materials
        return await this.removeAdFromMaterials(adId);
      }
      
      return { success: true, message: 'No action needed' };
    } catch (error) {
      console.error('Error updating ad status:', error);
      throw error;
    }
  }
  
  /**
   * Get availability summary for admin dashboard
   */
  static async getAvailabilitySummary() {
    try {
      const availabilities = await MaterialAvailability.find()
        .populate('materialId', 'materialId materialType vehicleType category');
      
      const summary = {
        totalMaterials: availabilities.length,
        totalSlots: availabilities.reduce((sum, avail) => sum + avail.totalSlots, 0),
        occupiedSlots: availabilities.reduce((sum, avail) => sum + avail.occupiedSlots, 0),
        availableSlots: availabilities.reduce((sum, avail) => sum + avail.availableSlots, 0),
        utilizationRate: 0,
        materialsByStatus: {
          available: availabilities.filter(avail => avail.status === 'AVAILABLE').length,
          full: availabilities.filter(avail => avail.availableSlots === 0).length,
          maintenance: availabilities.filter(avail => avail.status === 'MAINTENANCE').length
        }
      };
      
      summary.utilizationRate = summary.totalSlots > 0 ? 
        (summary.occupiedSlots / summary.totalSlots) * 100 : 0;
      
      return summary;
    } catch (error) {
      console.error('Error getting availability summary:', error);
      throw error;
    }
  }
}

module.exports = MaterialAvailabilityService;
