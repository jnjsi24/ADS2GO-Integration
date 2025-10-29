const ContactMessage = require('../models/ContactMessage');
const User = require('../models/User');
const EmailService = require('../utils/emailService');

const contactMessageResolvers = {
  Query: {
    // Get all contact messages (admin only)
    getAllContactMessages: async (_, { filters = {}, limit = 50, offset = 0 }, context) => {
      try {
        // TODO: Add admin authentication check here
        // if (!context.admin) {
        //   throw new Error('Unauthorized: Admin access required');
        // }

        const query = {};
        
        if (filters.status) {
          query.status = filters.status;
        }
        
        if (filters.email) {
          query.email = new RegExp(filters.email, 'i');
        }
        
        if (filters.name) {
          query.name = new RegExp(filters.name, 'i');
        }

        const contactMessages = await ContactMessage.find(query)
          .sort({ createdAt: -1 })
          .limit(limit)
          .skip(offset);

        const totalCount = await ContactMessage.countDocuments(query);
        const statusCounts = await ContactMessage.getStatusCounts();

        return {
          success: true,
          contactMessages,
          totalCount,
          statusCounts: {
            pending: statusCounts.pending || 0,
            inProgress: statusCounts.inProgress || 0,
            resolved: statusCounts.resolved || 0,
            total: statusCounts.total || 0
          }
        };
      } catch (error) {
        console.error('❌ Error getting contact messages:', error);
        return {
          success: false,
          message: error.message || 'Failed to fetch contact messages',
          contactMessages: [],
          totalCount: 0,
          statusCounts: { pending: 0, inProgress: 0, resolved: 0, total: 0 }
        };
      }
    },

    // Get contact message by ID (admin only)
    getContactMessageById: async (_, { id }, context) => {
      try {
        // TODO: Add admin authentication check here

        const contactMessage = await ContactMessage.findById(id);
        
        if (!contactMessage) {
          return {
            success: false,
            message: 'Contact message not found'
          };
        }

        return {
          success: true,
          message: 'Contact message retrieved successfully',
          contactMessage
        };
      } catch (error) {
        console.error('❌ Error getting contact message:', error);
        return {
          success: false,
          message: error.message || 'Failed to fetch contact message'
        };
      }
    }
  },

  Mutation: {
    // Update contact message status (admin only)
    updateContactMessage: async (_, { id, input }, context) => {
      try {
        // TODO: Add admin authentication check here
        const adminId = context.admin?.id || 'admin';
        const adminName = context.admin?.firstName || 'Admin';
        const adminEmail = context.admin?.email || 'admin@ads2go.com';

        const contactMessage = await ContactMessage.findById(id);
        
        if (!contactMessage) {
          return {
            success: false,
            message: 'Contact message not found'
          };
        }

        // Update status
        if (input.status) {
          contactMessage.status = input.status;
          
          // If marking as RESOLVED, set resolvedAt and resolvedBy
          if (input.status === 'RESOLVED' && !contactMessage.resolvedAt) {
            contactMessage.resolvedAt = new Date();
            contactMessage.resolvedBy = {
              adminId,
              adminName,
              adminEmail
            };
          }
        }

        await contactMessage.save();

        return {
          success: true,
          message: 'Contact message updated successfully',
          contactMessage
        };
      } catch (error) {
        console.error('❌ Error updating contact message:', error);
        return {
          success: false,
          message: error.message || 'Failed to update contact message'
        };
      }
    },

    // Send reply to contact message (admin only)
    sendContactReply: async (_, { input }, context) => {
      try {
        // TODO: Add admin authentication check here
        const adminId = context.admin?.id || 'admin';
        const adminName = context.admin?.firstName || 'Admin';
        const adminEmail = context.admin?.email || 'admin@ads2go.com';

        const { contactMessageId, subject, message } = input;

        const contactMessage = await ContactMessage.findById(contactMessageId);
        
        if (!contactMessage) {
          return {
            success: false,
            message: 'Contact message not found'
          };
        }

        // Check if already replied
        if (contactMessage.adminReply) {
          return {
            success: false,
            message: 'A reply has already been sent to this message'
          };
        }

        // Send email via EmailService
        const emailSent = await EmailService.sendContactReply(
          contactMessage.email,
          contactMessage.name,
          subject,
          message,
          adminName
        );

        if (!emailSent) {
          return {
            success: false,
            message: 'Failed to send email. Please check email service configuration.'
          };
        }

        // Save reply to database
        contactMessage.adminReply = {
          subject,
          message,
          sentBy: {
            adminId,
            adminName,
            adminEmail
          },
          sentAt: new Date()
        };

        // Automatically change status to IN_PROGRESS
        contactMessage.status = 'IN_PROGRESS';

        await contactMessage.save();

        console.log(`✅ Reply sent to ${contactMessage.email} by ${adminName}`);

        return {
          success: true,
          message: 'Reply sent successfully',
          contactMessage
        };
      } catch (error) {
        console.error('❌ Error sending contact reply:', error);
        return {
          success: false,
          message: error.message || 'Failed to send reply'
        };
      }
    }
  }
};

module.exports = contactMessageResolvers;

