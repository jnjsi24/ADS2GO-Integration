import { gql } from '@apollo/client';

export const GET_ADMIN_NOTIFICATION_PREFERENCES = gql`
  query GetAdminNotificationPreferences {
    getAdminNotificationPreferences {
      enableDesktopNotifications
      enableNotificationBadge
      pushNotificationTimeout
      communicationEmails
      announcementsEmails
    }
  }
`;
