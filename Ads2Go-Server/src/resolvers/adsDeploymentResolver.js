

// adsDeploymentResolver.js

const AdsDeployment = require('../models/adsDeployment');
const Material = require('../models/Material');
const { v4: uuidv4 } = require('uuid');
const Ad = require('../models/Ad');
const Payment = require('../models/Payment');
const { checkAuth, checkAdmin } = require('../middleware/auth');

const adsDeploymentResolvers = {
  Query: {
    getAllDeployments: async (_, __, { user }) => {
      checkAdmin(user);
      const deployments = await AdsDeployment.find({})
        .populate({
          path: 'adId',
          populate: { path: 'planId', model: 'AdsPlan' }
        })
        .populate({
          path: 'lcdSlots.adId',
          populate: { path: 'planId', model: 'AdsPlan' }
        })
        .populate('materialId')
        .populate('driverId')
        .populate('removedBy')
        .sort({ createdAt: -1 });

      deployments.forEach(d => {
        if (d.driverId && typeof d.driverId === 'object') d.driverId = d.driverId._id;
      });

      return deployments;
    },

    getDeploymentsByDriver: async (_, { driverId }, { user }) => {
      checkAuth(user);
      if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN' && user.id !== driverId) {
        throw new Error('Not authorized to view these deployments');
      }

      const deployments = await AdsDeployment.find({ driverId })
        .populate({
          path: 'adId',
          populate: { path: 'planId', model: 'AdsPlan' }
        })
        .populate({
          path: 'lcdSlots.adId',
          populate: { path: 'planId', model: 'AdsPlan' }
        })
        .populate('materialId')
        .populate('removedBy')
        .sort({ startTime: -1 });

      deployments.forEach(d => {
        if (d.driverId && typeof d.driverId === 'object') d.driverId = d.driverId._id;
      });

      return deployments;
    },

    getDeploymentsByAd: async (_, { adId }, { user }) => {
      checkAuth(user);
      const ad = await Ad.findById(adId).populate('planId');
      if (!ad) throw new Error('Ad not found');
      if (ad.userId.toString() !== user.id && user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
        throw new Error('Not authorized to view these deployments');
      }

      const deployments = await AdsDeployment.find({
        $or: [{ adId }, { 'lcdSlots.adId': adId }]
      })
        .populate({
          path: 'adId',
          populate: { path: 'planId', model: 'AdsPlan' }
        })
        .populate({
          path: 'lcdSlots.adId',
          populate: { path: 'planId', model: 'AdsPlan' }
        })
        .populate('materialId')
        .populate('driverId')
        .populate('removedBy')
        .sort({ startTime: -1 });

      deployments.forEach(d => {
        if (d.driverId && typeof d.driverId === 'object') d.driverId = d.driverId._id;
      });

      return deployments;
    },

    getMyAdDeployments: async (_, __, { user }) => {
      checkAuth(user);
      const userAds = await Ad.find({ userId: user.id });
      const adIds = userAds.map(ad => ad._id);

      const deployments = await AdsDeployment.find({
        $or: [{ adId: { $in: adIds } }, { 'lcdSlots.adId': { $in: adIds } }]
      })
        .populate({
          path: 'adId',
          populate: { path: 'planId', model: 'AdsPlan' }
        })
        .populate({
          path: 'lcdSlots.adId',
          populate: { path: 'planId', model: 'AdsPlan' }
        })
        .populate('materialId')
        .populate('driverId')
        .populate('removedBy')
        .sort({ startTime: -1 });

      deployments.forEach(d => {
        if (d.driverId && typeof d.driverId === 'object') d.driverId = d.driverId._id;
      });

      return deployments;
    },

    getActiveDeployments: async (_, __, { user }) => {
      checkAdmin(user);
      const now = new Date();

      const deployments = await AdsDeployment.find({
        currentStatus: 'RUNNING',
        startTime: { $lte: now },
        endTime: { $gte: now }
      })
        .populate({
          path: 'adId',
          populate: { path: 'planId', model: 'AdsPlan' }
        })
        .populate({
          path: 'lcdSlots.adId',
          populate: { path: 'planId', model: 'AdsPlan' }
        })
        .populate('materialId')
        .populate('driverId')
        .populate('removedBy')
        .sort({ startTime: -1 });

      deployments.forEach(d => {
        if (d.driverId && typeof d.driverId === 'object') d.driverId = d.driverId._id;
      });

      return deployments;
    },

    getDeploymentById: async (_, { id }, { user }) => {
      checkAuth(user);
      const deployment = await AdsDeployment.findById(id)
        .populate({
          path: 'adId',
          populate: { path: 'planId', model: 'AdsPlan' }
        })
        .populate({
          path: 'lcdSlots.adId',
          populate: { path: 'planId', model: 'AdsPlan' }
        })
        .populate('materialId')
        .populate('driverId')
        .populate('removedBy');

      if (!deployment) throw new Error('Deployment not found');

      if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
        let hasAccess = false;

        if (deployment.adId) {
          const ad = await Ad.findById(deployment.adId);
          if (ad && ad.userId.toString() === user.id) hasAccess = true;
        }

        for (const slot of deployment.lcdSlots) {
          const ad = await Ad.findById(slot.adId);
          if (ad && ad.userId.toString() === user.id) {
            hasAccess = true;
            break;
          }
        }

        if (deployment.driverId?._id?.toString() === user.id || deployment.driverId.toString() === user.id) {
          hasAccess = true;
        }

        if (!hasAccess) throw new Error('Not authorized to view this deployment');
      }

      if (deployment.driverId && typeof deployment.driverId === 'object') deployment.driverId = deployment.driverId._id;
      return deployment;
    },

    getLCDDeployments: async (_, { materialId }, { user }) => {
      checkAuth(user);
      const material = await Material.findById(materialId);
      if (!material) throw new Error('Material not found');
      if (material.materialType.toString().toUpperCase() !== 'LCD') {
        throw new Error(`This query is only for LCD materials. Found materialType: ${material.materialType}`);
      }

      const lcdSlots = await AdsDeployment.getLCDDeployments(materialId);
      return lcdSlots.filter(slot => ['SCHEDULED', 'RUNNING'].includes(slot.status));
    }
  },

  Mutation: {
    createDeployment: async (_, { input }, { user }) => {
      checkAdmin(user);
      const { adId, materialId, driverId, startTime, endTime } = input;

      const ad = await Ad.findById(adId).populate('planId');
      if (!ad) throw new Error('Ad not found');
      if (ad.status !== 'APPROVED') throw new Error('Ad must be approved before deployment');

      /*
      const payment = await Payment.findOne({ adsId: adId, paymentStatus: 'PAID' });
      if (!payment) throw new Error('Payment required before deployment. Ad must be paid first.');
      */

      const deployStartTime = new Date(startTime);
      const deployEndTime = new Date(endTime);
      if (deployStartTime >= deployEndTime) throw new Error('End time must be after start time');

      const material = await Material.findById(materialId);
      if (!material) throw new Error('Material not found');

      if (material.materialType?.toUpperCase() === 'LCD') {
        const deployment = await AdsDeployment.addToLCD(materialId, driverId, adId, startTime, endTime);

        await deployment.populate([
          { path: 'lcdSlots.adId', populate: { path: 'planId', model: 'AdsPlan' } },
          'materialId',
          'driverId'
        ]);

        if (deployment.driverId && typeof deployment.driverId === 'object') deployment.driverId = deployment.driverId._id;
        return deployment;
      } else {
        const deployment = new AdsDeployment({
          adDeploymentId: uuidv4(),
          adId,
          materialId,
          driverId,
          startTime: deployStartTime,
          endTime: deployEndTime,
          currentStatus: deployStartTime <= new Date() ? 'RUNNING' : 'SCHEDULED',
          deployedAt: deployStartTime <= new Date() ? new Date() : null
        });

        await deployment.save();
        await deployment.populate([
          { path: 'adId', populate: { path: 'planId', model: 'AdsPlan' } },
          'materialId',
          'driverId'
        ]);

        if (deployment.driverId && typeof deployment.driverId === 'object') deployment.driverId = deployment.driverId._id;
        return deployment;
      }
    },

    updateDeploymentStatus: async (_, { id, status }, { user }) => {
      checkAdmin(user);
      const deployment = await AdsDeployment.findById(id);
      if (!deployment) throw new Error('Deployment not found');

      const validStatuses = ['SCHEDULED','RUNNING','PAID','COMPLETED','PAUSED','CANCELLED','REMOVED'];
      if (!validStatuses.includes(status)) throw new Error('Invalid status');

      deployment.currentStatus = status;

      if (status === 'RUNNING' && !deployment.deployedAt) deployment.deployedAt = new Date();
      else if (status === 'COMPLETED' && !deployment.completedAt) deployment.completedAt = new Date();
      else if (status === 'REMOVED' && !deployment.removedAt) {
        deployment.removedAt = new Date();
        deployment.removedBy = user.id;
      }

      await deployment.save();
      await deployment.populate([
        { path: 'adId', populate: { path: 'planId', model: 'AdsPlan' } },
        { path: 'lcdSlots.adId', populate: { path: 'planId', model: 'AdsPlan' } },
        'materialId',
        'driverId',
        'removedBy'
      ]);

      if (deployment.driverId && typeof deployment.driverId === 'object') deployment.driverId = deployment.driverId._id;
      return deployment;
    },

    removeAdsFromLCD: async (_, { materialId, adIds, reason }, { user }) => {
      checkAdmin(user);
      const material = await Material.findById(materialId);
      if (!material) throw new Error('Material not found');
      if (material.materialType.toUpperCase() !== 'LCD') throw new Error('This function is only for LCD materials');

      const result = await AdsDeployment.removeFromLCD(materialId, adIds, user.id, reason);
      return result;
    },

    reassignLCDSlots: async (_, { materialId }, { user }) => {
      checkAdmin(user);
      const material = await Material.findById(materialId);
      if (!material) throw new Error('Material not found');
      if (material.materialType.toUpperCase() !== 'LCD') throw new Error('This function is only for LCD materials');

      const result = await AdsDeployment.reassignLCDSlots(materialId);
      return result;
    },

    updateLCDSlotStatus: async (_, { materialId, adId, status }, { user }) => {
      checkAdmin(user);
      const deployment = await AdsDeployment.findOne({ materialId });
      if (!deployment) throw new Error('No deployment found for this material');

      const slot = deployment.lcdSlots.find(s => s.adId.toString() === adId);
      if (!slot) throw new Error('Ad not found in LCD slots');

      const validStatuses = ['SCHEDULED','RUNNING','COMPLETED','PAUSED','CANCELLED','REMOVED'];
      if (!validStatuses.includes(status)) throw new Error('Invalid status');

      slot.status = status;
      if (status === 'RUNNING' && !slot.deployedAt) slot.deployedAt = new Date();
      else if (status === 'COMPLETED' && !slot.completedAt) slot.completedAt = new Date();
      else if (status === 'REMOVED' && !slot.removedAt) {
        slot.removedAt = new Date();
        slot.removedBy = user.id;
      }

      await deployment.save();
      await deployment.populate([
        { path: 'lcdSlots.adId', populate: { path: 'planId', model: 'AdsPlan' } },
        'materialId',
        'driverId'
      ]);

      if (deployment.driverId && typeof deployment.driverId === 'object') deployment.driverId = deployment.driverId._id;
      return deployment;
    },

    updateFrameTimestamp: async (_, { id }, { user }) => {
      checkAuth(user);
      const deployment = await AdsDeployment.findById(id);
      if (!deployment) throw new Error('Deployment not found');

      if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN' && deployment.driverId.toString() !== user.id) {
        throw new Error('Not authorized to update this deployment');
      }

      deployment.lastFrameUpdate = new Date();
      await deployment.save();

      if (deployment.driverId && typeof deployment.driverId === 'object') deployment.driverId = deployment.driverId._id;
      return deployment;
    },

    deleteDeployment: async (_, { id }, { user }) => {
      checkAdmin(user);
      const deployment = await AdsDeployment.findById(id);
      if (!deployment) throw new Error('Deployment not found');

      if (['RUNNING','COMPLETED'].includes(deployment.currentStatus)) {
        throw new Error('Cannot delete running or completed deployments');
      }

      await AdsDeployment.findByIdAndDelete(id);
      return true;
    }
  }
};

module.exports = adsDeploymentResolvers;

