import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_USER_NOTIFICATIONS, MARK_NOTIFICATION_AS_READ, MARK_ALL_NOTIFICATIONS_AS_READ } from '../graphql/notifications';
import { useUserAuth } from './UserAuthContext';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'SUCCESS' | 'INFO' | 'WARNING' | 'ERROR';
  read: boolean;
  createdAt: string;
  adId?: string;
  adTitle?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => void;
  removeNotification: (notificationId: string) => void;
  refreshNotifications: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isAuthenticated } = useUserAuth();

  // GraphQL mutations
  const [markNotificationAsReadMutation] = useMutation(MARK_NOTIFICATION_AS_READ);
  const [markAllNotificationsAsReadMutation] = useMutation(MARK_ALL_NOTIFICATIONS_AS_READ);

  // Debug user authentication
  console.log('🔔 NotificationContext: User auth state:', { user, isAuthenticated });

  // Fetch notifications
  const { data, loading, error: queryError, refetch } = useQuery(GET_USER_NOTIFICATIONS, {
    fetchPolicy: 'cache-and-network',
    skip: !isAuthenticated || !user, // Skip if user is not authenticated
    onCompleted: (data) => {
      console.log('🔔 NotificationContext: Query completed with data:', data);
      if (data?.getUserNotifications) {
        // Debug the createdAt values
        data.getUserNotifications.forEach((notif: Notification, index: number) => {
          console.log(`🔔 Notification ${index + 1} createdAt:`, notif.createdAt, typeof notif.createdAt);
        });
        setNotifications(data.getUserNotifications);
        console.log('🔔 NotificationContext: Set notifications:', data.getUserNotifications);
      } else {
        console.log('🔔 NotificationContext: No notifications found');
        setNotifications([]);
      }
      setIsLoading(false);
    },
    onError: (error) => {
      console.error('❌ NotificationContext: Error fetching notifications:', error);
      console.error('❌ NotificationContext: Error details:', error);
      setError(error.message);
      setIsLoading(false);
    }
  });

  // Debug the query state
  console.log('🔔 NotificationContext: Query state:', { data, loading, error: queryError });
  console.log('🔔 NotificationContext: User token check:', {
    hasUserToken: !!localStorage.getItem('userToken'),
    hasAdminToken: !!localStorage.getItem('adminToken'),
    userToken: localStorage.getItem('userToken')?.substring(0, 20) + '...',
  });

  // TODO: Add real-time notifications with WebSocket or polling
  // For now, notifications will be fetched on page load and refresh

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (notificationId: string) => {
    try {
      console.log('🔔 Marking notification as read:', notificationId);
      
      // Update local state immediately for better UX
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, read: true }
            : notification
        )
      );

      // Call backend mutation
      await markNotificationAsReadMutation({
        variables: { notificationId }
      });
      
      console.log('✅ Notification marked as read successfully');
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
      // Revert local state on error
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, read: false }
            : notification
        )
      );
    }
  };

  const markAllAsRead = async () => {
    try {
      console.log('🔔 Marking all notifications as read');
      
      // Update local state immediately for better UX
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, read: true }))
      );

      // Call backend mutation
      await markAllNotificationsAsReadMutation();
      
      console.log('✅ All notifications marked as read successfully');
    } catch (error) {
      console.error('❌ Error marking all notifications as read:', error);
      // Revert local state on error
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, read: false }))
      );
    }
  };

  const addNotification = (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `temp_${Date.now()}`,
      createdAt: new Date().toISOString(),
      read: false
    };
    setNotifications(prev => [newNotification, ...prev]);
  };

  const removeNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const refreshNotifications = async () => {
    console.log('🔔 Manual refresh triggered');
    console.log('🔔 Current auth state:', { user, isAuthenticated });
    console.log('🔔 Current token:', localStorage.getItem('userToken')?.substring(0, 20) + '...');
    
    try {
      const result = await refetch();
      console.log('🔔 Manual refresh result:', result);
      console.log('🔔 Manual refresh data:', result.data);
      console.log('🔔 Manual refresh errors:', result.errors);
    } catch (error) {
      console.error('🔔 Manual refresh error:', error);
      console.error('🔔 Manual refresh error details:', (error as any).message, (error as any).graphQLErrors, (error as any).networkError);
    }
  };

  const contextValue: NotificationContextType = {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    addNotification,
    removeNotification,
    refreshNotifications,
    isLoading,
    error
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};
