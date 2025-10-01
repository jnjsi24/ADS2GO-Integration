const UserNotifications = require('../models/Notification');
const User = require('../models/User');
const Ad = require('../models/Ad');
const Material = require('../models/Material');
const Driver = require('../models/Driver');
const Admin = require('../models/Admin');
const AdsPlan = require('../models/AdsPlan');
const Payment = require('../models/Payment');
const { checkAuth } = require('../middleware/auth');
const NotificationService = require('../services/notifications/NotificationService');

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
    },

    // Admin-specific queries
    getAdminNotifications: async (_, __, { user }) => {
      checkAuth(user);
      
      try {
        console.log('🔔 Backend: Fetching admin notifications for user:', user.id);
        const userNotifications = await UserNotifications.findOne({ userId: user.id });
        
        if (!userNotifications) {
          console.log('🔔 Backend: No notifications found for admin');
          return {
            notifications: [],
            unreadCount: 0
          };
        }
        
        // Return notifications array sorted by creation date (newest first)
        const notifications = userNotifications.notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        console.log('🔔 Backend: Found admin notifications:', notifications.length);
        return {
          notifications,
          unreadCount: userNotifications.unreadCount
        };
      } catch (error) {
        console.error('Error fetching admin notifications:', error);
        throw new Error('Failed to fetch admin notifications');
      }
    },

    getPendingAds: async (_, __, { user }) => {
      checkAuth(user);
      
      try {
        console.log('🔔 Backend: Fetching pending ads for user:', user.id);
        const pendingAds = await Ad.find({ status: 'PENDING' })
          .populate('userId', 'firstName lastName')
          .sort({ createdAt: -1 });
        
        console.log('🔔 Backend: Found pending ads:', pendingAds.length);
        console.log('🔔 Backend: Pending ads details:', pendingAds.map(ad => ({
          id: ad._id,
          title: ad.title,
          status: ad.status,
          userId: ad.userId
        })));
        return pendingAds;
      } catch (error) {
        console.error('Error fetching pending ads:', error);
        throw new Error('Failed to fetch pending ads');
      }
    },

    getPendingMaterials: async (_, __, { user }) => {
      checkAuth(user);
      
      try {
        console.log('🔔 Backend: Fetching pending materials');
        // Find materials that are created but not yet assigned to any plan
        const pendingMaterials = await Material.find({ 
          status: 'PENDING' 
        })
          .populate('driverId', 'firstName lastName')
          .sort({ createdAt: -1 });
        
        console.log('🔔 Backend: Found pending materials:', pendingMaterials.length);
        return pendingMaterials;
      } catch (error) {
        console.error('Error fetching pending materials:', error);
        throw new Error('Failed to fetch pending materials');
      }
    },

    getAdminDashboardStats: async (_, __, { user }) => {
      checkAuth(user);
      
      try {
        console.log('🔔 Backend: Fetching admin dashboard stats');
        
        const [
          totalAds,
          pendingAds,
          activeAds,
          totalUsers,
          newUsersToday,
          totalDrivers,
          newDriversToday,
          pendingDrivers,
          userNotifications
        ] = await Promise.all([
          Ad.countDocuments(),
          Ad.countDocuments({ status: 'PENDING' }),
          Ad.countDocuments({ status: 'APPROVED', adStatus: 'ACTIVE' }),
          User.countDocuments(),
          User.countDocuments({ 
            createdAt: { 
              $gte: new Date(new Date().setHours(0, 0, 0, 0)) 
            } 
          }),
          Driver.countDocuments(),
          Driver.countDocuments({ 
            createdAt: { 
              $gte: new Date(new Date().setHours(0, 0, 0, 0)) 
            } 
          }),
          Driver.countDocuments({ accountStatus: 'PENDING', reviewStatus: 'PENDING' }),
          UserNotifications.findOne({ userId: user.id })
        ]);

        const unreadNotifications = userNotifications ? userNotifications.unreadCount : 0;
        const highPriorityNotifications = userNotifications ? 
          userNotifications.notifications.filter(n => n.priority === 'HIGH' && !n.read).length : 0;

        // Calculate revenue (this would need to be implemented based on your payment system)
        const totalRevenue = 0; // Placeholder
        const revenueToday = 0; // Placeholder

        const stats = {
          totalAds,
          pendingAds,
          activeAds,
          totalUsers,
          newUsersToday,
          totalDrivers,
          newDriversToday,
          pendingDrivers,
          totalRevenue,
          revenueToday,
          unreadNotifications,
          highPriorityNotifications
        };

        console.log('🔔 Backend: Admin dashboard stats:', stats);
        console.log('🔔 Backend: Pending ads count in stats:', pendingAds);
        return stats;
      } catch (error) {
        console.error('Error fetching admin dashboard stats:', error);
        throw new Error('Failed to fetch admin dashboard stats');
      }
    },

    getSuperAdminNotifications: async (_, __, { user }) => {
      checkAuth(user);
      
      try {
        console.log('🔔 Backend: Fetching super admin notifications for user:', user.id);
        
        // Check if user is super admin
        if (user.role !== 'SUPERADMIN') {
          throw new Error('Unauthorized: Super admin access required');
        }

        const userNotifications = await UserNotifications.findOne({ userId: user.id });
        
        if (!userNotifications) {
          console.log('🔔 Backend: No notifications found for super admin');
          return {
            notifications: [],
            unreadCount: 0
          };
        }
        
        // Return notifications array sorted by creation date (newest first)
        const notifications = userNotifications.notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        console.log('🔔 Backend: Found super admin notifications:', notifications.length);
        return {
          notifications,
          unreadCount: userNotifications.unreadCount
        };
      } catch (error) {
        console.error('Error fetching super admin notifications:', error);
        throw new Error('Failed to fetch super admin notifications');
      }
    },

    getSuperAdminDashboardStats: async (_, __, { user }) => {
      checkAuth(user);
      
      try {
        console.log('🔔 Backend: Fetching super admin dashboard stats');
        
        // Check if user is super admin
        if (user.role !== 'SUPERADMIN') {
          throw new Error('Unauthorized: Super admin access required');
        }

        const [
          totalUsers,
          totalAdmins,
          totalDrivers,
          totalAds,
          totalPlans,
          userNotifications
        ] = await Promise.all([
          User.countDocuments(),
          Admin.countDocuments(),
          Driver.countDocuments(),
          Ad.countDocuments(),
          AdsPlan.countDocuments(),
          UserNotifications.findOne({ userId: user.id })
        ]);

        const unreadNotifications = userNotifications ? userNotifications.unreadCount : 0;
        const highPriorityNotifications = userNotifications ? 
          userNotifications.notifications.filter(n => n.priority === 'HIGH' && !n.read).length : 0;

        // Calculate revenue from payments
        const revenueData = await Payment.aggregate([
          { $match: { paymentStatus: 'PAID' } },
          { $group: { _id: null, totalRevenue: { $sum: '$amount' } } }
        ]);
        const totalRevenue = revenueData.length > 0 ? revenueData[0].totalRevenue : 0;

        // Get plan usage stats
        const planUsageStats = await AdsPlan.aggregate([
          {
            $lookup: {
              from: 'ads',
              localField: '_id',
              foreignField: 'planId',
              as: 'ads'
            }
          },
          {
            $lookup: {
              from: 'payments',
              localField: '_id',
              foreignField: 'planID',
              as: 'payments'
            }
          },
          {
            $project: {
              planId: '$_id',
              planName: '$name',
              userCount: { $size: { $setUnion: '$ads.userId' } },
              activeAdsCount: { $size: { $filter: { input: '$ads', cond: { $eq: ['$$this.status', 'APPROVED'] } } } },
              totalRevenue: { $sum: { $filter: { input: '$payments', cond: { $eq: ['$$this.paymentStatus', 'PAID'] } } } }
            }
          }
        ]);

        const stats = {
          totalUsers,
          totalAdmins,
          totalDrivers,
          totalAds,
          totalPlans,
          totalRevenue,
          unreadNotifications,
          highPriorityNotifications,
          planUsageStats
        };

        console.log('🔔 Backend: Super admin dashboard stats:', stats);
        return stats;
      } catch (error) {
        console.error('Error fetching super admin dashboard stats:', error);
        throw new Error('Failed to fetch super admin dashboard stats');
      }
    },

    getUserCountsByPlan: async (_, __, { user }) => {
      checkAuth(user);
      
      try {
        console.log('🔔 Backend: Fetching user counts by plan');
        
        // Check if user is super admin
        if (user.role !== 'SUPERADMIN') {
          throw new Error('Unauthorized: Super admin access required');
        }

        const planCounts = await AdsPlan.aggregate([
          {
            $lookup: {
              from: 'ads',
              localField: '_id',
              foreignField: 'planId',
              as: 'ads'
            }
          },
          {
            $lookup: {
              from: 'payments',
              localField: '_id',
              foreignField: 'planID',
              as: 'payments'
            }
          },
          {
            $project: {
              planId: '$_id',
              planName: '$name',
              planDescription: '$description',
              userCount: { $size: { $setUnion: '$ads.userId' } },
              activeAdsCount: { $size: { $filter: { input: '$ads', cond: { $eq: ['$$this.status', 'APPROVED'] } } } },
              totalRevenue: { $sum: { $filter: { input: '$payments', cond: { $eq: ['$$this.paymentStatus', 'PAID'] } } } },
              planDetails: {
                materialType: '$materialType',
                vehicleType: '$vehicleType',
                numberOfDevices: '$numberOfDevices',
                durationDays: '$durationDays',
                totalPrice: '$totalPrice'
              }
            }
          }
        ]);

        console.log('🔔 Backend: User counts by plan:', planCounts);
        return planCounts;
      } catch (error) {
        console.error('Error fetching user counts by plan:', error);
        throw new Error('Failed to fetch user counts by plan');
      }
    },

    getDriverNotifications: async (_, { driverId }, { user }) => {
      try {
        console.log('🔔 Fetching notifications for driver:', driverId);
        
        // Find driver by driverId
        const driver = await Driver.findOne({ driverId });
        if (!driver) {
          throw new Error('Driver not found');
        }
        
        // Get notifications for this driver
        const userNotifications = await UserNotifications.findOne({ 
          userId: driver._id,
          userRole: 'DRIVER'
        });
        
        if (!userNotifications) {
          console.log('🔔 No notifications found for driver');
          return {
            notifications: [],
            unreadCount: 0
          };
        }
        
        // Return notifications array sorted by creation date (newest first)
        const notifications = userNotifications.notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        console.log('🔔 Found notifications for driver:', notifications.length);
        return {
          notifications,
          unreadCount: userNotifications.unreadCount || 0
        };
      } catch (error) {
        console.error('Error fetching driver notifications:', error);
        throw new Error('Failed to fetch driver notifications');
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

    markNotificationAsRead: async (_, { notificationId }, { user }) => {
      checkAuth(user);
      
      try {
        const userNotifications = await UserNotifications.findOne({ userId: user.id });
        
        if (!userNotifications) {
          throw new Error('User notifications not found');
        }
        
        // Find the notification in the array
        const notification = userNotifications.notifications.find(n => n._id.toString() === notificationId);
        
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

    // Admin-specific mutations
    markNotificationRead: async (_, { notificationId }, { user }) => {
      checkAuth(user);
      
      try {
        const userNotifications = await UserNotifications.findOne({ userId: user.id });
        
        if (!userNotifications) {
          return {
            success: false,
            message: 'User notifications not found'
          };
        }
        
        // Find the notification in the array
        const notification = userNotifications.notifications.find(n => n._id.toString() === notificationId);
        
        if (!notification) {
          return {
            success: false,
            message: 'Notification not found'
          };
        }
        
        if (notification.read) {
          return {
            success: true,
            message: 'Notification already marked as read'
          };
        }
        
        // Mark as read
        notification.read = true;
        notification.readAt = new Date();
        
        // Update unread count
        userNotifications.unreadCount = Math.max(0, userNotifications.unreadCount - 1);
        
        await userNotifications.save();
        
        return {
          success: true,
          message: 'Notification marked as read'
        };
      } catch (error) {
        console.error('Error marking notification as read:', error);
        return {
          success: false,
          message: 'Failed to mark notification as read'
        };
      }
    },

    markAllNotificationsRead: async (_, __, { user }) => {
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
        let markedCount = 0;
        userNotifications.notifications.forEach(notification => {
          if (!notification.read) {
            notification.read = true;
            notification.readAt = new Date();
            markedCount++;
          }
        });
        
        // Reset unread count
        userNotifications.unreadCount = 0;
        
        await userNotifications.save();
        
        return {
          success: true,
          message: `Marked ${markedCount} notifications as read`
        };
      } catch (error) {
        console.error('Error marking all notifications as read:', error);
        return {
          success: false,
          message: 'Failed to mark all notifications as read'
        };
      }
    },

    deleteNotification: async (_, { notificationId }, { user }) => {
      checkAuth(user);
      
      try {
        console.log('🗑️ Deleting notification:', notificationId, 'for user:', user.id);
        const userNotifications = await UserNotifications.findOne({ userId: user.id });
        
        if (!userNotifications) {
          console.log('❌ User notifications not found for user:', user.id);
          return {
            success: false,
            message: 'User notifications not found'
          };
        }
        
        console.log('🔍 Available notification IDs:', userNotifications.notifications.map(n => n._id.toString()));
        
        // Find the notification index
        const notificationIndex = userNotifications.notifications.findIndex(n => n._id.toString() === notificationId);
        
        if (notificationIndex === -1) {
          console.log('❌ Notification not found:', notificationId);
          return {
            success: false,
            message: 'Notification not found'
          };
        }
        
        const notification = userNotifications.notifications[notificationIndex];
        console.log('✅ Found notification to delete:', notification.title);
        
        // Remove notification from array
        userNotifications.notifications.splice(notificationIndex, 1);
        
        // Update unread count if notification was unread
        if (!notification.read) {
          userNotifications.unreadCount = Math.max(0, userNotifications.unreadCount - 1);
        }
        
        await userNotifications.save();
        console.log('✅ Notification deleted successfully');
        
        return {
          success: true,
          message: 'Notification deleted successfully'
        };
      } catch (error) {
        console.error('❌ Error deleting notification:', error);
        return {
          success: false,
          message: 'Failed to delete notification'
        };
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


    deleteAllNotifications: async (_, __, { user }) => {
      checkAuth(user);
      
      try {
        const result = await NotificationService.deleteAllNotifications(user.id);
        return result;
      } catch (error) {
        console.error('Error deleting all notifications:', error);
        throw new Error(`Failed to delete all notifications: ${error.message}`);
      }
    },

    deleteNotificationsByCategory: async (_, { category }, { user }) => {
      checkAuth(user);
      
      try {
        const result = await NotificationService.deleteNotificationsByCategory(user.id, category);
        return result;
      } catch (error) {
        console.error('Error deleting notifications by category:', error);
        throw new Error(`Failed to delete notifications by category: ${error.message}`);
      }
    },

    markSuperAdminNotificationRead: async (_, { notificationId }, { user }) => {
      checkAuth(user);
      
      try {
        // Check if user is super admin
        if (user.role !== 'SUPERADMIN') {
          throw new Error('Unauthorized: Super admin access required');
        }

        const userNotifications = await UserNotifications.findOne({ userId: user.id });
        
        if (!userNotifications) {
          return {
            success: false,
            message: 'User notifications not found'
          };
        }
        
        // Find the notification index
        const notificationIndex = userNotifications.notifications.findIndex(n => n._id.toString() === notificationId);
        
        if (notificationIndex === -1) {
          return {
            success: false,
            message: 'Notification not found'
          };
        }
        
        const notification = userNotifications.notifications[notificationIndex];
        
        // Mark notification as read
        if (!notification.read) {
          notification.read = true;
          notification.readAt = new Date();
          userNotifications.unreadCount = Math.max(0, userNotifications.unreadCount - 1);
        }
        
        await userNotifications.save();
        
        return {
          success: true,
          message: 'Notification marked as read'
        };
      } catch (error) {
        console.error('Error marking super admin notification as read:', error);
        return {
          success: false,
          message: 'Failed to mark notification as read'
        };
      }
    },

    markAllSuperAdminNotificationsRead: async (_, __, { user }) => {
      checkAuth(user);
      
      try {
        // Check if user is super admin
        if (user.role !== 'SUPERADMIN') {
          throw new Error('Unauthorized: Super admin access required');
        }

        const userNotifications = await UserNotifications.findOne({ userId: user.id });
        
        if (!userNotifications) {
          return {
            success: true,
            message: 'No notifications to mark as read'
          };
        }
        
        // Mark all notifications as read
        let markedCount = 0;
        userNotifications.notifications.forEach(notification => {
          if (!notification.read) {
            notification.read = true;
            notification.readAt = new Date();
            markedCount++;
          }
        });
        
        // Reset unread count
        userNotifications.unreadCount = 0;
        
        await userNotifications.save();
        
        return {
          success: true,
          message: `All ${markedCount} notifications marked as read`
        };
      } catch (error) {
        console.error('Error marking all super admin notifications as read:', error);
        return {
          success: false,
          message: 'Failed to mark all notifications as read'
        };
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
    id: (notification) => {
      return notification._id.toString();
    },
    userId: async (notification) => {
      return await User.findById(notification.userId);
    }
  }
};

module.exports = notificationResolvers;
