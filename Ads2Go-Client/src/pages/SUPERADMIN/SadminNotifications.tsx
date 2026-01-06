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
  CheckSquare,
  Square
} from 'lucide-react';
import { 
  GET_SUPERADMIN_NOTIFICATIONS, 
  MARK_SUPERADMIN_NOTIFICATION_READ, 
  MARK_ALL_SUPERADMIN_NOTIFICATIONS_READ,
  DELETE_SUPERADMIN_NOTIFICATION,
  DELETE_ALL_SUPERADMIN_NOTIFICATIONS,
  SuperAdminNotification 
} from '../../graphql/superadmin/queries/sadminNotificationQueries';
import { AdminLoader } from "../../components/ProtectedRoute";
import ConfirmationModal from "../../components/ConfirmationModal";

const SadminNotifications: React.FC = () => {
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'unread' | 'high'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState<SuperAdminNotification | null>(null);
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);

  // Fetch notifications
  const { data: notificationsData, loading: notificationsLoading, refetch: refetchNotifications } = useQuery(GET_SUPERADMIN_NOTIFICATIONS, {
    pollInterval: 30000, // Refresh every 30 seconds
    onError: (error) => {
      console.error('Error fetching super admin notifications:', error);
    }
  });

  // Removed plan data fetch - no longer using AdsPlan
  const planData = null;

  // Mark notification as read
  const [markAsRead] = useMutation(MARK_SUPERADMIN_NOTIFICATION_READ, {
    onCompleted: () => {
      refetchNotifications();
    },
    onError: (error) => {
      console.error('Error marking notification as read:', error);
    }
  });

  // Mark all notifications as read
  const [markAllAsRead] = useMutation(MARK_ALL_SUPERADMIN_NOTIFICATIONS_READ, {
    onCompleted: () => {
      refetchNotifications();
    },
    onError: (error) => {
      console.error('Error marking all notifications as read:', error);
    }
  });

  // Delete notification
  const [deleteNotification] = useMutation(DELETE_SUPERADMIN_NOTIFICATION, {
    onCompleted: () => {
      refetchNotifications();
      setShowDeleteModal(false);
      setNotificationToDelete(null);
    },
    onError: (error) => {
      console.error('Error deleting notification:', error);
    }
  });

  // Delete all notifications
  const [deleteAllNotifications] = useMutation(DELETE_ALL_SUPERADMIN_NOTIFICATIONS, {
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
      await markAsRead({
        variables: { notificationId }
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
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

  const handleDeleteNotification = (notification: SuperAdminNotification) => {
    setNotificationToDelete(notification);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (notificationToDelete) {
      try {
        await deleteNotification({
          variables: { notificationId: notificationToDelete.id }
        });
      } catch (error) {
        console.error('Error deleting notification:', error);
      }
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setNotificationToDelete(null);
  };

  // Selection helper functions
  const toggleSelectAll = () => {
    if (selectedNotifications.size === filteredNotifications.length) {
      setSelectedNotifications(new Set());
    } else {
      setSelectedNotifications(new Set(filteredNotifications.map((n: SuperAdminNotification) => n.id)));
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
      // If all notifications are selected, use deleteAllNotifications
      await deleteAllNotifications();
    } else {
      // Delete selected notifications one by one
      const notificationIds = Array.from(selectedNotifications);
      for (const notificationId of notificationIds) {
        await deleteNotification({
          variables: { notificationId }
        });
      }
    }
    
    setSelectedNotifications(new Set());
    setIsSelectMode(false);
  };

  const handleDeleteAll = async () => {
    setShowDeleteAllModal(true);
  };

  const confirmDeleteAll = async () => {
    await deleteAllNotifications();
    setSelectedNotifications(new Set());
    setIsSelectMode(false);
    setShowDeleteAllModal(false);
  };

  const cancelDeleteAll = () => {
    setShowDeleteAllModal(false);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'SUCCESS':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'WARNING':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'ERROR':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
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

  const notifications = notificationsData?.getSuperAdminNotifications?.notifications || [];
  const unreadCount = notificationsData?.getSuperAdminNotifications?.unreadCount || 0;
  const planCounts = []; // Removed - no longer using AdsPlan

  // Filter notifications based on selected filter
  const filteredNotifications = notifications.filter((notification: SuperAdminNotification) => {
    switch (selectedFilter) {
      case 'unread':
        return !notification.read;
      case 'high':
        return notification.priority === 'HIGH';
      default:
        return true;
    }
  });

  if (notificationsLoading) {
    return <AdminLoader />;
  }

  return (
    <div className="min-h-screen ml-0 lg:ml-60 bg-gray-50 pb-5">
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="mb-4 sm:mb-6 mt-10 sm:mt-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-700">Super Admin Notifications</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {filteredNotifications.length > 0 && (
                <>
                  {!isSelectMode ? (
                    <button
                      onClick={() => setIsSelectMode(true)}
                      className="flex items-center space-x-2 px-3 sm:px-4 py-2 text-xs sm:text-sm text-black/80 rounded-md shadow-md hover:shadow-lg whitespace-nowrap"
                    >
                      <span>Select</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setIsSelectMode(false);
                        setSelectedNotifications(new Set());
                      }}
                      className="flex items-center space-x-2 px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-700 shadow-md rounded-md hover:text-gray-900 whitespace-nowrap"
                    >
                      <span>Cancel</span>
                    </button>
                  )}
                </>
              )}
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="flex items-center space-x-2 px-3 sm:px-4 py-2 text-xs sm:text-sm bg-green-600 text-white rounded-md hover:bg-green-700 whitespace-nowrap"
                >
                  <CheckCheck className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Mark All Read</span>
                  <span className="sm:hidden">Mark Read</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mb-4 sm:mb-6">
          <div className="border-gray-200">
            <nav className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-0">
              <div className="flex space-x-2 sm:space-x-4 overflow-x-auto">
              {/* All */}
              <button
                onClick={() => setSelectedFilter('all')}
                className={`relative flex items-center py-3 sm:py-4 px-2 font-medium text-xs sm:text-sm transition-colors group whitespace-nowrap ${
                  selectedFilter === 'all' ? 'text-[#3674B5]' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                All ({notifications.length})
                <span
                  className={`absolute bottom-0 left-0 h-[2px] bg-[#3674B5] transition-all duration-300
                    ${selectedFilter === 'all' ? 'w-full' : 'w-0 group-hover:w-full'}
                  `}
                />
              </button>

              {/* Unread */}
              <button
                onClick={() => setSelectedFilter('unread')}
                className={`relative flex items-center py-3 sm:py-4 px-2 font-medium text-xs sm:text-sm transition-colors group whitespace-nowrap ${
                  selectedFilter === 'unread' ? 'text-[#3674B5]' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Unread ({unreadCount})
                <span
                  className={`absolute bottom-0 left-0 h-[2px] bg-[#3674B5] transition-all duration-300
                    ${selectedFilter === 'unread' ? 'w-full' : 'w-0 group-hover:w-full'}
                  `}
                />
              </button>

              {/* High Priority */}
              <button
                onClick={() => setSelectedFilter('high')}
                className={`relative flex items-center py-3 sm:py-4 px-2 font-medium text-xs sm:text-sm transition-colors group whitespace-nowrap ${
                  selectedFilter === 'high' ? 'text-[#3674B5]' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="hidden sm:inline">High Priority (</span>
                <span className="sm:hidden">High (</span>
                {notifications.filter(
                  (n: SuperAdminNotification) => n.priority === 'HIGH'
                ).length}
                )
                <span
                  className={`absolute bottom-0 left-0 h-[2px] bg-[#3674B5] transition-all duration-300
                    ${selectedFilter === 'high' ? 'w-full' : 'w-0 group-hover:w-full'}
                  `}
                />
              </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {isSelectMode && filteredNotifications.length > 0 && (
                  <>
                    <button
                      onClick={toggleSelectAll}
                      className="flex items-center space-x-2 px-2 sm:px-3 py-2 text-xs sm:text-sm text-gray-700 shadow-md rounded-md hover:text-gray-900 whitespace-nowrap"
                    >
                      {selectedNotifications.size === filteredNotifications.length ? (
                        <CheckSquare className="w-3 h-3 sm:w-4 sm:h-4" />
                      ) : (
                        <Square className="w-3 h-3 sm:w-4 sm:h-4" />
                      )}
                      <span className="hidden sm:inline">{selectedNotifications.size === filteredNotifications.length ? 'Deselect All' : 'Select All'}</span>
                      <span className="sm:hidden">{selectedNotifications.size === filteredNotifications.length ? 'Deselect' : 'Select'}</span>
                    </button>
                    {selectedNotifications.size > 0 ? (
                      <button
                        onClick={handleDeleteSelected}
                        className="flex items-center space-x-2 px-2 sm:px-3 py-2 text-xs sm:text-sm bg-red-200 text-red-600 font-semibold shadow-md rounded-md hover:bg-red-300 whitespace-nowrap"
                      >
                        <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span>Delete ({selectedNotifications.size})</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleDeleteAll}
                        className="flex items-center space-x-2 px-2 sm:px-3 py-2 text-xs sm:text-sm bg-red-200 text-red-600 font-semibold shadow-md rounded-md hover:bg-red-300 whitespace-nowrap"
                      >
                        <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span>Delete All</span>
                      </button>
                    )}
                  </>
                )}
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="flex items-center space-x-2 px-3 sm:px-4 py-2 text-xs sm:text-sm bg-[#3674B5] text-white rounded-md hover:bg-[#1B5087] disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </nav>
          </div>
        </div>


        {/* Notifications List */}
        <div className="mb-4 sm:mb-6">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <Bell size={40} className="sm:w-12 sm:h-12 mx-auto text-gray-300 mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No notifications found</h3>
              <p className="text-sm sm:text-base text-gray-500 px-4">
                {selectedFilter === 'all' 
                  ? "You'll see notifications here when there are system updates or admin activities."
                  : `No ${selectedFilter} notifications at the moment.`
                }
              </p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {filteredNotifications.map((notification: SuperAdminNotification) => (
                <div
                  key={notification.id}
                  className={`p-4 sm:p-6 rounded-md border-l-4 ${getNotificationColor(notification.type)} ${
                    !notification.read ? 'bg-white shadow-sm' : 'bg-gray-50'
                  } hover:shadow-md transition-shadow`}
                >
                  <div className="flex items-start justify-between gap-2 sm:gap-0">
                    <div className="flex items-start space-x-2 sm:space-x-3 flex-1 min-w-0">
                      {isSelectMode && (
                        <button
                          onClick={() => toggleSelectNotification(notification.id)}
                          className="mt-1 p-1 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                        >
                          {selectedNotifications.has(notification.id) ? (
                            <CheckSquare size={18} className="sm:w-5 sm:h-5 text-blue-600" />
                          ) : (
                            <Square size={18} className="sm:w-5 sm:h-5 text-gray-400" />
                          )}
                        </button>
                      )}
                      <div className="flex-shrink-0 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3 className="text-base sm:text-lg font-medium text-gray-900 break-words">
                            {notification.title}
                          </h3>
                          <span className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-medium ${getPriorityColor(notification.priority)}`}>
                            {notification.priority}
                          </span>
                          {!notification.read && (
                            <span className="inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-medium bg-blue-100 text-blue-800">
                              NEW
                            </span>
                          )}
                        </div>
                        <p className="text-sm sm:text-base text-gray-700 mb-2 sm:mb-3 break-words">{notification.message}</p>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 gap-1 sm:gap-0 text-xs sm:text-sm text-gray-500">
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
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
                          <span className="capitalize">{notification.category.replace(/_/g, ' ')}</span>
                        </div>
                      </div>
                    </div>
                    {!isSelectMode && (
                      <div className="flex items-center space-x-1 sm:space-x-2 ml-2 sm:ml-4 flex-shrink-0">
                        {!notification.read && (
                          <button
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="p-1.5 sm:p-2 text-gray-400 hover:text-green-600 transition-colors"
                            title="Mark as read"
                          >
                            <Check className="w-3 h-3 sm:w-4 sm:h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteNotification(notification)}
                          className="p-1.5 sm:p-2 text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete notification"
                        >
                          <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-md p-4 sm:p-6 max-w-md w-full mx-2 sm:mx-4">
            <div className="flex items-center mb-3 sm:mb-4">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
              </div>
              <div className="ml-2 sm:ml-3">
                <h3 className="text-base sm:text-lg font-medium text-gray-900">
                  Delete Notification
                </h3>
              </div>
            </div>
            <div className="mb-3 sm:mb-4">
              <p className="text-xs sm:text-sm text-gray-500">
                Are you sure you want to delete this notification?
              </p>
              {notificationToDelete && (
                <div className="mt-2 p-2 sm:p-3 bg-gray-50 rounded-md">
                  <p className="text-sm sm:text-base font-medium text-gray-900 break-words">{notificationToDelete.title}</p>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1 break-words">{notificationToDelete.message}</p>
                </div>
              )}
              <p className="text-xs sm:text-sm text-gray-500 mt-2">
                This action cannot be undone.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 sm:space-x-3">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-xs sm:text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteAllModal}
        onClose={cancelDeleteAll}
        onConfirm={confirmDeleteAll}
        title="Delete All Notifications"
        message="Are you sure you want to delete all notifications? This action cannot be undone."
        confirmText="Delete All"
        cancelText="Cancel"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
      />
    </div>
  );
};

export default SadminNotifications;
