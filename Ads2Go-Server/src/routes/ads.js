const express = require('express');
const router = express.Router();
const Ad = require('../models/Ad');
const Material = require('../models/Material');
const AdsDeployment = require('../models/adsDeployment');
const Analytics = require('../models/analytics');
// QRScanTracking removed - QR scans are now handled directly in analytics collection

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

    // QRScanTracking removed - using analytics collection instead
    const scans = await Analytics.aggregate([
      { $match: query },
      { $unwind: '$qrScans' },
      { $replaceRoot: { newRoot: '$qrScans' } },
      { $sort: { scanTimestamp: -1 } },
      { $limit: parseInt(limit) }
    ]);

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
    // QRScanTracking removed - using analytics collection instead
    const stats = await Analytics.aggregate([
      { $match: { adId } },
      { $unwind: '$qrScans' },
      { $match: { 'qrScans.adId': adId } },
      {
        $group: {
          _id: null,
          totalScans: { $sum: 1 },
          totalConversions: { $sum: { $cond: ['$qrScans.converted', 1, 0] } },
          averageTimeOnPage: { $avg: '$qrScans.timeOnPage' }
        }
      }
    ]);
    
    const topAds = await Analytics.aggregate([
      { $unwind: '$qrScans' },
      { $group: { _id: '$qrScans.adId', totalScans: { $sum: 1 } } },
      { $sort: { totalScans: -1 } },
      { $limit: 10 }
    ]);
    
    // Only get location stats if materialId is provided and valid
    let locationStats = [];
    if (materialId) {
      try {
        // QRScanTracking removed - using analytics collection instead
        locationStats = await Analytics.aggregate([
          { $match: { materialId } },
          { $unwind: '$qrScans' },
          { $match: { 'qrScans.location.coordinates': { $exists: true } } },
          {
            $group: {
              _id: '$qrScans.location.coordinates',
              count: { $sum: 1 }
            }
          }
        ]);
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
              website: slot.adId.website || null, // Include website field
              duration: slot.adId.adLengthSeconds || 30,
              createdAt: slot.createdAt,
              updatedAt: slot.updatedAt
            });
          }
        });
      });

      console.log(`Found ${allActiveAds.length} active ads for material ${materialId}, slot ${requestedSlotNumber}`);
      
      // Debug: Log the first ad to see if website field is included
      if (allActiveAds.length > 0) {
        console.log('🔍 First ad data being sent to Android player:', {
          adId: allActiveAds[0].adId,
          adTitle: allActiveAds[0].adTitle,
          website: allActiveAds[0].website,
          hasWebsite: !!allActiveAds[0].website
        });
      }

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
    // Immediate notification that QR scan endpoint was hit
    console.log('\n\u001b[43m\u001b[30m🚨 QR SCAN ENDPOINT HIT! 🚨\u001b[0m');
    console.log('\u001b[43m\u001b[30m' + '='.repeat(50) + '\u001b[0m');
    console.log(`\u001b[1m\u001b[33mTime: \u001b[0m\u001b[36m${new Date().toLocaleString()}\u001b[0m`);
    console.log(`\u001b[1m\u001b[33mIP: \u001b[0m\u001b[36m${req.ip || req.connection.remoteAddress}\u001b[0m`);
    console.log('\u001b[43m\u001b[30m' + '='.repeat(50) + '\u001b[0m\n');
    
    const { 
      adId, 
      adTitle, 
      materialId, 
      slotNumber, 
      timestamp, 
      userAgent, 
      qrCodeUrl, 
      website,
      redirectUrl,
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

    // Accept data from both Slot 1 and Slot 2 since they are different physical devices
    console.log(`📱 Processing QR scan from Slot ${slotNumber} for material ${materialId}`);

    // Enhanced QR scan logging with sound alert and colors
    console.log('\n\n\u001b[42m\u001b[30m' + '='.repeat(60) + '\u001b[0m');
    console.log('\u001b[42m\u001b[30m' + ' '.repeat(20) + '🔍 QR CODE SCANNED! 🔍' + ' '.repeat(20) + '\u001b[0m');
    console.log('\u001b[42m\u001b[30m' + '='.repeat(60) + '\u001b[0m\n');
    
    // Sound alert (beep)
    process.stdout.write('\u0007');
    
    console.log('\u001b[1m\u001b[33m📱 AD INFORMATION:\u001b[0m');
    console.log(`   Title: \u001b[36m${adTitle}\u001b[0m`);
    console.log(`   ID: \u001b[36m${adId}\u001b[0m`);
    
    console.log('\u001b[1m\u001b[33m🏷️  MATERIAL INFO:\u001b[0m');
    console.log(`   Material ID: \u001b[36m${materialId}\u001b[0m`);
    console.log(`   Slot Number: \u001b[36m${slotNumber}\u001b[0m`);
    
    console.log('\u001b[1m\u001b[33m🌐 QR CODE DETAILS:\u001b[0m');
    console.log(`   QR URL: \u001b[36m${qrCodeUrl}\u001b[0m`);
    console.log(`   Website: \u001b[36m${website || 'Ads2Go'}\u001b[0m`);
    
    console.log('\u001b[1m\u001b[33m📱 DEVICE INFO:\u001b[0m');
    console.log(`   Device ID: \u001b[36m${registrationData?.deviceId || 'Unknown'}\u001b[0m`);
    console.log(`   Device Type: \u001b[36m${deviceInfo?.deviceType || 'Unknown'}\u001b[0m`);
    console.log(`   OS: \u001b[36m${deviceInfo?.osName || 'Unknown'}\u001b[0m`);
    
    console.log('\u001b[1m\u001b[33m📍 LOCATION INFO:\u001b[0m');
    console.log(`   Location: \u001b[36m${city && country ? `${city}, ${country}` : 'Unknown'}\u001b[0m`);
    if (gpsData && gpsData.lat && gpsData.lng) {
      console.log(`   GPS: \u001b[36m${gpsData.lat}, ${gpsData.lng}\u001b[0m`);
    }
    
    console.log('\u001b[1m\u001b[33m⏰ TIMESTAMP:\u001b[0m');
    console.log(`   Time: \u001b[36m${new Date().toLocaleString()}\u001b[0m`);
    
    console.log('\u001b[42m\u001b[30m' + '='.repeat(60) + '\u001b[0m\n');

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

    // QR scan will only be saved to device analytics document (no separate QRScanTracking documents)

    // DeviceCompliance is now PHOTOS ONLY - no analytics data
    // QR scan analytics are handled by DeviceTracking and Analytics collections

    // Process registration data
    
    // Use the new ad-based analytics structure
    console.log('\u001b[33m🔍 USING NEW AD-BASED ANALYTICS STRUCTURE...\u001b[0m');
    
    // Try to get device ID from registration or device info first
    let deviceIdToUse = (registrationData && registrationData.deviceId) || (deviceInfo && deviceInfo.deviceId);
    
    if (!deviceIdToUse) {
      // Use fallback device ID for QR scans without device info
      deviceIdToUse = `QR-SCAN-${materialId}-${slotNumber}-${Date.now()}`;
      console.log(`\u001b[33m🔍 USING QR-SCAN DEVICE ID: ${deviceIdToUse}\u001b[0m`);
    } else {
      console.log(`\u001b[32m✅ USING PROVIDED DEVICE ID: ${deviceIdToUse}\u001b[0m`);
    }
    
    // Create QR scan data
    const qrScanData = {
      adId: adId,
      adTitle: adTitle || `Ad ${adId}`,
      materialId: materialId,
      slotNumber: parseInt(slotNumber),
      scanTimestamp: timestamp ? new Date(timestamp) : new Date(),
      qrCodeUrl: qrCodeUrl,
      userAgent: userAgent || 'Android App',
      deviceType: deviceType,
      browser: browser,
      operatingSystem: operatingSystem,
      ipAddress: ipAddress,
      country: country,
      city: city,
      location: locationData,
      timeOnPage: 0,
      converted: false,
      conversionType: null,
      conversionValue: 0
    };
    
    // Save QR scan to deviceTracking collection (analytics will fetch from here)
    try {
      const DeviceTracking = require('../models/deviceTracking');
      
      // Find or create device tracking record for today
      let deviceTracking = await DeviceTracking.findOne({
        materialId: materialId,
        date: new Date().toISOString().split('T')[0]
      });
      
      if (!deviceTracking) {
        // Create new device tracking record for today
        deviceTracking = new DeviceTracking({
          materialId: materialId,
          carGroupId: 'GRP-UNKNOWN', // Will be updated when device connects
          screenType: 'HEADDRESS',
          date: new Date().toISOString().split('T')[0],
          slots: [],
          isOnline: false,
          totalAdPlays: 0,
          totalQRScans: 0,
          totalDistanceTraveled: 0,
          totalHoursOnline: 0,
          totalAdImpressions: 0,
          totalAdPlayTime: 0,
          adPlaybacks: [],
          qrScans: [],
          locationHistory: [],
          hourlyStats: [],
          adPerformance: [],
          qrScansByAd: [],
          complianceData: {
            offlineIncidents: 0,
            displayIssues: 0
          },
          currentSession: {
            date: new Date(),
            startTime: new Date(),
            totalHoursOnline: 0,
            totalDistanceTraveled: 0,
            isActive: true,
            targetHours: 8,
            complianceStatus: 'PENDING',
            locationHistory: []
          }
        });
      }
      
      // Add QR scan to deviceTracking
      deviceTracking.qrScans.push(qrScanData);
      deviceTracking.totalQRScans += 1;
      
      // Update QR scans by ad
      const existingAdScan = deviceTracking.qrScansByAd.find(scan => scan.adId === qrScanData.adId);
      if (existingAdScan) {
        existingAdScan.scanCount += 1;
        existingAdScan.lastScanned = new Date();
      } else {
        deviceTracking.qrScansByAd.push({
          adId: qrScanData.adId,
          adTitle: qrScanData.adTitle,
          scanCount: 1,
          lastScanned: new Date(),
          firstScanned: new Date()
        });
      }
      
      await deviceTracking.save();
      console.log('\u001b[32m✅ Updated deviceTracking with QR scan data\u001b[0m');
      console.log(`   DeviceTracking QR Scans: \u001b[32m${deviceTracking.totalQRScans}\u001b[0m`);
      console.log(`   QR Scans in Array: \u001b[32m${deviceTracking.qrScans.length}\u001b[0m`);
      
    } catch (deviceTrackingError) {
      console.log('\u001b[31m❌ Could not update deviceTracking with QR scan:\u001b[0m', deviceTrackingError.message);
    }

    // ScreenTracking collection deprecated: skip screen-level QR scan updates

    // Note: QR scan is already tracked in device analytics above

    res.json({
      success: true,
      message: 'QR scan tracked successfully',
      data: {
        adId,
        adTitle: qrScanData.adTitle,
        materialId,
        slotNumber,
        timestamp: qrScanData.scanTimestamp.toISOString(),
        deviceType,
        browser,
        operatingSystem,
        hasGpsData: !!gpsData,
        hasDeviceInfo: !!deviceInfo,
        location: gpsData ? `${gpsData.lat}, ${gpsData.lng}` : 'Unknown',
        website: qrScanData.website,
        redirectUrl: qrScanData.redirectUrl
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

// GET /ads/qr-redirect - Redirect QR scans to advertiser website with tracking
router.get('/qr-redirect', async (req, res) => {
  try {
    const { 
      adId, 
      adTitle, 
      materialId, 
      slotNumber, 
      website, 
      redirectUrl,
      timestamp 
    } = req.query;

    console.log('\n🔗 QR REDIRECT ENDPOINT HIT!');
    console.log('=====================================');
    console.log(`Ad ID: ${adId}`);
    console.log(`Ad Title: ${adTitle}`);
    console.log(`Material ID: ${materialId}`);
    console.log(`Slot Number: ${slotNumber}`);
    console.log(`Website: ${website}`);
    console.log(`Redirect URL: ${redirectUrl}`);
    console.log('=====================================\n');

    // Track the QR scan using new ad-based structure
    if (adId && adTitle && materialId && slotNumber) {
      try {
        const Analytics = require('../models/analytics');
        const Material = require('../models/Material');
        
        // Get material type
        const material = await Material.findOne({ materialId: materialId });
        const materialType = material ? material.materialType : 'HEADDRESS';
        
        // Create or update analytics for this ad
        const analytics = await Analytics.createOrUpdateAdAnalytics(
          adId,
          adTitle || `Ad ${adId}`,
          materialId,
          parseInt(slotNumber),
          `QR-REDIRECT-${materialId}-${slotNumber}-${Date.now()}`,
          {
            materialType: materialType,
            deviceInfo: null,
            currentLocation: null,
            networkStatus: { isOnline: false, lastSeen: new Date() }
          }
        );

        // Add QR scan to the specific material
        const qrScanData = {
          adId: adId,
          adTitle: adTitle || `Ad ${adId}`,
          scanTimestamp: new Date(),
          qrCodeUrl: redirectUrl || website,
          userAgent: req.get('User-Agent') || 'QR Scanner',
          deviceType: 'mobile',
          browser: 'QR Scanner',
          operatingSystem: 'Unknown',
          ipAddress: req.ip || req.connection.remoteAddress,
          country: 'Unknown',
          city: 'Unknown',
          location: null,
          timeOnPage: 0,
          converted: false,
          conversionType: null,
          conversionValue: 0
        };

        await analytics.addQRScan(materialId, parseInt(slotNumber), qrScanData);
        console.log(`✅ QR scan tracked for ad: ${adTitle}`);
      } catch (trackingError) {
        console.error('❌ Error tracking QR scan:', trackingError);
      }
    }

    // Redirect to the advertiser's website
    const targetUrl = redirectUrl || website || 'https://ads2go.app';
    console.log(`🔗 Redirecting to: ${targetUrl}`);
    
    res.redirect(302, targetUrl);
    
  } catch (error) {
    console.error('❌ Error in QR redirect:', error);
    res.redirect(302, 'https://ads2go.app');
  }
});

module.exports = router;
