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

// Delete super admin notification
export const DELETE_SUPERADMIN_NOTIFICATION = gql`
  mutation DeleteSuperAdminNotification($notificationId: ID!) {
    deleteNotification(notificationId: $notificationId) {
      success
      message
    }
  }
`;

// Delete all super admin notifications
export const DELETE_ALL_SUPERADMIN_NOTIFICATIONS = gql`
  mutation DeleteAllSuperAdminNotifications {
    deleteAllNotifications {
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
      userStatistics {
        emailVerified
        emailUnverified
        hasLastLogin
        neverLoggedIn
        archived
        accountLocked
        googleAuth
        localAuth
      }
      driverStatistics {
        pendingApproval
        active
        suspended
        rejected
        resubmitted
        newThisMonth
        archived
      }
      adStatistics {
        active
        pending
        approved
        rejected
        running
        scheduled
        ended
        newThisMonth
        archived
      }
      # Removed planUsageStats - no longer using AdsPlan
    }
  }
`;

// Get monthly growth data
export const GET_SUPERADMIN_MONTHLY_GROWTH = gql`
  query GetSuperAdminMonthlyGrowth($months: Int) {
    getSuperAdminMonthlyGrowth(months: $months) {
      month
      year
      monthIndex
      users
      drivers
      ads
    }
  }
`;

// Removed GET_USER_COUNTS_BY_PLAN - no longer using AdsPlan

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
  totalPlans: number; // Removed - no longer using AdsPlan (kept for compatibility)
  totalRevenue: number;
  unreadNotifications: number;
  highPriorityNotifications: number;
  planUsageStats: any[]; // Removed PlanUsageStat - no longer using AdsPlan
}

// Removed PlanUsageStat and UserCountByPlan interfaces - no longer using AdsPlan
