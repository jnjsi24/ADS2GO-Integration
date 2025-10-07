const DeviceTracking = require('../models/deviceTracking');
const DeviceDataHistoryV2 = require('../models/deviceDataHistoryV2');
const OSMService = require('../services/osmService');

const locationResolvers = {
  Query: {
    /**
     * Get tracking history for a material
     */
    getMaterialTracking: async (_, { materialId, startDate, endDate }) => {
      try {
        const query = { materialId };
        
        if (startDate || endDate) {
          query.date = {};
          if (startDate) query.date.$gte = new Date(startDate);
          if (endDate) query.date.$lte = new Date(endDate);
        }

        const tracking = await DeviceTracking.find(query)
          .sort({ date: 1 });
          
        return tracking;
      } catch (error) {
        console.error('Error getting material tracking:', error);
        throw new Error('Failed to get material tracking');
      }
    },
    
    /**
     * Get current location and status of a material
     */
    getCurrentMaterialStatus: async (_, { materialId }) => {
      try {
        const status = await DeviceTracking.findOne({ materialId })
          .sort({ date: -1 })
          .limit(1);
          
        if (!status) {
          throw new Error('Material not found or no tracking data available');
        }
        
        return status;
      } catch (error) {
        console.error('Error getting material status:', error);
        throw new Error('Failed to get material status');
      }
    }
  },
  
  Mutation: {
    /**
     * Update material location
     */
    updateMaterialLocation: async (_, { materialId, lat, lng, driverId }) => {
      try {
        // Get address from coordinates
        const address = await OSMService.reverseGeocode(lat, lng);
        
        // Find or create DeviceTracking record
        let tracking = await DeviceTracking.findOne({ materialId });
        
        if (!tracking) {
          // Create new tracking entry
          tracking = new DeviceTracking({
            materialId,
            carGroupId: 'UNKNOWN', // This should be provided or looked up
            screenType: 'HEADDRESS', // This should be determined based on material type
            currentLocation: {
              type: 'Point',
              coordinates: [lng, lat]
            },
            address,
            lastSeen: new Date()
          });
        } else {
          // Update existing tracking
          tracking.currentLocation = {
            type: 'Point',
            coordinates: [lng, lat]
          };
          tracking.address = address;
          tracking.lastSeen = new Date();
        }
        
        await tracking.save();
        
        return {
          success: true,
          message: 'Location updated successfully',
          tracking
        };
      } catch (error) {
        console.error('Error updating material location:', error);
        return {
          success: false,
          message: error.message || 'Failed to update material location',
          tracking: null
        };
      }
    },
    
    /**
     * Get route between two points
     */
    getRoute: async (_, { origin, destination }) => {
      try {
        const route = await OSMService.getRoute(origin, destination);
        return {
          success: true,
          route
        };
      } catch (error) {
        console.error('Error getting route:', error);
        return {
          success: false,
          message: error.message || 'Failed to get route',
          route: null
        };
      }
    }
  }
};

module.exports = locationResolvers;
