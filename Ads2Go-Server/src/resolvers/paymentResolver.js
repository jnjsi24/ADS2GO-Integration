const Payment = require('../models/Payment');
const Ad = require('../models/Ad');
const { checkAuth, checkAdmin } = require('../middleware/auth');
const mongoose = require('mongoose');

// Helper function to trigger ad deployment
async function triggerAdDeployment(ad) {
  if (ad.adStatus !== 'ACTIVE' || ad.paymentStatus !== 'PAID') {
    console.log(`Skipping deployment for ad ${ad._id}: adStatus=${ad.adStatus}, paymentStatus=${ad.paymentStatus}`);
    return;
  }

  const Material = require('../models/Material');
  const AdsDeployment = require('../models/adsDeployment');

  try {
    console.log(`🔄 Starting deployment for Ad ${ad._id}`);
    
    // Check deployment status to prevent race conditions
    if (ad.deploymentStatus === 'DEPLOYING' || ad.deploymentStatus === 'DEPLOYED') {
      console.log(`ℹ️ Ad ${ad._id} deployment already in progress or completed (status: ${ad.deploymentStatus}), skipping`);
      return;
    }
    
    // Check if this ad is already deployed to prevent duplicate deployments
    const existingDeployment = await AdsDeployment.findOne({
      $or: [
        { 'lcdSlots.adId': ad._id },
        { 'headressSlots.adId': ad._id }
      ]
    });
    
    if (existingDeployment) {
      console.log(`ℹ️ Ad ${ad._id} is already deployed, updating status to DEPLOYED`);
      await Ad.findByIdAndUpdate(ad._id, { 
        deploymentStatus: 'DEPLOYED',
        lastDeploymentAttempt: new Date()
      });
      return;
    }
    
    // Mark as deploying to prevent race conditions
    await Ad.findByIdAndUpdate(ad._id, { 
      deploymentStatus: 'DEPLOYING',
      deploymentAttempts: (ad.deploymentAttempts || 0) + 1,
      lastDeploymentAttempt: new Date()
    });
    
    // Get target devices for deployment
    let targetMaterials = [];
    
    if (ad.targetDevices && ad.targetDevices.length > 0) {
      // Multi-device ad: deploy to all target devices
      console.log(`🔄 Deploying multi-device Ad ${ad._id} to ${ad.targetDevices.length} devices`);
      // ✅ Exclude archived materials - they should be treated as deleted
      targetMaterials = await Material.find({ 
        _id: { $in: ad.targetDevices },
        isArchived: { $ne: true }
      });
    } else if (ad.materialId && ad.materialId.length > 0) {
      // Use materialId array if targetDevices is empty
      console.log(`🔄 Deploying Ad ${ad._id} to ${ad.materialId.length} materials from materialId array`);
      // ✅ Exclude archived materials - they should be treated as deleted
      targetMaterials = await Material.find({ 
        _id: { $in: ad.materialId },
        isArchived: { $ne: true }
      });
    } else {
      console.error(`❌ Cannot deploy Ad ${ad._id}: No materials specified`);
      return;
    }
    
    if (targetMaterials.length === 0) {
      console.error(`❌ Cannot deploy Ad ${ad._id}: No target materials found (or all materials are archived)`);
      return;
    }

    // Deploy to each target device
    let deploymentSuccess = true;
    const deploymentResults = [];
    
    for (const material of targetMaterials) {
      // ✅ Double-check material is not archived
      if (material.isArchived) {
        console.error(`❌ Cannot deploy Ad ${ad._id} to ${material.materialId}: Material is archived`);
        deploymentSuccess = false;
        continue;
      }
      
      if (!material.driverId) {
        console.error(`❌ Cannot deploy Ad ${ad._id} to ${material.materialId}: No driver assigned`);
        deploymentSuccess = false;
        continue;
      }

      // Determine deployment method based on material type
      if (material.materialType === 'HEADDRESS') {
        // HEADDRESS ads → use addToHEADDRESS method (shared across tablet slots)
        console.log(`🔄 Deploying HEADDRESS Ad ${ad._id} to material ${material.materialId}`);
        try {
          const deployment = await AdsDeployment.addToHEADDRESS(
            material.materialId, // Use string materialId, not ObjectId _id
            material.driverId,
            ad._id,
            ad.startTime,
            ad.endTime
          );
          
          if (!deployment) {
            throw new Error('Deployment returned null');
          }
          
          console.log(`✅ HEADDRESS Ad ${ad._id} added to deployment ${deployment.adDeploymentId || deployment._id} for device ${material.materialId}`);
          deploymentResults.push({
            materialId: material.materialId,
            success: true,
            deploymentId: deployment.adDeploymentId || deployment._id
          });
        } catch (error) {
          console.error(`❌ Error deploying HEADDRESS Ad ${ad._id} to ${material.materialId}:`, error.message);
          deploymentSuccess = false;
          deploymentResults.push({
            materialId: material.materialId,
            success: false,
            error: error.message
          });
        }
      } else if (material.materialType === 'LCD') {
        // LCD ads → use addToLCD method
        console.log(`🔄 Deploying LCD Ad ${ad._id} to material ${material.materialId}`);
        try {
          const deployment = await AdsDeployment.addToLCD(
            material.materialId,
            material.driverId,
            ad._id,
            ad.startTime,
            ad.endTime
          );
          
          if (!deployment) {
            throw new Error('Deployment returned null');
          }
          
          console.log(`✅ LCD Ad ${ad._id} added to deployment ${deployment.adDeploymentId || deployment._id} for device ${material.materialId}`);
          deploymentResults.push({
            materialId: material.materialId,
            success: true,
            deploymentId: deployment.adDeploymentId || deployment._id
          });
        } catch (error) {
          console.error(`❌ Error deploying LCD Ad ${ad._id} to ${material.materialId}:`, error.message);
          deploymentSuccess = false;
          deploymentResults.push({
            materialId: material.materialId,
            success: false,
            error: error.message
          });
        }
      }
    }
    
    // Mark deployment status based on results
    if (deploymentSuccess) {
      // Clean up reservation from MaterialAvailability since ad is now deployed
      const MaterialAvailability = require('../models/MaterialAvailability');
      for (const material of targetMaterials) {
        try {
          const availability = await MaterialAvailability.findOne({ materialId: material._id });
          if (availability) {
            // Remove reservation from scheduledAds (it's now in AdsDeployment)
            availability.scheduledAds = availability.scheduledAds.filter(
              slot => slot.adId.toString() !== ad._id.toString()
            );
            await availability.save();
            console.log(`🧹 Cleaned up reservation for ad ${ad._id} from material ${material.materialId}`);
          }
        } catch (cleanupError) {
          console.error(`❌ Error cleaning up reservation for ad ${ad._id}:`, cleanupError);
          // Don't fail deployment if cleanup fails
        }
      }
      
      await Ad.findByIdAndUpdate(ad._id, { 
        deploymentStatus: 'DEPLOYED',
        lastDeploymentAttempt: new Date()
      });
      console.log(`✅ Multi-device Ad ${ad._id} deployed successfully to ${deploymentResults.filter(r => r.success).length}/${targetMaterials.length} devices`);
    } else {
      await Ad.findByIdAndUpdate(ad._id, { 
        deploymentStatus: 'FAILED',
        lastDeploymentAttempt: new Date()
      });
      console.log(`❌ Multi-device Ad ${ad._id} deployment failed for some devices`);
      return;
    }

  } catch (err) {
    console.error(`❌ Failed to deploy Ad ${ad._id}: ${err.message}`);
    // Mark deployment as failed
    await Ad.findByIdAndUpdate(ad._id, { 
      deploymentStatus: 'FAILED',
      lastDeploymentAttempt: new Date()
    });
  }
}

