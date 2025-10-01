import { gql } from '@apollo/client';

export const GET_USER_NOTIFICATIONS = gql`
  query GetUserNotifications {
    getUserNotifications {
      id
      title
      message
      type
      read
      createdAt
      adId
      adTitle
    }
  }
`;

export const MARK_NOTIFICATION_AS_READ = gql`
  mutation MarkNotificationAsRead($notificationId: ID!) {
    markNotificationAsRead(notificationId: $notificationId) {
      id
      read
      readAt
    }
  }
`;

export const MARK_ALL_NOTIFICATIONS_AS_READ = gql`
  mutation MarkAllNotificationsAsRead {
    markAllNotificationsAsRead {
      success
      message
    }
  }
`;

export const DELETE_NOTIFICATION = gql`
  mutation DeleteNotification($notificationId: ID!) {
    deleteNotification(notificationId: $notificationId) {
      success
      message
    }
  }
`;

export const DELETE_ALL_NOTIFICATIONS = gql`
  mutation DeleteAllNotifications {
    deleteAllNotifications {
      success
      message
    }
  }
`;

// TODO: Add real-time subscription when WebSocket is implemented
// export const NOTIFICATION_SUBSCRIPTION = gql`
//   subscription NotificationReceived {
//     notificationReceived {
//       id
//       title
//       message
//       type
//       read
//       createdAt
//       adId
//       adTitle
//     }
//   }
// `;

export const CREATE_NOTIFICATION = gql`
  mutation CreateNotification($input: CreateNotificationInput!) {
    createNotification(input: $input) {
      id
      title
      message
      type
      read
      createdAt
      adId
      adTitle
    }
  }
`;
