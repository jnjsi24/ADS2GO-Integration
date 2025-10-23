const DriverReport = require('../models/DriverReport');
const Driver = require('../models/Driver');
const { checkDriverAuth } = require('../middleware/driverAuth');
const { checkAdmin } = require('../middleware/auth');

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
        const validReportTypes = ['BUG', 'PAYMENT', 'ACCOUNT', 'VEHICLE_ISSUE', 'MATERIAL_ISSUE', 'APP_ISSUE', 'OTHER'];
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
          // TODO: Send email notification to admins
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
        
        // Only allow deletion if report is still PENDING
        if (report.status !== 'PENDING') {
          throw new Error('Can only delete pending reports');
        }
        
        await report.deleteOne();
        
        return {
          success: true,
          message: 'Report deleted successfully',
          report: null
        };
      } catch (error) {
        console.error('Error deleting driver report:', error);
        return {
          success: false,
          message: error.message || 'Failed to delete report',
          report: null
        };
      }
    },

    updateDriverReportAdmin: async (_, { id, input }, { user }) => {
      checkAdmin(user);
      
      try {
        const report = await DriverReport.findById(id);
        
        if (!report) {
          throw new Error('Report not found');
        }
        
        // Update status if provided
        if (input.status) {
          report.status = input.status;
          
          // Set resolvedAt if status is RESOLVED or CLOSED
          if (input.status === 'RESOLVED' || input.status === 'CLOSED') {
            report.resolvedAt = new Date();
          }
        }
        
        // Update admin notes if provided
        if (input.adminNotes !== undefined) {
          report.adminNotes = input.adminNotes;
        }
        
        const updatedReport = await report.save();
        
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
    }
  }
};

module.exports = resolvers;

