

// adsDeploymentResolver.js

const AdsDeployment = require('../models/adsDeployment');
const Material = require('../models/Material');
const { v4: uuidv4 } = require('uuid');
const Ad = require('../models/Ad');
const Payment = require('../models/Payment');
const { checkAuth, checkAdmin } = require('../middleware/auth');

/**
 * Helper function to safely convert any date value to ISO string
 * Handles: Date objects, timestamps (number/string), and ISO strings
 */
function toISOString(value) {
  if (!value) return null;
  
  // If already a Date object, convert to ISO
  if (value instanceof Date) {
    return value.toISOString();
  }
  
  // If it's a number or numeric string (timestamp), convert to Date first
  if (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) {
    const timestamp = typeof value === 'string' ? parseInt(value, 10) : value;
    return new Date(timestamp).toISOString();
  }
  
  // If it's already an ISO string, return as-is
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return value;
  }
  
  // Fallback: try to create a Date and convert
  try {
    return new Date(value).toISOString();
  } catch (error) {
    console.error('❌ Failed to convert date:', value, error);
    return null;
  }
}

const adsDeploymentResolvers = {
  Query: {
    getAllDeployments: async (_, __, { user }) => {
      checkAdmin(user);
      const deployments = await AdsDeployment.find({})
        .populate({
          path: 'adId',
        })
        .populate({
          path: 'lcdSlots.adId',
        })
        .populate('materialId')
        .populate('driverId')
        .populate({
          path: 'removedBy',
          model: 'User',
          select: 'firstName lastName email'
        })
        .sort({ createdAt: -1 });

      // Convert to plain objects to ensure date transformations stick
      const plainDeployments = deployments.map(d => {
        const obj = d.toObject();
        // Add id field (virtual field from Mongoose)
        obj.id = d._id.toString();
        return obj;
      });
      
      // Process deployments and populate ad data for lcdSlots
      await Promise.all(plainDeployments.map(async (d) => {
        // ✅ Ensure dates are properly formatted as ISO strings
        d.createdAt = toISOString(d.createdAt);
        d.updatedAt = toISOString(d.updatedAt);
        
        if (d.driverId && typeof d.driverId === 'object') d.driverId = d.driverId._id;
        
        // Handle lcdSlots adId field - keep it as ID string, not populated object
        if (d.lcdSlots && Array.isArray(d.lcdSlots)) {
          await Promise.all(d.lcdSlots.map(async (slot) => {
            // Add id field for each slot (from _id)
            if (slot._id) {
              slot.id = slot._id.toString();
            }
            
            // ✅ Ensure slot dates are properly formatted
            slot.startTime = toISOString(slot.startTime);
            slot.endTime = toISOString(slot.endTime);
            slot.deployedAt = toISOString(slot.deployedAt);
            slot.completedAt = toISOString(slot.completedAt);
            slot.removedAt = toISOString(slot.removedAt);
            
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
            } else {
              // slot.adId is null or undefined - set to empty string to match schema requirement
              slot.adId = '';
            }
          }));
        }
      }));

      return plainDeployments;
    },

    getDeploymentsByDriver: async (_, { driverId }, { user }) => {
      checkAuth(user);
      if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN' && user.id !== driverId) {
        throw new Error('Not authorized to view these deployments');
      }

      const deployments = await AdsDeployment.find({ driverId })
        .populate({
          path: 'adId',
        })
        .populate({
          path: 'lcdSlots.adId',
        })
        .populate('materialId')
        .populate({
          path: 'removedBy',
          model: 'User',
          select: 'firstName lastName email'
        })
        .sort({ startTime: -1 });

      // Convert to plain objects to ensure date transformations stick
      const plainDeployments = deployments.map(d => {
        const obj = d.toObject();
        // Add id field (virtual field from Mongoose)
        obj.id = d._id.toString();
        return obj;
      });
      
      plainDeployments.forEach(d => {
        // ✅ Ensure dates are properly formatted
        d.createdAt = toISOString(d.createdAt);
        d.updatedAt = toISOString(d.updatedAt);
        
        if (d.driverId && typeof d.driverId === 'object') d.driverId = d.driverId._id;
        
        // Handle lcdSlots adId field - keep it as ID string, not populated object
        if (d.lcdSlots && Array.isArray(d.lcdSlots)) {
          d.lcdSlots.forEach(slot => {
            // Add id field for each slot (from _id)
            if (slot._id) {
              slot.id = slot._id.toString();
            }
            
            // ✅ Ensure slot dates are properly formatted
            slot.deployedAt = toISOString(slot.deployedAt);
            slot.completedAt = toISOString(slot.completedAt);
            slot.removedAt = toISOString(slot.removedAt);
            
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

      return plainDeployments;
    },

    getDeploymentsByAd: async (_, { adId }, { user }) => {
      checkAuth(user);
      const ad = await Ad.findById(adId);
      if (!ad) throw new Error('Ad not found');
      if (ad.userId.toString() !== user.id && user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
        throw new Error('Not authorized to view these deployments');
      }

      const deployments = await AdsDeployment.find({
        $or: [{ adId }, { 'lcdSlots.adId': adId }]
      })
        .populate({
          path: 'adId',
        })
        .populate({
          path: 'lcdSlots.adId',
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
        // ✅ Ensure dates are properly formatted
        d.createdAt = toISOString(d.createdAt);
        d.updatedAt = toISOString(d.updatedAt);
        
        if (d.driverId && typeof d.driverId === 'object') d.driverId = d.driverId._id;
        
        // Handle lcdSlots adId field - keep it as ID string, not populated object
        if (d.lcdSlots && Array.isArray(d.lcdSlots)) {
          d.lcdSlots.forEach(slot => {
            // ✅ Ensure slot dates are properly formatted
            slot.deployedAt = toISOString(slot.deployedAt);
            slot.completedAt = toISOString(slot.completedAt);
            slot.removedAt = toISOString(slot.removedAt);
            
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
        })
        .populate({
          path: 'lcdSlots.adId',
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
        // ✅ Ensure dates are properly formatted
        d.createdAt = toISOString(d.createdAt);
        d.updatedAt = toISOString(d.updatedAt);
        
        if (d.driverId && typeof d.driverId === 'object') d.driverId = d.driverId._id;
        
        // Handle lcdSlots adId field - keep it as ID string, not populated object
        if (d.lcdSlots && Array.isArray(d.lcdSlots)) {
          d.lcdSlots.forEach(slot => {
            // ✅ Ensure slot dates are properly formatted
            slot.deployedAt = toISOString(slot.deployedAt);
            slot.completedAt = toISOString(slot.completedAt);
            slot.removedAt = toISOString(slot.removedAt);
            
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
        })
        .populate({
          path: 'lcdSlots.adId',
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
        // ✅ Ensure dates are properly formatted
        d.createdAt = toISOString(d.createdAt);
        d.updatedAt = toISOString(d.updatedAt);
        
        if (d.driverId && typeof d.driverId === 'object') d.driverId = d.driverId._id;
        
        // Handle lcdSlots adId field - keep it as ID string, not populated object
        if (d.lcdSlots && Array.isArray(d.lcdSlots)) {
          d.lcdSlots.forEach(slot => {
            // ✅ Ensure slot dates are properly formatted
            slot.deployedAt = toISOString(slot.deployedAt);
            slot.completedAt = toISOString(slot.completedAt);
            slot.removedAt = toISOString(slot.removedAt);
            
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
        })
        .populate({
          path: 'lcdSlots.adId',
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
    },

    // Fetch deployment document by STRING materialId (e.g., DGL-HEADDRESS-CAR-007)
    getDeploymentsByMaterialIdString: async (_, { materialId }, { user }) => {
      checkAuth(user);
      // Single deployment doc per materialId; includes lcdSlots for HEADDRESS/LCD
      const deploymentDoc = await AdsDeployment.findOne({ materialId })
        .populate('adId')
        .populate('lcdSlots.adId')
        .populate('driverId');

      if (!deploymentDoc) return null;

      // Convert to plain object to ensure transformations stick
      const deployment = deploymentDoc.toObject();
      
      // Add id field (from _id)
      deployment.id = deploymentDoc._id.toString();

      // Normalize driverId to string id if populated
      if (deployment.driverId && typeof deployment.driverId === 'object') {
        deployment.driverId = deployment.driverId._id;
      }

      // Ensure each slot exposes a minimal `ad` object even if not fully populated
      if (deployment.lcdSlots && Array.isArray(deployment.lcdSlots)) {
        for (const slot of deployment.lcdSlots) {
          if (!slot) continue;
          
          // Format slot dates
          if (slot.deployedAt) {
            slot.deployedAt = toISOString(slot.deployedAt);
          }
          if (slot.completedAt) {
            slot.completedAt = toISOString(slot.completedAt);
          }
          if (slot.removedAt) {
            slot.removedAt = toISOString(slot.removedAt);
          }
          if (slot.startTime) {
            slot.startTime = toISOString(slot.startTime);
          }
          if (slot.endTime) {
            slot.endTime = toISOString(slot.endTime);
          }
          
          // Add id field for slot
          if (slot._id) {
            slot.id = slot._id.toString();
          }
          
          // Default
          slot.ad = slot.ad || { id: '', title: 'Unknown Ad', description: '', adFormat: '', mediaFile: '' };
          if (slot.adId && typeof slot.adId === 'object' && slot.adId._id) {
            slot.ad = {
              id: slot.adId._id ? slot.adId._id.toString() : '',
              title: slot.adId.title || 'Unknown Ad',
              description: slot.adId.description || '',
              adFormat: slot.adId.adFormat || '',
              mediaFile: slot.adId.mediaFile || '',
              startTime: slot.adId.startTime ? toISOString(slot.adId.startTime) : null,
              endTime: slot.adId.endTime ? toISOString(slot.adId.endTime) : null,
              createdAt: slot.adId.createdAt ? toISOString(slot.adId.createdAt) : null
            };
            slot.adId = slot.adId._id ? slot.adId._id.toString() : '';
          }
        }
      }
      
      // Format deployment dates
      if (deployment.createdAt) {
        deployment.createdAt = toISOString(deployment.createdAt);
      }
      if (deployment.updatedAt) {
        deployment.updatedAt = toISOString(deployment.updatedAt);
      }

      return deployment;
    }
  },

  Mutation: {
    createDeployment: async (_, { input }, { user }) => {
      checkAdmin(user);
      const { adId, materialId, driverId, startTime, endTime } = input;

      const ad = await Ad.findById(adId);
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
          'lcdSlots.adId',
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
          'adId',
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
        'adId',
        'lcdSlots.adId',
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
        'lcdSlots.adId',
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
      
      // Check if already archived
      if (deployment.isArchived) {
        throw new Error('Deployment is already archived');
      }

      if (['RUNNING','COMPLETED'].includes(deployment.currentStatus)) {
        throw new Error('Cannot delete running or completed deployments');
      }
      
      console.log(`🗑️ Archiving deployment: ${id} - 30-day deferred deletion`);
      
      // Soft delete: Mark as archived with 30-day deletion schedule
      const now = new Date();
      const deletionDate = new Date(now);
      deletionDate.setDate(deletionDate.getDate() + 30); // 30 days from now
      
      deployment.isArchived = true;
      deployment.archivedAt = now;
      deployment.scheduledDeletionDate = deletionDate;
      
      await deployment.save();
      
      console.log(`✅ Deployment ${id} archived successfully. Scheduled for permanent deletion on: ${deletionDate.toISOString()}`);
      
      return true;
    },

    restoreDeployment: async (_, { id }, { user }) => {
      checkAdmin(user);
      const deployment = await AdsDeployment.findById(id);
      if (!deployment) throw new Error('Deployment not found');
      
      if (!deployment.isArchived) {
        throw new Error('Deployment is not archived');
      }
      
      console.log(`✅ Restoring deployment: ${id}`);
      
      deployment.isArchived = false;
      deployment.archivedAt = null;
      deployment.scheduledDeletionDate = null;
      
      await deployment.save();
      
      console.log(`✅ Deployment ${id} restored successfully`);
      
      return true;
    }
  },

  // Field resolvers
  LCDSlot: {
    ad: async (parent) => {
      // If the ad field is already populated and has an id, return it
      if (parent.ad && parent.ad._id) {
        return parent.ad; // Return the fully populated ad object
      }
      
      // If adId exists, try to fetch the ad
      if (parent.adId) {
        try {
          const ad = await Ad.findById(parent.adId);
          if (ad) {
            // Return the full ad object with all fields
            return ad;
          }
        } catch (error) {
          console.error('Error fetching ad for LCDSlot:', error);
        }
      }
      
      // Return null if ad doesn't exist (GraphQL schema allows this)
      return null;
    }
  }
};

module.exports = adsDeploymentResolvers;

