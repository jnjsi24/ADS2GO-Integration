/**
 * Driver Salary Report Script
 * 
 * This script authenticates a driver and generates a report showing:
 * - Device tracking history
 * - Distance traveled
 * - Hours worked
 * - Salary calculation
 * 
 * Usage: node scripts/driverSalaryReport.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// Import models
const Driver = require('../src/models/Driver');
const Material = require('../src/models/Material');
const DeviceDataHistoryV2 = require('../src/models/deviceDataHistoryV2');
const DriverSalaryService = require('../src/services/driverSalaryService');
const DriverSalaryPricing = require('../src/models/DriverSalaryPricing');

// Load configuration from file if it exists
let config = {
  driver: {
    email: 'xyrillelopez5@gmail.com',
    password: 'Password@123'
  },
  report: {
    days: 30,
    showDailyBreakdown: true,
    dailyBreakdownDays: 10
  },
  database: {
    uri: null
  }
};

const configPath = path.join(__dirname, 'driver-config.js');
if (fs.existsSync(configPath)) {
  try {
    const userConfig = require('./driver-config.js');
    config = { ...config, ...userConfig };
    console.log('✅ Loaded configuration from driver-config.js');
  } catch (error) {
    console.warn('⚠️  Failed to load driver-config.js, using defaults');
  }
}

// Driver credentials
const DRIVER_EMAIL = config.driver.email;
const DRIVER_PASSWORD = config.driver.password;

// MongoDB connection string (priority: config file > env > default)
const MONGODB_URI = config.database.uri || process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/ads2go';

/**
 * Connect to MongoDB
 */
async function connectDB() {
  try {
    console.log(`🔌 Connecting to MongoDB...`);
    console.log(`   Connection string: ${MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')}`);
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.error('\n💡 TIP: Check your .env file and make sure MONGODB_URI is set correctly');
    console.error('   Example: MONGODB_URI=mongodb://username:password@host:27017/database');
    throw error;
  }
}

/**
 * Authenticate driver with email and password
 */
async function authenticateDriver(email, password) {
  try {
    console.log(`\n🔐 Authenticating driver: ${email}`);
    
    // Find driver by email with password field
    const driver = await Driver.findOne({ email: email.toLowerCase() })
      .select('+password')
      .populate('materialId');
    
    if (!driver) {
      throw new Error('Driver not found');
    }
    
    // Check password
    const isPasswordValid = await bcrypt.compare(password, driver.password);
    if (!isPasswordValid) {
      throw new Error('Invalid password');
    }
    
    console.log('✅ Authentication successful');
    console.log(`   Driver ID: ${driver.driverId}`);
    console.log(`   Name: ${driver.firstName} ${driver.lastName}`);
    console.log(`   Account Status: ${driver.accountStatus}`);
    console.log(`   Review Status: ${driver.reviewStatus}`);
    
    return driver;
  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
    throw error;
  }
}

/**
 * Get device tracking history for a driver
 */
