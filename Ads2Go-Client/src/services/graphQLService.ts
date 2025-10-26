import { useMutation } from '@apollo/client';
import { 
  PAUSE_ALL_SCREENS, 
  PLAY_ALL_SCREENS, 
  SYNC_ALL_SCREENS, 
  STOP_ALL_SCREENS,
  LOCKDOWN_ALL_SCREENS,
  UNLOCK_ALL_SCREENS,
  FULLSCREEN_ALL_SCREENS,
  EXIT_FULLSCREEN_ALL_SCREENS,
  PLAY_SCREEN,
  PAUSE_SCREEN,
  STOP_SCREEN,
  LOCK_SCREEN,
  UNLOCK_SCREEN,
  SYNC_SLOTS
} from './graphql';
import playbackWebSocketService from './playbackWebSocketService';

class GraphQLService {
  private client: any;

  constructor(apolloClient: any) {
    this.client = apolloClient;
  }

  async pauseAllScreens(): Promise<{ success: boolean; message: string; pausedCount?: number }> {
    try {
      const result = await this.client.mutate({
        mutation: PAUSE_ALL_SCREENS,
        errorPolicy: 'all'
      });
      
      return result.data.pauseAllScreens;
    } catch (error) {
      console.error('Error pausing all screens:', error);
      throw new Error('Failed to pause all screens');
    }
  }

  async playAllScreens(): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.client.mutate({
        mutation: PLAY_ALL_SCREENS,
        errorPolicy: 'all'
      });
      
