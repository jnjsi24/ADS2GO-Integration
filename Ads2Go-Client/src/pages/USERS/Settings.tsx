import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserAuth } from '../../contexts/UserAuthContext';

// Toast notification type
type Toast = {
  id: number;
  message: string;
  type: 'error' | 'success';
};

const Settings: React.FC = () => {
  const { user } = useUserAuth();
  const navigate = useNavigate();
  // State for Notification Settings form
  const [notificationForm, setNotificationForm] = useState({
    enableDesktopNotifications: false,
    enableNotificationBadge: true,
    pushNotificationTimeout: '10',
    communicationEmails: false,
    announcementsEmails: true,
    disableNotificationSounds: true,
  });

  // State for toast notifications
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Handle form input changes for Notification Settings
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setNotificationForm((prev) => ({ ...prev, [name]: checked }));
    } else {
      setNotificationForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  // Handle toggle button change for notifications
  const handleToggleChange = (field: keyof typeof notificationForm) => {
    setNotificationForm((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  // Handle Notification Settings form submission
  const handleNotificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setToasts([]);

    try {
      // Simulate an API call to save notification settings
      console.log('Saving notification settings:', notificationForm);
      addToast('Notification settings saved successfully!', 'success');
    } catch (err) {
      addToast('Failed to save notification settings. Please try again.', 'error');
    }
  };

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

  return (
    <div className="min-h-screen pl-72 pr-5 p-10 bg-gradient-to-b from-[#EEEEEE] to-[#F8FAFC]">
  {/* Header */}
      <div className="flex-1 justify-between items-start md:items-center mb-8 gap-4">
          <h2 className="text-xl font-semibold mb-2">Notifications</h2>
          <form className="space-y-6" onSubmit={handleNotificationSubmit}>
            <div className="border p-4 rounded-md">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Enable Desktop Notification</h3>
                  <p className="text-sm text-gray-600">Receive notifications for all messages, contacts, and documents</p>
                </div>
                <button
                  type="button"
                  className={`w-14 h-7 rounded-full flex items-center px-1 hover:scale-105 transition-transform duration-300 ${notificationForm.enableDesktopNotifications ? 'bg-[#F3A26D]' : 'bg-gray-300'}`}
                  onClick={() => handleToggleChange('enableDesktopNotifications')}
                >
                  <span className={`w-5 h-5 bg-white rounded-full transform ${notificationForm.enableDesktopNotifications ? 'translate-x-7' : 'translate-x-0'} transition-transform duration-300`}></span>
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
                  className={`w-14 h-7 rounded-full flex items-center px-1 hover:scale-105 transition-transform duration-300 ${notificationForm.enableNotificationBadge ? 'bg-[#F3A26D]' : 'bg-gray-300'}`}
                  onClick={() => handleToggleChange('enableNotificationBadge')}
                >
                  <span className={`w-5 h-5 bg-white rounded-full transform ${notificationForm.enableNotificationBadge ? 'translate-x-7' : 'translate-x-0'} transition-transform duration-300`}></span>
                </button>
              </div>
            </div>

            <div className="border p-4 rounded-md">
              <h3 className="text-lg font-semibold">Push Notification Time-out</h3>
              <select
                name="pushNotificationTimeout"
                value={notificationForm.pushNotificationTimeout}
                onChange={handleInputChange}
                className="mt-2 block w-32 border-gray-300 rounded-md focus:outline-none"
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
                  className={`w-14 h-7 rounded-full flex items-center px-1 hover:scale-105 transition-transform duration-300 ${notificationForm.communicationEmails ? 'bg-[#F3A26D]' : 'bg-gray-300'}`}
                  onClick={() => handleToggleChange('communicationEmails')}
                >
                  <span className={`w-5 h-5 bg-white rounded-full transform ${notificationForm.communicationEmails ? 'translate-x-7' : 'translate-x-0'} transition-transform duration-300`}></span>
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
                  className={`w-14 h-7 rounded-full flex items-center px-1 hover:scale-105 transition-transform duration-300 ${notificationForm.announcementsEmails ? 'bg-[#F3A26D]' : 'bg-gray-300'}`}
                  onClick={() => handleToggleChange('announcementsEmails')}
                >
                  <span className={`w-5 h-5 bg-white rounded-full transform ${notificationForm.announcementsEmails ? 'translate-x-7' : 'translate-x-0'} transition-transform duration-300`}></span>
                </button>
              </div>
            </div>

            <h2 className="text-xl font-semibold mt-6">Sounds</h2>

            <div className="border p-4 rounded-md">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Disable All Notification Sounds</h3>
                  <p className="text-sm text-gray-600">Mute all notifications for messages, contacts, and documents</p>
                </div>
                <button
                  type="button"
                  className={`w-14 h-7 rounded-full flex items-center px-1 hover:scale-105 transition-transform duration-300 ${notificationForm.disableNotificationSounds ? 'bg-[#F3A26D]' : 'bg-gray-300'}`}
                  onClick={() => handleToggleChange('disableNotificationSounds')}
                >
                  <span className={`w-5 h-5 bg-white rounded-full transform ${notificationForm.disableNotificationSounds ? 'translate-x-7' : 'translate-x-0'} transition-transform duration-300`}></span>
                </button>
              </div>
            </div>
          </form>
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

export default Settings;