import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { formatDistanceToNow } from 'date-fns';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Trash2, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Info,
  Users,
  TrendingUp,
  DollarSign,
  CheckSquare,
  Square,
  ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
  GET_ADMIN_NOTIFICATIONS, 
  MARK_NOTIFICATION_READ, 
  MARK_ALL_NOTIFICATIONS_READ,
  DELETE_NOTIFICATION,
  DELETE_ALL_ADMIN_NOTIFICATIONS
} from '../../graphql/admin/queries';

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

const AdminNotifications: React.FC = () => {
  const navigate = useNavigate();
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'unread' | 'high'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState<Notification | null>(null);
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);

  // Fetch notifications
  const { data: notificationsData, loading: notificationsLoading, refetch: refetchNotifications } = useQuery(GET_ADMIN_NOTIFICATIONS, {
    pollInterval: 30000, // Refresh every 30 seconds
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

  // Delete notification
  const [deleteNotification] = useMutation(DELETE_NOTIFICATION, {
    onCompleted: () => {
      refetchNotifications();
      setShowDeleteModal(false);
      setNotificationToDelete(null);
    },
    onError: (error) => {
      console.error('Error deleting notification:', error);
    }
  });

  // Mark all notifications as read
  const [markAllAsRead] = useMutation(MARK_ALL_NOTIFICATIONS_READ, {
    onCompleted: () => {
      refetchNotifications();
    },
    onError: (error) => {
      console.error('Error marking all notifications as read:', error);
    }
  });

  // Delete all notifications
  const [deleteAllNotifications] = useMutation(DELETE_ALL_ADMIN_NOTIFICATIONS, {
    onCompleted: () => {
      refetchNotifications();
      setSelectedNotifications(new Set());
      setIsSelectMode(false);
    },
    onError: (error) => {
      console.error('Error deleting all notifications:', error);
    }
  });

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markAsRead({ variables: { notificationId } });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      await deleteNotification({ variables: { notificationId } });
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const handleDeleteAll = async () => {
    if (window.confirm('Are you sure you want to delete all notifications?')) {
      try {
        await deleteAllNotifications();
      } catch (error) {
        console.error('Error deleting all notifications:', error);
      }
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetchNotifications();
    } catch (error) {
      console.error('Error refreshing notifications:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const notifications: Notification[] = notificationsData?.getAdminNotifications?.notifications || [];
  const unreadCount = notificationsData?.getAdminNotifications?.unreadCount || 0;

  const filteredNotifications = notifications.filter(notification => {
    if (selectedFilter === 'unread') return !notification.read;
    if (selectedFilter === 'high') return notification.priority === 'HIGH';
    return true;
  });

  const getNotificationIcon = (category: string, type: string) => {
    switch (category) {
      case 'NEW_AD_SUBMISSION':
        return <Info className="w-5 h-5 text-blue-500" />;
      case 'NEW_USER_REGISTRATION':
        return <Users className="w-5 h-5 text-green-500" />;
      case 'NEW_DRIVER_APPLICATION':
        return <Users className="w-5 h-5 text-purple-500" />;
      case 'PAYMENT_SUCCESS':
        return <DollarSign className="w-5 h-5 text-green-600" />;
      case 'PAYMENT_FAILURE':
        return <DollarSign className="w-5 h-5 text-red-600" />;
      case 'PAYMENT_ISSUE':
        return <DollarSign className="w-5 h-5 text-red-500" />;
      case 'SYSTEM_ALERT':
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      default:
        return type === 'SUCCESS' ? <CheckCircle className="w-5 h-5 text-green-500" /> :
               type === 'WARNING' ? <AlertTriangle className="w-5 h-5 text-yellow-500" /> :
               type === 'ERROR' ? <AlertTriangle className="w-5 h-5 text-red-500" /> :
               <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'SUCCESS':
        return 'border-l-green-500 bg-green-50';
      case 'WARNING':
        return 'border-l-yellow-500 bg-yellow-50';
      case 'ERROR':
        return 'border-l-red-500 bg-red-50';
      default:
        return 'border-l-blue-500 bg-blue-50';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-red-100 text-red-800';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800';
      case 'LOW':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Selection helper functions
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

  const handleDeleteSelected = async () => {
    if (selectedNotifications.size === 0) return;
    
    if (selectedNotifications.size === filteredNotifications.length) {
      await handleDeleteAll();
    } else {
      for (const notificationId of selectedNotifications) {
        await handleDeleteNotification(notificationId);
      }
    }
    
    setSelectedNotifications(new Set());
    setIsSelectMode(false);
  };

  if (notificationsLoading) {
    return (
      <div className="p-8 pl-72 bg-[#f9f9fc] min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 pl-72 bg-[#f9f9fc] min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </button>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Bell className="w-8 h-8 text-blue-600" />
              Notifications
            </h1>
            <p className="text-gray-600 mt-2">
              {notifications.length} total notifications • {unreadCount} unread
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Filter buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setSelectedFilter('unread')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedFilter === 'unread'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Unread ({unreadCount})
            </button>
            <button
              onClick={() => setSelectedFilter('high')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedFilter === 'high'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              High Priority ({notifications.filter(n => n.priority === 'HIGH').length})
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            {filteredNotifications.length > 0 && (
              <>
                <button
                  onClick={() => setIsSelectMode(!isSelectMode)}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  {isSelectMode ? (
                    <>
                      <Square className="w-4 h-4" />
                      <span>Cancel</span>
                    </>
                  ) : (
                    <>
                      <CheckSquare className="w-4 h-4" />
                      <span>Select</span>
                    </>
                  )}
                </button>
                
                {isSelectMode && (
                  <>
                    <button
                      onClick={toggleSelectAll}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      {selectedNotifications.size === filteredNotifications.length ? (
                        <>
                          <Square className="w-4 h-4" />
                          <span>Deselect All</span>
                        </>
                      ) : (
                        <>
                          <CheckSquare className="w-4 h-4" />
                          <span>Select All</span>
                        </>
                      )}
                    </button>
                    
                    {selectedNotifications.size > 0 && (
                      <button
                        onClick={handleDeleteSelected}
                        className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete Selected ({selectedNotifications.size})</span>
                      </button>
                    )}
                  </>
                )}
              </>
            )}
            
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center space-x-2 px-4 py-2 bg-[#3674B5] text-white rounded-lg hover:bg-[#1B5087] disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <CheckCheck className="w-4 h-4" />
                <span>Mark All Read</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-2xl shadow-sm">
        {filteredNotifications.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">No notifications</h3>
            <p className="text-gray-500">
              {selectedFilter === 'all' 
                ? "You don't have any notifications yet."
                : selectedFilter === 'unread'
                ? "You don't have any unread notifications."
                : "You don't have any high priority notifications."
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-6 border-l-4 ${getNotificationColor(notification.type)} ${
                  !notification.read ? 'bg-blue-50' : 'bg-white'
                } hover:bg-gray-50 transition-colors`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    {/* Selection checkbox */}
                    {isSelectMode && (
                      <button
                        onClick={() => toggleSelectNotification(notification.id)}
                        className="mt-1"
                      >
                        {selectedNotifications.has(notification.id) ? (
                          <CheckSquare className="w-5 h-5 text-blue-600" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                    )}
                    
                    {/* Notification icon */}
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.category, notification.type)}
                    </div>
                    
                    {/* Notification content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className={`text-lg font-semibold ${!notification.read ? 'text-gray-900' : 'text-gray-700'}`}>
                          {notification.title}
                        </h3>
                        {!notification.read && (
                          <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                        )}
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(notification.priority)}`}>
                          {notification.priority}
                        </span>
                      </div>
                      
                      <p className="text-gray-600 mb-3 leading-relaxed">
                        {notification.message}
                      </p>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>
                            {(() => {
                              try {
                                const date = new Date(notification.createdAt);
                                if (isNaN(date.getTime())) {
                                  return 'Unknown time';
                                }
                                return formatDistanceToNow(date, { addSuffix: true });
                              } catch (error) {
                                console.error('Error formatting date:', error, notification.createdAt);
                                return 'Unknown time';
                              }
                            })()}
                          </span>
                        </div>
                        {notification.adTitle && (
                          <div className="flex items-center gap-1">
                            <span>Ad: {notification.adTitle}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Action buttons */}
                  <div className="flex items-center gap-2 ml-4">
                    {!notification.read && (
                      <button
                        onClick={() => handleMarkAsRead(notification.id)}
                        className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                        title="Mark as read"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setNotificationToDelete(notification);
                        setShowDeleteModal(true);
                      }}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete notification"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && notificationToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete Notification</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this notification? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setNotificationToDelete(null);
                }}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteNotification(notificationToDelete.id)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminNotifications;