async function getDeviceTrackingHistory(driver, days = 30) {
  try {
    console.log(`\n📊 Fetching device tracking history (last ${days} days)...`);
    console.log(`   ⚠️  Note: Only counting complete minutes (seconds ignored) and per 100m (extra meters ignored)`);
    
    if (!driver.materialId) {
      console.log('⚠️  No material assigned to driver');
      return {
        history: [],
        summary: {
          totalDays: 0,
          totalDistance: 0,
          totalHours: 0,
          billableDistance: 0,
          billableHours: 0,
          avgDistancePerDay: 0,
          avgHoursPerDay: 0
        }
      };
    }
    
    const material = driver.materialId;
    console.log(`   Material ID: ${material.materialId}`);
    console.log(`   Material Type: ${material.materialType}`);
    console.log(`   Category: ${material.category}`);
    
    // Get device history
    const deviceHistory = await DeviceDataHistoryV2.findOne({
      materialId: material.materialId
    });
    
    if (!deviceHistory) {
      console.log('⚠️  No tracking data found');
      return {
        history: [],
        summary: {
          totalDays: 0,
          totalDistance: 0,
          totalHours: 0,
          avgDistancePerDay: 0,
          avgHoursPerDay: 0
        }
      };
    }
    
    // Get last N days of data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const dailyData = deviceHistory.dailyData
      ? deviceHistory.dailyData.filter(day => {
          const dayDate = new Date(day.date);
          return dayDate >= startDate && dayDate <= endDate;
        })
      : [];
    
    // Calculate summary (raw and billable)
    const totalDistance = dailyData.reduce((sum, day) => sum + (day.totalDistanceTraveled || 0), 0);
    const totalHours = dailyData.reduce((sum, day) => sum + (day.totalHoursOnline || 0), 0);
    
    // Calculate billable amounts (floored per day, then sum)
    const billableDistance = dailyData.reduce((sum, day) => {
      const floored = floorDistanceTo100m(day.totalDistanceTraveled || 0);
      return sum + floored.flooredKm;
    }, 0);
    
    const billableHours = dailyData.reduce((sum, day) => {
      const floored = floorTimeToMinutes(day.totalHoursOnline || 0);
      return sum + floored.flooredHours;
    }, 0);
    
    const daysWithData = dailyData.filter(day => 
      (day.totalDistanceTraveled > 0) || (day.totalHoursOnline > 0)
    ).length;
    
    console.log(`✅ Found ${dailyData.length} days of tracking data`);
    console.log(`   Days with activity: ${daysWithData}`);
    console.log(`   Total Distance (raw): ${totalDistance.toFixed(2)} km`);
    console.log(`   Billable Distance (floored per 100m): ${billableDistance.toFixed(2)} km`);
    console.log(`   Total Hours (raw): ${totalHours.toFixed(2)} hours`);
    console.log(`   Billable Hours (complete minutes only): ${billableHours.toFixed(2)} hours`);
    
    return {
      history: dailyData,
      summary: {
        totalDays: daysWithData,
        totalDistance: totalDistance,
        totalHours: totalHours,
        billableDistance: billableDistance,
        billableHours: billableHours,
        avgDistancePerDay: daysWithData > 0 ? totalDistance / daysWithData : 0,
        avgHoursPerDay: daysWithData > 0 ? totalHours / daysWithData : 0
      }
    };
  } catch (error) {
    console.error('❌ Error fetching tracking history:', error.message);
    throw error;
  }
}

/**
 * Calculate driver salary
 */
async function calculateSalary(driver, startDate, endDate) {
  try {
    console.log(`\n💰 Calculating salary from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}...`);
    
    if (!driver.materialId) {
      console.log('⚠️  Cannot calculate salary - no material assigned');
      return null;
    }
    
    // Get pricing configuration
    const material = driver.materialId;
    const pricingConfig = await DriverSalaryPricing.findOne({
      vehicleType: driver.vehicleType,
      category: material.category,
      materialType: material.materialType,
      isActive: true
    });
    
    if (!pricingConfig) {
      console.log(`⚠️  No pricing configuration found for:`);
      console.log(`   Vehicle Type: ${driver.vehicleType}`);
      console.log(`   Material Type: ${material.materialType}`);
      console.log(`   Category: ${material.category}`);
      return null;
    }
    
    console.log(`✅ Pricing Configuration:`);
    console.log(`   Distance Rate: ₱${pricingConfig.distanceRate.toFixed(2)} per km`);
    console.log(`   Hours Rate: ₱${pricingConfig.hoursRate.toFixed(2)} per hour`);
    
    // Calculate salary using the service
    const salaryData = await DriverSalaryService.calculateDriverSalary(
      driver.driverId,
      startDate.toISOString(),
      endDate.toISOString()
    );
    
    return salaryData;
  } catch (error) {
    console.error('❌ Error calculating salary:', error.message);
    throw error;
  }
}

/**
 * Convert hours to time format (hours, minutes, seconds, ms)
 */
