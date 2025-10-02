import { gql } from '@apollo/client';

export const GET_SUPERADMIN_NOTIFICATION_PREFERENCES = gql`
  query GetSuperAdminNotificationPreferences {
    getOwnSuperAdminDetails {
      id
      notificationPreferences {
        enableDesktopNotifications
        enableNotificationBadge
        pushNotificationTimeout
        communicationEmails
        announcementsEmails
        disableNotificationSounds
      }
    }
  }
`;

export interface SuperAdminNotificationPreferences {
  enableDesktopNotifications: boolean;
  enableNotificationBadge: boolean;
  pushNotificationTimeout: string;
  communicationEmails: boolean;
  announcementsEmails: boolean;
  disableNotificationSounds: boolean;
}

export interface GetSuperAdminNotificationPreferencesResponse {
  getOwnSuperAdminDetails: {
    id: string;
    notificationPreferences: SuperAdminNotificationPreferences;
  };
}
