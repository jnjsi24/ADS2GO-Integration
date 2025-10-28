/**
 * LocationUpdateQueue - Handles queuing and retry logic for location updates
 * 
 * Prevents data loss from version conflicts by:
 * - Queuing failed updates instead of dropping them
 * - Automatic retry with exponential backoff
 * - Queue overflow protection
 * - Per-material queue management
 * 
 * @singleton
 */

const DeviceTracking = require('../models/deviceTracking');

class LocationUpdateQueue {
  constructor() {
    // Per-material queues: materialId -> array of pending updates
    this.queue = new Map();
    
    // Track which materials are currently being processed
    this.processing = new Set();
    
    // Configuration
    this.maxQueueSize = 100; // Prevent memory overflow
    this.maxRetries = 3;
    this.retryDelayBase = 100; // ms, exponential backoff
    
    // Statistics
    this.stats = {
      totalQueued: 0,
      totalProcessed: 0,
      totalDropped: 0,
      totalFailed: 0
    };
  }

  /**
   * Add update to queue
   * 
   * @param {string} materialId - Material identifier
   * @param {object} updateData - Location update data
   */
  enqueue(materialId, updateData) {
    if (!this.queue.has(materialId)) {
      this.queue.set(materialId, []);
    }

    const materialQueue = this.queue.get(materialId);
    
    // Prevent queue overflow
    if (materialQueue.length >= this.maxQueueSize) {
      console.warn(`⚠️ [UpdateQueue] Queue full for ${materialId} (${this.maxQueueSize} items), dropping oldest update`);
      materialQueue.shift(); // Remove oldest
      this.stats.totalDropped++;
    }

    // Add to queue with metadata
    materialQueue.push({
      ...updateData,
      queuedAt: Date.now(),
      retries: 0
    });

    this.stats.totalQueued++;

    console.log(`📥 [UpdateQueue] Queued update for ${materialId} (queue size: ${materialQueue.length})`);

    // Trigger processing (async, non-blocking)
    setImmediate(() => this.processQueue(materialId));
  }

  /**
   * Process queued updates for a material
   * 
   * @param {string} materialId - Material identifier
   */
  async processQueue(materialId) {
    // Prevent concurrent processing for same material
    if (this.processing.has(materialId)) {
      console.log(`⏭️ [UpdateQueue] Already processing ${materialId}, skipping`);
      return;
    }

    this.processing.add(materialId);

    try {
      const materialQueue = this.queue.get(materialId);
      if (!materialQueue || materialQueue.length === 0) {
        return;
      }

      while (materialQueue.length > 0) {
        const update = materialQueue[0]; // Peek first item
        
        try {
          // Process the update
          await this.applyLocationUpdate(materialId, update);
          
          // Success - remove from queue
          materialQueue.shift();
          this.stats.totalProcessed++;
          
          console.log(`✅ [UpdateQueue] Processed update for ${materialId} (${materialQueue.length} remaining)`);
          
        } catch (error) {
          if (error.name === 'VersionError') {
            // Version conflict - retry
            update.retries++;
            
            if (update.retries > this.maxRetries) {
              console.error(`❌ [UpdateQueue] Max retries (${this.maxRetries}) reached for ${materialId}, dropping update`);
              materialQueue.shift(); // Drop it
              this.stats.totalFailed++;
            } else {
              console.log(`🔄 [UpdateQueue] Version conflict, will retry (attempt ${update.retries}/${this.maxRetries})`);
              
              // Exponential backoff
              const delay = this.retryDelayBase * Math.pow(2, update.retries - 1);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          } else {
            // Other error - log and drop
            console.error(`❌ [UpdateQueue] Error processing update for ${materialId}:`, error.message);
            materialQueue.shift(); // Drop problematic update
            this.stats.totalFailed++;
          }
        }
      }

      // Clean up empty queue
      if (materialQueue.length === 0) {
        this.queue.delete(materialId);
      }

    } finally {
      this.processing.delete(materialId);
    }
  }

  /**
   * Apply location update to DeviceTracking
   * 
   * @param {string} materialId - Material identifier
   * @param {object} updateData - Location update data
   */
  async applyLocationUpdate(materialId, updateData) {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        // Fetch fresh document
        const device = await DeviceTracking.findOne({ materialId });
        
        if (!device) {
          throw new Error(`Device not found: ${materialId}`);
        }

        // Apply update using model's updateLocation method
        await device.updateLocation(
          updateData.lat,
          updateData.lng,
          updateData.speed || 0,
          updateData.heading || 0,
          updateData.accuracy || 0,
          updateData.address || '',
          updateData.timestamp ? new Date(updateData.timestamp) : new Date()
        );

        // Success!
        return;

      } catch (error) {
        if (error.name === 'VersionError' && attempt < maxRetries - 1) {
          attempt++;
          console.log(`🔄 [UpdateQueue] applyLocationUpdate retry ${attempt}/${maxRetries} for ${materialId}`);
          
          // Small delay between retries
          await new Promise(resolve => setTimeout(resolve, 50 * attempt));
        } else {
          throw error; // Rethrow if not version error or max retries reached
        }
      }
    }

    throw new Error(`Failed to apply update after ${maxRetries} attempts`);
  }

  /**
   * Get queue status for monitoring
   * 
   * @param {string} materialId - Optional material ID filter
   * @returns {object} Queue status
   */
  getStatus(materialId = null) {
    if (materialId) {
      const queue = this.queue.get(materialId);
      if (!queue) {
        return null;
      }

      return {
        queueSize: queue.length,
        oldestUpdate: queue[0]?.queuedAt,
        processing: this.processing.has(materialId)
      };
    }

    // Return all statuses
    const status = {
      materials: {},
      stats: { ...this.stats },
      totalQueued: 0,
      totalProcessing: this.processing.size
    };

    for (const [matId, queue] of this.queue.entries()) {
      status.materials[matId] = {
        queueSize: queue.length,
        oldestUpdate: queue[0]?.queuedAt,
        processing: this.processing.has(matId)
      };
      status.totalQueued += queue.length;
    }

    return status;
  }

  /**
   * Clear queue for a material (for testing or admin override)
   * 
   * @param {string} materialId - Material identifier
   */
  clearQueue(materialId) {
    const queue = this.queue.get(materialId);
    if (queue) {
      const count = queue.length;
      this.queue.delete(materialId);
      console.log(`🗑️ [UpdateQueue] Cleared ${count} queued updates for ${materialId}`);
      return count;
    }
    return 0;
  }

  /**
   * Get statistics
   * 
   * @returns {object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      currentQueueSize: Array.from(this.queue.values()).reduce((sum, q) => sum + q.length, 0),
      currentProcessing: this.processing.size
    };
  }
}

// Export singleton instance
module.exports = new LocationUpdateQueue();