function formatTime(hours) {
  const totalSeconds = hours * 3600;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const ms = Math.round((totalSeconds % 1) * 1000);
  
  return {
    hours: h,
    minutes: m,
    seconds: s,
    milliseconds: ms,
    formatted: `${h}h ${m}m ${s}s ${ms}ms`
  };
}

/**
 * Floor time to complete minutes only (ignore seconds)
 * Example: 0h 13m 48s → 0h 13m 0s
 */
function floorTimeToMinutes(hours) {
  const totalMinutes = Math.floor(hours * 60); // Convert to minutes and floor
  const flooredHours = totalMinutes / 60; // Convert back to hours
  
  const h = Math.floor(flooredHours);
  const m = totalMinutes % 60;
  
  return {
    originalHours: hours,
    flooredHours: flooredHours,
    hours: h,
    minutes: m,
    totalMinutes: totalMinutes,
    formatted: `${h}h ${m}m`
  };
}

/**
 * Floor distance to nearest 100 meters (0.1 km)
 * Example: 1.669236 km (1669.236m) → 1.6 km (1600m)
 */
function floorDistanceTo100m(km) {
  const meters = km * 1000; // Convert to meters
  const flooredMeters = Math.floor(meters); // Floor to nearest meter (1m precision)
  const flooredKm = flooredMeters / 1000; // Convert back to km
  
  return {
    originalKm: km,
    originalMeters: meters,
    flooredKm: flooredKm,
    flooredMeters: flooredMeters,
    ignoredMeters: meters - flooredMeters
  };
}

/**
 * Display detailed report
 */
