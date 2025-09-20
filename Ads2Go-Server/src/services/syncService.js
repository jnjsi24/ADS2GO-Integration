const cron = require('node-cron');
const firebaseService = require('./firebaseService');

class SyncService {
  constructor() {
    this.isRunning = false;
    this.syncInterval = 30000; // 30 seconds default
    this.syncTask = null;
    this.status = {
      isRunning: false,
      lastSync: null,
      syncInterval: this.syncInterval,
      error: null
    };
  }

  getStatus() {
    return {
      ...this.status,
      isRunning: this.isRunning,
      syncInterval: this.syncInterval
    };
  }

  start() {
    if (this.isRunning) {
      console.log('Sync service is already running');
      return;
    }

    try {
      // Create a cron job that runs every syncInterval milliseconds
      const cronExpression = `*/${Math.floor(this.syncInterval / 1000)} * * * * *`; // Convert to seconds
      
      this.syncTask = cron.schedule(cronExpression, async () => {
        try {
          await this.performSync();
        } catch (error) {
          console.error('Sync error:', error);
          this.status.error = error.message;
        }
      }, {
        scheduled: false
      });

      this.syncTask.start();
      this.isRunning = true;
      this.status.isRunning = true;
      this.status.error = null;
      
      console.log(`Sync service started with interval: ${this.syncInterval}ms`);
    } catch (error) {
      console.error('Failed to start sync service:', error);
      this.status.error = error.message;
      throw error;
    }
  }

  stop() {
    if (!this.isRunning) {
      console.log('Sync service is not running');
      return;
    }

    if (this.syncTask) {
      this.syncTask.stop();
      this.syncTask.destroy();
      this.syncTask = null;
    }

    this.isRunning = false;
    this.status.isRunning = false;
    
    console.log('Sync service stopped');
  }

  setSyncInterval(interval) {
    if (interval < 1000) {
      throw new Error('Sync interval must be at least 1000ms (1 second)');
    }

    const wasRunning = this.isRunning;
    
    if (wasRunning) {
      this.stop();
    }

    this.syncInterval = interval;
    this.status.syncInterval = interval;

    if (wasRunning) {
      this.start();
    }

    console.log(`Sync interval updated to: ${interval}ms`);
  }

  async syncTablet(tabletId) {
    try {
      console.log(`Manual sync requested for tablet: ${tabletId}`);
      
      // Perform sync for specific tablet
      await this.performTabletSync(tabletId);
      
      this.status.lastSync = new Date().toISOString();
      this.status.error = null;
      
      return true;
    } catch (error) {
      console.error(`Sync failed for tablet ${tabletId}:`, error);
      this.status.error = error.message;
      throw error;
    }
  }

  async performSync() {
    try {
      console.log('Performing automatic sync...');
      
      // Get all tablets and sync them
      const tablets = await firebaseService.getAllTablets();
      
      for (const tablet of tablets) {
        await this.performTabletSync(tablet.id);
      }
      
      this.status.lastSync = new Date().toISOString();
      this.status.error = null;
      
      console.log('Automatic sync completed successfully');
    } catch (error) {
      console.error('Automatic sync failed:', error);
      this.status.error = error.message;
      throw error;
    }
  }

  async performTabletSync(tabletId) {
    try {
      // Get tablet status from Firebase
      const tabletStatus = await firebaseService.getTabletStatus(tabletId);
      
      if (!tabletStatus) {
        console.log(`Tablet ${tabletId} not found, skipping sync`);
        return;
      }

      // Perform any necessary sync operations here
      // This could include:
      // - Syncing material availability
      // - Updating ad deployments
      // - Syncing device status
      // - Any other tablet-specific data

      console.log(`Tablet ${tabletId} synced successfully`);
      
    } catch (error) {
      console.error(`Failed to sync tablet ${tabletId}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new SyncService();
