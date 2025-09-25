const MaterialAvailability = require('../models/MaterialAvailability');
const Material = require('../models/Material');
const AdsPlan = require('../models/AdsPlan');
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
   * Validate if a plan can be used (has available materials)
   */
  static async validatePlanAvailability(planId, desiredStartDate) {
    try {
      const plan = await AdsPlan.findById(planId).populate('materials');
      if (!plan) {
        throw new Error('Plan not found');
      }
      
      const materialIds = plan.materials.map(m => m._id);
      const availabilities = await this.getMaterialsAvailability(materialIds);
      
      // Check if any materials are available
      const availableMaterials = availabilities.filter(avail => avail.canAcceptAd);
      const totalAvailableSlots = availabilities.reduce((sum, avail) => sum + avail.availableSlots, 0);
      
      return {
        canCreate: availableMaterials.length > 0,
        plan,
        materialAvailabilities: availabilities,
        totalAvailableSlots,
        availableMaterialsCount: availableMaterials.length,
        nextAvailableDate: availabilities.length > 0 ? 
          Math.min(...availabilities.map(avail => 
            avail.nextAvailableDate ? new Date(avail.nextAvailableDate).getTime() : Infinity
          )) : null
      };
    } catch (error) {
      console.error('Error validating plan availability:', error);
      throw error;
    }
  }
  
  /**
   * Assign ad to materials based on plan
   */
  static async assignAdToMaterials(adId, planId, startTime, endTime) {
    try {
      const plan = await AdsPlan.findById(planId).populate('materials');
      if (!plan) {
        throw new Error('Plan not found');
      }
      
      const materialIds = plan.materials.map(m => m._id);
      const assignments = [];
      
      for (const materialId of materialIds) {
        // Initialize availability if not exists
        let availability = await MaterialAvailability.findOne({ materialId });
        if (!availability) {
          availability = await this.initializeMaterialAvailability(materialId);
        }
        
        // Check if material can accept the ad
        if (availability.canAcceptAd(startTime, endTime)) {
          availability.addAd(adId, startTime, endTime);
          await availability.save();
          
          assignments.push({
            materialId,
            success: true,
            slotNumber: availability.currentAds.find(ad => 
              ad.adId.toString() === adId.toString()
            )?.slotNumber
          });
        } else {
          assignments.push({
            materialId,
            success: false,
            reason: availability.availableSlots <= 0 ? 'No available slots' : 'Time conflict'
          });
        }
      }
      
      return {
        adId,
        planId,
        assignments,
        success: assignments.some(a => a.success)
      };
    } catch (error) {
      console.error('Error assigning ad to materials:', error);
      throw error;
    }
  }
  
  /**
   * Remove ad from materials
   */
  static async removeAdFromMaterials(adId) {
    try {
      const availabilities = await MaterialAvailability.find({
        'currentAds.adId': adId
      });
      
      for (const availability of availabilities) {
        availability.removeAd(adId);
        await availability.save();
      }
      
      return { success: true, removedFrom: availabilities.length };
    } catch (error) {
      console.error('Error removing ad from materials:', error);
      throw error;
    }
  }
  
  /**
   * Get next available slots for a plan
   */
  static async getNextAvailableSlots(planId) {
    try {
      const plan = await AdsPlan.findById(planId).populate('materials');
      if (!plan) {
        throw new Error('Plan not found');
      }
      
      const materialIds = plan.materials.map(m => m._id);
      const availabilities = await this.getMaterialsAvailability(materialIds);
      
      const nextAvailableSlots = availabilities
        .filter(avail => avail.availableSlots > 0)
        .sort((a, b) => new Date(a.nextAvailableDate) - new Date(b.nextAvailableDate));
      
      return {
        plan,
        nextAvailableSlots,
        totalAvailableSlots: availabilities.reduce((sum, avail) => sum + avail.availableSlots, 0)
      };
    } catch (error) {
      console.error('Error getting next available slots:', error);
      throw error;
    }
  }
  
  /**
   * Update material availability when ad status changes
   */
  static async updateAdStatus(adId, newStatus) {
    try {
      const ad = await Ad.findById(adId);
      if (!ad) return { success: false, message: 'Ad not found' };
      
      if (newStatus === 'ACTIVE' && ad.status !== 'ACTIVE') {
        // Ad is being activated, assign to materials
        return await this.assignAdToMaterials(adId, ad.planId, ad.startTime, ad.endTime);
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
