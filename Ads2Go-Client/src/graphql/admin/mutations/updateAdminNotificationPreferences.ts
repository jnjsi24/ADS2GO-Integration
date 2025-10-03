import { gql } from '@apollo/client';

export const UPDATE_ADMIN_NOTIFICATION_PREFERENCES = gql`
  mutation UpdateAdminNotificationPreferences($input: UpdateAdminNotificationPreferencesInput!) {
    updateAdminNotificationPreferences(input: $input) {
      success
      message
      admin {
        id
        notificationPreferences {
          enableDesktopNotifications
          enableNotificationBadge
          pushNotificationTimeout
          communicationEmails
          announcementsEmails
        }
      }
    }
  }
`;
