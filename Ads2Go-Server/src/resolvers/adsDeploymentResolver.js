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
      return await AdsDeployment.find({})
        .populate('adId')
        .populate('materialId')
        .populate('driverId')
        .populate('removedBy')
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
        .populate('removedBy')
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
        .populate('removedBy')
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
        .populate('removedBy')
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
        .populate('removedBy')
        .sort({ startTime: -1 });
    },

    getDeploymentById: async (_, { id }, { user }) => {
      checkAuth(user);
      
      const deployment = await AdsDeployment.findById(id)
        .populate('adId')
        .populate('materialId')
        .populate('driverId')
        .populate('removedBy');

      if (!deployment) throw new Error('Deployment not found');

      // Check authorization
      if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
        const ad = await Ad.findById(deployment.adId);
        if (ad.userId.toString() !== user.id && deployment.driverId.toString() !== user.id) {
          throw new Error('Not authorized to view this deployment');
        }
      }

      return deployment;
    },

    getLCDDeployments: async (_, { materialId }, { user }) => {
      checkAuth(user);
      
      // Verify material exists and is LCD type
      const material = await Material.findById(materialId);
      if (!material) throw new Error('Material not found');
      
      // Check materialType field instead of type
      if (material.materialType.toString().toUpperCase() !== 'LCD') throw new Error(`This query is only for LCD materials. Found materialType: ${material.materialType}`);

      return await AdsDeployment.getLCDDeployments(materialId);
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

      // Check material type and handle LCD slot assignment
      const material = await Material.findById(materialId);
      if (!material) throw new Error('Material not found');

      let displaySlot = null;
      // Check if materialType is LCD (case-insensitive)
      if (material.materialType && material.materialType.toString().toUpperCase() === 'LCD') {
        displaySlot = await AdsDeployment.getNextAvailableSlot(materialId);
        if (!displaySlot) {
          throw new Error('All LCD slots (1-5) are occupied. Use override function to remove ads first.');
        }
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
        deployedAt,
        displaySlot
      });
    
      await deployment.save();
      await deployment.populate(['adId', 'materialId', 'driverId', 'removedBy']);
    
      return deployment;
    },

    updateDeploymentStatus: async (_, { id, status }, { user }) => {
      checkAdmin(user);

      const deployment = await AdsDeployment.findById(id);
      if (!deployment) throw new Error('Deployment not found');

      const validStatuses = ['SCHEDULED', 'RUNNING', 'PAID','COMPLETED', 'PAUSED', 'CANCELLED', 'REMOVED'];
      if (!validStatuses.includes(status)) {
        throw new Error('Invalid status');
      }

      deployment.currentStatus = status;

      // Set timestamps based on status
      if (status === 'RUNNING' && !deployment.deployedAt) {
        deployment.deployedAt = new Date();
      } else if (status === 'COMPLETED' && !deployment.completedAt) {
        deployment.completedAt = new Date();
      } else if (status === 'REMOVED' && !deployment.removedAt) {
        deployment.removedAt = new Date();
        deployment.removedBy = user.id;
      }

      await deployment.save();
      await deployment.populate(['adId', 'materialId', 'driverId', 'removedBy']);

      return deployment;
    },

    removeAdsFromLCD: async (_, { materialId, deploymentIds, reason }, { user }) => {
      checkAdmin(user); // Only admin can override and remove ads

      // Verify material exists and is LCD type
      const material = await Material.findById(materialId);
      if (!material) throw new Error('Material not found');
      if (material.materialType.toString().toUpperCase() !== 'LCD') throw new Error('This function is only for LCD materials');

      // Verify all deployments exist and belong to this material
      const deployments = await AdsDeployment.find({
        _id: { $in: deploymentIds },
        materialId,
        currentStatus: { $in: ['SCHEDULED', 'RUNNING'] }
      });

      if (deployments.length !== deploymentIds.length) {
        throw new Error('Some deployments not found or already inactive');
      }

      // Update all deployments to REMOVED status
      const updateResult = await AdsDeployment.updateMany(
        { _id: { $in: deploymentIds } },
        {
          $set: {
            currentStatus: 'REMOVED',
            removedAt: new Date(),
            removedBy: user.id,
            removalReason: reason || 'Admin override'
          }
        }
      );

      // Return updated deployments
      const updatedDeployments = await AdsDeployment.find({
        _id: { $in: deploymentIds }
      })
      .populate(['adId', 'materialId', 'driverId', 'removedBy']);

      return {
        success: true,
        message: `Successfully removed ${updateResult.modifiedCount} ads from LCD`,
        removedDeployments: updatedDeployments,
        availableSlots: await AdsDeployment.getNextAvailableSlot(materialId) ? 
          Array.from({length: 5}, (_, i) => i + 1).filter(async slot => {
            const occupied = await AdsDeployment.findOne({
              materialId,
              displaySlot: slot,
              currentStatus: { $in: ['SCHEDULED', 'RUNNING'] }
            });
            return !occupied;
          }) : []
      };
    },

    reassignLCDSlots: async (_, { materialId }, { user }) => {
      checkAdmin(user);

      // Verify material exists and is LCD type
      const material = await Material.findById(materialId);
      if (!material) throw new Error('Material not found');
      if (material.materialType.toString().toUpperCase() !== 'LCD') throw new Error('This function is only for LCD materials');

      // Get all active deployments for this LCD
      const activeDeployments = await AdsDeployment.find({
        materialId,
        currentStatus: { $in: ['SCHEDULED', 'RUNNING'] }
      }).sort({ createdAt: 1 }); // Oldest first

      // Reassign slots sequentially
      const updates = [];
      for (let i = 0; i < activeDeployments.length && i < 5; i++) {
        if (activeDeployments[i].displaySlot !== i + 1) {
          await AdsDeployment.findByIdAndUpdate(
            activeDeployments[i]._id,
            { displaySlot: i + 1 }
          );
          updates.push({
            deploymentId: activeDeployments[i]._id,
            oldSlot: activeDeployments[i].displaySlot,
            newSlot: i + 1
          });
        }
      }

      return {
        success: true,
        message: `Reassigned ${updates.length} LCD slots`,
        updates
      };
    },

    updateDisplaySlot: async (_, { deploymentId, slot }, { user }) => {
      checkAdmin(user);

      const deployment = await AdsDeployment.findById(deploymentId);
      if (!deployment) throw new Error('Deployment not found');

      // Verify material is LCD
      const material = await Material.findById(deployment.materialId);
      if (!material || material.materialType.toString().toUpperCase() !== 'LCD') {
        throw new Error('Can only set display slots for LCD materials');
      }

      // Check if slot is available (1-5)
      if (slot < 1 || slot > 5) {
        throw new Error('Display slot must be between 1 and 5');
      }

      // Check if slot is already occupied by another deployment
      const existingInSlot = await AdsDeployment.findOne({
        materialId: deployment.materialId,
        displaySlot: slot,
        currentStatus: { $in: ['SCHEDULED', 'RUNNING'] },
        _id: { $ne: deploymentId }
      });

      if (existingInSlot) {
        throw new Error(`Slot ${slot} is already occupied by deployment ${existingInSlot.adDeploymentId}`);
      }

      deployment.displaySlot = slot;
      await deployment.save();
      await deployment.populate(['adId', 'materialId', 'driverId', 'removedBy']);

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