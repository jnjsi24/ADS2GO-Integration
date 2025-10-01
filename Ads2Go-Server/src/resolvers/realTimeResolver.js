const firebaseService = require('../services/firebaseService');
const syncService = require('../services/syncService');

const resolvers = {
  Query: {
    // Tablet queries
    getAllTablets: async (_, __, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      
      return await firebaseService.getAllTablets();
    },

    getTabletStatus: async (_, { tabletId }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      
      return await firebaseService.getTabletStatus(tabletId);
    },

    getTabletLocation: async (_, { tabletId }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      
      const location = await firebaseService.getTabletLocation(tabletId);
      return location?.location || null;
    },

    // Playback queries
    getCurrentPlayback: async (_, { tabletId }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      
      return await firebaseService.getCurrentPlayback(tabletId);
    },

    getActivePlaybacks: async (_, __, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      
      return await firebaseService.getActivePlaybacks();
    },

    // Notification queries
    getUnreadNotifications: async (_, { tabletId }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      
      return await firebaseService.getUnreadNotifications(tabletId);
    },

    // Dashboard queries
    getDashboardData: async (_, __, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      
      return await firebaseService.getAdminDashboardData();
    },

    // Sync queries
    getSyncStatus: async (_, __, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      
      return syncService.getStatus();
    },
  },

  Mutation: {
    // Tablet management
    registerTablet: async (_, { input }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      
      const result = await firebaseService.registerTablet(input);
      return await firebaseService.getTabletStatus(input.tabletId);
    },

    updateTabletStatus: async (_, { tabletId, input }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      
      await firebaseService.updateTabletStatus(tabletId, input.status, input);
      return await firebaseService.getTabletStatus(tabletId);
    },

    updateTabletLocation: async (_, { tabletId, location }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      
      await firebaseService.updateTabletLocation(tabletId, location);
      return location;
    },

    // Playback management
    startPlayback: async (_, { input }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      
      const result = await firebaseService.startPlayback(input.tabletId, input);
      return await firebaseService.getCurrentPlayback(input.tabletId);
    },

    updatePlayback: async (_, { playbackId, input }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      
      await firebaseService.updatePlayback(playbackId, input);
      
      // Get updated playback data
      const playback = await firebaseService.getCurrentPlayback(input.tabletId);
      return playback;
    },

    endPlayback: async (_, { playbackId, input }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      
      await firebaseService.endPlayback(playbackId, input);
      
      // Return the completed playback data
      return {
        id: playbackId,
        status: 'COMPLETED',
        duration: input.duration,
        impressions: input.impressions
      };
    },

    // Notification management
    sendNotification: async (_, { input }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      
      await firebaseService.sendNotification(input.tabletId, input);
      
      // Return the notification data
      return {
        id: `${input.tabletId}_${Date.now()}`,
        tabletId: input.tabletId,
        title: input.title,
        message: input.message,
        type: input.type || 'INFO',
        data: input.data || {},
        timestamp: new Date().toISOString(),
        read: false
      };
    },

    markNotificationAsRead: async (_, { notificationId }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      
      await firebaseService.markNotificationAsRead(notificationId);
      
      // Return the updated notification
      return {
        id: notificationId,
        read: true,
        readAt: new Date().toISOString()
      };
    },

    // Sync management
    startSync: async (_, __, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      
      syncService.start();
      return syncService.getStatus();
    },

    stopSync: async (_, __, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      
      syncService.stop();
      return syncService.getStatus();
    },

    setSyncInterval: async (_, { interval }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      
      syncService.setSyncInterval(interval);
      return syncService.getStatus();
    },

    manualSync: async (_, { tabletId }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      
      await syncService.syncTablet(tabletId);
      return true;
    },
  },

  Subscription: {
    tabletStatusChanged: {
      subscribe: (_, { tabletId }, { admin, superAdmin }) => {
        if (!admin && !superAdmin) {
          throw new Error('Not authorized');
        }
        
        return firebaseService.onTabletStatusChange(tabletId, (data) => {
          return data;
        });
      }
    },

    locationChanged: {
      subscribe: (_, { tabletId }, { admin, superAdmin }) => {
        if (!admin && !superAdmin) {
          throw new Error('Not authorized');
        }
        
        return firebaseService.onLocationChange(tabletId, (data) => {
          return data?.location || null;
        });
      }
    },

    playbackChanged: {
      subscribe: (_, { tabletId }, { admin, superAdmin }) => {
        if (!admin && !superAdmin) {
          throw new Error('Not authorized');
        }
        
        return firebaseService.onPlaybackChange(tabletId, (data) => {
          return data;
        });
      }
    },

    notificationReceived: {
      subscribe: (_, { tabletId }, { admin, superAdmin }) => {
        if (!admin && !superAdmin) {
          throw new Error('Not authorized');
        }
        
        // For notifications, we'll use a simple polling approach
        // In a real implementation, you might want to use Firebase Cloud Messaging
        return {
          next: (value) => value,
          return: () => {},
          throw: (error) => error
        };
      }
    },

    dashboardUpdated: {
      subscribe: (_, __, { admin, superAdmin }) => {
        if (!admin && !superAdmin) {
          throw new Error('Not authorized');
        }
        
        // For dashboard updates, we'll use a simple polling approach
        return {
          next: (value) => value,
          return: () => {},
          throw: (error) => error
        };
      }
    },
  },

  // Custom scalar for JSON
  JSON: {
    __serialize(value) {
      return value;
    },
    __parseValue(value) {
      return value;
    },
    __parseLiteral(ast) {
      return ast.value;
    },
  },
};

module.exports = resolvers;
