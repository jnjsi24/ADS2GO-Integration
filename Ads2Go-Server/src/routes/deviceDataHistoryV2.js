const express = require('express');
const router = express.Router();
const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
const { getPhilippinesDateString } = require('../utils/dateUtils');

// Get all materials with their daily data (optimized with pagination and filtering)
router.get('/materials', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      search = '', 
      startDate, 
      endDate,
      materialId,
      carGroupId 
    } = req.query;

    // Build query
    let query = {};
    
    // Search by materialId or carGroupId
    if (search) {
      query.$or = [
        { materialId: { $regex: search, $options: 'i' } },
        { carGroupId: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (materialId) {
      query.materialId = materialId;
    }
    
    if (carGroupId) {
      query.carGroupId = carGroupId;
    }

    // Optimize: Exclude heavy fields like locationHistory from initial fetch
    const materials = await DeviceDataHistoryV2.find(query)
      .select('materialId carGroupId dailyData.date dailyData.totalAdPlays dailyData.totalQRScans dailyData.totalDistanceTraveled dailyData.totalHoursOnline dailyData.totalAdImpressions dailyData.totalAdPlayTime dailyData.networkStatus dailyData.complianceData lifetimeTotals')
      .lean()
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ updatedAt: -1 });

    // Filter daily data by date range if provided
    let processedMaterials = materials;
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : new Date('2000-01-01');
      const end = endDate ? new Date(endDate) : new Date('2100-12-31');
      
      processedMaterials = materials.map(material => ({
        ...material,
        dailyData: material.dailyData.filter(day => {
          const dayDate = new Date(day.date);
          return dayDate >= start && dayDate <= end;
        })
      })).filter(material => material.dailyData.length > 0);
    }

    // Get total count for pagination
    const totalCount = await DeviceDataHistoryV2.countDocuments(query);

    res.json({
      success: true,
      count: processedMaterials.length,
      totalCount,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCount / parseInt(limit)),
      materials: processedMaterials
    });
  } catch (error) {
    console.error('Error fetching materials:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch materials'
    });
  }
});

// Get specific material with daily data
router.get('/materials/:materialId', async (req, res) => {
  try {
    const { materialId } = req.params;
    const material = await DeviceDataHistoryV2.findOne({ materialId })
      .lean();

    if (!material) {
      return res.status(404).json({
        success: false,
        error: 'Material not found'
      });
    }

    // Add display labels to daily data
    const materialWithLabels = {
      ...material,
      dailyData: material.dailyData.map(day => ({
        ...day,
        displayLabel: `${day.date.toISOString().split('T')[0]} (${day.totalAdPlays || 0} plays, ${day.locationHistory?.length || 0} locs)`
      }))
    };

    res.json({
      success: true,
      material: materialWithLabels
    });
  } catch (error) {
    console.error('Error fetching material:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch material'
    });
  }
});

// Get daily data for specific date range
router.get('/materials/:materialId/daily-data', async (req, res) => {
  try {
    const { materialId } = req.params;
    const { startDate, endDate } = req.query;

    let query = { materialId };
    
    if (startDate && endDate) {
      query['dailyData.date'] = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const material = await DeviceDataHistoryV2.findOne(query, {
      'dailyData.$': 1,
      materialId: 1,
      carGroupId: 1
    }).lean();

    if (!material) {
      return res.status(404).json({
        success: false,
        error: 'Material or date range not found'
      });
    }

    // Add display labels
    const dailyDataWithLabels = material.dailyData.map(day => ({
      ...day,
      displayLabel: `${day.date.toISOString().split('T')[0]} (${day.totalAdPlays || 0} plays, ${day.locationHistory?.length || 0} locs)`
    }));

    res.json({
      success: true,
      materialId: material.materialId,
      carGroupId: material.carGroupId,
      dailyData: dailyDataWithLabels
    });
  } catch (error) {
    console.error('Error fetching daily data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch daily data'
    });
  }
});

