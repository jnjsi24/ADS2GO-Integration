import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';

/**
 * Generate a consistent, persistent device ID for the tablet
 * This ensures the same device ID is used across all services
 */
export async function generateConsistentDeviceId(): Promise<string> {
  try {
    // Try to get existing device ID from AsyncStorage
    let deviceId = await AsyncStorage.getItem('persistentDeviceId');

    if (!deviceId) {
      // Generate a new persistent device ID using consistent method
      const baseDeviceId = Device.osInternalBuildId || Device.deviceName || 'unknown';
      deviceId = `TABLET-${baseDeviceId}-${Date.now()}`;

      // Store the persistent device ID
      await AsyncStorage.setItem('persistentDeviceId', deviceId);
      console.log('Generated new persistent device ID:', deviceId);
    } else {
      console.log('Using existing persistent device ID:', deviceId);
    }

    return deviceId;
  } catch (error) {
    console.error('Error generating device ID:', error);
    // Fallback to non-persistent generation
    const deviceId = Device.osInternalBuildId || Device.deviceName || 'unknown';
    return `TABLET-${deviceId}-${Date.now()}`;
  }
}

/**
 * Clear the persistent device ID (for emergency unregister)
 */
export async function clearPersistentDeviceId(): Promise<void> {
  try {
    await AsyncStorage.removeItem('persistentDeviceId');
    console.log('Persistent device ID cleared');
  } catch (error) {
    console.error('Error clearing persistent device ID:', error);
  }
}