const paymentResolvers = {
  Query: {
    getAllPayments: async (_, { paymentStatus }, { user }) => {
      checkAdmin(user);

      const filter = {};
      if (paymentStatus) {
        filter.paymentStatus = paymentStatus; // filter by status if provided
      }

      return await Payment.find(filter).sort({ createdAt: -1 });
    },

  

  getPaymentsByUser: async (_, { paymentStatus }, { user }) => {
      checkAuth(user);

      // Ensure correct type for userId
      const userIdFilter = mongoose.Types.ObjectId.isValid(user.id)
        ? new mongoose.Types.ObjectId(user.id)
        : user.id;

      const filter = { userId: userIdFilter };

      // Add paymentStatus filter if provided
      if (paymentStatus) {
        filter.paymentStatus = paymentStatus;
      }

      // Fetch payments
      const payments = await Payment.find(filter).sort({ createdAt: -1 });

      // Populate durationDays from adsId - exclude archived ads
      const results = await Promise.all(
        payments.map(async (p) => {
          const ad = await Ad.findById(p.adsId).select('id title durationDays isArchived status');
          // ✅ Filter out payments for archived ads
          if (!ad || ad.isArchived || ad.status === 'ARCHIVED') {
            return null; // Skip archived ads
          }
          return {
            ...p.toObject(),
            adsId: ad,
          };
        })
      );

      // Remove null entries (archived ads)
      return results.filter(r => r !== null);
    },

    getPaymentById: async (_, { id }, { user }) => {
      checkAuth(user);
      const payment = await Payment.findById(id);
      if (!payment) throw new Error('Payment not found');
      if (
        payment.userId.toString() !== user.id &&
        !['ADMIN', 'SUPERADMIN'].includes(user.role)
      ) throw new Error('Not authorized to view this payment');
      return payment;
    },

    getUserAdsWithPayments: async (_, __, { user }) => {
      try {
        checkAuth(user);
        console.log('🔍 getUserAdsWithPayments - User ID:', user.id);
        
        // ✅ Exclude archived ads - they should be treated as deleted
        const ads = await Ad.find({ 
          userId: user.id,
          isArchived: { $ne: true },
          status: { $nin: ['ARCHIVED'] }
        }).sort({ createdAt: -1 });
        console.log('🔍 getUserAdsWithPayments - Found ads:', ads.length);
        
        const payments = await Payment.find({
          adsId: { $in: ads.map(ad => ad._id) },
        });
        console.log('🔍 getUserAdsWithPayments - Found payments:', payments.length);

        const result = ads.map(ad => ({
          ad,
          payment: payments.find(p => p.adsId.toString() === ad._id.toString()) || null,
        }));
        
        console.log('🔍 getUserAdsWithPayments - Returning result:', result.length);
        return result;
      } catch (error) {
        console.error('❌ Error in getUserAdsWithPayments:', error);
        throw error;
      }
    },
  },

  Mutation: {
    createPayment: async (_, { input }, { user }) => {
      checkAuth(user);

      const { adsId, paymentType, paymentDate } = input;

      // Validate input
      if (!adsId) throw new Error('Advertisement ID is required');
      if (!paymentType) throw new Error('Payment type is required');
      
      // Validate payment type
      const validPaymentTypes = ['CREDIT_CARD', 'DEBIT_CARD', 'GCASH', 'PAYPAL', 'BANK_TRANSFER', 'CASH'];
      if (!validPaymentTypes.includes(paymentType)) {
        throw new Error(`Invalid payment type. Must be one of: ${validPaymentTypes.join(', ')}`);
      }

      const ad = await Ad.findById(adsId);
      if (!ad) throw new Error('Ad not found');
      
      // ✅ Check if ad is archived - treat as deleted
      if (ad.isArchived || ad.status === 'ARCHIVED') {
        throw new Error('This ad has been archived and is no longer accessible');
      }
      
      // Check if ad is approved AND paymentStatus is PENDING
      if (ad.status !== 'APPROVED' || ad.paymentStatus !== 'PENDING') {
        throw new Error('Ad must be approved and payment must be pending before you can make a payment');
      }

      const existingPayment = await Payment.findOne({ adsId });
      if (existingPayment) throw new Error('A payment already exists for this ad.');

      // Validate that the ad belongs to the user
      if (ad.userId.toString() !== user.id) {
        throw new Error('You are not authorized to pay for this advertisement.');
      }

      // ✅ NEW: Auto-adjust start date if it's in the past (before slot validation)
      const now = new Date();
      let startDateAdjusted = false;
      const originalStartTime = new Date(ad.startTime);
      
      // ✅ FIX: Check if the start date is in the past - if so, deploy instantly (current time)
      const startDateOnly = new Date(ad.startTime);
      startDateOnly.setUTCHours(0, 0, 0, 0);
      const today = new Date(now);
      today.setUTCHours(0, 0, 0, 0);
      
      if (startDateOnly < today || ad.startTime < now) {
        // Start date is in the past - auto-adjust to current time (instant deployment)
        console.log(`📅 Original start date (${originalStartTime.toISOString()}) is in the past, auto-adjusting to current time for instant deployment...`);
        
        // Update start time to current time (instant deployment)
        ad.startTime = now;
        
        // Recalculate end time to maintain original duration
        const newEndDate = new Date(now);
        newEndDate.setUTCDate(newEndDate.getUTCDate() + ad.durationDays);
        
        ad.endTime = newEndDate;
        startDateAdjusted = true;
        
        console.log(`✅ Start date adjusted from ${originalStartTime.toISOString()} to ${now.toISOString()} (instant deployment)`);
        console.log(`✅ End date recalculated to ${newEndDate.toISOString()} (maintaining ${ad.durationDays} days duration)`);
      }

      let receiptId;
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 10;
      
      while (!isUnique && attempts < maxAttempts) {
        const randomNum = Math.floor(1000 + Math.random() * 9000); // 4 digits
        receiptId = `REC-${randomNum}`;
        const duplicate = await Payment.findOne({ receiptId });
        if (!duplicate) isUnique = true;
        attempts++;
      }
      
      if (!isUnique) {
        throw new Error('Unable to generate unique receipt ID. Please try again.');
      }

      const newPayment = new Payment({
        ...input,
        userId: user.id,
        // Removed planID - no longer using AdsPlan
        receiptId,
        paymentStatus: 'PAID', // Use 'PAID' instead of 'COMPLETED'
        paymentDate: paymentDate || new Date(),
        amount: ad.totalPrice,
      });

      // Validate slot availability before payment (for flexible ads)
      if (ad.targetDevices && ad.targetDevices.length > 0) {
        const MaterialAvailability = require('../models/MaterialAvailability');
        const { getMaterialsSortedByAvailability } = require('../utils/smartMaterialSelection');
        console.log('🔍 Validating slot availability for flexible ad...');
        
        const unavailableDevices = [];
        const Material = require('../models/Material');
        
        for (const deviceId of ad.targetDevices) {
          const availability = await MaterialAvailability.findOne({ materialId: deviceId });
          if (!availability) {
            throw new Error(`Device ${deviceId} availability not found`);
          }
          
          // ✅ IMPROVED: Check if the ad is in either currentAds OR scheduledAds
          const isInCurrentAds = availability.currentAds.some(adSlot => 
            adSlot.adId.toString() === ad._id.toString()
          );
          
          const isInScheduledAds = availability.scheduledAds.some(adSlot => 
            adSlot.adId.toString() === ad._id.toString()
          );
          
          if (!isInCurrentAds && !isInScheduledAds) {
            // Reservation expired - check if we can re-reserve
            console.log(`⚠️ Reservation expired for device ${deviceId}, attempting to re-reserve...`);
            
            // Check if slot is still available
            if (availability.canAcceptAd(ad.startTime, ad.endTime)) {
              // Re-reserve the slot
              const slotNumber = availability.reserveSlot(
                ad._id,
                ad.startTime,
                ad.endTime,
                null // No expiration since payment is happening now
              );
              await availability.save();
              console.log(`✅ Re-reserved slot ${slotNumber} for device ${deviceId}`);
            } else {
              // Slot is truly unavailable - we'll need to find alternatives
              unavailableDevices.push(deviceId);
              console.log(`⚠️ Device ${deviceId} is no longer available`);
            }
          } else {
            console.log(`✅ Slot validation passed for device ${deviceId}`);
          }
        }
        
        // If some devices are unavailable, try to find alternatives
        if (unavailableDevices.length > 0 && unavailableDevices.length < ad.targetDevices.length) {
          console.log(`⚠️ ${unavailableDevices.length}/${ad.targetDevices.length} devices are unavailable, will try to assign to the remaining devices only`);
          // Remove unavailable devices from targetDevices
          ad.targetDevices = ad.targetDevices.filter(deviceId => !unavailableDevices.includes(deviceId.toString()));
          console.log(`📋 Updated targetDevices to: ${ad.targetDevices.length} device(s)`);
        } else if (unavailableDevices.length === ad.targetDevices.length) {
          // All original devices are unavailable - try to find completely new materials
          console.log(`⚠️ All original devices are unavailable, searching for alternative materials...`);
          try {
            const alternativeMaterials = await getMaterialsSortedByAvailability(
              ad.materialType,
              ad.vehicleType,
              ad.category,
              new Date(ad.startTime),
              new Date(ad.endTime)
            );
            
            if (alternativeMaterials.length >= ad.numberOfDevices) {
              // Found alternatives - update targetDevices
              const newTargetDevices = alternativeMaterials.slice(0, ad.numberOfDevices).map(m => m._id);
              console.log(`✅ Found ${newTargetDevices.length} alternative device(s), updating targetDevices`);
              ad.targetDevices = newTargetDevices;
              ad.materialId = newTargetDevices; // Also update materialId
              
              // Reserve the new slots
              for (const material of alternativeMaterials.slice(0, ad.numberOfDevices)) {
                const availability = await MaterialAvailability.findOne({ materialId: material._id });
                if (availability) {
                  const slotNumber = availability.reserveSlot(
                    ad._id,
                    ad.startTime,
                    ad.endTime,
                    null
                  );
                  await availability.save();
                  console.log(`✅ Reserved new slot ${slotNumber} for alternative device ${material.materialId}`);
                }
              }
            } else {
              throw new Error(
                `Only ${alternativeMaterials.length} device(s) available, but you need ${ad.numberOfDevices}. ` +
                `Please create a new ad with different dates or reduce the number of devices.`
              );
            }
          } catch (error) {
            if (error.message.includes('Only') || error.message.includes('No compatible materials')) {
              throw error; // Re-throw our custom errors
            }
            throw new Error(
              `Slots for your requested devices are no longer available. They have been taken by another user. ` +
              `Please create a new ad with different dates or materials.`
            );
          }
        }
      }

      // Start a transaction to ensure both payment and ad update succeed or fail together
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        console.log('💳 Creating payment with data:', {
          userId: user.id,
          adsId: adsId,
          // Removed planID - no longer using AdsPlan
          paymentType: paymentType,
          amount: ad.totalPrice,
          receiptId: receiptId,
          paymentStatus: 'PAID'
        });

        // Save the payment
        await newPayment.save({ session });
        console.log('✅ Payment saved successfully to database with ID:', newPayment._id);

        // ✅ Set status based on (potentially adjusted) start time
        const now = new Date();
        const finalStartTime = new Date(ad.startTime);
        if (finalStartTime <= now) {
          ad.status = 'RUNNING';
          console.log(`📅 Ad starts immediately or in the past (${finalStartTime.toISOString()}), status set to RUNNING`);
        } else {
          ad.status = 'SCHEDULED';
          console.log(`📅 Ad starts in the future (${finalStartTime.toISOString()}), status set to SCHEDULED`);
        }
        
        ad.adStatus = 'ACTIVE';
        ad.paymentStatus = 'PAID';
        ad.paymentDate = new Date();
        ad.reservationExpires = null; // ✅ Clear reservation expiration since payment is confirmed
        await ad.save({ session });
        console.log(`✅ Ad status updated to: ${ad.status}`);

        // Commit the transaction
        await session.commitTransaction();
        session.endSession();
        console.log('Transaction committed successfully');

        // ✅ Send notification to user about payment confirmation and ad status
        try {
          const BaseNotificationService = require('../services/notifications/BaseNotificationService');
          
          let notificationTitle = '';
          let notificationMessage = '';
          let notificationCategory = '';
          
          if (ad.status === 'RUNNING') {
            // Ad is running immediately
            const endDate = new Date(ad.endTime).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric',
              year: 'numeric'
            });
            notificationTitle = '✅ Payment Confirmed - Your Ad is Now Running!';
            let message = `Payment received! Your ad "${ad.title}" is now running and being displayed on the selected devices. It will run until ${endDate}.`;
            if (startDateAdjusted) {
              const newStartDate = new Date(ad.startTime).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
              });
              message += ` Note: Your original start date was in the past, so the ad start date has been adjusted to ${newStartDate} to ensure it runs properly.`;
            }
            notificationMessage = message;
            notificationCategory = 'AD_STARTED';
          } else if (ad.status === 'SCHEDULED') {
            // Ad is scheduled for future
            const startDate = new Date(ad.startTime).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric',
              year: 'numeric'
            });
            const endDate = new Date(ad.endTime).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric',
              year: 'numeric'
            });
            notificationTitle = '✅ Payment Confirmed - Ad Slot Secured!';
            let message = `Payment received! Your ad "${ad.title}" is scheduled to run from ${startDate} to ${endDate}. We'll notify you when it starts.`;
            if (startDateAdjusted) {
              const originalDate = originalStartTime.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
              });
              message += ` Note: Your original start date (${originalDate}) was in the past, so the ad start date has been adjusted to ${startDate} to ensure it runs properly.`;
            }
            notificationMessage = message;
            notificationCategory = 'AD_SCHEDULED';
          }
          
          if (notificationTitle) {
            await BaseNotificationService.createNotification(
              ad.userId,
              notificationTitle,
              notificationMessage,
              'SUCCESS',
              {
                category: notificationCategory,
                priority: 'HIGH',
                adId: ad._id,
                adTitle: ad.title,
                data: {
                  startTime: ad.startTime,
                  endTime: ad.endTime,
                  adId: ad._id.toString(),
                  receiptId,
                  action: 'VIEW_DETAILS'
                }
              }
            );
            console.log(`📧 Sent payment confirmation notification for ad ${ad._id}`);
          }
        } catch (notifError) {
          console.error('❌ Error sending payment confirmation notification:', notifError);
          // Don't fail the payment if notification fails
        }

        // Trigger deployment after transaction is committed
        // This is done outside the transaction to avoid conflicts
        try {
          console.log('Triggering ad deployment after payment...');
          const Ad = require('../models/Ad');
          const Material = require('../models/Material');
          const AdsDeployment = require('../models/adsDeployment');
          
          const ad = await Ad.findById(adsId);
          if (ad) {
            console.log('Ad found for deployment:', {
              id: ad._id,
              adStatus: ad.adStatus,
              paymentStatus: ad.paymentStatus,
              materialId: ad.materialId,
              deploymentStatus: ad.deploymentStatus
            });
            
            // Create UserAnalytics record if it doesn't exist
            try {
              const UserAnalytics = require('../models/userAnalytics');
              let userAnalytics = await UserAnalytics.findOne({ userId: ad.userId });
              
              if (!userAnalytics) {
                console.log(`📊 Creating UserAnalytics record for user ${ad.userId} during payment`);
                
                userAnalytics = new UserAnalytics({
                  userId: ad.userId,
                  ads: [],
                  totalAds: 0,
                  totalDevices: 0,
                  totalAdPlays: 0,
                  totalAdPlayTime: 0,
                  totalAdImpressions: 0,
                  totalQRScans: 0,
                  averageAdCompletionRate: 0,
                  qrScanConversionRate: 0,
                  adPerformance: [],
                  materialBreakdown: [],
                  errorLogs: [],
                  isActive: true
                });
                
                await userAnalytics.save();
                console.log(`✅ Created UserAnalytics record for user ${ad.userId}`);
              } else {
                console.log(`ℹ️ UserAnalytics already exists for user ${ad.userId}`);
              }
            } catch (userAnalyticsError) {
              console.error(`⚠️ Warning: Could not create UserAnalytics during payment:`, userAnalyticsError.message);
              // Don't fail the payment if UserAnalytics creation fails
            }
            
            // Manually trigger deployment logic since post-save hook is skipped
            await triggerAdDeployment(ad);
            console.log('Ad deployment triggered successfully');
            
            // Verify deployment was created
            const deployments = await AdsDeployment.find({});
            console.log('Total deployments after payment:', deployments.length);
          } else {
            console.error('Ad not found for deployment:', adsId);
          }
        } catch (deploymentError) {
          console.error('Deployment error (non-critical):', deploymentError);
          // Don't fail the payment if deployment fails
        }

        // Send payment confirmation notification to user
        try {
          console.log('Sending payment confirmation notification...');
          const NotificationService = require('../services/notifications/NotificationService');
          await NotificationService.sendPaymentConfirmationNotification(
            user.id,
            ad.totalPrice,
            ad.title,
            ad._id
          );
          console.log('✅ Payment confirmation notification sent successfully');
        } catch (notificationError) {
          console.error('❌ Error sending payment confirmation notification:', notificationError);
          // Don't fail the payment if notification fails
        }

        // Send payment success notification to admins
        try {
          console.log('Sending payment success notification to admins...');
          await NotificationService.sendPaymentSuccessNotification(newPayment._id);
          console.log('✅ Payment success notification sent to admins successfully');
        } catch (notificationError) {
          console.error('❌ Error sending payment success notification to admins:', notificationError);
          // Don't fail the payment if notification fails
        }

        return {
          success: true,
          message: 'Payment created and ad deployed successfully',
          payment: newPayment
        };
      } catch (error) {
        // If anything fails, abort the transaction
        await session.abortTransaction();
        session.endSession();
        console.error('Payment transaction failed:', error);
        
        // Provide more specific error messages based on the error type
        if (error.name === 'ValidationError') {
          const validationErrors = Object.values(error.errors).map(err => err.message).join(', ');
          throw new Error(`Validation failed: ${validationErrors}`);
        } else if (error.name === 'MongoError' && error.code === 11000) {
          throw new Error('Duplicate payment detected. Please try again.');
        } else if (error.message.includes('Ad not found')) {
          throw new Error('The advertisement you are trying to pay for was not found.');
        } else if (error.message.includes('Ad is not approved')) {
          throw new Error('This advertisement is not yet approved. You can only pay for approved ads.');
        } else if (error.message.includes('A payment already exists')) {
          throw new Error('A payment already exists for this advertisement.');
        } else {
          // Log the full error for debugging but return a user-friendly message
          console.error('Unexpected payment error:', error);
          throw new Error(`Payment processing failed: ${error.message || 'Please try again.'}`);
        }
      }
    },

    deletePayment: async (_, { id }, { user }) => {
      checkAuth(user);

      const payment = await Payment.findById(id);
      if (!payment) throw new Error('Payment not found');
      if (payment.userId.toString() !== user.id) throw new Error('Not authorized');
      if (payment.paymentStatus === 'PAID') throw new Error('Cannot delete a paid payment');
      
      // Check if already archived
      if (payment.isArchived) {
        throw new Error('Payment is already archived');
      }
      
      console.log(`🗑️ Archiving payment: ${id} - 30-day deferred deletion`);
      
      // Soft delete: Mark as archived with 30-day deletion schedule
      const now = new Date();
      const deletionDate = new Date(now);
      deletionDate.setDate(deletionDate.getDate() + 30); // 30 days from now
      
      payment.isArchived = true;
      payment.archivedAt = now;
      payment.scheduledDeletionDate = deletionDate;
      
      await payment.save();
      
      console.log(`✅ Payment ${id} archived successfully. Scheduled for permanent deletion on: ${deletionDate.toISOString()}`);

      return {
        success: true,
        message: 'Payment archived successfully. Scheduled for deletion in 30 days.',
        payment: null,
      };
    },

    restorePayment: async (_, { id }, { user }) => {
      checkAuth(user);

      const payment = await Payment.findById(id);
      if (!payment) throw new Error('Payment not found');
      if (payment.userId.toString() !== user.id) throw new Error('Not authorized');
      
      if (!payment.isArchived) {
        throw new Error('Payment is not archived');
      }
      
      console.log(`✅ Restoring payment: ${id}`);
      
      payment.isArchived = false;
      payment.archivedAt = null;
      payment.scheduledDeletionDate = null;
      
      await payment.save();
      
      console.log(`✅ Payment ${id} restored successfully`);

      return {
        success: true,
        message: 'Payment restored successfully.',
        payment: payment,
      };
    },

    // ✅ Added updatePayment for admin
    updatePayment: async (_, { id, input }, { user }) => {
      checkAdmin(user); // only admin can update

      const payment = await Payment.findById(id);
      if (!payment) throw new Error('Payment not found');

      payment.paymentStatus = input.paymentStatus;
      await payment.save();

      return {
        success: true,
        message: 'Payment updated successfully',
        payment,
      };
    },
  },

  Payment: {
    adsId: async (parent) => {
      const ad = await Ad.findById(parent.adsId);
      return ad || null;
    },
    // Removed planID resolver - no longer using AdsPlan
  },
};

module.exports = paymentResolvers;