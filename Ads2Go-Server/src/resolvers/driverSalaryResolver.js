const DriverSalaryPricing = require('../models/DriverSalaryPricing');
const DriverSalaryCalculation = require('../models/DriverSalaryCalculation');
const Driver = require('../models/Driver');
const Material = require('../models/Material');
const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
const SuperAdmin = require('../models/SuperAdmin');

// Helper function to check if user is SuperAdmin
const checkSuperAdmin = (user) => {
  if (!user || user.role !== 'SUPERADMIN') {
    throw new Error('Access denied. SuperAdmin privileges required.');
  }
};

// Helper function to check if user is authenticated (Admin or SuperAdmin)
const checkAuth = (user) => {
  if (!user || !['ADMIN', 'SUPERADMIN'].includes(user.role)) {
    throw new Error('Access denied. Authentication required.');
  }
};

// Helper function to check if user is driver
const checkDriver = (driver) => {
  if (!driver) {
    throw new Error('Access denied. Driver authentication required.');
  }
};

// Helper function to get pricing configuration
const getPricingConfig = async (vehicleType, category, materialType) => {
  const pricing = await DriverSalaryPricing.findOne({
    vehicleType,
    category,
    materialType,
    isActive: true
  });
  
  if (!pricing) {
    throw new Error(`No pricing configuration found for ${materialType} (${category}) on ${vehicleType}`);
  }
  
  return pricing;
};

// Helper function to get driver tracking data for a period
const getDriverTrackingData = async (driverId, startDate, endDate) => {
  try {
    // Get driver's material
    const driver = await Driver.findOne({ driverId });
    if (!driver || !driver.materialId) {
      throw new Error('Driver not found or no material assigned');
    }
    
    const material = await Material.findById(driver.materialId);
    if (!material) {
      throw new Error('Material not found');
    }
    
    // Get device data history for the material
    const deviceHistory = await DeviceDataHistoryV2.findOne({
      materialId: material.materialId
    });
    
    if (!deviceHistory) {
      throw new Error('No tracking data found for this material');
    }
    
    // Convert dates to Date objects for comparison
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Filter daily data for the specified period
    const periodData = deviceHistory.dailyData.filter(dailyData => {
      const dataDate = new Date(dailyData.date);
      return dataDate >= start && dataDate <= end;
    });

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

    // If no data found for the period, try to get lifetime totals as fallback
    if (periodData.length === 0) {
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
      totalDistance: Math.round(totalDistance * 100) / 100,
      totalHours: Math.round(totalHours * 100) / 100,
      daysWorked,
      material
    };
  } catch (error) {
    console.error('Error getting driver tracking data:', error);
    throw error;
  }
};

