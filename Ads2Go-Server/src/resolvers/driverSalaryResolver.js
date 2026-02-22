const DriverSalaryPricing = require('../models/DriverSalaryPricing');
const DriverSalaryCalculation = require('../models/DriverSalaryCalculation');
const DriverSalaryService = require('../services/driverSalaryService');
const Driver = require('../models/Driver');
const Material = require('../models/Material');
const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
const MaterialUsageHistory = require('../models/MaterialUsageHistory');
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

/**
 * Helper function to safely convert any date value to ISO string
 * Handles: Date objects, timestamps (number/string), and ISO strings
 */
function toISOString(value) {
  if (!value) return null;
  
  // If already a Date object, convert to ISO
  if (value instanceof Date) {
    return value.toISOString();
  }
  
  // If it's a number or numeric string (timestamp), convert to Date first
  if (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) {
    const timestamp = typeof value === 'string' ? parseInt(value, 10) : value;
    return new Date(timestamp).toISOString();
  }
  
  // If it's already an ISO string, return as-is
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return value;
  }
  
  // Fallback: try to create a Date and convert
  try {
    return new Date(value).toISOString();
  } catch (error) {
    console.error('❌ Failed to convert date:', value, error);
    return null;
  }
}

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
// ✅ FIXED: Now filters by driver assignment period to prevent data leakage
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
    
    // ✅ NEW: Get assignment periods for this driver and material
    const assignmentPeriods = await MaterialUsageHistory.find({
      materialId: material._id,
      driverId: driverId
    }).sort({ assignedAt: 1 });

    // Helper function to check if a date falls within any assignment period
    const isDateInAssignmentPeriod = (date) => {
      // If no assignment history exists, check if material is currently assigned to this driver
      // This handles edge cases where MaterialUsageHistory wasn't created (legacy data)
      if (assignmentPeriods.length === 0) {
        // Fallback: If material is currently assigned to this driver, include all data
        // This is a safety measure for legacy data, but ideally all assignments should have history
        if (material.driverId === driverId) {
          console.log(`⚠️  [DriverSalaryResolver] No assignment history found, but material is currently assigned to driver ${driverId}. Including all data as fallback.`);
          return true;
        }
        // If not currently assigned, exclude all data
        return false;
      }
      
      const checkDate = new Date(date);
      checkDate.setHours(0, 0, 0, 0); // Normalize to start of day
      
      return assignmentPeriods.some(period => {
        const assignedAt = new Date(period.assignedAt);
        assignedAt.setHours(0, 0, 0, 0);
        
        // If unassignedAt is null, the assignment is still active (use endDate as upper bound)
        const unassignedAt = period.unassignedAt 
          ? new Date(period.unassignedAt)
          : new Date(endDate);
        unassignedAt.setHours(23, 59, 59, 999); // End of day
        
        return checkDate >= assignedAt && checkDate <= unassignedAt;
      });
    };
    
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

    // ✅ FIXED: Filter daily data by both date range AND assignment period (guard against missing dailyData)
    const dailyDataArray = deviceHistory.dailyData || [];
    const periodData = dailyDataArray.filter(dailyData => {
      const dataDate = new Date(dailyData.date);
      const isInDateRange = dataDate >= start && dataDate <= end;
      
      // Only include data from dates when this driver was assigned
      const isInAssignmentPeriod = isDateInAssignmentPeriod(dataDate);
      
      return isInDateRange && isInAssignmentPeriod;
    });

    // Calculate totals with same billable flooring as driverSalaryService (per-day floor then sum)
    let totalDistance = 0;
    let totalHours = 0;
    let daysWorked = 0;

    periodData.forEach(dailyData => {
      const rawDistance = dailyData.totalDistanceTraveled || 0;
      const rawHours = dailyData.totalHoursOnline || 0;
      // Billable flooring: distance floor to nearest meter, hours floor to complete minutes
      const distanceMeters = Math.floor(rawDistance * 1000);
      const billableDistance = distanceMeters / 1000;
      const totalMinutes = Math.floor(rawHours * 60);
      const billableHours = totalMinutes / 60;
      totalDistance += billableDistance;
      totalHours += billableHours;
      if (rawDistance > 0 || rawHours > 0) {
        daysWorked++;
      }
    });

    // Calculate days worked (simplified - in reality you'd count actual working days)
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const maxDaysWorked = Math.min(daysDiff, 30); // Cap at 30 days as per formula
    daysWorked = Math.min(daysWorked, maxDaysWorked);
    
    return {
      totalDistance: Math.round(totalDistance * 1000) / 1000,
      totalHours: Math.round(totalHours * 10000) / 10000,
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
          .populate({
            path: 'createdBy',
            select: 'firstName lastName email',
            model: 'SuperAdmin'
          })
          .populate({
            path: 'updatedBy',
            select: 'firstName lastName email',
            model: 'SuperAdmin'
          })
          .sort({ vehicleType: 1, category: 1, materialType: 1 });
        
        console.log(`✅ Found ${pricingList.length} driver salary pricing records`);
        
        // Convert to plain objects to ensure date transformations stick
        const plainPricingList = pricingList.map(pricing => {
          // Get the raw ObjectId from the document's _doc (before populate nullifies it)
          // When populate fails, the ObjectId is still stored in _doc
          const rawCreatedById = pricing._doc && pricing._doc.createdBy 
            ? pricing._doc.createdBy.toString() 
            : null;
          const rawUpdatedById = pricing._doc && pricing._doc.updatedBy 
            ? pricing._doc.updatedBy.toString() 
            : null;
          
          const obj = pricing.toObject();
          obj.id = pricing._id.toString();
          
          // Ensure isArchived defaults to false if not set (for backward compatibility)
          if (obj.isArchived === undefined || obj.isArchived === null) {
            obj.isArchived = false;
          }
          
          // Ensure isActive defaults to true if not set (for backward compatibility)
          if (obj.isActive === undefined || obj.isActive === null) {
            obj.isActive = true;
          }
          
          // Handle missing createdBy (if SuperAdmin was deleted/archived)
          // When populate can't find the document, it returns null
          if (!obj.createdBy || !obj.createdBy._id || !obj.createdBy.id) {
            // Use the raw ObjectId we extracted from _doc
            const createdById = rawCreatedById;
            
            obj.createdBy = {
              id: createdById || 'deleted-admin',
              _id: createdById || 'deleted-admin',
              firstName: 'Deleted',
              lastName: 'Admin',
              email: createdById ? `deleted-${createdById}@system.local` : 'deleted@system.local'
            };
            console.log(`⚠️ Missing createdBy for pricing ${obj.id}, using fallback (original ID: ${createdById || 'N/A'})`);
          } else {
            // Ensure createdBy has an id field (not just _id) for GraphQL
            if (obj.createdBy._id && !obj.createdBy.id) {
              obj.createdBy.id = obj.createdBy._id.toString();
            }
            if (!obj.createdBy.id || obj.createdBy.id === undefined) {
              obj.createdBy.id = obj.createdBy._id ? obj.createdBy._id.toString() : 'unknown';
            }
          }
          
          // Handle missing updatedBy (optional field, can be null)
          if (obj.updatedBy) {
            if (!obj.updatedBy._id && !obj.updatedBy.id) {
              // Use the raw ObjectId we extracted from _doc
              const updatedById = rawUpdatedById;
              
              if (updatedById) {
                obj.updatedBy = {
                  id: updatedById,
                  _id: updatedById,
                  firstName: 'Deleted',
                  lastName: 'Admin',
                  email: `deleted-${updatedById}@system.local`
                };
              } else {
                obj.updatedBy = null;
              }
            } else {
              // Ensure updatedBy has an id field
              if (obj.updatedBy._id && !obj.updatedBy.id) {
                obj.updatedBy.id = obj.updatedBy._id.toString();
              }
            }
          }
          
          // Debug: Log each pricing config to verify fields
          console.log(`📋 Pricing: ${obj.vehicleType} + ${obj.materialType} (${obj.category}) - isActive: ${obj.isActive}, isArchived: ${obj.isArchived}, createdBy: ${obj.createdBy?.email || obj.createdBy?.id || 'N/A'}`);
          
          return obj;
        });
        
        // Format dates as ISO strings
        const formattedPricingList = plainPricingList.map(pricing => {
          pricing.createdAt = toISOString(pricing.createdAt);
          pricing.updatedAt = toISOString(pricing.updatedAt);
          pricing.archivedAt = toISOString(pricing.archivedAt);
          pricing.scheduledDeletionDate = toISOString(pricing.scheduledDeletionDate);
          return pricing;
        });
        
        console.log(`✅ Returning ${formattedPricingList.length} formatted pricing records`);
        
        return {
          success: true,
          message: 'Driver salary pricing retrieved successfully',
          pricingList: formattedPricingList,
          totalCount: formattedPricingList.length
        };
      } catch (error) {
        console.error('❌ Error getting driver salary pricing:', error);
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
        // Filter by isActive: true to match mobile app behavior
        const calculations = await DriverSalaryCalculation.find({ 
          driverId,
          isActive: true 
        })
          .populate('driver', 'driverId firstName lastName email vehicleType')
          .populate({
            path: 'material',
            select: 'materialId materialType category vehicleType',
            strictPopulate: false // Don't throw error if material is missing
          })
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
      try {
        let calculations = [];
        
        if (!driver) {
          console.log('⚠️ getMySalaryCalculations: No driver object in context');
          return {
            success: false,
            message: 'Driver authentication required',
            calculations: [],
            totalCount: 0
          };
        }

        console.log(`🔍 getMySalaryCalculations: Looking for calculations for driverId: ${driver.driverId}`);
        
        // First try to find by driverId
        try {
          calculations = await DriverSalaryCalculation.find({ 
            driverId: driver.driverId,
            isActive: true 
          })
            .populate({
              path: 'material',
              select: 'materialId materialType category vehicleType',
              strictPopulate: false // Don't throw error if material is missing
            })
            .sort({ 'calculationPeriod.startDate': -1 });
          
          console.log(`✅ Found ${calculations.length} calculations by driverId: ${driver.driverId}`);
        } catch (findError) {
          console.error('❌ Error finding calculations by driverId:', findError);
          console.error('Error details:', {
            message: findError.message,
            stack: findError.stack,
            driverId: driver.driverId
          });
          throw findError;
        }
        
        // If no calculations found by driverId, try by deviceId
        if (calculations.length === 0 && driver.deviceId) {
          console.log(`🔍 Trying to find by deviceId: ${driver.deviceId}`);
          try {
            calculations = await DriverSalaryCalculation.find({ 
              deviceId: driver.deviceId,
              isActive: true 
            })
              .populate({
                path: 'material',
                select: 'materialId materialType category vehicleType',
                strictPopulate: false
              })
              .sort({ 'calculationPeriod.startDate': -1 });
            
            console.log(`✅ Found ${calculations.length} calculations by deviceId: ${driver.deviceId}`);
          } catch (deviceFindError) {
            console.error('❌ Error finding calculations by deviceId:', deviceFindError);
            console.error('Device find error details:', {
              message: deviceFindError.message,
              stack: deviceFindError.stack,
              deviceId: driver.deviceId
            });
            // Don't throw, just log - we'll return empty array
          }
        }
        
        // Ensure periodDisplay is set for each calculation (fallback if virtual doesn't work)
        calculations = calculations.map(calc => {
          // Convert to plain object to ensure virtuals are included
          const calcObj = calc.toObject ? calc.toObject() : calc;
          if (!calcObj.periodDisplay && calcObj.calculationPeriod) {
            const startDate = new Date(calcObj.calculationPeriod.startDate);
            const endDate = new Date(calcObj.calculationPeriod.endDate);
            const formatDate = (date) => {
              return date.toLocaleDateString('en-PH', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              });
            };
            calcObj.periodDisplay = `${formatDate(startDate)} - ${formatDate(endDate)}`;
          }
          return calcObj;
        });
        
        return {
          success: true,
          message: 'Your salary calculations retrieved successfully',
          calculations,
          totalCount: calculations.length
        };
      } catch (error) {
        console.error('❌ Error getting driver salary calculations:', error);
        console.error('Error stack:', error.stack);
        return {
          success: false,
          message: `Failed to retrieve your salary calculations: ${error.message}`,
          calculations: [],
          totalCount: 0
        };
      }
    },

    getMySalarySummary: async (_, __, { driver }) => {
      try {
        let calculations = [];
        let fullDriver = null;
        
        if (driver) {
          // Fetch full driver object with all required fields (vehicleType, etc.)
          fullDriver = await Driver.findOne({ driverId: driver.driverId })
            .select('driverId firstName lastName email vehicleType');
          
          // First try to find by driverId
          calculations = await DriverSalaryCalculation.find({ 
            driverId: driver.driverId,
            isActive: true 
          }).sort({ 'calculationPeriod.startDate': -1 });
          
          // If no calculations found by driverId, try by deviceId
          if (calculations.length === 0 && driver.deviceId) {
            calculations = await DriverSalaryCalculation.find({ 
              deviceId: driver.deviceId,
              isActive: true 
            }).sort({ 'calculationPeriod.startDate': -1 });
          }
        } else {
          // If no driver object, return all calculations as a fallback
          calculations = await DriverSalaryCalculation.find({ 
            isActive: true 
          }).sort({ 'calculationPeriod.startDate': -1 });
        }
        
        const totalCalculations = calculations.length;
        const totalSalary = calculations.reduce((sum, calc) => sum + calc.calculations.totalSalary, 0);
        const totalDistanceSalary = calculations.reduce((sum, calc) => sum + calc.calculations.distanceComputation, 0);
        const totalHoursSalary = calculations.reduce((sum, calc) => sum + calc.calculations.hoursComputation, 0);
        const averageMonthlySalary = totalCalculations > 0 ? totalSalary / totalCalculations : 0;
        const lastCalculationDate = calculations.length > 0 ? calculations[0].calculationPeriod.startDate : null;
        const currentStatus = calculations.length > 0 ? calculations[0].status : null;
        
        return {
          success: true,
          message: 'Your salary summary retrieved successfully',
          summary: {
            driverId: driver?.driverId || fullDriver?.driverId || 'unknown',
            driver: fullDriver || null,
            totalCalculations,
            totalSalary: Math.round(totalSalary * 100) / 100,
            totalDistanceSalary: Math.round(totalDistanceSalary * 100) / 100,
            totalHoursSalary: Math.round(totalHoursSalary * 100) / 100,
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

        const isRateChange = (input.distanceRate !== undefined && input.distanceRate !== pricing.distanceRate) ||
          (input.hoursRate !== undefined && input.hoursRate !== pricing.hoursRate);
        if (isRateChange) {
          // Immediate reflection: new rate applies to whole current month from next computation (no delay, no pro-rating)
          pricing.previousDistanceRate = null;
          pricing.previousHoursRate = null;
          pricing.previousRateEffectiveUntil = null;
        }

        Object.assign(pricing, input, { updatedBy: user.id });
        await pricing.save();
        await pricing.populate('createdBy', 'firstName lastName email');
        await pricing.populate('updatedBy', 'firstName lastName email');

        if (isRateChange) {
          const NotificationService = require('../services/notifications/NotificationService');
          try {
            const materials = await Material.find({
              category: pricing.category,
              materialType: pricing.materialType
            }).select('_id');
            const materialIds = materials.map(m => m._id);
            const drivers = await Driver.find({
              vehicleType: pricing.vehicleType,
              materialId: { $in: materialIds },
              accountStatus: 'ACTIVE'
            }).select('_id');
            for (const driver of drivers) {
              await NotificationService.sendSalaryRateChangeNotificationToDriver(
                driver._id,
                pricing.distanceRate,
                pricing.hoursRate,
                new Date() // effective immediately
              );
            }
            if (drivers.length > 0) {
              console.log(`📢 Sent salary rate change notification to ${drivers.length} driver(s)`);
            }
          } catch (notifyErr) {
            console.error('Error sending salary rate change notifications to drivers:', notifyErr);
          }
        }
        
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
        
        // Check if already archived
        if (pricing.isArchived) {
          throw new Error('Driver salary pricing is already archived');
        }
        
        console.log(`🗑️ Archiving driver salary pricing: ${id} - 30-day deferred deletion`);
        
        // Soft delete: Mark as archived with 30-day deletion schedule
        const now = new Date();
        const deletionDate = new Date(now);
        deletionDate.setDate(deletionDate.getDate() + 30); // 30 days from now
        
        pricing.isArchived = true;
        pricing.archivedAt = now;
        pricing.scheduledDeletionDate = deletionDate;
        pricing.isActive = false; // Deactivate immediately
        
        await pricing.save();
        
        console.log(`✅ Driver salary pricing ${id} archived successfully. Scheduled for permanent deletion on: ${deletionDate.toISOString()}`);
        
        return {
          success: true,
          message: 'Driver salary pricing archived successfully. Scheduled for deletion in 30 days.',
          pricing
        };
      } catch (error) {
        console.error('Error archiving driver salary pricing:', error);
        return {
          success: false,
          message: error.message || 'Failed to archive driver salary pricing',
          pricing: null
        };
      }
    },

    restoreDriverSalaryPricing: async (_, { id }, { user }) => {
      checkSuperAdmin(user);
      
      try {
        const pricing = await DriverSalaryPricing.findById(id);
        if (!pricing) {
          throw new Error('Driver salary pricing not found');
        }
        
        if (!pricing.isArchived) {
          throw new Error('Driver salary pricing is not archived');
        }
        
        console.log(`✅ Restoring driver salary pricing: ${id}`);
        
        pricing.isArchived = false;
        pricing.archivedAt = null;
        pricing.scheduledDeletionDate = null;
        pricing.isActive = true; // Re-activate when restored
        
        await pricing.save();
        await pricing.populate('createdBy', 'firstName lastName email');
        await pricing.populate('updatedBy', 'firstName lastName email');
        
        console.log(`✅ Driver salary pricing ${id} restored successfully`);
        
        return {
          success: true,
          message: 'Driver salary pricing restored successfully.',
          pricing
        };
      } catch (error) {
        console.error('Error restoring driver salary pricing:', error);
        return {
          success: false,
          message: error.message || 'Failed to restore driver salary pricing',
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
            
            // Create calculation (driverName and deviceId required by schema)
            const driverName = `${driver.firstName || ''} ${driver.lastName || ''}`.trim() || 'Unknown';
            const deviceId = driver.material?.materialId || '';
            const calculation = await DriverSalaryCalculation.createCalculation({
              driverId: driver.driverId,
              driverName,
              materialId: driver.material._id,
              deviceId,
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

        // Always use effective rate from DriverSalaryPricing (24h delay), never stored pricingConfig
        const pricing = await DriverSalaryPricing.findOne({
          vehicleType: calculation.pricingConfig.vehicleType,
          category: calculation.pricingConfig.category,
          materialType: calculation.pricingConfig.materialType,
          isActive: true
        });
        if (!pricing) {
          throw new Error('Driver salary pricing not found for this configuration');
        }
        const now = new Date();
        const usePreviousRate = pricing.previousRateEffectiveUntil && now < pricing.previousRateEffectiveUntil &&
          pricing.previousDistanceRate != null && pricing.previousHoursRate != null;
        const effectiveRates = usePreviousRate
          ? { distanceRate: pricing.previousDistanceRate, hoursRate: pricing.previousHoursRate }
          : { distanceRate: pricing.distanceRate, hoursRate: pricing.hoursRate };

        const newCalculations = DriverSalaryService.performSalaryCalculation(calculation.rawData, effectiveRates);
        calculation.calculations = newCalculations;
        calculation.pricingConfig.distanceRate = effectiveRates.distanceRate;
        calculation.pricingConfig.hoursRate = effectiveRates.hoursRate;
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
