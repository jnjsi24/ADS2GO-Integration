const CompanyAd = require('../models/CompanyAd');
const User = require('../models/User');
const { checkAuth, checkAdmin } = require('../middleware/auth');
const { deleteFromFirebase } = require('../utils/firebaseStorage');
const NotificationService = require('../services/notifications/NotificationService');

/**
 * Helper function to safely convert any date value to ISO string
 * Handles: Date objects, timestamps (number/string), and ISO strings
 */
function toISOString(value) {
  if (!value) return null;
  
  // If already a Date object, convert to ISO
  if (value instanceof Date) {
    return value.toISOString();
  }
  
  // If it's a number or numeric string (timestamp), convert to Date first
  if (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) {
    const timestamp = typeof value === 'string' ? parseInt(value, 10) : value;
    return new Date(timestamp).toISOString();
  }
  
  // If it's already an ISO string, return as-is
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return value;
  }
  
  // Fallback: try to create a Date and convert
  try {
    return new Date(value).toISOString();
  } catch (error) {
    console.error('❌ Failed to convert date:', value, error);
    return null;
  }
}

const companyAdResolvers = {
  Query: {
    getAllCompanyAds: async (_, __, { user }) => {
      checkAdmin(user);
      const ads = await CompanyAd.find({})
        .populate('createdBy', 'firstName lastName email')
        .populate('updatedBy', 'firstName lastName email')
        .sort({ priority: -1, createdAt: -1 });
      
      // Convert to plain objects to ensure date transformations stick
      const plainAds = ads.map(ad => {
        const obj = ad.toObject();
        // Add id field (virtual field from Mongoose)
        obj.id = ad._id.toString();
        return obj;
      });
      
      // Handle ads with null createdBy by providing a default user object
      return plainAds.map(ad => {
        if (!ad.createdBy) {
          ad.createdBy = {
            id: 'unknown',
            firstName: 'Unknown',
            lastName: 'User',
            email: 'unknown@example.com'
          };
        }
        // Ensure dates are properly formatted as ISO strings
        const originalCreatedAt = ad.createdAt;
        ad.createdAt = toISOString(ad.createdAt);
        ad.updatedAt = toISOString(ad.updatedAt);
        ad.lastPlayed = toISOString(ad.lastPlayed);
        ad.startDate = toISOString(ad.startDate);
        ad.endDate = toISOString(ad.endDate);
        ad.archivedAt = toISOString(ad.archivedAt);
        ad.scheduledDeletionDate = toISOString(ad.scheduledDeletionDate);
        
        // Debug logging
        if (!ad.createdAt) {
          console.log('⚠️ Warning: Failed to format createdAt for ad:', ad.id, 'Original value:', originalCreatedAt);
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
      
      // Convert to plain object to ensure date transformations stick
      const plainAd = companyAd.toObject();
      plainAd.id = companyAd._id.toString();
      
      // Handle null createdBy
      if (!plainAd.createdBy) {
        plainAd.createdBy = {
          id: 'unknown',
          firstName: 'Unknown',
          lastName: 'User',
          email: 'unknown@example.com'
        };
      }
      
      // Ensure dates are properly formatted as ISO strings
      plainAd.createdAt = toISOString(plainAd.createdAt);
      plainAd.updatedAt = toISOString(plainAd.updatedAt);
      plainAd.lastPlayed = toISOString(plainAd.lastPlayed);
      plainAd.startDate = toISOString(plainAd.startDate);
      plainAd.endDate = toISOString(plainAd.endDate);
      plainAd.archivedAt = toISOString(plainAd.archivedAt);
      plainAd.scheduledDeletionDate = toISOString(plainAd.scheduledDeletionDate);
      
      return plainAd;
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
        companyAd.isActive = true; // Re-activate when restored
        
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
