const AdsDeployment = require('../models/adsDeployment');
const Ad = require('../models/Ad');
const Material = require('../models/Material');

class AdDeploymentService {
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

      // Create a new deployment
      const deployment = new AdsDeployment({
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
