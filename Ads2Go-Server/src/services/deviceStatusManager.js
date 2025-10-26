const logger = require('../utils/logger');

/**
 * DeviceStatusManager - Centralized source of truth for device online/offline status
 * Implements Option 3: Hybrid with Clear Priority
 * 
 * Priority Order:
 * 1. WebSocket connection (highest priority, real-time)
 * 2. Database status (medium priority, 30-second fallback)
 * 3. Timeout/offline (lowest priority, default)
 */

class DeviceStatusManager {
  constructor() {
    this.webSocketConnections = new Map(); // deviceId -> { ws, lastSeen, source }
    this.databaseStatus = new Map();       // deviceId -> { isOnline, lastSeen, source }
    this.statusCache = new Map();          // deviceId -> { isOnline, source, timestamp, confidence }
    this.cacheTimeout = 2000; // 2 seconds cache timeout for faster updates
    this.databaseFallbackTimeout = 15; // 15 seconds database fallback for faster detection
  }

  /**
   * Set WebSocket connection status
   * @param {string} deviceId - Device identifier
   * @param {boolean} isConnected - Whether WebSocket is connected
   * @param {Date} lastSeen - Last seen timestamp
   */
  setWebSocketStatus(deviceId, isConnected, lastSeen = new Date()) {
    if (isConnected) {
      this.webSocketConnections.set(deviceId, { 
        isConnected: true, 
        lastSeen,
        source: 'websocket'
      });
    } else {
      this.webSocketConnections.delete(deviceId);
    }
    
    this.updateCachedStatus(deviceId);
  }

  /**
   * Set database status
   * @param {string} deviceId - Device identifier
   * @param {boolean} isOnline - Whether device is online in database
   * @param {Date} lastSeen - Last seen timestamp
   */
  setDatabaseStatus(deviceId, isOnline, lastSeen = new Date()) {
    this.databaseStatus.set(deviceId, { 
      isOnline, 
      lastSeen,
      source: 'database'
    });
    
    this.updateCachedStatus(deviceId);
  }

  /**
   * Get device status with clear priority
   * @param {string} deviceId - Device identifier
   * @returns {Object} Status object with isOnline, source, lastSeen, confidence
   */
  getDeviceStatus(deviceId) {
    // Handle null or undefined deviceId
    if (!deviceId) {
      return {
        isOnline: false,
        source: 'invalid',
        lastSeen: null,
        confidence: 'low'
      };
    }
    
    const cached = this.statusCache.get(deviceId);
    
    // Return cached status if recent (within cache timeout)
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      return {
        isOnline: cached.isOnline,
        source: cached.source,
        lastSeen: cached.lastSeen,
        confidence: cached.confidence
      };
    }

    return this.calculateDeviceStatus(deviceId);
  }

  /**
   * Calculate device status with clear priority order
   * @param {string} deviceId - Device identifier
   * @returns {Object} Status object
   */
  calculateDeviceStatus(deviceId) {
    const now = Date.now();
    
    // Priority 1: Active WebSocket connection (highest priority)
    const wsStatus = this.webSocketConnections.get(deviceId);
    if (wsStatus && wsStatus.isConnected) {
      const status = { 
        isOnline: true, 
        source: 'websocket',
        lastSeen: wsStatus.lastSeen,
        confidence: 'high'
      };
      this.statusCache.set(deviceId, { ...status, timestamp: now });
      return status;
    }

    // Priority 2: Recent database activity (15 seconds fallback)
    const dbStatus = this.databaseStatus.get(deviceId);
    if (dbStatus && dbStatus.isOnline) {
      // Ensure lastSeen is a valid Date
      const lastSeenTime = dbStatus.lastSeen instanceof Date ? dbStatus.lastSeen.getTime() : new Date(dbStatus.lastSeen).getTime();
      if (!isNaN(lastSeenTime)) {
        const timeSinceLastSeen = (now - lastSeenTime) / 1000;
        if (timeSinceLastSeen <= this.databaseFallbackTimeout) {
          const status = { 
            isOnline: true, 
            source: 'database',
            lastSeen: dbStatus.lastSeen,
            confidence: 'medium'
          };
          this.statusCache.set(deviceId, { ...status, timestamp: now });
          return status;
        }
      }
    }

    // Priority 3: Default offline
    const status = { 
      isOnline: false, 
      source: 'timeout',
      lastSeen: null,
      confidence: 'low'
    };
    this.statusCache.set(deviceId, { ...status, timestamp: now });
    return status;
  }

  /**
   * Update cached status for a device
   * @param {string} deviceId - Device identifier
   */
  updateCachedStatus(deviceId) {
    const status = this.calculateDeviceStatus(deviceId);
    this.statusCache.set(deviceId, { ...status, timestamp: Date.now() });
  }

  /**
   * Get all device statuses
   * @returns {Array} Array of device status objects
   */
  getAllDeviceStatuses() {
    const allDevices = new Set([
      ...this.webSocketConnections.keys(),
      ...this.databaseStatus.keys()
    ]);

    return Array.from(allDevices).map(deviceId => ({
      deviceId,
      ...this.getDeviceStatus(deviceId)
    }));
  }

  /**
   * Check if a device has an active WebSocket connection
   * @param {string} deviceId - Device identifier
   * @returns {boolean} Whether device has active WebSocket
   */
  hasActiveWebSocket(deviceId) {
    const wsStatus = this.webSocketConnections.get(deviceId);
    return wsStatus && wsStatus.isConnected;
  }

  /**
   * Get status summary for debugging
   * @returns {Object} Summary of all device statuses
   */
  getStatusSummary() {
    const allStatuses = this.getAllDeviceStatuses();
    const summary = {
      total: allStatuses.length,
      online: allStatuses.filter(s => s.isOnline).length,
      offline: allStatuses.filter(s => !s.isOnline).length,
      bySource: {
        websocket: allStatuses.filter(s => s.source === 'websocket').length,
        database: allStatuses.filter(s => s.source === 'database').length,
        timeout: allStatuses.filter(s => s.source === 'timeout').length
      },
      byConfidence: {
        high: allStatuses.filter(s => s.confidence === 'high').length,
        medium: allStatuses.filter(s => s.confidence === 'medium').length,
        low: allStatuses.filter(s => s.confidence === 'low').length
      }
    };
    
    return summary;
  }

  /**
   * Clear all cached data (useful for testing or cleanup)
   */
  clearCache() {
    this.webSocketConnections.clear();
    this.databaseStatus.clear();
    this.statusCache.clear();
  }
}

// Export singleton instance
module.exports = new DeviceStatusManager();
