const Tablet = require('../models/Tablet');

module.exports = {
  Query: {
    getTablet: async (_, { deviceId }) => {
      return await Tablet.findOne({ deviceId });
    },
    getTabletsByMaterial: async (_, { materialId }) => {
      return await Tablet.find({ materialId });
    },
    getAllTablets: async () => {
      return await Tablet.find();
    }
  },

  Mutation: {
    registerTablet: async (_, { input }) => {
      const exists = await Tablet.findOne({ deviceId: input.deviceId });
      if (exists) {
        throw new Error('Tablet with this deviceId already exists');
      }
      const tablet = new Tablet(input);
      return await tablet.save();
    },

    updateTabletStatus: async (_, { input }) => {
      const { deviceId, gps, isOnline } = input;
      const tablet = await Tablet.findOne({ deviceId });
      if (!tablet) throw new Error('Tablet not found');

      if (gps) tablet.gps = gps;
      if (typeof isOnline === 'boolean') {
        tablet.isOnline = isOnline;
        if (isOnline) tablet.lastOnlineAt = new Date();
      }
      tablet.lastReportedAt = new Date();

      await tablet.save();
      return tablet;
    },

    reportTabletData: async (_, { input }) => {
      const { deviceId, gps, qrScan, impression } = input;
      const tablet = await Tablet.findOne({ deviceId });
      if (!tablet) throw new Error('Tablet not found');

      if (gps) tablet.gps = gps;
      tablet.lastReportedAt = new Date();

      // Append QR scan if provided
      if (qrScan) {
        if (!tablet.qrScans) tablet.qrScans = [];
        tablet.qrScans.push(qrScan);
      }

      // Append impression if provided
      if (impression) {
        if (!tablet.impressions) tablet.impressions = [];
        tablet.impressions.push(impression);
      }

      await tablet.save();
      return { success: true, message: 'Tablet data reported successfully' };
    }
  }
};
