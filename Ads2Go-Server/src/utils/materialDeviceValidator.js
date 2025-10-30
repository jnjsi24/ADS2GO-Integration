const Tablet = require('../models/Tablet');
const DeviceTracking = require('../models/deviceTracking');

/**
 * Validates if a material has at least one registered and active device
 * 
 * Checks:
 * 1. Tablet record exists
 * 2. At least one slot has a deviceId registered
 * 3. DeviceTracking record exists
 * 4. DeviceTracking has at least one non-empty slot
 * 
 * @param {String} materialId - The material ID to validate (e.g., 'DGL-HEADDRESS-CAR-001')
 * @returns {Object} - { hasDevice: boolean, reason: string, details: object }
 */
async function validateMaterialHasDevice(materialId) {
  try {
    // 1. Check if Tablet record exists
    const tablet = await Tablet.findOne({ materialId });
    
    if (!tablet) {
      return {
        hasDevice: false,
        reason: 'No tablet registration record found',
        details: { materialId }
      };
    }
    
    // 2. Check if at least one slot has a deviceId
    const hasRegisteredDevice = tablet.tablets.some(t => t.deviceId && t.deviceId !== '');
    
    if (!hasRegisteredDevice) {
      return {
        hasDevice: false,
        reason: 'No device registered in any slot',
        details: { 
          materialId,
          slot1: tablet.tablets[0]?.deviceId || 'EMPTY',
          slot2: tablet.tablets[1]?.deviceId || 'EMPTY'
        }
      };
    }
    
    // 3. Check if DeviceTracking record exists
    const deviceTracking = await DeviceTracking.findByMaterialId(materialId);
    
    if (!deviceTracking) {
      return {
        hasDevice: false,
        reason: 'No device tracking record found (device never connected)',
        details: { materialId }
      };
    }
    
    // 4. Check if DeviceTracking has at least one non-empty slot
    const hasActiveSlot = deviceTracking.slots && deviceTracking.slots.some(s => s.deviceId && s.deviceId !== '');
    
    if (!hasActiveSlot) {
      return {
        hasDevice: false,
        reason: 'Device tracking slots are empty (device disconnected or inactive)',
        details: { 
          materialId,
          trackingSlots: deviceTracking.slots.map(s => ({
            slotNumber: s.slotNumber,
            deviceId: s.deviceId || 'EMPTY'
          }))
        }
      };
    }
    
    // All checks passed!
    return {
      hasDevice: true,
      reason: 'Material has active registered device',
      details: {
        materialId,
        registeredDevices: tablet.tablets
          .filter(t => t.deviceId && t.deviceId !== '')
          .map(t => ({
            slotNumber: t.tabletNumber,
            deviceId: t.deviceId
          })),
        isOnline: deviceTracking.isOnline,
        lastSeen: deviceTracking.lastSeen
      }
    };
    
  } catch (error) {
    console.error(`❌ Error validating material ${materialId}:`, error.message);
    return {
      hasDevice: false,
      reason: `Validation error: ${error.message}`,
      details: { materialId, error: error.message }
    };
  }
}

/**
 * Validates multiple materials in parallel
 * 
 * @param {Array<String>} materialIds - Array of material IDs to validate
 * @returns {Map<String, Object>} - Map of materialId -> validation result
 */
async function validateMultipleMaterials(materialIds) {
  const validationPromises = materialIds.map(async (materialId) => {
    const result = await validateMaterialHasDevice(materialId);
    return { materialId, result };
  });
  
  const validations = await Promise.all(validationPromises);
  
  const validationMap = new Map();
  validations.forEach(({ materialId, result }) => {
    validationMap.set(materialId, result);
  });
  
  return validationMap;
}

module.exports = {
  validateMaterialHasDevice,
  validateMultipleMaterials
};

