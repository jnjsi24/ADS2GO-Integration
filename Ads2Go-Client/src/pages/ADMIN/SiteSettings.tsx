import React, { useState } from 'react';
import { useAdminNotificationSettings } from '../../contexts/AdminNotificationSettingsContext';

// Toast notification type
type Toast = {
  id: number;
  message: string;
  type: 'error' | 'success';
};

const SiteSettings: React.FC = () => {
  const { notificationSettings, updateNotificationSetting, isLoading: notificationLoading, error: notificationError } = useAdminNotificationSettings();
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Add toast notification
  const addToast = (message: string, type: 'error' | 'success' = 'error') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 5000);
  };

  // Remove toast notification
  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  // Handle notification preference changes
  const handleNotificationToggle = async (field: keyof typeof notificationSettings) => {
    const newValue = !notificationSettings[field];
    try {
      await updateNotificationSetting(field, newValue);
      addToast('Notification preference updated successfully', 'success');
    } catch (error) {
      console.error('Error updating notification preference:', error);
      addToast('Failed to update notification preference', 'error');
    }
  };

  const handleNotificationSelectChange = async (field: keyof typeof notificationSettings, value: string) => {
    try {
      await updateNotificationSetting(field, value);
      addToast('Notification preference updated successfully', 'success');
    } catch (error) {
      console.error('Error updating notification preference:', error);
      addToast('Failed to update notification preference', 'error');
    }
  };

  return (
    <div className="pt-10 pb-10 pl-72 p-8 bg-[#f9f9fc]">
      <div className="bg-[#f9f9fc] w-full">
        <h1 className="text-2xl font-semibold text-[#3674B5] mb-6">Notification Settings</h1>
      </div>
      <div className="flex">
        <div className="flex-1 bg-[#f9f9fc] p-6">
          <h2 className="text-xl font-semibold mb-2">Notifications</h2>
          <div className="space-y-6">
            <div className="border p-4 rounded-md">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Enable Desktop Notification</h3>
                  <p className="text-sm text-gray-600">Receive notifications for all messages, contacts, and documents</p>
                </div>
                <button
                  type="button"
                  className={`w-14 h-7 rounded-full flex items-center px-1 ${notificationSettings.enableDesktopNotifications ? 'bg-[#3674B5]' : 'bg-gray-300'}`}
                  onClick={() => handleNotificationToggle('enableDesktopNotifications')}
                  disabled={notificationLoading}
                >
                  <span className={`w-5 h-5 bg-white rounded-full transform ${notificationSettings.enableDesktopNotifications ? 'translate-x-7' : 'translate-x-0'} transition-transform duration-200`}></span>
                </button>
              </div>
            </div>
            <div className="border p-4 rounded-md">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Enable Notification Badge</h3>
                  <p className="text-sm text-gray-600">Show a red badge on the app icon when you have unread messages</p>
                </div>
                <button
                  type="button"
                  className={`w-14 h-7 rounded-full flex items-center px-1 ${notificationSettings.enableNotificationBadge ? 'bg-[#3674B5]' : 'bg-gray-300'}`}
                  onClick={() => handleNotificationToggle('enableNotificationBadge')}
                  disabled={notificationLoading}
                >
                  <span className={`w-5 h-5 bg-white rounded-full transform ${notificationSettings.enableNotificationBadge ? 'translate-x-7' : 'translate-x-0'} transition-transform duration-200`}></span>
                </button>
              </div>
            </div>
            <div className="border p-4 rounded-md">
              <h3 className="text-lg font-semibold">Push Notification Time-out</h3>
              <select
                name="pushNotificationTimeout"
                value={notificationSettings.pushNotificationTimeout}
                className="mt-2 block w-32 border-gray-300 rounded-md bg-white"
                onChange={(e) => handleNotificationSelectChange('pushNotificationTimeout', e.target.value)}
                disabled={notificationLoading}
              >
                <option value="5">5 Minutes</option>
                <option value="10">10 Minutes</option>
                <option value="15">15 Minutes</option>
                <option value="30">30 Minutes</option>
              </select>
            </div>
            <h2 className="text-xl font-semibold mt-6">Email Notifications</h2>
            <div className="border p-4 rounded-md">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Communication Emails</h3>
                  <p className="text-sm text-gray-600">Receive emails for messages, contacts, and documents</p>
                </div>
                <button
                  type="button"
                  className={`w-14 h-7 rounded-full flex items-center px-1 ${notificationSettings.communicationEmails ? 'bg-[#3674B5]' : 'bg-gray-300'}`}
                  onClick={() => handleNotificationToggle('communicationEmails')}
                  disabled={notificationLoading}
                >
                  <span className={`w-5 h-5 bg-white rounded-full transform ${notificationSettings.communicationEmails ? 'translate-x-7' : 'translate-x-0'} transition-transform duration-200`}></span>
                </button>
              </div>
            </div>
            <div className="border p-4 rounded-md">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Announcements & Updates</h3>
                  <p className="text-sm text-gray-600">Receive emails about product updates, improvements, etc.</p>
                </div>
                <button
                  type="button"
                  className={`w-14 h-7 rounded-full flex items-center px-1 ${notificationSettings.announcementsEmails ? 'bg-[#3674B5]' : 'bg-gray-300'}`}
                  onClick={() => handleNotificationToggle('announcementsEmails')}
                  disabled={notificationLoading}
                >
                  <span className={`w-5 h-5 bg-white rounded-full transform ${notificationSettings.announcementsEmails ? 'translate-x-7' : 'translate-x-0'} transition-transform duration-200`}></span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`text-white px-4 py-2 rounded-md shadow-lg flex items-center justify-between max-w-xs animate-slideIn ${toast.type === 'error' ? 'bg-red-400' : 'bg-green-400'}`}
          >
            <span>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-4 text-white hover:text-gray-200"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <style>
        {`
          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
          .animate-slideIn {
            animation: slideIn 0.3s ease-out;
          }
        `}
      </style>
    </div>
  );
};

export default SiteSettings;