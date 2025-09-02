const Material = require('../models/Material');
const Driver = require('../models/Driver');
const Tablet = require('../models/Tablet');
const ScreenTracking = require('../models/screenTracking');
const MaterialTracking = require('../models/materialTracking');
const { checkAdmin } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const allowedMaterialsByVehicle = {
  CAR: ['POSTER', 'LCD', 'STICKER', 'HEADDRESS', 'BANNER'],
  BUS: ['STICKER', 'HEADDRESS'],
  JEEP: ['POSTER', 'STICKER'],
  MOTORCYCLE: ['LCD', 'BANNER'],
  E_TRIKE: ['BANNER', 'LCD'],
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
                monthlyPhotos: tracking.monthlyPhotos || []
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
        // Check if MaterialTracking record already exists
        const existingMaterialTracking = await MaterialTracking.findOne({ materialId: material.id });
        
        if (!existingMaterialTracking) {
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
            isActive: true
          });
          
          await materialTracking.save();
          console.log(`✅ Created MaterialTracking record for material: ${material.materialId}`);
        }
      } catch (error) {
        console.error(`❌ Error creating MaterialTracking:`, error);
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
        const driver = await Driver.findOne({ driverId: material.driverId });
        if (driver) {
          driver.materialId = null;
          driver.installedMaterialType = null;
          await driver.save();
        }
        
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
        const driver = await Driver.findOne({ driverId: material.driverId });
        if (driver) {
          driver.installedMaterialType = material.materialType;
          driver.materialId = material.id;
          await driver.save();
        }
      }
      // Handle dismounting (when dismountedAt is set)
      else if (input.dismountedAt) {
        if (!material.driverId) {
          throw new Error('Cannot set dismountedAt: No driver assigned to this material');
        }
        material.dismountedAt = input.dismountedAt;
        
        // Clear the driver's installedMaterialType
        const driver = await Driver.findOne({ driverId: material.driverId });
        if (driver) {
          driver.installedMaterialType = null;
          driver.materialId = null;
          await driver.save();
        }
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
      return 'Material deleted successfully.';
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
    }
  },
};

module.exports = materialResolvers;