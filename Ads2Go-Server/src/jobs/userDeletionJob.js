const User = require('../models/User');
const Ad = require('../models/Ad');
const Driver = require('../models/Driver');
const Material = require('../models/Material');
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
}

// Create singleton instance
const userDeletionJob = new UserDeletionJob();

module.exports = userDeletionJob;

