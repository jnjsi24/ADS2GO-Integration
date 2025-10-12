import { Alert } from 'react-native';

export interface SimpleNotificationData {
  materialId?: string;
  materialName?: string;
  category?: string;
  priority?: string;
  [key: string]: any;
}

class SimpleNotificationService {
  private static instance: SimpleNotificationService;

  static getInstance(): SimpleNotificationService {
    if (!SimpleNotificationService.instance) {
      SimpleNotificationService.instance = new SimpleNotificationService();
    }
    return SimpleNotificationService.instance;
  }

  /**
   * Show a simple alert notification (works everywhere)
   */
  showAlert(title: string, message: string, data?: SimpleNotificationData): void {
    console.log(`📢 Notification: ${title} - ${message}`, data);
    
    Alert.alert(
      title,
      message,
      [
        {
          text: 'OK',
          onPress: () => {
            if (data?.category === 'MATERIAL_ASSIGNMENT') {
              this.handleMaterialAssignment(data);
            } else if (data?.category === 'DRIVER_STATUS_CHANGE') {
              this.handleDriverStatusChange(data);
            } else if (data?.category === 'ROUTE_UPDATE') {
              this.handleRouteUpdate(data);
            }
          },
        },
      ]
    );
  }

  /**
   * Show material assignment notification
   */
  showMaterialAssignmentNotification(materialName: string, materialId: string): void {
    this.showAlert(
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
   * Show driver status notification
   */
  showDriverStatusNotification(message: string): void {
    this.showAlert(
      '📋 Status Update',
      message,
      {
        category: 'DRIVER_STATUS_CHANGE',
        priority: 'MEDIUM'
      }
    );
  }

  /**
   * Show route update notification
   */
  showRouteUpdateNotification(message: string): void {
    this.showAlert(
      '🗺️ Route Updated',
      message,
      {
        category: 'ROUTE_UPDATE',
        priority: 'MEDIUM'
      }
    );
  }

  /**
   * Handle material assignment
   */
  private handleMaterialAssignment(data: SimpleNotificationData): void {
    console.log('🚚 Handling material assignment:', data);
    // You can add navigation logic here
  }

  /**
   * Handle driver status change
   */
  private handleDriverStatusChange(data: SimpleNotificationData): void {
    console.log('📋 Handling driver status change:', data);
    // You can add navigation logic here
  }

  /**
   * Handle route update
   */
  private handleRouteUpdate(data: SimpleNotificationData): void {
    console.log('🗺️ Handling route update:', data);
    // You can add navigation logic here
  }

  /**
   * Initialize (always succeeds)
   */
  async initialize(): Promise<boolean> {
    console.log('✅ Simple notification service initialized');
    return true;
  }

  /**
   * Register (always succeeds)
   */
  async register(): Promise<boolean> {
    console.log('✅ Simple notification service registered');
    return true;
  }
}

export default SimpleNotificationService;
