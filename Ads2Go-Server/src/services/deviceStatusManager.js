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
    this.cacheTimeout = 5000; // 5 seconds cache timeout
    this.databaseFallbackTimeout = 30; // 30 seconds database fallback
  }

  /**
   * Set WebSocket connection status
   * @param {string} deviceId - Device identifier
   * @param {boolean} isConnected - Whether WebSocket is connected
   * @param {Date} lastSeen - Last seen timestamp
   */
  setWebSocketStatus(deviceId, isConnected, lastSeen = new Date()) {
    console.log(`🔌 [DeviceStatusManager] WebSocket status for ${deviceId}: ${isConnected ? 'CONNECTED' : 'DISCONNECTED'}`);
    
    if (isConnected) {
      this.webSocketConnections.set(deviceId, { 
        isConnected: true, 
        lastSeen,
        source: 'websocket'
      });
      console.log(`✅ [DeviceStatusManager] Added WebSocket connection for ${deviceId}`);
    } else {
      this.webSocketConnections.delete(deviceId);
      console.log(`❌ [DeviceStatusManager] Removed WebSocket connection for ${deviceId}`);
    }
    
    this.updateCachedStatus(deviceId);
    console.log(`📊 [DeviceStatusManager] Current WebSocket connections: ${Array.from(this.webSocketConnections.keys()).join(', ')}`);
  }

  /**
   * Set database status
   * @param {string} deviceId - Device identifier
   * @param {boolean} isOnline - Whether device is online in database
   * @param {Date} lastSeen - Last seen timestamp
   */
  setDatabaseStatus(deviceId, isOnline, lastSeen = new Date()) {
    console.log(`💾 [DeviceStatusManager] Database status for ${deviceId}: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
    
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
    
    console.log(`🔍 [DeviceStatusManager] Calculating status for ${deviceId}`);
    console.log(`  - WebSocket connections: ${Array.from(this.webSocketConnections.keys()).join(', ')}`);
    console.log(`  - Database status: ${Array.from(this.databaseStatus.keys()).join(', ')}`);
    
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
      console.log(`✅ [DeviceStatusManager] ${deviceId}: ONLINE (WebSocket, high confidence)`);
      return status;
    }

    // Priority 2: Recent database activity (30 seconds fallback)
    const dbStatus = this.databaseStatus.get(deviceId);
    if (dbStatus && dbStatus.isOnline) {
      const timeSinceLastSeen = (now - dbStatus.lastSeen.getTime()) / 1000;
      if (timeSinceLastSeen <= this.databaseFallbackTimeout) {
        const status = { 
          isOnline: true, 
          source: 'database',
          lastSeen: dbStatus.lastSeen,
          confidence: 'medium'
        };
        this.statusCache.set(deviceId, { ...status, timestamp: now });
        console.log(`✅ [DeviceStatusManager] ${deviceId}: ONLINE (Database, medium confidence, ${timeSinceLastSeen.toFixed(1)}s ago)`);
        return status;
      } else {
        console.log(`⏰ [DeviceStatusManager] ${deviceId}: Database status too old (${timeSinceLastSeen.toFixed(1)}s ago)`);
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
    console.log(`❌ [DeviceStatusManager] ${deviceId}: OFFLINE (Timeout, low confidence)`);
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
    
    console.log('📊 [DeviceStatusManager] Status Summary:', summary);
    return summary;
  }

  /**
   * Clear all cached data (useful for testing or cleanup)
   */
  clearCache() {
    this.webSocketConnections.clear();
    this.databaseStatus.clear();
    this.statusCache.clear();
    console.log('🧹 [DeviceStatusManager] Cache cleared');
  }
}

// Export singleton instance
module.exports = new DeviceStatusManager();
