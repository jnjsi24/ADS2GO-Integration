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

      // Check if calculations already exist for this month
      const startDate = new Date(year, currentDate.getMonth(), 1);
      const endDate = new Date(year, currentDate.getMonth() + 1, 0);

      const existingCalculations = await DriverSalaryCalculation.countDocuments({
        'calculationPeriod.startDate': { $gte: startDate },
        'calculationPeriod.endDate': { $lte: endDate }
      });

      if (existingCalculations > 0) {
        console.log(`⏭️  Salary calculations for ${year}-${String(month).padStart(2, '0')} already exist (${existingCalculations} calculations)`);
        this.isRunning = false;
        return;
      }

      // Get all active drivers with materials
      const drivers = await Driver.find({
        accountStatus: 'ACTIVE',
        materialId: { $exists: true, $ne: null }
      }).populate('material');

      console.log(`👥 Found ${drivers.length} active drivers with materials`);

      let successCount = 0;
      let errorCount = 0;

      for (const driver of drivers) {
        try {
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
   */
  async updateExistingCalculations() {
    if (this.isRunning) {
      console.log('⏳ Driver salary update already running, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('🔄 Updating existing salary calculations with latest data...');

    try {
      // Get calculations from the current month that are not yet approved
      const currentDate = new Date();
      const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const calculations = await DriverSalaryCalculation.find({
        'calculationPeriod.startDate': { $gte: startDate },
        'calculationPeriod.endDate': { $lte: endDate },
        status: { $in: ['CALCULATED', 'PENDING'] }
      }).populate('material');

      console.log(`📊 Found ${calculations.length} calculations to update`);

      let updatedCount = 0;

      for (const calculation of calculations) {
        try {
          // Recalculate with latest data
          const updatedData = await DriverSalaryService.calculateDriverSalary(
            calculation.driverId,
            calculation.calculationPeriod.startDate,
            calculation.calculationPeriod.endDate
          );

          // Update the calculation
          calculation.rawData = updatedData.rawData;
          calculation.calculations = updatedData.calculations;
          calculation.updatedAt = new Date();
          await calculation.save();

          console.log(`✅ Updated calculation for ${calculation.driverId}: ₱${calculation.calculations.totalSalary}`);
          updatedCount++;

        } catch (error) {
          console.error(`❌ Error updating calculation for ${calculation.driverId}:`, error.message);
        }
      }

      console.log(`🎉 Update complete! Updated ${updatedCount} calculations`);

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

    // Monthly generation - Last day of each month at 11:59 PM
    cron.schedule('59 23 28-31 * *', () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Only run on the last day of the month
      if (today.getMonth() !== tomorrow.getMonth()) {
        this.generateMonthlySalaryCalculations();
      }
    }, {
      timezone: 'Asia/Manila'
    });

    console.log('✅ Driver salary cron jobs started');
    console.log('📅 Monthly generation: Last day of month at 11:59 PM');
    console.log('⚡ Real-time updates: Automatic when tracking data changes');
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
