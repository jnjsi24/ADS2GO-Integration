import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_ADMIN_NOTIFICATION_PREFERENCES } from '../graphql/admin/queries/getAdminNotificationPreferences';
import { UPDATE_ADMIN_NOTIFICATION_PREFERENCES } from '../graphql/admin/mutations/updateAdminNotificationPreferences';
import { useAdminAuth } from './AdminAuthContext';

interface NotificationSettings {
  enableDesktopNotifications: boolean;
  enableNotificationBadge: boolean;
  pushNotificationTimeout: string;
  communicationEmails: boolean;
  announcementsEmails: boolean;
}

interface AdminNotificationSettingsContextType {
  notificationSettings: NotificationSettings;
  updateNotificationSetting: (field: keyof NotificationSettings, value: boolean | string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  refetchSettings: () => void;
}

const AdminNotificationSettingsContext = createContext<AdminNotificationSettingsContextType | undefined>(undefined);

interface AdminNotificationSettingsProviderProps {
  children: ReactNode;
}

export const AdminNotificationSettingsProvider: React.FC<AdminNotificationSettingsProviderProps> = ({ children }) => {
  const { admin, isAuthenticated } = useAdminAuth();
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    enableDesktopNotifications: false,
    enableNotificationBadge: true,
    pushNotificationTimeout: '10',
    communicationEmails: false,
    announcementsEmails: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch notification preferences
  const { loading: preferencesLoading, refetch: refetchPreferences } = useQuery(
    GET_ADMIN_NOTIFICATION_PREFERENCES,
    {
      skip: !isAuthenticated || !admin,
      onCompleted: (data) => {
        console.log('🔔 AdminNotificationSettings: Preferences loaded:', data);
        if (data?.getAdminNotificationPreferences) {
          setNotificationSettings({
            enableDesktopNotifications: data.getAdminNotificationPreferences.enableDesktopNotifications,
            enableNotificationBadge: data.getAdminNotificationPreferences.enableNotificationBadge,
            pushNotificationTimeout: data.getAdminNotificationPreferences.pushNotificationTimeout,
            communicationEmails: data.getAdminNotificationPreferences.communicationEmails,
            announcementsEmails: data.getAdminNotificationPreferences.announcementsEmails,
          });
        }
        setIsLoading(false);
        setError(null);
      },
      onError: (error) => {
        console.error('❌ AdminNotificationSettings: Error fetching preferences:', error);
        setError('Failed to load notification preferences');
        setIsLoading(false);
      }
    }
  );

  // Update notification preferences mutation
  const [updateNotificationPreferences] = useMutation(UPDATE_ADMIN_NOTIFICATION_PREFERENCES, {
    onCompleted: (data) => {
      console.log('🔔 AdminNotificationSettings: Preferences updated:', data);
      if (data?.updateAdminNotificationPreferences?.success) {
        // Optionally show success message
        console.log('✅ Notification preferences updated successfully');
      }
    },
    onError: (error) => {
      console.error('❌ AdminNotificationSettings: Error updating preferences:', error);
      setError('Failed to update notification preferences');
    }
  });

  const updateNotificationSetting = async (field: keyof NotificationSettings, value: boolean | string) => {
    try {
      setError(null);
      
      // Optimistically update the local state
      const updatedSettings = { ...notificationSettings, [field]: value };
      setNotificationSettings(updatedSettings);

      // Update on the server
      await updateNotificationPreferences({
        variables: {
          input: {
            [field]: value
          }
        }
      });

      console.log('🔔 AdminNotificationSettings: Setting updated successfully:', field, value);
    } catch (error) {
      console.error('❌ AdminNotificationSettings: Error updating setting:', error);
      // Revert the optimistic update on error
      setNotificationSettings(notificationSettings);
      setError('Failed to update notification preference');
      throw error;
    }
  };

  const refetchSettings = () => {
    refetchPreferences();
  };

  // Update loading state based on preferences loading
  useEffect(() => {
    setIsLoading(preferencesLoading);
  }, [preferencesLoading]);

  const contextValue: AdminNotificationSettingsContextType = {
    notificationSettings,
    updateNotificationSetting,
    isLoading,
    error,
    refetchSettings,
  };

  return (
    <AdminNotificationSettingsContext.Provider value={contextValue}>
      {children}
    </AdminNotificationSettingsContext.Provider>
  );
};

export const useAdminNotificationSettings = (): AdminNotificationSettingsContextType => {
  const context = useContext(AdminNotificationSettingsContext);
  if (!context) {
    throw new Error('useAdminNotificationSettings must be used within an AdminNotificationSettingsProvider');
  }
  return context;
};