function displayReport(driver, trackingData, salaryData) {
  console.log('\n' + '='.repeat(100));
  console.log('                            DRIVER SALARY REPORT');
  console.log('='.repeat(100));
  
  // Driver Information
  console.log('\n📋 DRIVER INFORMATION');
  console.log('-'.repeat(100));
  console.log(`Driver ID:         ${driver.driverId}`);
  console.log(`Name:              ${driver.firstName} ${driver.lastName}`);
  console.log(`Email:             ${driver.email}`);
  console.log(`Contact:           ${driver.contactNumber}`);
  console.log(`Vehicle Type:      ${driver.vehicleType}`);
  console.log(`Plate Number:      ${driver.vehiclePlateNumber}`);
  console.log(`Account Status:    ${driver.accountStatus}`);
  
  if (driver.materialId) {
    console.log('\n📦 ASSIGNED MATERIAL');
    console.log('-'.repeat(100));
    console.log(`Material ID:       ${driver.materialId.materialId}`);
    console.log(`Material Type:     ${driver.materialId.materialType}`);
    console.log(`Category:          ${driver.materialId.category}`);
    console.log(`Status:            ${driver.materialId.status}`);
  }
  
  // Tracking Summary
  const totalTime = formatTime(trackingData.summary.totalHours);
  const billableTime = formatTime(trackingData.summary.billableHours);
  const avgTime = formatTime(trackingData.summary.avgHoursPerDay);
  
  console.log('\n📊 TRACKING SUMMARY');
  console.log('-'.repeat(100));
  console.log(`Total Days Worked: ${trackingData.summary.totalDays}`);
  console.log('');
  console.log(`Distance (Raw):      ${trackingData.summary.totalDistance.toFixed(2)} km`);
  console.log(`Distance (Billable): ${trackingData.summary.billableDistance.toFixed(3)} km (floored per meter)`);
  console.log('');
  console.log(`Time (Raw):      ${totalTime.formatted} (${trackingData.summary.totalHours.toFixed(2)} hours)`);
  console.log(`Time (Billable): ${billableTime.formatted} (${trackingData.summary.billableHours.toFixed(2)} hours, seconds ignored)`);
  console.log('');
  console.log(`Avg Distance/Day:  ${trackingData.summary.avgDistancePerDay.toFixed(2)} km`);
  console.log(`Avg Time/Day:      ${avgTime.formatted} (${trackingData.summary.avgHoursPerDay.toFixed(2)} hours)`);
  
  // Daily Breakdown (last N days from config)
  if (trackingData.history.length > 0 && config.report.showDailyBreakdown) {
    const breakdownDays = config.report.dailyBreakdownDays || 10;
    console.log(`\n📅 DAILY BREAKDOWN (Last ${breakdownDays} Days)`);
    console.log('-'.repeat(100));
    console.log('Date           Distance    Time                    Ad Plays  QR Scans  Daily Salary');
    console.log('-'.repeat(100));
    
    const last10Days = trackingData.history.slice(-breakdownDays).reverse();
    
    // Get pricing rates for per-day calculation
    const distanceRate = salaryData?.pricingConfig?.distanceRate || 0;
    const hoursRate = salaryData?.pricingConfig?.hoursRate || 0;
    
    last10Days.forEach(day => {
      const date = new Date(day.date).toISOString().split('T')[0];
      const exactDistance = day.totalDistanceTraveled || 0;
      const exactHours = day.totalHoursOnline || 0;
      
      // Floor distance to nearest 100m and time to complete minutes
      const flooredDist = floorDistanceTo100m(exactDistance);
      const flooredTime = floorTimeToMinutes(exactHours);
      
      const distance = exactDistance.toFixed(2).padStart(8);
      const timeFormatted = formatTime(exactHours);
      const timeStr = `${timeFormatted.hours}h ${timeFormatted.minutes}m ${timeFormatted.seconds}s`.padEnd(19);
      const adPlays = (day.totalAdPlays || 0).toString().padStart(8);
      const qrScans = (day.totalQRScans || 0).toString().padStart(8);
      
      // Calculate daily salary using FLOORED values
      const dailyDistancePay = flooredDist.flooredKm * distanceRate;
      const dailyHoursPay = flooredTime.flooredHours * hoursRate;
      const dailySalary = dailyDistancePay + dailyHoursPay;
      const salaryStr = `₱${dailySalary.toFixed(2)}`.padStart(13);
      
      console.log(`${date}  ${distance} km  ${timeStr}  ${adPlays}  ${qrScans}  ${salaryStr}`);
      
      // Show exact calculation for days with activity
      if (exactDistance > 0 || exactHours > 0) {
        const exactTimeFormatted = formatTime(exactHours);
        console.log(`         RAW DATA:`);
        console.log(`            Distance: ${exactDistance} km (${flooredDist.originalMeters.toFixed(2)} meters)`);
        console.log(`            Time: ${exactTimeFormatted.hours}h ${exactTimeFormatted.minutes}m ${exactTimeFormatted.seconds}s ${exactTimeFormatted.milliseconds}ms (${exactHours} hours)`);
        console.log(`         `);
        console.log(`         BILLABLE (floored):`);
        console.log(`            Distance: ${flooredDist.flooredKm.toFixed(3)} km (${flooredDist.flooredMeters} meters) - floored to nearest meter`);
        console.log(`            Time: ${flooredTime.hours}h ${flooredTime.minutes}m (${flooredTime.totalMinutes} minutes) - ignored ${exactTimeFormatted.seconds}s`);
        console.log(`         `);
        console.log(`         CALCULATION:`);
        console.log(`            Distance Pay: ${flooredDist.flooredKm} km × ₱${distanceRate} = ₱${dailyDistancePay}`);
        console.log(`            Hours Pay: ${flooredTime.flooredHours} hrs × ₱${hoursRate} = ₱${dailyHoursPay}`);
        console.log(`            TOTAL: ₱${dailyDistancePay} + ₱${dailyHoursPay} = ₱${dailySalary}`);
      }
    });
  }
  
  // Salary Calculation
  if (salaryData) {
    const salaryTime = formatTime(salaryData.rawData.totalHours);
    
    console.log('\n💰 SALARY CALCULATION');
    console.log('-'.repeat(100));
    console.log(`Calculation Period: ${salaryData.calculationPeriod.startDate.split('T')[0]} to ${salaryData.calculationPeriod.endDate.split('T')[0]}`);
    console.log(`Period Type:        ${salaryData.calculationPeriod.periodType}`);
    console.log('');
    console.log(`Distance Rate:      ₱${salaryData.pricingConfig.distanceRate.toFixed(2)} per km`);
    console.log(`Hours Rate:         ₱${salaryData.pricingConfig.hoursRate.toFixed(2)} per hour`);
    console.log('');
    console.log(`Total Distance:     ${salaryData.rawData.totalDistance.toFixed(2)} km`);
    console.log(`Total Time:         ${salaryTime.formatted}`);
    console.log(`                    (${salaryData.rawData.totalHours.toFixed(2)} hours = ${(salaryData.rawData.totalHours * 60).toFixed(2)} minutes)`);
    console.log(`Days Worked:        ${salaryData.rawData.daysWorked} days`);
    const totalExactTime = formatTime(salaryData.rawData.totalHours);
    
    console.log('');
    console.log('💵 EXACT COMPUTATION (NO ROUNDING - Raw Database Values):');
    console.log('-'.repeat(100));
    console.log(`   📏 DISTANCE:`);
    console.log(`      Raw Value: ${salaryData.rawData.totalDistance} km`);
    console.log(`      Rate: ₱${salaryData.pricingConfig.distanceRate} per km`);
    console.log(`      Calculation: ${salaryData.rawData.totalDistance} × ${salaryData.pricingConfig.distanceRate}`);
    console.log(`      Distance Pay = ₱${salaryData.calculations.distanceComputation}`);
    console.log('');
    console.log(`   ⏱️  TIME:`);
    console.log(`      Raw Value: ${salaryData.rawData.totalHours} hours`);
    console.log(`      Time Format: ${totalExactTime.hours}h ${totalExactTime.minutes}m ${totalExactTime.seconds}s ${totalExactTime.milliseconds}ms`);
    console.log(`      Rate: ₱${salaryData.pricingConfig.hoursRate} per hour`);
    console.log(`      Calculation: ${salaryData.rawData.totalHours} × ${salaryData.pricingConfig.hoursRate}`);
    console.log(`      Hours Pay = ₱${salaryData.calculations.hoursComputation}`);
    console.log('');
    console.log(`   💰 TOTAL:`);
    console.log(`      Distance Pay: ₱${salaryData.calculations.distanceComputation}`);
    console.log(`      Hours Pay:    ₱${salaryData.calculations.hoursComputation}`);
    console.log(`      ────────────────────────────────────`);
    console.log(`      EXACT TOTAL:  ₱${salaryData.calculations.totalSalary}`);
    console.log('');
    console.log(`   📊 FOR DISPLAY (rounded to 2 decimals): ₱${salaryData.calculations.totalSalary.toFixed(2)}`);
    console.log('-'.repeat(100));
  } else {
    console.log('\n⚠️  SALARY CALCULATION UNAVAILABLE');
    console.log('-'.repeat(100));
    console.log('No pricing configuration or material assignment found.');
  }
  
  console.log('\n' + '='.repeat(100));
  console.log('                              END OF REPORT');
  console.log('='.repeat(100) + '\n');
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('\n🚀 Starting Driver Salary Report...\n');
    
    // Connect to database
    await connectDB();
    
    // Authenticate driver
    const driver = await authenticateDriver(DRIVER_EMAIL, DRIVER_PASSWORD);
    
    // Get tracking history (from config)
    const reportDays = config.report.days || 30;
    const trackingData = await getDeviceTrackingHistory(driver, reportDays);
    
    // Calculate salary (from config)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - reportDays);
    
    let salaryData = null;
    if (driver.materialId) {
      salaryData = await calculateSalary(driver, startDate, endDate);
    }
    
    // Display report
    displayReport(driver, trackingData, salaryData);
    
    console.log('✅ Report generated successfully\n');
    
  } catch (error) {
    console.error('\n❌ Script failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('✅ Database connection closed\n');
  }
}

// Run the script
main();
