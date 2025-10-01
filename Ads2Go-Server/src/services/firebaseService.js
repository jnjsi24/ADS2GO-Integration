const { storage } = require('../config/firebase');
const Tablet = require('../models/Tablet');
const ScreenTracking = require('../models/screenTracking');

class FirebaseService {
  constructor() {
    this.storage = storage;
  }

  // ===== TABLET MANAGEMENT =====
  
  /**
   * Register a new tablet (MongoDB only)
   */
  async registerTablet(tabletData) {
    try {
      const { tabletId, ...data } = tabletData;
      
      const tablet = await Tablet.findOneAndUpdate(
        { tabletId },
        {
          tabletId,
          ...data,
          status: 'offline',
          lastSeen: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );

      return { tabletId, success: true, tablet };
    } catch (error) {
      console.error('Error registering tablet:', error);
      throw new Error('Failed to register tablet');
    }
  }

  /**
   * Update tablet status (MongoDB only)
   */
  async updateTabletStatus(tabletId, status, data = {}) {
    try {
      await Tablet.findOneAndUpdate(
        { tabletId },
        {
          status,
          lastSeen: new Date(),
          updatedAt: new Date(),
          ...data
        },
        { new: true }
      );

      return { success: true };
    } catch (error) {
      console.error('Error updating tablet status:', error);
      throw new Error('Failed to update tablet status');
    }
  }

  /**
   * Get tablet real-time status (MongoDB only)
   */
  async getTabletStatus(tabletId) {
    try {
      const tablet = await Tablet.findOne({ tabletId });
      return tablet ? tablet.toObject() : null;
    } catch (error) {
      console.error('Error getting tablet status:', error);
      return null;
    }
  }

  /**
   * Get all tablets with real-time status (MongoDB only)
   */
  async getAllTablets() {
    try {
      const tablets = await Tablet.find({});
      return tablets.map(tablet => tablet.toObject());
    } catch (error) {
      console.error('Error getting all tablets:', error);
      return [];
    }
  }

  // ===== LOCATION TRACKING =====

  /**
   * Update tablet location (MongoDB only)
   */
  async updateTabletLocation(tabletId, locationData) {
    try {
      await Tablet.findOneAndUpdate(
        { tabletId },
        {
          location: locationData,
          lastLocationUpdate: new Date(),
          updatedAt: new Date()
        },
        { new: true }
      );

      return { success: true };
    } catch (error) {
      console.error('Error updating tablet location:', error);
      throw new Error('Failed to update tablet location');
    }
  }

  /**
   * Get tablet location (MongoDB only)
   */
  async getTabletLocation(tabletId) {
    try {
      const tablet = await Tablet.findOne({ tabletId });
      return tablet ? { tabletId, location: tablet.location } : null;
    } catch (error) {
      console.error('Error getting tablet location:', error);
      return null;
    }
  }

  /**
   * Get all tablet locations (MongoDB only)
   */
  async getAllTabletLocations() {
    try {
      const tablets = await Tablet.find({ location: { $exists: true } });
      return tablets.map(tablet => ({
        tabletId: tablet.tabletId,
        location: tablet.location
      }));
    } catch (error) {
      console.error('Error getting all tablet locations:', error);
      return [];
    }
  }

  // ===== AD PLAYBACK TRACKING =====

  /**
   * Start ad playback tracking (MongoDB only)
   */
  async startPlayback(tabletId, adData) {
    try {
      const tracking = await ScreenTracking.create({
        tabletId,
        adId: adData.adId,
        adName: adData.adName,
        startTime: new Date(),
        status: 'playing',
        location: adData.location || null,
        impressions: 0
      });

      // Update tablet status
      await this.updateTabletStatus(tabletId, 'playing', {
        currentAd: adData.adId,
        currentAdName: adData.adName
      });

      return { playbackId: tracking._id, success: true };
    } catch (error) {
      console.error('Error starting playback:', error);
      throw new Error('Failed to start playback');
    }
  }

  /**
   * Update playback status (MongoDB only)
   */
  async updatePlayback(playbackId, updates) {
    try {
      await ScreenTracking.findByIdAndUpdate(
        playbackId,
        {
          ...updates,
          updatedAt: new Date()
        },
        { new: true }
      );

      return { success: true };
    } catch (error) {
      console.error('Error updating playback:', error);
      throw new Error('Failed to update playback');
    }
  }

  /**
   * End ad playback (MongoDB only)
   */
  async endPlayback(playbackId, endData = {}) {
    try {
      await ScreenTracking.findByIdAndUpdate(
        playbackId,
        {
          endTime: new Date(),
          status: 'completed',
          duration: endData.duration || 0,
          impressions: endData.impressions || 0,
          updatedAt: new Date()
        },
        { new: true }
      );

      // Update tablet status if tabletId provided
      if (endData.tabletId) {
        await this.updateTabletStatus(endData.tabletId, 'idle', {
          currentAd: null,
          currentAdName: null
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Error ending playback:', error);
      throw new Error('Failed to end playback');
    }
  }

  /**
   * Get current playback status (MongoDB only)
   */
  async getCurrentPlayback(tabletId) {
    try {
      const playback = await ScreenTracking.findOne({
        tabletId,
        status: 'playing'
      }).sort({ startTime: -1 });

      return playback ? playback.toObject() : null;
    } catch (error) {
      console.error('Error getting current playback:', error);
      return null;
    }
  }

  /**
   * Get active playbacks (MongoDB only)
   */
  async getActivePlaybacks() {
    try {
      const playbacks = await ScreenTracking.find({
        status: 'playing'
      }).sort({ startTime: -1 });

      return playbacks.map(playback => playback.toObject());
    } catch (error) {
      console.error('Error getting active playbacks:', error);
      return [];
    }
  }

  // ===== ADMIN FUNCTIONS =====

  /**
   * Get all real-time data for admin dashboard (MongoDB only)
   */
  async getAdminDashboardData() {
    try {
      const [tablets, tracking, playback] = await Promise.all([
        this.getAllTablets(),
        this.getAllTabletLocations(),
        this.getActivePlaybacks()
      ]);

      return {
        tablets,
        tracking,
        playback,
        summary: {
          totalTablets: tablets.length,
          onlineTablets: tablets.filter(t => t.status === 'online').length,
          playingTablets: tablets.filter(t => t.status === 'playing').length,
          offlineTablets: tablets.filter(t => t.status === 'offline').length
        }
      };
    } catch (error) {
      console.error('Error getting dashboard data:', error);
      return {
        tablets: [],
        tracking: [],
        playback: [],
        summary: {
          totalTablets: 0,
          onlineTablets: 0,
          playingTablets: 0,
          offlineTablets: 0
        }
      };
    }
  }
}

module.exports = new FirebaseService();
