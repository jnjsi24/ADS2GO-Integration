const DriverSalaryPricing = require('../models/DriverSalaryPricing');
const DriverSalaryCalculation = require('../models/DriverSalaryCalculation');
const Driver = require('../models/Driver');
const Material = require('../models/Material');
const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');

class DriverSalaryService {
  
  /**
   * Calculate driver salary based on the specified formula:
   * TOTAL DISTANCE * SUPERADMIN SET PRICE = DISTANCE COMPUTATION
   * TOTAL HOURS (30 DAYS) * SUPERADMIN SET PRICE = HOURS COMPUTATION
   * HOURS COMPUTATION (30DAYS) + DISTANCE COMPUTATION = DRIVER TOTAL SALARY
   */
  static async calculateDriverSalary(driverId, startDate, endDate) {
    try {
      // Get driver information
      const driver = await Driver.findOne({ driverId });
      if (!driver) {
        throw new Error('Driver not found');
      }

      // Get driver's assigned material
      const material = await Material.findById(driver.materialId);
      if (!material) {
        throw new Error('No material assigned to driver');
      }

      // Get pricing configuration for this driver's setup
      const pricingConfig = await DriverSalaryPricing.findOne({
        vehicleType: driver.vehicleType,
        category: material.category,
        materialType: material.materialType,
        isActive: true
      });

      if (!pricingConfig) {
        throw new Error(`No pricing configuration found for ${material.materialType} (${material.category}) on ${driver.vehicleType}`);
      }

      // Get tracking data for the period
      const trackingData = await this.getDriverTrackingData(driverId, material.materialId, startDate, endDate);

      // Calculate salary using the formula
      const calculations = this.performSalaryCalculation(trackingData, pricingConfig);

      return {
        driverId,
        driverName: `${driver.firstName} ${driver.lastName}`.trim(),
        materialId: material._id,
        deviceId: material.materialId,
        calculationPeriod: {
          startDate,
          endDate,
          periodType: this.determinePeriodType(startDate, endDate)
        },
        rawData: trackingData,
        pricingConfig: {
          vehicleType: driver.vehicleType,
          category: material.category,
          materialType: material.materialType,
          distanceRate: pricingConfig.distanceRate,
          hoursRate: pricingConfig.hoursRate
        },
        calculations
      };
    } catch (error) {
      console.error('Error calculating driver salary:', error);
      throw error;
    }
  }

  /**
   * Get driver tracking data for a specific period from devicedatahistoryv2
   */
  static async getDriverTrackingData(driverId, materialId, startDate, endDate) {
    try {
      // Get device data history for the material
      const deviceHistory = await DeviceDataHistoryV2.findOne({
        materialId: materialId
      });

      // Convert dates to Date objects for comparison
      const start = new Date(startDate);
      const end = new Date(endDate);

      // If no tracking data exists, return zero values (allows calculation creation for new drivers)
      if (!deviceHistory) {
        console.log(`⚠️  [DriverSalaryService] No tracking data found for material ${materialId}. Returning zero values.`);
        const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        const maxDaysWorked = Math.min(daysDiff, 30); // Cap at 30 days as per formula
        
        return {
          totalDistance: 0,
          totalHours: 0,
          daysWorked: 0
        };
      }

      // Filter daily data for the specified period
      const periodData = deviceHistory.dailyData ? deviceHistory.dailyData.filter(dailyData => {
        const dataDate = new Date(dailyData.date);
        return dataDate >= start && dataDate <= end;
      }) : [];

      console.log(`📊 [DriverSalaryService] Found ${periodData.length} days of data for period ${startDate} to ${endDate}`);
      if (periodData.length > 0) {
        console.log(`📊 [DriverSalaryService] Period data:`, periodData.map(d => ({
          date: d.date,
          distance: d.totalDistanceTraveled,
          hours: d.totalHoursOnline
        })));
      }

      // Calculate totals for the period
      let totalDistance = 0;
      let totalHours = 0;
      let daysWorked = 0;

      periodData.forEach(dailyData => {
        totalDistance += dailyData.totalDistanceTraveled || 0;
        totalHours += dailyData.totalHoursOnline || 0;
        // Count days where there was some activity (distance > 0 or hours > 0)
        if ((dailyData.totalDistanceTraveled > 0) || (dailyData.totalHoursOnline > 0)) {
          daysWorked++;
        }
      });

      console.log(`📊 [DriverSalaryService] Calculated totals - Distance: ${totalDistance}km, Hours: ${totalHours}h, Days: ${daysWorked}`);

      // If no data found for the period, try to get lifetime totals as fallback
      if (periodData.length === 0 && deviceHistory.lifetimeTotals) {
        console.log(`No daily data found for period ${startDate} to ${endDate}, using lifetime totals`);
        totalDistance = deviceHistory.lifetimeTotals?.totalDistanceTraveled || 0;
        totalHours = deviceHistory.lifetimeTotals?.totalHoursOnline || 0;
        daysWorked = deviceHistory.lifetimeTotals?.totalDays || 0;
      }

      // Calculate days worked (simplified - in reality you'd count actual working days)
      const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      const maxDaysWorked = Math.min(daysDiff, 30); // Cap at 30 days as per formula
      daysWorked = Math.min(daysWorked, maxDaysWorked);

      return {
        totalDistance: Math.round(totalDistance * 100) / 100, // Round to 2 decimal places
        totalHours: Math.round(totalHours * 100) / 100,
        daysWorked
      };
    } catch (error) {
      console.error('Error getting driver tracking data:', error);
      // Return zero values instead of throwing error to allow calculation creation
      const start = new Date(startDate);
      const end = new Date(endDate);
      const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      
      console.log(`⚠️  [DriverSalaryService] Error occurred, returning zero values for material ${materialId}`);
      return {
        totalDistance: 0,
        totalHours: 0,
        daysWorked: 0
      };
    }
  }

