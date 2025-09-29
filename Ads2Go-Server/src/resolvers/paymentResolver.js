const Payment = require('../models/Payment');
const Ad = require('../models/Ad');
const AdsPlan = require('../models/AdsPlan');
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
      targetMaterials = await Material.find({ _id: { $in: ad.targetDevices } });
    } else {
      // Single device ad: deploy to primary material
      const material = await Material.findById(ad.materialId);
      if (!material) {
        console.error(`❌ Cannot deploy Ad ${ad._id}: Material not found`);
        return;
      }
      targetMaterials = [material];
    }
    
    if (targetMaterials.length === 0) {
      console.error(`❌ Cannot deploy Ad ${ad._id}: No target materials found`);
      return;
    }

    // Deploy to each target device
    let deploymentSuccess = true;
    const deploymentResults = [];
    
    for (const material of targetMaterials) {
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

      // Populate durationDays from adsId and planID
      const results = await Promise.all(
        payments.map(async (p) => {
          const ad = await Ad.findById(p.adsId).select('id title durationDays');
          const plan = await AdsPlan.findById(p.planID).select('id title durationDays');
          return {
            ...p.toObject(),
            adsId: ad,
            planID: plan,
          };
        })
      );

      return results;
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
      checkAuth(user);
      const ads = await Ad.find({ userId: user.id }).sort({ createdAt: -1 });
      const payments = await Payment.find({
        adsId: { $in: ads.map(ad => ad._id) },
      });

      return ads.map(ad => ({
        ad,
        payment: payments.find(p => p.adsId.toString() === ad._id.toString()) || null,
      }));
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
      if (ad.status !== 'APPROVED') throw new Error('Ad is not approved');

      const existingPayment = await Payment.findOne({ adsId });
      if (existingPayment) throw new Error('A payment already exists for this ad.');

      // Validate that the ad belongs to the user
      if (ad.userId.toString() !== user.id) {
        throw new Error('You are not authorized to pay for this advertisement.');
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
        planID: ad.planId || null, // Add planID from the ad (null for flexible ads)
        receiptId,
        paymentStatus: 'PAID', // Use 'PAID' instead of 'COMPLETED'
        paymentDate: paymentDate || new Date(),
        amount: ad.totalPrice,
      });

      // Validate slot availability before payment (for flexible ads)
      if (ad.targetDevices && ad.targetDevices.length > 0) {
        const MaterialAvailability = require('../models/MaterialAvailability');
        console.log('🔍 Validating slot availability for flexible ad...');
        
        for (const deviceId of ad.targetDevices) {
          const availability = await MaterialAvailability.findOne({ materialId: deviceId });
          if (!availability) {
            throw new Error(`Device ${deviceId} availability not found`);
          }
          
          // Check if the ad is still in the reserved slots
          const isReserved = availability.currentAds.some(adSlot => 
            adSlot.adId.toString() === ad._id.toString()
          );
          
          if (!isReserved) {
            throw new Error(`Slots for device ${deviceId} are no longer reserved for this ad. They may have been taken by another user.`);
          }
          
          console.log(`✅ Slot validation passed for device ${deviceId}`);
        }
      }

      // Start a transaction to ensure both payment and ad update succeed or fail together
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        console.log('Creating payment with data:', {
          userId: user.id,
          adsId: adsId,
          planID: ad.planId,
          paymentType: paymentType,
          amount: ad.totalPrice,
          receiptId: receiptId
        });

        // Save the payment
        await newPayment.save({ session });
        console.log('Payment saved successfully');

        // Update the ad status to RUNNING and mark as PAID
        ad.status = 'RUNNING';
        ad.adStatus = 'ACTIVE';
        ad.paymentStatus = 'PAID';
        ad.paymentDate = new Date();
        await ad.save({ session });
        console.log('Ad status updated successfully');

        // Commit the transaction
        await session.commitTransaction();
        session.endSession();
        console.log('Transaction committed successfully');

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
            ad.title
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

      await Payment.findByIdAndDelete(id);

      return {
        success: true,
        message: 'Payment deleted successfully',
        payment: null,
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
    planID: async (parent) => {
      if (!parent.planID) return null; // Handle flexible ads without plans
      const plan = await AdsPlan.findById(parent.planID);
      return plan || null;
    },
  },
};

module.exports = paymentResolvers;