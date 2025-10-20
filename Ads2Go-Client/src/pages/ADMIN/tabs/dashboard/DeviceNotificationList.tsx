import React, { useState, useEffect } from 'react';
import { motion, Transition } from 'framer-motion';
import { useQuery, useMutation } from '@apollo/client';
import { 
  Bell, 
  CheckSquare, 
  Square, 
  ArrowUpRight, 
  Wifi, 
  WifiOff, 
  Target, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Smartphone
} from 'lucide-react';
import { GET_DEVICE_NOTIFICATIONS, MARK_DEVICE_NOTIFICATION_READ, DELETE_DEVICE_NOTIFICATION } from '../../../../graphql/admin/queries/deviceNotificationQueries';

interface DeviceNotification {
  id: string;
  title: string;
  message: string;
  type: 'SUCCESS' | 'INFO' | 'WARNING' | 'ERROR';
  category: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  read: boolean;
  createdAt: string;
  data?: any;
}

interface DeviceNotificationListProps {
  maxNotifications?: number;
}

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

const transition: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 26,
};

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

const DeviceNotificationList: React.FC<DeviceNotificationListProps> = ({ maxNotifications = 3 }) => {
  const [selectedFilter] = useState<'all' | 'unread' | 'high'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);

  // Fetch device notifications
  const { data: notificationsData, loading: notificationsLoading, error: notificationsError, refetch: refetchNotifications } = useQuery(GET_DEVICE_NOTIFICATIONS, {
    pollInterval: 30000,
  });

  // Handle query errors
  useEffect(() => {
    if (notificationsError) {
      console.error('Error fetching device notifications:', notificationsError);
    }
  }, [notificationsError]);

  // Mark notification as read
  const [markAsRead] = useMutation(MARK_DEVICE_NOTIFICATION_READ, {
    onCompleted: () => {
      refetchNotifications();
    },
    onError: (error) => {
      console.error('Error marking device notification as read:', error);
    }
  });

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markAsRead({ variables: { notificationId } });
    } catch (error) {
      console.error('Error marking device notification as read:', error);
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
      console.error('Error refreshing device notifications:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const notifications: DeviceNotification[] = notificationsData?.getDeviceNotifications?.notifications || [];

  const filteredNotifications = notifications.filter(notification => {
    if (selectedFilter === 'unread') return !notification.read;
    if (selectedFilter === 'high') return notification.priority === 'HIGH';
    return true;
  });

  const getDeviceNotificationIcon = (category: string, type: string) => {
    switch (category) {
      case 'DEVICE_ONLINE':
        return <Wifi className="w-5 h-5 text-green-500" />;
      case 'DEVICE_OFFLINE':
        return <WifiOff className="w-5 h-5 text-red-500" />;
      case 'MILESTONE_ACHIEVED':
        return <Target className="w-5 h-5 text-blue-500" />;
      case 'DEVICE_ERROR':
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'DEVICE_SYNC':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'DEVICE_STATUS':
        return <Smartphone className="w-5 h-5 text-purple-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    if (!dateString) return 'Unknown time';
    
    let date;
    if (typeof dateString === 'string' && /^\d+$/.test(dateString)) {
      date = new Date(parseInt(dateString));
    } else {
      date = new Date(dateString);
    }
    
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'text-red-600';
      case 'MEDIUM':
        return 'text-yellow-600';
      case 'LOW':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
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
      {/* Device Notifications List */}
      <motion.div
        className="bg-white dark:bg-neutral-900 p-3 rounded-xl w-full h-full space-y-3 shadow-md flex flex-col"
        initial="collapsed"
        whileHover="expanded"
      >
        <div className="flex-1 overflow-hidden">
          {filteredNotifications.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No device notifications found</p>
            </div>
          ) : (
            filteredNotifications.slice(0, maxNotifications).map((notification, i) => (
              <motion.div
                key={notification.id}
                className="bg-gray-100 dark:bg-neutral-800 rounded-xl px-4 py-2 shadow-sm hover:shadow-lg transition-shadow duration-200 relative h-16"
                variants={getCardVariants(i)}
                transition={transition}
                style={{ zIndex: filteredNotifications.length - i }}
              >
                <div className="flex items-center justify-between h-full">
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
                    {getDeviceNotificationIcon(notification.category, notification.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h1 className="text-sm font-medium truncate">{notification.title}</h1>
                        {!notification.read && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                        )}
                        <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${
                          notification.priority === 'HIGH' ? 'bg-red-100 text-red-600' :
                          notification.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-600' :
                          'bg-green-100 text-green-600'
                        }`}>
                          {notification.priority}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-500 font-medium truncate">
                        <span>{formatTimeAgo(notification.createdAt)}</span>
                        &nbsp;•&nbsp;
                        <span>
                          {notification.message.length > 25 
                            ? `${notification.message.substring(0, 25)}...` 
                            : notification.message
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                  {!notification.read && (
                    <button
                      onClick={() => handleMarkAsRead(notification.id)}
                      className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                      title="Mark as read"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  )}
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
                Device Notifications
              </motion.span>
              <motion.a
                href="/admin/ads?tab=notifications"
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

export default DeviceNotificationList;
