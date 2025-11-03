const UserNotifications = require('../models/Notification');
const User = require('../models/User');
const Ad = require('../models/Ad');
const Material = require('../models/Material');
const Driver = require('../models/Driver');
const Admin = require('../models/Admin');
const Payment = require('../models/Payment');
const { checkAuth } = require('../middleware/auth');
const NotificationService = require('../services/notifications/NotificationService');
const logger = require('../utils/logger');

const notificationResolvers = {
  Query: {
    getUserNotifications: async (_, __, { user }) => {
      checkAuth(user);
      
      try {
        logger.notification('🔔 Backend: Fetching notifications for user:', user.id);
        const userNotifications = await UserNotifications.findOne({ userId: user.id });
        
        if (!userNotifications) {
          logger.notification('🔔 Backend: No notifications found for user');
          return [];
        }
        
        // Return notifications array sorted by creation date (newest first)
        // Convert Date objects to ISO strings for GraphQL
        const notifications = userNotifications.notifications
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .map(notification => ({
            ...notification.toObject(),
            createdAt: notification.createdAt ? notification.createdAt.toISOString() : new Date().toISOString(),
            updatedAt: notification.updatedAt ? notification.updatedAt.toISOString() : new Date().toISOString(),
            readAt: notification.readAt ? notification.readAt.toISOString() : null
          }));
        
        logger.notification('🔔 Backend: Found notifications:', notifications.length);
        logger.notification('🔔 Backend: Notifications data (first notification):', notifications[0]);
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
        logger.notification('🔔 Backend: Fetching admin notifications for user:', user.id);
        const userNotifications = await UserNotifications.findOne({ userId: user.id });
        
        if (!userNotifications) {
          logger.notification('🔔 Backend: No notifications found for admin');
          return {
            notifications: [],
            unreadCount: 0
          };
        }
        
        // Return notifications array sorted by creation date (newest first)
        const notifications = userNotifications.notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(notification => ({
          ...notification.toObject(),
          createdAt: notification.createdAt ? notification.createdAt.toISOString() : new Date().toISOString(),
          updatedAt: notification.updatedAt ? notification.updatedAt.toISOString() : new Date().toISOString()
        }));
        
        logger.notification('🔔 Backend: Found admin notifications:', notifications.length);
        return {
          notifications,
          unreadCount: userNotifications.unreadCount
        };
      } catch (error) {
        console.error('Error fetching admin notifications:', error);
        throw new Error('Failed to fetch admin notifications');
      }
    },

    // Device-specific notifications (for screen control page)
    getDeviceNotifications: async (_, __, { user }) => {
      checkAuth(user);
      
      try {
        logger.notification('🔔 Backend: Fetching device notifications for user:', user.id);
        const userNotifications = await UserNotifications.findOne({ userId: user.id });
        
        if (!userNotifications) {
          logger.notification('🔔 Backend: No notifications found for admin');
          return {
            notifications: [],
            unreadCount: 0
          };
        }
        
        // Filter for device/material specific notifications
        const deviceCategories = [
          'DEVICE_OFFLINE', 
          'DEVICE_ONLINE', 
          'DEVICE_MILESTONE', 
          'MATERIAL_PERFORMANCE', 
          'DEVICE_STATUS_CHANGE'
        ];
        
        const deviceNotifications = userNotifications.notifications.filter(notification => 
          deviceCategories.includes(notification.category)
        ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(notification => ({
          ...notification.toObject(),
          createdAt: notification.createdAt ? notification.createdAt.toISOString() : new Date().toISOString(),
          updatedAt: notification.updatedAt ? notification.updatedAt.toISOString() : new Date().toISOString()
        }));
        
        const unreadCount = deviceNotifications.filter(n => !n.read).length;
        
        logger.notification('🔔 Backend: Found device notifications:', deviceNotifications.length);
        return {
          notifications: deviceNotifications,
          unreadCount: unreadCount
        };
      } catch (error) {
        console.error('Error fetching device notifications:', error);
        throw new Error('Failed to fetch device notifications');
      }
    },

    // General admin notifications (for main admin notifications page)
    getAdminGeneralNotifications: async (_, __, { user }) => {
      checkAuth(user);
      
      try {
        logger.notification('🔔 Backend: Fetching general admin notifications for user:', user.id);
        const userNotifications = await UserNotifications.findOne({ userId: user.id });
        
        if (!userNotifications) {
          logger.notification('🔔 Backend: No notifications found for admin');
          return {
            notifications: [],
            unreadCount: 0
          };
        }
        
        // Filter for general admin notifications (exclude device-specific)
        const generalCategories = [
          'NEW_AD_SUBMISSION', 
          'NEW_USER_REGISTRATION', 
          'NEW_DRIVER_APPLICATION', 
          'NEW_MATERIAL_CREATED', 
          'PAYMENT_SUCCESS', 
          'PAYMENT_FAILURE', 
          'PAYMENT_ISSUE', 
          'SYSTEM_ALERT',
          'REPORT_STATUS_UPDATE', 
          'NEW_USER_REPORT'
        ];
        
        const generalNotifications = userNotifications.notifications.filter(notification => 
          generalCategories.includes(notification.category)
        ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(notification => ({
          ...notification.toObject(),
          createdAt: notification.createdAt ? notification.createdAt.toISOString() : new Date().toISOString(),
          updatedAt: notification.updatedAt ? notification.updatedAt.toISOString() : new Date().toISOString()
        }));
        
        const unreadCount = generalNotifications.filter(n => !n.read).length;
        
        logger.notification('🔔 Backend: Found general admin notifications:', generalNotifications.length);
        return {
          notifications: generalNotifications,
          unreadCount: unreadCount
        };
      } catch (error) {
        console.error('Error fetching general admin notifications:', error);
        throw new Error('Failed to fetch general admin notifications');
      }
    },

    getPendingAds: async (_, __, { user }) => {
      checkAuth(user);
      
      try {
        logger.notification('🔔 Backend: Fetching pending ads for user:', user.id);
        const pendingAds = await Ad.find({ status: 'PENDING' })
          .populate('userId', 'firstName lastName')
          .sort({ createdAt: -1 });
        
        logger.notification('🔔 Backend: Found pending ads:', pendingAds.length);
        
        // Transform the data to match PendingAd schema
        const transformedAds = pendingAds.map(ad => ({
          id: ad._id,
          title: ad.title,
          status: ad.status,
          createdAt: ad.createdAt,
          user: ad.userId,
          materialId: ad.materialId || [], // Return as array to match schema
          // Removed planId - no longer using AdsPlan
        }));
        
        logger.notification('🔔 Backend: Pending ads details:', transformedAds.map(ad => ({
          id: ad.id,
          title: ad.title,
          status: ad.status,
          userId: ad.user,
          materialId: ad.materialId
        })));
        return transformedAds;
      } catch (error) {
        console.error('Error fetching pending ads:', error);
        throw new Error('Failed to fetch pending ads');
      }
    },

    getPendingMaterials: async (_, __, { user }) => {
      checkAuth(user);
      
      try {
        logger.notification('🔔 Backend: Fetching pending materials');
        // Find materials that are created but not yet assigned to any plan
        const pendingMaterials = await Material.find({ 
          status: 'PENDING' 
        })
          .populate('driverId', 'firstName lastName')
          .sort({ createdAt: -1 });
        
        logger.notification('🔔 Backend: Found pending materials:', pendingMaterials.length);
        return pendingMaterials;
      } catch (error) {
        console.error('Error fetching pending materials:', error);
        throw new Error('Failed to fetch pending materials');
      }
    },

    getAdminDashboardStats: async (_, __, { user }) => {
      checkAuth(user);
      
      try {
        logger.notification('🔔 Backend: Fetching admin dashboard stats');
        
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

        logger.notification('🔔 Backend: Admin dashboard stats:', stats);
        logger.notification('🔔 Backend: Pending ads count in stats:', pendingAds);
        return stats;
      } catch (error) {
        console.error('Error fetching admin dashboard stats:', error);
        throw new Error('Failed to fetch admin dashboard stats');
      }
    },

    getSuperAdminNotifications: async (_, __, { user }) => {
      checkAuth(user);
      
      try {
        logger.notification('🔔 Backend: Fetching super admin notifications for user:', user.id);
        
        // Check if user is super admin
        if (user.role !== 'SUPERADMIN') {
          throw new Error('Unauthorized: Super admin access required');
        }

        const userNotifications = await UserNotifications.findOne({ userId: user.id });
        
        if (!userNotifications) {
          logger.notification('🔔 Backend: No notifications found for super admin');
          return {
            notifications: [],
            unreadCount: 0
          };
        }
        
        // Return notifications array sorted by creation date (newest first)
        // Convert Date objects to ISO strings for GraphQL
        const notifications = userNotifications.notifications
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .map(notification => ({
            ...notification.toObject(),
            createdAt: notification.createdAt ? notification.createdAt.toISOString() : new Date().toISOString(),
            updatedAt: notification.updatedAt ? notification.updatedAt.toISOString() : new Date().toISOString(),
            readAt: notification.readAt ? notification.readAt.toISOString() : null
          }));
        
        logger.notification('🔔 Backend: Found super admin notifications:', notifications.length);
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
        logger.notification('🔔 Backend: Fetching super admin dashboard stats');
        
        // Check if user is super admin
        if (user.role !== 'SUPERADMIN') {
          throw new Error('Unauthorized: Super admin access required');
        }

        const [
          totalUsers,
          totalAdmins,
          totalDrivers,
          totalAds,
          userNotifications
        ] = await Promise.all([
          User.countDocuments(),
          Admin.countDocuments(),
          Driver.countDocuments(),
          Ad.countDocuments(),
          0, // Removed AdsPlan count - no longer using AdsPlan
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

        // Calculate user statistics
        const userStats = await User.aggregate([
          {
            $group: {
              _id: null,
              emailVerified: { $sum: { $cond: ['$isEmailVerified', 1, 0] } },
              emailUnverified: { $sum: { $cond: [{ $not: '$isEmailVerified' }, 1, 0] } },
              hasLastLogin: { $sum: { $cond: [{ $ne: ['$lastLogin', null] }, 1, 0] } },
              neverLoggedIn: { $sum: { $cond: [{ $eq: ['$lastLogin', null] }, 1, 0] } },
              archived: { $sum: { $cond: ['$isArchived', 1, 0] } },
              accountLocked: { $sum: { $cond: ['$accountLocked', 1, 0] } },
              googleAuth: { $sum: { $cond: [{ $eq: ['$authProvider', 'google'] }, 1, 0] } },
              localAuth: { $sum: { $cond: [{ $eq: ['$authProvider', 'local'] }, 1, 0] } }
            }
          }
        ]);

        const userStatistics = userStats.length > 0 ? userStats[0] : {
          emailVerified: 0,
          emailUnverified: 0,
          hasLastLogin: 0,
          neverLoggedIn: 0,
          archived: 0,
          accountLocked: 0,
          googleAuth: 0,
          localAuth: 0
        };

        // Calculate driver statistics
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const driverStats = await Driver.aggregate([
          {
            $group: {
              _id: null,
              pendingApproval: { 
                $sum: { 
                  $cond: [
                    { $and: [
                      { $eq: ['$accountStatus', 'PENDING'] },
                      { $in: ['$reviewStatus', ['PENDING', null]] }
                    ]}, 
                    1, 
                    0
                  ] 
                } 
              },
              active: { $sum: { $cond: [{ $eq: ['$accountStatus', 'ACTIVE'] }, 1, 0] } },
              suspended: { $sum: { $cond: [{ $eq: ['$accountStatus', 'SUSPENDED'] }, 1, 0] } },
              rejected: { $sum: { $cond: [{ $eq: ['$accountStatus', 'REJECTED'] }, 1, 0] } },
              resubmitted: { $sum: { $cond: [{ $eq: ['$accountStatus', 'RESUBMITTED'] }, 1, 0] } },
              newThisMonth: { 
                $sum: { 
                  $cond: [
                    { $gte: ['$createdAt', startOfMonth] }, 
                    1, 
                    0
                  ] 
                } 
              },
              archived: { $sum: { $cond: ['$isArchived', 1, 0] } }
            }
          }
        ]);

        const driverStatistics = driverStats.length > 0 ? driverStats[0] : {
          pendingApproval: 0,
          active: 0,
          suspended: 0,
          rejected: 0,
          resubmitted: 0,
          newThisMonth: 0,
          archived: 0
        };

        // Calculate ad statistics
        const adStats = await Ad.aggregate([
          {
            $group: {
              _id: null,
              active: { 
                $sum: { 
                  $cond: [
                    { $and: [
                      { $eq: ['$status', 'APPROVED'] },
                      { $eq: ['$adStatus', 'ACTIVE'] }
                    ]}, 
                    1, 
                    0
                  ] 
                } 
              },
              pending: { $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] } },
              approved: { $sum: { $cond: [{ $eq: ['$status', 'APPROVED'] }, 1, 0] } },
              rejected: { $sum: { $cond: [{ $eq: ['$status', 'REJECTED'] }, 1, 0] } },
              running: { $sum: { $cond: [{ $eq: ['$status', 'RUNNING'] }, 1, 0] } },
              scheduled: { $sum: { $cond: [{ $eq: ['$status', 'SCHEDULED'] }, 1, 0] } },
              ended: { $sum: { $cond: [{ $eq: ['$status', 'ENDED'] }, 1, 0] } },
              newThisMonth: { 
                $sum: { 
                  $cond: [
                    { $gte: ['$createdAt', startOfMonth] }, 
                    1, 
                    0
                  ] 
                } 
              },
              archived: { $sum: { $cond: ['$isArchived', 1, 0] } }
            }
          }
        ]);

        const adStatistics = adStats.length > 0 ? adStats[0] : {
          active: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          running: 0,
          scheduled: 0,
          ended: 0,
          newThisMonth: 0,
          archived: 0
        };

        // Removed AdsPlan usage stats - no longer using AdsPlan
        const planUsageStats = [];

        const stats = {
          totalUsers,
          totalAdmins,
          totalDrivers,
          totalAds,
          totalPlans: 0, // Removed - no longer using AdsPlan
          totalRevenue,
          unreadNotifications,
          highPriorityNotifications,
          planUsageStats,
          userStatistics: {
            emailVerified: userStatistics.emailVerified || 0,
            emailUnverified: userStatistics.emailUnverified || 0,
            hasLastLogin: userStatistics.hasLastLogin || 0,
            neverLoggedIn: userStatistics.neverLoggedIn || 0,
            archived: userStatistics.archived || 0,
            accountLocked: userStatistics.accountLocked || 0,
            googleAuth: userStatistics.googleAuth || 0,
            localAuth: userStatistics.localAuth || 0
          },
          driverStatistics: {
            pendingApproval: driverStatistics.pendingApproval || 0,
            active: driverStatistics.active || 0,
            suspended: driverStatistics.suspended || 0,
            rejected: driverStatistics.rejected || 0,
            resubmitted: driverStatistics.resubmitted || 0,
            newThisMonth: driverStatistics.newThisMonth || 0,
            archived: driverStatistics.archived || 0
          },
          adStatistics: {
            active: adStatistics.active || 0,
            pending: adStatistics.pending || 0,
            approved: adStatistics.approved || 0,
            rejected: adStatistics.rejected || 0,
            running: adStatistics.running || 0,
            scheduled: adStatistics.scheduled || 0,
            ended: adStatistics.ended || 0,
            newThisMonth: adStatistics.newThisMonth || 0,
            archived: adStatistics.archived || 0
          }
        };

        logger.notification('🔔 Backend: Super admin dashboard stats:', stats);
        return stats;
      } catch (error) {
        console.error('Error fetching super admin dashboard stats:', error);
        throw new Error('Failed to fetch super admin dashboard stats');
      }
    },

    getUserCountsByPlan: async (_, __, { user }) => {
      checkAuth(user);
      
      try {
        logger.notification('🔔 Backend: Fetching user counts by plan');
        
        // Check if user is super admin
        if (user.role !== 'SUPERADMIN') {
          throw new Error('Unauthorized: Super admin access required');
        }

        // Removed AdsPlan functionality - no longer using AdsPlan
        const planCounts = [];

        logger.notification('🔔 Backend: User counts by plan:', planCounts);
        return planCounts;
      } catch (error) {
        console.error('Error fetching user counts by plan:', error);
        throw new Error('Failed to fetch user counts by plan');
      }
    },

    getSuperAdminMonthlyGrowth: async (_, { months = 12 }, { user }) => {
      checkAuth(user);
      
      try {
        logger.notification(`🔔 Backend: Fetching monthly growth data for last ${months} months`);
        
        // Check if user is super admin
        if (user.role !== 'SUPERADMIN') {
          throw new Error('Unauthorized: Super admin access required');
        }

        const User = require('../models/User');
        const Driver = require('../models/Driver');
        const Ad = require('../models/Ad');

        // Calculate date range
        const now = new Date();
        const startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - months);

        // Get users grouped by month
        const userGrowth = await User.aggregate([
          {
            $match: {
              createdAt: { $gte: startDate }
            }
          },
          {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' }
              },
              count: { $sum: 1 }
            }
          },
          {
            $sort: { '_id.year': 1, '_id.month': 1 }
          }
        ]);

        // Get drivers grouped by month
        const driverGrowth = await Driver.aggregate([
          {
            $match: {
              createdAt: { $gte: startDate }
            }
          },
          {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' }
              },
              count: { $sum: 1 }
            }
          },
          {
            $sort: { '_id.year': 1, '_id.month': 1 }
          }
        ]);

        // Get ads grouped by month
        const adGrowth = await Ad.aggregate([
          {
            $match: {
              createdAt: { $gte: startDate }
            }
          },
          {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' }
              },
              count: { $sum: 1 }
            }
          },
          {
            $sort: { '_id.year': 1, '_id.month': 1 }
          }
        ]);

        // Create maps for quick lookup
        const userMap = new Map();
        userGrowth.forEach(item => {
          const key = `${item._id.year}-${item._id.month}`;
          userMap.set(key, item.count);
        });

        const driverMap = new Map();
        driverGrowth.forEach(item => {
          const key = `${item._id.year}-${item._id.month}`;
          driverMap.set(key, item.count);
        });

        const adMap = new Map();
        adGrowth.forEach(item => {
          const key = `${item._id.year}-${item._id.month}`;
          adMap.set(key, item.count);
        });

        // Generate all months in range with cumulative totals (total up to that month)
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const result = [];
        let cumulativeUsers = 0;
        let cumulativeDrivers = 0;
        let cumulativeAds = 0;

        // Get total counts before start date
        const usersBeforeStart = await User.countDocuments({ createdAt: { $lt: startDate } });
        const driversBeforeStart = await Driver.countDocuments({ createdAt: { $lt: startDate } });
        const adsBeforeStart = await Ad.countDocuments({ createdAt: { $lt: startDate } });

        cumulativeUsers = usersBeforeStart;
        cumulativeDrivers = driversBeforeStart;
        cumulativeAds = adsBeforeStart;

        for (let i = 0; i < months; i++) {
          const date = new Date(now);
          date.setMonth(date.getMonth() - (months - 1 - i));
          const year = date.getFullYear();
          const month = date.getMonth() + 1;
          const key = `${year}-${month}`;

          // Add new registrations for this month
          cumulativeUsers += userMap.get(key) || 0;
          cumulativeDrivers += driverMap.get(key) || 0;
          cumulativeAds += adMap.get(key) || 0;

          result.push({
            month: monthNames[month - 1],
            year,
            monthIndex: month,
            users: cumulativeUsers,
            drivers: cumulativeDrivers,
            ads: cumulativeAds
          });
        }

        logger.notification(`🔔 Backend: Monthly growth data: ${result.length} months`);
        return result;
      } catch (error) {
        console.error('Error fetching monthly growth data:', error);
        throw new Error('Failed to fetch monthly growth data');
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
        // Convert Date objects to ISO strings for GraphQL
        const notifications = userNotifications.notifications
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .map(notification => ({
            ...notification.toObject(),
            createdAt: notification.createdAt ? notification.createdAt.toISOString() : new Date().toISOString(),
            updatedAt: notification.updatedAt ? notification.updatedAt.toISOString() : new Date().toISOString(),
            readAt: notification.readAt ? notification.readAt.toISOString() : null
          }));
        
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
    markNotificationRead: async (_, { notificationId }, { user, driver }) => {
      // Support both user and driver authentication
      if (!user && !driver) {
        throw new Error('Authentication required');
      }
      
      try {
        // Get the correct user ID based on authentication type
        const userId = user ? user.id : driver._id;
        const userType = user ? 'user' : 'driver';
        
        console.log(`🔔 Marking notification as read for ${userType}:`, userId, 'notificationId:', notificationId);
        const userNotifications = await UserNotifications.findOne({ userId });
        
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
        console.log(`✅ Notification marked as read for ${userType}`);
        
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

    markAllNotificationsRead: async (_, __, { user, driver }) => {
      // Support both user and driver authentication
      if (!user && !driver) {
        throw new Error('Authentication required');
      }
      
      try {
        // Get the correct user ID based on authentication type
        const userId = user ? user.id : driver._id;
        const userType = user ? 'user' : 'driver';
        
        console.log(`🔔 Marking all notifications as read for ${userType}:`, userId);
        const userNotifications = await UserNotifications.findOne({ userId });
        
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
        console.log(`✅ Marked ${markedCount} notifications as read for ${userType}`);
        
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

    deleteNotification: async (_, { notificationId }, { user, driver }) => {
      // Support both user and driver authentication
      if (!user && !driver) {
        throw new Error('Authentication required');
      }
      
      try {
        // Get the correct user ID based on authentication type
        const userId = user ? user.id : driver._id;
        const userType = user ? 'user' : 'driver';
        
        console.log(`🗑️ Deleting notification: ${notificationId} for ${userType}:`, userId);
        const userNotifications = await UserNotifications.findOne({ userId });
        
        if (!userNotifications) {
          console.log(`❌ Notifications not found for ${userType}:`, userId);
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

    markAllNotificationsAsRead: async (_, __, { user, driver }) => {
      // Support both user and driver authentication
      if (!user && !driver) {
        throw new Error('Authentication required');
      }
      
      try {
        // Get the correct user ID based on authentication type
        const userId = user ? user.id : driver._id;
        const userType = user ? 'user' : 'driver';
        
        console.log(`🔔 Marking all notifications as read for ${userType}:`, userId);
        const userNotifications = await UserNotifications.findOne({ userId });
        
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
        console.log(`✅ All notifications marked as read for ${userType}`);
        
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
