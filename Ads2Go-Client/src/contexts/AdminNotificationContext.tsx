import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery } from '@apollo/client';
import { GET_ADMIN_NOTIFICATIONS, GET_PENDING_ADS, GET_PENDING_MATERIALS } from '../graphql/admin/queries/notificationQueries';
import { GET_ADMIN_NOTIFICATION_PREFERENCES } from '../graphql/admin/queries/getAdminNotificationPreferences';
import { useAdminAuth } from './AdminAuthContext';

export interface AdminNotification {
  id: string;
  title: string;
  message: string;
  type: 'SUCCESS' | 'INFO' | 'WARNING' | 'ERROR';
  read: boolean;
  createdAt: string;
  adId?: string;
  adTitle?: string;
}

interface AdminNotificationContextType {
  notifications: AdminNotification[];
  unreadCount: number;
  displayBadgeCount: number; // This will be 0 if badge is disabled, otherwise same as unreadCount
  totalPendingCount: number; // Total of notifications + pending ads + pending materials
  totalDisplayCount: number; // Total count to display (respects badge setting)
  enableNotificationBadge: boolean;
  isLoading: boolean;
  error: string | null;
  refetchNotifications: () => void;
}

const AdminNotificationContext = createContext<AdminNotificationContextType | undefined>(undefined);

export const useAdminNotifications = () => {
  const context = useContext(AdminNotificationContext);
  if (!context) {
    throw new Error('useAdminNotifications must be used within an AdminNotificationProvider');
  }
  return context;
};

interface AdminNotificationProviderProps {
  children: ReactNode;
}

