const express = require('express');
const router = express.Router();
const Ad = require('../models/Ad');
const Material = require('../models/Material');
const AdsDeployment = require('../models/adsDeployment');
const Analytics = require('../models/analytics');
const CompanyAd = require('../models/CompanyAd'); // ✅ For company ad filler
const OSMService = require('../services/osmService'); // ✅ Use existing geocoding service
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
    
    // Validate required parameter
    if (!adId) {
      return res.status(400).json({
        success: false,
        data: [],
        message: 'adId parameter is required'
      });
    }

    console.log(`📊 [QR Scans] Fetching QR scans for ad: ${adId}, material: ${materialId || 'ALL'}`);

    // Get the ad and populate materials to get materialId strings
    const ad = await Ad.findById(adId).populate('materialId');
    
    if (!ad) {
      return res.status(404).json({
        success: false,
        data: [],
        message: 'Ad not found'
      });
    }

    // ✅ Exclude archived/deleted ads from analytics
    if (ad.isArchived) {
      return res.status(404).json({
        success: false,
        data: [],
        message: 'Ad not found or has been deleted'
      });
    }

    // Extract materialId strings from the populated material documents
    let materialIdStrings = [];
    if (ad.materialId && Array.isArray(ad.materialId)) {
      materialIdStrings = ad.materialId.map(m => m.materialId).filter(Boolean);
    }

    console.log(`📊 [QR Scans] Ad "${ad.title}" has ${materialIdStrings.length} materials: ${materialIdStrings.join(', ')}`);

    // If specific materialId filter is provided, use only that one
    if (materialId) {
      if (materialIdStrings.includes(materialId)) {
        materialIdStrings = [materialId];
        console.log(`📊 [QR Scans] Filtering by specific material: ${materialId}`);
      } else {
        return res.status(400).json({
          success: false,
          data: [],
          message: `Material ${materialId} is not assigned to this ad`
        });
      }
    }

    if (materialIdStrings.length === 0) {
      return res.json({
        success: true,
        data: [],
        total: 0,
        message: 'No materials assigned to this ad',
        metadata: {
          adId,
          adTitle: ad.title,
          materials: []
        }
      });
    }

    // Build date query
    const dateQuery = {};
    if (startDate && endDate) {
      dateQuery['dailyData.date'] = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Query DeviceDataHistoryV2 for these materials
    const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
    const deviceHistoryRecords = await DeviceDataHistoryV2.find({
      materialId: { $in: materialIdStrings },
      ...dateQuery
    })
      .select('materialId carGroupId dailyData.date dailyData.qrScans dailyData.qrScansByAd')
      .lean()
      .maxTimeMS(30000);

    console.log(`📊 [QR Scans] Found ${deviceHistoryRecords.length} device history records`);

    // Extract and filter QR scans for this specific ad
    const qrScans = [];
    let totalScanCount = 0;

    deviceHistoryRecords.forEach(device => {
      if (device.dailyData && Array.isArray(device.dailyData)) {
        device.dailyData.forEach(day => {
          // Process individual QR scan records
          if (day.qrScans && Array.isArray(day.qrScans)) {
            const adQRScans = day.qrScans.filter(scan => scan.adId === adId);
            
            adQRScans.forEach(scan => {
              qrScans.push({
                id: scan._id || `${scan.adId}-${scan.scanTimestamp}`,
                timestamp: scan.scanTimestamp,
                scanTimestamp: scan.scanTimestamp,
                scans: 1, // Individual scan = 1 count
                adId: scan.adId,
                userId: scan.userId,
                adTitle: scan.adTitle,
                materialId: scan.materialId,
                slotNumber: scan.slotNumber,
                qrCodeUrl: scan.qrCodeUrl,
                website: scan.website,
                redirectUrl: scan.redirectUrl,
                deviceType: scan.deviceType,
                browser: scan.browser,
                operatingSystem: scan.operatingSystem,
                location: scan.location ? {
                  lat: scan.location.coordinates ? scan.location.coordinates[1] : null,
                  lng: scan.location.coordinates ? scan.location.coordinates[0] : null,
                  address: scan.address || (scan.city && scan.country ? `${scan.city}, ${scan.country}` : null)
                } : null,
                city: scan.city,
                country: scan.country,
                ipAddress: scan.ipAddress,
                userAgent: scan.userAgent
              });
            });
          }

          // Also check aggregated counts for total
          if (day.qrScansByAd && Array.isArray(day.qrScansByAd)) {
            const adScanCount = day.qrScansByAd.find(s => s.adId === adId);
            if (adScanCount) {
              totalScanCount += adScanCount.scanCount || 0;
            }
          }
        });
      }
    });

    // Sort by timestamp descending (most recent first)
    qrScans.sort((a, b) => new Date(b.scanTimestamp).getTime() - new Date(a.scanTimestamp).getTime());

    // Apply limit
    const limitedScans = qrScans.slice(0, parseInt(limit));

    console.log(`📊 [QR Scans] Returning ${limitedScans.length} QR scans (out of ${qrScans.length} total)`);

    res.json({
      success: true,
      data: limitedScans, // ✅ Changed from 'scans' to 'data' to match client expectation
      total: qrScans.length,
      totalScanCount: totalScanCount || qrScans.length, // Aggregated count if available
      message: `Found ${qrScans.length} QR scans`,
      metadata: {
        adId,
        adTitle: ad.title,
        materials: materialIdStrings,
        dateRange: startDate && endDate ? { startDate, endDate } : null,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Error fetching QR scans:', error);
    res.status(500).json({
      success: false,
      data: [], // ✅ Changed from 'scans' to 'data'
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /ads/qr-scans/stats - Get QR scan statistics (MUST COME BEFORE parameterized routes)
router.get('/qr-scans/stats', async (req, res) => {
  try {
    const { adId, materialId, startDate, endDate } = req.query;
    
    if (!adId) {
      return res.status(400).json({
        success: false,
        message: 'adId parameter is required'
      });
    }

    console.log(`📊 [QR Stats] Fetching stats for ad: ${adId}`);

    // Get the ad and populate materials
    const ad = await Ad.findById(adId).populate('materialId');
    
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    // Extract materialId strings
    let materialIdStrings = [];
    if (ad.materialId && Array.isArray(ad.materialId)) {
      materialIdStrings = ad.materialId.map(m => m.materialId).filter(Boolean);
    }

    // If specific materialId filter is provided, use only that one
    if (materialId) {
      if (materialIdStrings.includes(materialId)) {
        materialIdStrings = [materialId];
      } else {
        return res.status(400).json({
          success: false,
          message: `Material ${materialId} is not assigned to this ad`
        });
      }
    }

    // Build date query
    const dateQuery = {};
    if (startDate && endDate) {
      dateQuery['dailyData.date'] = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Query DeviceDataHistoryV2 for these materials
    const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
    const deviceHistoryRecords = await DeviceDataHistoryV2.find({
      materialId: { $in: materialIdStrings },
      ...dateQuery
    })
      .select('materialId dailyData.date dailyData.qrScans dailyData.qrScansByAd')
      .lean()
      .maxTimeMS(30000);

    // Calculate statistics
    let totalScans = 0;
    let totalConversions = 0;
    let totalTimeOnPage = 0;
    let scanCount = 0;
    const uniqueDevices = new Set();
    const locationMap = new Map();

    deviceHistoryRecords.forEach(device => {
      uniqueDevices.add(device.materialId);
      
      if (device.dailyData && Array.isArray(device.dailyData)) {
        device.dailyData.forEach(day => {
          // Process individual QR scans
          if (day.qrScans && Array.isArray(day.qrScans)) {
            const adQRScans = day.qrScans.filter(scan => scan.adId === adId);
            
            adQRScans.forEach(scan => {
              scanCount++;
              totalTimeOnPage += scan.timeOnPage || 0;
              if (scan.converted) totalConversions++;
              
              // Track locations
              if (scan.location && scan.location.coordinates) {
                const locKey = scan.location.coordinates.join(',');
                locationMap.set(locKey, (locationMap.get(locKey) || 0) + 1);
              }
            });
          }

          // Also count from aggregated data
          if (day.qrScansByAd && Array.isArray(day.qrScansByAd)) {
            const adScanCount = day.qrScansByAd.find(s => s.adId === adId);
            if (adScanCount) {
              totalScans += adScanCount.scanCount || 0;
            }
          }
        });
      }
    });

    // Use the higher count (individual scans or aggregated)
    totalScans = Math.max(totalScans, scanCount);

    // Convert location map to array
    const locationStats = Array.from(locationMap.entries()).map(([coords, count]) => ({
      _id: coords.split(',').map(Number),
      count
    }));

    const stats = {
      totalScans,
      uniqueDevices: uniqueDevices.size,
      totalConversions,
      conversionRate: totalScans > 0 ? (totalConversions / totalScans) * 100 : 0,
      averageTimeOnPage: scanCount > 0 ? totalTimeOnPage / scanCount : 0,
      totalConversionValue: 0 // Not tracked yet
    };

    console.log(`📊 [QR Stats] Stats calculated: ${totalScans} total scans from ${uniqueDevices.size} devices`);

    res.json({
      success: true,
      stats,
      locationStats,
      message: 'QR scan statistics retrieved successfully',
      metadata: {
        adId,
        adTitle: ad.title,
        materials: materialIdStrings,
        dateRange: startDate && endDate ? { startDate, endDate } : null
      }
    });

  } catch (error) {
    console.error('Error fetching QR scan stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
      
      // ✅ UPDATED: Find all deployments for this material (both RUNNING and SCHEDULED ads)
      // SCHEDULED ads reserve slots even before they start - company ads fill those slots until start date
      const deployments = await AdsDeployment.find({
        materialId: materialId,
        'lcdSlots.status': { $in: ['RUNNING', 'SCHEDULED'] },
        'lcdSlots.endTime': { $gte: currentTime } // Only include ads that haven't ended yet
      }).populate('lcdSlots.adId');
      
      console.log('Found deployments for material:', deployments.length);
      
      // Collect RUNNING ads (currently playing) and SCHEDULED ads (reserved slots)
      const runningAds = [];
      const scheduledSlots = []; // Track slots reserved by scheduled ads
      
      deployments.forEach(deployment => {
        console.log('Processing deployment:', {
          id: deployment._id,
          materialId: deployment.materialId,
          lcdSlotsCount: deployment.lcdSlots.length
        });
        
        deployment.lcdSlots.forEach(slot => {
          // Skip archived ads
          if (slot.adId && (slot.adId.status === 'ARCHIVED' || slot.adId.isArchived === true)) {
            console.log('Skipping archived ad in slot:', {
              slotNumber: slot.slotNumber,
              adId: slot.adId._id,
              adTitle: slot.adId.title,
              status: slot.adId.status,
              isArchived: slot.adId.isArchived
            });
            return;
          }
          
          // RUNNING ads OR SCHEDULED ads whose startTime has arrived: show the actual ad immediately
          // This allows ads to start playing at exactly their start time even before the cron job runs
          if ((slot.status === 'RUNNING' || slot.status === 'SCHEDULED') && 
              slot.startTime <= currentTime && 
              slot.endTime >= currentTime && 
              slot.adId) {
            
            console.log(`Found ${slot.status === 'SCHEDULED' ? 'SCHEDULED (auto-promoted)' : 'RUNNING'} ad in slot:`, {
              slotNumber: slot.slotNumber,
              adId: slot.adId._id,
              adTitle: slot.adId.title,
              status: slot.status,
              startTime: slot.startTime
            });
            
            runningAds.push({
              slotNumber: slot.slotNumber,
              adData: {
                adId: slot.adId._id.toString(),
                adDeploymentId: deployment._id.toString(),
                slotNumber: requestedSlotNumber,
                startTime: slot.startTime.toISOString(),
                endTime: slot.endTime.toISOString(),
                status: slot.status, // Keep original status for tracking
                mediaFile: slot.mediaFile,
                adTitle: slot.adId.title,
                adDescription: slot.adId.description || '',
                website: slot.adId.website || null,
                duration: slot.adId.adLengthSeconds || 30,
                createdAt: slot.createdAt,
                updatedAt: slot.updatedAt
              }
            });
          }
          // SCHEDULED ads: startTime hasn't arrived yet, reserve slot with company ad
          else if (slot.status === 'SCHEDULED' && 
                   slot.startTime > currentTime && 
                   slot.endTime >= currentTime && 
                   slot.adId) {
            
            console.log('Found SCHEDULED ad reserving slot:', {
              slotNumber: slot.slotNumber,
              adId: slot.adId._id,
              adTitle: slot.adId.title,
              startTime: slot.startTime,
              reservedUntil: slot.startTime
            });
            
            scheduledSlots.push({
              slotNumber: slot.slotNumber,
              reservedUntil: slot.startTime,
              scheduledAdId: slot.adId._id.toString()
            });
          }
        });
      });

      // Sort running ads by slot number to maintain order
      runningAds.sort((a, b) => a.slotNumber - b.slotNumber);
      const allActiveAds = runningAds.map(item => item.adData);

      console.log(`Found ${allActiveAds.length} RUNNING ads and ${scheduledSlots.length} SCHEDULED slots for material ${materialId}`);
      
      // ✅ COMPANY AD FILLER SYSTEM: 
      // 1. Fill slots reserved by SCHEDULED ads (company ads play until scheduled ad starts)
      // 2. Fill remaining empty slots up to MAX_SLOTS (5)
      const MAX_SLOTS = 5;
      const reservedSlotNumbers = new Set([
        ...runningAds.map(ad => ad.slotNumber),
        ...scheduledSlots.map(slot => slot.slotNumber)
      ]);
      const slotsToFill = MAX_SLOTS - reservedSlotNumbers.size;
      
      try {
        // Fetch active company ads using the model's static method
        const companyAds = await CompanyAd.getCurrentlyActiveAds();
        
        if (companyAds && companyAds.length > 0) {
          console.log(`📦 [CompanyAdFiller] Found ${companyAds.length} active company ads available`);
          
          const selectedCompanyAds = [];
          
          // First: Add company ads for SCHEDULED slots (reserved slots waiting for start date)
          if (scheduledSlots.length > 0) {
            console.log(`📦 [CompanyAdFiller] Adding company ads for ${scheduledSlots.length} SCHEDULED slot(s) as fillers until start date`);
            for (const scheduledSlot of scheduledSlots) {
              const companyAd = await CompanyAd.getRandomScheduledAd();
              if (companyAd) {
                selectedCompanyAds.push({
                  adId: companyAd._id.toString(),
                  adDeploymentId: null,
                  slotNumber: requestedSlotNumber,
                  startTime: null,
                  endTime: null,
                  status: 'RUNNING',
                  mediaFile: companyAd.mediaFile,
                  adTitle: companyAd.title,
                  adDescription: companyAd.description || '',
                  website: null,
                  duration: companyAd.duration,
                  createdAt: companyAd.createdAt,
                  updatedAt: companyAd.updatedAt,
                  isCompanyAd: true,
                  isReservedForScheduled: true, // ✅ Flag to indicate this slot is reserved for a scheduled ad
                  reservedUntil: scheduledSlot.reservedUntil.toISOString(),
                  scheduledAdId: scheduledSlot.scheduledAdId
                });
              }
            }
          }
          
          // Second: Fill remaining empty slots with company ads
          if (slotsToFill > 0) {
            console.log(`📦 [CompanyAdFiller] Adding company ads for ${slotsToFill} empty slot(s)`);
            for (let i = 0; i < slotsToFill; i++) {
              const companyAd = await CompanyAd.getRandomScheduledAd();
              if (companyAd) {
                selectedCompanyAds.push({
                  adId: companyAd._id.toString(),
                  adDeploymentId: null,
                  slotNumber: requestedSlotNumber,
                  startTime: null,
                  endTime: null,
                  status: 'RUNNING',
                  mediaFile: companyAd.mediaFile,
                  adTitle: companyAd.title,
                  adDescription: companyAd.description || '',
                  website: null,
                  duration: companyAd.duration,
                  createdAt: companyAd.createdAt,
                  updatedAt: companyAd.updatedAt,
                  isCompanyAd: true
                });
              }
            }
          }
          
          // Add all company ads to the rotation
          if (selectedCompanyAds.length > 0) {
            allActiveAds.push(...selectedCompanyAds);
            const scheduledCount = scheduledSlots.length;
            const emptyCount = slotsToFill;
            console.log(`✅ [CompanyAdFiller] Added ${selectedCompanyAds.length} company ads (${scheduledCount} for scheduled slots, ${emptyCount} for empty slots). Total ads in rotation: ${allActiveAds.length}`);
          }
        } else {
          console.log(`⚠️ [CompanyAdFiller] No active company ads available to fill ${scheduledSlots.length} scheduled slots and ${slotsToFill} empty slots`);
        }
      } catch (error) {
        console.error('❌ [CompanyAdFiller] Error fetching company ads:', error);
        // Continue without company ads if there's an error
      }
      
      // Final check: ensure we have ads in rotation
      if (allActiveAds.length === 0) {
        console.log(`⚠️ [Rotation] No ads available (no RUNNING ads, no SCHEDULED slots, no company ads)`);
      } else if (reservedSlotNumbers.size >= MAX_SLOTS && scheduledSlots.length === 0) {
        console.log(`✅ [Rotation] All ${MAX_SLOTS} slots filled with RUNNING user ads`);
      } else {
        console.log(`✅ [Rotation] ${allActiveAds.length} ads in rotation: ${runningAds.length} RUNNING, ${scheduledSlots.length} SCHEDULED (company ads filling), ${allActiveAds.length - runningAds.length - scheduledSlots.length} company fillers`);
      }
      
      // Debug: Log the first ad to see if website field is included
      if (allActiveAds.length > 0) {
        console.log('First ad data:', {
          adId: allActiveAds[0].adId,
          adTitle: allActiveAds[0].adTitle,
          website: allActiveAds[0].website,
          hasWebsite: !!allActiveAds[0].website,
          isCompanyAd: allActiveAds[0].isCompanyAd || false
        });
      }
      
      console.log(`🎬 [Final Rotation] Returning ${allActiveAds.length} ads:`, 
        allActiveAds.map((ad, i) => `${i + 1}. ${ad.isCompanyAd ? '🏢' : '👤'} ${ad.adTitle}`).join(', ')
      );

      res.json({
        success: true,
        ads: allActiveAds,
        message: `Found ${allActiveAds.length} ads (${allActiveAds.filter(a => !a.isCompanyAd).length} user, ${allActiveAds.filter(a => a.isCompanyAd).length} company)`
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
    let geocodedAddress = '';
    if (gpsData && gpsData.lat && gpsData.lng) {
      locationData = {
        type: 'Point',
        coordinates: [gpsData.lng, gpsData.lat] // GeoJSON format: [longitude, latitude]
      };
      
      // Geocode GPS coordinates to get human-readable address
      try {
        console.log(`🗺️ [QR Scan] Geocoding QR scan location: ${gpsData.lat}, ${gpsData.lng}`);
        geocodedAddress = await OSMService.reverseGeocode(gpsData.lat, gpsData.lng);
        console.log(`🗺️ [QR Scan] Geocoded address: ${geocodedAddress}`);
      } catch (error) {
        console.warn(`🗺️ [QR Scan] Geocoding failed, will store coordinates only:`, error.message);
        geocodedAddress = `GPS: ${gpsData.lat.toFixed(6)}, ${gpsData.lng.toFixed(6)}`;
      }
    }

    // QR scan will only be saved to device analytics document (no separate QRScanTracking documents)

    // DeviceCompliance is now PHOTOS ONLY - no analytics data
    // QR scan analytics are handled by DeviceTracking and Analytics collections

    // Process registration data
    
    // Use the new ad-based analytics structure
    
    // Try to get device ID from registration or device info first
    let deviceIdToUse = (registrationData && registrationData.deviceId) || (deviceInfo && deviceInfo.deviceId);
    
    if (!deviceIdToUse) {
      // Use fallback device ID for QR scans without device info
      deviceIdToUse = `QR-SCAN-${materialId}-${slotNumber}-${Date.now()}`;
    } else {
    }
    
    // Get userId from Ad collection
    const ad = await Ad.findById(adId).select('userId');
    
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }
    
    const userId = ad.userId.toString();
    
    // Create QR scan data with geocoded address
    const qrScanData = {
      adId: adId,
      userId: userId,
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
      address: geocodedAddress, // ✅ Store geocoded address
      timeOnPage: 0,
      converted: false,
      conversionType: null,
      conversionValue: 0
    };
    
    // Save QR scan to deviceTracking collection (analytics will fetch from here)
    try {
      const DeviceTracking = require('../models/deviceTracking');
      
      // Find existing device tracking record for this material
      // ✅ FIX: Use today's date to ensure we update the correct day's record
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let deviceTracking = await DeviceTracking.findOne({
        materialId: materialId,
        date: today
      });
      
      // If no record for today, try to get the most recent one
      if (!deviceTracking) {
        deviceTracking = await DeviceTracking.findOne({
          materialId: materialId
        }).sort({ date: -1 });
      }
      
      if (!deviceTracking) {
        // Create new record for today (today variable already set above)
        const farFuture = new Date('2099-12-31T23:59:59Z'); // Sentinel value for offline devices
        
        deviceTracking = new DeviceTracking({
          materialId: materialId,
          carGroupId: 'GRP-UNKNOWN', // Will be updated when device connects
          screenType: 'HEADDRESS',
          date: today,
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
            date: today,
            startTime: farFuture,  // ✅ FIX: Use sentinel value - will be set when device comes online
            endTime: null,
            totalHoursOnline: 0,
            totalDistanceTraveled: 0,
            isActive: false,  // ✅ FIX: Set to false since device is offline
            targetHours: 8,
            complianceStatus: 'PENDING',
            locationHistory: [],
            lastOnlineUpdate: null  // ✅ FIX: Initialize to null
          }
        });
      }
      
      // ✅ MASTER-SLAVE: Determine if this is the master slot before incrementing totals
      let isMasterSlot = false;
      
      if (deviceTracking.slots && deviceTracking.slots.length > 0) {
        const slot1 = deviceTracking.slots.find(s => s.slotNumber === 1 && s.deviceId);
        const slot2 = deviceTracking.slots.find(s => s.slotNumber === 2 && s.deviceId);
        
        // Get online status from DeviceStatusManager
        const deviceStatusService = require('../services/deviceStatusService');
        const slot1Online = slot1 && slot1.deviceId && deviceStatusService.getDeviceStatus(slot1.deviceId)?.isOnline;
        const slot2Online = slot2 && slot2.deviceId && deviceStatusService.getDeviceStatus(slot2.deviceId)?.isOnline;
        
        if (slot1Online && slotNumber === 1) {
          isMasterSlot = true;
          console.log(`👑 [QRScan /ads] Slot 1 is master - counting analytics`);
        } else if (!slot1Online && slot2Online && slotNumber === 2) {
          isMasterSlot = true;
          console.log(`👑 [QRScan /ads] Slot 2 is master (failover) - counting analytics`);
        } else {
          console.log(`💤 [QRScan /ads] Slot ${slotNumber} is slave - NOT counting in totals`);
        }
      } else {
        // Fallback: if no slot info, accept all data
        isMasterSlot = true;
        console.log(`⚠️ [QRScan /ads] No slot info, accepting all data (fallback)`);
      }
      
      // Check if this is a new day - if so, we need to ensure we're using today's record
      const recordDate = new Date(deviceTracking.date);
      recordDate.setHours(0, 0, 0, 0);
      // today is already declared above (line 806), so we reuse it
      const isNewDay = recordDate.getTime() !== today.getTime();
      
      // If it's a new day and we're using an old record, create a new record for today
      if (isNewDay) {
        console.log(`📅 [QRScan /ads] New day detected. Creating new record for today.`);
        
        // Create a new record for today (per-day tracking)
        deviceTracking = new DeviceTracking({
          materialId,
          carGroupId: deviceTracking.carGroupId || 'GRP-UNKNOWN',
          screenType: deviceTracking.screenType || 'HEADDRESS',
          date: today,
          isOnline: true,
          lastSeen: new Date(),
          slots: deviceTracking.slots || [{
            slotNumber: parseInt(slotNumber),
            deviceId,
            isOnline: true,
            lastSeen: new Date(),
            deviceInfo: {}
          }],
          currentSession: {
            date: today,
            startTime: new Date(),
            lastOnlineUpdate: new Date(),
            totalHoursOnline: 0,
            totalDistanceTraveled: 0,
            targetHours: 8,
            complianceStatus: 'NON_COMPLIANT',
            isActive: true
          },
          totalQRScans: 0,
          qrScans: [],
          qrScansByAd: []
        });
        await deviceTracking.save();
      }
      
      // Store the current count before adding the new scan
      const currentCount = deviceTracking.totalQRScans || 0;
      
      // Add QR scan to deviceTracking (always store with slotNumber)
      deviceTracking.qrScans.push(qrScanData);
      
      // ✅ FIX: Increment totalQRScans instead of recalculating from array length
      // This ensures persistence and prevents reset issues when the array might be filtered
      if (isMasterSlot) {
        // Increment the count - this ensures it persists correctly
        deviceTracking.totalQRScans = currentCount + 1;
        console.log(`✅ [QRScan /ads] Incremented count: ${currentCount} → ${deviceTracking.totalQRScans}`);
      } else {
        // For slave slots, don't increment the count (only master slot counts)
        // But ensure the count is at least set to the array length if it's unset
        if (deviceTracking.totalQRScans === undefined || deviceTracking.totalQRScans === null) {
          deviceTracking.totalQRScans = deviceTracking.qrScans.length;
        }
        console.log(`💤 [QRScan /ads] Slave slot - count remains: ${deviceTracking.totalQRScans}`);
      }
      
      // Mark qrScans as modified to ensure post-save hook triggers archiving
      deviceTracking.markModified('qrScans');
      deviceTracking.markModified('totalQRScans');
      
      if (isMasterSlot) {
        console.log(`✅ [QRScan /ads] Master slot - counted in analytics (total: ${deviceTracking.totalQRScans})`);
      } else {
        console.log(`💤 [QRScan /ads] Slave slot - stored but not counted in analytics (total: ${deviceTracking.totalQRScans})`);
      }
      
      // ✅ Update QR scans by ad (only for master slot)
      if (isMasterSlot) {
        // ✅ FIX: Normalize adId to string for comparison (handles ObjectId vs string)
        const adIdStr = qrScanData.adId ? qrScanData.adId.toString() : null;
        const existingAdScan = deviceTracking.qrScansByAd.find(scan => {
          const scanAdIdStr = scan.adId ? scan.adId.toString() : null;
          return scanAdIdStr === adIdStr;
        });
        
        if (existingAdScan) {
          // ✅ CRITICAL FIX: Before incrementing, validate against actual array count
          // Count how many scans exist in the array for this ad
          const actualArrayCount = deviceTracking.qrScans.filter(scan => {
            const scanAdId = scan.adId ? scan.adId.toString() : null;
            return scanAdId === adIdStr;
          }).length;
          
          const previousCount = existingAdScan.scanCount || 0;
          
          // If array count is higher than scanCount, the count was reset - repair it
          if (actualArrayCount > previousCount) {
            console.log(`🔧 [QRScan /ads] REPAIR: Ad "${qrScanData.adTitle || 'Unknown'}" (${adIdStr}) - scanCount was ${previousCount}, but array has ${actualArrayCount} scans. Repairing...`);
            existingAdScan.scanCount = actualArrayCount; // Set to actual count first
          }
          
          // Now increment from the repaired/correct count
          existingAdScan.scanCount = (existingAdScan.scanCount || 0) + 1;
          existingAdScan.lastScanned = new Date();
          console.log(`✅ [QRScan /ads] Updated existing ad scan: ${qrScanData.adTitle || 'Unknown'} (${adIdStr}) - count: ${previousCount} → ${existingAdScan.scanCount}`);
        } else {
          deviceTracking.qrScansByAd.push({
            adId: qrScanData.adId,
            userId: qrScanData.userId, // ✅ FIX: Include userId which is required by schema
            adTitle: qrScanData.adTitle || 'Unknown',
            scanCount: 1,
            lastScanned: new Date(),
            firstScanned: new Date()
          });
          console.log(`✅ [QRScan /ads] Created new ad scan entry: ${qrScanData.adTitle || 'Unknown'} (${adIdStr}) - count: 1`);
        }
        // ✅ CRITICAL: Mark qrScansByAd as modified so Mongoose persists the changes
        deviceTracking.markModified('qrScansByAd');
      } else {
        console.log(`💤 [QRScan /ads] Slave slot - skipping qrScansByAd update`);
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

    // ⚠️ DEPRECATED: Analytics collection writes removed
    // QR scans are now tracked via DeviceTracking/DeviceDataHistoryV2 when devices report them
    // QR scan tracking happens automatically when Android players send QR scan events
    if (adId && adTitle && materialId && slotNumber) {
      try {
        // QR scan is logged but not written to Analytics collection
        // Real QR scan tracking happens via device tracking system
        console.log(`ℹ️ QR scan logged for ad: ${adTitle} (tracked via DeviceTracking/DeviceDataHistoryV2)`);
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

// GET /ads/:adId/devices - Get devices that have a specific ad deployed
router.get('/:adId/devices', async (req, res) => {
  try {
    const { adId } = req.params;
    
    console.log(`🔍 Fetching devices for ad: ${adId}`);
    
    // Find all devices that have this ad in their deployedAds array
    const DeviceTracking = require('../models/deviceTracking');
    const devices = await DeviceTracking.find({
      'deployedAds.adId': adId
    }).lean();
    
    console.log(`📱 Found ${devices.length} devices with ad ${adId}`);
    
    // Transform the data to include device info and current status
    const deviceStatusService = require('../services/deviceStatusService');
    
    const deviceList = devices.map(device => {
      const deviceStatus = deviceStatusService.getDeviceStatus(device.materialId);
      const isOnline = deviceStatus?.isOnline || device.isOnline || false;
      const lastSeen = deviceStatus?.lastSeen || device.lastSeen;
      
      // Find the specific ad deployment info
      const adDeployment = device.deployedAds.find(ad => ad.adId === adId);
      
      return {
        deviceId: device.materialId,
        materialId: device.materialId,
        isOnline,
        lastSeen,
        currentLocation: device.currentLocation,
        totalDistance: device.totalDistanceToday || 0,
        currentHours: device.currentHours || 0,
        adDeployment: adDeployment ? {
          slotNumber: adDeployment.slotNumber,
          status: adDeployment.status,
          startTime: adDeployment.startTime,
          endTime: adDeployment.endTime
        } : null,
        deviceInfo: device.deviceInfo || {}
      };
    });
    
    res.json({
      success: true,
      devices: deviceList,
      totalDevices: deviceList.length,
      onlineDevices: deviceList.filter(d => d.isOnline).length
    });
    
  } catch (error) {
    console.error('Error fetching devices for ad:', error);
    res.status(500).json({
      success: false,
      devices: [],
      message: 'Internal server error'
    });
  }
});

module.exports = router;
