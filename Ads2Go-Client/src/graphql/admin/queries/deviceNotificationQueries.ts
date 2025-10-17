import { gql } from '@apollo/client';

export const GET_DEVICE_NOTIFICATIONS = gql`
  query GetDeviceNotifications {
    getDeviceNotifications {
      notifications {
        id
        title
        message
        type
        category
        priority
        read
        readAt
        adId
        adTitle
        data
        createdAt
        updatedAt
      }
      unreadCount
    }
  }
`;

export const GET_ADMIN_GENERAL_NOTIFICATIONS = gql`
  query GetAdminGeneralNotifications {
    getAdminGeneralNotifications {
      notifications {
        id
        title
        message
        type
        category
        priority
        read
        readAt
        adId
        adTitle
        data
        createdAt
        updatedAt
      }
      unreadCount
    }
  }
`;

export const MARK_DEVICE_NOTIFICATION_READ = gql`
  mutation MarkDeviceNotificationRead($notificationId: ID!) {
    markNotificationRead(notificationId: $notificationId) {
      success
      message
    }
  }
`;

export const MARK_ALL_DEVICE_NOTIFICATIONS_READ = gql`
  mutation MarkAllDeviceNotificationsRead {
    markAllNotificationsRead {
      success
      message
    }
  }
`;

export const DELETE_DEVICE_NOTIFICATION = gql`
  mutation DeleteDeviceNotification($notificationId: ID!) {
    deleteNotification(notificationId: $notificationId) {
      success
      message
    }
  }
`;

export const DELETE_ALL_DEVICE_NOTIFICATIONS = gql`
  mutation DeleteAllDeviceNotifications {
    deleteAllNotifications {
      success
      message
    }
  }
`;

export const GET_PENDING_ADS = gql`
  query GetPendingAds {
    getPendingAds {
      id
      title
      status
      createdAt
      user {
        firstName
        lastName
      }
      materialId
      planId
    }
  }
`;

export const GET_PENDING_MATERIALS = gql`
  query GetPendingMaterials {
    getPendingMaterials {
      id
      materialId
      materialType
      vehicleType
      category
      createdAt
      driver {
        firstName
        lastName
      }
    }
  }
`;
