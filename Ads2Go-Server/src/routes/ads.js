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

      // Find all active ad deployments for this material (shared across all slots)
      const currentTime = new Date();
      const requestedSlotNumber = parseInt(slotNumber);
      
      console.log('Searching for deployments for material:', {
        materialId: materialId,
        requestedSlotNumber: requestedSlotNumber,
        currentTime: currentTime.toISOString()
      });
      
      // Find all deployments for this material with running ads
      const deployments = await AdsDeployment.find({
        materialId: materialId,
        'lcdSlots.status': 'RUNNING',
        'lcdSlots.startTime': { $lte: currentTime },
        'lcdSlots.endTime': { $gte: currentTime }
      }).populate('lcdSlots.adId');
      
      console.log('Found deployments for material:', deployments.length);
      
      if (deployments.length === 0) {
        console.log(`No active deployments found for material ${materialId}`);
        return res.json({
          success: true,
          ads: [],
          message: 'No ads deployed for this material'
        });
      }

      // Collect all active ads from all deployments
      const allActiveAds = [];
      
      deployments.forEach(deployment => {
        console.log('Processing deployment:', {
          id: deployment._id,
          materialId: deployment.materialId,
          lcdSlotsCount: deployment.lcdSlots.length
        });
        
        deployment.lcdSlots.forEach(slot => {
          if (slot.status === 'RUNNING' && 
              slot.startTime <= currentTime && 
              slot.endTime >= currentTime && 
              slot.adId) {
            
            console.log('Found active ad in slot:', {
              slotNumber: slot.slotNumber,
              adId: slot.adId._id,
              adTitle: slot.adId.title
            });
            
            allActiveAds.push({
              adId: slot.adId._id.toString(),
              adDeploymentId: deployment._id.toString(),
              slotNumber: requestedSlotNumber, // Always return the requested slot number
              startTime: slot.startTime.toISOString(),
              endTime: slot.endTime.toISOString(),
              status: slot.status,
              mediaFile: slot.mediaFile,
              adTitle: slot.adId.title,
              adDescription: slot.adId.description || '',
              duration: slot.adId.adLengthSeconds || 30,
              createdAt: slot.createdAt,
              updatedAt: slot.updatedAt
            });
          }
        });
      });

      console.log(`Found ${allActiveAds.length} active ads for material ${materialId}, slot ${requestedSlotNumber}`);

      res.json({
        success: true,
        ads: allActiveAds,
        message: `Found ${allActiveAds.length} ads`
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
