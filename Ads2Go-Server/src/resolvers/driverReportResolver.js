const DriverReport = require('../models/DriverReport');
const Driver = require('../models/Driver');
const { checkDriverAuth } = require('../middleware/driverAuth');
const { checkAdmin } = require('../middleware/auth');
const NotificationService = require('../services/notifications/NotificationService');

const resolvers = {
  DriverReport: {
    id: (parent) => parent._id || parent.id,
    driver: async (parent) => {
      try {
        const driver = await Driver.findOne({ driverId: parent.driverId })
          .select('driverId firstName lastName email contactNumber vehiclePlateNumber');
        return driver;
      } catch (error) {
        console.error('Error populating driver:', error);
        return null;
      }
    }
  },
  
  Query: {
    getDriverReports: async (_, { filters = {}, limit = 50, offset = 0 }, { driver }) => {
      checkDriverAuth(driver);
      
      try {
        const reports = await DriverReport.getDriverReports(driver.driverId, filters, { limit, offset });
        const totalCount = await DriverReport.getDriverReportCount(driver.driverId, filters);
        
        return {
          success: true,
          message: 'Reports retrieved successfully',
          reports,
          totalCount
        };
      } catch (error) {
        console.error('Error fetching driver reports:', error);
        throw new Error('Failed to fetch reports');
      }
    },

    getDriverReportById: async (_, { id }, { driver }) => {
      checkDriverAuth(driver);
      
      try {
        const report = await DriverReport.findOne({ _id: id, driverId: driver.driverId });
        
        if (!report) {
          throw new Error('Report not found or access denied');
        }
        
        return report;
      } catch (error) {
        console.error('Error fetching driver report:', error);
        throw new Error('Failed to fetch report');
      }
    },

    // Admin queries
    getAllDriverReports: async (_, { filters = {}, limit = 50, offset = 0 }, { user }) => {
      checkAdmin(user);
      
      try {
        const reports = await DriverReport.getAllReports(filters, { limit, offset });
        const totalCount = await DriverReport.getAllReportsCount(filters);
        
        return {
          success: true,
          message: 'Reports retrieved successfully',
          reports,
          totalCount
        };
      } catch (error) {
        console.error('Error fetching all driver reports:', error);
        throw new Error('Failed to fetch reports');
      }
    },

    getDriverReportByIdAdmin: async (_, { id }, { user }) => {
      checkAdmin(user);
      
      try {
        const report = await DriverReport.findById(id);
        
        if (!report) {
          throw new Error('Report not found');
        }
        
        return report;
      } catch (error) {
        console.error('Error fetching driver report:', error);
        throw new Error('Failed to fetch report');
      }
    }
  },

  Mutation: {
    createDriverReport: async (_, { input }, { driver }) => {
      checkDriverAuth(driver);
      
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
        const validReportTypes = ['BUG', 'PAYMENT', 'ACCOUNT', 'VEHICLE_ISSUE', 'MATERIAL_ISSUE', 'APP_ISSUE', 'REQUEST_ACCOUNT_CLOSURE', 'UPDATE_PROFILE_DETAILS', 'OTHER'];
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
        const newReport = new DriverReport({
          driverId: driver.driverId,
          title: input.title.trim(),
          description: input.description.trim(),
          reportType: input.reportType,
          attachments: input.attachments || []
        });
        
        const savedReport = await newReport.save();
        
        // Send notification to admins about new report
        try {
          console.log(`📧 New driver report created: ${savedReport._id} by driver ${driver.driverId}`);
          
          // Find the driver details for notification
          const driverDetails = await Driver.findOne({ driverId: driver.driverId });
          if (driverDetails) {
            await NotificationService.sendNewDriverReportNotification(
              driverDetails._id,
              savedReport._id.toString(),
              savedReport.reportType,
              savedReport.title
            );
          }
        } catch (notifError) {
          console.error('Error sending notification:', notifError);
          // Don't fail the report creation if notification fails
        }
        
        return {
          success: true,
          message: 'Report submitted successfully. Our team will review it shortly.',
          report: savedReport
        };
      } catch (error) {
        console.error('Error creating driver report:', error);
        return {
          success: false,
          message: error.message || 'Failed to create report',
          report: null
        };
      }
    },

    updateDriverReport: async (_, { id, input }, { driver }) => {
      checkDriverAuth(driver);
      
      try {
        const report = await DriverReport.findOne({ _id: id, driverId: driver.driverId });
        
        if (!report) {
          throw new Error('Report not found or access denied');
        }
        
        // Only allow updates if report is still PENDING
        if (report.status !== 'PENDING') {
          throw new Error('Can only update pending reports');
        }
        
        // Update fields if provided
        if (input.title) {
          if (input.title.length > 200) {
            throw new Error('Title must be 200 characters or less');
          }
          report.title = input.title.trim();
        }
        
        if (input.description) {
          if (input.description.length > 2000) {
            throw new Error('Description must be 2000 characters or less');
          }
          report.description = input.description.trim();
        }
        
        if (input.reportType) {
          const validReportTypes = ['BUG', 'PAYMENT', 'ACCOUNT', 'VEHICLE_ISSUE', 'MATERIAL_ISSUE', 'APP_ISSUE', 'OTHER'];
          if (!validReportTypes.includes(input.reportType)) {
            throw new Error('Invalid report type');
          }
          report.reportType = input.reportType;
        }
        
        if (input.attachments) {
          const urlRegex = /^https?:\/\/.+/;
          for (const attachment of input.attachments) {
            if (!urlRegex.test(attachment)) {
              throw new Error('All attachments must be valid URLs');
            }
          }
          report.attachments = input.attachments;
        }
        
        const updatedReport = await report.save();
        
        return {
          success: true,
          message: 'Report updated successfully',
          report: updatedReport
        };
      } catch (error) {
        console.error('Error updating driver report:', error);
        return {
          success: false,
          message: error.message || 'Failed to update report',
          report: null
        };
      }
    },

    deleteDriverReport: async (_, { id }, { driver }) => {
      checkDriverAuth(driver);
      
      try {
        const report = await DriverReport.findOne({ _id: id, driverId: driver.driverId });
        
        if (!report) {
          throw new Error('Report not found or access denied');
        }

        // Check if already archived
        if (report.isArchived) {
          throw new Error('Report is already archived');
        }
        
        // Only allow deletion if report is still PENDING
        if (report.status !== 'PENDING') {
          throw new Error('Can only delete pending reports');
        }

        console.log(`🗑️ Archiving driver report: ${id} - 30-day deferred deletion`);

        // Soft delete: Mark as archived with 30-day deletion schedule
        const now = new Date();
        const deletionDate = new Date(now);
        deletionDate.setDate(deletionDate.getDate() + 30); // 30 days from now

        report.isArchived = true;
        report.archivedAt = now;
        report.scheduledDeletionDate = deletionDate;

        await report.save();

        console.log(`✅ Driver report ${id} archived successfully. Scheduled for permanent deletion on: ${deletionDate.toISOString()}`);
        
        return {
          success: true,
          message: 'Report archived successfully. Scheduled for deletion in 30 days.',
          report: null
        };
      } catch (error) {
        console.error('Error archiving driver report:', error);
        return {
          success: false,
          message: error.message || 'Failed to archive report',
          report: null
        };
      }
    },

    restoreDriverReport: async (_, { id }, { driver }) => {
      checkDriverAuth(driver);
      
      try {
        const report = await DriverReport.findOne({ _id: id, driverId: driver.driverId });
        
        if (!report) {
          throw new Error('Report not found or access denied');
        }

        if (!report.isArchived) {
          throw new Error('Report is not archived');
        }

        console.log(`✅ Restoring driver report: ${id}`);

        report.isArchived = false;
        report.archivedAt = null;
        report.scheduledDeletionDate = null;

        await report.save();

        console.log(`✅ Driver report ${id} restored successfully`);
        
        return {
          success: true,
          message: 'Report restored successfully.',
          report
        };
      } catch (error) {
        console.error('Error restoring driver report:', error);
        return {
          success: false,
          message: error.message || 'Failed to restore report',
          report: null
        };
      }
    },

    deleteDriverReportAdmin: async (_, { id }, { admin, superAdmin }) => {
      checkAdmin(admin || superAdmin);
      
      try {
        const report = await DriverReport.findById(id);
        
        if (!report) {
          throw new Error('Report not found');
        }

        // Check if already archived
        if (report.isArchived) {
          throw new Error('Report is already archived');
        }

        console.log(`🗑️ Admin archiving driver report: ${id} - 30-day deferred deletion`);

        // Soft delete: Mark as archived with 30-day deletion schedule
        const now = new Date();
        const deletionDate = new Date(now);
        deletionDate.setDate(deletionDate.getDate() + 30); // 30 days from now

        report.isArchived = true;
        report.archivedAt = now;
        report.scheduledDeletionDate = deletionDate;

        await report.save();

        console.log(`✅ Driver report ${id} archived successfully by admin. Scheduled for permanent deletion on: ${deletionDate.toISOString()}`);
        
        return {
          success: true,
          message: 'Report archived successfully. Scheduled for deletion in 30 days.',
          report: null
        };
      } catch (error) {
        console.error('Error archiving driver report:', error);
        throw new Error(error.message || 'Failed to archive report');
      }
    },

    updateDriverReportAdmin: async (_, { id, input }, { user, admin, superAdmin }) => {
      checkAdmin(user || admin || superAdmin);
      
      try {
        const report = await DriverReport.findById(id);
        
        if (!report) {
          throw new Error('Report not found');
        }
        
        // Get current admin info
        const currentAdmin = user || admin || superAdmin;
        
        // Store old status for comparison
        const oldStatus = report.status;
        
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
        
        // Check if admin is leaving a note
        const isLeavingNote = input.adminNotes !== undefined && input.adminNotes.trim() && 
                              (!report.adminNotes || report.adminNotes !== input.adminNotes);
        
        // Auto-change PENDING to IN_PROGRESS when admin leaves a note
        if (isLeavingNote && report.status === 'PENDING') {
          report.status = 'IN_PROGRESS';
        } else if (input.status) {
          report.status = input.status;
          
          // Set resolvedAt if status is RESOLVED or CLOSED
          if (input.status === 'RESOLVED' || input.status === 'CLOSED') {
            report.resolvedAt = new Date();
          }
        }
        
        // Update admin notes if provided
        if (input.adminNotes !== undefined) {
          const isNewNote = !report.adminNotes || report.adminNotes !== input.adminNotes;
          report.adminNotes = input.adminNotes;
          // Track when and who updated the admin notes
          report.adminNotesUpdatedAt = new Date();
          report.adminNotesBy = {
            adminId: currentAdmin.id || currentAdmin._id,
            adminName: `${currentAdmin.firstName || ''} ${currentAdmin.lastName || ''}`.trim(),
            adminEmail: currentAdmin.email
          };
          
          // Send notification to other admins when notes are added/updated
          if (isNewNote && input.adminNotes && input.adminNotes.trim()) {
            try {
              const driverDetails = await Driver.findOne({ driverId: report.driverId });
              const reporterName = driverDetails 
                ? `${driverDetails.firstName} ${driverDetails.lastName}` 
                : 'Unknown Driver';
              
              await NotificationService.sendAdminRespondedToReportNotification(
                currentAdmin._id || currentAdmin.id,
                report._id.toString(),
                'Driver',
                report.title,
                reporterName
              );
            } catch (notifError) {
              console.error('Error sending admin response notification:', notifError);
              // Don't fail the update if notification fails
            }
          }
        }
        
        const updatedReport = await report.save();
        
        // Send notification to driver about report status update
        try {
          const driverDetails = await Driver.findOne({ driverId: report.driverId });
          if (driverDetails) {
            const adminName = `${currentAdmin.firstName || ''} ${currentAdmin.lastName || ''}`.trim();
            await NotificationService.sendReportStatusUpdateNotification(
              driverDetails._id,
              report._id.toString(),
              report.title,
              report.status,
              input.adminNotes || null,
              adminName
            );
            console.log(`📧 [DriverReportResolver] Sent status update notification to driver ${driverDetails.driverId}`);
          }
        } catch (notifError) {
          console.error('Error sending driver report status notification:', notifError);
          // Don't fail the update if notification fails
        }
        
        return {
          success: true,
          message: 'Report updated successfully',
          report: updatedReport
        };
      } catch (error) {
        console.error('Error updating driver report (admin):', error);
        return {
          success: false,
          message: error.message || 'Failed to update report',
          report: null
        };
      }
    }
  },

  DriverReport: {
    driver: async (parent) => {
      try {
        return await Driver.findOne({ driverId: parent.driverId });
      } catch (error) {
        console.error('Error fetching driver for report:', error);
        return null;
      }
    },
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

