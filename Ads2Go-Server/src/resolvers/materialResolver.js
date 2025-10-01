const Material = require('../models/Material');
const Driver = require('../models/Driver');
const Tablet = require('../models/Tablet');
// ScreenTracking model removed; material cleanup will skip ScreenTracking
const DeviceCompliance = require('../models/deviceCompliance');
const MaterialUsageHistory = require('../models/MaterialUsageHistory');
const MaterialAvailability = require('../models/MaterialAvailability');
const AdsPlan = require('../models/AdsPlan');
const { checkAdmin } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const allowedMaterialsByVehicle = {
  CAR: ['POSTER', 'LCD', 'STICKER', 'HEADDRESS', 'BANNER'],
  BUS: ['STICKER', 'HEADDRESS'],
  JEEP: ['POSTER', 'STICKER'],
  MOTORCYCLE: ['LCD', 'BANNER'],
  E_TRIKE: ['BANNER', 'LCD'],
};

/**
 * Clean up all related records when a material is deleted
 * @param {string} materialId - The ObjectId of the material
 * @param {string} materialStringId - The string materialId for ScreenTracking and Tablet
 */
const cleanupMaterialRelatedRecords = async (materialId, materialStringId) => {
  const cleanupResults = {
    materialAvailability: false,
    materialTracking: false,
    screenTracking: false,
    tablet: false,
    plans: false
  };

  // Clean up MaterialAvailability record
  try {
    const availabilityResult = await MaterialAvailability.findOneAndDelete({ materialId });
    if (availabilityResult) {
      console.log(`✅ Cleaned up MaterialAvailability record for deleted material: ${materialStringId}`);
      cleanupResults.materialAvailability = true;
    }
  } catch (availabilityError) {
    console.error(`❌ Error cleaning up MaterialAvailability:`, availabilityError);
  }
  
  // Clean up DeviceCompliance record
  try {
    const trackingResult = await DeviceCompliance.findOneAndDelete({ materialId });
    if (trackingResult) {
      console.log(`✅ Cleaned up DeviceCompliance record for deleted material: ${materialStringId}`);
      cleanupResults.deviceCompliance = true;
    }
  } catch (trackingError) {
    console.error(`❌ Error cleaning up DeviceCompliance:`, trackingError);
  }
  
  // ScreenTracking collection deprecated: no cleanup needed
  
  // Clean up Tablet record
  try {
    const tabletResult = await Tablet.findOneAndDelete({ materialId: materialStringId });
    if (tabletResult) {
      console.log(`✅ Cleaned up Tablet record for deleted material: ${materialStringId}`);
      cleanupResults.tablet = true;
    }
  } catch (tabletError) {
    console.error(`❌ Error cleaning up Tablet:`, tabletError);
  }

  // Remove material from all plans
  try {
    const plans = await AdsPlan.find({ materials: materialId });
    for (const plan of plans) {
      plan.materials = plan.materials.filter(
        planMaterialId => planMaterialId.toString() !== materialId.toString()
      );
      await plan.save();
      console.log(`✅ Removed material from plan: ${plan.name}`);
    }
    if (plans.length > 0) {
      cleanupResults.plans = true;
    }
  } catch (planCleanupError) {
    console.error(`❌ Error removing material from plans:`, planCleanupError);
  }

  return cleanupResults;
};

