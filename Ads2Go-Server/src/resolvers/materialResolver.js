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
const NotificationService = require('../services/notifications/NotificationService');

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
        const materials = await Material.find()
          .populate('driver', 'driverId firstName lastName fullName email contactNumber vehiclePlateNumber')
          .sort({ createdAt: -1 });
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
        // Debug logging
        console.log('🔍 getDriverMaterials called:', {
          requestedDriverId: driverId,
          hasUser: !!user,
          hasDriver: !!driver,
          driverIdFromContext: driver?.driverId,
          userRole: user?.role
        });

        // Check if user is admin or if driver is requesting their own materials
        if (!user && !driver) {
          console.error('❌ Unauthorized: No user or driver in context');
          return {
            success: false,
            message: 'Unauthorized: Authentication required',
            materials: []
          };
        }

        // Always use the authenticated driver's ID when present
        const effectiveDriverId = driver ? driver.driverId : driverId;
        if (driver && driver.driverId !== driverId) {
          console.warn('getDriverMaterials: driverId mismatch; using context driverId instead', {
            requested: driverId,
            contextDriverId: driver.driverId,
          });
        }

        // Find materials assigned to the driver
        const materials = await Material.find({ driverId: effectiveDriverId }).sort({ createdAt: -1 });
        
        // Get material tracking information for each material
        const materialsWithTracking = await Promise.all(
          materials.map(async (material) => {
            const tracking = await DeviceCompliance.findOne({ materialId: material.id });
            const materialObj = material.toObject();
            
            // Debug logging for tracking data
            if (tracking) {
              console.log(`🔍 Material ${material.materialId} tracking data:`, {
                nextPhotoDue: tracking.nextPhotoDue,
                lastPhotoUpload: tracking.lastPhotoUpload,
                photoComplianceStatus: tracking.photoComplianceStatus
              });
            }
            
            // Helper to format date to ISO string
            const formatDateField = (dateValue) => {
              if (!dateValue) return null;
              if (dateValue instanceof Date) return dateValue.toISOString();
              if (typeof dateValue === 'string') return dateValue;
              return null;
            };

            return {
              id: materialObj._id.toString(),
              materialId: materialObj.materialId,
              materialType: materialObj.materialType,
              materialName: `${materialObj.materialType} - ${materialObj.materialId}`,
              description: materialObj.description || '',
              status: materialObj.dismountedAt ? 'DISMOUNTED' : 'MOUNTED',
              assignedDate: formatDateField(materialObj.assignedDate) || formatDateField(materialObj.mountedAt) || formatDateField(materialObj.createdAt) || new Date().toISOString(),
              mountedAt: formatDateField(materialObj.mountedAt),
              location: materialObj.driver ? {
                address: '',
                coordinates: []
              } : null,
              materialTracking: tracking ? {
                photoComplianceStatus: tracking.photoComplianceStatus,
                nextPhotoDue: formatDateField(tracking.nextPhotoDue),
                lastPhotoUpload: formatDateField(tracking.lastPhotoUpload),
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

        console.log(`✅ Found ${materialsWithTracking.length} materials for driver ${effectiveDriverId}`);
        
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
            materialStringId: material.materialId,
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

    // Get usage history for a specific driver (Admin and Driver can access)
    getDriverUsageHistory: async (_, { driverId }, { user, driver }) => {
      // Allow both admin and driver (driver can only access their own history)
      if (!user && !driver) {
        throw new Error('Unauthorized: Authentication required');
      }

      // If it's a driver, they can only access their own history
      if (driver && driver.driverId !== driverId) {
        throw new Error('Unauthorized: You can only access your own material history');
      }

      try {
        console.log(`📊 Fetching usage history for driver ${driverId}`);

        // Verify driver exists
        const driverDoc = await Driver.findOne({ driverId });
        if (!driverDoc) {
          throw new Error('Driver not found');
        }

        // Get usage history
        const usageHistory = await MaterialUsageHistory.getDriverUsageHistory(driverId);

        // Shape records; include material string id if populated
        const validatedHistory = usageHistory.map(record => {
          const id = record.id || record._id?.toString();
          if (!id) throw new Error('Usage history record missing ID');
          const mat = record.materialId; // populated doc or ObjectId
          const materialIdStr = typeof mat === 'object' && mat !== null && mat._id ? mat._id.toString() : (mat?.toString?.() || null);
          const materialStringId = typeof mat === 'object' && mat !== null && mat.materialId ? mat.materialId : null;
          return {
            id,
            materialId: materialIdStr,
            materialStringId,
            driverId: record.driverId,
            driverInfo: record.driverInfo,
            assignedAt: record.assignedAt ? new Date(record.assignedAt).toISOString() : null,
            unassignedAt: record.unassignedAt ? new Date(record.unassignedAt).toISOString() : null,
            mountedAt: record.mountedAt ? new Date(record.mountedAt).toISOString() : null,
            dismountedAt: record.dismountedAt ? new Date(record.dismountedAt).toISOString() : null,
            usageDuration: record.usageDuration || null,
            assignmentReason: record.assignmentReason,
            unassignmentReason: record.unassignmentReason || null,
            customDismountReason: record.customDismountReason || null,
            assignedByAdmin: record.assignedByAdmin || null,
            unassignedByAdmin: record.unassignedByAdmin || null,
            notes: record.notes || null,
            isActive: record.isActive,
            createdAt: record.createdAt ? new Date(record.createdAt).toISOString() : null,
            updatedAt: record.updatedAt ? new Date(record.updatedAt).toISOString() : null
          };
        });

        return {
          success: true,
          message: `Found ${validatedHistory.length} usage history entries`,
          usageHistory: validatedHistory
        };
      } catch (error) {
        console.error('Error fetching driver usage history:', error);
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
        // VALIDATION: Only allow setting mountedAt if device has been registered
        if (input.mountedAt) {
          // Check if there's a registered device for this material
          const { validateMaterialHasDevice } = require('../utils/materialDeviceValidator');
          const deviceValidation = await validateMaterialHasDevice(material.materialId);
          
          if (!deviceValidation.hasDevice) {
            throw new Error(`Cannot set mounted date: ${deviceValidation.reason}. Please register the physical device first via QR code.`);
          }
          
          console.log(`✅ Material ${material.materialId} has registered device(s), allowing mounted date to be set`);
          if (deviceValidation.details) {
            console.log(`   Device info:`, JSON.stringify(deviceValidation.details.registeredDevices, null, 2));
          }
        }
        
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
              console.log(`✅ Updated usage history mountedAt for material ${material.materialId}, driver ${material.driverId}: ${usageHistory.mountedAt}`);
            } else {
              console.log(`⚠️ No active usage history found for material ${material.materialId}, driver ${material.driverId}`);
            }
          } catch (error) {
            console.error('Error updating usage history mounted date:', error);
            // Don't fail the main operation if usage history update fails
          }
        }

        // Create DeviceCompliance on first mount and initialize inspection schedule
        try {
          let tracking = await DeviceCompliance.findOne({ materialId: material._id });
          if (input.mountedAt) {
            if (!tracking) {
              tracking = new DeviceCompliance({
                materialId: material._id,
                driverId: material.driverId ? await Driver.findOne({ driverId: material.driverId }).select('_id') : null,
                monthlyPhotos: [],
                photoComplianceStatus: 'PENDING'
              });
            }
            const mountedDate = new Date(input.mountedAt);
            if (!tracking.lastInspectionDate) {
              tracking.lastInspectionDate = mountedDate;
            }
            const next = new Date(mountedDate);
            next.setMonth(next.getMonth() + 1);
            tracking.nextPhotoDue = next;
            await tracking.save();
          } else if (tracking) {
            // If mountedAt is cleared, also clear inspection schedule to avoid stale dates
            tracking.lastInspectionDate = tracking.lastInspectionDate || null;
            tracking.nextPhotoDue = tracking.nextPhotoDue || null;
            await tracking.save();
          }
        } catch (inspectionErr) {
          console.error('Error initializing inspection schedule:', inspectionErr);
          // Non-fatal: do not block the main update
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
              console.log(`✅ Updated usage history dismountedAt for material ${material.materialId}, driver ${material.driverId}: ${usageHistory.dismountedAt}`);
            } else {
              console.log(`⚠️ No active usage history found for material ${material.materialId}, driver ${material.driverId}`);
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
      if (input.materialCondition !== undefined) {
        material.materialCondition = input.materialCondition;
      }
      
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
      availableMaterial.assignedDate = new Date(); // ✅ Set assignedDate when admin assigns driver
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
      const usageEntry = await MaterialUsageHistory.createUsageEntry(
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

      // If the material already has a mountedAt date, sync it to the usage history
      if (availableMaterial.mountedAt && usageEntry) {
        usageEntry.mountedAt = availableMaterial.mountedAt;
        await usageEntry.save();
        console.log(`✅ Synced existing mountedAt date to usage history for material ${availableMaterial.materialId}, driver ${driver.driverId}: ${usageEntry.mountedAt}`);
      }

      // Send notification to admins about material assignment
      try {
        await NotificationService.sendMaterialAssignedNotification(
          availableMaterial._id,
          driver._id
        );
      } catch (notifError) {
        console.error('Error sending material assigned notification:', notifError);
        // Don't fail the assignment if notification fails
      }

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
      material.assignedDate = null; // ✅ Reset assigned date so it gets a fresh date on re-assignment
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

      // Send notification to admins about material unassignment
      try {
        await NotificationService.sendMaterialUnassignedNotification(
          material._id,
          driver._id
        );
      } catch (notifError) {
        console.error('Error sending material unassigned notification:', notifError);
        // Don't fail the unassignment if notification fails
      }

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

        // Require mountedAt before allowing any compliance record creation or photo uploads
        if (!material.mountedAt) {
          throw new Error('Material is not mounted. Set mountedAt before uploading monthly photos.');
        }

        // Find device compliance record (must exist after mounting)
        let deviceCompliance = await DeviceCompliance.findOne({ materialId: material._id });
        if (!deviceCompliance) {
          throw new Error('Device compliance record not found for this material');
        }

        // Add monthly photo using the existing method
        await deviceCompliance.addMonthlyPhoto(month, photoUrls, driver?.driverId || user?.id);

        console.log(`✅ Monthly photo uploaded for material ${material.materialId}, month: ${month}`);

        // Send notification to admins about photo upload (only if uploaded by driver)
        if (driver) {
          try {
            const driverDetails = await Driver.findOne({ driverId: driver.driverId });
            if (driverDetails) {
              await NotificationService.sendMaterialPhotosUploadedNotification(
                material._id,
                driverDetails._id,
                Array.isArray(photoUrls) ? photoUrls.length : 1
              );
            }
          } catch (notifError) {
            console.error('Error sending material photos uploaded notification:', notifError);
            // Don't fail the upload if notification fails
          }
        }

        return {
          success: true,
          message: 'Monthly photo uploaded successfully',
          materialTracking: {
            id: deviceCompliance._id.toString(),
            materialId: deviceCompliance.materialId.toString(),
            driverId: deviceCompliance.driverId?.toString(),
            monthlyPhotos: (deviceCompliance.monthlyPhotos || []).map(photo => ({
              month: photo.month,
              status: photo.status,
              photoUrls: photo.photoUrls,
              uploadedAt: photo.uploadedAt ? photo.uploadedAt.toISOString() : null,
              uploadedBy: photo.uploadedBy,
              adminNotes: photo.adminNotes
            })),
            photoComplianceStatus: deviceCompliance.photoComplianceStatus,
            lastPhotoUpload: deviceCompliance.lastPhotoUpload ? deviceCompliance.lastPhotoUpload.toISOString() : null,
            nextPhotoDue: deviceCompliance.nextPhotoDue ? deviceCompliance.nextPhotoDue.toISOString() : null
          }
        };

      } catch (error) {
        console.error('Error uploading monthly photo:', error);
        throw new Error(error.message || 'Failed to upload monthly photo');
      }
    },

    // Admin moderation: approve a monthly photo entry
    approveMonthlyPhoto: async (_, { materialId, month, adminNotes, condition }, { user }) => {
      checkAdmin(user);
      const material = await Material.findById(materialId);
      if (!material) throw new Error('Material not found');

      let tracking = await DeviceCompliance.findOne({ materialId: material._id });
      if (!tracking) throw new Error('No device compliance record found for this material');

      // Find month entry
      const entry = (tracking.monthlyPhotos || []).find(p => p.month === month);
      if (!entry) throw new Error('No photo found for specified month');

      entry.status = 'APPROVED';
      entry.reviewedBy = user.id; // Store admin ID who approved
      entry.reviewedAt = new Date(); // Store timestamp when admin approved
      if (adminNotes) entry.adminNotes = adminNotes;

      // Update compliance status and dates
      tracking.photoComplianceStatus = 'COMPLIANT';
      tracking.lastPhotoUpload = entry.uploadedAt || new Date();
      const next = new Date(tracking.lastPhotoUpload);
      next.setMonth(next.getMonth() + 1);
      tracking.nextPhotoDue = next;

      // Also treat approved monthly photo as the inspection for this period
      // Set inspection date to when admin approved, not when driver uploaded
      const inspectionDate = new Date(); // Current date when admin approves
      tracking.lastInspectionDate = inspectionDate;
      const nextInspection = new Date(inspectionDate);
      nextInspection.setMonth(nextInspection.getMonth() + 1);
      tracking.nextPhotoDue = nextInspection;
      
      // Also update Material model to keep both in sync
      material.lastInspectionDate = inspectionDate;
      material.nextInspectionDue = nextInspection;
      
      if (condition) {
        // Mirror condition to Material model instead of DeviceCompliance
        material.materialCondition = condition;
      }
      
      await material.save();

      // Mirror first approved photo into inspectionPhotos if available
      if (Array.isArray(entry.photoUrls) && entry.photoUrls.length > 0) {
        const firstUrl = entry.photoUrls[0];
        if (!tracking.inspectionPhotos) tracking.inspectionPhotos = [];
        // Avoid duplicates: only push if different from last
        const lastUrl = tracking.inspectionPhotos[tracking.inspectionPhotos.length - 1];
        if (firstUrl && firstUrl !== lastUrl) {
          tracking.inspectionPhotos.push(firstUrl);
        }
      }

      await tracking.save();

      // Send notification to driver about photo approval
      try {
        const Admin = require('../models/Admin');
        const currentAdmin = await Admin.findById(user.id);
        const adminName = currentAdmin ? `${currentAdmin.firstName || ''} ${currentAdmin.lastName || ''}`.trim() : 'Admin';
        
        if (material.driverId) {
          const driverDetails = await Driver.findOne({ driverId: material.driverId });
          if (driverDetails) {
            await NotificationService.sendMonthlyPhotoApprovedToDriver(
              driverDetails._id,
              material.materialId,
              month,
              adminNotes || null,
              adminName
            );
            console.log(`📧 [ApproveMonthlyPhoto] Sent approval notification to driver ${driverDetails.driverId}`);
          }
        }
      } catch (notifError) {
        console.error('Error sending monthly photo approval notification:', notifError);
        // Don't fail the approval if notification fails
      }

      return {
        success: true,
        message: 'Monthly photo approved',
        materialTracking: {
          id: tracking._id.toString(),
          materialId: tracking.materialId.toString(),
          driverId: tracking.driverId?.toString(),
          monthlyPhotos: (tracking.monthlyPhotos || []).map(photo => ({
            month: photo.month,
            status: photo.status,
            photoUrls: photo.photoUrls,
            uploadedAt: photo.uploadedAt ? photo.uploadedAt.toISOString() : null,
            uploadedBy: photo.uploadedBy,
            adminNotes: photo.adminNotes,
            reviewedBy: photo.reviewedBy,
            reviewedAt: photo.reviewedAt ? photo.reviewedAt.toISOString() : null
          })),
          photoComplianceStatus: tracking.photoComplianceStatus,
          lastPhotoUpload: tracking.lastPhotoUpload ? tracking.lastPhotoUpload.toISOString() : null,
          nextPhotoDue: tracking.nextPhotoDue ? tracking.nextPhotoDue.toISOString() : null
        }
      };
    },

    // Admin moderation: reject a monthly photo entry
    rejectMonthlyPhoto: async (_, { materialId, month, adminNotes }, { user }) => {
      checkAdmin(user);
      const material = await Material.findById(materialId);
      if (!material) throw new Error('Material not found');

      let tracking = await DeviceCompliance.findOne({ materialId: material._id });
      if (!tracking) throw new Error('No device compliance record found for this material');

      const entry = (tracking.monthlyPhotos || []).find(p => p.month === month);
      if (!entry) throw new Error('No photo found for specified month');

      entry.status = 'REJECTED';
      entry.reviewedBy = user.id; // Store admin ID who rejected
      entry.reviewedAt = new Date(); // Store timestamp when admin rejected
      if (adminNotes) entry.adminNotes = adminNotes;

      // Set status to NON_COMPLIANT, next due unchanged or sooner if desired
      tracking.photoComplianceStatus = 'NON_COMPLIANT';
      await tracking.save();

      // Send notification to driver about photo rejection
      try {
        const Admin = require('../models/Admin');
        const currentAdmin = await Admin.findById(user.id);
        const adminName = currentAdmin ? `${currentAdmin.firstName || ''} ${currentAdmin.lastName || ''}`.trim() : 'Admin';
        
        if (material.driverId) {
          const driverDetails = await Driver.findOne({ driverId: material.driverId });
          if (driverDetails) {
            await NotificationService.sendMonthlyPhotoRejectedToDriver(
              driverDetails._id,
              material.materialId,
              month,
              adminNotes || 'Photo did not meet compliance requirements',
              adminName
            );
            console.log(`📧 [RejectMonthlyPhoto] Sent rejection notification to driver ${driverDetails.driverId}`);
          }
        }
      } catch (notifError) {
        console.error('Error sending monthly photo rejection notification:', notifError);
        // Don't fail the rejection if notification fails
      }

      return {
        success: true,
        message: 'Monthly photo rejected',
        materialTracking: {
          id: tracking._id.toString(),
          materialId: tracking.materialId.toString(),
          driverId: tracking.driverId?.toString(),
          monthlyPhotos: (tracking.monthlyPhotos || []).map(photo => ({
            month: photo.month,
            status: photo.status,
            photoUrls: photo.photoUrls,
            uploadedAt: photo.uploadedAt ? photo.uploadedAt.toISOString() : null,
            uploadedBy: photo.uploadedBy,
            adminNotes: photo.adminNotes,
            reviewedBy: photo.reviewedBy,
            reviewedAt: photo.reviewedAt ? photo.reviewedAt.toISOString() : null
          })),
          photoComplianceStatus: tracking.photoComplianceStatus,
          lastPhotoUpload: tracking.lastPhotoUpload ? tracking.lastPhotoUpload.toISOString() : null,
          nextPhotoDue: tracking.nextPhotoDue ? tracking.nextPhotoDue.toISOString() : null
        }
      };
    },

    // Admin utility: Sync mountedAt dates from Material to MaterialUsageHistory
    syncUsageHistoryMountedDates: async (_, __, { user }) => {
      checkAdmin(user);
      
      try {
        const result = await MaterialUsageHistory.syncMountedDates();
        
        return {
          success: result.success,
          message: result.success 
            ? `Successfully synced ${result.updatedCount} usage history records`
            : `Failed to sync: ${result.error}`,
          updatedCount: result.updatedCount || 0
        };
      } catch (error) {
        console.error('Error in syncUsageHistoryMountedDates resolver:', error);
        return {
          success: false,
          message: `Failed to sync usage history: ${error.message}`,
          updatedCount: 0
        };
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
    
    assignedDate: (parent) => {
      if (!parent.assignedDate) return null;
      return parent.assignedDate.toISOString();
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
        const date = tracking?.lastInspectionDate || parent.lastInspectionDate;
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
        // DeviceCompliance uses 'nextPhotoDue', Material uses 'nextInspectionDue'
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