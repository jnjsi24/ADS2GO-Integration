const jwt = require('jsonwebtoken');
const MaterialTracking = require('../models/MaterialTracking');
const Tablet = require('../models/Tablet');
const { JWT_SECRET } = process.env;

function checkAdmin(context = {}) {
  const authHeader =
    context?.req?.headers?.authorization ||
    context?.headers?.authorization ||
    context?.authorization ||
    '';

  if (!authHeader) throw new Error('Unauthorized: No token provided');

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'ADMIN') throw new Error('Unauthorized: Admin role required');
    return decoded;
  } catch (err) {
    throw new Error('Unauthorized: Invalid or expired token');
  }
}

const resolvers = {
  Query: {
    getMaterialTrackings: async (_, __, context) => {
      checkAdmin(context);
      return await MaterialTracking.find();
    },
    getMaterialTrackingById: async (_, { id }, context) => {
      checkAdmin(context);
      return await MaterialTracking.findById(id);
    }
  },

  Mutation: {
    createMaterialTracking: async (_, { input }, context) => {
      checkAdmin(context);
      const newTracking = new MaterialTracking(input);
      return await newTracking.save();
    },

    updateMaterialTracking: async (_, { id, input }, context) => {
      checkAdmin(context);
      return await MaterialTracking.findByIdAndUpdate(id, input, { new: true });
    },

    deleteMaterialTracking: async (_, { id }, context) => {
      checkAdmin(context);
      await MaterialTracking.findByIdAndDelete(id);
      return 'Material tracking record deleted successfully';
    },

    // 🔹 Unified Tablet Reporting
    reportTabletData: async (_, { input }) => {
      const { deviceId, gps, isOnline, qrCodeScans, totalAdImpressions, totalDistanceTraveled } = input;

      // 1️⃣ Find tablet
      const tablet = await Tablet.findOne({ deviceId });
      if (!tablet) throw new Error('Tablet not registered');

      // 2️⃣ Update tablet status
      if (gps) tablet.gps = gps;
      if (typeof isOnline === 'boolean') {
        tablet.isOnline = isOnline;
        if (isOnline) tablet.lastOnlineAt = new Date();
      }
      tablet.lastReportedAt = new Date();
      await tablet.save();

      // 3️⃣ Update corresponding material tracking
      const tracking = await MaterialTracking.findOne({ materialId: tablet.materialId });
      if (!tracking) throw new Error('MaterialTracking record not found');

      if (gps) {
        tracking.gps = gps;
        tracking.lastKnownLocationTime = new Date();
      }
      if (typeof qrCodeScans === 'number') tracking.qrCodeScans = qrCodeScans;
      if (typeof totalAdImpressions === 'number') tracking.totalAdImpressions = totalAdImpressions;
      if (typeof totalDistanceTraveled === 'number') tracking.totalDistanceTraveled = totalDistanceTraveled;

      tracking.deviceStatus = isOnline ? 'ONLINE' : 'OFFLINE';
      tracking.lastHeartbeat = new Date();

      await tracking.save();

      return { tablet, materialTracking: tracking };
    }
  }
};

module.exports = resolvers;