      return result.data.playAllScreens;
    } catch (error) {
      console.error('Error playing all screens:', error);
      throw new Error('Failed to play all screens');
    }
  }

  async syncAllScreens(): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.client.mutate({
        mutation: SYNC_ALL_SCREENS,
        errorPolicy: 'all'
      });
      
      return result.data.syncAllScreens;
    } catch (error) {
      console.error('Error syncing all screens:', error);
      throw new Error('Failed to sync all screens');
    }
  }

  async stopAllScreens(): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.client.mutate({
        mutation: STOP_ALL_SCREENS,
        errorPolicy: 'all'
      });
      
      return result.data.stopAllScreens;
    } catch (error) {
      console.error('Error stopping all screens:', error);
      throw new Error('Failed to stop all screens');
    }
  }

  // Placeholder methods for other actions
  async restartAllScreens(): Promise<{ success: boolean; message: string }> {
    // This would need to be implemented in the server
    return { success: true, message: 'Restart all screens not implemented yet' };
  }

  async emergencyStopAll(): Promise<{ success: boolean; message: string }> {
    // This would need to be implemented in the server
    return { success: true, message: 'Emergency stop all not implemented yet' };
  }

  async lockdownAllScreens(): Promise<{ success: boolean; message: string }> {
    try {
      const { data } = await this.client.mutate({
        mutation: LOCKDOWN_ALL_SCREENS,
      });
      return data.lockdownAllScreens;
    } catch (error) {
      console.error('Error locking all screens:', error);
      throw error;
    }
  }

  async unlockAllScreens(): Promise<{ success: boolean; message: string }> {
    try {
      const { data } = await this.client.mutate({
        mutation: UNLOCK_ALL_SCREENS,
      });
      return data.unlockAllScreens;
    } catch (error) {
      console.error('Error unlocking all screens:', error);
      throw error;
    }
  }

  async fullscreenAllScreens(): Promise<{ success: boolean; message: string; fullscreenCount?: number }> {
    try {
      const { data } = await this.client.mutate({
        mutation: FULLSCREEN_ALL_SCREENS,
      });
      return data.fullscreenAllScreens;
    } catch (error) {
      console.error('Error setting fullscreen on all screens:', error);
      throw error;
    }
  }

  async exitFullscreenAllScreens(): Promise<{ success: boolean; message: string; exitFullscreenCount?: number }> {
    try {
      const { data } = await this.client.mutate({
        mutation: EXIT_FULLSCREEN_ALL_SCREENS,
      });
      return data.exitFullscreenAllScreens;
    } catch (error) {
      console.error('Error exiting fullscreen on all screens:', error);
      throw error;
    }
  }

  // Individual screen actions
  async updateScreenMetrics(deviceId: string, value: any): Promise<{ success: boolean; message: string }> {
    // This would need to be implemented
    return { success: true, message: 'Update screen metrics not implemented yet' };
  }

  async startScreenSession(deviceId: string): Promise<{ success: boolean; message: string }> {
    // This would need to be implemented
    return { success: true, message: 'Start screen session not implemented yet' };
  }

  async endScreenSession(deviceId: string): Promise<{ success: boolean; message: string }> {
    // This would need to be implemented
    return { success: true, message: 'End screen session not implemented yet' };
  }

  // ❌ REMOVED: trackAdPlayback() stub - not implemented, handled by AdPlayer directly

  async endAdPlayback(deviceId: string): Promise<{ success: boolean; message: string }> {
    // This would need to be implemented
    return { success: true, message: 'End ad playback not implemented yet' };
  }

  async updateDriverActivity(deviceId: string, value: any): Promise<{ success: boolean; message: string }> {
    // This would need to be implemented
    return { success: true, message: 'Update driver activity not implemented yet' };
  }

  // Individual Device Control Methods (using GraphQL mutations with device filter)
  async playScreen(deviceId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { data } = await this.client.mutate({
        mutation: PLAY_ALL_SCREENS,
        variables: { targetDeviceId: deviceId }
      });
      return { success: data.playAllScreens.success, message: data.playAllScreens.message };
    } catch (error) {
      console.error('Error playing screen:', error);
      throw error;
    }
  }

  async pauseScreen(deviceId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { data } = await this.client.mutate({
        mutation: PAUSE_ALL_SCREENS,
        variables: { targetDeviceId: deviceId }
      });
      return { success: data.pauseAllScreens.success, message: data.pauseAllScreens.message };
    } catch (error) {
      console.error('Error pausing screen:', error);
      throw error;
    }
  }

  async stopScreen(deviceId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { data } = await this.client.mutate({
        mutation: STOP_ALL_SCREENS,
        variables: { targetDeviceId: deviceId }
      });
      return { success: data.stopAllScreens.success, message: data.stopAllScreens.message };
    } catch (error) {
      console.error('Error stopping screen:', error);
      throw error;
    }
  }

  async lockScreen(deviceId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { data } = await this.client.mutate({
        mutation: LOCK_SCREEN,
        variables: { deviceId }
      });
      return { success: true, message: data.lockScreen };
    } catch (error) {
      console.error('Error locking screen:', error);
      throw error;
    }
  }

  async unlockScreen(deviceId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { data } = await this.client.mutate({
        mutation: UNLOCK_SCREEN,
        variables: { deviceId }
      });
      return { success: true, message: data.unlockScreen };
    } catch (error) {
      console.error('Error unlocking screen:', error);
      throw error;
    }
  }

  async syncSlots(materialId: string, action: string, syncData?: any): Promise<{ success: boolean; message: string; pausedCount: number }> {
    try {
      const { data } = await this.client.mutate({
        mutation: SYNC_SLOTS,
        variables: { 
          materialId,
          action,
          syncData: syncData ? JSON.stringify(syncData) : null
        }
      });
      return { 
        success: data.syncSlots.success, 
        message: data.syncSlots.message,
        pausedCount: data.syncSlots.pausedCount
      };
    } catch (error) {
      console.error('Error syncing slots:', error);
      throw error;
    }
  }
}

// Create a singleton instance
let graphQLServiceInstance: GraphQLService | null = null;

export const createGraphQLService = (apolloClient: any) => {
  if (!graphQLServiceInstance) {
    graphQLServiceInstance = new GraphQLService(apolloClient);
  }
  return graphQLServiceInstance;
};

export const getGraphQLService = () => {
  if (!graphQLServiceInstance) {
    throw new Error('GraphQL service not initialized. Call createGraphQLService first.');
  }
  return graphQLServiceInstance;
};

export default GraphQLService;
