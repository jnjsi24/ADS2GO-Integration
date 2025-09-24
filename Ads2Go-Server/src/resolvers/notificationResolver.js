const UserNotifications = require('../models/Notification');
const User = require('../models/User');
const Ad = require('../models/Ad');
const { checkAuth } = require('../middleware/auth');

const notificationResolvers = {
  Query: {
    getUserNotifications: async (_, __, { user }) => {
      checkAuth(user);
      
      try {
        console.log('🔔 Backend: Fetching notifications for user:', user.id);
        const userNotifications = await UserNotifications.findOne({ userId: user.id });
        
        if (!userNotifications) {
          console.log('🔔 Backend: No notifications found for user');
          return [];
        }
        
        // Return notifications array sorted by creation date (newest first)
        const notifications = userNotifications.notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        console.log('🔔 Backend: Found notifications:', notifications.length);
        console.log('🔔 Backend: Notifications data:', notifications);
        return notifications;
      } catch (error) {
        console.error('Error fetching user notifications:', error);
        throw new Error('Failed to fetch notifications');
      }
    },

    getNotificationById: async (_, { id }, { user }) => {
      checkAuth(user);
      
      try {
        const notification = await Notification.findOne({ 
          _id: id, 
          userId: user.id 
        });
        
        if (!notification) {
          throw new Error('Notification not found');
        }
        
        return notification;
      } catch (error) {
        console.error('Error fetching notification:', error);
        throw new Error('Failed to fetch notification');
      }
    },

    getUnreadNotificationCount: async (_, __, { user }) => {
      checkAuth(user);
      
      try {
        const userNotifications = await UserNotifications.findOne({ userId: user.id });
        
        if (!userNotifications) {
          return 0;
        }
        
        return userNotifications.unreadCount;
      } catch (error) {
        console.error('Error fetching unread count:', error);
        throw new Error('Failed to fetch unread count');
      }
    }
  },

  Mutation: {
    createNotification: async (_, { input }, { user }) => {
      checkAuth(user);
      
      try {
        // Verify user exists
        const targetUser = await User.findById(input.userId);
        if (!targetUser) {
          throw new Error('User not found');
        }

        // If adId is provided, verify ad exists and get title
        let adTitle = input.adTitle;
        if (input.adId) {
          const ad = await Ad.findById(input.adId);
          if (ad) {
            adTitle = ad.title;
          }
        }

        const notification = new Notification({
          userId: input.userId,
          title: input.title,
          message: input.message,
          type: input.type,
          adId: input.adId,
          adTitle: adTitle || input.adTitle
        });

        await notification.save();
        
        return notification;
      } catch (error) {
        console.error('Error creating notification:', error);
        throw new Error('Failed to create notification');
      }
    },

    updateNotification: async (_, { id, input }, { user }) => {
      checkAuth(user);
      
      try {
        const notification = await Notification.findOneAndUpdate(
          { _id: id, userId: user.id },
          input,
          { new: true }
        );
        
        if (!notification) {
          throw new Error('Notification not found');
        }
        
        return notification;
      } catch (error) {
        console.error('Error updating notification:', error);
        throw new Error('Failed to update notification');
      }
    },

    markNotificationAsRead: async (_, { id }, { user }) => {
      checkAuth(user);
      
      try {
        const userNotifications = await UserNotifications.findOne({ userId: user.id });
        
        if (!userNotifications) {
          throw new Error('User notifications not found');
        }
        
        // Find the notification in the array
        const notification = userNotifications.notifications.find(n => n._id.toString() === id);
        
        if (!notification) {
          throw new Error('Notification not found');
        }
        
        // Mark as read
        notification.read = true;
        notification.readAt = new Date();
        
        // Update unread count
        userNotifications.unreadCount = Math.max(0, userNotifications.unreadCount - 1);
        
        await userNotifications.save();
        
        return notification;
      } catch (error) {
        console.error('Error marking notification as read:', error);
        throw new Error('Failed to mark notification as read');
      }
    },

    markAllNotificationsAsRead: async (_, __, { user }) => {
      checkAuth(user);
      
      try {
        const userNotifications = await UserNotifications.findOne({ userId: user.id });
        
        if (!userNotifications) {
          return {
            success: true,
            message: 'No notifications to mark as read'
          };
        }
        
        // Mark all notifications as read
        userNotifications.notifications.forEach(notification => {
          if (!notification.read) {
            notification.read = true;
            notification.readAt = new Date();
          }
        });
        
        // Reset unread count
        userNotifications.unreadCount = 0;
        
        await userNotifications.save();
        
        return {
          success: true,
          message: 'All notifications marked as read'
        };
      } catch (error) {
        console.error('Error marking all notifications as read:', error);
        throw new Error('Failed to mark all notifications as read');
      }
    },

    deleteNotification: async (_, { id }, { user }) => {
      checkAuth(user);
      
      try {
        const notification = await Notification.findOneAndDelete({
          _id: id,
          userId: user.id
        });
        
        if (!notification) {
          throw new Error('Notification not found');
        }
        
        return {
          success: true,
          message: 'Notification deleted successfully'
        };
      } catch (error) {
        console.error('Error deleting notification:', error);
        throw new Error('Failed to delete notification');
      }
    }
  },

  // Subscription: {
  //   notificationReceived: {
  //     subscribe: (_, __, { user }) => {
  //       checkAuth(user);
  //       
  //       return pubsub.asyncIterator('NOTIFICATION_CREATED');
  //     }
  //   }
  // },

  Notification: {
    userId: async (notification) => {
      return await User.findById(notification.userId);
    }
  }
};

module.exports = notificationResolvers;
