// adsDeploymentResolver.js

const AdsDeployment = require('../models/adsDeployment');
const { v4: uuidv4 } = require('uuid');
const Ad = require('../models/Ad');
const Payment = require('../models/Payment');
const { checkAuth, checkAdmin } = require('../middleware/auth');

const adsDeploymentResolvers = {
  Query: {
    getAllDeployments: async (_, __, { user }) => {
      checkAdmin(user);
      return await AdsDeployment.find({})
        .populate('adId')
        .populate('materialId')
        .populate('driverId')
        .sort({ createdAt: -1 });
    },

    getDeploymentsByDriver: async (_, { driverId }, { user }) => {
      checkAuth(user);
      
      // Allow drivers to see their own deployments or admin to see any
      if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN' && user.id !== driverId) {
        throw new Error('Not authorized to view these deployments');
      }

      return await AdsDeployment.find({ driverId })
        .populate('adId')
        .populate('materialId')
        .sort({ startTime: -1 });
    },

    

    getDeploymentsByAd: async (_, { adId }, { user }) => {
      checkAuth(user);
      
      const ad = await Ad.findById(adId);
      if (!ad) throw new Error('Ad not found');

      // Allow ad owner or admin to view deployments
      if (ad.userId.toString() !== user.id && user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
        throw new Error('Not authorized to view these deployments');
      }

      return await AdsDeployment.find({ adId })
        .populate('materialId')
        .populate('driverId')
        .sort({ startTime: -1 });
    },

    getMyAdDeployments: async (_, __, { user }) => {
      checkAuth(user);
      
      // Find all ads owned by user
      const userAds = await Ad.find({ userId: user.id });
      const adIds = userAds.map(ad => ad._id);

      return await AdsDeployment.find({ adId: { $in: adIds } })
        .populate('adId')
        .populate('materialId')
        .populate('driverId')
        .sort({ startTime: -1 });
    },

    getActiveDeployments: async (_, __, { user }) => {
      checkAdmin(user);
      
      const now = new Date();
      return await AdsDeployment.find({
        currentStatus: 'RUNNING',
        startTime: { $lte: now },
        endTime: { $gte: now }
      })
        .populate('adId')
        .populate('materialId')
        .populate('driverId')
        .sort({ startTime: -1 });
    },

    getDeploymentById: async (_, { id }, { user }) => {
      checkAuth(user);
      
      const deployment = await AdsDeployment.findById(id)
        .populate('adId')
        .populate('materialId')
        .populate('driverId');

      if (!deployment) throw new Error('Deployment not found');

      // Check authorization
      if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
        const ad = await Ad.findById(deployment.adId);
        if (ad.userId.toString() !== user.id && deployment.driverId.toString() !== user.id) {
          throw new Error('Not authorized to view this deployment');
        }
      }

      return deployment;
    }
  },

  Mutation: {
    createDeployment: async (_, { input }, { user }) => {
        checkAdmin(user); // Only admin can create deployments
      
        const { adId, materialId, driverId, startTime, endTime } = input;
      
        // Verify the ad exists
        const ad = await Ad.findById(adId);
        if (!ad) throw new Error('Ad not found');
        if (ad.status !== 'APPROVED') throw new Error('Ad must be approved before deployment');
      
        // Check payment
        const payment = await Payment.findOne({ adsId: adId, paymentStatus: 'PAID' });
      
        const deployStartTime = new Date(startTime);
        const deployEndTime = new Date(endTime);
      
        if (deployStartTime >= deployEndTime) {
          throw new Error('End time must be after start time');
        }
      
        // If no payment, mark as FAILED immediately
        let currentStatus;
        let deployedAt = null;
      
        if (!payment) {
          currentStatus = 'FAILED';
        } else {
          currentStatus = deployStartTime <= new Date() ? 'RUNNING' : 'SCHEDULED';
          deployedAt = currentStatus === 'RUNNING' ? new Date() : null;
        }
      
        const deployment = new AdsDeployment({
          adDeploymentId: uuidv4(),
          adId,
          materialId,
          driverId,
          startTime: deployStartTime,
          endTime: deployEndTime,
          currentStatus,
          deployedAt
        });
      
        await deployment.save();
        await deployment.populate(['adId', 'materialId', 'driverId']);
      
        return deployment;
      },
      

    updateDeploymentStatus: async (_, { id, status }, { user }) => {
      checkAdmin(user);

      const deployment = await AdsDeployment.findById(id);
      if (!deployment) throw new Error('Deployment not found');

      const validStatuses = ['SCHEDULED', 'RUNNING', 'COMPLETED', 'PAUSED', 'CANCELLED'];
      if (!validStatuses.includes(status)) {
        throw new Error('Invalid status');
      }

      deployment.currentStatus = status;

      // Set timestamps based on status
      if (status === 'RUNNING' && !deployment.deployedAt) {
        deployment.deployedAt = new Date();
      } else if (status === 'COMPLETED' && !deployment.completedAt) {
        deployment.completedAt = new Date();
      }

      await deployment.save();
      await deployment.populate(['adId', 'materialId', 'driverId']);

      return deployment;
    },

    updateFrameTimestamp: async (_, { id }, { user }) => {
      checkAuth(user); // Drivers can update frame timestamp for their deployments

      const deployment = await AdsDeployment.findById(id);
      if (!deployment) throw new Error('Deployment not found');

      // Check if user is the driver or admin
      if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN' && deployment.driverId.toString() !== user.id) {
        throw new Error('Not authorized to update this deployment');
      }

      deployment.lastFrameUpdate = new Date();
      await deployment.save();

      return deployment;
    },

    deleteDeployment: async (_, { id }, { user }) => {
      checkAdmin(user);

      const deployment = await AdsDeployment.findById(id);
      if (!deployment) throw new Error('Deployment not found');

      // Only allow deletion of scheduled or cancelled deployments
      if (['RUNNING', 'COMPLETED'].includes(deployment.currentStatus)) {
        throw new Error('Cannot delete running or completed deployments');
      }

      await AdsDeployment.findByIdAndDelete(id);
      return true;
    }
  }
};

module.exports = adsDeploymentResolvers;