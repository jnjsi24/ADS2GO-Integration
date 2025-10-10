import { Alert } from 'react-native';

export interface NotificationData {
  materialId?: string;
  materialName?: string;
  category?: string;
  priority?: string;
  [key: string]: any;
}

/**
 * Safe notification service that works in Expo Go without expo-notifications
 * Uses native Alert dialogs as fallback for notifications
 */
class SafeNotificationService {
  private static instance: SafeNotificationService;

  static getInstance(): SafeNotificationService {
    if (!SafeNotificationService.instance) {
      SafeNotificationService.instance = new SafeNotificationService();
    }
    return SafeNotificationService.instance;
  }

  /**
   * Initialize local notifications (always works in Expo Go)
   */
  async initializeLocalNotifications(): Promise<boolean> {
    console.log('🔔 SafeNotificationService: Initializing (using Alert)');
    return true;
  }

  /**
   * Register for local notifications (Expo Go compatible)
   */
  async registerForLocalNotifications(): Promise<boolean> {
    console.log('🔔 SafeNotificationService: Registering for local notifications (using Alert)');
    return true;
  }

  /**
   * Set up notification listeners (no-op for Alert-based notifications)
   */
  setupNotificationListeners(): () => void {
    console.log('👂 SafeNotificationService: Setting up listeners (using Alert)');
    return () => {
      console.log('🧹 SafeNotificationService: Cleaning up listeners');
    };
  }

  /**
   * Show immediate local notification using Alert
   */
  async showLocalNotification(title: string, body: string, data?: NotificationData): Promise<void> {
    console.log(`📢 SafeNotificationService: ${title} - ${body}`);
    Alert.alert(title, body);
  }

  /**
   * Schedule a local notification for later (using setTimeout)
   */
  async scheduleLocalNotification(title: string, body: string, delaySeconds: number, data?: NotificationData): Promise<void> {
    console.log(`⏰ SafeNotificationService: Scheduling notification in ${delaySeconds} seconds`);
    setTimeout(() => {
      Alert.alert(title, body);
    }, delaySeconds * 1000);
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
   * Clear all notifications (no-op for Alert-based notifications)
   */
  async clearAllNotifications(): Promise<void> {
    console.log('🗑️ SafeNotificationService: Clearing all notifications (not applicable for Alert)');
  }

  /**
   * Get notification permissions status (always granted for Alert)
   */
  async getPermissionsStatus(): Promise<any> {
    return { status: 'granted' }; // Always granted for simple alerts
  }

  /**
   * Request notification permissions (always granted for Alert)
   */
  async requestPermissions(): Promise<any> {
    return { status: 'granted' }; // Always granted for simple alerts
  }
}

export default SafeNotificationService;
