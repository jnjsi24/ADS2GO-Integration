import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
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
  DollarSign,
  CheckSquare,
  Square,
  ArrowLeft,
  ChevronDown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AdminLoader } from "../../components/ProtectedRoute";
import DeviceNotificationList from './tabs/dashboard/DeviceNotificationList';
import { 
  GET_ADMIN_GENERAL_NOTIFICATIONS, 
  MARK_NOTIFICATION_READ, 
  MARK_ALL_NOTIFICATIONS_READ,
  DELETE_NOTIFICATION,
  DELETE_ALL_ADMIN_NOTIFICATIONS
} from '../../graphql/admin/queries';
import { AnimatePresence, motion } from 'framer-motion';

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
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Fetch general admin notifications (excluding device-specific notifications)
  const { data: notificationsData, loading: notificationsLoading, error: notificationsError, refetch: refetchNotifications } = useQuery(GET_ADMIN_GENERAL_NOTIFICATIONS, {
    pollInterval: 120000, // Refresh every 2 minutes for more discreet updates
    fetchPolicy: 'cache-and-network', // Ensure we get fresh data
  });


  // Handle query errors
  useEffect(() => {
    if (notificationsError) {
      console.error('Error fetching notifications:', notificationsError);
    }
  }, [notificationsError]);

  // Mark notification as read
  const [markAsRead] = useMutation(MARK_NOTIFICATION_READ);

  // Delete notification
  const [deleteNotification] = useMutation(DELETE_NOTIFICATION);

  // Mark all notifications as read
  const [markAllAsRead] = useMutation(MARK_ALL_NOTIFICATIONS_READ);

  // Delete all notifications
  const [deleteAllNotifications] = useMutation(DELETE_ALL_ADMIN_NOTIFICATIONS);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markAsRead({ variables: { notificationId } });
      await refetchNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      await deleteNotification({ variables: { notificationId } });
      await refetchNotifications();
      setShowDeleteModal(false);
      setNotificationToDelete(null);
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      await refetchNotifications();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const handleDeleteAll = async () => {
    if (window.confirm('Are you sure you want to delete all notifications?')) {
      try {
        await deleteAllNotifications();
        await refetchNotifications();
        setSelectedNotifications(new Set());
        setIsSelectMode(false);
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

  const notifications: Notification[] = notificationsData?.getAdminGeneralNotifications?.notifications || [];
  const unreadCount = notificationsData?.getAdminGeneralNotifications?.unreadCount || 0;

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
       for (const notificationId of Array.from(selectedNotifications)) {
         await handleDeleteNotification(notificationId);
       }
    }
    
    setSelectedNotifications(new Set());
    setIsSelectMode(false);
  };

  if (notificationsLoading) {
    return <AdminLoader />;
  }

  return (
    <div className="p-8 pl-72 bg-[#f9f9fc] min-h-screen">
      {/* Header */}
      <div className="mb-8">
        {/* Back button */}
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-2 pt-4 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </button>
        </div>

        {/* Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Left: Title and Counts */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              Notifications
            </h1>
            <p className="text-gray-600 mt-2">
              {notifications.length} total notifications • {unreadCount} unread
            </p>
          </div>

          {/* Right: Filter Dropdown + Refresh */}
          <div className="flex items-center gap-2">
            {/* Filter Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="flex items-center justify-between text-xs text-black rounded-md pl-4 pr-3 py-3 shadow-md focus:outline-none bg-white gap-2 min-w-[170px]"
              >
                <span className="truncate">
                  {selectedFilter === 'all' && `All (${notifications.length})`}
                  {selectedFilter === 'unread' && `Unread (${unreadCount})`}
                  {selectedFilter === 'high' && `High Priority (${notifications.filter(n => n.priority === 'HIGH').length})`}
                </span>
                <ChevronDown
                  size={16}
                  className={`flex-shrink-0 transform transition-transform duration-200 ${showFilterDropdown ? 'rotate-180' : ''}`}
                />
              </button>

              <AnimatePresence>
                {showFilterDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute z-10 top-full mt-2 w-full rounded-md shadow-lg bg-white overflow-hidden"
                  >
                    <button
                      onClick={() => {
                        setSelectedFilter('all');
                        setShowFilterDropdown(false);
                      }}
                      className={`block w-full text-left px-4 py-2 text-xs transition-colors duration-150 ${
                        selectedFilter === 'all'
                          ? 'bg-blue-50 text-blue-600 font-medium'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      All ({notifications.length})
                    </button>

                    <button
                      onClick={() => {
                        setSelectedFilter('unread');
                        setShowFilterDropdown(false);
                      }}
                      className={`block w-full text-left px-4 py-2 text-xs transition-colors duration-150 ${
                        selectedFilter === 'unread'
                          ? 'bg-blue-50 text-blue-600 font-medium'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Unread ({unreadCount})
                    </button>

                    <button
                      onClick={() => {
                        setSelectedFilter('high');
                        setShowFilterDropdown(false);
                      }}
                      className={`block w-full text-left px-4 py-2 text-xs transition-colors duration-150 ${
                        selectedFilter === 'high'
                          ? 'bg-blue-50 text-blue-600 font-medium'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      High Priority ({notifications.filter(n => n.priority === 'HIGH').length})
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center px-4 gap-2 py-3 text-white text-sm shadow-lg rounded-md bg-[#3674B5] hover:bg-[#3674B5]/80 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-end gap-4">
          {/* Action buttons */}
          <div className="flex gap-2">
            {filteredNotifications.length > 0 && (
              <div className="flex items-center space-x-2">
                {!isSelectMode ? (
                  <button
                    onClick={() => setIsSelectMode(true)}
                    className="px-3 py-1 text-black rounded shadow-md hover:bg-gray-100 disabled:opacity-50 flex items-center gap-3"
                  >
                    <span>Select</span>
                  </button>
                ) : (
                  <div className="flex items-center space-x-2">
                    {/* ✅ Animated Checkbox for Select All */}
                    <motion.button
                      onClick={toggleSelectAll}
                      className="flex items-center space-x-2 px-3 py-1 text-black/90 rounded text-sm shadow-md hover:bg-gray-100 disabled:opacity-50"
                      initial={false}
                      animate={{
                        scale:
                          selectedNotifications.size === filteredNotifications.length
                            ? 1.05
                            : 1,
                      }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                      <div
                        className={`w-4 h-4 border-2 rounded flex items-center justify-center transition-colors duration-200 ${
                          selectedNotifications.size === filteredNotifications.length
                            ? ""
                            : "border-gray-300 bg-white"
                        }`}
                      >
                        <AnimatePresence>
                          {selectedNotifications.size === filteredNotifications.length && (
                            <motion.div
                              key="check"
                              initial={{ opacity: 0, scale: 0.6 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.6 }}
                              transition={{ duration: 0.15 }}
                            >
                              <Check className="w-3 h-3 text-black" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <span>
                        {selectedNotifications.size === filteredNotifications.length
                          ? "Deselect All"
                          : "Select All"}
                      </span>
                    </motion.button>

                    {/* Delete Button */}
                    <button
                      onClick={() => {
                        if (selectedNotifications.size === 0) {
                          handleDeleteAll();
                        } else {
                          handleDeleteSelected();
                        }
                      }}
                      className="flex items-center space-x-2 px-3 py-1 bg-red-200 shadow-lg text-red-600 font-semibold rounded-md hover:bg-red-300 text-sm transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>
                        {selectedNotifications.size === 0
                          ? "Delete All"
                          : `Delete (${selectedNotifications.size})`}
                      </span>
                    </button>

                    {/* Cancel Button */}
                    <button
                      onClick={() => {
                        setIsSelectMode(false);
                        setSelectedNotifications(new Set());
                      }}
                      className="flex items-center space-x-2 px-3 py-1 shadow-md border text-black/80 font-semibold rounded-md hover:text-black/60 text-sm transition-colors"
                    >
                      <span>Cancel</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead} 
                className="flex items-center space-x-2 px-3 py-1 shadow-md font-semibold rounded-md text-black/90 hover:text-black/70 text-sm transition-colors"
              >
                <CheckCheck className="w-4 h-4" />
                <span>Mark All Read</span>
              </button>
            )}
            
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="">
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
                className={`p-6 mb-3 shadow-md rounded-md ${getNotificationColor(notification.type)} ${
                  !notification.read ? 'bg-blue-50' : 'bg-white'
                } hover:bg-gray-50 transition-colors`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    {isSelectMode && (
                      <motion.button
                        onClick={() => toggleSelectNotification(notification.id)}
                        className="mt-1 w-5 h-5 border-2 rounded flex items-center justify-center"
                        initial={false}
                        animate={{
                          scale: selectedNotifications.has(notification.id) ? 1.1 : 1,
                          borderColor: selectedNotifications.has(notification.id)
                            ? "" // blue-600
                            : "#d1d5db", // gray-300
                          backgroundColor: selectedNotifications.has(notification.id)
                            ? ""
                            : "none",
                        }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      >
                        <AnimatePresence>
                          {selectedNotifications.has(notification.id) && (
                            <motion.div
                              key="check"
                              initial={{ opacity: 0, scale: 0.6 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.6 }}
                              transition={{ duration: 0.15 }}
                            >
                              <Check className="w-3.5 h-3.5 text-black" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.button>
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
                        {notification.adTitle && (
                          <div className="flex items-center gap-1">
                            <span>Ad: {notification.adTitle}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Action buttons and timestamp */}
                  <div className="flex items-center gap-4 ml-4">
                    {/* Timestamp */}
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <Clock className="w-4 h-4" />
                      <span>
                        {(() => {
                          // For general admin notifications, use createdAt (not data.timestamp)
                          const dateString = notification.createdAt;
                          
                          if (!dateString) return 'Unknown time';
                          
                          // Handle both timestamp strings and ISO strings
                          let date;
                          if (typeof dateString === 'string' && /^\d+$/.test(dateString)) {
                            // It's a timestamp string, convert to number
                            date = new Date(parseInt(dateString));
                          } else {
                            // It's an ISO string or other format
                            date = new Date(dateString);
                          }
                          
                          const now = new Date();
                          
                          // Check if date is valid
                          if (isNaN(date.getTime())) {
                            return 'Invalid date';
                          }
                          
                          const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
                          
                          if (diffInMinutes < 1) return 'Just now';
                          if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
                          if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
                          return `${Math.floor(diffInMinutes / 1440)}d ago`;
                        })()}
                      </span>
                    </div>
                    
                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      {!notification.read && (
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="group flex items-center text-green-700 overflow-hidden h-8 w-8 hover:w-28 transition-[width] duration-300"
                          title="Mark as read"
                        >
                          <Check
                            className="flex-shrink-0 mx-auto mr-1 group-hover:ml-1.5 transition-all duration-300"
                            size={16}
                          />
                          <span className="opacity-0 group-hover:opacity-100 text-xs group-hover:mr-3 whitespace-nowrap transition-all duration-300">
                            Mark as Read
                          </span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setNotificationToDelete(notification);
                          setShowDeleteModal(true);
                        }}
                        className="group flex items-center text-red-700 overflow-hidden h-8 w-7 hover:w-20 transition-[width] duration-300"
                        title="Delete notification"
                      >
                        <Trash2
                          className="flex-shrink-0 mx-auto mr-1 group-hover:ml-1.5 transition-all duration-300"
                          size={16}
                        />
                        <span className="opacity-0 group-hover:opacity-100 text-xs group-hover:mr-4 whitespace-nowrap transition-all duration-300">
                          Delete
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Device Notifications Section */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Device Notifications</h2>
        <DeviceNotificationList maxNotifications={10} />
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
