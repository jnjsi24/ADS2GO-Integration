import React, { useState } from 'react';
import { useNotifications } from '../../contexts/NotificationContext';
import { formatDistanceToNow } from 'date-fns';
import { Bell, Check, CheckSquare, Square, Trash2, RefreshCw, CheckCheck } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

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
    error,
  } = useNotifications();

  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());
  const [pos, setPos] = useState({ x: 50, y: 50 });

  const toggleSelectNotification = (notificationId: string) => {
    const updated = new Set(selectedNotifications);
    updated.has(notificationId) ? updated.delete(notificationId) : updated.add(notificationId);
    setSelectedNotifications(updated);
  };

  const toggleSelectAll = () => {
    if (selectedNotifications.size === notifications.length) {
      setSelectedNotifications(new Set());
    } else {
      setSelectedNotifications(new Set(notifications.map((n) => n.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedNotifications.size === 0) return;
    for (const id of selectedNotifications) {
      await removeNotification(id);
    }
    setSelectedNotifications(new Set());
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'SUCCESS': return '✅';
      case 'WARNING': return '⚠️';
      case 'ERROR': return '❌';
      default: return 'ℹ️';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'SUCCESS': return 'border-l-green-500 bg-green-50';
      case 'WARNING': return 'border-l-yellow-500 bg-yellow-50';
      case 'ERROR': return 'border-l-red-500 bg-red-50';
      default: return 'border-l-blue-500 bg-blue-50';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white lg:pl-72 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background */}
      <div
      className="fixed inset-0 bg-cover bg-center bg-no-repeat blur-sm brightness-90"
      style={{ backgroundImage: "url('/image/bg.jpg')" }}/>
      
      <div className="fixed inset-0 bg-white/40 backdrop-blur-xl" />

      {/* Main content */}
      <div className="relative min-h-screen lg:pl-72 px-4 sm:px-5 lg:pr-5 py-6 lg:p-10 pt-20 lg:pt-10">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-semibold text-gray-800">Notifications</h1>
            <p className="text-black text-sm">
              {unreadCount > 0 ? `${unreadCount} unread notifications` : 'All caught up!'}
            </p>
            {error && <p className="text-red-500 text-sm mt-1">Error: {error}</p>}
          </div>

          <div className="flex items-center space-x-2">
            {notifications.length > 0 && (
              <div className="flex items-center gap-2">
                {selectedNotifications.size > 0 && (
                  <button
                    onClick={handleDeleteSelected}
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = ((e.clientX - rect.left) / rect.width) * 100;
                      const y = ((e.clientY - rect.top) / rect.height) * 100;
                      setPos({ x, y });
                    }}
                    className="relative group inline-flex items-center shadow-md justify-center overflow-hidden px-2 py-2 text-sm font-semibold text-red-600 rounded-md bg-red-200"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Trash2 size={16} />
                      Delete ({selectedNotifications.size})
                    </span>
                    <span
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                      style={{
                        background: `radial-gradient(circle at ${pos.x}% ${pos.y}%, rgba(255,255,255,0.25), transparent 60%)`,
                      }}
                    />
                  </button>
                )}
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 px-4 py-2 bg-white/20 text-black hover:text-black/80 rounded-md shadow-md transition"
                >
                  {selectedNotifications.size === notifications.length ? (
                    <Square size={16} />
                  ) : (
                    <CheckSquare size={16} />
                  )}
                  <span>
                    {selectedNotifications.size === notifications.length ? 'Deselect All' : 'Select All'}
                  </span>
                </button>
              </div>
            )}

            <button
              onClick={refreshNotifications}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                setPos({ x, y });
              }}
              className="relative group w-28 inline-flex items-center justify-center overflow-hidden px-6 py-2 text-sm font-medium text-white rounded-md bg-gradient-to-r from-[#1B5087] to-[#3674B5] hover:scale-105 transition"
            >
              <span className="inline-flex items-center gap-2">
                <RefreshCw size={16} />
                Refresh
              </span>
              <span
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{
                  background: `radial-gradient(circle at ${pos.x}% ${pos.y}%, rgba(255,255,255,0.25), transparent 60%)`,
                }}
              />
            </button>

            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center space-x-2 px-4 py-2 text-black rounded-lg hover:text-black/60 transition-colors"
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
              <Bell size={48} className="mx-auto text-black/70 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications yet</h3>
              <p className="text-gray-500">
                You'll see notifications here when your ads are approved, rejected, or updated.
              </p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-6 ${getNotificationColor(notification.type)} ${
                  !notification.read ? 'bg-white/70 shadow-sm' : 'bg-gray-50'
                } hover:shadow-md transition-shadow`}
              >
                <div className="flex items-start justify-between">
                  {/* Checkbox + Info */}
                  <div className="flex items-start space-x-3 flex-1">
                    <motion.button
                    onClick={() => toggleSelectNotification(notification.id)}
                    className="mt-1 p-1 rounded transition-colors flex items-center justify-center"
                    initial={false}
                    animate={{
                      scale: selectedNotifications.has(notification.id) ? 1.05 : 1,
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <div
                      className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors duration-200 ${
                        selectedNotifications.has(notification.id)
                          ? "border-black/20"
                          : "border-black/20 bg-none"
                      }`}
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
                    </div>
                  </motion.button>


                    <span className="text-2xl">{getNotificationIcon(notification.type)}</span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3
                          className={`text-lg font-medium ${
                            !notification.read ? 'text-gray-900' : 'text-gray-700'
                          }`}
                        >
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
                        {notification.createdAt
                          ? (() => {
                              try {
                                const date = new Date(notification.createdAt);
                                return isNaN(date.getTime())
                                  ? 'Unknown time'
                                  : formatDistanceToNow(date, { addSuffix: true });
                              } catch {
                                return 'Unknown time';
                              }
                            })()
                          : 'Unknown time'}
                      </p>
                    </div>
                  </div>

                  {/* Action buttons */}
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
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Notifications;