const materialResolvers = {
  Query: {
    // Admin-only
    getAllMaterials: async (_, __, { user }) => {
      checkAdmin(user); // only admin can access
      try {
        const materials = await Material.find().sort({ createdAt: -1 });
        console.log(`Found ${materials.length} materials`);
        return materials;
      } catch (error) {
        console.error('Error fetching materials:', error);
        throw new Error('Failed to fetch materials');
      }
    },

    getMaterialsByVehicleType: async (_, { vehicleType }, { user }) => {
      checkAdmin(user); // admin-only
      return await Material.find({ vehicleType }).sort({ createdAt: -1 });
    },

    getMaterialsByCategory: async (_, { category }, { user }) => {
      checkAdmin(user); // admin-only
      if (!['DIGITAL', 'NON_DIGITAL'].includes(category)) {
        throw new Error('Invalid material category');
      }
      return await Material.find({ category }).sort({ createdAt: -1 });
    },

    // Accessible by User & Driver (login required)
    getMaterialsByCategoryAndVehicle: async (_, { category, vehicleType }, { user, driver }) => {
      if (!user && !driver) throw new Error("Unauthorized");
      return await Material.find({ category, vehicleType }).sort({ createdAt: -1 });
    },

    getMaterialsByCategoryVehicleAndType: async (_, { category, vehicleType, materialType }, { user, driver }) => {
      if (!user && !driver) throw new Error("Unauthorized");
      return await Material.find({ category, vehicleType, materialType }).sort({ createdAt: -1 });
    },

    getMaterialById: async (_, { id }, { user }) => {
      checkAdmin(user); // admin-only
      const material = await Material.findById(id);
      if (!material) throw new Error('Material not found');
      return material;
    },

    // Get materials assigned to a specific driver
    getDriverMaterials: async (_, { driverId }, { user, driver }) => {
      try {

        // Check if user is admin or if driver is requesting their own materials
        if (!user && !driver) {
          throw new Error('Unauthorized access');
        }

        // If driver is requesting, verify they're requesting their own materials
        if (driver && driver.driverId !== driverId) {
          throw new Error('Drivers can only view their own materials');
        }

        // Find materials assigned to the driver
        const materials = await Material.find({ driverId }).sort({ createdAt: -1 });
        
        // Get material tracking information for each material
        const materialsWithTracking = await Promise.all(
          materials.map(async (material) => {
            const tracking = await DeviceCompliance.findOne({ materialId: material.id });
            return {
              ...material.toObject(),
              materialTracking: tracking ? {
                photoComplianceStatus: tracking.photoComplianceStatus,
                nextPhotoDue: tracking.nextPhotoDue,
                lastPhotoUpload: tracking.lastPhotoUpload,
                monthlyPhotos: (tracking.monthlyPhotos || []).map(photo => ({
                  month: photo.month,
                  status: photo.status,
                  photoUrls: photo.photoUrls,
                  uploadedAt: photo.uploadedAt ? photo.uploadedAt.toISOString() : null,
                  uploadedBy: photo.uploadedBy,
                  adminNotes: photo.adminNotes
                }))
              } : null
            };
          })
        );

        console.log(`✅ Found ${materialsWithTracking.length} materials for driver ${driverId}`);
        
        return {
          success: true,
          message: `Found ${materialsWithTracking.length} materials`,
          materials: materialsWithTracking
        };

      } catch (error) {
        console.error('Error fetching driver materials:', error);
        return {
          success: false,
          message: error.message,
          materials: []
        };
      }
    },

    // Get usage history for a specific material (Admin-only)
    getMaterialUsageHistory: async (_, { materialId }, { user }) => {
      checkAdmin(user); // Only admin can access
      
      try {
        console.log(`📊 Fetching usage history for material ${materialId}`);
        
        // Verify material exists
        const material = await Material.findById(materialId);
        if (!material) {
          throw new Error('Material not found');
        }
        
        // Get usage history
        const usageHistory = await MaterialUsageHistory.getMaterialUsageHistory(materialId);
        
        console.log(`✅ Found ${usageHistory.length} usage history entries for material ${material.materialId}`);
        
        // Ensure all records have proper IDs and required fields
        const validatedHistory = usageHistory.map(record => {
          // Ensure ID is present
          const id = record.id || record._id?.toString();
          if (!id) {
            console.error('Record missing ID:', record);
            throw new Error('Usage history record missing ID');
          }
          
          // Ensure required fields are present
          if (!record.driverInfo || !record.driverInfo.driverId) {
            console.error('Record missing driver info:', record);
            throw new Error('Usage history record missing driver info');
          }
          
          return {
            id: id,
            materialId: record.materialId?.toString(),
            driverId: record.driverId,
            driverInfo: record.driverInfo,
            assignedAt: record.assignedAt?.toISOString(),
            unassignedAt: record.unassignedAt ? record.unassignedAt.toISOString() : null,
            mountedAt: record.mountedAt ? record.mountedAt.toISOString() : null,
            dismountedAt: record.dismountedAt ? record.dismountedAt.toISOString() : null,
            usageDuration: record.usageDuration,
            assignmentReason: record.assignmentReason,
            unassignmentReason: record.unassignmentReason || null,
            customDismountReason: record.customDismountReason || null,
            assignedByAdmin: record.assignedByAdmin || null,
            unassignedByAdmin: record.unassignedByAdmin || null,
            notes: record.notes || null,
            isActive: record.isActive,
            createdAt: record.createdAt?.toISOString(),
            updatedAt: record.updatedAt?.toISOString()
          };
        });
        
        return {
          success: true,
          message: `Found ${validatedHistory.length} usage history entries`,
          usageHistory: validatedHistory
        };
        
      } catch (error) {
        console.error('Error fetching material usage history:', error);
        return {
          success: false,
          message: error.message,
          usageHistory: []
        };
      }
    },
  },

  Mutation: {
    createMaterial: async (_, { input }, { user }) => {
      checkAdmin(user);

      const { vehicleType, materialType } = input;
      const allowed = allowedMaterialsByVehicle[vehicleType];
      if (!allowed.includes(materialType)) {
        throw new Error(
          `${materialType} is not allowed for vehicle type ${vehicleType}`
        );
      }

      const material = new Material({
        ...input,
        driverId: null, // unassigned on creation
      });

      console.log(`🔄 Creating material with input:`, input);
      console.log(`🔄 Material object before save:`, material);
      
      try {
        await material.save();
        console.log(`✅ Material saved successfully: ${material.materialId} with ID: ${material.id}`);
      } catch (error) {
        console.error(`❌ Error saving material:`, error);
        throw new Error(`Failed to save material: ${error.message}`);
      }

      // Send notification to admins about new material creation
      try {
        const AdminNotificationService = require('../services/notifications/AdminNotificationService');
        await AdminNotificationService.sendNewMaterialCreatedNotification(material._id);
        console.log(`✅ Sent new material creation notification for material: ${material.materialId}`);
      } catch (notificationError) {
        console.error('❌ Error sending new material creation notification:', notificationError);
        // Don't fail the material creation if notification fails
      }

      // Create MaterialAvailability record automatically
      try {
        // Check if availability already exists
        const existingAvailability = await MaterialAvailability.findOne({ materialId: material._id });
        if (!existingAvailability) {
          const availability = new MaterialAvailability({
            materialId: material._id,
            totalSlots: 5,
            occupiedSlots: 0,
            availableSlots: 5,
            nextAvailableDate: new Date(),
            allSlotsFreeDate: new Date(),
            status: 'AVAILABLE',
            currentAds: []
          });
          
          await availability.save();
          console.log(`✅ Created MaterialAvailability record for material: ${material.materialId}`);
        } else {
          console.log(`ℹ️ MaterialAvailability already exists for material: ${material.materialId}`);
        }
      } catch (availabilityError) {
        console.error(`❌ Error creating MaterialAvailability:`, availabilityError);
        // Don't throw error - availability creation is important but shouldn't break material creation
        console.log(`⚠️ Material created but availability record creation failed. Run sync script to fix.`);
      }

      // Automatically assign material to compatible plans
      try {
        console.log(`🔗 Auto-assigning material ${material.materialId} to compatible plans...`);
        
        // Find plans that match this material's criteria
        const compatiblePlans = await AdsPlan.find({
          materialType: material.materialType,
          vehicleType: material.vehicleType,
          category: material.category,
          status: 'RUNNING'
        });
        
        console.log(`📋 Found ${compatiblePlans.length} compatible plans for ${material.materialId}`);
        
        for (const plan of compatiblePlans) {
          // Check if material is already assigned to this plan
          const isAlreadyAssigned = plan.materials && plan.materials.some(
            planMaterialId => planMaterialId.toString() === material._id.toString()
          );
          
          if (!isAlreadyAssigned) {
            // Add material to plan (limit to 3 materials per plan)
            if (!plan.materials) plan.materials = [];
            if (plan.materials.length < 3) {
              plan.materials.push(material._id);
              await plan.save();
              console.log(`✅ Assigned ${material.materialId} to plan: ${plan.name}`);
            } else {
              console.log(`ℹ️ Plan ${plan.name} already has maximum materials (3), skipping assignment`);
            }
          } else {
            console.log(`ℹ️ Material ${material.materialId} already assigned to plan: ${plan.name}`);
          }
        }
        
        console.log(`🎯 Auto-assignment completed for material: ${material.materialId}`);
      } catch (planAssignmentError) {
        console.error(`❌ Error auto-assigning material to plans:`, planAssignmentError);
        // Don't throw error - plan assignment is helpful but shouldn't break material creation
        console.log(`⚠️ Material created but plan assignment failed. Run sync script to fix.`);
      }

      // Create tablet pair if the material type is HEADDRESS
      if (materialType === 'HEADDRESS') {
        // Check if a tablet document already exists for this material
        let existingTablet = await Tablet.findOne({ materialId: material.materialId });
        
        if (!existingTablet) {
          // Only create new tablet document if one doesn't exist
          const carGroupId = `GRP-${uuidv4().substring(0, 8).toUpperCase()}`;
          
          // Create a single document with both tablets
          const tabletPair = new Tablet({
            materialId: material.materialId, // Use the string materialId, not the ObjectId id
            carGroupId,
            tablets: [
              {
                tabletNumber: 1,
                status: 'OFFLINE',
                gps: { lat: null, lng: null },
                lastSeen: null
                // deviceId is omitted - will be set when tablet is registered
              },
              {
                tabletNumber: 2,
                status: 'OFFLINE',
                gps: { lat: null, lng: null },
                lastSeen: null
                // deviceId is omitted - will be set when tablet is registered
              }
            ]
          });
          
          await tabletPair.save();
          console.log(`✅ Created tablet pair for material: ${material.materialId} with carGroupId: ${carGroupId}`);
        }
      }

  // ScreenTracking collection deprecated: skip creating ScreenTracking records

      // Create DeviceCompliance record using GraphQL mutation approach
      try {
        console.log(`🔍 Checking for existing DeviceCompliance for material: ${material.materialId} (ID: ${material.id})`);
        
        // Check if DeviceCompliance record already exists
        const existingDeviceCompliance = await DeviceCompliance.findOne({ materialId: material.id });
        
        if (!existingDeviceCompliance) {
          console.log(`📝 Creating new DeviceCompliance record for material: ${material.materialId}`);
          
          const deviceCompliance = new DeviceCompliance({
            materialId: material.id, // Use ObjectId reference
            driverId: null, // No driver assigned yet
            location: {
              type: 'Point',
              coordinates: [0, 0] // Default coordinates - will be updated when device reports location
            },
            address: 'Location not set',
            deviceStatus: 'OFFLINE',
            isOnline: false,
            lastSeen: new Date(),
            materialCondition: 'GOOD',
            isActive: true,
            // Add unique fields to avoid duplicate key errors
            totalAdImpressions: 0,
            totalViewCount: 0,
            qrCodeScans: 0,
            interactions: 0,
            uptimePercentage: 0,
            batteryLevel: 0,
            signalStrength: 0,
            totalDistanceTraveled: 0
          });
          
          await deviceCompliance.save();
          console.log(`✅ Created DeviceCompliance record for material: ${material.materialId}`);
        } else {
          console.log(`ℹ️ DeviceCompliance already exists for material: ${material.materialId}`);
        }
      } catch (error) {
        console.error(`❌ Error creating DeviceCompliance:`, error);
        console.error(`❌ Error details:`, error.message);
        console.error(`❌ Stack trace:`, error.stack);
        // Don't throw error - DeviceCompliance is optional
      }

              console.log(`🎯 Returning created material: ${material.materialId} with ID: ${material.id}`);
      return material;
    },

    updateMaterial: async (_, { id, input }, { user }) => {
      checkAdmin(user);

      const material = await Material.findById(id);
      if (!material) throw new Error('Material not found');

      // Handle material dismounting (when driverId is set to null)
      if (input.driverId === null && material.driverId) {
        const dismountDate = new Date();
        const previousDriverId = material.driverId; // Store the driver ID before clearing it
        
        // Find and update the driver to clear the material reference
        await Driver.findOneAndUpdate(
          { driverId: material.driverId },
          { 
            materialId: null,
            installedMaterialType: null
          },
          { runValidators: false } // Skip validation to avoid contact number issues
        );
        
        // Update material fields
        material.driverId = null;
        material.dismountedAt = dismountDate;
        
        // Update usage history with dismounted date
        try {
          await MaterialUsageHistory.endUsageEntry(
            material._id,
            previousDriverId,
            'MANUAL_REMOVAL',
            `Material dismounted via admin update by ${user.name || user.email}`,
            dismountDate,
            null,
            {
              adminId: user.id,
              adminName: user.name || user.email,
              adminEmail: user.email
            }
          );
        } catch (error) {
          console.error('Error updating usage history for dismount:', error);
          // Don't fail the main operation if usage history update fails
        }
      } 
      // Handle mounting (when mountedAt is set)
      if (input.mountedAt !== undefined) {
        material.mountedAt = input.mountedAt ? new Date(input.mountedAt) : null;
        
        // If there's a driver assigned, update the driver's installedMaterialType
        if (material.driverId) {
          await Driver.findOneAndUpdate(
            { driverId: material.driverId },
            { 
              installedMaterialType: material.materialType,
              materialId: material.id
            },
            { runValidators: false } // Skip validation to avoid contact number issues
          );
          
          // Update usage history with mounted date
          try {
            const usageHistory = await MaterialUsageHistory.findOne({
              materialId: material._id,
              driverId: material.driverId,
              isActive: true
            });
            
            if (usageHistory) {
              usageHistory.mountedAt = input.mountedAt ? new Date(input.mountedAt) : null;
              await usageHistory.save();
            }
          } catch (error) {
            console.error('Error updating usage history mounted date:', error);
            // Don't fail the main operation if usage history update fails
          }
        }
      }
      // Handle dismounting (when dismountedAt is set)
      if (input.dismountedAt !== undefined) {
        material.dismountedAt = input.dismountedAt ? new Date(input.dismountedAt) : null;
        
        // Update usage history with dismounted date (don't unassign driver automatically)
        if (material.driverId && input.dismountedAt) {
          try {
            const usageHistory = await MaterialUsageHistory.findOne({
              materialId: material._id,
              driverId: material.driverId,
              isActive: true
            });
            
            if (usageHistory) {
              usageHistory.dismountedAt = new Date(input.dismountedAt);
              await usageHistory.save();
            }
          } catch (error) {
            console.error('Error updating usage history dismounted date:', error);
            // Don't fail the main operation if usage history update fails
          }
        }
      }
      
      // Handle other material fields
      if (input.vehicleType !== undefined) material.vehicleType = input.vehicleType;
      if (input.materialType !== undefined) material.materialType = input.materialType;
      if (input.description !== undefined) material.description = input.description;
      if (input.requirements !== undefined) material.requirements = input.requirements;
      if (input.category !== undefined) material.category = input.category;
      
      // Prevent direct driver assignment through updateMaterial
      if (input.driverId !== undefined && input.driverId !== null) {
        throw new Error('Cannot assign driver through updateMaterial. Use assignMaterialToDriver mutation instead.');
      }
      
      await material.save();
      return material;
    },

    deleteMaterial: async (_, { id }, { user }) => {
      checkAdmin(user);

      const deleted = await Material.findByIdAndDelete(id);
      if (!deleted) throw new Error('Material not found or already deleted');
      
      console.log(`🗑️ Deleting material: ${deleted.materialId} (ID: ${id})`);
      
      // Clean up all related records
      const cleanupResults = await cleanupMaterialRelatedRecords(id, deleted.materialId);
      
      // Log cleanup summary
      const cleanedRecords = Object.entries(cleanupResults)
        .filter(([_, cleaned]) => cleaned)
        .map(([record, _]) => record)
        .join(', ');
      
      console.log(`🎯 Material deletion completed: ${deleted.materialId}`);
      console.log(`🧹 Cleaned up records: ${cleanedRecords || 'none found'}`);
      
      return 'Material and all related records deleted successfully.';
    },

    assignMaterialToDriver: async (_, { driverId, materialId }, { user }) => {
      checkAdmin(user);

      // Find the driver
      const driver = await Driver.findOne({ driverId });
      if (!driver) throw new Error('Driver not found');


      const allowedTypes = allowedMaterialsByVehicle[driver.vehicleType] || [];
      if (allowedTypes.length === 0) {
        throw new Error(`No allowed materials for vehicle type ${driver.vehicleType}`);
      }

      // Check if this driver already has a material assigned
      const alreadyAssigned = await Material.findOne({ 
        driverId: driver.driverId,
        dismountedAt: { $exists: false } // Only consider active assignments
      });
      
      if (alreadyAssigned) {
        // If the material is already assigned to this driver, just return the current assignment
        if (materialId && alreadyAssigned.id.toString() === materialId) {
          return { 
            success: true, 
            message: 'Material already assigned to this driver',
            material: alreadyAssigned,
            driver: {
              driverId: driver.driverId,
              fullName: `${driver.firstName} ${driver.lastName}`,
              email: driver.email,
              contactNumber: driver.contactNumber,
              vehiclePlateNumber: driver.vehiclePlateNumber,
              installedMaterialType: driver.installedMaterialType
            }
          };
        }
        throw new Error('Driver already has a material assigned');
      }

      let availableMaterial;
      
      // If materialId is provided, try to assign that specific material
      if (materialId) {
        availableMaterial = await Material.findOne({
          _id: materialId,
          vehicleType: driver.vehicleType,
          materialType: { $in: allowedTypes },
          $or: [
            { driverId: null },
            { driverId: { $exists: false } },
            { 
              driverId: driver.driverId,
              dismountedAt: { $ne: null }
            }
          ]
        });
        
        if (!availableMaterial) {
          throw new Error('Specified material is not available for assignment or does not match vehicle type');
        }
      } else {
        // Find an unassigned material of allowed type
        // First try to find a material that matches the driver's preferred material type
        const preferredTypes = driver.preferredMaterialType?.length > 0 
          ? driver.preferredMaterialType 
          : allowedTypes;

        availableMaterial = await Material.findOne({
          vehicleType: driver.vehicleType,
          materialType: { $in: preferredTypes },
          $or: [
            { driverId: null },
            { driverId: { $exists: false } },
            { 
              driverId: driver.driverId, 
              dismountedAt: { $ne: null } // Allow reassigning previously used materials
            }
        ]
      }).sort({ dismountedAt: 1 }); // Prefer materials that were dismounted most recently

        if (!availableMaterial) {
          throw new Error('No available materials of the required type');
        }
      }

      // Check if the material is already assigned to another driver
      if (availableMaterial.driverId && availableMaterial.driverId !== driver.driverId) {
        // Unassign from the previous driver
        const previousDriver = await Driver.findOne({ driverId: availableMaterial.driverId });
        if (previousDriver) {
        // Set dismounted date before ending usage history
        const dismountDate = new Date();
        availableMaterial.dismountedAt = dismountDate;
        
        // Create usage history entry for the previous driver
        await MaterialUsageHistory.endUsageEntry(
          availableMaterial._id,
          previousDriver.driverId,
          'REASSIGNMENT',
          `Material reassigned to driver ${driver.driverId}`,
          dismountDate,
          null,
          {
            adminId: user.id,
            adminName: user.name || user.email,
            adminEmail: user.email
          }
        );
          
          previousDriver.materialId = null;
          previousDriver.installedMaterialType = null;
          await previousDriver.save();
        }
      }

      // Only assign the driver to the material, but don't mark as mounted yet
      // mountedAt should be set separately when the material is physically mounted
      availableMaterial.driverId = driver.driverId;
      availableMaterial.mountedAt = null; // Will be set when material is actually mounted
      availableMaterial.dismountedAt = null; // Reset dismountedAt
      
      // Only set the material reference on the driver, not the installedMaterialType
      // installedMaterialType will be set when mountedAt is set
      driver.materialId = availableMaterial._id;
      
      await Promise.all([
        availableMaterial.save(),
        driver.save()
      ]);

      // Create usage history entry
      await MaterialUsageHistory.createUsageEntry(
        availableMaterial._id,
        driver.driverId,
        {
          driverId: driver.driverId,
          fullName: `${driver.firstName} ${driver.lastName}`,
          email: driver.email,
          contactNumber: driver.contactNumber,
          vehiclePlateNumber: driver.vehiclePlateNumber
        },
        'MANUAL_ASSIGNMENT',
        {
          adminId: user.id,
          adminName: user.name || user.email,
          adminEmail: user.email
        }
      );

      return {
        success: true,
        message: 'Material assigned successfully',
        material: availableMaterial,
        driver: {
          driverId: driver.driverId,
          fullName: `${driver.firstName} ${driver.lastName}`,
          email: driver.email,
          contactNumber: driver.contactNumber,
          vehiclePlateNumber: driver.vehiclePlateNumber
        }
      };
    },

    unassignMaterialFromDriver: async (_, { materialId, dismountReason }, { user }) => {
      checkAdmin(user);

      // Validate dismount reason
      if (!dismountReason || dismountReason.trim().length === 0) {
        throw new Error('Dismount reason is required');
      }

      const material = await Material.findById(materialId);
      if (!material) throw new Error('Material not found');
      
      if (!material.driverId) {
        throw new Error('Material is not assigned to any driver');
      }

      const driver = await Driver.findOne({ driverId: material.driverId });
      if (!driver) throw new Error('Driver not found');

      // Unassign the material and reset dates
      const dismountDate = new Date();
      material.driverId = null;
      material.mountedAt = null; // Reset mounted date
      material.dismountedAt = dismountDate; // Set dismounted date to now
      await material.save();

      // Create usage history entry for the unassignment with dismounted date and custom reason
      await MaterialUsageHistory.endUsageEntry(
        material._id,
        driver.driverId,
        'CUSTOM',
        `Material manually unassigned by ${user.name || user.email}: ${dismountReason.trim()}`,
        dismountDate,
        dismountReason.trim(),
        {
          adminId: user.id,
          adminName: user.name || user.email,
          adminEmail: user.email
        }
      );

      // Update driver
      driver.materialId = null;
      driver.installedMaterialType = null;
      await driver.save();

      return {
        success: true,
        message: 'Material unassigned successfully',
        material: material,
        driver: {
          driverId: driver.driverId,
          fullName: `${driver.firstName} ${driver.lastName}`,
          email: driver.email,
          contactNumber: driver.contactNumber,
          vehiclePlateNumber: driver.vehiclePlateNumber
        }
      };
    },

    // Driver photo upload mutation
    uploadMonthlyPhoto: async (_, { materialId, photoUrls, month, description }, { user, driver }) => {
      // Check if user is authenticated (either admin or driver)
      if (!user && !driver) {
        throw new Error('Authentication required');
      }

      try {
        console.log(`📸 Uploading monthly photo for material ${materialId}, month: ${month}`);
        
        // Find the material
        const material = await Material.findById(materialId);
        if (!material) {
          throw new Error('Material not found');
        }

        // If it's a driver, verify they own this material
        if (driver && material.driverId !== driver.driverId) {
          throw new Error('You can only upload photos for your assigned materials');
        }

        // Find or create device compliance record
        let deviceCompliance = await DeviceCompliance.findOne({ materialId: material._id });
        
        if (!deviceCompliance) {
          console.log(`📝 Creating new DeviceCompliance record for material ${material.materialId}`);
          deviceCompliance = new DeviceCompliance({
            materialId: material._id,
            driverId: material.driverId ? await Driver.findOne({ driverId: material.driverId }).select('_id') : null,
            location: {
              type: 'Point',
              coordinates: [0, 0] // Default coordinates
            },
            address: 'Location not set',
            materialCondition: 'GOOD',
            monthlyPhotos: [],
            photoComplianceStatus: 'PENDING'
          });
        }

        // Add monthly photo using the existing method
        await deviceCompliance.addMonthlyPhoto(month, photoUrls, driver?.driverId || user?.id);

        console.log(`✅ Monthly photo uploaded for material ${material.materialId}, month: ${month}`);

        return {
          success: true,
          message: 'Monthly photo uploaded successfully',
          deviceCompliance: deviceCompliance
        };

      } catch (error) {
        console.error('Error uploading monthly photo:', error);
        throw new Error(error.message || 'Failed to upload monthly photo');
      }
    }
  },

  Material: {
    id: (parent) => parent._id.toString(),
    materialId: (parent) => parent.materialId,
    driverId: (parent) => parent.driverId,
    
    // ✅ FIXED: Properly resolve driver information
    driver: async (parent) => {
      if (!parent.driverId) {
        console.log(`No driverId for material ${parent.materialId}`);
        return null;
      }
      
      try {
        console.log(`Fetching driver with driverId: ${parent.driverId}`);
        const driver = await Driver.findOne({ driverId: parent.driverId });
        
        if (!driver) {
          console.log(`No driver found with driverId: ${parent.driverId}`);
          return null;
        }
        
        console.log(`Found driver: ${driver.fullName}`);
        return {
          driverId: driver.driverId,
          fullName: driver.fullName, // This uses the virtual field
          email: driver.email,
          contactNumber: driver.contactNumber,
          vehiclePlateNumber: driver.vehiclePlateNumber,
        };
      } catch (error) {
        console.error('Error fetching driver for material:', error);
        return null;
      }
    },
    
    // ✅ FIXED: Ensure dates are properly formatted
    createdAt: (parent) => {
      if (!parent.createdAt) return null;
      return parent.createdAt.toISOString();
    },
    
    updatedAt: (parent) => {
      if (!parent.updatedAt) return null;
      return parent.updatedAt.toISOString();
    },
    
    mountedAt: (parent) => {
      if (!parent.mountedAt) return null;
      return parent.mountedAt.toISOString();
    },
    
    dismountedAt: (parent) => {
      if (!parent.dismountedAt) return null;
      return parent.dismountedAt.toISOString();
    },
    
    // Material condition and inspection fields - fetch from deviceCompliance collection
    materialCondition: async (parent) => {
      try {
        const tracking = await DeviceCompliance.findOne({ materialId: parent._id });
        return tracking?.materialCondition || parent.materialCondition || 'GOOD';
      } catch (error) {
        console.error('Error fetching material condition:', error);
        return parent.materialCondition || 'GOOD';
      }
    },
    
    inspectionPhotos: async (parent) => {
      try {
        const tracking = await DeviceCompliance.findOne({ materialId: parent._id });
        if (!tracking?.monthlyPhotos || tracking.monthlyPhotos.length === 0) return [];
        
        return tracking.monthlyPhotos.map(photo => ({
          url: photo.photoUrls?.[0] || '', // Get first photo URL
          uploadedAt: photo.uploadedAt ? photo.uploadedAt.toISOString() : null,
          uploadedBy: photo.uploadedBy,
          description: photo.adminNotes || '',
          month: photo.month,
          status: photo.status || 'PENDING'
        }));
      } catch (error) {
        console.error('Error fetching inspection photos:', error);
        return [];
      }
    },
    
    photoComplianceStatus: async (parent) => {
      try {
        const tracking = await DeviceCompliance.findOne({ materialId: parent._id });
        return tracking?.photoComplianceStatus || parent.photoComplianceStatus || 'PENDING';
      } catch (error) {
        console.error('Error fetching photo compliance status:', error);
        return parent.photoComplianceStatus || 'PENDING';
      }
    },
    
    lastInspectionDate: async (parent) => {
      try {
        const tracking = await DeviceCompliance.findOne({ materialId: parent._id });
        const date = tracking?.lastPhotoUpload || parent.lastInspectionDate;
        if (!date) return null;
        return date.toISOString();
      } catch (error) {
        console.error('Error fetching last inspection date:', error);
        return parent.lastInspectionDate ? parent.lastInspectionDate.toISOString() : null;
      }
    },
    
    nextInspectionDue: async (parent) => {
      try {
        const tracking = await DeviceCompliance.findOne({ materialId: parent._id });
        const date = tracking?.nextPhotoDue || parent.nextInspectionDue;
        if (!date) return null;
        return date.toISOString();
      } catch (error) {
        console.error('Error fetching next inspection due:', error);
        return parent.nextInspectionDue ? parent.nextInspectionDue.toISOString() : null;
      }
    }
  },
};

module.exports = materialResolvers;