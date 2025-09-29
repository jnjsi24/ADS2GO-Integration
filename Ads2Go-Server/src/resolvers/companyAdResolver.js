const CompanyAd = require('../models/CompanyAd');
const User = require('../models/User');
const { checkAuth, checkAdmin } = require('../middleware/auth');
const { deleteFromFirebase } = require('../utils/firebaseStorage');

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
      return await CompanyAd.getActiveAds();
    },

    getRandomCompanyAd: async (_, __, { user }) => {
      // Allow unauthenticated access for random company ads (used by mobile app)
      // These are public fallback content
      const ads = await CompanyAd.getRandomAd();
      return ads.length > 0 ? ads[0] : null;
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
        
        return await CompanyAd.findById(companyAd._id)
          .populate('createdBy', 'firstName lastName email')
          .populate('updatedBy', 'firstName lastName email');
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

        // Delete media file from Firebase if it exists
        if (companyAd.mediaFile) {
          try {
            await deleteFromFirebase(companyAd.mediaFile);
          } catch (firebaseError) {
            console.warn('Failed to delete media file from Firebase:', firebaseError);
            // Continue with deletion even if Firebase deletion fails
          }
        }

        await CompanyAd.findByIdAndDelete(id);
        return true;
      } catch (error) {
        console.error('Error deleting company ad:', error);
        throw new Error('Failed to delete company ad: ' + error.message);
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
