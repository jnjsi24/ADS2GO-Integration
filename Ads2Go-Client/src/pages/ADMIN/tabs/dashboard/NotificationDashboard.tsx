import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Users, 
  FileText, 
  DollarSign,
  Play,
  Pause,
  Eye,
  TrendingUp,
  X,
  RefreshCw,
  CheckSquare,
  Square,
  Trash2
} from 'lucide-react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_ADMIN_NOTIFICATIONS, MARK_NOTIFICATION_READ, DELETE_NOTIFICATION, DELETE_ALL_ADMIN_NOTIFICATIONS, GET_PENDING_ADS, GET_PENDING_MATERIALS } from '../../../../graphql/admin/queries';

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
          <p className="text-sm text-gray-500">Action items and system alerts</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Unread Notifications</p>
              <p className="text-2xl font-bold text-gray-800">
                {notifications.filter(n => !n.read).length}
              </p>
            </div>
            <Bell className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-l-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending Ads</p>
              <p className="text-2xl font-bold text-gray-800">{pendingAdsCount !== undefined ? pendingAdsCount : pendingAds.length}</p>
            </div>
            <FileText className="w-8 h-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-l-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending Materials</p>
              <p className="text-2xl font-bold text-gray-800">{pendingMaterials.length}</p>
            </div>
            <Play className="w-8 h-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-l-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">High Priority</p>
              <p className="text-2xl font-bold text-gray-800">
                {notifications.filter(n => n.priority === 'HIGH' && !n.read).length}
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-4">
        {[
          { id: 'all', label: 'All Notifications', count: notifications.length },
          { id: 'unread', label: 'Unread', count: notifications.filter(n => !n.read).length },
          { id: 'high', label: 'High Priority', count: notifications.filter(n => n.priority === 'HIGH').length }
        ].map(filter => (
          <button
            key={filter.id}
            onClick={() => setSelectedFilter(filter.id as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedFilter === filter.id
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {filter.label} ({filter.count})
          </button>
        ))}
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
            <h4 className="text-lg font-semibold text-gray-800">Recent Notifications</h4>
            {filteredNotifications.length > 0 && (
              <div className="flex items-center space-x-2">
                {!isSelectMode ? (
                  <button
                    onClick={() => setIsSelectMode(true)}
                    className="flex items-center space-x-2 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    <CheckSquare className="w-4 h-4" />
                    <span>Select</span>
                  </button>
                ) : (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={toggleSelectAll}
                      className="flex items-center space-x-2 px-3 py-1 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
                    >
                      {selectedNotifications.size === filteredNotifications.length ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                      <span>{selectedNotifications.size === filteredNotifications.length ? 'Deselect All' : 'Select All'}</span>
                    </button>
                    {selectedNotifications.size > 0 && (
                      <button
                        onClick={handleDeleteSelected}
                        className="flex items-center space-x-2 px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete Selected ({selectedNotifications.size})</span>
                      </button>
                    )}
                    <button
                      onClick={handleDeleteAll}
                      className="flex items-center space-x-2 px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete All</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsSelectMode(false);
                        setSelectedNotifications(new Set());
                      }}
                      className="flex items-center space-x-2 px-3 py-1 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm"
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
                          className="p-1 text-gray-400 hover:text-gray-600"
                          title="Mark as read"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button 
                        onClick={() => handleDeleteNotification(notification)}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="Delete notification"
                      >
                        <X className="w-4 h-4" />
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
