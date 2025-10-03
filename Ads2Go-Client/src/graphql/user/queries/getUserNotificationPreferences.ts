import { gql } from '@apollo/client';

export const GET_USER_NOTIFICATION_PREFERENCES = gql`
  query GetUserNotificationPreferences {
    getUserNotificationPreferences {
      enableDesktopNotifications
      enableNotificationBadge
      pushNotificationTimeout
      communicationEmails
      announcementsEmails
    }
  }
`;
