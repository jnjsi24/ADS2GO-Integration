const express = require('express');
const router = express.Router();
const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');

// Get all materials with their daily data
router.get('/materials', async (req, res) => {
  try {
    const materials = await DeviceDataHistoryV2.find({})
      .select('materialId carGroupId dailyData lifetimeTotals')
      .lean();

    // Add display labels to each daily data entry
    const materialsWithLabels = materials.map(material => ({
      ...material,
      dailyData: material.dailyData.map(day => ({
        ...day,
        displayLabel: `${day.date.toISOString().split('T')[0]} (${day.totalAdPlays || 0} plays, ${day.locationHistory?.length || 0} locs)`
      }))
    }));

    res.json({
      success: true,
      count: materialsWithLabels.length,
      materials: materialsWithLabels
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

module.exports = router;
