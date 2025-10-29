import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_CONFIG from '../config/api';

// Conditional import for notifications - handle Expo Go limitations
let Notifications: any = null;
let isNotificationsAvailable = false;

// Function to safely initialize notifications
const initializeNotifications = () => {
  if (isNotificationsAvailable) return; // Already initialized
  
  try {
    // Try to import notifications
    Notifications = require('expo-notifications');
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
    
    console.log('✅ expo-notifications initialized successfully');
  } catch (error) {
    console.log('⚠️ expo-notifications not available in this environment:', error instanceof Error ? error.message : 'Unknown error');
    isNotificationsAvailable = false;
    Notifications = null;
  }
};

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
   * Initialize local notifications (works in Expo Go)
   */
  async initializeLocalNotifications(): Promise<boolean> {
    try {
      // Try to initialize notifications if not already done
      initializeNotifications();
      
      if (!isNotificationsAvailable || !Notifications) {
        console.log('⚠️ Notifications not available in this environment');
        return false;
      }

      // Request permissions for local notifications
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('❌ Failed to get notification permissions!');
        return false;
      }

      console.log('✅ Local notifications initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Error initializing local notifications:', error);
      return false;
    }
  }

  /**
   * Register for local notifications (Expo Go compatible)
   */
  async registerForLocalNotifications(): Promise<boolean> {
    try {
      console.log('🔔 Registering for local notifications (Expo Go compatible)');
      return await this.initializeLocalNotifications();
    } catch (error) {
      console.error('❌ Error registering for local notifications:', error);
      return false;
    }
  }

  /**
   * Set up notification listeners
   */
  setupNotificationListeners(): () => void {
    // Try to initialize notifications if not already done
    initializeNotifications();
    
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
    } else if (data?.category === 'REPORT_STATUS_UPDATE') {
      this.handleReportStatusUpdateNotification(data);
    } else if (data?.category === 'MATERIAL_STATUS_CHANGE') {
      this.handleMaterialStatusChangeNotification(data);
    } else if (data?.category === 'HOURS_MILESTONE') {
      this.handleHoursMilestoneNotification(data);
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
   * Handle report status update notification
   */
  private handleReportStatusUpdateNotification(data: NotificationData): void {
    console.log('📋 Report status update notification:', data);
    
    const status = data.status || 'updated';
    const reportTitle = data.reportTitle || 'Your report';
    
    this.showInAppNotification(
      '📋 Report Update',
      `${reportTitle} status: ${status}`,
      status === 'RESOLVED' ? 'success' : status === 'CLOSED' ? 'warning' : 'info'
    );
  }

  /**
   * Handle material status change notification (online/offline)
   */
  private handleMaterialStatusChangeNotification(data: NotificationData): void {
    console.log('🔄 Material status change notification:', data);
    
    const isOnline = data.status === 'ONLINE';
    const materialId = data.materialId || 'Your material';
    
    this.showInAppNotification(
      isOnline ? '🟢 Material Online' : '🔴 Material Offline',
      `${materialId} is now ${data.status?.toLowerCase()}`,
      isOnline ? 'success' : 'warning'
    );
  }

  /**
   * Handle hours milestone notification
   */
  private handleHoursMilestoneNotification(data: NotificationData): void {
    console.log('🎯 Hours milestone notification:', data);
    
    const hours = data.hours || 8;
    
    this.showInAppNotification(
      '🎯 Milestone Achieved!',
      `Congratulations! You've reached ${hours} hours online today!`,
      'success'
    );
  }

  /**
   * Show in-app notification toast
   */
  private showInAppNotification(title: string, message: string, type: 'success' | 'info' | 'warning' | 'error'): void {
    console.log(`📢 In-app notification [${type}]: ${title} - ${message}`);
    
    // Use the ToastManager to show toast popup
    const ToastManager = require('./toastManager').default;
    const toastManager = ToastManager.getInstance();
    
    toastManager.showToast({
      title,
      message,
      type,
      duration: type === 'error' ? 6000 : 4000, // Errors stay longer
    });
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
   * Show immediate local notification
   */
  async showLocalNotification(title: string, body: string, data?: NotificationData): Promise<void> {
    // Try to initialize notifications if not already done
    initializeNotifications();
    
    if (!isNotificationsAvailable || !Notifications) {
      console.log('⚠️ Notifications not available - cannot show local notification');
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
        trigger: null, // Show immediately
      });
    } catch (error) {
      console.error('❌ Error showing local notification:', error);
    }
  }

  /**
   * Schedule a local notification for later
   */
  async scheduleLocalNotification(title: string, body: string, delaySeconds: number, data?: NotificationData): Promise<void> {
    // Try to initialize notifications if not already done
    initializeNotifications();
    
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
        trigger: { seconds: delaySeconds },
      });
    } catch (error) {
      console.error('❌ Error scheduling local notification:', error);
    }
  }

  /**
   * Show notification for material assignment
   */
  async showMaterialAssignmentNotification(materialName: string, materialId: string): Promise<void> {
    await this.showLocalNotification(
      '🚚 New Material Assigned!',
      `You have been assigned to material: ${materialName}`,
      {
        category: 'MATERIAL_ASSIGNMENT',
        materialId,
        materialName,
        priority: 'HIGH'
      }
    );
  }

  /**
   * Show notification for driver status change
   */
  async showDriverStatusNotification(message: string): Promise<void> {
    await this.showLocalNotification(
      '📋 Status Update',
      message,
      {
        category: 'DRIVER_STATUS_CHANGE',
        priority: 'MEDIUM'
      }
    );
  }

  /**
   * Show notification for route update
   */
  async showRouteUpdateNotification(message: string): Promise<void> {
    await this.showLocalNotification(
      '🗺️ Route Updated',
      message,
      {
        category: 'ROUTE_UPDATE',
        priority: 'MEDIUM'
      }
    );
  }

  /**
   * Clear all notifications
   */
  async clearAllNotifications(): Promise<void> {
    // Try to initialize notifications if not already done
    initializeNotifications();
    
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
    // Try to initialize notifications if not already done
    initializeNotifications();
    
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
    // Try to initialize notifications if not already done
    initializeNotifications();
    
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
