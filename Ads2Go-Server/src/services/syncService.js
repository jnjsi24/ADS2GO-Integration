// This service is no longer needed since we're using MongoDB only
// All data operations are now handled directly in MongoDB

class SyncService {
  constructor() {
    this.isRunning = false;
  }

  /**
   * Start the sync service (no longer needed)
   */
  start() {
    console.log('🔄 Sync service is no longer needed - using MongoDB only');
    this.isRunning = true;
  }

  /**
   * Stop the sync service
   */
  stop() {
    console.log('🛑 Sync service stopped');
    this.isRunning = false;
  }

  /**
   * Get sync status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      message: 'Using MongoDB only - no sync needed'
    };
  }

  /**
   * Manual sync (no longer needed)
   */
  async syncTablet(tabletId) {
    console.log(`🔄 Manual sync not needed for tablet: ${tabletId}`);
    return true;
  }
}

module.exports = new SyncService();
