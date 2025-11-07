const UserNotifications = require('../../models/Notification');
const EmailService = require('../../utils/emailService');
const mongoose = require('mongoose');

class BaseNotificationService {
  /**
   * Create a notification for a user
   * Uses atomic MongoDB operations to prevent version conflicts during concurrent updates
   */
  static async createNotification(userId, title, message, type = 'INFO', options = {}) {
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        // Create new notification item
        // Convert adId to ObjectId if it's a string (Mongoose will handle the conversion)
        let adIdValue = null;
        if (options.adId) {
          if (typeof options.adId === 'string' && mongoose.Types.ObjectId.isValid(options.adId)) {
            adIdValue = new mongoose.Types.ObjectId(options.adId);
          } else if (options.adId instanceof mongoose.Types.ObjectId) {
            adIdValue = options.adId;
          } else if (typeof options.adId.toString === 'function') {
            // Fallback for other ObjectId-like objects
            adIdValue = new mongoose.Types.ObjectId(options.adId.toString());
          }
        }

        const notificationItem = {
          title,
          message,
          type,
          category: options.category || 'SYSTEM_ALERT', // Default category
          priority: options.priority || 'MEDIUM', // Default priority
          read: false,
          readAt: null,
          adId: adIdValue,
          adTitle: options.adTitle || null,
          data: options.data || {}
        };

        // Use atomic update operations to avoid version conflicts
        // IMPORTANT: Use native MongoDB collection methods to bypass Mongoose version checking
        // This prevents VersionError when multiple notifications are created simultaneously
        // Mongoose's findOneAndUpdate checks __v (version), but native findOneAndUpdate does not
        const collection = UserNotifications.collection;
        
        // Ensure userId is an ObjectId
        const userIdObj = mongoose.Types.ObjectId.isValid(userId) 
          ? new mongoose.Types.ObjectId(userId) 
          : userId;
        
        // Ensure notification item has an _id (MongoDB will add it automatically, but we can pre-generate for consistency)
        if (!notificationItem._id) {
          notificationItem._id = new mongoose.Types.ObjectId();
        }
        
        const updateResult = await collection.findOneAndUpdate(
          { userId: userIdObj },
          {
            $push: {
              notifications: {
                $each: [notificationItem],
                $position: 0  // Add to beginning (most recent first)
              }
            },
            $inc: { unreadCount: 1 },
            $setOnInsert: {
              userId: userIdObj,
              userRole: options.userRole || 'USER',
              notificationPreferences: {
                email: true,
                inApp: true,
                categories: []
              },
              createdAt: new Date(),
              updatedAt: new Date()
            },
            $set: {
              updatedAt: new Date()
            }
          },
          {
            upsert: true,  // Create document if it doesn't exist
            returnDocument: 'after'  // Return updated document (equivalent to new: true)
          }
        );

        // Native MongoDB findOneAndUpdate returns { value: <document>, ... }
        const updatedDocument = updateResult.value;
        
        if (!updatedDocument) {
          throw new Error('Failed to create notification: updateResult.value is null');
        }
        
        // Trim to last 50 notifications if needed (best-effort, non-blocking)
        // Use atomic $slice operation to keep only first 50 items
        if (updatedDocument && updatedDocument.notifications && updatedDocument.notifications.length > 50) {
          try {
            await collection.findOneAndUpdate(
              { userId: userIdObj },
              {
                $push: {
                  notifications: {
                    $each: [],
                    $slice: 50  // Keep only first 50 items (atomic operation)
                  }
                }
              }
            );
          } catch (trimError) {
            // Non-critical: if trimming fails, we just have more than 50 notifications
            // This won't cause issues and will be trimmed on next update or by cleanup job
            console.warn(`⚠️ Could not trim notifications for user ${userId} (non-critical):`, trimError.message);
          }
        }

        // Get the newly created notification from the update result
        // The first notification in the array is the newest one (added at position 0)
        const savedNotification = updatedDocument && updatedDocument.notifications && updatedDocument.notifications[0]
          ? updatedDocument.notifications[0]
          : notificationItem;

        // Generate an ID for the notification if it doesn't have one (newly created notifications from MongoDB should have _id)
        const notificationId = savedNotification._id || savedNotification.id || new mongoose.Types.ObjectId();

        console.log(`✅ Notification created for user ${userId} (${updatedDocument?.userRole || options.userRole || 'USER'}): ${title}`);
        console.log('🔔 BaseNotificationService: Created notification:', notificationItem);

        return {
          ...notificationItem,
          _id: notificationId,
          id: notificationId.toString()
        };
      } catch (error) {
        // Check if it's a version conflict error
        if (error.name === 'VersionError' && retryCount < maxRetries - 1) {
          retryCount++;
          // Exponential backoff: wait 50ms, 100ms, 200ms
          const delay = Math.pow(2, retryCount - 1) * 50;
          console.warn(`⚠️ Version conflict on notification creation, retrying (${retryCount}/${maxRetries}) after ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // If not a version error or max retries reached, throw the error
        console.error('Error creating notification:', error);
        throw error;
      }
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
