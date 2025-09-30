import { gql } from '@apollo/client';

export const UPDATE_USER_NOTIFICATION_PREFERENCES = gql`
  mutation UpdateUserNotificationPreferences($input: UpdateUserNotificationPreferencesInput!) {
    updateUserNotificationPreferences(input: $input) {
      success
      message
      user {
        id
        firstName
        lastName
        email
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
