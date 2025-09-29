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
  DollarSign
} from 'lucide-react';
import { 
  GET_SUPERADMIN_NOTIFICATIONS, 
  MARK_SUPERADMIN_NOTIFICATION_READ, 
  MARK_ALL_SUPERADMIN_NOTIFICATIONS_READ,
  GET_USER_COUNTS_BY_PLAN,
  SuperAdminNotification 
} from '../../graphql/superadmin/queries/sadminNotificationQueries';

const SadminNotifications: React.FC = () => {
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'unread' | 'high'>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Fetch notifications
  const { data: notificationsData, loading: notificationsLoading, refetch: refetchNotifications } = useQuery(GET_SUPERADMIN_NOTIFICATIONS, {
    pollInterval: 30000, // Refresh every 30 seconds
    onError: (error) => {
      console.error('Error fetching super admin notifications:', error);
    }
  });

  // Fetch user counts by plan
  const { data: planData, loading: planLoading } = useQuery(GET_USER_COUNTS_BY_PLAN, {
    onError: (error) => {
      console.error('Error fetching user counts by plan:', error);
    }
  });

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
  const planCounts = planData?.getUserCountsByPlan || [];

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
    return (
      <div className="min-h-screen ml-64 bg-gray-100 pb-5">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen ml-64 bg-gray-100 pb-5">
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Super Admin Notifications</h1>
              <p className="text-gray-600 mt-1">Manage system notifications and monitor user activity</p>
            </div>
            <div className="flex items-center space-x-3">
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Bell className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Notifications</p>
                <p className="text-2xl font-bold text-gray-900">{notifications.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Unread</p>
                <p className="text-2xl font-bold text-gray-900">{unreadCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">High Priority</p>
                <p className="text-2xl font-bold text-gray-900">
                  {notifications.filter((n: SuperAdminNotification) => n.priority === 'HIGH' && !n.read).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Plans</p>
                <p className="text-2xl font-bold text-gray-900">{planCounts.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        {/* Filter Tabs */}
<div className="mb-6">
  <div className="border-gray-200">
    <nav className="flex space-x-8 px-6">
      {/* All */}
      <button
        onClick={() => setSelectedFilter('all')}
        className={`relative flex items-center py-4 px-1 font-medium text-sm transition-colors group ${
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
        className={`relative flex items-center py-4 px-1 font-medium text-sm transition-colors group ${
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
        className={`relative flex items-center py-4 px-1 font-medium text-sm transition-colors group ${
          selectedFilter === 'high' ? 'text-[#3674B5]' : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        High Priority (
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
    </nav>
  </div>
</div>


        {/* Notifications List */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6">
            {filteredNotifications.length === 0 ? (
              <div className="text-center py-12">
                <Bell size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications found</h3>
                <p className="text-gray-500">
                  {selectedFilter === 'all' 
                    ? "You'll see notifications here when there are system updates or admin activities."
                    : `No ${selectedFilter} notifications at the moment.`
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredNotifications.map((notification: SuperAdminNotification) => (
                  <div
                    key={notification.id}
                    className={`p-6 rounded-lg border-l-4 ${getNotificationColor(notification.type)} ${
                      !notification.read ? 'bg-white shadow-sm' : 'bg-gray-50'
                    } hover:shadow-md transition-shadow`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <div className="flex-shrink-0 mt-1">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="text-lg font-medium text-gray-900">
                              {notification.title}
                            </h3>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(notification.priority)}`}>
                              {notification.priority}
                            </span>
                            {!notification.read && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                NEW
                              </span>
                            )}
                          </div>
                          <p className="text-gray-700 mb-3">{notification.message}</p>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <div className="flex items-center space-x-1">
                              <Clock className="w-4 h-4" />
                              <span>{formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}</span>
                            </div>
                            <span className="capitalize">{notification.category.replace(/_/g, ' ')}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        {!notification.read && (
                          <button
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                            title="Mark as read"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Plan Usage Statistics */}
        {planCounts.length > 0 && (
          <div className="mb-8">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Plan Usage Statistics</h2>
              <p className="text-gray-600 mt-1 mb-5">User counts and revenue by plan</p>
            </div>
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {planCounts.map((plan: any) => (
                  <div key={plan.planId} className="bg-white shadow-md border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-gray-900">{plan.planName}</h3>
                      <span className="text-sm bg-gray-100 px-2 py-1 rounded-xl text-gray-500">{plan.planDetails.materialType}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Users:</span>
                        <span className="font-medium">{plan.userCount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Active Ads:</span>
                        <span className="font-medium">{plan.activeAdsCount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Revenue:</span>
                        <span className="font-medium text-green-600">₱{plan.totalRevenue.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SadminNotifications;
