const Material = require('../models/Material');
const Driver = require('../models/Driver');
const Tablet = require('../models/Tablet');
const ScreenTracking = require('../models/screenTracking');
const MaterialTracking = require('../models/materialTracking');
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
  
  // Clean up MaterialTracking record
  try {
    const trackingResult = await MaterialTracking.findOneAndDelete({ materialId });
    if (trackingResult) {
      console.log(`✅ Cleaned up MaterialTracking record for deleted material: ${materialStringId}`);
      cleanupResults.materialTracking = true;
    }
  } catch (trackingError) {
    console.error(`❌ Error cleaning up MaterialTracking:`, trackingError);
  }
  
  // Clean up ScreenTracking record
  try {
    const screenTrackingResult = await ScreenTracking.findOneAndDelete({ materialId: materialStringId });
    if (screenTrackingResult) {
      console.log(`✅ Cleaned up ScreenTracking record for deleted material: ${materialStringId}`);
      cleanupResults.screenTracking = true;
    }
  } catch (screenTrackingError) {
    console.error(`❌ Error cleaning up ScreenTracking:`, screenTrackingError);
  }
  
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
            const tracking = await MaterialTracking.findOne({ materialId: material.id });
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

      // Create ScreenTracking record for all screen types (HEADDRESS, LCD, etc.)
      if (['HEADDRESS', 'LCD', 'BILLBOARD', 'DIGITAL_DISPLAY'].includes(materialType)) {
        // Check if ScreenTracking record already exists
        const existingScreenTracking = await ScreenTracking.findOne({ materialId: material.materialId });
        
        if (!existingScreenTracking) {
          const carGroupId = materialType === 'HEADDRESS' ? 
            `GRP-${uuidv4().substring(0, 8).toUpperCase()}` : 
            `GRP-${uuidv4().substring(0, 8).toUpperCase()}`;
          
          // Generate a temporary deviceId that can be updated later
          const tempDeviceId = `TEMP-${material.materialId}-${Date.now()}`;
          
          const screenTracking = new ScreenTracking({
            deviceId: tempDeviceId, // Temporary ID - will be updated when actual device registers
            materialId: material.materialId,
            carGroupId: carGroupId,
            slotNumber: 1,
            screenType: materialType,
            isOnline: false,
            lastSeen: new Date(),
            currentSession: {
              date: new Date().toISOString().split('T')[0],
              startTime: new Date(),
              endTime: null,
              totalHoursOnline: 0,
              totalDistanceTraveled: 0,
              isActive: true,
              targetHours: materialType === 'HEADDRESS' ? 8 : 0, // Only HEADDRESS has 8-hour requirement
              complianceStatus: 'PENDING',
              locationHistory: []
            },
            totalHoursOnline: 0,
            totalDistanceTraveled: 0,
            averageDailyHours: 0,
            complianceRate: 0,
            currentRoute: {
              totalDistance: 0,
              estimatedDuration: 0,
              actualDuration: 0,
              status: 'ACTIVE',
              waypoints: []
            },
            screenMetrics: {
              displayHours: 0,
              adPlayCount: 0,
              brightness: 100,
              volume: 50,
              isDisplaying: true,
              maintenanceMode: false
            },
            alerts: [],
            isActive: true,
            dailySessions: [],
            createdAt: new Date(),
            updatedAt: new Date()
          });
          
          await screenTracking.save();
          console.log(`✅ Created ScreenTracking record for ${materialType} material: ${material.materialId} with temp deviceId: ${tempDeviceId}`);
        }
      }

      // Create MaterialTracking record using GraphQL mutation approach
      try {
        console.log(`🔍 Checking for existing MaterialTracking for material: ${material.materialId} (ID: ${material.id})`);
        
        // Check if MaterialTracking record already exists
        const existingMaterialTracking = await MaterialTracking.findOne({ materialId: material.id });
        
        if (!existingMaterialTracking) {
          console.log(`📝 Creating new MaterialTracking record for material: ${material.materialId}`);
          
          const materialTracking = new MaterialTracking({
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
          
          await materialTracking.save();
          console.log(`✅ Created MaterialTracking record for material: ${material.materialId}`);
        } else {
          console.log(`ℹ️ MaterialTracking already exists for material: ${material.materialId}`);
        }
      } catch (error) {
        console.error(`❌ Error creating MaterialTracking:`, error);
        console.error(`❌ Error details:`, error.message);
        console.error(`❌ Stack trace:`, error.stack);
        // Don't throw error - MaterialTracking is optional
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
        material.dismountedAt = new Date();
      } 
      // Handle mounting (when mountedAt is set)
      else if (input.mountedAt) {
        if (!material.driverId) {
          throw new Error('Cannot set mountedAt: No driver assigned to this material');
        }
        material.mountedAt = input.mountedAt;
        
        // Update the driver's installedMaterialType
        await Driver.findOneAndUpdate(
          { driverId: material.driverId },
          { 
            installedMaterialType: material.materialType,
            materialId: material.id
          },
          { runValidators: false } // Skip validation to avoid contact number issues
        );
      }
      // Handle dismounting (when dismountedAt is set)
      else if (input.dismountedAt) {
        if (!material.driverId) {
          throw new Error('Cannot set dismountedAt: No driver assigned to this material');
        }
        material.dismountedAt = input.dismountedAt;
        
        // Clear the driver's installedMaterialType
        await Driver.findOneAndUpdate(
          { driverId: material.driverId },
          { 
            installedMaterialType: null,
            materialId: null
          },
          { runValidators: false } // Skip validation to avoid contact number issues
        );
      }
      else if (input.driverId !== undefined) {
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

        // Find or create material tracking record
        let materialTracking = await MaterialTracking.findOne({ materialId: material._id });
        
        if (!materialTracking) {
          console.log(`📝 Creating new MaterialTracking record for material ${material.materialId}`);
          materialTracking = new MaterialTracking({
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
        await materialTracking.addMonthlyPhoto(month, photoUrls, driver?.driverId || user?.id);

        console.log(`✅ Monthly photo uploaded for material ${material.materialId}, month: ${month}`);

        return {
          success: true,
          message: 'Monthly photo uploaded successfully',
          materialTracking: materialTracking
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
    
    // Material condition and inspection fields - fetch from materialTracking collection
    materialCondition: async (parent) => {
      try {
        const tracking = await MaterialTracking.findOne({ materialId: parent._id });
        return tracking?.materialCondition || parent.materialCondition || 'GOOD';
      } catch (error) {
        console.error('Error fetching material condition:', error);
        return parent.materialCondition || 'GOOD';
      }
    },
    
    inspectionPhotos: async (parent) => {
      try {
        const tracking = await MaterialTracking.findOne({ materialId: parent._id });
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
        const tracking = await MaterialTracking.findOne({ materialId: parent._id });
        return tracking?.photoComplianceStatus || parent.photoComplianceStatus || 'PENDING';
      } catch (error) {
        console.error('Error fetching photo compliance status:', error);
        return parent.photoComplianceStatus || 'PENDING';
      }
    },
    
    lastInspectionDate: async (parent) => {
      try {
        const tracking = await MaterialTracking.findOne({ materialId: parent._id });
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
        const tracking = await MaterialTracking.findOne({ materialId: parent._id });
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