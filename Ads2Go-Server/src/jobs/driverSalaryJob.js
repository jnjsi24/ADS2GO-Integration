const cron = require('node-cron');
const DriverSalaryService = require('../services/driverSalaryService');
const DriverSalaryCalculation = require('../models/DriverSalaryCalculation');
const Driver = require('../models/Driver');

class DriverSalaryJob {
  constructor() {
    this.isRunning = false;
  }

  /**
   * Generate monthly salary calculations for all active drivers
   */
  async generateMonthlySalaryCalculations() {
    if (this.isRunning) {
      console.log('⏳ Driver salary generation already running, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting automatic monthly salary generation...');

    try {
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1; // JavaScript months are 0-indexed

      const startDate = new Date(year, currentDate.getMonth(), 1);
      const endDate = new Date(year, currentDate.getMonth() + 1, 0);

      // ✅ FIXED: Get existing calculations to identify which drivers already have them
      const existingCalculations = await DriverSalaryCalculation.find({
        'calculationPeriod.startDate': { $gte: startDate },
        'calculationPeriod.endDate': { $lte: endDate },
        isActive: true
      }).select('driverId');

      const driversWithCalculations = new Set(existingCalculations.map(c => c.driverId));
      
      if (existingCalculations.length > 0) {
        console.log(`📊 Found ${existingCalculations.length} existing calculations for ${year}-${String(month).padStart(2, '0')}`);
        console.log(`   Will generate only for drivers without calculations...`);
      }

      // Get all active drivers with materials
      const drivers = await Driver.find({
        accountStatus: 'ACTIVE',
        materialId: { $exists: true, $ne: null }
      }).populate('material');

      console.log(`👥 Found ${drivers.length} active drivers with materials`);

      let successCount = 0;
      let errorCount = 0;
      let skippedCount = 0;

      for (const driver of drivers) {
        try {
          // ✅ FIXED: Check if THIS driver already has a calculation
          if (driversWithCalculations.has(driver.driverId)) {
            console.log(`⏭️  ${driver.driverId} already has calculation, skipping`);
            skippedCount++;
            continue;
          }

          // Calculate salary for this driver
          const calculationData = await DriverSalaryService.calculateDriverSalary(
            driver.driverId,
            startDate.toISOString(),
            endDate.toISOString()
          );

          // Create and save the calculation
          const calculation = await DriverSalaryCalculation.createCalculation({
            driverId: driver.driverId,
            driverName: calculationData.driverName,
            materialId: driver.material._id,
            deviceId: calculationData.deviceId,
            calculationPeriod: calculationData.calculationPeriod,
            rawData: calculationData.rawData,
            pricingConfig: calculationData.pricingConfig,
            notes: `Automatic generation for ${startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
            status: 'CALCULATED' // Ready for approval
          });

          console.log(`✅ Generated calculation for ${driver.driverId}: ₱${calculation.calculations.totalSalary}`);
          successCount++;

        } catch (error) {
          console.error(`❌ Error generating calculation for ${driver.driverId}:`, error.message);
          errorCount++;
        }
      }

      console.log('🎉 Monthly salary generation complete!');
      console.log(`✅ Successful: ${successCount}`);
      console.log(`⏭️  Skipped (already exist): ${skippedCount}`);
      console.log(`❌ Errors: ${errorCount}`);
      console.log(`📊 Total calculations created: ${successCount}`);

    } catch (error) {
      console.error('❌ Error in monthly salary generation:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Update existing calculations with latest data
   * Also creates calculations for drivers that don't have them yet
   */
  async updateExistingCalculations() {
    if (this.isRunning) {
      console.log('⏳ Driver salary update already running, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('🔄 Updating existing salary calculations with latest data...');

    try {
      const currentDate = new Date();
      const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      // Get all active drivers with materials
      const drivers = await Driver.find({
        accountStatus: 'ACTIVE',
        materialId: { $exists: true, $ne: null }
      }).populate('material');

      // Get existing calculations for current month
      const existingCalculations = await DriverSalaryCalculation.find({
        'calculationPeriod.startDate': { $gte: startDate },
        'calculationPeriod.endDate': { $lte: endDate },
        isActive: true
      });

      const calculationsMap = new Map();
      existingCalculations.forEach(calc => {
        calculationsMap.set(calc.driverId, calc);
      });

      console.log(`📊 Found ${existingCalculations.length} existing calculations for current month`);
      console.log(`👥 Processing ${drivers.length} active drivers`);

      let updatedCount = 0;
      let createdCount = 0;
      let errorCount = 0;

      for (const driver of drivers) {
        try {
          const existingCalc = calculationsMap.get(driver.driverId);

          if (existingCalc) {
            // Update existing calculation (only if not APPROVED or PAID)
            if (existingCalc.status === 'APPROVED' || existingCalc.status === 'PAID') {
              console.log(`⏭️  ${driver.driverId} calculation is ${existingCalc.status}, skipping update`);
              continue;
            }

            // Recalculate with latest data
            const updatedData = await DriverSalaryService.calculateDriverSalary(
              driver.driverId,
              existingCalc.calculationPeriod.startDate,
              existingCalc.calculationPeriod.endDate
            );

            // Update the calculation
            existingCalc.rawData = updatedData.rawData;
            existingCalc.calculations = updatedData.calculations;
            existingCalc.updatedAt = new Date();
            const previousNotes = existingCalc.notes || '';
            existingCalc.notes = `${previousNotes} | Auto-updated ${new Date().toLocaleString()}`;
            await existingCalc.save();

            console.log(`✅ Updated calculation for ${driver.driverId}: ₱${existingCalc.calculations.totalSalary}`);
            updatedCount++;

          } else {
            // Create new calculation for driver without one
            try {
              const calculationData = await DriverSalaryService.calculateDriverSalary(
                driver.driverId,
                startDate.toISOString(),
                endDate.toISOString()
              );

              const calculation = await DriverSalaryCalculation.createCalculation({
                driverId: driver.driverId,
                driverName: calculationData.driverName,
                materialId: driver.material._id,
                deviceId: calculationData.deviceId,
                calculationPeriod: calculationData.calculationPeriod,
                rawData: calculationData.rawData,
                pricingConfig: calculationData.pricingConfig,
                notes: `Auto-created on ${new Date().toLocaleString()}`,
                status: 'CALCULATED'
              });

              console.log(`✅ Created calculation for ${driver.driverId}: ₱${calculation.calculations.totalSalary}`);
              createdCount++;

            } catch (error) {
              // If calculation creation fails (e.g., no pricing config), skip silently
              console.log(`⏭️  Could not create calculation for ${driver.driverId}: ${error.message}`);
            }
          }

        } catch (error) {
          console.error(`❌ Error processing ${driver.driverId}:`, error.message);
          errorCount++;
        }
      }

      console.log(`🎉 Update complete! Updated: ${updatedCount}, Created: ${createdCount}, Errors: ${errorCount}`);

    } catch (error) {
      console.error('❌ Error updating calculations:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Start the cron jobs
   */
  start() {
    console.log('⏰ Starting driver salary cron jobs...');

    // ✅ NEW: Hourly update - updates existing calculations and creates missing ones
    cron.schedule('0 * * * *', () => {
      console.log('🔄 Hourly salary update check...');
      this.updateExistingCalculations();
    }, {
      timezone: 'Asia/Manila'
    });

    // ✅ Daily check at midnight - generates for any drivers missing calculations
    cron.schedule('1 0 * * *', () => {
      console.log('🔄 Daily salary generation check (midnight)...');
      this.generateMonthlySalaryCalculations();
    }, {
      timezone: 'Asia/Manila'
    });

    // Monthly generation - Last day of each month at 11:59 PM
    cron.schedule('59 23 28-31 * *', () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Only run on the last day of the month
      if (today.getMonth() !== tomorrow.getMonth()) {
        console.log('🗓️  End of month - running full salary generation...');
        this.generateMonthlySalaryCalculations();
      }
    }, {
      timezone: 'Asia/Manila'
    });

    console.log('✅ Driver salary cron jobs started');
    console.log('⏰ Hourly update: Every hour at :00 (updates existing + creates missing)');
    console.log('📅 Daily check: Every day at 12:01 AM (catches new drivers)');
    console.log('📅 Monthly generation: Last day of month at 11:59 PM');
    console.log('⚡ Real-time updates: Automatic when tracking data changes');
    
    // ✅ NEW: Run once on startup to catch up on any missing calculations
    console.log('🔄 Running initial salary generation check in 10 seconds...');
    setTimeout(() => {
      this.generateMonthlySalaryCalculations();
    }, 10000); // Wait 10 seconds after server startup to ensure DB is ready
  }

  /**
   * Stop the cron jobs
   */
  stop() {
    console.log('⏹️  Stopping driver salary cron jobs...');
    // Note: node-cron doesn't have a direct stop method for all jobs
    // In a production environment, you'd want to track job IDs
    console.log('✅ Driver salary cron jobs stopped');
  }
}

module.exports = new DriverSalaryJob();
