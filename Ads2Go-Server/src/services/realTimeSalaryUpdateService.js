const DriverSalaryService = require('./driverSalaryService');
const DriverSalaryCalculation = require('../models/DriverSalaryCalculation');
const Driver = require('../models/Driver');
const Material = require('../models/Material');

class RealTimeSalaryUpdateService {
  constructor() {
    this.updateQueue = new Map(); // Prevent duplicate updates
    this.isUpdating = false;
  }

  /**
   * Update salary calculations when tracking data changes
   * @param {string} materialId - The material ID that was updated
   * @param {string} dateStr - The date string (YYYY-MM-DD) for the update
   */
  async updateSalaryCalculations(materialId, dateStr) {
    try {
      // Prevent duplicate updates for the same material/date combination
      const updateKey = `${materialId}-${dateStr}`;
      if (this.updateQueue.has(updateKey)) {
        console.log(`⏭️  Salary update already queued for ${materialId} on ${dateStr}`);
        return;
      }

      this.updateQueue.set(updateKey, true);

      // Find the driver assigned to this material
      const material = await Material.findOne({ materialId });
      if (!material || !material.driverId) {
        console.log(`⚠️  No driver assigned to material ${materialId}`);
        this.updateQueue.delete(updateKey);
        return;
      }

      const driver = await Driver.findOne({ driverId: material.driverId });
      if (!driver) {
        console.log(`⚠️  Driver ${material.driverId} not found`);
        this.updateQueue.delete(updateKey);
        return;
      }

      console.log(`🔄 Updating salary calculations for driver ${driver.driverId} (${driver.firstName} ${driver.lastName})`);
      console.log(`📅 Update date: ${dateStr}`);

      // Get current month's date range
      const updateDate = new Date(dateStr);
      const startDate = new Date(updateDate.getFullYear(), updateDate.getMonth(), 1);
      const endDate = new Date(updateDate.getFullYear(), updateDate.getMonth() + 1, 0);
      
      console.log(`📅 Calculation period: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

      // Check if calculation exists for this month
      let calculation = await DriverSalaryCalculation.findOne({
        driverId: driver.driverId,
        'calculationPeriod.startDate': { $gte: startDate },
        'calculationPeriod.endDate': { $lte: endDate }
      });

      if (calculation) {
        // Update existing calculation
        console.log(`📊 Updating existing calculation for ${driver.driverId}`);
        
        // Recalculate with latest data
        const updatedData = await DriverSalaryService.calculateDriverSalary(
          driver.driverId,
          startDate.toISOString(),
          endDate.toISOString()
        );

        // Update the calculation
        calculation.rawData = updatedData.rawData;
        calculation.calculations = updatedData.calculations;
        calculation.updatedAt = new Date();
        calculation.notes = (calculation.notes || '') + ` | Updated ${new Date().toLocaleString()}`;
        
        await calculation.save();

        console.log(`✅ Updated salary calculation for ${driver.driverId}:`);
        console.log(`   Distance: ${calculation.rawData.totalDistance} km`);
        console.log(`   Hours: ${calculation.rawData.totalHours} hours`);
        console.log(`   Total Salary: ₱${calculation.calculations.totalSalary}`);

      } else {
        // Create new calculation for this month
        console.log(`🆕 Creating new calculation for ${driver.driverId}`);
        
        const calculationData = await DriverSalaryService.calculateDriverSalary(
          driver.driverId,
          startDate.toISOString(),
          endDate.toISOString()
        );

        calculation = await DriverSalaryCalculation.createCalculation({
          driverId: driver.driverId,
          driverName: calculationData.driverName,
          materialId: material._id,
          deviceId: calculationData.deviceId,
          calculationPeriod: calculationData.calculationPeriod,
          rawData: calculationData.rawData,
          pricingConfig: calculationData.pricingConfig,
          notes: `Real-time calculation created on ${new Date().toLocaleString()}`,
          status: 'CALCULATED'
        });

        console.log(`✅ Created new salary calculation for ${driver.driverId}:`);
        console.log(`   Distance: ${calculation.rawData.totalDistance} km`);
        console.log(`   Hours: ${calculation.rawData.totalHours} hours`);
        console.log(`   Total Salary: ₱${calculation.calculations.totalSalary}`);
      }

      // Clean up the queue after a delay
      setTimeout(() => {
        this.updateQueue.delete(updateKey);
      }, 5000); // 5 second delay

    } catch (error) {
      console.error(`❌ Error updating salary calculations for material ${materialId}:`, error.message);
      this.updateQueue.delete(`${materialId}-${dateStr}`);
    }
  }

  /**
   * Batch update multiple materials (useful for bulk operations)
   * @param {Array} materialUpdates - Array of {materialId, dateStr} objects
   */
  async batchUpdateSalaryCalculations(materialUpdates) {
    if (this.isUpdating) {
      console.log('⏳ Salary update already in progress, skipping batch update');
      return;
    }

    this.isUpdating = true;
    console.log(`🔄 Starting batch salary update for ${materialUpdates.length} materials`);

    try {
      const updatePromises = materialUpdates.map(update => 
        this.updateSalaryCalculations(update.materialId, update.dateStr)
      );

      await Promise.allSettled(updatePromises);
      console.log('✅ Batch salary update completed');

    } catch (error) {
      console.error('❌ Error in batch salary update:', error.message);
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Update salary calculations for a specific driver
   * @param {string} driverId - The driver ID to update
   * @param {string} dateStr - The date string (YYYY-MM-DD) for the update
   */
  async updateDriverSalaryCalculations(driverId, dateStr) {
    try {
      const driver = await Driver.findOne({ driverId }).populate('material');
      if (!driver || !driver.material) {
        console.log(`⚠️  Driver ${driverId} not found or no material assigned`);
        return;
      }

      await this.updateSalaryCalculations(driver.material.materialId, dateStr);

    } catch (error) {
      console.error(`❌ Error updating salary calculations for driver ${driverId}:`, error.message);
    }
  }

  /**
   * Get update statistics
   */
  getUpdateStats() {
    return {
      queueSize: this.updateQueue.size,
      isUpdating: this.isUpdating,
      queuedUpdates: Array.from(this.updateQueue.keys())
    };
  }
}

module.exports = new RealTimeSalaryUpdateService();
