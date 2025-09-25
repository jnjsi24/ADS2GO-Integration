

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
        .populate({
          path: 'removedBy',
          model: 'User',
          select: 'firstName lastName email'
        })
        .sort({ createdAt: -1 });

      // Process deployments and populate ad data for lcdSlots
      await Promise.all(deployments.map(async (d) => {
        if (d.driverId && typeof d.driverId === 'object') d.driverId = d.driverId._id;
        
        // Handle lcdSlots adId field - keep it as ID string, not populated object
        if (d.lcdSlots && Array.isArray(d.lcdSlots)) {
          await Promise.all(d.lcdSlots.map(async (slot) => {
            // Ensure ad object always exists with safe defaults
            slot.ad = {
              id: '',
              title: 'Unknown Ad',
              description: '',
              adFormat: '',
              mediaFile: ''
            };
            
            if (slot.adId && typeof slot.adId === 'object' && slot.adId._id) {
              // Create the 'ad' field from the populated adId object
              slot.ad = {
                id: slot.adId._id ? slot.adId._id.toString() : '',
                title: slot.adId.title || 'Unknown Ad',
                description: slot.adId.description || '',
                adFormat: slot.adId.adFormat || '',
                mediaFile: slot.adId.mediaFile || ''
              };
              // Keep adId as just the ID string
              slot.adId = slot.adId._id ? slot.adId._id.toString() : '';
            } else if (slot.adId && typeof slot.adId === 'object' && slot.adId.toString) {
              // Handle direct ObjectId case
              slot.ad = {
                id: slot.adId.toString(),
                title: 'Unknown Ad',
                description: '',
                adFormat: '',
                mediaFile: ''
              };
              // Keep adId as just the ID string
              slot.adId = slot.adId.toString();
            } else if (slot.adId && typeof slot.adId === 'string' && slot.adId.trim() !== '') {
              // If adId is already a string, try to fetch the ad
              try {
                const ad = await Ad.findById(slot.adId);
                if (ad) {
                  slot.ad = {
                    id: ad._id.toString(),
                    title: ad.title || 'Unknown Ad',
                    description: ad.description || '',
                    adFormat: ad.adFormat || '',
                    mediaFile: ad.mediaFile || ''
                  };
                } else {
                  slot.ad = {
                    id: slot.adId,
                    title: 'Unknown Ad',
                    description: '',
                    adFormat: '',
                    mediaFile: ''
                  };
                }
              } catch (error) {
                console.error('Error fetching ad for slot:', error);
                slot.ad = {
                  id: slot.adId || '',
                  title: 'Unknown Ad',
                  description: '',
                  adFormat: '',
                  mediaFile: ''
                };
              }
            } else if (slot.adId && slot.adId !== null && slot.adId !== undefined) {
              // Fallback for any other adId type
              slot.ad = {
                id: String(slot.adId),
                title: 'Unknown Ad',
                description: '',
                adFormat: '',
                mediaFile: ''
              };
            }
          }));
        }
      }));

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
        .populate({
          path: 'removedBy',
          model: 'User',
          select: 'firstName lastName email'
        })
        .sort({ startTime: -1 });

      deployments.forEach(d => {
        if (d.driverId && typeof d.driverId === 'object') d.driverId = d.driverId._id;
        
        // Handle lcdSlots adId field - keep it as ID string, not populated object
        if (d.lcdSlots && Array.isArray(d.lcdSlots)) {
          d.lcdSlots.forEach(slot => {
            // Ensure ad object always exists with safe defaults
            slot.ad = {
              id: '',
              title: 'Unknown Ad',
              description: '',
              adFormat: '',
              mediaFile: ''
            };
            
            if (slot.adId && typeof slot.adId === 'object' && slot.adId._id) {
              // Create the 'ad' field from the populated adId object
              slot.ad = {
                id: slot.adId._id ? slot.adId._id.toString() : '',
                title: slot.adId.title || 'Unknown Ad',
                description: slot.adId.description || '',
                adFormat: slot.adId.adFormat || '',
                mediaFile: slot.adId.mediaFile || ''
              };
              // Keep adId as just the ID string
              slot.adId = slot.adId._id ? slot.adId._id.toString() : '';
            } else if (slot.adId && typeof slot.adId === 'string' && slot.adId.trim() !== '') {
              // If adId is already a string, create a minimal ad object
              slot.ad = {
                id: slot.adId,
                title: 'Unknown Ad',
                description: '',
                adFormat: '',
                mediaFile: ''
              };
            } else if (slot.adId && slot.adId !== null && slot.adId !== undefined) {
              // Fallback for any other adId type
              slot.ad = {
                id: String(slot.adId),
                title: 'Unknown Ad',
                description: '',
                adFormat: '',
                mediaFile: ''
              };
            }
          });
        }
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
        .populate({
          path: 'removedBy',
          model: 'User',
          select: 'firstName lastName email'
        })
        .sort({ startTime: -1 });

      deployments.forEach(d => {
        if (d.driverId && typeof d.driverId === 'object') d.driverId = d.driverId._id;
        
        // Handle lcdSlots adId field - keep it as ID string, not populated object
        if (d.lcdSlots && Array.isArray(d.lcdSlots)) {
          d.lcdSlots.forEach(slot => {
            // Ensure ad object always exists with safe defaults
            slot.ad = {
              id: '',
              title: 'Unknown Ad',
              description: '',
              adFormat: '',
              mediaFile: ''
            };
            
            if (slot.adId && typeof slot.adId === 'object' && slot.adId._id) {
              // Create the 'ad' field from the populated adId object
              slot.ad = {
                id: slot.adId._id ? slot.adId._id.toString() : '',
                title: slot.adId.title || 'Unknown Ad',
                description: slot.adId.description || '',
                adFormat: slot.adId.adFormat || '',
                mediaFile: slot.adId.mediaFile || ''
              };
              // Keep adId as just the ID string
              slot.adId = slot.adId._id ? slot.adId._id.toString() : '';
            } else if (slot.adId && typeof slot.adId === 'string' && slot.adId.trim() !== '') {
              // If adId is already a string, create a minimal ad object
              slot.ad = {
                id: slot.adId,
                title: 'Unknown Ad',
                description: '',
                adFormat: '',
                mediaFile: ''
              };
            } else if (slot.adId && slot.adId !== null && slot.adId !== undefined) {
              // Fallback for any other adId type
              slot.ad = {
                id: String(slot.adId),
                title: 'Unknown Ad',
                description: '',
                adFormat: '',
                mediaFile: ''
              };
            }
          });
        }
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
        .populate({
          path: 'removedBy',
          model: 'User',
          select: 'firstName lastName email'
        })
        .sort({ startTime: -1 });

      deployments.forEach(d => {
        if (d.driverId && typeof d.driverId === 'object') d.driverId = d.driverId._id;
        
        // Handle lcdSlots adId field - keep it as ID string, not populated object
        if (d.lcdSlots && Array.isArray(d.lcdSlots)) {
          d.lcdSlots.forEach(slot => {
            // Ensure ad object always exists with safe defaults
            slot.ad = {
              id: '',
              title: 'Unknown Ad',
              description: '',
              adFormat: '',
              mediaFile: ''
            };
            
            if (slot.adId && typeof slot.adId === 'object' && slot.adId._id) {
              // Create the 'ad' field from the populated adId object
              slot.ad = {
                id: slot.adId._id ? slot.adId._id.toString() : '',
                title: slot.adId.title || 'Unknown Ad',
                description: slot.adId.description || '',
                adFormat: slot.adId.adFormat || '',
                mediaFile: slot.adId.mediaFile || ''
              };
              // Keep adId as just the ID string
              slot.adId = slot.adId._id ? slot.adId._id.toString() : '';
            } else if (slot.adId && typeof slot.adId === 'string' && slot.adId.trim() !== '') {
              // If adId is already a string, create a minimal ad object
              slot.ad = {
                id: slot.adId,
                title: 'Unknown Ad',
                description: '',
                adFormat: '',
                mediaFile: ''
              };
            } else if (slot.adId && slot.adId !== null && slot.adId !== undefined) {
              // Fallback for any other adId type
              slot.ad = {
                id: String(slot.adId),
                title: 'Unknown Ad',
                description: '',
                adFormat: '',
                mediaFile: ''
              };
            }
          });
        }
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
        .populate({
          path: 'removedBy',
          model: 'User',
          select: 'firstName lastName email'
        })
        .sort({ startTime: -1 });

      deployments.forEach(d => {
        if (d.driverId && typeof d.driverId === 'object') d.driverId = d.driverId._id;
        
        // Handle lcdSlots adId field - keep it as ID string, not populated object
        if (d.lcdSlots && Array.isArray(d.lcdSlots)) {
          d.lcdSlots.forEach(slot => {
            // Ensure ad object always exists with safe defaults
            slot.ad = {
              id: '',
              title: 'Unknown Ad',
              description: '',
              adFormat: '',
              mediaFile: ''
            };
            
            if (slot.adId && typeof slot.adId === 'object' && slot.adId._id) {
              // Create the 'ad' field from the populated adId object
              slot.ad = {
                id: slot.adId._id ? slot.adId._id.toString() : '',
                title: slot.adId.title || 'Unknown Ad',
                description: slot.adId.description || '',
                adFormat: slot.adId.adFormat || '',
                mediaFile: slot.adId.mediaFile || ''
              };
              // Keep adId as just the ID string
              slot.adId = slot.adId._id ? slot.adId._id.toString() : '';
            } else if (slot.adId && typeof slot.adId === 'object' && slot.adId.toString) {
              // Handle direct ObjectId case
              slot.ad = {
                id: slot.adId.toString(),
                title: 'Unknown Ad',
                description: '',
                adFormat: '',
                mediaFile: ''
              };
              // Keep adId as just the ID string
              slot.adId = slot.adId.toString();
            } else if (slot.adId && typeof slot.adId === 'string' && slot.adId.trim() !== '') {
              // If adId is already a string, create a minimal ad object
              slot.ad = {
                id: slot.adId,
                title: 'Unknown Ad',
                description: '',
                adFormat: '',
                mediaFile: ''
              };
            } else if (slot.adId && slot.adId !== null && slot.adId !== undefined) {
              // Fallback for any other adId type
              slot.ad = {
                id: String(slot.adId),
                title: 'Unknown Ad',
                description: '',
                adFormat: '',
                mediaFile: ''
              };
            }
          });
        }
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
        .populate({
          path: 'removedBy',
          model: 'User',
          select: 'firstName lastName email'
        });

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
        { path: 'removedBy', model: 'User', select: 'firstName lastName email' }
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
  },

  // Field resolvers
  LCDSlot: {
    ad: async (parent) => {
      console.log('🔍 LCDSlot.ad resolver called with parent:', JSON.stringify(parent, null, 2));
      
      // If the ad field is already populated and has an id, return it
      if (parent.ad && parent.ad.id) {
        console.log('✅ Using existing ad field:', parent.ad);
        return parent.ad;
      }
      
      // If adId exists, try to fetch the ad
      if (parent.adId) {
        try {
          console.log('🔍 Fetching ad for adId:', parent.adId);
          const ad = await Ad.findById(parent.adId);
          if (ad) {
            const adData = {
              id: ad._id.toString(),
              title: ad.title || 'Unknown Ad',
              description: ad.description || '',
              adFormat: ad.adFormat || '',
              mediaFile: ad.mediaFile || ''
            };
            console.log('✅ Fetched ad data:', adData);
            return adData;
          } else {
            console.log('❌ Ad not found for adId:', parent.adId);
          }
        } catch (error) {
          console.error('❌ Error fetching ad for LCDSlot:', error);
        }
      } else {
        console.log('❌ No adId found in parent:', parent);
      }
      
      // Return default ad object if nothing else works
      console.log('⚠️ Returning default ad object');
      return {
        id: '',
        title: 'Unknown Ad',
        description: '',
        adFormat: '',
        mediaFile: ''
      };
    }
  }
};

module.exports = adsDeploymentResolvers;

