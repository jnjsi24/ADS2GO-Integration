/**
 * SlotFailoverService - Manages master-slave failover for dual-slot materials
 * 
 * Prevents race conditions during slot failover by:
 * - Tracking master slot state atomically
 * - Enforcing 5-second transition window
 * - Rejecting updates from old master during transition
 * 
 * @singleton
 */

class SlotFailoverService {
  constructor() {
    // In-memory state tracking (materialId -> state)
    this.failoverStates = new Map();
    
    // Transition window: period during which only new master is accepted
    this.TRANSITION_WINDOW = 5000; // 5 seconds
    
    // Cleanup old states periodically
    this.startCleanupInterval();
  }

  /**
   * Atomically check and update master slot
   * 
   * @param {string} materialId - Material identifier
   * @param {string} deviceId - Device making the request
   * @param {number} requestingSlot - Slot number (1 or 2)
   * @param {object} deviceStatusService - DeviceStatusService instance
   * @param {string} slot1DeviceId - Device ID in Slot 1
   * @param {string} slot2DeviceId - Device ID in Slot 2
   * 
   * @returns {object} { isMaster, masterSlot, inTransition, rejectReason }
   */
  async checkMasterSlot(materialId, deviceId, requestingSlot, deviceStatusService, slot1DeviceId, slot2DeviceId) {
    const now = Date.now();
    
    // Get or initialize state
    const state = this.failoverStates.get(materialId) || { 
      masterSlot: null, 
      lastUpdate: 0,
      isTransitioning: false,
      transitionStarted: 0
    };

    // Determine true master based on current online status
    const slot1Online = slot1DeviceId && deviceStatusService.getDeviceStatus(slot1DeviceId)?.isOnline;
    const slot2Online = slot2DeviceId && deviceStatusService.getDeviceStatus(slot2DeviceId)?.isOnline;

    let trueMaster = null;
    if (slot1Online) {
      trueMaster = 1;
    } else if (slot2Online) {
      trueMaster = 2;
    }

    // Check if we're in transition window
    const timeSinceTransition = now - state.transitionStarted;
    const inTransitionWindow = state.isTransitioning && timeSinceTransition < this.TRANSITION_WINDOW;

    // Detect master change
    if (state.masterSlot !== trueMaster && state.masterSlot !== null && trueMaster !== null) {
      console.log(`🔄 [Failover] Material ${materialId}: Master changing from Slot ${state.masterSlot} to Slot ${trueMaster}`);
      
      // Enter transition mode
      state.isTransitioning = true;
      state.transitionStarted = now;
      state.lastUpdate = now;
    }

    // During transition, ONLY accept updates from NEW master
    if (inTransitionWindow) {
      const isRequestingSlotNewMaster = requestingSlot === trueMaster;
      
      console.log(`⏳ [Failover] Material ${materialId}: In transition (${timeSinceTransition}ms/${this.TRANSITION_WINDOW}ms), accepting only Slot ${trueMaster}`);
      
      // Update state
      this.failoverStates.set(materialId, {
        masterSlot: trueMaster,
        lastUpdate: now,
        isTransitioning: true,
        transitionStarted: state.transitionStarted
      });

      return {
        isMaster: isRequestingSlotNewMaster,
        masterSlot: trueMaster,
        inTransition: true,
        rejectReason: isRequestingSlotNewMaster 
          ? null 
          : `Failover in progress - Slot ${trueMaster} is new master, rejecting old master (Slot ${state.masterSlot})`
      };
    }

    // Transition complete or no transition needed
    if (state.isTransitioning && timeSinceTransition >= this.TRANSITION_WINDOW) {
      console.log(`✅ [Failover] Material ${materialId}: Transition complete to Slot ${trueMaster}`);
    }

    // Update state
    state.masterSlot = trueMaster;
    state.isTransitioning = false;
    state.lastUpdate = now;
    this.failoverStates.set(materialId, state);

    // Determine if requesting slot is master
    const isMaster = requestingSlot === trueMaster;

    return {
      isMaster: isMaster,
      masterSlot: trueMaster,
      inTransition: false,
      rejectReason: isMaster ? null : `Slot ${trueMaster} is master`
    };
  }

  /**
   * Force failover to specific slot (for admin override)
   * 
   * @param {string} materialId - Material identifier
   * @param {number} targetSlot - Target slot number (1 or 2)
   */
  forceFailover(materialId, targetSlot) {
    console.log(`🚨 [Failover] FORCED: Material ${materialId} to Slot ${targetSlot}`);
    
    this.failoverStates.set(materialId, {
      masterSlot: targetSlot,
      lastUpdate: Date.now(),
      isTransitioning: false,
      transitionStarted: 0
    });
  }

  /**
   * Get current failover state for a material
   * 
   * @param {string} materialId - Material identifier
   * @returns {object} Current state or null
   */
  getState(materialId) {
    return this.failoverStates.get(materialId) || null;
  }

  /**
   * Get all failover states (for monitoring)
   * 
   * @returns {object} All states
   */
  getAllStates() {
    const states = {};
    for (const [materialId, state] of this.failoverStates.entries()) {
      states[materialId] = {
        ...state,
        isInTransition: state.isTransitioning && (Date.now() - state.transitionStarted) < this.TRANSITION_WINDOW
      };
    }
    return states;
  }

  /**
   * Clear state for a material (useful for testing or cleanup)
   * 
   * @param {string} materialId - Material identifier
   */
  clearState(materialId) {
    this.failoverStates.delete(materialId);
    console.log(`🗑️ [Failover] Cleared state for ${materialId}`);
  }

  /**
   * Cleanup old states periodically (prevent memory leak)
   */
  startCleanupInterval() {
    setInterval(() => {
      const now = Date.now();
      const STALE_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours

      for (const [materialId, state] of this.failoverStates.entries()) {
        const age = now - state.lastUpdate;
        if (age > STALE_THRESHOLD) {
          console.log(`🧹 [Failover] Cleaning up stale state for ${materialId} (age: ${Math.round(age / 1000 / 60 / 60)}h)`);
          this.failoverStates.delete(materialId);
        }
      }
    }, 60 * 60 * 1000); // Run every hour
  }
}

// Export singleton instance
module.exports = new SlotFailoverService();

