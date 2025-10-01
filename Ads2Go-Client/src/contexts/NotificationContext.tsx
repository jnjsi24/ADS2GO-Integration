import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_USER_NOTIFICATIONS, MARK_NOTIFICATION_AS_READ, MARK_ALL_NOTIFICATIONS_AS_READ, DELETE_NOTIFICATION } from '../graphql/notifications';
import { GET_USER_NOTIFICATION_PREFERENCES } from '../graphql/user/queries/getUserNotificationPreferences';
import { GET_USER_NOTIFICATIONS, MARK_NOTIFICATION_AS_READ, MARK_ALL_NOTIFICATIONS_AS_READ, DELETE_NOTIFICATION, DELETE_ALL_NOTIFICATIONS } from '../graphql/notifications';
import { useUserAuth } from './UserAuthContext';
import ConfirmationModal from '../components/ConfirmationModal';

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
  displayBadgeCount: number; // This will be 0 if badge is disabled, otherwise same as unreadCount
  enableNotificationBadge: boolean;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => void;
  removeNotification: (notificationId: string) => Promise<void>;
  deleteAllNotifications: () => Promise<void>;
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
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState<Notification | null>(null);
  const [enableNotificationBadge, setEnableNotificationBadge] = useState(true); // Default to true
  const { user, isAuthenticated } = useUserAuth();

  // GraphQL mutations
  const [markNotificationAsReadMutation] = useMutation(MARK_NOTIFICATION_AS_READ);
  const [markAllNotificationsAsReadMutation] = useMutation(MARK_ALL_NOTIFICATIONS_AS_READ);
  const [deleteNotificationMutation] = useMutation(DELETE_NOTIFICATION);
  const [deleteAllNotificationsMutation] = useMutation(DELETE_ALL_NOTIFICATIONS);

  // Fetch user notification preferences
  const { data: preferencesData } = useQuery(GET_USER_NOTIFICATION_PREFERENCES, {
    skip: !isAuthenticated || !user,
    onCompleted: (data) => {
      console.log('🔔 Notification preferences loaded:', data);
      if (data?.getUserNotificationPreferences) {
        setEnableNotificationBadge(data.getUserNotificationPreferences.enableNotificationBadge);
      }
    },
    onError: (error) => {
      console.error('❌ Error fetching notification preferences:', error);
      // Keep default value (true) if there's an error
    }
  });

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
  const displayBadgeCount = enableNotificationBadge ? unreadCount : 0;

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

  const removeNotification = async (notificationId: string) => {
    // Find the notification to get its details for the confirmation dialog
    const notification = notifications.find(n => n.id === notificationId);
    
    if (!notification) {
      console.error('❌ Notification not found:', notificationId);
      return;
    }

    // Set the notification to delete and show confirmation modal
    setNotificationToDelete(notification);
    setShowDeleteConfirmation(true);
  };

  const handleConfirmDelete = async () => {
    if (!notificationToDelete) return;

    try {
      console.log('🗑️ Deleting notification:', notificationToDelete.id);
      
      // Update local state immediately for better UX
      setNotifications(prev => prev.filter(n => n.id !== notificationToDelete.id));

      // Call backend mutation
      const result = await deleteNotificationMutation({
        variables: { notificationId: notificationToDelete.id }
      });
      
      console.log('🔍 Delete notification result:', result);
      
      if (result.data?.deleteNotification?.success) {
        console.log('✅ Notification deleted successfully from server');
      } else {
        const errorMessage = result.data?.deleteNotification?.message || 'Failed to delete notification';
        console.error('❌ Delete notification failed:', errorMessage);
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('❌ Error deleting notification:', error);
      
      // Revert local state on error - add the notification back
      setNotifications(prev => {
        const updated = [...prev];
        // Insert back in the same position or at the beginning
        updated.unshift(notificationToDelete);
        return updated;
      });
      
      // Extract meaningful error message
      let errorMessage = 'Failed to delete notification. Please try again.';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        const apolloError = error as any;
        if (apolloError.graphQLErrors && apolloError.graphQLErrors.length > 0) {
          errorMessage = apolloError.graphQLErrors[0].message;
        } else if (apolloError.networkError) {
          errorMessage = 'Network error. Please check your connection and try again.';
        }
      }
      
      console.error('Failed to delete notification:', errorMessage);
      alert(errorMessage);
    } finally {
      // Close the modal and reset state
      setShowDeleteConfirmation(false);
      setNotificationToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    console.log('🚫 User cancelled notification deletion');
    setShowDeleteConfirmation(false);
    setNotificationToDelete(null);
  };

  const deleteAllNotifications = async () => {
    try {
      console.log('🗑️ Deleting all notifications');
      
      // Update local state immediately for better UX
      setNotifications([]);

      // Call backend mutation
      const result = await deleteAllNotificationsMutation();
      
      console.log('🔍 Delete all notifications result:', result);
      
      if (result.data?.deleteAllNotifications?.success) {
        console.log('✅ All notifications deleted successfully from server');
      } else {
        const errorMessage = result.data?.deleteAllNotifications?.message || 'Failed to delete all notifications';
        console.error('❌ Delete all notifications failed:', errorMessage);
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('❌ Error deleting all notifications:', error);
      
      // Revert local state on error - refetch notifications
      await refreshNotifications();
      
      // Extract meaningful error message
      let errorMessage = 'Failed to delete all notifications. Please try again.';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        const apolloError = error as any;
        if (apolloError.graphQLErrors && apolloError.graphQLErrors.length > 0) {
          errorMessage = apolloError.graphQLErrors[0].message;
        } else if (apolloError.networkError) {
          errorMessage = 'Network error. Please check your connection and try again.';
        }
      }
      
      console.error('Failed to delete all notifications:', errorMessage);
      alert(errorMessage);
    }
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
    displayBadgeCount,
    enableNotificationBadge,
    markAsRead,
    markAllAsRead,
    addNotification,
    removeNotification,
    deleteAllNotifications,
    refreshNotifications,
    isLoading,
    error
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <ConfirmationModal
        isOpen={showDeleteConfirmation}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Delete Notification"
        message={notificationToDelete ? `Are you sure you want to delete this notification?\n\n"${notificationToDelete.title}"\n\nThis action cannot be undone.` : ''}
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
      />
    </NotificationContext.Provider>
  );
};
