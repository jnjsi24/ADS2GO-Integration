const express = require('express');
const router = express.Router();
const Ad = require('../models/Ad');
const Material = require('../models/Material');
const AdsDeployment = require('../models/adsDeployment');
const QRScanTracking = require('../models/qrScanTracking');

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

// GET /ads/qr-scans - Get QR scan analytics (MUST COME BEFORE parameterized routes)
router.get('/qr-scans', async (req, res) => {
  try {
    const { adId, materialId, startDate, endDate, limit = 100 } = req.query;
    
    const query = {};
    if (adId) query.adId = adId;
    if (materialId) query.materialId = materialId;
    if (startDate && endDate) {
      query.scanTimestamp = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const scans = await QRScanTracking.find(query)
      .sort({ scanTimestamp: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      scans: scans,
      total: scans.length,
      message: `Found ${scans.length} QR scans`
    });

  } catch (error) {
    console.error('Error fetching QR scans:', error);
    res.status(500).json({
      success: false,
      scans: [],
      message: 'Internal server error'
    });
  }
});

// GET /ads/qr-scans/stats - Get QR scan statistics (MUST COME BEFORE parameterized routes)
router.get('/qr-scans/stats', async (req, res) => {
  try {
    const { adId, materialId, startDate, endDate } = req.query;
    
    const query = {};
    if (adId) query.adId = adId;
    if (materialId) query.materialId = materialId;
    if (startDate && endDate) {
      query.scanTimestamp = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Get basic stats without material validation
    const stats = await QRScanTracking.getScanStats(adId, startDate, endDate);
    const topAds = await QRScanTracking.getTopPerformingAds(10, startDate, endDate);
    
    // Only get location stats if materialId is provided and valid
    let locationStats = [];
    if (materialId) {
      try {
        locationStats = await QRScanTracking.getScansByLocation(materialId, startDate, endDate);
      } catch (locationError) {
        console.log('Could not get location stats for materialId:', materialId, locationError.message);
        locationStats = [];
      }
    }

    res.json({
      success: true,
      stats: stats[0] || {
        totalScans: 0,
        uniqueDevices: 0,
        totalConversions: 0,
        conversionRate: 0,
        averageTimeOnPage: 0,
        totalConversionValue: 0
      },
      topAds: topAds,
      locationStats: locationStats,
      message: 'QR scan statistics retrieved successfully'
    });

  } catch (error) {
    console.error('Error fetching QR scan stats:', error);
    res.status(500).json({
      success: false,
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

// POST /ads/qr-scan - Track QR code scan
router.post('/qr-scan', async (req, res) => {
  try {
    const { 
      adId, 
      adTitle, 
      materialId, 
      slotNumber, 
      timestamp, 
      userAgent, 
      qrCodeUrl, 
      ipAddress, 
      country, 
      city,
      // New fields from Android player
      deviceInfo,
      gpsData,
      registrationData,
      networkStatus,
      isOffline,
      screenData
    } = req.body;

    console.log('QR scan tracked:', {
      adId,
      adTitle,
      materialId,
      slotNumber,
      timestamp,
      userAgent: userAgent ? userAgent.substring(0, 50) + '...' : 'Unknown',
      qrCodeUrl: qrCodeUrl ? qrCodeUrl.substring(0, 100) + '...' : 'Unknown',
      ipAddress,
      location: city && country ? `${city}, ${country}` : 'Unknown',
      hasGpsData: !!gpsData,
      hasDeviceInfo: !!deviceInfo,
      hasRegistrationData: !!registrationData
    });

    // Detect device type from user agent or device info
    let deviceType = 'unknown';
    let browser = 'unknown';
    let operatingSystem = 'unknown';

    // Use device info from Android player if available
    if (deviceInfo) {
      deviceType = deviceInfo.deviceType || 'unknown';
      operatingSystem = deviceInfo.osName || 'unknown';
      browser = 'Android App'; // Since it's coming from the Android app
    } else if (userAgent) {
      const ua = userAgent.toLowerCase();
      
      // Device type detection
      if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
        deviceType = 'mobile';
      } else if (ua.includes('tablet') || ua.includes('ipad')) {
        deviceType = 'tablet';
      } else if (ua.includes('desktop') || ua.includes('windows') || ua.includes('macintosh') || ua.includes('linux')) {
        deviceType = 'desktop';
      }

      // Browser detection
      if (ua.includes('chrome')) browser = 'Chrome';
      else if (ua.includes('firefox')) browser = 'Firefox';
      else if (ua.includes('safari')) browser = 'Safari';
      else if (ua.includes('edge')) browser = 'Edge';

      // OS detection
      if (ua.includes('windows')) operatingSystem = 'Windows';
      else if (ua.includes('macintosh')) operatingSystem = 'macOS';
      else if (ua.includes('android')) operatingSystem = 'Android';
      else if (ua.includes('iphone') || ua.includes('ipad')) operatingSystem = 'iOS';
      else if (ua.includes('linux')) operatingSystem = 'Linux';
    }

    // Prepare location data
    let locationData = null;
    if (gpsData && gpsData.lat && gpsData.lng) {
      locationData = {
        type: 'Point',
        coordinates: [gpsData.lng, gpsData.lat] // GeoJSON format: [longitude, latitude]
      };
    }

    // Create QR scan tracking record
    const qrScanData = {
      adId,
      adTitle: adTitle || `Ad ${adId}`,
      materialId,
      slotNumber: parseInt(slotNumber),
      qrCodeUrl: qrCodeUrl,
      userAgent: userAgent || 'Android App',
      deviceType,
      browser,
      operatingSystem,
      ipAddress,
      country,
      city,
      location: locationData,
      scanTimestamp: timestamp ? new Date(timestamp) : new Date(),
      // Additional Android player data
      deviceInfo: deviceInfo || null,
      gpsData: gpsData || null,
      registrationData: registrationData || null,
      networkStatus: networkStatus || false,
      isOffline: isOffline || false,
      screenData: screenData || null,
      // Metadata
      metadata: {
        source: 'android_player',
        hasGpsData: !!gpsData,
        hasDeviceInfo: !!deviceInfo,
        hasRegistrationData: !!registrationData,
        timestamp: new Date().toISOString()
      }
    };

    // Save to database
    const qrScan = new QRScanTracking(qrScanData);
    await qrScan.save();

    // Update material tracking QR scan count
    try {
      const MaterialTracking = require('../models/materialTracking');
      await MaterialTracking.findOneAndUpdate(
        { materialId },
        { $inc: { qrCodeScans: 1 } },
        { upsert: false }
      );
    } catch (materialTrackingError) {
      console.log('Could not update material tracking QR count:', materialTrackingError.message);
    }

    // Update screen tracking with QR scan data if registration data is available
    if (registrationData && registrationData.deviceId) {
      try {
        const ScreenTracking = require('../models/screenTracking');
        await ScreenTracking.findOneAndUpdate(
          { 'devices.deviceId': registrationData.deviceId },
          { 
            $inc: { 'screenMetrics.qrCodeScans': 1 },
            $set: { 
              'screenMetrics.lastQRScan': new Date(),
              'screenMetrics.lastQRScanAdId': adId
            }
          }
        );
        console.log('Updated screen tracking QR scan count');
      } catch (screenTrackingError) {
        console.log('Could not update screen tracking QR count:', screenTrackingError.message);
      }
    }

    // Track QR scan in analytics service
    try {
      const AnalyticsService = require('../services/analyticsService');
      await AnalyticsService.trackQRScan(
        registrationData?.deviceId || 'unknown',
        materialId,
        slotNumber,
        qrScanData
      );
      console.log('✅ QR scan tracked in analytics service');
    } catch (analyticsError) {
      console.log('❌ Failed to track QR scan in analytics:', analyticsError.message);
    }

    res.json({
      success: true,
      message: 'QR scan tracked successfully',
      data: {
        scanId: qrScan._id,
        adId,
        adTitle: qrScanData.adTitle,
        materialId,
        slotNumber,
        timestamp: qrScan.scanTimestamp.toISOString(),
        deviceType,
        browser,
        operatingSystem,
        hasGpsData: !!gpsData,
        hasDeviceInfo: !!deviceInfo,
        location: gpsData ? `${gpsData.lat}, ${gpsData.lng}` : 'Unknown'
      }
    });

  } catch (error) {
    console.error('Error tracking QR scan:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track QR scan',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
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
