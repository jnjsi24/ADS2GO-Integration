import { useMutation } from '@apollo/client';
import { 
  PAUSE_ALL_SCREENS, 
  PLAY_ALL_SCREENS, 
  SYNC_ALL_SCREENS, 
  STOP_ALL_SCREENS 
} from './graphql';

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
    // This would need to be implemented in the server
    return { success: true, message: 'Lockdown all screens not implemented yet' };
  }

  async unlockAllScreens(): Promise<{ success: boolean; message: string }> {
    // This would need to be implemented in the server
    return { success: true, message: 'Unlock all screens not implemented yet' };
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

  async trackAdPlayback(deviceId: string, adId: string, adTitle: string, adDuration: number): Promise<{ success: boolean; message: string }> {
    // This would need to be implemented
    return { success: true, message: 'Track ad playback not implemented yet' };
  }

  async endAdPlayback(deviceId: string): Promise<{ success: boolean; message: string }> {
    // This would need to be implemented
    return { success: true, message: 'End ad playback not implemented yet' };
  }

  async updateDriverActivity(deviceId: string, value: any): Promise<{ success: boolean; message: string }> {
    // This would need to be implemented
    return { success: true, message: 'Update driver activity not implemented yet' };
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
