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
        
        // Set reservation expiration (7 days from now)
        const reservationExpires = new Date();
        reservationExpires.setDate(reservationExpires.getDate() + 7);
        
        // Reserve slot for the ad
        const slotNumber = availability.reserveSlot(savedAd._id, startTime, endTime, reservationExpires);
        await availability.save();
        
        // Store reservation expiration in ad
        savedAd.reservationExpires = reservationExpires;
        await savedAd.save();
        
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
