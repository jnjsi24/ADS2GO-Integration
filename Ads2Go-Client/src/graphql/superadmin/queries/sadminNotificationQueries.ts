import { gql } from '@apollo/client';

/**
 * GraphQL Queries for Super Admin Notifications
 * This file contains all queries used for super admin notification management
 */

// Get super admin notifications query
export const GET_SUPERADMIN_NOTIFICATIONS = gql`
  query GetSuperAdminNotifications {
    getSuperAdminNotifications {
      notifications {
        id
        title
        message
        type
        category
        priority
        read
        readAt
        data
        createdAt
        updatedAt
      }
      unreadCount
    }
  }
`;

// Mark super admin notification as read
export const MARK_SUPERADMIN_NOTIFICATION_READ = gql`
  mutation MarkSuperAdminNotificationRead($notificationId: ID!) {
    markSuperAdminNotificationRead(notificationId: $notificationId) {
      success
      message
    }
  }
`;

// Mark all super admin notifications as read
export const MARK_ALL_SUPERADMIN_NOTIFICATIONS_READ = gql`
  mutation MarkAllSuperAdminNotificationsRead {
    markAllSuperAdminNotificationsRead {
      success
      message
    }
  }
`;

// Get super admin dashboard stats
export const GET_SUPERADMIN_DASHBOARD_STATS = gql`
  query GetSuperAdminDashboardStats {
    getSuperAdminDashboardStats {
      totalUsers
      totalAdmins
      totalDrivers
      totalAds
      totalPlans
      totalRevenue
      unreadNotifications
      highPriorityNotifications
      planUsageStats {
        planId
        planName
        userCount
        activeAdsCount
        totalRevenue
      }
    }
  }
`;

// Get user counts by plan
export const GET_USER_COUNTS_BY_PLAN = gql`
  query GetUserCountsByPlan {
    getUserCountsByPlan {
      planId
      planName
      planDescription
      userCount
      activeAdsCount
      totalRevenue
      planDetails {
        materialType
        vehicleType
        numberOfDevices
        durationDays
        totalPrice
      }
    }
  }
`;

// Type definitions for the queries
export interface SuperAdminNotification {
  id: string;
  title: string;
  message: string;
  type: 'SUCCESS' | 'INFO' | 'WARNING' | 'ERROR';
  category: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  read: boolean;
  readAt?: string;
  data?: any;
  createdAt: string;
  updatedAt: string;
}

export interface SuperAdminNotificationsResponse {
  notifications: SuperAdminNotification[];
  unreadCount: number;
}

export interface SuperAdminDashboardStats {
  totalUsers: number;
  totalAdmins: number;
  totalDrivers: number;
  totalAds: number;
  totalPlans: number;
  totalRevenue: number;
  unreadNotifications: number;
  highPriorityNotifications: number;
  planUsageStats: PlanUsageStat[];
}

export interface PlanUsageStat {
  planId: string;
  planName: string;
  userCount: number;
  activeAdsCount: number;
  totalRevenue: number;
}

export interface UserCountByPlan {
  planId: string;
  planName: string;
  planDescription: string;
  userCount: number;
  activeAdsCount: number;
  totalRevenue: number;
  planDetails: {
    materialType: string;
    vehicleType: string;
    numberOfDevices: number;
    durationDays: number;
    totalPrice: number;
  };
}
