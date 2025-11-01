const Ad = require('../models/Ad');
const User = require('../models/User');
const Plan = require('../models/AdsPlan');
const Material = require('../models/Material');
const MaterialAvailability = require('../models/MaterialAvailability');
const AdsDeployment = require('../models/adsDeployment');
const Analytics = require('../models/analytics');
const Payment = require('../models/Payment');
const { checkAuth, checkAdmin } = require('../middleware/auth');
const adDeploymentService = require('../services/adDeploymentService');
const MaterialAvailabilityService = require('../services/materialAvailabilityService');
const NotificationService = require('../services/notifications/NotificationService');
const { deleteFromFirebase } = require('../utils/firebaseStorage');
const { getMaterialsSortedByAvailability } = require('../utils/smartMaterialSelection');

const adResolvers = {
  Query: {
    getAllAds: async (_, __, { user }) => {
      checkAdmin(user);
      // Filter out archived ads (30-day deferred deletion)
      return await Ad.find({ isArchived: { $ne: true } })
        .populate('userId')
        .populate('driverId')
        .populate('materialId')
        .populate('planId');
    },

    getAdsByUser: async (_, { userId }, { user }) => {
      checkAdmin(user);
      // Filter out archived ads (30-day deferred deletion)
      return await Ad.find({ userId, isArchived: { $ne: true } })
        .populate('materialId')
        .populate('planId');
    },

    getMyAds: async (_, __, { user }) => {
      checkAuth(user);
      // Filter out archived ads (30-day deferred deletion)
      return await Ad.find({ userId: user.id, isArchived: { $ne: true } })
        .populate('materialId')
        .populate('planId');
    },

    getAdById: async (_, { id }, { user }) => {
      checkAuth(user);

      // Only admins can view any ad
      if (!['ADMIN', 'SUPERADMIN'].includes(user.role)) {
        throw new Error('Not authorized to view ads');
      }

      const ad = await Ad.findById(id)
        .populate('materialId')
        .populate('planId')
        .populate('userId');

      if (!ad) throw new Error('Ad not found');
      return ad;
    },
  },

  Mutation: {
    createAd: async (_, { input }, { user }) => {
      checkAuth(user);

      const dbUser = await User.findById(user.id);
      if (!dbUser) throw new Error('User not found');
      if (!dbUser.isEmailVerified && !['ADMIN', 'SUPERADMIN'].includes(user.role)) {
        throw new Error('Please verify your email before creating an advertisement');
      }

      const plan = await Plan.findById(input.planId).populate('materials');
      if (!plan) throw new Error('Invalid plan selected');

      if (!['DIGITAL', 'NON_DIGITAL'].includes(input.adType)) {
        throw new Error('Invalid adType');
      }

      if (!input.adFormat) throw new Error('adFormat is required');

      // IMPORTANT: Ensure mediaFile is a Firebase Storage URL
      if (!input.mediaFile || !input.mediaFile.startsWith('http')) {
        throw new Error('Media file must be uploaded to Firebase first');
      }

      // Validate plan availability
      const userDesiredStartDate = new Date(input.startTime);
      const availability = await MaterialAvailabilityService.validatePlanAvailability(
        input.planId, 
        userDesiredStartDate
      );

      if (!availability.canCreate) {
        const nextAvailable = availability.nextAvailableDate ? 
          new Date(availability.nextAvailableDate).toLocaleDateString() : 'Unknown';
        throw new Error(`No available materials or slots for selected plan. Next available: ${nextAvailable}`);
      }

      // Auto-detect video duration from uploaded file
      const VideoDurationService = require('../services/videoDurationService');
      let actualVideoDuration = plan.adLengthSeconds; // Default to plan duration
      
      try {
        console.log('🎬 Auto-detecting video duration...');
        actualVideoDuration = await VideoDurationService.getVideoDuration(input.mediaFile);
        console.log(`✅ Video duration detected: ${actualVideoDuration}s (plan limit: ${plan.adLengthSeconds}s)`);
        
        // Validate video duration against plan limits
        if (actualVideoDuration > plan.adLengthSeconds) {
          throw new Error(`Video duration (${actualVideoDuration}s) exceeds plan limit (${plan.adLengthSeconds}s). Please choose a shorter video or upgrade to a plan with longer ad duration.`);
        }
        
        if (actualVideoDuration < 5) {
          throw new Error(`Video duration (${actualVideoDuration}s) is too short. Minimum duration is 5 seconds.`);
        }
        
      } catch (error) {
        if (error.message.includes('exceeds plan limit') || error.message.includes('too short')) {
          throw error; // Re-throw validation errors
        }
        console.warn('⚠️ Could not detect video duration, using plan duration:', error.message);
      }

      // Calculate total price using actual video duration
      const totalPlaysPerDay = plan.playsPerDayPerDevice * plan.numberOfDevices;
      const totalPrice = totalPlaysPerDay * plan.pricePerPlay * plan.durationDays;

      // Use the user's desired start date directly (no 7-day buffer for testing)
      const startTime = new Date(userDesiredStartDate);
      const endTime = new Date(userDesiredStartDate);
      endTime.setDate(endTime.getDate() + plan.durationDays);

      // Use smart material selection instead of plan's materials array
      let selectedMaterial = null;
      
      // Import the smart selection function from utility
      const { getMaterialsSortedByAvailability } = require('../utils/smartMaterialSelection');
      
      try {
        console.log('🧠 Using smart material selection for ad creation...');
        const sortedMaterials = await getMaterialsSortedByAvailability(
          plan.materialType,
          plan.vehicleType,
          plan.category,
          startTime,
          endTime
        );
        
        if (sortedMaterials.length > 0) {
          // Find the first material that has availability for the desired time period
          for (const material of sortedMaterials) {
            const availability = await MaterialAvailability.findOne({ materialId: material._id });
            if (availability && availability.canAcceptAd(startTime, endTime)) {
              selectedMaterial = material;
              console.log(`🎯 Smart selected material for ad: ${material.materialId} (${material.materialType} ${material.vehicleType}) - ${availability.occupiedSlots}/${availability.totalSlots} slots used`);
              break;
            }
          }
          
          // If no available material found, use the first material (fallback)
          if (!selectedMaterial) {
            selectedMaterial = sortedMaterials[0];
            console.log(`⚠️ No available material found, using first smart material: ${selectedMaterial.materialId}`);
          }
        } else {
          throw new Error('No compatible materials found for this plan');
        }
      } catch (error) {
        console.error('❌ Smart material selection failed, falling back to plan materials:', error.message);
        // Fallback to plan's materials if smart selection fails
        if (plan.materials && plan.materials.length > 0) {
          // ✅ ENHANCED: Validate that fallback material has a registered device
          const { validateMaterialHasDevice } = require('../utils/materialDeviceValidator');
          
          for (const material of plan.materials) {
            const deviceValidation = await validateMaterialHasDevice(material.materialId);
            
            if (deviceValidation.hasDevice) {
              selectedMaterial = material;
              console.log(`✅ Fallback to plan material with device: ${selectedMaterial.materialId}`);
              break;
            } else {
              console.log(`⚠️ Skipping plan material ${material.materialId}: ${deviceValidation.reason}`);
            }
          }
          
          if (!selectedMaterial) {
            throw new Error('No plan materials have registered devices available for ad deployment');
          }
        } else {
          throw new Error('No materials assigned to this plan');
        }
      }

      // ✅ Set reservation expiration BEFORE creating the ad (7 days from now)
      const reservationExpires = new Date();
      reservationExpires.setDate(reservationExpires.getDate() + 7);

      const ad = new Ad({
        ...input,
        userId: user.id,
        materialId: [selectedMaterial._id], // Use array with the selected material
        durationDays: plan.durationDays,
        numberOfDevices: plan.numberOfDevices,
        adLengthSeconds: actualVideoDuration, // Use detected video duration instead of plan duration
        playsPerDayPerDevice: plan.playsPerDayPerDevice,
        totalPlaysPerDay,
        pricePerPlay: plan.pricePerPlay,
        totalPrice,
        price: totalPrice,
        startTime: startTime, // Use user's desired start time directly
        endTime,
        userDesiredStartTime: userDesiredStartDate, // Store user's desired start time
        status: 'PENDING',
        adStatus: 'INACTIVE', // Will be activated after admin approval
        impressions: 0,
        reasonForReject: null,
        approveTime: null,
        rejectTime: null,
        reservationExpires: reservationExpires // ✅ Set reservation expiration at creation
      });

      const savedAd = await ad.save();

      // Send notification to admins about new ad submission
      try {
        const AdminNotificationService = require('../services/notifications/AdminNotificationService');
        await AdminNotificationService.sendNewAdSubmissionNotification(savedAd._id);
        console.log(`✅ Sent new ad submission notification for ad: ${savedAd._id}`);
      } catch (notificationError) {
        console.error('❌ Error sending new ad submission notification:', notificationError);
        // Don't fail the ad creation if notification fails
      }

      // ✅ NEW: Reserve slot immediately upon ad creation (before payment)
      try {
        console.log(`🔄 Reserving slot for ad: ${savedAd._id}`);
        let availability = await MaterialAvailability.findOne({ materialId: selectedMaterial._id });
        
        // Create availability record if it doesn't exist
        if (!availability) {
          availability = new MaterialAvailability({
            materialId: selectedMaterial._id,
            totalSlots: 5,
            occupiedSlots: 0,
            availableSlots: 5,
            currentAds: [],
            scheduledAds: [],
            status: 'AVAILABLE'
          });
        }
        
        // ✅ reservationExpires was already set before ad creation, so we can use it from savedAd
        const reservationExpires = savedAd.reservationExpires;
        
        // Reserve slot for the ad
        const slotNumber = availability.reserveSlot(savedAd._id, startTime, endTime, reservationExpires);
        await availability.save();
        
        // ✅ No second save needed - reservationExpires was already set before the first save
        
        console.log(`✅ Reserved slot ${slotNumber} for ad ${savedAd._id} (expires: ${reservationExpires.toISOString()})`);
        console.log(`📊 Material ${selectedMaterial.materialId}: ${availability.currentAds.length} current, ${availability.scheduledAds.length} scheduled`);
      } catch (availabilityError) {
        console.error('❌ Error reserving slot:', availabilityError);
        // If slot reservation fails, delete the ad to prevent orphaned records
        await Ad.findByIdAndDelete(savedAd._id);
        throw new Error(`Cannot create ad: ${availabilityError.message}`);
      }

      // Note: Ad deployment is handled by the Ad model's post-save hook
      // when the ad status is PAID and adStatus is ACTIVE

      return await Ad.findById(savedAd._id)
        .populate('planId')
        .populate('materialId')
        .populate('userId');
    },

    updateAd: async (_, { id, input }, { user }) => {
      checkAuth(user);
      const ad = await Ad.findById(id);
      if (!ad) throw new Error('Ad not found');

      const isAdmin = ['ADMIN', 'SUPERADMIN'].includes(user.role);

      const applyPlanChanges = async (planId, startTime) => {
        const plan = await Plan.findById(planId);
        if (!plan) throw new Error('Invalid plan selected');

        ad.planId = plan._id;
        ad.numberOfDevices = plan.numberOfDevices;
        ad.adLengthSeconds = plan.adLengthSeconds;
        ad.playsPerDayPerDevice = plan.playsPerDayPerDevice;
        ad.totalPlaysPerDay = plan.playsPerDayPerDevice * plan.numberOfDevices;
        ad.pricePerPlay = plan.pricePerPlay;

        const days = plan.durationDays;
        ad.totalPrice = ad.totalPlaysPerDay * plan.pricePerPlay * days;
        ad.price = ad.totalPrice;

        if (startTime) {
          const endTime = new Date(startTime);
          endTime.setDate(endTime.getDate() + days);
          ad.endTime = endTime;
        }
      };

      if (input.materialId) {
        const materialExists = await Material.exists({ _id: input.materialId });
        if (!materialExists) throw new Error('Material not found');
      }

      if (isAdmin) {
        if (input.status && input.status !== ad.status) {
          const previousStatus = ad.status;
          ad.status = input.status;

          if (input.status === "APPROVED") {
            ad.approveTime = new Date();
            ad.rejectTime = null;
            ad.reasonForReject = null;
            
            // Set paymentStatus to PENDING when admin approves
            ad.paymentStatus = 'PENDING';
            
            // Send approval notification to user
            try {
              console.log('🔔 AdResolver: Sending approval notification for ad:', ad._id);
              await NotificationService.sendAdApprovalNotification(ad._id);
              console.log('✅ AdResolver: Approval notification sent successfully');
            } catch (notificationError) {
              console.error('❌ AdResolver: Error sending approval notification:', notificationError);
              console.error('❌ AdResolver: Error details:', notificationError.message);
              console.error('❌ AdResolver: Stack trace:', notificationError.stack);
              // Don't fail the ad update if notification fails
            }

            // Send notification to Super Admin
            try {
              console.log('🔔 AdResolver: Sending ad approval notification to Super Admin');
              await NotificationService.sendAdApprovalBySuperAdmin(ad._id, user.id);
              console.log('✅ AdResolver: Super Admin notification sent successfully');
            } catch (notificationError) {
              console.error('❌ AdResolver: Error sending Super Admin notification:', notificationError);
              // Don't fail the ad update if notification fails
            }
          } else if (input.status === "REJECTED") {
            ad.rejectTime = new Date();
            ad.approveTime = null;
            ad.reasonForReject = input.reasonForReject || "No reason provided";
            
            // Send rejection notification to user
            try {
              await NotificationService.sendAdRejectionNotification(ad._id, ad.reasonForReject);
            } catch (notificationError) {
              console.error('Error sending rejection notification:', notificationError);
              // Don't fail the ad update if notification fails
            }

            // Send notification to Super Admin
            try {
              console.log('🔔 AdResolver: Sending ad rejection notification to Super Admin');
              await NotificationService.sendAdRejectionBySuperAdmin(ad._id, user.id, ad.reasonForReject);
              console.log('✅ AdResolver: Super Admin notification sent successfully');
            } catch (notificationError) {
              console.error('❌ AdResolver: Error sending Super Admin notification:', notificationError);
              // Don't fail the ad update if notification fails
            }
          } else {
            ad.approveTime = null;
            ad.rejectTime = null;
            ad.reasonForReject = null;
          }
        }

        if (input.planId) {
          await applyPlanChanges(input.planId, input.startTime || ad.startTime);
        }

        if (input.startTime) {
          ad.startTime = new Date(input.startTime);
          if (ad.planId) {
            await applyPlanChanges(ad.planId, input.startTime);
          }
        }

        if (input.adType && ["DIGITAL", "NON_DIGITAL"].includes(input.adType)) ad.adType = input.adType;
        if (input.adFormat) ad.adFormat = input.adFormat;
        if (input.title !== undefined) ad.title = input.title;
        if (input.description !== undefined) ad.description = input.description;

        if (input.mediaFile !== undefined) {
          if (!input.mediaFile.startsWith('http')) {
            throw new Error('Media file must be a Firebase Storage URL');
          }
          ad.mediaFile = input.mediaFile;
        }

        if (input.materialId !== undefined) ad.materialId = input.materialId;

      } else {
        if (ad.userId.toString() !== user.id) throw new Error("Not authorized to update this ad");
        if (input.status && input.status !== ad.status) throw new Error("You are not authorized to update the status");

        if (input.planId) {
          await applyPlanChanges(input.planId, input.startTime || ad.startTime);
        }

        // Handle flexible ad updates (no plan)
        if (!ad.planId) {
          // Check if material type or vehicle type is changing
          const typeChanged = (input.materialType && input.materialType !== ad.materialType) ||
                            (input.vehicleType && input.vehicleType !== ad.vehicleType);

          if (typeChanged) {
            console.log('🔄 [AdResolver] Material/Vehicle type changed, need to reassign materials');
            
            // Update the types
            if (input.materialType) ad.materialType = input.materialType;
            if (input.vehicleType) ad.vehicleType = input.vehicleType;
            if (input.category) ad.category = input.category;

            // Clear old material assignments
            ad.materialId = [];
            
            console.log('✅ [AdResolver] Types updated, will reassign materials below');
          }

          // Update ad length
          if (input.adLengthSeconds !== undefined) {
            const allowedLengths = [20, 40, 60];
            if (!allowedLengths.includes(input.adLengthSeconds)) {
              throw new Error('Ad length must be 20, 40, or 60 seconds');
            }
            ad.adLengthSeconds = input.adLengthSeconds;
          }

          // Update duration
          if (input.durationDays !== undefined) {
            const allowedDurations = [30, 60, 90, 120, 150, 180];
            if (!allowedDurations.includes(input.durationDays)) {
              throw new Error('Duration must be 1-6 months (30-180 days)');
            }
            ad.durationDays = input.durationDays;

            // Recalculate end time if start time exists
            if (ad.startTime) {
              const endTime = new Date(ad.startTime);
              endTime.setDate(endTime.getDate() + input.durationDays);
              ad.endTime = endTime;
            }
          }

          // Update number of devices
          if (input.numberOfDevices !== undefined) {
            if (input.numberOfDevices < 1) {
              throw new Error('At least 1 device is required');
            }
            ad.numberOfDevices = input.numberOfDevices;
          }

          // Update price
          if (input.price !== undefined) {
            ad.price = input.price;
            ad.totalPrice = input.price;
          }

          // Check if device reassignment is needed
          const needsDeviceReassignment = typeChanged || 
                                         input.numberOfDevices !== undefined || 
                                         input.startTime !== undefined || 
                                         input.durationDays !== undefined;

          // ✅ IMMEDIATE DEVICE REASSIGNMENT
          if (needsDeviceReassignment && ad.materialType && ad.vehicleType) {
            console.log('🔄 [AdResolver] Device reassignment needed - releasing old slots and finding new devices');
            
            // Step 1: Release old slot reservations
            const oldMaterialIds = Array.isArray(ad.materialId) ? ad.materialId : (ad.materialId ? [ad.materialId] : []);
            
            if (oldMaterialIds.length > 0) {
              console.log(`🧹 [AdResolver] Releasing ${oldMaterialIds.length} old slot reservation(s)...`);
              for (const materialId of oldMaterialIds) {
                try {
                  const availability = await MaterialAvailability.findOne({ materialId });
                  if (availability) {
                    availability.removeAd(ad._id);
                    await availability.save();
                    console.log(`✅ [AdResolver] Released slot for material ${materialId}`);
                  }
                } catch (releaseError) {
                  console.error(`❌ [AdResolver] Error releasing slot for material ${materialId}:`, releaseError.message);
                  // Continue with other releases even if one fails
                }
              }
            }

            // Step 2: Get updated parameters for device selection
            const updatedStartTime = input.startTime ? new Date(input.startTime) : ad.startTime;
            const updatedDurationDays = input.durationDays !== undefined ? input.durationDays : ad.durationDays;
            const updatedNumberOfDevices = input.numberOfDevices !== undefined ? input.numberOfDevices : ad.numberOfDevices;
            const updatedMaterialType = input.materialType || ad.materialType;
            const updatedVehicleType = input.vehicleType || ad.vehicleType;
            const updatedCategory = input.category || ad.category;
            
            // Calculate new end time
            const updatedEndTime = new Date(updatedStartTime);
            updatedEndTime.setDate(updatedEndTime.getDate() + updatedDurationDays);

            console.log(`🎯 [AdResolver] Finding ${updatedNumberOfDevices} devices for ${updatedMaterialType} ${updatedVehicleType} ${updatedCategory}`);
            console.log(`📅 [AdResolver] Period: ${updatedStartTime.toISOString()} to ${updatedEndTime.toISOString()}`);

            // Step 3: Run smart material selection
            try {
              const sortedMaterials = await getMaterialsSortedByAvailability(
                updatedMaterialType,
                updatedVehicleType,
                updatedCategory,
                updatedStartTime,
                updatedEndTime
              );

              if (sortedMaterials.length === 0) {
                throw new Error('No compatible devices found for this configuration. All devices are either full, not mounted, or have no driver assigned.');
              }

              if (sortedMaterials.length < updatedNumberOfDevices) {
                throw new Error(`Only ${sortedMaterials.length} device${sortedMaterials.length === 1 ? '' : 's'} available, but you requested ${updatedNumberOfDevices}. Please reduce the number of devices.`);
              }

              // Step 4: Select and validate devices
              let selectedMaterials = [];
              let devicesSelected = 0;

              for (const material of sortedMaterials) {
                if (devicesSelected >= updatedNumberOfDevices) break;

                // Validation: ensure material has driver and is mounted
                if (!material.driverId) {
                  console.log(`❌ [AdResolver] Skipping ${material.materialId}: No driver assigned`);
                  continue;
                }
                
                if (!material.mountedAt) {
                  console.log(`❌ [AdResolver] Skipping ${material.materialId}: Not physically mounted`);
                  continue;
                }
                
                if (material.dismountedAt) {
                  console.log(`❌ [AdResolver] Skipping ${material.materialId}: Already dismounted`);
                  continue;
                }

                // Check if device has been connected
                const DeviceTracking = require('../models/deviceTracking');
                const deviceTracking = await DeviceTracking.findByMaterialId(material.materialId);
                if (!deviceTracking) {
                  console.log(`❌ [AdResolver] Skipping ${material.materialId}: No connected device`);
                  continue;
                }

                const availability = await MaterialAvailability.findOne({ materialId: material._id });
                if (availability && availability.canAcceptAd(updatedStartTime, updatedEndTime)) {
                  selectedMaterials.push(material);
                  devicesSelected++;
                  console.log(`✅ [AdResolver] Selected device ${devicesSelected}/${updatedNumberOfDevices}: ${material.materialId}`);
                }
              }

              if (selectedMaterials.length < updatedNumberOfDevices) {
                throw new Error(`Only ${selectedMaterials.length} device${selectedMaterials.length === 1 ? '' : 's'} available with open slots, but you requested ${updatedNumberOfDevices}. Please reduce the number of devices.`);
              }

              // Step 5: Update ad with new device assignments
              ad.materialId = selectedMaterials.map(m => m._id);
              ad.targetDevices = selectedMaterials.map(m => m._id);
              console.log(`✅ [AdResolver] Updated ad with ${selectedMaterials.length} new device(s)`);

              // Step 6: Reserve new slots in scheduledAds
              const reservationExpires = new Date();
              reservationExpires.setDate(reservationExpires.getDate() + 7); // 7 days expiration

              for (const material of selectedMaterials) {
                let availability = await MaterialAvailability.findOne({ materialId: material._id });
                if (!availability) {
                  availability = new MaterialAvailability({
                    materialId: material._id,
                    totalSlots: 5,
                    occupiedSlots: 0,
                    availableSlots: 5,
                    currentAds: [],
                    scheduledAds: [],
                    status: 'AVAILABLE'
                  });
                }

                // Reserve slot
                const slotNumber = availability.reserveSlot(ad._id, updatedStartTime, updatedEndTime, reservationExpires);
                await availability.save();
                console.log(`✅ [AdResolver] Reserved slot ${slotNumber} for ad on ${material.materialId} (expires: ${reservationExpires.toISOString()})`);
              }

              ad.reservationExpires = reservationExpires;
              console.log(`🎉 [AdResolver] Device reassignment complete! ${selectedMaterials.length} devices assigned.`);

            } catch (reassignmentError) {
              console.error('❌ [AdResolver] Device reassignment failed:', reassignmentError.message);
              // Clear materialId on error
              ad.materialId = [];
              throw new Error(`Failed to reassign devices: ${reassignmentError.message}`);
            }
          }

          // If type changed or any campaign setting changed, reset to PENDING for re-approval
          if (typeChanged || input.adLengthSeconds !== undefined || 
              input.durationDays !== undefined || input.numberOfDevices !== undefined ||
              input.price !== undefined) {
            console.log('🔄 [AdResolver] Campaign settings changed, resetting to PENDING status');
            ad.status = 'PENDING';
            ad.approveTime = null;
            ad.rejectTime = null;
            ad.reasonForReject = null;
          }
        }

        if (input.startTime) {
          ad.startTime = new Date(input.startTime);
          if (ad.planId) {
            await applyPlanChanges(ad.planId, input.startTime);
          } else if (ad.durationDays) {
            // Recalculate end time for flexible ads
            const endTime = new Date(input.startTime);
            endTime.setDate(endTime.getDate() + ad.durationDays);
            ad.endTime = endTime;
          }
        }

        if (input.adType && ["DIGITAL", "NON_DIGITAL"].includes(input.adType)) ad.adType = input.adType;
        if (input.adFormat) ad.adFormat = input.adFormat;
        if (input.title !== undefined) ad.title = input.title;
        if (input.description !== undefined) ad.description = input.description;

        if (input.mediaFile !== undefined) {
          if (!input.mediaFile.startsWith('http')) {
            throw new Error('Media file must be a Firebase Storage URL');
          }
          ad.mediaFile = input.mediaFile;
        }
      }

      await ad.save();
      return ad;
    },

    deleteAd: async (_, { id }, { user }) => {
      checkAuth(user);
      
      try {
        // 1. Find the ad first to ensure it exists
        const ad = await Ad.findById(id);
        if (!ad) {
          throw new Error('Ad not found');
        }

        // 2. Check permissions: Admin can delete any ad, users can only delete their own pending ads
        const isAdmin = user.role === 'ADMIN' || user.role === 'SUPERADMIN';
        const isOwner = ad.userId.toString() === user.id;
        const isPending = ad.status === 'PENDING';

        if (!isAdmin && (!isOwner || !isPending)) {
          throw new Error('You can only delete your own pending advertisements');
        }

        // Check if already archived
        if (ad.isArchived) {
          throw new Error('Ad is already archived');
        }

        console.log(`🗑️ Archiving ad: ${id} (${ad.title}) - 30-day deferred deletion`);

        // ✅ ARCHIVE INSTEAD OF DELETE (30-day deferred deletion like Facebook)
        const now = new Date();
        const deletionDate = new Date(now);
        deletionDate.setDate(deletionDate.getDate() + 30); // 30 days from now

        ad.isArchived = true;
        ad.archivedAt = now;
        ad.scheduledDeletionDate = deletionDate;
        ad.status = 'ARCHIVED'; // Change status so devices won't play it
        
        await ad.save();

        console.log(`✅ Ad ${id} archived successfully. Scheduled for permanent deletion on: ${deletionDate.toISOString()}`);
        console.log(`📌 Deployment slots preserved - devices will show company ads instead`);

        // ✅ DON'T remove from deployments - slots stay intact!
        // Devices will skip this ad because status = 'ARCHIVED'
        // Company ad filler system will automatically fill the slot

        return true;

      } catch (error) {
        console.error('❌ Error archiving ad:', error);
        throw new Error(`Failed to archive ad: ${error.message}`);
      }
    },

    restoreAd: async (_, { id }, { user }) => {
      checkAuth(user);
      
      try {
        const ad = await Ad.findById(id);
        if (!ad) {
          throw new Error('Ad not found');
        }

        const isAdmin = user.role === 'ADMIN' || user.role === 'SUPERADMIN';
        const isOwner = ad.userId.toString() === user.id;

        if (!isAdmin && !isOwner) {
          throw new Error('Not authorized to restore this advertisement');
        }

        if (!ad.isArchived) {
          throw new Error('Ad is not archived');
        }

        console.log(`✅ Restoring ad: ${id} (${ad.title})`);

        ad.isArchived = false;
        ad.archivedAt = null;
        ad.scheduledDeletionDate = null;
        ad.status = 'PENDING'; // Reset to pending status
        
        await ad.save();

        console.log(`✅ Ad ${id} restored successfully`);

        return true;

      } catch (error) {
        console.error('❌ Error restoring ad:', error);
        throw new Error(`Failed to restore ad: ${error.message}`);
      }
    }
  },

  Ad: {
    id: (parent) => {
      if (parent && parent._id) return parent._id.toString();
      if (parent && parent.id) return parent.id.toString();
      return '';
    },
    userId: async (parent) => await User.findById(parent.userId),
    materialId: async (parent) => await Material.find({ _id: { $in: parent.materialId } }),
    planId: async (parent) => await Plan.findById(parent.planId),
    // Ensure date fields are consistent ISO strings to avoid client-side Invalid Date
    startTime: (parent) => {
      try {
        return parent.startTime ? new Date(parent.startTime).toISOString() : '';
      } catch (e) {
        console.error('Error parsing startTime:', e, 'value:', parent.startTime);
        return '';
      }
    },
    endTime: (parent) => {
      try {
        return parent.endTime ? new Date(parent.endTime).toISOString() : '';
      } catch (e) {
        console.error('Error parsing endTime:', e, 'value:', parent.endTime);
        return '';
      }
    },
    createdAt: (parent) => {
      try {
        return parent.createdAt ? new Date(parent.createdAt).toISOString() : '';
      } catch (e) {
        console.error('Error parsing createdAt:', e, 'value:', parent.createdAt);
        return '';
      }
    },
    updatedAt: (parent) => {
      try {
        return parent.updatedAt ? new Date(parent.updatedAt).toISOString() : '';
      } catch (e) {
        console.error('Error parsing updatedAt:', e, 'value:', parent.updatedAt);
        return '';
      }
    },
  },

  AdsPlan: {
    id: (parent) => parent._id.toString(),
  },
};

module.exports = adResolvers;
