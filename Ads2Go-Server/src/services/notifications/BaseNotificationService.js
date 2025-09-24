const UserNotifications = require('../../models/Notification');
const EmailService = require('../../utils/emailService');

class BaseNotificationService {
  /**
   * Create a notification for a user
   */
  static async createNotification(userId, title, message, type = 'INFO', options = {}) {
    try {
      // Find or create user notifications document
      let userNotifications = await UserNotifications.findOne({ userId });
      
      if (!userNotifications) {
        // Create new user notifications document
        userNotifications = new UserNotifications({
          userId,
          userRole: options.userRole || 'USER', // Default to USER if not specified
          notifications: [],
          unreadCount: 0,
          notificationPreferences: {
            email: true,
            inApp: true,
            categories: []
          }
        });
      }

      // Create new notification item
      const notificationItem = {
        title,
        message,
        type,
        category: options.category || 'SYSTEM_ALERT', // Default category
        priority: options.priority || 'MEDIUM', // Default priority
        read: false,
        readAt: null,
        adId: options.adId ? options.adId.toString() : null, // Convert ObjectId to string
        adTitle: options.adTitle || null,
        data: options.data || {}
      };

      // Add notification to the array
      userNotifications.notifications.unshift(notificationItem); // Add to beginning
      userNotifications.unreadCount += 1;

      // Keep only last 50 notifications to prevent document from growing too large
      if (userNotifications.notifications.length > 50) {
        userNotifications.notifications = userNotifications.notifications.slice(0, 50);
      }

      await userNotifications.save();
      console.log(`✅ Notification created for user ${userId} (${userNotifications.userRole}): ${title}`);
      console.log('🔔 BaseNotificationService: Created notification:', notificationItem);
      
      // Return the notification with its ID
      const savedNotification = userNotifications.notifications[0]; // First notification (newest)
      return {
        ...notificationItem,
        _id: savedNotification._id,
        id: savedNotification._id.toString()
      };
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Get user's notification statistics
   */
  static async getUserNotificationStats(userId) {
    try {
      const userNotifications = await UserNotifications.findOne({ userId });
      if (!userNotifications) {
        return { total: 0, unread: 0, read: 0 };
      }

      const total = userNotifications.notifications.length;
      const unread = userNotifications.unreadCount;
      const read = total - unread;

      return {
        total,
        unread,
        read
      };
    } catch (error) {
      console.error('Error getting notification stats:', error);
      throw error;
    }
  }

  /**
   * Delete a specific notification
   */
  static async deleteNotification(userId, notificationId) {
    try {
      const userNotifications = await UserNotifications.findOne({ userId });
      if (!userNotifications) {
        throw new Error('User notifications not found');
      }

      // Find the notification to delete
      console.log('🔍 Looking for notification ID:', notificationId);
      console.log('🔍 Available notification IDs:', userNotifications.notifications.map(n => n._id.toString()));
      
      const notificationIndex = userNotifications.notifications.findIndex(
        notification => notification._id.toString() === notificationId.toString()
      );

      if (notificationIndex === -1) {
        console.error('❌ Notification not found. Available IDs:', userNotifications.notifications.map(n => n._id.toString()));
        throw new Error('Notification not found');
      }

      const notification = userNotifications.notifications[notificationIndex];
      
      // Remove the notification from the array
      userNotifications.notifications.splice(notificationIndex, 1);
      
      // Update unread count if the notification was unread
      if (!notification.read) {
        userNotifications.unreadCount = Math.max(0, userNotifications.unreadCount - 1);
      }

      await userNotifications.save();
      
      console.log(`✅ Notification deleted for user ${userId}: ${notification.title}`);
      return { success: true, message: 'Notification deleted successfully' };
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  /**
   * Delete all notifications for a user
   */
  static async deleteAllNotifications(userId) {
    try {
      const userNotifications = await UserNotifications.findOne({ userId });
      if (!userNotifications) {
        throw new Error('User notifications not found');
      }

      // Clear all notifications
      userNotifications.notifications = [];
      userNotifications.unreadCount = 0;

      await userNotifications.save();
      
      console.log(`✅ All notifications deleted for user ${userId}`);
      return { success: true, message: 'All notifications deleted successfully' };
    } catch (error) {
      console.error('Error deleting all notifications:', error);
      throw error;
    }
  }

  /**
   * Delete notifications by category
   */
  static async deleteNotificationsByCategory(userId, category) {
    try {
      const userNotifications = await UserNotifications.findOne({ userId });
      if (!userNotifications) {
        throw new Error('User notifications not found');
      }

      // Filter out notifications with the specified category
      const originalLength = userNotifications.notifications.length;
      userNotifications.notifications = userNotifications.notifications.filter(
        notification => notification.category !== category
      );

      // Update unread count
      const deletedCount = originalLength - userNotifications.notifications.length;
      userNotifications.unreadCount = Math.max(0, userNotifications.unreadCount - deletedCount);

      await userNotifications.save();
      
      console.log(`✅ ${deletedCount} notifications deleted for user ${userId} (category: ${category})`);
      return { success: true, message: `${deletedCount} notifications deleted successfully` };
    } catch (error) {
      console.error('Error deleting notifications by category:', error);
      throw error;
    }
  }

  /**
   * Auto-delete notifications older than 30 days
   */
  static async autoDeleteOldNotifications() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      console.log(`🧹 Auto-deleting notifications older than ${thirtyDaysAgo.toISOString()}`);

      // Find all user notifications
      const allUserNotifications = await UserNotifications.find({});
      let totalDeleted = 0;

      for (const userNotifications of allUserNotifications) {
        const originalLength = userNotifications.notifications.length;
        
        // Filter out notifications older than 30 days
        userNotifications.notifications = userNotifications.notifications.filter(
          notification => new Date(notification.createdAt) > thirtyDaysAgo
        );

        const deletedCount = originalLength - userNotifications.notifications.length;
        if (deletedCount > 0) {
          // Update unread count
          userNotifications.unreadCount = Math.max(0, userNotifications.unreadCount - deletedCount);
          await userNotifications.save();
          totalDeleted += deletedCount;
          console.log(`✅ Deleted ${deletedCount} old notifications for user ${userNotifications.userId}`);
        }
      }

      console.log(`🧹 Auto-deletion completed: ${totalDeleted} notifications deleted`);
      return { success: true, message: `${totalDeleted} old notifications deleted` };
    } catch (error) {
      console.error('Error auto-deleting old notifications:', error);
      throw error;
    }
  }

  /**
   * Get notifications with pagination and filtering
   */
  static async getNotifications(userId, options = {}) {
    try {
      const userNotifications = await UserNotifications.findOne({ userId });
      if (!userNotifications) {
        return { notifications: [], total: 0, unread: 0 };
      }

      let notifications = userNotifications.notifications;

      // Filter by category if specified
      if (options.category) {
        notifications = notifications.filter(n => n.category === options.category);
      }

      // Filter by read status if specified
      if (options.read !== undefined) {
        notifications = notifications.filter(n => n.read === options.read);
      }

      // Filter by priority if specified
      if (options.priority) {
        notifications = notifications.filter(n => n.priority === options.priority);
      }

      // Sort by creation date (newest first)
      notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Pagination
      const page = options.page || 1;
      const limit = options.limit || 20;
      const skip = (page - 1) * limit;

      const paginatedNotifications = notifications.slice(skip, skip + limit);

      return {
        notifications: paginatedNotifications,
        total: notifications.length,
        unread: userNotifications.unreadCount,
        page,
        limit,
        totalPages: Math.ceil(notifications.length / limit)
      };
    } catch (error) {
      console.error('Error getting notifications:', error);
      throw error;
    }
  }
}

module.exports = BaseNotificationService;
