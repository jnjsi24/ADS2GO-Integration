const User = require('../models/User');
const Ad = require('../models/Ad');
const Driver = require('../models/Driver');
const Material = require('../models/Material');
const Admin = require('../models/Admin');
const SuperAdmin = require('../models/SuperAdmin');
const CompanyAd = require('../models/CompanyAd');
const FAQ = require('../models/FAQ');
const AdsDeployment = require('../models/adsDeployment');
const Payment = require('../models/Payment');
const DriverSalaryPricing = require('../models/DriverSalaryPricing');
const logger = require('../utils/logger');

/**
 * User Deletion Job
 * Permanently deletes users who have been archived for 30+ days
 * Similar to Facebook's deferred deletion system
 */

class UserDeletionJob {
  constructor() {
    this.isRunning = false;
  }

  /**
   * Main job function - Permanently delete ads scheduled for deletion
   */
  async deleteExpiredAds() {
    console.log('🗑️ Starting ad deletion job (30-day deferred deletion)...');

    try {
      const now = new Date();
      
      // Find all archived ads whose scheduledDeletionDate has passed
      const adsToDelete = await Ad.find({
        isArchived: true,
        scheduledDeletionDate: { $lte: now }
      });

      console.log(`📊 Found ${adsToDelete.length} ads scheduled for permanent deletion`);

      let deletedCount = 0;
      let errorCount = 0;

      for (const ad of adsToDelete) {
        try {
          const adId = ad._id;
          const adTitle = ad.title;
          const archivedAt = ad.archivedAt;
          const scheduledDeletionDate = ad.scheduledDeletionDate;

          // Calculate how many days the ad has been archived
          const daysArchived = Math.floor((now - archivedAt) / (1000 * 60 * 60 * 24));

          console.log(`🔍 Processing ad: ${adTitle} (Archived for ${daysArchived} days)`);

          // ✅ NOW PERMANENTLY DELETE: Remove from deployments, analytics, etc.
          const AdsDeployment = require('../models/adsDeployment');
          const Analytics = require('../models/analytics');
          const Payment = require('../models/Payment');
          const MaterialAvailabilityService = require('../services/materialAvailabilityService');
          const { deleteFromFirebase } = require('../utils/firebaseStorage');

          // 1. Remove ad from all deployments
          const deployments = await AdsDeployment.find({
            $or: [
              { adId: adId },
              { 'lcdSlots.adId': adId }
            ]
          });

          for (const deployment of deployments) {
            // Remove from LCD slots
            if (deployment.lcdSlots && deployment.lcdSlots.length > 0) {
              deployment.lcdSlots = deployment.lcdSlots.filter(slot => 
                slot.adId.toString() !== adId.toString()
              );
            }
            
            // Remove from non-LCD deployment
            if (deployment.adId && deployment.adId.toString() === adId.toString()) {
              deployment.adId = null;
            }
            
            // Delete deployment if no ads remain
            if (deployment.lcdSlots.length === 0 && !deployment.adId) {
              await AdsDeployment.findByIdAndDelete(deployment._id);
            } else {
              await deployment.save();
            }
          }

          // 2. Delete analytics records
          await Analytics.deleteMany({ adId: adId });

          // 3. Update payment records
          await Payment.updateMany(
            { adsId: adId },
            { $unset: { adsId: 1 } }
          );

          // 4. Remove from material availability
          try {
            await MaterialAvailabilityService.removeAdFromMaterials(adId);
          } catch (availabilityError) {
            console.warn(`⚠️ Warning: Could not remove from material availability:`, availabilityError.message);
          }

          // 5. Delete media file from Firebase Storage
          if (ad.mediaFile) {
            try {
              const deleteSuccess = await deleteFromFirebase(ad.mediaFile);
              if (deleteSuccess) {
                console.log(`🗑️ Successfully deleted media file from Firebase Storage`);
              }
            } catch (firebaseError) {
              console.warn(`⚠️ Warning: Error deleting media file from Firebase Storage:`, firebaseError.message);
            }
          }

          // 6. Permanently delete the ad
          await Ad.findByIdAndDelete(adId);
          
          deletedCount++;
          console.log(`✅ Permanently deleted ad: ${adTitle} (ID: ${adId})`);
          console.log(`   - Archived on: ${archivedAt.toISOString()}`);
          console.log(`   - Scheduled deletion: ${scheduledDeletionDate.toISOString()}`);
          console.log(`   - Days archived: ${daysArchived}`);

        } catch (error) {
          errorCount++;
          console.error(`❌ Error deleting ad ${ad.title}:`, error.message);
        }
      }

      console.log('✅ Ad deletion job completed successfully');
      console.log(`📊 Summary: ${deletedCount} deleted, ${errorCount} errors`);

      return {
        success: true,
        deletedCount,
        errorCount,
        totalProcessed: adsToDelete.length
      };

    } catch (error) {
      console.error('❌ Ad deletion job failed:', error);
      throw error;
    }
  }

