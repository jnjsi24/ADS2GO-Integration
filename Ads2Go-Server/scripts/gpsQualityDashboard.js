#!/usr/bin/env node

/**
 * GPS Quality Dashboard
 * Monitors and reports GPS data quality across all devices
 */

const mongoose = require('mongoose');
const DeviceDataHistoryV2 = require('../src/models/deviceDataHistoryV2');
const GPSValidation = require('../src/utils/gpsValidation');

async function generateGPSQualityDashboard() {
  try {
    console.log('📊 [GPS Quality Dashboard] Starting analysis...');
    
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/ads2go');
    console.log('✅ Connected to MongoDB');

    // Get all devices
    const devices = await DeviceDataHistoryV2.find({}).select('materialId carGroupId dailyData');
    console.log(`\n🔍 Analyzing ${devices.length} devices...`);

    const qualityReport = {
      totalDevices: devices.length,
      devices: [],
      overallStats: {
        totalPoints: 0,
        validPoints: 0,
        invalidPoints: 0,
        averageQuality: 0,
        devicesWithIssues: 0
      }
    };

    for (const device of devices) {
      console.log(`\n📱 Analyzing device: ${device.materialId}`);
      
      const deviceReport = {
        materialId: device.materialId,
        carGroupId: device.carGroupId,
        totalDays: device.dailyData.length,
        days: [],
        overallQuality: 0,
        hasIssues: false
      };

      let totalDevicePoints = 0;
      let validDevicePoints = 0;
      let totalQualityScore = 0;
      let dayCount = 0;

      // Analyze each day's data
      for (const dailyData of device.dailyData) {
        if (dailyData.locationHistory && dailyData.locationHistory.length > 0) {
          const dayReport = {
            date: dailyData.date.toISOString().split('T')[0],
            totalPoints: dailyData.locationHistory.length,
            quality: GPSValidation.calculateDataQuality(dailyData.locationHistory)
          };

          // Clean the data to see improvement
          const cleanedData = GPSValidation.cleanGPSData(dailyData.locationHistory, {
            strictMode: false,
            maxAccuracy: 100,
            requirePhilippinesBounds: true,
            removeDrift: true
          });

          dayReport.cleanedPoints = cleanedData.length;
          dayReport.improvement = ((cleanedData.length / dailyData.locationHistory.length) * 100).toFixed(1);
          dayReport.hasIssues = dayReport.quality.score < 70;

          deviceReport.days.push(dayReport);
          totalDevicePoints += dailyData.locationHistory.length;
          validDevicePoints += cleanedData.length;
          totalQualityScore += dayReport.quality.score;
          dayCount++;

          if (dayReport.hasIssues) {
            deviceReport.hasIssues = true;
          }
        }
      }

      // Calculate device overall quality
      deviceReport.overallQuality = dayCount > 0 ? Math.round(totalQualityScore / dayCount) : 0;
      deviceReport.totalPoints = totalDevicePoints;
      deviceReport.validPoints = validDevicePoints;
      deviceReport.dataQuality = totalDevicePoints > 0 ? ((validDevicePoints / totalDevicePoints) * 100).toFixed(1) : 0;

      qualityReport.devices.push(deviceReport);
      qualityReport.overallStats.totalPoints += totalDevicePoints;
      qualityReport.overallStats.validPoints += validDevicePoints;
      qualityReport.overallStats.invalidPoints += (totalDevicePoints - validDevicePoints);

      if (deviceReport.hasIssues) {
        qualityReport.overallStats.devicesWithIssues++;
      }

      console.log(`  📊 Quality: ${deviceReport.overallQuality}/100 (${deviceReport.dataQuality}% valid points)`);
      if (deviceReport.hasIssues) {
        console.log(`  ⚠️  Has GPS quality issues`);
      }
    }

    // Calculate overall statistics
    qualityReport.overallStats.averageQuality = qualityReport.devices.length > 0 
      ? Math.round(qualityReport.devices.reduce((sum, d) => sum + d.overallQuality, 0) / qualityReport.devices.length)
      : 0;

    // Display summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 GPS QUALITY DASHBOARD SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`\n📱 Device Statistics:`);
    console.log(`  Total Devices: ${qualityReport.totalDevices}`);
    console.log(`  Devices with Issues: ${qualityReport.overallStats.devicesWithIssues}`);
    console.log(`  Devices with Good GPS: ${qualityReport.totalDevices - qualityReport.overallStats.devicesWithIssues}`);

    console.log(`\n📊 Data Quality:`);
    console.log(`  Total GPS Points: ${qualityReport.overallStats.totalPoints.toLocaleString()}`);
    console.log(`  Valid Points: ${qualityReport.overallStats.validPoints.toLocaleString()}`);
    console.log(`  Invalid Points: ${qualityReport.overallStats.invalidPoints.toLocaleString()}`);
    console.log(`  Overall Data Quality: ${((qualityReport.overallStats.validPoints / qualityReport.overallStats.totalPoints) * 100).toFixed(1)}%`);
    console.log(`  Average Quality Score: ${qualityReport.overallStats.averageQuality}/100`);

    // Show devices with issues
    const devicesWithIssues = qualityReport.devices.filter(d => d.hasIssues);
    if (devicesWithIssues.length > 0) {
      console.log(`\n⚠️  Devices with GPS Issues:`);
      devicesWithIssues.forEach(device => {
        console.log(`  • ${device.materialId}: Quality ${device.overallQuality}/100 (${device.dataQuality}% valid)`);
      });
    }

    // Show best performing devices
    const bestDevices = qualityReport.devices
      .filter(d => !d.hasIssues)
      .sort((a, b) => b.overallQuality - a.overallQuality)
      .slice(0, 5);

    if (bestDevices.length > 0) {
      console.log(`\n🏆 Best Performing Devices:`);
      bestDevices.forEach(device => {
        console.log(`  • ${device.materialId}: Quality ${device.overallQuality}/100 (${device.dataQuality}% valid)`);
      });
    }

    console.log('\n✅ GPS Quality Dashboard completed');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

// Run the dashboard
generateGPSQualityDashboard();
