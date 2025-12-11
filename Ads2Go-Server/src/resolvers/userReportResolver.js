const UserReport = require('../models/UserReport');
const User = require('../models/User');
const { checkAuth, checkAdmin } = require('../middleware/auth');
const NotificationService = require('../services/notifications/NotificationService');

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
        
        // Exclude archived by default unless explicitly requested
        if (filters.includeArchived !== true) {
          query.isArchived = { $ne: true };
        }
        
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
        
        // Note: No email notification for PENDING status (only IN_PROGRESS and RESOLVED send emails)
        
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

        // Check if already archived
        if (report.isArchived) {
          throw new Error('Report is already archived');
        }
        
        // Check if report can be deleted by user
        if (!report.canBeDeletedByUser()) {
          throw new Error('This report cannot be deleted as it is no longer pending');
        }

        console.log(`🗑️ Archiving user report: ${id} - 30-day deferred deletion`);

        // Soft delete: Mark as archived with 30-day deletion schedule
        const now = new Date();
        const deletionDate = new Date(now);
        deletionDate.setDate(deletionDate.getDate() + 30); // 30 days from now

        report.isArchived = true;
        report.archivedAt = now;
        report.scheduledDeletionDate = deletionDate;

        await report.save();

        console.log(`✅ User report ${id} archived successfully. Scheduled for permanent deletion on: ${deletionDate.toISOString()}`);
        
        return {
          success: true,
          message: 'Report archived successfully. Scheduled for deletion in 30 days.',
          report: null
        };
      } catch (error) {
        console.error('Error archiving user report:', error);
        throw new Error(error.message || 'Failed to archive report');
      }
    },

    restoreUserReport: async (_, { id }, { user }) => {
      checkAuth(user);
      
      try {
        const report = await UserReport.findOne({ _id: id, userId: user.id });
        
        if (!report) {
          throw new Error('Report not found or access denied');
        }

        if (!report.isArchived) {
          throw new Error('Report is not archived');
        }

        console.log(`✅ Restoring user report: ${id}`);

        report.isArchived = false;
        report.archivedAt = null;
        report.scheduledDeletionDate = null;

        await report.save();

        console.log(`✅ User report ${id} restored successfully`);
        
        return {
          success: true,
          message: 'Report restored successfully.',
          report
        };
      } catch (error) {
        console.error('Error restoring user report:', error);
        throw new Error(error.message || 'Failed to restore report');
      }
    },

    // Admin mutations
    deleteUserReportAdmin: async (_, { id }, { admin, superAdmin }) => {
      checkAdmin(admin || superAdmin);
      
      try {
        const report = await UserReport.findById(id);
        
        if (!report) {
          throw new Error('Report not found');
        }

        // Check if already archived
        if (report.isArchived) {
          throw new Error('Report is already archived');
        }

        console.log(`🗑️ Admin archiving user report: ${id} - 30-day deferred deletion`);

        // Soft delete: Mark as archived with 30-day deletion schedule
        const now = new Date();
        const deletionDate = new Date(now);
        deletionDate.setDate(deletionDate.getDate() + 30); // 30 days from now

        report.isArchived = true;
        report.archivedAt = now;
        report.scheduledDeletionDate = deletionDate;

        await report.save();

        console.log(`✅ User report ${id} archived successfully by admin. Scheduled for permanent deletion on: ${deletionDate.toISOString()}`);
        
        return {
          success: true,
          message: 'Report archived successfully. Scheduled for deletion in 30 days.',
          report: null
        };
      } catch (error) {
        console.error('Error archiving user report:', error);
        throw new Error(error.message || 'Failed to archive report');
      }
    },

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
        
        // Get current admin info
        const currentAdmin = admin || superAdmin;
        
        // Validate status transitions before making changes
        if (input.status && input.status !== oldStatus) {
          // Prevent backward movement from IN_PROGRESS to PENDING
          if (oldStatus === 'IN_PROGRESS' && input.status === 'PENDING') {
            throw new Error('Cannot change status back to PENDING from IN_PROGRESS');
          }
          
          // Prevent any changes from RESOLVED
          if (oldStatus === 'RESOLVED' && (input.status === 'PENDING' || input.status === 'IN_PROGRESS')) {
            throw new Error('Cannot change status back from RESOLVED');
          }
          
          // Prevent any changes from CLOSED
          if (oldStatus === 'CLOSED') {
            throw new Error('Cannot change status from CLOSED');
          }
        }
        
        // Update the report
        const updateData = {};
        
        // Check if admin is leaving a note
        const isLeavingNote = input.adminNotes !== undefined && input.adminNotes.trim() && 
                              (!report.adminNotes || report.adminNotes !== input.adminNotes);
        
        // Auto-change PENDING to IN_PROGRESS when admin leaves a note
        if (isLeavingNote && report.status === 'PENDING') {
          updateData.status = 'IN_PROGRESS';
        } else if (input.status) {
          updateData.status = input.status;
        }
        
        if (input.adminNotes !== undefined) {
          const isNewNote = !report.adminNotes || report.adminNotes !== input.adminNotes;
          updateData.adminNotes = input.adminNotes.trim();
          // Track when and who updated the admin notes
          updateData.adminNotesUpdatedAt = new Date();
          updateData.adminNotesBy = {
            adminId: currentAdmin.id || currentAdmin._id,
            adminName: `${currentAdmin.firstName || ''} ${currentAdmin.lastName || ''}`.trim(),
            adminEmail: currentAdmin.email
          };
          
          // Send notification to other admins when notes are added/updated
          if (isNewNote && input.adminNotes && input.adminNotes.trim()) {
            try {
              const userDetails = await User.findById(report.userId);
              const reporterName = userDetails 
                ? `${userDetails.firstName} ${userDetails.lastName}` 
                : 'Unknown User';
              
              await NotificationService.sendAdminRespondedToReportNotification(
                currentAdmin._id || currentAdmin.id,
                report._id.toString(),
                'User',
                report.title,
                reporterName
              );
            } catch (notifError) {
              console.error('Error sending admin response notification:', notifError);
              // Don't fail the update if notification fails
            }
          }
        }
        
        const updatedReport = await UserReport.findByIdAndUpdate(
          id,
          updateData,
          { new: true, runValidators: true }
        ).populate('user', 'firstName lastName email');
        
        // Send notifications to user if status changed or admin notes added
        try {
          const UserNotificationService = require('../services/notifications/UserNotificationService');
          
          // Check if status changed - only send emails for IN_PROGRESS and RESOLVED
          if (input.status && input.status !== oldStatus) {
            // Only send email notifications for IN_PROGRESS and RESOLVED statuses
            if (input.status === 'IN_PROGRESS' || input.status === 'RESOLVED') {
              await UserNotificationService.sendReportStatusUpdateNotification(
                updatedReport.userId,
                updatedReport._id,
                updatedReport.title,
                oldStatus,
                input.status,
                input.adminNotes || null
              );
            } else {
              // For other statuses (PENDING, CLOSED), only create in-app notification, no email
              console.log(`📝 UserNotificationService: Status changed to ${input.status}, skipping email (only IN_PROGRESS and RESOLVED send emails)`);
            }
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
  },
  
  // Field resolvers to convert dates to ISO strings
  UserReport: {
    createdAt: (parent) => {
      return parent.createdAt ? parent.createdAt.toISOString() : null;
    },
    updatedAt: (parent) => {
      return parent.updatedAt ? parent.updatedAt.toISOString() : null;
    },
    resolvedAt: (parent) => {
      return parent.resolvedAt ? parent.resolvedAt.toISOString() : null;
    },
    adminNotesUpdatedAt: (parent) => {
      return parent.adminNotesUpdatedAt ? parent.adminNotesUpdatedAt.toISOString() : null;
    }
  }
};

module.exports = resolvers;
