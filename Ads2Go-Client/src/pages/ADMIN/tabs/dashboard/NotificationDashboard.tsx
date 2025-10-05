import React, { useState, useEffect } from 'react';
import { Bell, AlertTriangle, CheckCircle, Clock, Users, FileText, DollarSign, Play, Pause, Eye, TrendingUp, X, RefreshCw, CheckSquare, Square, Trash2, ChevronDown } from 'lucide-react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_ADMIN_NOTIFICATIONS, MARK_NOTIFICATION_READ, DELETE_NOTIFICATION, DELETE_ALL_ADMIN_NOTIFICATIONS, GET_PENDING_ADS, GET_PENDING_MATERIALS } from '../../../../graphql/admin/queries';
import { motion, AnimatePresence } from "framer-motion";


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

interface PendingAd {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  user: {
    firstName: string;
    lastName: string;
  } | null;
  materialId?: string;
  planId?: string;
}

interface PendingMaterial {
  id: string;
  materialId: string;
  materialType: string;
  vehicleType: string;
  category: string;
  createdAt: string;
  driver: {
    firstName: string;
    lastName: string;
  };
}

interface NotificationDashboardProps {
  pendingAdsCount?: number;
}

const NotificationDashboard: React.FC<NotificationDashboardProps> = ({ pendingAdsCount }) => {
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'unread' | 'high'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState<Notification | null>(null);
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  
  // Fetch notifications
  const { data: notificationsData, loading: notificationsLoading, refetch: refetchNotifications } = useQuery(GET_ADMIN_NOTIFICATIONS, {
    pollInterval: 30000, // Refresh every 30 seconds
    onError: (error) => {
      console.error('Error fetching notifications:', error);
    }
  });

  // Fetch pending ads
  const { data: pendingAdsData, loading: pendingAdsLoading, refetch: refetchPendingAds } = useQuery(GET_PENDING_ADS, {
    pollInterval: 30000,
    onCompleted: (data) => {
      console.log('🔔 Frontend: Pending ads data received:', data);
    },
    onError: (error) => {
      console.error('Error fetching pending ads:', error);
    }
  });

  // Fetch pending materials
  const { data: pendingMaterialsData, loading: pendingMaterialsLoading, refetch: refetchPendingMaterials } = useQuery(GET_PENDING_MATERIALS, {
    pollInterval: 30000,
    onError: (error) => {
      console.error('Error fetching pending materials:', error);
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
      alert('Failed to delete notification: ' + error.message);
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
      alert('Failed to delete all notifications: ' + error.message);
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

  const handleDeleteNotification = (notification: Notification) => {
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
      // If all notifications are selected, use deleteAllNotifications
      await deleteAllNotifications();
    } else {
      // Delete selected notifications one by one
      for (const notificationId of selectedNotifications) {
        await deleteNotification({
          variables: { notificationId }
        });
      }
    }
    
    setSelectedNotifications(new Set());
    setIsSelectMode(false);
  };

  const handleDeleteAll = async () => {
    if (window.confirm('Are you sure you want to delete all notifications? This action cannot be undone.')) {
      await deleteAllNotifications();
      setSelectedNotifications(new Set());
      setIsSelectMode(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchNotifications(),
        refetchPendingAds(),
        refetchPendingMaterials()
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const notifications: Notification[] = notificationsData?.getAdminNotifications?.notifications || [];
  const pendingAds: PendingAd[] = pendingAdsData?.getPendingAds || [];
  const pendingMaterials: PendingMaterial[] = pendingMaterialsData?.getPendingMaterials || [];

  // Debug logging
  console.log('🔔 Frontend: NotificationDashboard data:', {
    notifications: notifications.length,
    pendingAds: pendingAds.length,
    pendingMaterials: pendingMaterials.length,
    pendingAdsData: pendingAdsData
  });

  const filterOptions = [
    { id: "all", label: "All Notifications", count: notifications.length },
    { id: "unread", label: "Unread", count: notifications.filter(n => !n.read).length },
    { id: "high", label: "High Priority", count: notifications.filter(n => n.priority === "HIGH").length }
  ];
  
  const selectedFilterLabel = filterOptions.find(f => f.id === selectedFilter)?.label || "Filter";


  const filteredNotifications = notifications.filter(notification => {
    if (selectedFilter === 'unread') return !notification.read;
    if (selectedFilter === 'high') return notification.priority === 'HIGH';
    return true;
  });

  const getNotificationIcon = (category: string, type: string) => {
    switch (category) {
      case 'NEW_AD_SUBMISSION':
        return <FileText className="w-5 h-5 text-blue-500" />;
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
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'border-l-red-500 bg-red-50';
      case 'MEDIUM':
        return 'border-l-yellow-500 bg-yellow-50';
      case 'LOW':
        return 'border-l-green-500 bg-green-50';
      default:
        return 'border-l-gray-500 bg-gray-50';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'ERROR':
        return 'text-red-600';
      case 'WARNING':
        return 'text-yellow-600';
      case 'SUCCESS':
        return 'text-green-600';
      case 'INFO':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
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

  if (notificationsLoading || pendingAdsLoading || pendingMaterialsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Debug: Log the loading states
  console.log('🔔 Frontend: Loading states:', {
    notificationsLoading,
    pendingAdsLoading,
    pendingMaterialsLoading
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Admin Notifications</h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter Tabs */}
          <div className="relative w-40">
            {/* Dropdown Trigger */}
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2">
              {selectedFilterLabel}
              <ChevronDown
                size={16}
                className={`transform transition-transform duration-200 ${
                  showFilterDropdown ? "rotate-180" : "rotate-0"
                }`}
              />
            </button>

            {/* Dropdown Options */}
            <AnimatePresence>
              {showFilterDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute z-10 top-full mt-2 w-full rounded-lg shadow-lg bg-white overflow-hidden"
                >
                  {filterOptions.map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => {
                        setSelectedFilter(filter.id as any);
                        setShowFilterDropdown(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-xs ml-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                    >
                      {filter.label} ({filter.count})
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center text-sm gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Pending Actions Section */}
      {(pendingAds.length > 0 || pendingMaterials.length > 0) && (
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-4 border-b border-gray-200">
            <h4 className="text-lg font-semibold text-gray-800">Pending Actions Required</h4>
          </div>
          <div className="p-4 space-y-4">
            {/* Pending Ads */}
            {pendingAds.length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Ads Awaiting Review ({pendingAds.length})
                </h5>
                <div className="space-y-2">
                  {pendingAds.slice(0, 3).map(ad => (
                    <div key={ad.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                        <div>
                          <p className="font-medium text-gray-800">{ad.title}</p>
                          <p className="text-sm text-gray-600">
                            by {ad.user ? `${ad.user.firstName} ${ad.user.lastName}` : 'Unknown User'} • {formatTimeAgo(ad.createdAt)}
                          </p>
                        </div>
                      </div>
                      <button className="px-3 py-1 bg-orange-500 text-white text-sm rounded hover:bg-orange-600">
                        Review
                      </button>
                    </div>
                  ))}
                  {pendingAds.length > 3 && (
                    <p className="text-sm text-gray-500 text-center">
                      +{pendingAds.length - 3} more ads pending review
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Pending Materials */}
            {pendingMaterials.length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <Play className="w-4 h-4" />
                  Materials Awaiting Creation ({pendingMaterials.length})
                </h5>
                <div className="space-y-2">
                  {pendingMaterials.slice(0, 3).map(material => (
                    <div key={material.id} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        <div>
                          <p className="font-medium text-gray-800">{material.materialId}</p>
                          <p className="text-sm text-gray-600">
                            {material.materialType} • {material.vehicleType} • {formatTimeAgo(material.createdAt)}
                          </p>
                        </div>
                      </div>
                      <button className="px-3 py-1 bg-purple-500 text-white text-sm rounded hover:bg-purple-600">
                        Create
                      </button>
                    </div>
                  ))}
                  {pendingMaterials.length > 3 && (
                    <p className="text-sm text-gray-500 text-center">
                      +{pendingMaterials.length - 3} more materials pending creation
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notifications List */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-bold text-gray-800">Recent Notifications</h4>
            {filteredNotifications.length > 0 && (
              <div className="flex items-center space-x-2">
                {!isSelectMode ? (
                  <button
                    onClick={() => setIsSelectMode(true)}
                    className="flex items-center space-x-2 px-3 py-1 text-black rounded-lg hover:text-black/80 text-sm font-semibold"
                  >
                    <CheckSquare className="w-4 h-4" />
                    <span>Select</span>
                  </button>
                ) : (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={toggleSelectAll}
                      className="flex items-center space-x-2 px-3 py-1 bg-gray-100 text-black font-semibold rounded-lg hover:bg-gray-200 text-sm transition-colors"
                    >
                      {selectedNotifications.size === filteredNotifications.length ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                      <span>{selectedNotifications.size === filteredNotifications.length ? 'Deselect All' : 'Select All'}</span>
                    </button>
                    <button
                      onClick={() => {
                        if (selectedNotifications.size === 0) {
                          handleDeleteAll(); // no selection → delete all
                        } else {
                          handleDeleteSelected(); // selection → delete selected
                        }
                      }}
                      className="flex items-center space-x-2 px-3 py-1 bg-red-200 text-red-500 font-semibold rounded-lg hover:bg-red-300 text-sm transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>
                        {selectedNotifications.size === 0 ? "Delete All" : `Delete (${selectedNotifications.size})`}
                      </span>
                    </button>

                    <button
                      onClick={() => {
                        setIsSelectMode(false);
                        setSelectedNotifications(new Set());
                      }}
                      className="flex items-center space-x-2 px-3 py-1 border text-black/80 font-semibold rounded-lg hover:text-black/60 text-sm transition-colors"
                    >
                      <span>Cancel</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="divide-y divide-gray-200">
          {filteredNotifications.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No notifications found</p>
            </div>
          ) : (
            filteredNotifications.map(notification => (
              <div
                key={notification.id}
                className={`p-4 border-l-4 ${getPriorityColor(notification.priority)} ${
                  !notification.read ? 'bg-blue-50' : 'bg-white'
                }`}
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
                    {getNotificationIcon(notification.category, notification.type)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h5 className={`font-medium ${getTypeColor(notification.type)}`}>
                          {notification.title}
                        </h5>
                        {!notification.read && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        )}
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          notification.priority === 'HIGH' ? 'bg-red-100 text-red-600' :
                          notification.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-600' :
                          'bg-green-100 text-green-600'
                        }`}>
                          {notification.priority}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>{formatTimeAgo(notification.createdAt)}</span>
                        {notification.adTitle && (
                          <span>Ad: {notification.adTitle}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {!isSelectMode && (
                    <div className="flex items-center gap-2">
                      {!notification.read && (
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="group flex items-center text-green-700 rounded-md overflow-hidden h-6 w-7 hover:w-24 transition-[width] duration-300"
                        >
                          <CheckCircle className="w-4 h-4 flex-shrink-0 mx-auto ml-1.5 group-hover:ml-1 transition-all duration-300" />
                          <span className="opacity-0 group-hover:opacity-100 ml-1 group-hover:mr-3 whitespace-nowrap text-xs transition-all duration-300">
                            Mark as Read
                          </span>
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteNotification(notification)}
                        className="group flex items-center text-red-700 rounded-md overflow-hidden h-6 w-7 hover:w-16 transition-[width] duration-300"
                      >
                        <X className="w-4 h-4 flex-shrink-0 mx-auto transition-all duration-300" />
                        <span className="opacity-0 group-hover:opacity-100 ml-1 group-hover:mr-3 whitespace-nowrap text-xs transition-all duration-300">
                          Delete
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">
                  Delete Notification
                </h3>
              </div>
            </div>
            <div className="mb-4">
              <p className="text-sm text-gray-500">
                Are you sure you want to delete this notification?
              </p>
              {notificationToDelete && (
                <div className="mt-2 p-3 bg-gray-50 rounded-md">
                  <p className="font-medium text-gray-900">{notificationToDelete.title}</p>
                  <p className="text-sm text-gray-600 mt-1">{notificationToDelete.message}</p>
                </div>
              )}
              <p className="text-sm text-gray-500 mt-2">
                This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
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

export default NotificationDashboard;
