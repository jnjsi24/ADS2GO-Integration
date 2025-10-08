import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_CONFIG from '../config/api';

// Conditional import for notifications - handle Expo Go limitations
let Notifications: any = null;
let isNotificationsAvailable = false;

try {
  // Try to import notifications
  Notifications = require('expo-notifications');
  
  // Check if we're in Expo Go (which has limited notification support)
  const isExpoGo = __DEV__ && !Device.isDevice;
  
  if (!isExpoGo) {
    isNotificationsAvailable = true;
    
    // Configure notification behavior only if available
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } else {
    console.log('⚠️ Running in Expo Go - notifications will be limited');
  }
} catch (error) {
  console.log('⚠️ expo-notifications not available:', error instanceof Error ? error.message : 'Unknown error');
  isNotificationsAvailable = false;
}

export interface NotificationData {
  materialId?: string;
  materialName?: string;
  category?: string;
  priority?: string;
  [key: string]: any;
}

export interface NotificationPayload {
  title: string;
  body: string;
  data?: NotificationData;
}

class NotificationService {
  private static instance: NotificationService;
  private expoPushToken: string | null = null;

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Register for push notifications and get Expo push token
   */
  async registerForPushNotifications(): Promise<string | null> {
    try {
      if (!isNotificationsAvailable || !Notifications) {
        console.log('⚠️ Notifications not available in this environment');
        return null;
      }

      if (!Device.isDevice) {
        console.log('❌ Must use physical device for push notifications');
        return null;
      }

      // Check existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permissions if not granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('❌ Failed to get push token for push notification!');
        return null;
      }

      // Get the push token
      // Let Expo auto-detect the project ID from app.config.js
      const token = await Notifications.getExpoPushTokenAsync();

      this.expoPushToken = token.data;
      console.log('✅ Expo push token:', this.expoPushToken);

      // Store token in AsyncStorage
      if (this.expoPushToken) {
        await AsyncStorage.setItem('expoPushToken', this.expoPushToken);
      }

      // Send token to server
      if (this.expoPushToken) {
        await this.sendTokenToServer(this.expoPushToken);
      }

      return this.expoPushToken;
    } catch (error) {
      console.error('❌ Error registering for push notifications:', error);
      return null;
    }
  }

  /**
   * Send push token to server for driver
   */
  private async sendTokenToServer(token: string): Promise<void> {
    try {
      const authToken = await AsyncStorage.getItem('token');
      const driverId = await AsyncStorage.getItem('driverId');

      if (!authToken || !driverId) {
        console.log('❌ Missing auth token or driver ID for token registration');
        return;
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          query: `
            mutation UpdateDriverPushToken($driverId: ID!, $pushToken: String!) {
              updateDriverPushToken(driverId: $driverId, pushToken: $pushToken) {
                success
                message
              }
            }
          `,
          variables: {
            driverId,
            pushToken: token,
          },
        }),
      });

      const result = await response.json();
      
      if (result.data?.updateDriverPushToken?.success) {
        console.log('✅ Push token sent to server successfully');
      } else {
        console.log('❌ Failed to send push token to server:', result.errors);
      }
    } catch (error) {
      console.error('❌ Error sending push token to server:', error);
    }
  }

  /**
   * Set up notification listeners
   */
  setupNotificationListeners(): () => void {
    if (!isNotificationsAvailable || !Notifications) {
      console.log('⚠️ Notifications not available - returning empty cleanup function');
      return () => {}; // Return empty cleanup function
    }

    try {
      // Listener for notifications received while app is foregrounded
      const notificationListener = Notifications.addNotificationReceivedListener((notification: any) => {
        console.log('📱 Notification received:', notification);
        this.handleNotificationReceived(notification);
      });

      // Listener for when user taps on notification
      const responseListener = Notifications.addNotificationResponseReceivedListener((response: any) => {
        console.log('👆 Notification tapped:', response);
        this.handleNotificationTapped(response);
      });

      // Return cleanup function
      return () => {
        notificationListener.remove();
        responseListener.remove();
      };
    } catch (error) {
      console.error('❌ Error setting up notification listeners:', error);
      return () => {}; // Return empty cleanup function
    }
  }

  /**
   * Handle notification received (app in foreground)
   */
  private handleNotificationReceived(notification: any): void {
    const { title, body, data } = notification.request.content;
    
    console.log('📱 Handling notification:', { title, body, data });

    // Handle different notification categories
    if (data?.category === 'MATERIAL_ASSIGNMENT') {
      this.handleMaterialAssignmentNotification(data);
    } else if (data?.category === 'DRIVER_STATUS_CHANGE') {
      this.handleDriverStatusChangeNotification(data);
    } else if (data?.category === 'ROUTE_UPDATE') {
      this.handleRouteUpdateNotification(data);
    } else if (data?.category === 'DEVICE_ISSUE') {
      this.handleDeviceIssueNotification(data);
    }
  }

  /**
   * Handle notification tapped
   */
  private handleNotificationTapped(response: any): void {
    const { data } = response.notification.request.content;
    
    console.log('👆 Handling notification tap:', data);

    // Navigate based on notification category
    if (data?.category === 'MATERIAL_ASSIGNMENT') {
      // Navigate to materials screen
      this.navigateToMaterials();
    } else if (data?.category === 'DRIVER_STATUS_CHANGE') {
      // Navigate to profile or dashboard
      this.navigateToDashboard();
    }
  }

  /**
   * Handle material assignment notification
   */
  private handleMaterialAssignmentNotification(data: NotificationData): void {
    console.log('🚚 Material assignment notification:', data);
    
    // You can trigger a refresh of materials here
    // or show an in-app notification
    this.showInAppNotification(
      '🚚 New Material Assigned!',
      `You have been assigned to material: ${data.materialName || data.materialId}`,
      'success'
    );
  }

  /**
   * Handle driver status change notification
   */
  private handleDriverStatusChangeNotification(data: NotificationData): void {
    console.log('📋 Driver status change notification:', data);
    
    this.showInAppNotification(
      '📋 Status Update',
      'Your driver status has been updated. Check your profile for details.',
      'info'
    );
  }

  /**
   * Handle route update notification
   */
  private handleRouteUpdateNotification(data: NotificationData): void {
    console.log('🗺️ Route update notification:', data);
    
    this.showInAppNotification(
      '🗺️ Route Updated',
      'Your route has been updated. Check the dashboard for new details.',
      'info'
    );
  }

  /**
   * Handle device issue notification
   */
  private handleDeviceIssueNotification(data: NotificationData): void {
    console.log('⚠️ Device issue notification:', data);
    
    this.showInAppNotification(
      '⚠️ Device Issue',
      'There is an issue with your device. Please contact support.',
      'warning'
    );
  }

  /**
   * Show in-app notification (you can implement this with a toast library)
   */
  private showInAppNotification(title: string, message: string, type: 'success' | 'info' | 'warning' | 'error'): void {
    // This is a placeholder - you can implement with react-native-toast-message or similar
    console.log(`📢 In-app notification [${type}]: ${title} - ${message}`);
    
    // Example implementation with Alert (you might want to use a better toast library)
    // Alert.alert(title, message);
  }

  /**
   * Navigate to materials screen
   */
  private navigateToMaterials(): void {
    // This will depend on your navigation setup
    console.log('🧭 Navigating to materials screen');
    // Example: navigation.navigate('Materials');
  }

  /**
   * Navigate to dashboard
   */
  private navigateToDashboard(): void {
    // This will depend on your navigation setup
    console.log('🧭 Navigating to dashboard');
    // Example: navigation.navigate('Dashboard');
  }

  /**
   * Schedule a local notification (for testing)
   */
  async scheduleLocalNotification(title: string, body: string, data?: NotificationData): Promise<void> {
    if (!isNotificationsAvailable || !Notifications) {
      console.log('⚠️ Notifications not available - cannot schedule local notification');
      return;
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
        },
        trigger: { seconds: 2 },
      });
    } catch (error) {
      console.error('❌ Error scheduling local notification:', error);
    }
  }

  /**
   * Clear all notifications
   */
  async clearAllNotifications(): Promise<void> {
    if (!isNotificationsAvailable || !Notifications) {
      console.log('⚠️ Notifications not available - cannot clear notifications');
      return;
    }

    try {
      await Notifications.dismissAllNotificationsAsync();
    } catch (error) {
      console.error('❌ Error clearing notifications:', error);
    }
  }

  /**
   * Get notification permissions status
   */
  async getPermissionsStatus(): Promise<any> {
    if (!isNotificationsAvailable || !Notifications) {
      console.log('⚠️ Notifications not available - returning default permissions status');
      return { status: 'undetermined' };
    }

    try {
      return await Notifications.getPermissionsAsync();
    } catch (error) {
      console.error('❌ Error getting permissions status:', error);
      return { status: 'undetermined' };
    }
  }

  /**
   * Request notification permissions
   */
  async requestPermissions(): Promise<any> {
    if (!isNotificationsAvailable || !Notifications) {
      console.log('⚠️ Notifications not available - returning default permissions status');
      return { status: 'undetermined' };
    }

    try {
      return await Notifications.requestPermissionsAsync();
    } catch (error) {
      console.error('❌ Error requesting permissions:', error);
      return { status: 'undetermined' };
    }
  }
}

export default NotificationService;
