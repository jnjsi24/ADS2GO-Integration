import React, { useEffect, useState } from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import NotificationToast from './NotificationToast';

const NotificationContainer: React.FC = () => {
  const { notifications } = useNotifications();
  const [toasts, setToasts] = useState<Array<{
    id: string;
    title: string;
    message: string;
    type: 'SUCCESS' | 'INFO' | 'WARNING' | 'ERROR';
  }>>([]);

  useEffect(() => {
    // Show toast for new unread notifications
    const newNotifications = notifications.filter(n => !n.read);
    if (newNotifications.length > 0) {
      const latestNotification = newNotifications[0];
      setToasts(prev => [
        ...prev,
        {
          id: latestNotification.id,
          title: latestNotification.title,
          message: latestNotification.message,
          type: latestNotification.type
        }
      ]);
    }
  }, [notifications]);

  const handleCloseToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <NotificationToast
          key={toast.id}
          notification={toast}
          onClose={handleCloseToast}
        />
      ))}
    </div>
  );
};

export default NotificationContainer;
