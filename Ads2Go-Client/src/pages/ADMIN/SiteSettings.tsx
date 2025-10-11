import React, { useState, useEffect } from 'react';
import { useAdminNotificationSettings } from '../../contexts/AdminNotificationSettingsContext';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

type Toast = {
  id: number;
  message: string;
  type: 'error' | 'success';
};

const SiteSettings: React.FC = () => {
  const {
    notificationSettings,
    updateNotificationSetting,
    isLoading: notificationLoading,
  } = useAdminNotificationSettings();

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showTimeoutDropdown, setShowTimeoutDropdown] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const timeoutOptions = [
    { value: '5', label: '5 Minutes' },
    { value: '10', label: '10 Minutes' },
    { value: '15', label: '15 Minutes' },
    { value: '30', label: '30 Minutes' },
  ];

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const addToast = (message: string, type: 'error' | 'success' = 'error') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 5000);
  };

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

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

  const handleNotificationSelectChange = async (
    field: keyof typeof notificationSettings,
    value: string
  ) => {
    try {
      await updateNotificationSetting(field, value);
      addToast('Notification preference updated successfully', 'success');
    } catch (error) {
      console.error('Error updating notification preference:', error);
      addToast('Failed to update notification preference', 'error');
    }
    setShowTimeoutDropdown(false);
  };

  return (
    <div
      className={`min-h-screen bg-[#f9f9fc] p-4 md:p-10 flex flex-col ${
        isMobile ? 'px-6 pl-24' : 'ml-52'
      }`}
    >
      {/* Header */}
      {isMobile ? (
        <div className="flex items-center mb-4">
          <h1 className="text-xl font-bold text-gray-800 pt-5">
            Notification Settings
          </h1>
        </div>
      ) : (
        <div className="mb-10">
          <h1 className="text-2xl font-semibold">Notification Settings</h1>
        </div>
      )}

      <div className="flex-1 space-y-6">
        {/* Notifications */}
        <h2 className="text-xl font-semibold">Notifications</h2>

        {[
          {
            key: 'enableDesktopNotifications',
            title: 'Enable Desktop Notification',
            desc: 'Receive notifications for all messages, contacts, and documents',
          },
          {
            key: 'enableNotificationBadge',
            title: 'Enable Notification Badge',
            desc: 'Show a red badge on the app icon when you have unread messages',
          },
        ].map((setting) => (
          <div key={setting.key} className="border p-4 rounded-md shadow-md bg-white">
            <div className="flex flex-row items-start justify-between">
              <div className="flex-1 pr-4">
                <h3 className="text-lg font-semibold">{setting.title}</h3>
                <p className="text-sm text-gray-600">{setting.desc}</p>
              </div>
              <button
                type="button"
                className={`w-14 h-7 rounded-full flex items-center px-1 shrink-0 mt-1 ${
                  notificationSettings[
                    setting.key as keyof typeof notificationSettings
                  ]
                    ? 'bg-[#3674B5]'
                    : 'bg-gray-300'
                }`}
                onClick={() =>
                  handleNotificationToggle(
                    setting.key as keyof typeof notificationSettings
                  )
                }
                disabled={notificationLoading}
              >
                <span
                  className={`w-5 h-5 bg-white rounded-full transform ${
                    notificationSettings[
                      setting.key as keyof typeof notificationSettings
                    ]
                      ? 'translate-x-7'
                      : 'translate-x-0'
                  } transition-transform duration-200`}
                ></span>
              </button>
            </div>
          </div>
        ))}

        {/* Push Notification Timeout */}
        <div className="border p-4 rounded-md shadow-md bg-white">
          <h3 className="text-lg font-semibold">Push Notification Time-out</h3>
          <div className="relative mt-2 w-full sm:w-48">
            <button
              type="button"
              onClick={() => setShowTimeoutDropdown(!showTimeoutDropdown)}
              className="flex items-center justify-between w-full text-sm text-black rounded-lg pl-4 pr-3 py-3 shadow-md bg-gray-50 focus:outline-none"
              disabled={notificationLoading}
            >
              <span className="truncate">
                {timeoutOptions.find(
                  (opt) => opt.value === notificationSettings.pushNotificationTimeout
                )?.label || 'Select Timeout'}
              </span>
              <ChevronDown
                size={16}
                className={`transform transition-transform duration-200 ${
                  showTimeoutDropdown ? 'rotate-180' : ''
                }`}
              />
            </button>
            <AnimatePresence>
              {showTimeoutDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute z-10 top-full mt-2 w-full rounded-lg shadow-lg bg-white overflow-hidden"
                >
                  {timeoutOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() =>
                        handleNotificationSelectChange(
                          'pushNotificationTimeout',
                          option.value
                        )
                      }
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      {option.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Email Notifications */}
        <h2 className="text-xl font-semibold mt-8">Email Notifications</h2>

        {[
          {
            key: 'communicationEmails',
            title: 'Communication Emails',
            desc: 'Receive emails for messages, contacts, and documents',
          },
          {
            key: 'announcementsEmails',
            title: 'Announcements & Updates',
            desc: 'Receive emails about product updates, improvements, etc.',
          },
        ].map((setting) => (
          <div key={setting.key} className="border p-4 rounded-md shadow-md bg-white">
            <div className="flex flex-row items-start justify-between">
              <div className="flex-1 pr-4">
                <h3 className="text-lg font-semibold">{setting.title}</h3>
                <p className="text-sm text-gray-600">{setting.desc}</p>
              </div>
              <button
                type="button"
                className={`w-14 h-7 rounded-full flex items-center px-1 shrink-0 mt-1 ${
                  notificationSettings[
                    setting.key as keyof typeof notificationSettings
                  ]
                    ? 'bg-[#3674B5]'
                    : 'bg-gray-300'
                }`}
                onClick={() =>
                  handleNotificationToggle(
                    setting.key as keyof typeof notificationSettings
                  )
                }
                disabled={notificationLoading}
              >
                <span
                  className={`w-5 h-5 bg-white rounded-full transform ${
                    notificationSettings[
                      setting.key as keyof typeof notificationSettings
                    ]
                      ? 'translate-x-7'
                      : 'translate-x-0'
                  } transition-transform duration-200`}
                ></span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`text-white px-4 py-2 rounded-md shadow-lg flex items-center justify-between max-w-xs animate-slideIn ${
              toast.type === 'error' ? 'bg-red-400' : 'bg-green-400'
            }`}
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
