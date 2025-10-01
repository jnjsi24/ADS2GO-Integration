import { gql } from '@apollo/client';

export const UPDATE_SUPERADMIN_NOTIFICATION_PREFERENCES = gql`
  mutation UpdateSuperAdminNotificationPreferences($input: UpdateSuperAdminNotificationPreferencesInput!) {
    updateSuperAdminNotificationPreferences(input: $input) {
      success
      message
      superAdmin {
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
  }
`;

export interface UpdateSuperAdminNotificationPreferencesInput {
  enableDesktopNotifications?: boolean;
  enableNotificationBadge?: boolean;
  pushNotificationTimeout?: string;
  communicationEmails?: boolean;
  announcementsEmails?: boolean;
  disableNotificationSounds?: boolean;
}

export interface UpdateSuperAdminNotificationPreferencesResponse {
  updateSuperAdminNotificationPreferences: {
    success: boolean;
    message: string;
    superAdmin: {
      id: string;
      notificationPreferences: {
        enableDesktopNotifications: boolean;
        enableNotificationBadge: boolean;
        pushNotificationTimeout: string;
        communicationEmails: boolean;
        announcementsEmails: boolean;
        disableNotificationSounds: boolean;
      };
    };
  };
}
