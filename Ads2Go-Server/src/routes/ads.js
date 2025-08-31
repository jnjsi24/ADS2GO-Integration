const express = require('express');
const router = express.Router();
const Ad = require('../models/Ad');
const Material = require('../models/Material');
const AdsDeployment = require('../models/adsDeployment');

// GET /ads/deployments - Get all deployments (for debugging) - MUST COME FIRST
router.get('/deployments', async (req, res) => {
  try {
    const deployments = await AdsDeployment.find({})
      .populate('lcdSlots.adId')
      .limit(10);

    const simplifiedDeployments = deployments.map(dep => ({
      id: dep._id,
      materialId: dep.materialId,
      driverId: dep.driverId,
      lcdSlotsCount: dep.lcdSlots.length,
      slots: dep.lcdSlots.map(slot => ({
        slotNumber: slot.slotNumber,
        status: slot.status,
        startTime: slot.startTime,
        endTime: slot.endTime,
        adId: slot.adId ? slot.adId._id : null,
        mediaFile: slot.mediaFile
      }))
    }));

    res.json({
      success: true,
      deployments: simplifiedDeployments,
      message: `Found ${deployments.length} deployments`
    });

  } catch (error) {
    console.error('Error fetching deployments:', error);
    res.status(500).json({
      success: false,
      deployments: [],
      message: 'Internal server error'
    });
  }
});

// GET /ads/:materialId/:slotNumber - Get ads for a specific material and slot
  router.get('/:materialId/:slotNumber', async (req, res) => {
    try {
      const { materialId, slotNumber } = req.params;

      console.log('Fetching ads for:', { materialId, slotNumber });

      // Find the material first
      const material = await Material.findOne({ materialId });
      if (!material) {
        return res.status(404).json({
          success: false,
          ads: [],
          message: 'Material not found'
        });
      }

      // Find ad deployments for this material and slot
      const currentTime = new Date();
      console.log('Searching for deployment with criteria:', {
        materialId: materialId,
        slotNumber: parseInt(slotNumber),
        currentTime: currentTime.toISOString()
      });
      
      const deployment = await AdsDeployment.findOne({
        materialId: materialId,
        'lcdSlots.slotNumber': parseInt(slotNumber),
        'lcdSlots.status': 'RUNNING',
        'lcdSlots.startTime': { $lte: currentTime },
        'lcdSlots.endTime': { $gte: currentTime }
      }).populate('lcdSlots.adId');
      
      console.log('Deployment found:', deployment ? 'Yes' : 'No');
      if (deployment) {
        console.log('Deployment details:', {
          id: deployment._id,
          materialId: deployment.materialId,
          lcdSlotsCount: deployment.lcdSlots.length,
          slots: deployment.lcdSlots.map(s => ({
            slotNumber: s.slotNumber,
            status: s.status,
            startTime: s.startTime,
            endTime: s.endTime
          }))
        });
      }

      if (!deployment) {
        console.log(`No deployment found for material ${materialId}, slot ${slotNumber}`);
        return res.json({
          success: true,
          ads: [],
          message: 'No ads deployed for this material and slot'
        });
      }

      // Find the specific slot
      const slot = deployment.lcdSlots.find(s => s.slotNumber === parseInt(slotNumber));
      if (!slot) {
        console.log(`Slot ${slotNumber} not found in deployment`);
        return res.json({
          success: true,
          ads: [],
          message: 'Slot not found in deployment'
        });
      }

      // Get the ad details
      const ad = slot.adId;
      if (!ad) {
        console.log(`Ad not found for slot ${slotNumber}`);
        return res.json({
          success: true,
          ads: [],
          message: 'Ad not found'
        });
      }

      // Transform to match the mobile app's expected format
      const transformedAds = [{
        adId: ad._id.toString(),
        adDeploymentId: deployment._id.toString(),
        slotNumber: parseInt(slotNumber),
        startTime: slot.startTime.toISOString(),
        endTime: slot.endTime.toISOString(),
        status: slot.status,
        mediaFile: slot.mediaFile,
        adTitle: ad.title,
        adDescription: ad.description || '',
        duration: ad.adLengthSeconds || 30,
        createdAt: slot.createdAt,
        updatedAt: slot.updatedAt
      }];

      console.log(`Found ${transformedAds.length} ads for material ${materialId}, slot ${slotNumber}`);

      res.json({
        success: true,
        ads: transformedAds,
        message: `Found ${transformedAds.length} ads`
      });

    } catch (error) {
      console.error('Error fetching ads:', error);
      res.status(500).json({
        success: false,
        ads: [],
        message: 'Internal server error'
      });
    }
  });

// GET /ads - Get all ads (for debugging)
router.get('/', async (req, res) => {
  try {
    const ads = await Ad.find({ status: 'RUNNING' })
      .populate('userId', 'firstName lastName companyName')
      .populate('materialId', 'materialId materialType vehicleType')
      .populate('planId', 'planName durationDays')
      .limit(10);

    res.json({
      success: true,
      ads: ads,
      message: `Found ${ads.length} ads`
    });

  } catch (error) {
    console.error('Error fetching all ads:', error);
    res.status(500).json({
      success: false,
      ads: [],
      message: 'Internal server error'
    });
  }
});



module.exports = router;
