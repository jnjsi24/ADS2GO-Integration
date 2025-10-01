const AdsDeployment = require('../models/adsDeployment');
const Ad = require('../models/Ad');
const Material = require('../models/Material');

class AdDeploymentService {
  /**
   * Get the next available slot number
   * @param {Array} lcdSlots - Array of existing LCD slots
   * @returns {number|null} Next available slot number or null if all slots are occupied
   */
  getNextAvailableSlot(lcdSlots) {
    const activeSlots = lcdSlots
      .filter(slot => ['SCHEDULED', 'RUNNING'].includes(slot.status))
      .map(slot => slot.slotNumber);

    for (let slot = 1; slot <= 5; slot++) {
      if (!activeSlots.includes(slot)) {
        return slot;
      }
    }
    
    return null;
  }

  /**
   * Deploy an ad to its assigned material
   * @param {string} adId - The ID of the ad to deploy
   * @returns {Promise<Object>} The created deployment
   */
  async deployAd(adId) {
    try {
      // Find the ad with populated material and plan
      const ad = await Ad.findById(adId)
        .populate('materialId')
        .populate('planId');

      if (!ad) {
        throw new Error('Ad not found');
      }

      // Check if ad is already deployed
      const existingDeployment = await AdsDeployment.findOne({
        'lcdSlots.adId': ad._id,
        status: 'ACTIVE'
      });

      if (existingDeployment) {
        return {
          success: true,
          message: 'Ad is already deployed',
          deployment: existingDeployment
        };
      }

      // Check if there's already a deployment for this material
      let deployment = await AdsDeployment.findOne({
        materialId: ad.materialId._id,
        status: 'ACTIVE'
      });

      if (deployment) {
        // Add to existing deployment
        const nextSlot = this.getNextAvailableSlot(deployment.lcdSlots);
        if (!nextSlot) {
          throw new Error('All LCD slots are occupied');
        }

        deployment.lcdSlots.push({
          slotNumber: nextSlot,
          adId: ad._id,
          mediaFile: ad.mediaFile,
          status: 'RUNNING',
          startTime: ad.startTime,
          endTime: ad.endTime
        });

        // Update driverId if different
        if (deployment.driverId.toString() !== ad.userId.toString()) {
          deployment.driverId = ad.userId;
        }
      } else {
        // Create a new deployment
        deployment = new AdsDeployment({
          materialId: ad.materialId._id,
          driverId: ad.userId,
          status: 'ACTIVE',
          lcdSlots: [{
            slotNumber: 1, // Default slot number, can be made configurable
            adId: ad._id,
            mediaFile: ad.mediaFile,
            status: 'RUNNING',
            startTime: ad.startTime,
            endTime: ad.endTime
          }]
        });
      }

      await deployment.save();

      // Update ad status to DEPLOYED
      ad.status = 'RUNNING';
      await ad.save();

      return {
        success: true,
        message: 'Ad deployed successfully',
        deployment
      };
    } catch (error) {
      console.error('Error deploying ad:', error);
      return {
        success: false,
        message: error.message || 'Failed to deploy ad'
      };
    }
  }

  /**
   * Undeploy an ad
   * @param {string} adId - The ID of the ad to undeploy
   */
  async undeployAd(adId) {
    try {
      const deployment = await AdsDeployment.findOneAndUpdate(
        { 'lcdSlots.adId': adId, status: 'ACTIVE' },
        { $set: { 'lcdSlots.$.status': 'STOPPED' } },
        { new: true }
      );

      if (!deployment) {
        return {
          success: false,
          message: 'No active deployment found for this ad'
        };
      }

      // Update ad status
      await Ad.findByIdAndUpdate(adId, { status: 'ENDED' });

      return {
        success: true,
        message: 'Ad undeployed successfully',
        deployment
      };
    } catch (error) {
      console.error('Error undeploying ad:', error);
      return {
        success: false,
        message: error.message || 'Failed to undeploy ad'
      };
    }
  }
}

module.exports = new AdDeploymentService();