  /**
   * Perform the salary calculation using the specified formula
   */
  static performSalaryCalculation(trackingData, pricingConfig) {
    const { totalDistance, totalHours } = trackingData;
    const { distanceRate, hoursRate } = pricingConfig;

    // Formula: TOTAL DISTANCE * SUPERADMIN SET PRICE = DISTANCE COMPUTATION
    const distanceComputation = totalDistance * distanceRate;

    // Formula: TOTAL HOURS (30 DAYS) * SUPERADMIN SET PRICE = HOURS COMPUTATION
    const hoursComputation = totalHours * hoursRate;

    // Formula: HOURS COMPUTATION (30DAYS) + DISTANCE COMPUTATION = DRIVER TOTAL SALARY
    const totalSalary = hoursComputation + distanceComputation;

    return {
      distanceComputation: Math.round(distanceComputation * 100) / 100,
      hoursComputation: Math.round(hoursComputation * 100) / 100,
      totalSalary: Math.round(totalSalary * 100) / 100
    };
  }

  /**
   * Determine the period type based on date range
   */
  static determinePeriodType(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffInDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    if (diffInDays === 1) return 'DAILY';
    if (diffInDays <= 7) return 'WEEKLY';
    if (diffInDays <= 31) return 'MONTHLY';
    return 'CUSTOM';
  }

  /**
   * Generate salary calculations for all active drivers for a specific month
   */
  static async generateMonthlySalaryCalculations(month, year) {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      // Get all active drivers with materials
      const drivers = await Driver.find({
        accountStatus: 'ACTIVE',
        materialId: { $exists: true, $ne: null }
      }).populate('material');

      const calculations = [];

      for (const driver of drivers) {
        try {
          const calculationData = await this.calculateDriverSalary(
            driver.driverId,
            startDate.toISOString(),
            endDate.toISOString()
          );

          // Create and save the calculation
          const calculation = await DriverSalaryCalculation.createCalculation({
            driverId: driver.driverId,
            materialId: driver.material._id,
            calculationPeriod: calculationData.calculationPeriod,
            rawData: calculationData.rawData,
            pricingConfig: calculationData.pricingConfig
          });

          calculations.push(calculation);
        } catch (error) {
          console.error(`Error generating calculation for driver ${driver.driverId}:`, error);
          // Continue with other drivers
        }
      }

      return calculations;
    } catch (error) {
      console.error('Error generating monthly salary calculations:', error);
      throw error;
    }
  }

  /**
   * Get salary summary for a driver
   */
  static async getDriverSalarySummary(driverId) {
    try {
      const calculations = await DriverSalaryCalculation.find({
        driverId,
        isActive: true
      }).sort({ 'calculationPeriod.startDate': -1 });

      const totalCalculations = calculations.length;
      const totalSalary = calculations.reduce((sum, calc) => sum + calc.calculations.totalSalary, 0);
      const averageMonthlySalary = totalCalculations > 0 ? totalSalary / totalCalculations : 0;
      const lastCalculationDate = calculations.length > 0 ? calculations[0].calculationPeriod.startDate : null;
      const currentStatus = calculations.length > 0 ? calculations[0].status : null;

      return {
        driverId,
        totalCalculations,
        totalSalary: Math.round(totalSalary * 100) / 100,
        averageMonthlySalary: Math.round(averageMonthlySalary * 100) / 100,
        lastCalculationDate,
        currentStatus
      };
    } catch (error) {
      console.error('Error getting driver salary summary:', error);
      throw error;
    }
  }

  /**
   * Validate pricing configuration
   */
  static async validatePricingConfiguration(vehicleType, category, materialType) {
    try {
      const pricing = await DriverSalaryPricing.findOne({
        vehicleType,
        category,
        materialType,
        isActive: true
      });

      if (!pricing) {
        throw new Error(`No pricing configuration found for ${materialType} (${category}) on ${vehicleType}`);
      }

      if (pricing.distanceRate < 0 || pricing.hoursRate < 0) {
        throw new Error('Pricing rates must be non-negative');
      }

      return pricing;
    } catch (error) {
      console.error('Error validating pricing configuration:', error);
      throw error;
    }
  }

  /**
   * Get all pricing configurations with statistics
   */
  static async getPricingStatistics() {
    try {
      const pricingList = await DriverSalaryPricing.find({});
      
      const stats = {
        totalConfigurations: pricingList.length,
        activeConfigurations: pricingList.filter(p => p.isActive).length,
        inactiveConfigurations: pricingList.filter(p => !p.isActive).length,
        vehicleTypes: [...new Set(pricingList.map(p => p.vehicleType))],
        materialTypes: [...new Set(pricingList.map(p => p.materialType))],
        categories: [...new Set(pricingList.map(p => p.category))],
        averageDistanceRate: pricingList.length > 0 ? 
          pricingList.reduce((sum, p) => sum + p.distanceRate, 0) / pricingList.length : 0,
        averageHoursRate: pricingList.length > 0 ? 
          pricingList.reduce((sum, p) => sum + p.hoursRate, 0) / pricingList.length : 0
      };

      return stats;
    } catch (error) {
      console.error('Error getting pricing statistics:', error);
      throw error;
    }
  }
}

module.exports = DriverSalaryService;
