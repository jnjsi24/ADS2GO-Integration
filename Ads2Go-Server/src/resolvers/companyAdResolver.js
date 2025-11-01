const CompanyAd = require('../models/CompanyAd');
const User = require('../models/User');
const { checkAuth, checkAdmin } = require('../middleware/auth');
const { deleteFromFirebase } = require('../utils/firebaseStorage');
const NotificationService = require('../services/notifications/NotificationService');

const companyAdResolvers = {
  Query: {
    getAllCompanyAds: async (_, __, { user }) => {
      checkAdmin(user);
      const ads = await CompanyAd.find({})
        .populate('createdBy', 'firstName lastName email')
        .populate('updatedBy', 'firstName lastName email')
        .sort({ priority: -1, createdAt: -1 });
      
      // Handle ads with null createdBy by providing a default user object
      return ads.map(ad => {
        if (!ad.createdBy) {
          ad.createdBy = {
            id: 'unknown',
            firstName: 'Unknown',
            lastName: 'User',
            email: 'unknown@example.com'
          };
        }
        return ad;
      });
    },

    getCompanyAdById: async (_, { id }, { user }) => {
      checkAdmin(user);
      const companyAd = await CompanyAd.findById(id)
        .populate('createdBy', 'firstName lastName email')
        .populate('updatedBy', 'firstName lastName email');
      
      if (!companyAd) {
        throw new Error('Company ad not found');
      }
      
      // Handle null createdBy
      if (!companyAd.createdBy) {
        companyAd.createdBy = {
          id: 'unknown',
          firstName: 'Unknown',
          lastName: 'User',
          email: 'unknown@example.com'
        };
      }
      
      return companyAd;
    },

    getActiveCompanyAds: async (_, __, { user }) => {
      // Allow unauthenticated access for active company ads (used by mobile app)
      // These are public fallback content
      return await CompanyAd.getCurrentlyActiveAds();
    },

    getRandomCompanyAd: async (_, __, { user }) => {
      // Allow unauthenticated access for random company ads (used by mobile app)
      // These are public fallback content
      return await CompanyAd.getRandomScheduledAd();
    }
  },

  Mutation: {
    createCompanyAd: async (_, { input }, { user }) => {
      checkAdmin(user);
      
      try {
        const companyAd = new CompanyAd({
          ...input,
          createdBy: user.id,
          priority: input.priority || 0,
          isActive: input.isActive !== undefined ? input.isActive : true
        });

        await companyAd.save();
        
        const populatedAd = await CompanyAd.findById(companyAd._id)
          .populate('createdBy', 'firstName lastName email')
          .populate('updatedBy', 'firstName lastName email');
        
        // Send notification to admins about new company ad
        try {
          await NotificationService.sendCompanyAdCreatedNotification(
            companyAd._id,
            user.id
          );
        } catch (notifError) {
          console.error('Error sending company ad created notification:', notifError);
          // Don't fail the creation if notification fails
        }
        
        return populatedAd;
      } catch (error) {
        console.error('Error creating company ad:', error);
        throw new Error('Failed to create company ad: ' + error.message);
      }
    },

    updateCompanyAd: async (_, { id, input }, { user }) => {
      checkAdmin(user);
      
      try {
        const companyAd = await CompanyAd.findById(id);
        if (!companyAd) {
          throw new Error('Company ad not found');
        }

        // Update fields
        Object.keys(input).forEach(key => {
          if (input[key] !== undefined) {
            companyAd[key] = input[key];
          }
        });
        
        companyAd.updatedBy = user.id;
        await companyAd.save();
        
        return await CompanyAd.findById(id)
          .populate('createdBy', 'firstName lastName email')
          .populate('updatedBy', 'firstName lastName email');
      } catch (error) {
        console.error('Error updating company ad:', error);
        throw new Error('Failed to update company ad: ' + error.message);
      }
    },

    deleteCompanyAd: async (_, { id }, { user }) => {
      checkAdmin(user);
      
      try {
        const companyAd = await CompanyAd.findById(id);
        if (!companyAd) {
          throw new Error('Company ad not found');
        }
        
        // Check if already archived
        if (companyAd.isArchived) {
          throw new Error('Company ad is already archived');
        }

        console.log(`🗑️ Archiving company ad: ${id} (${companyAd.title}) - 30-day deferred deletion`);
        
        // Soft delete: Mark as archived with 30-day deletion schedule
        const now = new Date();
        const deletionDate = new Date(now);
        deletionDate.setDate(deletionDate.getDate() + 30); // 30 days from now
        
        companyAd.isArchived = true;
        companyAd.archivedAt = now;
        companyAd.scheduledDeletionDate = deletionDate;
        companyAd.isActive = false; // Deactivate immediately
        
        await companyAd.save();
        
        console.log(`✅ Company ad ${id} archived successfully. Scheduled for permanent deletion on: ${deletionDate.toISOString()}`);
        console.log(`📌 Media file will be deleted from Firebase after 30 days`);
        
        return true;
      } catch (error) {
        console.error('Error archiving company ad:', error);
        throw new Error('Failed to archive company ad: ' + error.message);
      }
    },

    restoreCompanyAd: async (_, { id }, { user }) => {
      checkAdmin(user);
      
      try {
        const companyAd = await CompanyAd.findById(id);
        if (!companyAd) {
          throw new Error('Company ad not found');
        }
        
        if (!companyAd.isArchived) {
          throw new Error('Company ad is not archived');
        }

        console.log(`✅ Restoring company ad: ${id} (${companyAd.title})`);
        
        companyAd.isArchived = false;
        companyAd.archivedAt = null;
        companyAd.scheduledDeletionDate = null;
        
        await companyAd.save();
        
        console.log(`✅ Company ad ${id} restored successfully`);
        
        return true;
      } catch (error) {
        console.error('Error restoring company ad:', error);
        throw new Error('Failed to restore company ad: ' + error.message);
      }
    },

    toggleCompanyAdStatus: async (_, { id }, { user }) => {
      checkAdmin(user);
      
      try {
        const companyAd = await CompanyAd.findById(id);
        if (!companyAd) {
          throw new Error('Company ad not found');
        }

        companyAd.isActive = !companyAd.isActive;
        companyAd.updatedBy = user.id;
        await companyAd.save();
        
        return await CompanyAd.findById(id)
          .populate('createdBy', 'firstName lastName email')
          .populate('updatedBy', 'firstName lastName email');
      } catch (error) {
        console.error('Error toggling company ad status:', error);
        throw new Error('Failed to toggle company ad status: ' + error.message);
      }
    },

    incrementCompanyAdPlayCount: async (_, { id }, { user }) => {
      // Allow unauthenticated access for play count tracking (used by mobile app)
      // This is just analytics data, not sensitive information
      
      try {
        const companyAd = await CompanyAd.findById(id);
        if (!companyAd) {
          throw new Error('Company ad not found');
        }

        companyAd.playCount += 1;
        companyAd.lastPlayed = new Date();
        await companyAd.save();
        
        return await CompanyAd.findById(id)
          .populate('createdBy', 'firstName lastName email')
          .populate('updatedBy', 'firstName lastName email');
      } catch (error) {
        console.error('Error incrementing company ad play count:', error);
        throw new Error('Failed to increment play count: ' + error.message);
      }
    }
  }
};

module.exports = companyAdResolvers;
