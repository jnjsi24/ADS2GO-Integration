'use client';
import React, { useState } from 'react';
import { Bell, ArrowUpRight, RefreshCw, CheckSquare, Square, AlertTriangle, DollarSign, Users, FileText } from 'lucide-react';
import { motion, type Transition } from 'framer-motion';
import { useQuery, useMutation } from '@apollo/client';
import { GET_ADMIN_NOTIFICATIONS, MARK_NOTIFICATION_READ } from '../../../../graphql/admin/queries';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'SUCCESS' | 'INFO' | 'WARNING' | 'ERROR';
  category: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  read: boolean;
  createdAt: string;
  adId?: string;
  adTitle?: string;
  data?: any;
}

interface DynamicNotificationListProps {
  pendingAdsCount?: number;
}

const transition: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 26,
};

const getCardVariants = (i: number) => ({
  collapsed: {
    marginTop: i === 0 ? 0 : -44,
    scaleX: 1 - i * 0.05,
  },
  expanded: {
    marginTop: i === 0 ? 0 : 4,
    scaleX: 1,
  },
});

const textSwitchTransition: Transition = {
  duration: 0.22,
  ease: 'easeInOut',
};

const notificationTextVariants = {
  collapsed: { opacity: 1, y: 0, pointerEvents: 'auto' },
  expanded: { opacity: 0, y: -16, pointerEvents: 'none' },
};

const viewAllTextVariants = {
  collapsed: { opacity: 0, y: 16, pointerEvents: 'none' },
  expanded: { opacity: 1, y: 0, pointerEvents: 'auto' },
};

const DynamicNotificationList: React.FC<DynamicNotificationListProps> = ({ pendingAdsCount }) => {
  const [selectedFilter] = useState<'all' | 'unread' | 'high'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);

  // Fetch notifications
  const { data: notificationsData, loading: notificationsLoading, refetch: refetchNotifications } = useQuery(GET_ADMIN_NOTIFICATIONS, {
    pollInterval: 30000,
    onError: (error) => {
      console.error('Error fetching notifications:', error);
    }
  });

  // Mark notification as read
  const [markAsRead] = useMutation(MARK_NOTIFICATION_READ, {
    onCompleted: () => {
      refetchNotifications();
    },
    onError: (error) => {
      console.error('Error marking notification as read:', error);
    }
  });

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markAsRead({ variables: { notificationId } });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const toggleSelectAll = () => {
    if (selectedNotifications.size === filteredNotifications.length) {
      setSelectedNotifications(new Set());
    } else {
      setSelectedNotifications(new Set(filteredNotifications.map(n => n.id)));
    }
  };

  const toggleSelectNotification = (notificationId: string) => {
    const newSelected = new Set(selectedNotifications);
    if (newSelected.has(notificationId)) {
      newSelected.delete(notificationId);
    } else {
      newSelected.add(notificationId);
    }
    setSelectedNotifications(newSelected);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetchNotifications();
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const notifications: Notification[] = notificationsData?.getAdminNotifications?.notifications || [];

  const filteredNotifications = notifications.filter(notification => {
    if (selectedFilter === 'unread') return !notification.read;
    if (selectedFilter === 'high') return notification.priority === 'HIGH';
    return true;
  });

  const getNotificationIcon = (category: string) => {
    switch (category) {
      case 'NEW_AD_SUBMISSION':
        return <FileText className="w-5 h-5 text-blue-500" />;
      case 'NEW_USER_REGISTRATION':
        return <Users className="w-5 h-5 text-green-500" />;
      case 'NEW_DRIVER_APPLICATION':
        return <Users className="w-5 h-5 text-purple-500" />;
      case 'PAYMENT_SUCCESS':
        return <DollarSign className="w-6 h-6 text-green-600" />;
      case 'PAYMENT_FAILURE':
        return <DollarSign className="w-5 h-5 text-red-600" />;
      case 'PAYMENT_ISSUE':
        return <DollarSign className="w-5 h-5 text-red-500" />;
      case 'SYSTEM_ALERT':
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  if (notificationsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notifications List */}
      <motion.div
        className="bg-white dark:bg-neutral-900 p-3 rounded-xl w-full space-y-3 shadow-md"
        initial="collapsed"
        whileHover="expanded"
      >
        <div>
          {filteredNotifications.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No notifications found</p>
            </div>
          ) : (
            filteredNotifications.slice(0, 3).map((notification, i) => (
              <motion.div
                key={notification.id}
                className="bg-gray-100 dark:bg-neutral-800 rounded-xl px-4 py-2 shadow-sm hover:shadow-lg transition-shadow duration-200 relative"
                variants={getCardVariants(i)}
                transition={transition}
                style={{ zIndex: filteredNotifications.length - i }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {isSelectMode && (
                      <button
                        onClick={() => toggleSelectNotification(notification.id)}
                        className="mt-1 p-1 hover:bg-gray-100 rounded transition-colors"
                      >
                        {selectedNotifications.has(notification.id) ? (
                          <CheckSquare size={20} className="text-blue-600" />
                        ) : (
                          <Square size={20} className="text-gray-400" />
                        )}
                      </button>
                    )}
                    {getNotificationIcon(notification.category)}
                    <div>
                      <div className="flex items-center gap-2">
                        <h1 className="text-sm font-medium">{notification.title}</h1>
                        {!notification.read && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        )}
                      </div>
                      <div className="text-xs text-neutral-500 font-medium">
                        <span>{formatTimeAgo(notification.createdAt)}</span>
                        &nbsp;•&nbsp;
                        <span>{notification.message}</span>
                        {notification.adTitle && (
                          <>
                            &nbsp;|&nbsp;
                            <span>Ad: {notification.adTitle}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
        {filteredNotifications.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="size-5 rounded-full bg-neutral-400 text-white text-xs flex items-center justify-center font-medium">
              {filteredNotifications.length}
            </div>
            <span className="grid">
              <motion.span
                className="text-sm font-medium text-neutral-600 dark:text-neutral-300 row-start-1 col-start-1"
                variants={notificationTextVariants}
                transition={textSwitchTransition}
              >
                Notifications
              </motion.span>
              <motion.a
                href="/admin/ads"
                className="text-sm font-medium text-neutral-600 dark:text-neutral-300 flex items-center gap-1 cursor-pointer select-none row-start-1 col-start-1"
                variants={viewAllTextVariants}
                transition={textSwitchTransition}
              >
                View all <ArrowUpRight className="size-4" />
              </motion.a>
            </span>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default DynamicNotificationList;