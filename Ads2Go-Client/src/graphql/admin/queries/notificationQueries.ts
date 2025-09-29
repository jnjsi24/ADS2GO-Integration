import { gql } from '@apollo/client';

export const GET_ADMIN_NOTIFICATIONS = gql`
  query GetAdminNotifications {
    getAdminNotifications {
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

export const MARK_NOTIFICATION_READ = gql`
  mutation MarkNotificationRead($notificationId: ID!) {
    markNotificationRead(notificationId: $notificationId) {
      success
      message
    }
  }
`;

export const MARK_ALL_NOTIFICATIONS_READ = gql`
  mutation MarkAllNotificationsRead {
    markAllNotificationsRead {
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

export const DELETE_ALL_ADMIN_NOTIFICATIONS = gql`
  mutation DeleteAllAdminNotifications {
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

export const GET_ADMIN_DASHBOARD_STATS = gql`
  query GetAdminDashboardStats {
    getAdminDashboardStats {
      totalAds
      pendingAds
      activeAds
      totalUsers
      newUsersToday
      totalDrivers
      newDriversToday
      pendingDrivers
      totalRevenue
      revenueToday
      unreadNotifications
      highPriorityNotifications
    }
  }
`;
