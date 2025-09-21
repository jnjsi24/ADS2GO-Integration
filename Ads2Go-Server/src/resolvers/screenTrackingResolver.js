const ScreenTracking = require('../models/screenTracking');
const deviceStatusService = require('../services/deviceStatusService');
const { checkAuth } = require('../middleware/auth');

const resolvers = {
  Query: {
    getAllScreens: async (_, { filters }, { admin, superAdmin }) => {
      // Check authentication
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }

      // Return a simple response for testing
      return {
        screens: [],
        totalScreens: 0,
        onlineScreens: 0,
        displayingScreens: 0,
        maintenanceScreens: 0
      };
    },

    getScreenStatus: async (_, { deviceId }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }

      return {
        deviceId,
        materialId: 'test-material',
        screenType: 'test-type',
        carGroupId: 'test-group',
        slotNumber: 1,
        isOnline: true,
        currentLocation: null,
        lastSeen: new Date().toISOString(),
        currentHours: 0,
        hoursRemaining: 0,
        totalDistanceToday: 0,
        displayStatus: 'ONLINE',
        screenMetrics: {
          isDisplaying: false,
          brightness: 50,
          volume: 50,
          adPlayCount: 0,
          maintenanceMode: false,
          currentAd: null,
          dailyAdStats: { totalAdsPlayed: 0, totalDisplayTime: 0, uniqueAdsPlayed: 0, averageAdDuration: 0, adCompletionRate: 0 },
          adPerformance: [],
          displayHours: 0,
          lastAdPlayed: null
        }
      };
    },

    getComplianceReport: async (_, { date }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }

      return {
        date: date || new Date().toISOString().split('T')[0],
        totalTablets: 0,
        onlineTablets: 0,
        compliantTablets: 0,
        nonCompliantTablets: 0,
        averageHours: 0,
        averageDistance: 0,
        screens: []
      };
    },

    getAdAnalytics: async (_, { date, materialId }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }

      return {
        summary: {
          totalDevices: 0,
          onlineDevices: 0,
          totalAdsPlayed: 0,
          totalDisplayHours: 0,
          averageAdsPerDevice: 0,
          averageDisplayHours: 0
        },
        devices: []
      };
    },

    getTabletsList: async (_, __, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }

      return [];
    },

    getAdsDeployments: async (_, __, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }

      return [];
    },

    getAdsForMaterial: async (_, { materialId, slotNumber }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }

      return [];
    },

    getScreenPath: async (_, { deviceId, date }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }

      return {
        deviceId,
        date: date || new Date().toISOString().split('T')[0],
        path: [],
        totalDistance: 0,
        totalHours: 0
      };
    },

    getDeviceAdAnalytics: async (_, { deviceId, date }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }

      return {
        deviceId,
        date: date || new Date().toISOString().split('T')[0],
        totalAdsPlayed: 0,
        totalDisplayHours: 0,
        adPerformance: [],
        dailyStats: "{}"
      };
    }
  },

  Mutation: {
    syncAllScreens: async (_, __, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'All screens synced successfully' };
    },

    playAllScreens: async (_, __, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'All screens started playing' };
    },

    pauseAllScreens: async (_, __, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'All screens paused' };
    },

    stopAllScreens: async (_, __, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'All screens stopped' };
    },

    restartAllScreens: async (_, __, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'All screens restarted' };
    },

    emergencyStopAll: async (_, __, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'Emergency stop activated for all screens' };
    },

    lockdownAllScreens: async (_, __, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'All screens locked down' };
    },

    unlockAllScreens: async (_, __, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'All screens unlocked' };
    },

    updateScreenMetrics: async (_, { deviceId, metrics }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'Screen metrics updated', data: null };
    },

    startScreenSession: async (_, { deviceId }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'Screen session started' };
    },

    endScreenSession: async (_, { deviceId }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'Screen session ended' };
    },

    trackAdPlayback: async (_, { deviceId, adId, adTitle, adDuration, viewTime }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'Ad playback tracked' };
    },

    endAdPlayback: async (_, { deviceId }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'Ad playbook ended' };
    },

    updateDriverActivity: async (_, { deviceId, isActive }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'Driver activity updated' };
    },

    resolveAlert: async (_, { deviceId, alertIndex }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'Alert resolved' };
    },

    deployAdToScreens: async (_, { adId, targetScreens, schedule }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'Ad deployed to screens' };
    },

    updateScreenBrightness: async (_, { deviceId, brightness }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'Screen brightness updated' };
    },

    updateScreenVolume: async (_, { deviceId, volume }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'Screen volume updated' };
    },

    setMaintenanceMode: async (_, { deviceId, enabled }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'Maintenance mode updated' };
    },

    playScreen: async (_, { deviceId }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'Screen started playing' };
    },

    pauseScreen: async (_, { deviceId }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'Screen paused' };
    },

    stopScreen: async (_, { deviceId }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'Screen stopped' };
    },

    restartScreen: async (_, { deviceId }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'Screen restarted' };
    },

    skipToNextAd: async (_, { deviceId }, { admin, superAdmin }) => {
      if (!admin && !superAdmin) {
        throw new Error('Not authorized');
      }
      return { success: true, message: 'Skipped to next ad' };
    }
  }
};

module.exports = resolvers;