const resolvers = {
  Query: {
    // Super Admin queries
    getAllDriverSalaryPricing: async (_, __, { user }) => {
      checkSuperAdmin(user);
      
      try {
        const pricingList = await DriverSalaryPricing.find({})
          .populate('createdBy', 'firstName lastName email')
          .populate('updatedBy', 'firstName lastName email')
          .sort({ vehicleType: 1, category: 1, materialType: 1 });
        
        return {
          success: true,
          message: 'Driver salary pricing retrieved successfully',
          pricingList,
          totalCount: pricingList.length
        };
      } catch (error) {
        console.error('Error getting driver salary pricing:', error);
        return {
          success: false,
          message: 'Failed to retrieve driver salary pricing',
          pricingList: [],
          totalCount: 0
        };
      }
    },

    getDriverSalaryPricingById: async (_, { id }, { user }) => {
      checkSuperAdmin(user);
      
      try {
        const pricing = await DriverSalaryPricing.findById(id)
          .populate('createdBy', 'firstName lastName email')
          .populate('updatedBy', 'firstName lastName email');
        
        return pricing;
      } catch (error) {
        console.error('Error getting driver salary pricing by ID:', error);
        throw new Error('Failed to retrieve driver salary pricing');
      }
    },

    getDriverSalaryPricingByConfig: async (_, { vehicleType, category, materialType }, { user }) => {
      checkSuperAdmin(user);
      
      try {
        const pricing = await DriverSalaryPricing.findOne({
          vehicleType,
          category,
          materialType,
          isActive: true
        }).populate('createdBy', 'firstName lastName email')
          .populate('updatedBy', 'firstName lastName email');
        
        return pricing;
      } catch (error) {
        console.error('Error getting driver salary pricing by config:', error);
        throw new Error('Failed to retrieve driver salary pricing');
      }
    },

    getAllDriverSalaryCalculations: async (_, { filter = {} }, { user }) => {
      checkAuth(user);
      
      try {
        const query = {};
        
        if (filter.driverId) query.driverId = filter.driverId;
        if (filter.materialId) query.materialId = filter.materialId;
        if (filter.status) query.status = filter.status;
        if (filter.startDate || filter.endDate) {
          query['calculationPeriod.startDate'] = {};
          if (filter.startDate) query['calculationPeriod.startDate'].$gte = new Date(filter.startDate);
          if (filter.endDate) query['calculationPeriod.startDate'].$lte = new Date(filter.endDate);
        }
        if (filter.periodType) query['calculationPeriod.periodType'] = filter.periodType;
        
        const calculations = await DriverSalaryCalculation.find(query)
          .populate('driver', 'driverId firstName lastName email vehicleType')
          .populate('material', 'materialId materialType category vehicleType')
          .populate('approvedBy', 'firstName lastName email')
          .sort({ 'calculationPeriod.startDate': -1 });
        
        return {
          success: true,
          message: 'Driver salary calculations retrieved successfully',
          calculations,
          totalCount: calculations.length
        };
      } catch (error) {
        console.error('Error getting driver salary calculations:', error);
        return {
          success: false,
          message: 'Failed to retrieve driver salary calculations',
          calculations: [],
          totalCount: 0
        };
      }
    },

    getDriverSalaryCalculationById: async (_, { id }, { user }) => {
      checkAuth(user);
      
      try {
        const calculation = await DriverSalaryCalculation.findById(id)
          .populate('driver', 'driverId firstName lastName email vehicleType')
          .populate('material', 'materialId materialType category vehicleType')
          .populate('approvedBy', 'firstName lastName email');
        
        return calculation;
      } catch (error) {
        console.error('Error getting driver salary calculation by ID:', error);
        throw new Error('Failed to retrieve driver salary calculation');
      }
    },

    getDriverSalaryCalculationsByDriver: async (_, { driverId }, { user }) => {
      checkAuth(user);
      
      try {
        const calculations = await DriverSalaryCalculation.find({ driverId })
          .populate('driver', 'driverId firstName lastName email vehicleType')
          .populate('material', 'materialId materialType category vehicleType')
          .populate('approvedBy', 'firstName lastName email')
          .sort({ 'calculationPeriod.startDate': -1 });
        
        return {
          success: true,
          message: 'Driver salary calculations retrieved successfully',
          calculations,
          totalCount: calculations.length
        };
      } catch (error) {
        console.error('Error getting driver salary calculations by driver:', error);
        return {
          success: false,
          message: 'Failed to retrieve driver salary calculations',
          calculations: [],
          totalCount: 0
        };
      }
    },

    getDriverSalarySummary: async (_, { driverId }, { user }) => {
      checkAuth(user);
      
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
        
        const driver = await Driver.findOne({ driverId });
        
        return {
          success: true,
          message: 'Driver salary summary retrieved successfully',
          summary: {
            driverId,
            driver,
            totalCalculations,
            totalSalary: Math.round(totalSalary * 100) / 100,
            averageMonthlySalary: Math.round(averageMonthlySalary * 100) / 100,
            lastCalculationDate,
            currentStatus
          }
        };
      } catch (error) {
        console.error('Error getting driver salary summary:', error);
        return {
          success: false,
          message: 'Failed to retrieve driver salary summary',
          summary: null
        };
      }
    },

    // Driver queries
    getMySalaryCalculations: async (_, __, { driver }) => {
      checkDriver(driver);
      
      try {
        const calculations = await DriverSalaryCalculation.find({ 
          driverId: driver.driverId,
          isActive: true 
        })
          .populate('material', 'materialId materialType category vehicleType')
          .sort({ 'calculationPeriod.startDate': -1 });
        
        return {
          success: true,
          message: 'Your salary calculations retrieved successfully',
          calculations,
          totalCount: calculations.length
        };
      } catch (error) {
        console.error('Error getting driver salary calculations:', error);
        return {
          success: false,
          message: 'Failed to retrieve your salary calculations',
          calculations: [],
          totalCount: 0
        };
      }
    },

    getMySalarySummary: async (_, __, { driver }) => {
      checkDriver(driver);
      
      try {
        const calculations = await DriverSalaryCalculation.find({ 
          driverId: driver.driverId,
          isActive: true 
        }).sort({ 'calculationPeriod.startDate': -1 });
        
        const totalCalculations = calculations.length;
        const totalSalary = calculations.reduce((sum, calc) => sum + calc.calculations.totalSalary, 0);
        const averageMonthlySalary = totalCalculations > 0 ? totalSalary / totalCalculations : 0;
        const lastCalculationDate = calculations.length > 0 ? calculations[0].calculationPeriod.startDate : null;
        const currentStatus = calculations.length > 0 ? calculations[0].status : null;
        
        return {
          success: true,
          message: 'Your salary summary retrieved successfully',
          summary: {
            driverId: driver.driverId,
            driver,
            totalCalculations,
            totalSalary: Math.round(totalSalary * 100) / 100,
            averageMonthlySalary: Math.round(averageMonthlySalary * 100) / 100,
            lastCalculationDate,
            currentStatus
          }
        };
      } catch (error) {
        console.error('Error getting driver salary summary:', error);
        return {
          success: false,
          message: 'Failed to retrieve your salary summary',
          summary: null
        };
      }
    }
  },

  Mutation: {
    // Super Admin mutations
    createDriverSalaryPricing: async (_, { input }, { user }) => {
      checkSuperAdmin(user);
      
      try {
        // Check if pricing already exists for this configuration
        const existingPricing = await DriverSalaryPricing.findOne({
          vehicleType: input.vehicleType,
          category: input.category,
          materialType: input.materialType
        });
        
        if (existingPricing) {
          throw new Error('Pricing configuration already exists for this vehicle type, category, and material type combination');
        }
        
        const pricing = new DriverSalaryPricing({
          ...input,
          createdBy: user.id
        });
        
        await pricing.save();
        await pricing.populate('createdBy', 'firstName lastName email');
        
        return {
          success: true,
          message: 'Driver salary pricing created successfully',
          pricing
        };
      } catch (error) {
        console.error('Error creating driver salary pricing:', error);
        return {
          success: false,
          message: error.message || 'Failed to create driver salary pricing',
          pricing: null
        };
      }
    },

    updateDriverSalaryPricing: async (_, { id, input }, { user }) => {
      checkSuperAdmin(user);
      
      try {
        const pricing = await DriverSalaryPricing.findById(id);
        if (!pricing) {
          throw new Error('Driver salary pricing not found');
        }
        
        Object.assign(pricing, input, { updatedBy: user.id });
        await pricing.save();
        await pricing.populate('createdBy', 'firstName lastName email');
        await pricing.populate('updatedBy', 'firstName lastName email');
        
        return {
          success: true,
          message: 'Driver salary pricing updated successfully',
          pricing
        };
      } catch (error) {
        console.error('Error updating driver salary pricing:', error);
        return {
          success: false,
          message: error.message || 'Failed to update driver salary pricing',
          pricing: null
        };
      }
    },

    deleteDriverSalaryPricing: async (_, { id }, { user }) => {
      checkSuperAdmin(user);
      
      try {
        const pricing = await DriverSalaryPricing.findById(id);
        if (!pricing) {
          throw new Error('Driver salary pricing not found');
        }
        
        await DriverSalaryPricing.findByIdAndDelete(id);
        
        return {
          success: true,
          message: 'Driver salary pricing deleted successfully',
          pricing
        };
      } catch (error) {
        console.error('Error deleting driver salary pricing:', error);
        return {
          success: false,
          message: error.message || 'Failed to delete driver salary pricing',
          pricing: null
        };
      }
    },

    createDriverSalaryCalculation: async (_, { input }, { user }) => {
      checkSuperAdmin(user);
      
      try {
        const calculation = await DriverSalaryCalculation.createCalculation(input);
        await calculation.populate('driver', 'driverId firstName lastName email vehicleType');
        await calculation.populate('material', 'materialId materialType category vehicleType');
        
        return {
          success: true,
          message: 'Driver salary calculation created successfully',
          calculation
        };
      } catch (error) {
        console.error('Error creating driver salary calculation:', error);
        return {
          success: false,
          message: error.message || 'Failed to create driver salary calculation',
          calculation: null
        };
      }
    },

    updateDriverSalaryCalculation: async (_, { id, input }, { user }) => {
      checkSuperAdmin(user);
      
      try {
        const calculation = await DriverSalaryCalculation.findById(id);
        if (!calculation) {
          throw new Error('Driver salary calculation not found');
        }
        
        Object.assign(calculation, input);
        await calculation.save();
        await calculation.populate('driver', 'driverId firstName lastName email vehicleType');
        await calculation.populate('material', 'materialId materialType category vehicleType');
        await calculation.populate('approvedBy', 'firstName lastName email');
        
        return {
          success: true,
          message: 'Driver salary calculation updated successfully',
          calculation
        };
      } catch (error) {
        console.error('Error updating driver salary calculation:', error);
        return {
          success: false,
          message: error.message || 'Failed to update driver salary calculation',
          calculation: null
        };
      }
    },

    approveDriverSalaryCalculation: async (_, { id }, { user }) => {
      checkSuperAdmin(user);
      
      try {
        const calculation = await DriverSalaryCalculation.findById(id);
        if (!calculation) {
          throw new Error('Driver salary calculation not found');
        }
        
        calculation.status = 'APPROVED';
        calculation.approvedBy = user.id;
        calculation.approvedAt = new Date();
        
        await calculation.save();
        await calculation.populate('driver', 'driverId firstName lastName email vehicleType');
        await calculation.populate('material', 'materialId materialType category vehicleType');
        await calculation.populate('approvedBy', 'firstName lastName email');
        
        return {
          success: true,
          message: 'Driver salary calculation approved successfully',
          calculation
        };
      } catch (error) {
        console.error('Error approving driver salary calculation:', error);
        return {
          success: false,
          message: error.message || 'Failed to approve driver salary calculation',
          calculation: null
        };
      }
    },

    markDriverSalaryAsPaid: async (_, { id, paymentReference }, { user }) => {
      checkSuperAdmin(user);
      
      try {
        const calculation = await DriverSalaryCalculation.findById(id);
        if (!calculation) {
          throw new Error('Driver salary calculation not found');
        }
        
        if (calculation.status !== 'APPROVED') {
          throw new Error('Only approved salary calculations can be marked as paid');
        }
        
        calculation.status = 'PAID';
        calculation.paidAt = new Date();
        calculation.paymentReference = paymentReference;
        
        await calculation.save();
        await calculation.populate('driver', 'driverId firstName lastName email vehicleType');
        await calculation.populate('material', 'materialId materialType category vehicleType');
        await calculation.populate('approvedBy', 'firstName lastName email');
        
        return {
          success: true,
          message: 'Driver salary marked as paid successfully',
          calculation
        };
      } catch (error) {
        console.error('Error marking driver salary as paid:', error);
        return {
          success: false,
          message: error.message || 'Failed to mark driver salary as paid',
          calculation: null
        };
      }
    },

    generateMonthlySalaryCalculations: async (_, { month, year }, { user }) => {
      checkSuperAdmin(user);
      
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
            // Get tracking data for the month
            const trackingData = await getDriverTrackingData(
              driver.driverId,
              startDate.toISOString(),
              endDate.toISOString()
            );
            
            // Get pricing configuration
            const pricingConfig = await getPricingConfig(
              driver.vehicleType,
              driver.material.category,
              driver.material.materialType
            );
            
            // Create calculation
            const calculation = await DriverSalaryCalculation.createCalculation({
              driverId: driver.driverId,
              materialId: driver.material._id,
              calculationPeriod: {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                periodType: 'MONTHLY'
              },
              rawData: {
                totalDistance: trackingData.totalDistance,
                totalHours: trackingData.totalHours,
                daysWorked: trackingData.daysWorked
              },
              pricingConfig: {
                vehicleType: driver.vehicleType,
                category: driver.material.category,
                materialType: driver.material.materialType,
                distanceRate: pricingConfig.distanceRate,
                hoursRate: pricingConfig.hoursRate
              }
            });
            
            calculations.push(calculation);
          } catch (error) {
            console.error(`Error generating calculation for driver ${driver.driverId}:`, error);
            // Continue with other drivers
          }
        }
        
        return {
          success: true,
          message: `Generated ${calculations.length} salary calculations for ${month}/${year}`,
          calculations,
          totalCount: calculations.length
        };
      } catch (error) {
        console.error('Error generating monthly salary calculations:', error);
        return {
          success: false,
          message: error.message || 'Failed to generate monthly salary calculations',
          calculations: [],
          totalCount: 0
        };
      }
    },

    recalculateDriverSalary: async (_, { id }, { user }) => {
      checkSuperAdmin(user);
      
      try {
        const calculation = await DriverSalaryCalculation.findById(id);
        if (!calculation) {
          throw new Error('Driver salary calculation not found');
        }
        
        // Recalculate using the stored pricing configuration
        calculation.calculateSalary();
        await calculation.save();
        
        await calculation.populate('driver', 'driverId firstName lastName email vehicleType');
        await calculation.populate('material', 'materialId materialType category vehicleType');
        await calculation.populate('approvedBy', 'firstName lastName email');
        
        return {
          success: true,
          message: 'Driver salary recalculated successfully',
          calculation
        };
      } catch (error) {
        console.error('Error recalculating driver salary:', error);
        return {
          success: false,
          message: error.message || 'Failed to recalculate driver salary',
          calculation: null
        };
      }
    }
  }
};

module.exports = resolvers;
