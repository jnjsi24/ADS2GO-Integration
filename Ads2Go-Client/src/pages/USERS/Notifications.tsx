import React, { useState } from 'react';
import { useNotifications } from '../../contexts/NotificationContext';
import { formatDistanceToNow } from 'date-fns';
import { Bell, Check, CheckCheck, Trash2, RefreshCw, CheckSquare, Square } from 'lucide-react';

const Notifications: React.FC = () => {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    removeNotification,
    deleteAllNotifications,
    refreshNotifications,
    isLoading,
    error
  } = useNotifications();

  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);

  // Selection helper functions
  const toggleSelectAll = () => {
    if (selectedNotifications.size === notifications.length) {
      setSelectedNotifications(new Set());
    } else {
      setSelectedNotifications(new Set(notifications.map(n => n.id)));
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
    
    if (selectedNotifications.size === notifications.length) {
      // If all notifications are selected, use deleteAllNotifications
      await deleteAllNotifications();
    } else {
      // Delete selected notifications one by one
      for (const notificationId of selectedNotifications) {
        await removeNotification(notificationId);
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

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'SUCCESS':
        return '✅';
      case 'WARNING':
        return '⚠️';
      case 'ERROR':
        return '❌';
      default:
        return 'ℹ️';
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white pl-72 pr-5 p-10">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pl-72 pr-5 p-10">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-800">Notifications</h1>
          <p className="text-gray-500 text-sm">
            {unreadCount > 0 ? `${unreadCount} unread notifications` : 'All caught up!'}
          </p>
          {error && (
            <p className="text-red-500 text-sm mt-1">Error: {error}</p>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {notifications.length > 0 && (
            <>
              {!isSelectMode ? (
                <button
                  onClick={() => setIsSelectMode(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <CheckSquare size={16} />
                  <span>Select</span>
                </button>
              ) : (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={toggleSelectAll}
                    className="flex items-center space-x-2 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    {selectedNotifications.size === notifications.length ? (
                      <CheckSquare size={16} />
                    ) : (
                      <Square size={16} />
                    )}
                    <span>{selectedNotifications.size === notifications.length ? 'Deselect All' : 'Select All'}</span>
                  </button>
                  {selectedNotifications.size > 0 && (
                    <button
                      onClick={handleDeleteSelected}
                      className="flex items-center space-x-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <Trash2 size={16} />
                      <span>Delete Selected ({selectedNotifications.size})</span>
                    </button>
                  )}
                  <button
                    onClick={handleDeleteAll}
                    className="flex items-center space-x-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <Trash2 size={16} />
                    <span>Delete All</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsSelectMode(false);
                      setSelectedNotifications(new Set());
                    }}
                    className="flex items-center space-x-2 px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    <span>Cancel</span>
                  </button>
                </div>
              )}
            </>
          )}
          <button
            onClick={refreshNotifications}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <CheckCheck size={16} />
              <span>Mark all as read</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        {notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications yet</h3>
            <p className="text-gray-500">You'll see notifications here when your ads are approved, rejected, or when there are updates.</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-6 rounded-lg border-l-4 ${getNotificationColor(notification.type)} ${
                !notification.read ? 'bg-white shadow-sm' : 'bg-gray-50'
              } hover:shadow-md transition-shadow`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
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
                  <span className="text-2xl">{getNotificationIcon(notification.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className={`text-lg font-medium ${!notification.read ? 'text-gray-900' : 'text-gray-700'}`}>
                        {notification.title}
                      </h3>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                      )}
                    </div>
                    <p className="text-gray-600 mb-2">{notification.message}</p>
                    {notification.adTitle && (
                      <p className="text-sm text-blue-600 mb-2">Related Ad: {notification.adTitle}</p>
                    )}
                    <p className="text-xs text-gray-400">
                      {notification.createdAt ? 
                        (() => {
                          try {
                            const date = new Date(notification.createdAt);
                            return isNaN(date.getTime()) ? 'Unknown time' : formatDistanceToNow(date, { addSuffix: true });
                          } catch (error) {
                            console.error('Date formatting error:', error, notification.createdAt);
                            return 'Unknown time';
                          }
                        })() : 'Unknown time'
                      }
                    </p>
                  </div>
                </div>
                {!isSelectMode && (
                  <div className="flex items-center space-x-2 ml-4">
                    {!notification.read && (
                      <button
                        onClick={() => markAsRead(notification.id)}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Mark as read"
                      >
                        <Check size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => removeNotification(notification.id)}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete notification"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Notifications;