// Get summary with display labels
router.get('/summary', async (req, res) => {
  try {
    const materials = await DeviceDataHistoryV2.find({})
      .select('materialId carGroupId dailyData.length lifetimeTotals')
      .lean();

    const summary = materials.map(material => ({
      materialId: material.materialId,
      carGroupId: material.carGroupId,
      totalDays: material.dailyData.length,
      lifetimeTotals: material.lifetimeTotals,
      recentDays: material.dailyData.slice(-3).map(day => ({
        date: day.date.toISOString().split('T')[0],
        displayLabel: `${day.date.toISOString().split('T')[0]} (${day.totalAdPlays || 0} plays, ${day.locationHistory?.length || 0} locs)`,
        totalAdPlays: day.totalAdPlays,
        totalHoursOnline: day.totalHoursOnline
      }))
    }));

    res.json({
      success: true,
      count: summary.length,
      summary
    });
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch summary'
    });
  }
});

// PUT /materials/:materialId/daily-data/:date - Update specific daily data
router.put('/materials/:materialId/daily-data/:date', async (req, res) => {
  try {
    const { materialId, date } = req.params;
    const updateData = req.body;

    // Parse the date
    const targetDate = new Date(date);

    const todayStr = getPhilippinesDateString();
    const targetDateStr = getPhilippinesDateString(targetDate);
    const isToday = targetDateStr === todayStr;

    console.log(`🔄 Updating data for ${materialId} on ${date} (${isToday ? 'TODAY' : 'PAST DATE'})`);
    console.log(`📊 Update data received:`, updateData);

    if (isToday) {
      const DeviceTracking = require('../models/deviceTracking');
      
      let deviceTracking = await DeviceTracking.findOne({ materialId });
      
      if (!deviceTracking) {
        deviceTracking = new DeviceTracking({
          materialId,
          carGroupId: req.body.carGroupId || 'UNKNOWN',
          screenType: 'HEADDRESS',
          date: todayStr,
          isOnline: true,
          lastSeen: new Date(),
          currentSession: {
            date: todayStr,
            startTime: new Date(),
            lastOnlineUpdate: new Date(),
            totalHoursOnline: updateData.totalHoursOnline || 0,
            totalDistanceTraveled: updateData.totalDistanceTraveled || 0,
            targetHours: 8,
            complianceStatus: 'NON_COMPLIANT',
            isActive: true
          }
        });
      } else {
        // Update existing DeviceTracking record
        if (updateData.totalDistanceTraveled !== undefined) {
          deviceTracking.totalDistanceTraveled = updateData.totalDistanceTraveled;
        }
        if (updateData.totalHoursOnline !== undefined) {
          deviceTracking.totalHoursOnline = updateData.totalHoursOnline;
        }
        if (updateData.totalAdPlays !== undefined) {
          deviceTracking.totalAdPlays = updateData.totalAdPlays;
        }
        if (updateData.totalQRScans !== undefined) {
          deviceTracking.totalQRScans = updateData.totalQRScans;
        }
        
        // Update current session
        if (deviceTracking.currentSession) {
          if (updateData.totalDistanceTraveled !== undefined) {
            deviceTracking.currentSession.totalDistanceTraveled = updateData.totalDistanceTraveled;
          }
          if (updateData.totalHoursOnline !== undefined) {
            deviceTracking.currentSession.totalHoursOnline = updateData.totalHoursOnline;
          }
        }
        
        deviceTracking.updatedAt = new Date();
      }

      // Mark the document as modified to ensure post-save hooks are triggered
      deviceTracking.markModified('totalDistanceTraveled');
      deviceTracking.markModified('totalHoursOnline');
      deviceTracking.markModified('currentSession');

      await deviceTracking.save();
      console.log(`✅ Updated DeviceTracking for ${materialId} (current date)`);

      // Also update DeviceDataHistoryV2 for consistency
      const material = await DeviceDataHistoryV2.findOne({ materialId });
      if (material) {
        const dailyDataIndex = material.dailyData.findIndex(day => {
          const dayDate = new Date(day.date);
          dayDate.setHours(0, 0, 0, 0);
          return dayDate.getTime() === targetDate.getTime();
        });

        if (dailyDataIndex !== -1) {
          Object.keys(updateData).forEach(key => {
            if (key !== '_id' && key !== 'date') {
              material.dailyData[dailyDataIndex][key] = updateData[key];
            }
          });
          material.dailyData[dailyDataIndex].lastDataUpdate = new Date();
          material.dailyData[dailyDataIndex].lastUpdateType = 'manual_edit_current';
          material.dailyData[dailyDataIndex].updateCount = (material.dailyData[dailyDataIndex].updateCount || 0) + 1;
          material.updatedAt = new Date();
          
          // Mark the document as modified to ensure post-save hooks are triggered
          material.markModified('dailyData');
          material.markModified('lifetimeTotals');
          
          await material.save();
        }
      }

      // Manually trigger salary update for current date changes
      try {
        console.log(`💰 Triggering manual salary update for ${materialId} on ${date}...`);
        const realTimeSalaryUpdateService = require('../services/realTimeSalaryUpdateService');
        await realTimeSalaryUpdateService.updateSalaryCalculations(materialId, date);
        console.log(`✅ Manual salary update completed for ${materialId} on ${date}`);
      } catch (salaryError) {
        console.error(`❌ Manual salary update failed for ${materialId}:`, salaryError.message);
      }

      res.json({
        success: true,
        message: 'Current date data updated successfully (DeviceTracking + DeviceDataHistoryV2)',
        data: {
          materialId,
          date: targetDate,
          updateType: 'current_date',
          updatedFields: Object.keys(updateData)
        }
      });

    } else {
      // Update DeviceDataHistoryV2 collection for past dates
    const material = await DeviceDataHistoryV2.findOne({ materialId });

    if (!material) {
      return res.status(404).json({
        success: false,
        error: 'Material not found'
      });
    }

    // Find the daily data entry index
    const dailyDataIndex = material.dailyData.findIndex(day => {
      const dayDate = new Date(day.date);
      dayDate.setHours(0, 0, 0, 0);
      return dayDate.getTime() === targetDate.getTime();
    });

    if (dailyDataIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Daily data for specified date not found'
      });
    }

      // Update the daily data entry
      Object.keys(updateData).forEach(key => {
        if (key !== '_id' && key !== 'date') {
          material.dailyData[dailyDataIndex][key] = updateData[key];
        }
      });

      // Update metadata
      material.dailyData[dailyDataIndex].lastDataUpdate = new Date();
      material.dailyData[dailyDataIndex].lastUpdateType = 'manual_edit_past';
      material.dailyData[dailyDataIndex].updateCount = (material.dailyData[dailyDataIndex].updateCount || 0) + 1;
      material.updatedAt = new Date();

      // Mark the document as modified to ensure post-save hooks are triggered
      material.markModified('dailyData');
      material.markModified('lifetimeTotals');

      await material.save();
      console.log(`✅ Updated DeviceDataHistoryV2 for ${materialId} (past date: ${date})`);

      // Manually trigger salary update for past date changes
      try {
        console.log(`💰 Triggering manual salary update for ${materialId} on ${date}...`);
        const realTimeSalaryUpdateService = require('../services/realTimeSalaryUpdateService');
        await realTimeSalaryUpdateService.updateSalaryCalculations(materialId, date);
        console.log(`✅ Manual salary update completed for ${materialId} on ${date}`);
      } catch (salaryError) {
        console.error(`❌ Manual salary update failed for ${materialId}:`, salaryError.message);
      }

    res.json({
      success: true,
        message: 'Past date data updated successfully (DeviceDataHistoryV2)',
        data: {
          materialId,
          date: targetDate,
          updateType: 'past_date',
          updatedFields: Object.keys(updateData),
          dailyData: material.dailyData[dailyDataIndex]
        }
      });
    }

  } catch (error) {
    console.error('Error updating daily data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update daily data'
    });
  }
});

// DELETE /materials/:materialId/daily-data/:date - Delete specific daily data
router.delete('/materials/:materialId/daily-data/:date', async (req, res) => {
  try {
    const { materialId, date } = req.params;

    // Parse the date
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    // Find and update the material
    const material = await DeviceDataHistoryV2.findOne({ materialId });

    if (!material) {
      return res.status(404).json({
        success: false,
        error: 'Material not found'
      });
    }

    // Find the daily data entry index
    const dailyDataIndex = material.dailyData.findIndex(day => {
      const dayDate = new Date(day.date);
      dayDate.setHours(0, 0, 0, 0);
      return dayDate.getTime() === targetDate.getTime();
    });

    if (dailyDataIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Daily data for specified date not found'
      });
    }

    // Remove the daily data entry
    material.dailyData.splice(dailyDataIndex, 1);
    material.updatedAt = new Date();

    await material.save();

    res.json({
      success: true,
      message: 'Daily data deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting daily data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete daily data'
    });
  }
});

module.exports = router;