export const AdminNotificationProvider: React.FC<AdminNotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [pendingAds, setPendingAds] = useState<any[]>([]);
  const [pendingMaterials, setPendingMaterials] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enableNotificationBadge, setEnableNotificationBadge] = useState(true); // Default to true
  const { admin, isAuthenticated } = useAdminAuth();

  // Fetch admin notification preferences (skip for SuperAdmins)
  const { data: preferencesData } = useQuery(GET_ADMIN_NOTIFICATION_PREFERENCES, {
    skip: !isAuthenticated || !admin || admin.role === 'SUPERADMIN',
    onCompleted: (data) => {
      console.log('🔔 AdminNotificationContext: Preferences loaded:', data);
      console.log('🔔 AdminNotificationContext: Raw preferences data:', JSON.stringify(data, null, 2));
      if (data?.getAdminNotificationPreferences) {
        console.log('🔔 AdminNotificationContext: Setting enableNotificationBadge to:', data.getAdminNotificationPreferences.enableNotificationBadge);
        setEnableNotificationBadge(data.getAdminNotificationPreferences.enableNotificationBadge);
      } else {
        console.log('🔔 AdminNotificationContext: No preferences data found, keeping default:', enableNotificationBadge);
      }
    },
    onError: (error) => {
      console.error('❌ AdminNotificationContext: Error fetching preferences:', error);
      // Keep default value (true) if there's an error
    }
  });

  // Fetch admin notifications
  const { data, loading, error: queryError, refetch } = useQuery(GET_ADMIN_NOTIFICATIONS, {
    fetchPolicy: 'cache-and-network',
    skip: !isAuthenticated || !admin,
    pollInterval: 30000, // Refresh every 30 seconds
  });

  // Handle notifications data loading with useEffect instead of onCompleted
  useEffect(() => {
    if (data) {
      console.log('🔔 AdminNotificationContext: Query completed with data:', data);
      console.log('🔔 AdminNotificationContext: Raw notifications data:', JSON.stringify(data, null, 2));
      if (data?.getAdminNotifications) {
        const notificationsArray = data.getAdminNotifications.notifications || [];
        console.log('🔔 AdminNotificationContext: Notifications array:', notificationsArray);
        console.log('🔔 AdminNotificationContext: Unread count from backend:', data.getAdminNotifications.unreadCount);
        setNotifications(notificationsArray);
        console.log('🔔 AdminNotificationContext: Set notifications:', notificationsArray);
      } else {
        console.log('🔔 AdminNotificationContext: No notifications found');
        setNotifications([]);
      }
      setIsLoading(false);
    }
  }, [data]);

  // Handle notifications errors with useEffect instead of onError
  useEffect(() => {
    if (queryError) {
      console.error('❌ AdminNotificationContext: Error fetching notifications:', queryError);
      setError(queryError.message);
      setIsLoading(false);
    }
  }, [queryError]);

  // Fetch pending ads
  const { data: pendingAdsData, loading: pendingAdsLoading, error: pendingAdsError } = useQuery(GET_PENDING_ADS, {
    skip: !isAuthenticated || !admin,
    pollInterval: 30000,
  });

  // Handle pending ads data loading with useEffect instead of onCompleted
  useEffect(() => {
    if (pendingAdsData) {
      console.log('🔔 AdminNotificationContext: Pending ads data:', pendingAdsData);
      if (pendingAdsData?.getPendingAds) {
        setPendingAds(pendingAdsData.getPendingAds);
        console.log('🔔 AdminNotificationContext: Set pending ads:', pendingAdsData.getPendingAds);
      } else {
        setPendingAds([]);
      }
    }
  }, [pendingAdsData]);

  // Handle pending ads errors with useEffect instead of onError
  useEffect(() => {
    if (pendingAdsError) {
      console.error('❌ AdminNotificationContext: Error fetching pending ads:', pendingAdsError);
      setPendingAds([]);
    }
  }, [pendingAdsError]);

  // Fetch pending materials
  const { data: pendingMaterialsData, loading: pendingMaterialsLoading, error: pendingMaterialsError } = useQuery(GET_PENDING_MATERIALS, {
    skip: !isAuthenticated || !admin,
    pollInterval: 30000,
  });

  // Handle pending materials data loading with useEffect instead of onCompleted
  useEffect(() => {
    if (pendingMaterialsData) {
      console.log('🔔 AdminNotificationContext: Pending materials data:', pendingMaterialsData);
      if (pendingMaterialsData?.getPendingMaterials) {
        setPendingMaterials(pendingMaterialsData.getPendingMaterials);
        console.log('🔔 AdminNotificationContext: Set pending materials:', pendingMaterialsData.getPendingMaterials);
      } else {
        setPendingMaterials([]);
      }
    }
  }, [pendingMaterialsData]);

  // Handle pending materials errors with useEffect instead of onError
  useEffect(() => {
    if (pendingMaterialsError) {
      console.error('❌ AdminNotificationContext: Error fetching pending materials:', pendingMaterialsError);
      setPendingMaterials([]);
    }
  }, [pendingMaterialsError]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const displayBadgeCount = enableNotificationBadge ? unreadCount : 0;
  const totalPendingCount = unreadCount + pendingAds.length + pendingMaterials.length;
  const totalDisplayCount = enableNotificationBadge ? totalPendingCount : 0;

  // Debug logging
  console.log('🔔 AdminNotificationContext Debug:', {
    notificationsCount: notifications.length,
    unreadCount,
    enableNotificationBadge,
    displayBadgeCount,
    pendingAdsCount: pendingAds.length,
    pendingMaterialsCount: pendingMaterials.length,
    totalPendingCount,
    totalDisplayCount,
    notifications: notifications.map(n => ({ id: n.id, title: n.title, read: n.read }))
  });

  const refetchNotifications = async () => {
    console.log('🔔 AdminNotificationContext: Manual refresh triggered');
    try {
      const result = await refetch();
      console.log('🔔 AdminNotificationContext: Manual refresh result:', result);
    } catch (error) {
      console.error('🔔 AdminNotificationContext: Manual refresh error:', error);
    }
  };

  const contextValue: AdminNotificationContextType = {
    notifications,
    unreadCount,
    displayBadgeCount,
    totalPendingCount,
    totalDisplayCount,
    enableNotificationBadge,
    isLoading,
    error,
    refetchNotifications,
  };

  return (
    <AdminNotificationContext.Provider value={contextValue}>
      {children}
    </AdminNotificationContext.Provider>
  );
};
