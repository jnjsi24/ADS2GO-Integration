import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery } from '@apollo/client';
import { GET_ADMIN_GENERAL_NOTIFICATIONS, GET_PENDING_ADS, GET_PENDING_MATERIALS } from '../graphql/admin/queries/notificationQueries';
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
  const { data: preferencesData, error: preferencesError } = useQuery(GET_ADMIN_NOTIFICATION_PREFERENCES, {
    skip: !isAuthenticated || !admin || admin.role === 'SUPERADMIN',
  });

  // Handle preferences data changes
  useEffect(() => {
    if (preferencesData?.getAdminNotificationPreferences) {
      setEnableNotificationBadge(preferencesData.getAdminNotificationPreferences.enableNotificationBadge);
    }
  }, [preferencesData]);

  // Handle preferences errors
  useEffect(() => {
    if (preferencesError) {
      console.error('❌ AdminNotificationContext: Error fetching preferences:', preferencesError);
      // Keep default value (true) if there's an error
    }
  }, [preferencesError]);

  // Fetch general admin notifications
  const { data, loading, error: queryError, refetch } = useQuery(GET_ADMIN_GENERAL_NOTIFICATIONS, {
    fetchPolicy: 'cache-and-network',
    skip: !isAuthenticated || !admin,
    pollInterval: 30000, // Refresh every 30 seconds for more frequent updates
  });

  // Handle notifications data loading with useEffect instead of onCompleted
  useEffect(() => {
    if (data) {
        if (data?.getAdminGeneralNotifications) {
          const notificationsArray = data.getAdminGeneralNotifications.notifications || [];
          setNotifications(notificationsArray);
        } else {
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
    pollInterval: 30000, // Refresh every 30 seconds for more frequent updates
  });

  // Handle pending ads data loading with useEffect instead of onCompleted
  useEffect(() => {
    if (pendingAdsData) {
      if (pendingAdsData?.getPendingAds) {
        setPendingAds(pendingAdsData.getPendingAds);
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
    pollInterval: 30000, // Refresh every 30 seconds for more frequent updates
  });

  // Handle pending materials data loading with useEffect instead of onCompleted
  useEffect(() => {
    if (pendingMaterialsData) {
      if (pendingMaterialsData?.getPendingMaterials) {
        setPendingMaterials(pendingMaterialsData.getPendingMaterials);
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


  const refetchNotifications = async () => {
    try {
      const result = await refetch();
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
