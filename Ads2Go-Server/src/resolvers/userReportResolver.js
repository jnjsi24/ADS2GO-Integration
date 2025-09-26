const UserReport = require('../models/UserReport');
const User = require('../models/User');
const { checkAuth, checkAdmin } = require('../middleware/auth');

const resolvers = {
  Query: {
    getUserReports: async (_, { filters = {}, limit = 50, offset = 0 }, { user }) => {
      checkAuth(user);
      
      try {
        const reports = await UserReport.getUserReports(user.id, filters, { limit, offset });
        const totalCount = await UserReport.getUserReportCount(user.id, filters);
        
        return {
          success: true,
          message: 'Reports retrieved successfully',
          reports,
          totalCount
        };
      } catch (error) {
        console.error('Error fetching user reports:', error);
        throw new Error('Failed to fetch reports');
      }
    },

    getUserReportById: async (_, { id }, { user }) => {
      checkAuth(user);
      
      try {
        const report = await UserReport.findOne({ _id: id, userId: user.id })
          .populate('user', 'firstName lastName email');
        
        if (!report) {
          throw new Error('Report not found or access denied');
        }
        
        return report;
      } catch (error) {
        console.error('Error fetching user report:', error);
        throw new Error('Failed to fetch report');
      }
    },

    // Admin queries
    getAllUserReports: async (_, { filters = {}, limit = 50, offset = 0 }, { admin, superAdmin }) => {
      checkAdmin(admin || superAdmin);
      
      try {
        const query = {};
        
        if (filters.reportType) {
          query.reportType = filters.reportType;
        }
        
        if (filters.status) {
          query.status = filters.status;
        }
        
        if (filters.priority) {
          query.priority = filters.priority;
        }
        
        if (filters.startDate || filters.endDate) {
          query.createdAt = {};
          if (filters.startDate) {
            query.createdAt.$gte = new Date(filters.startDate);
          }
          if (filters.endDate) {
            query.createdAt.$lte = new Date(filters.endDate);
          }
        }
        
        const reports = await UserReport.find(query)
          .populate('user', 'firstName lastName email')
          .sort({ createdAt: -1 })
          .limit(limit)
          .skip(offset);
        
        const totalCount = await UserReport.countDocuments(query);
        
        return {
          success: true,
          message: 'Reports retrieved successfully',
          reports,
          totalCount
        };
      } catch (error) {
        console.error('Error fetching all user reports:', error);
        throw new Error('Failed to fetch reports');
      }
    },

    getUserReportByIdAdmin: async (_, { id }, { admin, superAdmin }) => {
      checkAdmin(admin || superAdmin);
      
      try {
        const report = await UserReport.findById(id)
          .populate('user', 'firstName lastName email');
        
        if (!report) {
          throw new Error('Report not found');
        }
        
        return report;
      } catch (error) {
        console.error('Error fetching user report for admin:', error);
        throw new Error('Failed to fetch report');
      }
    }
  },

  Mutation: {
    createUserReport: async (_, { input }, { user }) => {
      checkAuth(user);
      
      try {
        // Validate required fields
        if (!input.title || !input.description || !input.reportType) {
          throw new Error('Title, description, and report type are required');
        }
        
        // Validate title length
        if (input.title.length > 200) {
          throw new Error('Title must be 200 characters or less');
        }
        
        // Validate description length
        if (input.description.length > 2000) {
          throw new Error('Description must be 2000 characters or less');
        }
        
        // Validate report type
        const validReportTypes = ['BUG', 'PAYMENT', 'ACCOUNT', 'CONTENT_VIOLATION', 'FEATURE_REQUEST', 'OTHER'];
        if (!validReportTypes.includes(input.reportType)) {
          throw new Error('Invalid report type');
        }
        
        
        // Validate attachments if provided
        if (input.attachments && input.attachments.length > 0) {
          const urlRegex = /^https?:\/\/.+/;
          for (const attachment of input.attachments) {
            if (!urlRegex.test(attachment)) {
              throw new Error('All attachments must be valid URLs');
            }
          }
        }
        
        // Create the report
        const newReport = new UserReport({
          userId: user.id,
          title: input.title.trim(),
          description: input.description.trim(),
          reportType: input.reportType,
          attachments: input.attachments || []
        });
        
        const savedReport = await newReport.save();
        await savedReport.populate('user', 'firstName lastName email');
        
        // Send notification to admins about new report
        try {
          const AdminNotificationService = require('../services/notifications/AdminNotificationService');
          await AdminNotificationService.sendNewUserReportNotification(
            user.id,
            savedReport._id,
            input.reportType,
            input.title
          );
        } catch (notificationError) {
          console.error('Error sending notification for new report:', notificationError);
          // Don't fail the report creation if notification fails
        }
        
        return {
          success: true,
          message: 'Report created successfully',
          report: savedReport
        };
      } catch (error) {
        console.error('Error creating user report:', error);
        throw new Error(error.message || 'Failed to create report');
      }
    },

    updateUserReport: async (_, { id, input }, { user }) => {
      checkAuth(user);
      
      try {
        const report = await UserReport.findOne({ _id: id, userId: user.id });
        
        if (!report) {
          throw new Error('Report not found or access denied');
        }
        
        // Check if report can be modified by user
        if (!report.canBeModifiedByUser()) {
          throw new Error('This report cannot be modified as it is no longer pending');
        }
        
        // Validate input fields
        if (input.title && input.title.length > 200) {
          throw new Error('Title must be 200 characters or less');
        }
        
        if (input.description && input.description.length > 2000) {
          throw new Error('Description must be 2000 characters or less');
        }
        
        if (input.reportType) {
          const validReportTypes = ['BUG', 'PAYMENT', 'ACCOUNT', 'CONTENT_VIOLATION', 'FEATURE_REQUEST', 'OTHER'];
          if (!validReportTypes.includes(input.reportType)) {
            throw new Error('Invalid report type');
          }
        }
        
        
        if (input.attachments && input.attachments.length > 0) {
          const urlRegex = /^https?:\/\/.+/;
          for (const attachment of input.attachments) {
            if (!urlRegex.test(attachment)) {
              throw new Error('All attachments must be valid URLs');
            }
          }
        }
        
        // Update the report
        const updateData = {};
        if (input.title) updateData.title = input.title.trim();
        if (input.description) updateData.description = input.description.trim();
        if (input.reportType) updateData.reportType = input.reportType;
        if (input.attachments) updateData.attachments = input.attachments;
        
        const updatedReport = await UserReport.findByIdAndUpdate(
          id,
          updateData,
          { new: true, runValidators: true }
        ).populate('user', 'firstName lastName email');
        
        return {
          success: true,
          message: 'Report updated successfully',
          report: updatedReport
        };
      } catch (error) {
        console.error('Error updating user report:', error);
        throw new Error(error.message || 'Failed to update report');
      }
    },

    deleteUserReport: async (_, { id }, { user }) => {
      checkAuth(user);
      
      try {
        const report = await UserReport.findOne({ _id: id, userId: user.id });
        
        if (!report) {
          throw new Error('Report not found or access denied');
        }
        
        // Check if report can be deleted by user
        if (!report.canBeDeletedByUser()) {
          throw new Error('This report cannot be deleted as it is no longer pending');
        }
        
        await UserReport.findByIdAndDelete(id);
        
        return {
          success: true,
          message: 'Report deleted successfully',
          report: null
        };
      } catch (error) {
        console.error('Error deleting user report:', error);
        throw new Error(error.message || 'Failed to delete report');
      }
    },

    // Admin mutations
    updateUserReportAdmin: async (_, { id, input }, { admin, superAdmin }) => {
      checkAdmin(admin || superAdmin);
      
      try {
        const report = await UserReport.findById(id);
        
        if (!report) {
          throw new Error('Report not found');
        }
        
        // Validate input fields
        if (input.status) {
          const validStatuses = ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
          if (!validStatuses.includes(input.status)) {
            throw new Error('Invalid status');
          }
        }
        
        if (input.adminNotes && input.adminNotes.length > 1000) {
          throw new Error('Admin notes must be 1000 characters or less');
        }
        
        // Store old status for comparison
        const oldStatus = report.status;
        
        // Update the report
        const updateData = {};
        if (input.status) updateData.status = input.status;
        if (input.adminNotes !== undefined) updateData.adminNotes = input.adminNotes.trim();
        
        const updatedReport = await UserReport.findByIdAndUpdate(
          id,
          updateData,
          { new: true, runValidators: true }
        ).populate('user', 'firstName lastName email');
        
        // Send notifications to user if status changed or admin notes added
        try {
          const UserNotificationService = require('../services/notifications/UserNotificationService');
          
          // Check if status changed
          if (input.status && input.status !== oldStatus) {
            await UserNotificationService.sendReportStatusUpdateNotification(
              updatedReport.userId,
              updatedReport._id,
              updatedReport.title,
              oldStatus,
              input.status,
              input.adminNotes || null
            );
          }
          // If only admin notes were added (no status change)
          else if (input.adminNotes && input.adminNotes.trim() && !input.status) {
            await UserNotificationService.sendReportAdminResponseNotification(
              updatedReport.userId,
              updatedReport._id,
              updatedReport.title,
              input.adminNotes.trim()
            );
          }
        } catch (notificationError) {
          console.error('Error sending report notification:', notificationError);
          // Don't fail the update if notification fails
        }
        
        return {
          success: true,
          message: 'Report updated successfully',
          report: updatedReport
        };
      } catch (error) {
        console.error('Error updating user report (admin):', error);
        throw new Error(error.message || 'Failed to update report');
      }
    }
  }
};

module.exports = resolvers;