  /**
   * Main job function - Permanently delete users scheduled for deletion
   */
  async deleteExpiredUsers() {
    if (this.isRunning) {
      console.log('⏭️ User deletion job already running, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('🗑️ Starting user deletion job (30-day deferred deletion)...');

    try {
      const now = new Date();
      
      // Find all archived users whose scheduledDeletionDate has passed
      const usersToDelete = await User.find({
        isArchived: true,
        scheduledDeletionDate: { $lte: now }
      });

      console.log(`📊 Found ${usersToDelete.length} users scheduled for permanent deletion`);

      let deletedCount = 0;
      let errorCount = 0;

      for (const user of usersToDelete) {
        try {
          const userId = user._id;
          const userEmail = user.email;
          const archivedAt = user.archivedAt;
          const scheduledDeletionDate = user.scheduledDeletionDate;

          // Calculate how many days the user has been archived
          const daysArchived = Math.floor((now - archivedAt) / (1000 * 60 * 60 * 24));

          console.log(`🔍 Processing user: ${userEmail} (Archived for ${daysArchived} days)`);

          // Optional: Delete or archive associated ads
          const userAds = await Ad.find({ userId: userId });
          if (userAds.length > 0) {
            console.log(`  📢 Found ${userAds.length} ads associated with user ${userEmail}`);
            // Option 1: Delete ads
            // await Ad.deleteMany({ userId: userId });
            
            // Option 2: Keep ads but mark them (recommended)
            await Ad.updateMany(
              { userId: userId },
              { 
                $set: { 
                  status: 'ARCHIVED',
                  // Optionally add a note that the user was deleted
                  deletedUserNote: `User deleted on ${now.toISOString()}`
                }
              }
            );
            console.log(`  ✅ Archived ${userAds.length} ads for deleted user`);
          }

          // Permanently delete the user
          await User.findByIdAndDelete(userId);
          
          deletedCount++;
          console.log(`✅ Permanently deleted user: ${userEmail} (ID: ${userId})`);
          console.log(`   - Archived on: ${archivedAt.toISOString()}`);
          console.log(`   - Scheduled deletion: ${scheduledDeletionDate.toISOString()}`);
          console.log(`   - Days archived: ${daysArchived}`);

        } catch (error) {
          errorCount++;
          console.error(`❌ Error deleting user ${user.email}:`, error.message);
        }
      }

      console.log('✅ User deletion job completed successfully');
      console.log(`📊 Summary: ${deletedCount} deleted, ${errorCount} errors`);

      return {
        success: true,
        deletedCount,
        errorCount,
        totalProcessed: usersToDelete.length
      };

    } catch (error) {
      console.error('❌ User deletion job failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get statistics about archived users
   */
  async getArchivedUsersStats() {
    try {
      const now = new Date();
      
      const totalArchived = await User.countDocuments({ isArchived: true });
      const pendingDeletion = await User.countDocuments({
        isArchived: true,
        scheduledDeletionDate: { $lte: now }
      });
      const scheduled = await User.countDocuments({
        isArchived: true,
        scheduledDeletionDate: { $gt: now }
      });

      return {
        totalArchived,
        pendingDeletion,
        scheduled,
        lastCheck: now.toISOString()
      };
    } catch (error) {
      console.error('Error getting archived users stats:', error);
      throw error;
    }
  }

  /**
   * Restore an archived user (cancel deletion)
   * Useful if admin wants to undo the deletion within 30 days
   */
  async restoreUser(userId) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.isArchived) {
        throw new Error('User is not archived');
      }

      // Restore the user
      user.isArchived = false;
      user.archivedAt = null;
      user.scheduledDeletionDate = null;

      await user.save();

      console.log(`✅ User restored: ${user.email} (ID: ${userId})`);

      return {
        success: true,
        message: 'User restored successfully',
        user
      };
    } catch (error) {
      console.error('Error restoring user:', error);
      throw error;
    }
  }

  /**
   * Main job function - Permanently delete drivers scheduled for deletion
   */
  async deleteExpiredDrivers() {
    console.log('🗑️ Starting driver deletion job (30-day deferred deletion)...');

    try {
      const now = new Date();
      
      // Find all archived drivers whose scheduledDeletionDate has passed
      const driversToDelete = await Driver.find({
        isArchived: true,
        scheduledDeletionDate: { $lte: now }
      });

      console.log(`📊 Found ${driversToDelete.length} drivers scheduled for permanent deletion`);

      let deletedCount = 0;
      let errorCount = 0;

      for (const driver of driversToDelete) {
        try {
          const driverId = driver._id;
          const driverName = driver.fullName;
          const archivedAt = driver.archivedAt;
          const scheduledDeletionDate = driver.scheduledDeletionDate;

          // Calculate how many days the driver has been archived
          const daysArchived = Math.floor((now - archivedAt) / (1000 * 60 * 60 * 24));

          console.log(`🔍 Processing driver: ${driverName} (Archived for ${daysArchived} days)`);

          // ✅ NOW PERMANENTLY DELETE: Unassign materials, delete driver
          
          // 1. Unassign any materials
          await Material.updateMany(
            { driverId: driver.driverId }, 
            { $set: { driverId: null } }
          );
          console.log(`  📦 Unassigned materials for driver ${driverName}`);

          // 2. Permanently delete the driver
          await Driver.findByIdAndDelete(driverId);
          
          deletedCount++;
          console.log(`✅ Permanently deleted driver: ${driverName} (ID: ${driverId})`);
          console.log(`   - Archived on: ${archivedAt.toISOString()}`);
          console.log(`   - Scheduled deletion: ${scheduledDeletionDate.toISOString()}`);
          console.log(`   - Days archived: ${daysArchived}`);

        } catch (error) {
          errorCount++;
          console.error(`❌ Error deleting driver ${driver.fullName}:`, error.message);
        }
      }

      console.log('✅ Driver deletion job completed successfully');
      console.log(`📊 Summary: ${deletedCount} deleted, ${errorCount} errors`);

      return {
        success: true,
        deletedCount,
        errorCount,
        totalProcessed: driversToDelete.length
      };

    } catch (error) {
      console.error('❌ Driver deletion job failed:', error);
      throw error;
    }
  }

  /**
   * Main job function - Permanently delete admins scheduled for deletion
   */
  async deleteExpiredAdmins() {
    console.log('🗑️ Starting admin deletion job (30-day deferred deletion)...');

    try {
      const now = new Date();
      
      const adminsToDelete = await Admin.find({
        isArchived: true,
        scheduledDeletionDate: { $lte: now }
      });

      console.log(`📊 Found ${adminsToDelete.length} admins scheduled for permanent deletion`);

      let deletedCount = 0;
      let errorCount = 0;

      for (const admin of adminsToDelete) {
        try {
          const adminId = admin._id;
          const adminEmail = admin.email;
          const archivedAt = admin.archivedAt;
          const scheduledDeletionDate = admin.scheduledDeletionDate;

          const daysArchived = Math.floor((now - archivedAt) / (1000 * 60 * 60 * 24));

          console.log(`🔍 Processing admin: ${adminEmail} (Archived for ${daysArchived} days)`);

          await Admin.findByIdAndDelete(adminId);
          
          deletedCount++;
          console.log(`✅ Permanently deleted admin: ${adminEmail} (ID: ${adminId})`);
          console.log(`   - Archived on: ${archivedAt.toISOString()}`);
          console.log(`   - Scheduled deletion: ${scheduledDeletionDate.toISOString()}`);
          console.log(`   - Days archived: ${daysArchived}`);

        } catch (error) {
          errorCount++;
          console.error(`❌ Error deleting admin ${admin.email}:`, error.message);
        }
      }

      console.log('✅ Admin deletion job completed successfully');
      console.log(`📊 Summary: ${deletedCount} deleted, ${errorCount} errors`);

      return {
        success: true,
        deletedCount,
        errorCount,
        totalProcessed: adminsToDelete.length
      };

    } catch (error) {
      console.error('❌ Admin deletion job failed:', error);
      throw error;
    }
  }

  /**
   * Main job function - Permanently delete super admins scheduled for deletion
   */
  async deleteExpiredSuperAdmins() {
    console.log('🗑️ Starting super admin deletion job (30-day deferred deletion)...');

    try {
      const now = new Date();
      
      const superAdminsToDelete = await SuperAdmin.find({
        isArchived: true,
        scheduledDeletionDate: { $lte: now }
      });

      console.log(`📊 Found ${superAdminsToDelete.length} super admins scheduled for permanent deletion`);

      let deletedCount = 0;
      let errorCount = 0;

      for (const superAdmin of superAdminsToDelete) {
        try {
          const superAdminId = superAdmin._id;
          const superAdminEmail = superAdmin.email;
          const archivedAt = superAdmin.archivedAt;
          const scheduledDeletionDate = superAdmin.scheduledDeletionDate;

          const daysArchived = Math.floor((now - archivedAt) / (1000 * 60 * 60 * 24));

          console.log(`🔍 Processing super admin: ${superAdminEmail} (Archived for ${daysArchived} days)`);

          await SuperAdmin.findByIdAndDelete(superAdminId);
          
          deletedCount++;
          console.log(`✅ Permanently deleted super admin: ${superAdminEmail} (ID: ${superAdminId})`);
          console.log(`   - Archived on: ${archivedAt.toISOString()}`);
          console.log(`   - Scheduled deletion: ${scheduledDeletionDate.toISOString()}`);
          console.log(`   - Days archived: ${daysArchived}`);

        } catch (error) {
          errorCount++;
          console.error(`❌ Error deleting super admin ${superAdmin.email}:`, error.message);
        }
      }

      console.log('✅ Super admin deletion job completed successfully');
      console.log(`📊 Summary: ${deletedCount} deleted, ${errorCount} errors`);

      return {
        success: true,
        deletedCount,
        errorCount,
        totalProcessed: superAdminsToDelete.length
      };

    } catch (error) {
      console.error('❌ Super admin deletion job failed:', error);
      throw error;
    }
  }

  /**
   * Main job function - Permanently delete materials scheduled for deletion
   */
  async deleteExpiredMaterials() {
    console.log('🗑️ Starting material deletion job (30-day deferred deletion)...');

    try {
      const now = new Date();
      
      const materialsToDelete = await Material.find({
        isArchived: true,
        scheduledDeletionDate: { $lte: now }
      });

      console.log(`📊 Found ${materialsToDelete.length} materials scheduled for permanent deletion`);

      let deletedCount = 0;
      let errorCount = 0;

      for (const material of materialsToDelete) {
        try {
          const materialId = material._id;
          const materialStringId = material.materialId;
          const archivedAt = material.archivedAt;
          const scheduledDeletionDate = material.scheduledDeletionDate;

          const daysArchived = Math.floor((now - archivedAt) / (1000 * 60 * 60 * 24));

          console.log(`🔍 Processing material: ${materialStringId} (Archived for ${daysArchived} days)`);

          // Clean up all related records
          const MaterialAvailability = require('../models/MaterialAvailability');
          const DeviceCompliance = require('../models/deviceCompliance');
          const Tablet = require('../models/Tablet');

          await MaterialAvailability.findOneAndDelete({ materialId });
          await DeviceCompliance.findOneAndDelete({ materialId });
          await Tablet.findOneAndDelete({ materialId: materialStringId });
          
          // Removed AdsPlan functionality - no longer using AdsPlan

          await Material.findByIdAndDelete(materialId);
          
          deletedCount++;
          console.log(`✅ Permanently deleted material: ${materialStringId} (ID: ${materialId})`);
          console.log(`   - Archived on: ${archivedAt.toISOString()}`);
          console.log(`   - Scheduled deletion: ${scheduledDeletionDate.toISOString()}`);
          console.log(`   - Days archived: ${daysArchived}`);

        } catch (error) {
          errorCount++;
          console.error(`❌ Error deleting material ${material.materialId}:`, error.message);
        }
      }

      console.log('✅ Material deletion job completed successfully');
      console.log(`📊 Summary: ${deletedCount} deleted, ${errorCount} errors`);

      return {
        success: true,
        deletedCount,
        errorCount,
        totalProcessed: materialsToDelete.length
      };

    } catch (error) {
      console.error('❌ Material deletion job failed:', error);
      throw error;
    }
  }

  /**
   * Removed deleteExpiredAdsPlans - no longer using AdsPlan
   */
  async deleteExpiredAdsPlans() {
    console.log('⚠️ Ads plan deletion job disabled - no longer using AdsPlan');
    return { deletedCount: 0, errorCount: 0, totalProcessed: 0 };
  }

  /**
   * Main job function - Permanently delete company ads scheduled for deletion
   */
  async deleteExpiredCompanyAds() {
    console.log('🗑️ Starting company ad deletion job (30-day deferred deletion)...');

    try {
      const now = new Date();
      
      const companyAdsToDelete = await CompanyAd.find({
        isArchived: true,
        scheduledDeletionDate: { $lte: now }
      });

      console.log(`📊 Found ${companyAdsToDelete.length} company ads scheduled for permanent deletion`);

      let deletedCount = 0;
      let errorCount = 0;

      for (const companyAd of companyAdsToDelete) {
        try {
          const adId = companyAd._id;
          const adTitle = companyAd.title;
          const archivedAt = companyAd.archivedAt;
          const scheduledDeletionDate = companyAd.scheduledDeletionDate;

          const daysArchived = Math.floor((now - archivedAt) / (1000 * 60 * 60 * 24));

          console.log(`🔍 Processing company ad: ${adTitle} (Archived for ${daysArchived} days)`);

          // Delete media file from Firebase
          if (companyAd.mediaFile) {
            try {
              const { deleteFromFirebase } = require('../utils/firebaseStorage');
              await deleteFromFirebase(companyAd.mediaFile);
              console.log(`🗑️ Successfully deleted media file from Firebase Storage`);
            } catch (firebaseError) {
              console.warn(`⚠️ Warning: Error deleting media file from Firebase Storage:`, firebaseError.message);
            }
          }

          await CompanyAd.findByIdAndDelete(adId);
          
          deletedCount++;
          console.log(`✅ Permanently deleted company ad: ${adTitle} (ID: ${adId})`);
          console.log(`   - Archived on: ${archivedAt.toISOString()}`);
          console.log(`   - Scheduled deletion: ${scheduledDeletionDate.toISOString()}`);
          console.log(`   - Days archived: ${daysArchived}`);

        } catch (error) {
          errorCount++;
          console.error(`❌ Error deleting company ad ${companyAd.title}:`, error.message);
        }
      }

      console.log('✅ Company ad deletion job completed successfully');
      console.log(`📊 Summary: ${deletedCount} deleted, ${errorCount} errors`);

      return {
        success: true,
        deletedCount,
        errorCount,
        totalProcessed: companyAdsToDelete.length
      };

    } catch (error) {
      console.error('❌ Company ad deletion job failed:', error);
      throw error;
    }
  }

  /**
   * Main job function - Permanently delete FAQs scheduled for deletion
   */
  async deleteExpiredFAQs() {
    console.log('🗑️ Starting FAQ deletion job (30-day deferred deletion)...');

    try {
      const now = new Date();
      
      const faqsToDelete = await FAQ.find({
        isArchived: true,
        scheduledDeletionDate: { $lte: now }
      });

      console.log(`📊 Found ${faqsToDelete.length} FAQs scheduled for permanent deletion`);

      let deletedCount = 0;
      let errorCount = 0;

      for (const faq of faqsToDelete) {
        try {
          const faqId = faq._id;
          const archivedAt = faq.archivedAt;
          const scheduledDeletionDate = faq.scheduledDeletionDate;

          const daysArchived = Math.floor((now - archivedAt) / (1000 * 60 * 60 * 24));

          console.log(`🔍 Processing FAQ: ${faqId} (Archived for ${daysArchived} days)`);

          await FAQ.findByIdAndDelete(faqId);
          
          deletedCount++;
          console.log(`✅ Permanently deleted FAQ: ${faqId}`);
          console.log(`   - Archived on: ${archivedAt.toISOString()}`);
          console.log(`   - Scheduled deletion: ${scheduledDeletionDate.toISOString()}`);
          console.log(`   - Days archived: ${daysArchived}`);

        } catch (error) {
          errorCount++;
          console.error(`❌ Error deleting FAQ ${faq._id}:`, error.message);
        }
      }

      console.log('✅ FAQ deletion job completed successfully');
      console.log(`📊 Summary: ${deletedCount} deleted, ${errorCount} errors`);

      return {
        success: true,
        deletedCount,
        errorCount,
        totalProcessed: faqsToDelete.length
      };

    } catch (error) {
      console.error('❌ FAQ deletion job failed:', error);
      throw error;
    }
  }

  /**
   * Main job function - Permanently delete deployments scheduled for deletion
   */
  async deleteExpiredDeployments() {
    console.log('🗑️ Starting deployment deletion job (30-day deferred deletion)...');

    try {
      const now = new Date();
      
      const deploymentsToDelete = await AdsDeployment.find({
        isArchived: true,
        scheduledDeletionDate: { $lte: now }
      });

      console.log(`📊 Found ${deploymentsToDelete.length} deployments scheduled for permanent deletion`);

      let deletedCount = 0;
      let errorCount = 0;

      for (const deployment of deploymentsToDelete) {
        try {
          const deploymentId = deployment._id;
          const archivedAt = deployment.archivedAt;
          const scheduledDeletionDate = deployment.scheduledDeletionDate;

          const daysArchived = Math.floor((now - archivedAt) / (1000 * 60 * 60 * 24));

          console.log(`🔍 Processing deployment: ${deploymentId} (Archived for ${daysArchived} days)`);

          await AdsDeployment.findByIdAndDelete(deploymentId);
          
          deletedCount++;
          console.log(`✅ Permanently deleted deployment: ${deploymentId}`);
          console.log(`   - Archived on: ${archivedAt.toISOString()}`);
          console.log(`   - Scheduled deletion: ${scheduledDeletionDate.toISOString()}`);
          console.log(`   - Days archived: ${daysArchived}`);

        } catch (error) {
          errorCount++;
          console.error(`❌ Error deleting deployment ${deployment._id}:`, error.message);
        }
      }

      console.log('✅ Deployment deletion job completed successfully');
      console.log(`📊 Summary: ${deletedCount} deleted, ${errorCount} errors`);

      return {
        success: true,
        deletedCount,
        errorCount,
        totalProcessed: deploymentsToDelete.length
      };

    } catch (error) {
      console.error('❌ Deployment deletion job failed:', error);
      throw error;
    }
  }

  /**
   * Main job function - Permanently delete payments scheduled for deletion
   */
  async deleteExpiredPayments() {
    console.log('🗑️ Starting payment deletion job (30-day deferred deletion)...');

    try {
      const now = new Date();
      
      const paymentsToDelete = await Payment.find({
        isArchived: true,
        scheduledDeletionDate: { $lte: now }
      });

      console.log(`📊 Found ${paymentsToDelete.length} payments scheduled for permanent deletion`);

      let deletedCount = 0;
      let errorCount = 0;

      for (const payment of paymentsToDelete) {
        try {
          const paymentId = payment._id;
          const archivedAt = payment.archivedAt;
          const scheduledDeletionDate = payment.scheduledDeletionDate;

          const daysArchived = Math.floor((now - archivedAt) / (1000 * 60 * 60 * 24));

          console.log(`🔍 Processing payment: ${paymentId} (Archived for ${daysArchived} days)`);

          await Payment.findByIdAndDelete(paymentId);
          
          deletedCount++;
          console.log(`✅ Permanently deleted payment: ${paymentId}`);
          console.log(`   - Archived on: ${archivedAt.toISOString()}`);
          console.log(`   - Scheduled deletion: ${scheduledDeletionDate.toISOString()}`);
          console.log(`   - Days archived: ${daysArchived}`);

        } catch (error) {
          errorCount++;
          console.error(`❌ Error deleting payment ${payment._id}:`, error.message);
        }
      }

      console.log('✅ Payment deletion job completed successfully');
      console.log(`📊 Summary: ${deletedCount} deleted, ${errorCount} errors`);

      return {
        success: true,
        deletedCount,
        errorCount,
        totalProcessed: paymentsToDelete.length
      };

    } catch (error) {
      console.error('❌ Payment deletion job failed:', error);
      throw error;
    }
  }

  /**
   * Main job function - Permanently delete driver salary pricing scheduled for deletion
   */
  async deleteExpiredDriverSalaryPricing() {
    console.log('🗑️ Starting driver salary pricing deletion job (30-day deferred deletion)...');

    try {
      const now = new Date();
      
      const pricingToDelete = await DriverSalaryPricing.find({
        isArchived: true,
        scheduledDeletionDate: { $lte: now }
      });

      console.log(`📊 Found ${pricingToDelete.length} driver salary pricing records scheduled for permanent deletion`);

      let deletedCount = 0;
      let errorCount = 0;

      for (const pricing of pricingToDelete) {
        try {
          const pricingId = pricing._id;
          const archivedAt = pricing.archivedAt;
          const scheduledDeletionDate = pricing.scheduledDeletionDate;

          const daysArchived = Math.floor((now - archivedAt) / (1000 * 60 * 60 * 24));

          console.log(`🔍 Processing driver salary pricing: ${pricingId} (Archived for ${daysArchived} days)`);

          await DriverSalaryPricing.findByIdAndDelete(pricingId);
          
          deletedCount++;
          console.log(`✅ Permanently deleted driver salary pricing: ${pricingId}`);
          console.log(`   - Archived on: ${archivedAt.toISOString()}`);
          console.log(`   - Scheduled deletion: ${scheduledDeletionDate.toISOString()}`);
          console.log(`   - Days archived: ${daysArchived}`);

        } catch (error) {
          errorCount++;
          console.error(`❌ Error deleting driver salary pricing ${pricing._id}:`, error.message);
        }
      }

      console.log('✅ Driver salary pricing deletion job completed successfully');
      console.log(`📊 Summary: ${deletedCount} deleted, ${errorCount} errors`);

      return {
        success: true,
        deletedCount,
        errorCount,
        totalProcessed: pricingToDelete.length
      };

    } catch (error) {
      console.error('❌ Driver salary pricing deletion job failed:', error);
      throw error;
    }
  }
}

// Create singleton instance
const userDeletionJob = new UserDeletionJob();

module.exports = userDeletionJob;

