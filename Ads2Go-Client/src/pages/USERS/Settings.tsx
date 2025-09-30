import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { NewsletterService } from '../../services/newsletterService';
import { useQuery, useMutation } from '@apollo/client';
import { GET_USER_NOTIFICATION_PREFERENCES } from '../../graphql/user/queries/getUserNotificationPreferences';
import { UPDATE_USER_NOTIFICATION_PREFERENCES } from '../../graphql/user/mutations/updateUserNotificationPreferences';

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
  });

  // State for newsletter subscription
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false);
  const [newsletterLoading, setNewsletterLoading] = useState(false);

  // State for toast notifications
  const [toasts, setToasts] = useState<Toast[]>([]);

  // GraphQL hooks
  const { data: notificationPreferencesData, loading: notificationPreferencesLoading, refetch: refetchNotifications } = useQuery(GET_USER_NOTIFICATION_PREFERENCES, {
    onCompleted: (data) => {
      if (data?.getUserNotificationPreferences) {
        setNotificationForm({
          enableDesktopNotifications: data.getUserNotificationPreferences.enableDesktopNotifications,
          enableNotificationBadge: data.getUserNotificationPreferences.enableNotificationBadge,
          pushNotificationTimeout: data.getUserNotificationPreferences.pushNotificationTimeout,
          communicationEmails: data.getUserNotificationPreferences.communicationEmails,
          announcementsEmails: data.getUserNotificationPreferences.announcementsEmails,
        });
      }
    },
    onError: (error) => {
      console.error('Error fetching notification preferences:', error);
      addToast('Failed to load notification preferences', 'error');
    }
  });

  const [updateNotificationPreferences, { loading: updateLoading }] = useMutation(UPDATE_USER_NOTIFICATION_PREFERENCES, {
    onCompleted: (data) => {
      console.log('Mutation completed:', data);
      if (data?.updateUserNotificationPreferences?.success) {
        addToast('Notification preferences saved successfully!', 'success');
      } else {
        addToast('Failed to save notification preferences', 'error');
      }
    },
    onError: (error) => {
      console.error('Error updating notification preferences:', error);
      console.error('GraphQL errors:', error.graphQLErrors);
      console.error('Network error:', error.networkError);
      addToast(`Failed to save notification preferences: ${error.message}`, 'error');
    }
  });

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

  // Check newsletter subscription status on component mount
  useEffect(() => {
    if (user?.email) {
      checkNewsletterStatus();
    }
  }, [user?.email]);

  const checkNewsletterStatus = async () => {
    try {
      const isSubscribed = await NewsletterService.checkSubscriptionStatus(user?.email || '');
      setNewsletterSubscribed(isSubscribed);
    } catch (error) {
      console.error('Error checking newsletter status:', error);
    }
  };

  const handleNewsletterToggle = async () => {
    if (!user?.email) return;

    setNewsletterLoading(true);
    try {
      if (newsletterSubscribed) {
        // Unsubscribe
        const apiUrl = process.env.REACT_APP_API_URL;
        
        if (!apiUrl) {
          console.error('❌ Missing REACT_APP_API_URL environment variable');
          throw new Error('REACT_APP_API_URL is required in .env file');
        }
        const response = await fetch(`${apiUrl}/api/newsletter/unsubscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: user.email }),
        });

        const data = await response.json();
        if (data.success) {
          setNewsletterSubscribed(false);
          addToast('Successfully unsubscribed from newsletter', 'success');
        } else {
          addToast('Failed to unsubscribe: ' + data.message, 'error');
        }
      } else {
        // Subscribe
        const result = await NewsletterService.subscribeToNewsletter(user.email, 'manual');
        if (result.success) {
          setNewsletterSubscribed(true);
          addToast('Successfully subscribed to newsletter', 'success');
        } else {
          addToast('Failed to subscribe: ' + result.message, 'error');
        }
      }
    } catch (error) {
      addToast('An error occurred. Please try again.', 'error');
    } finally {
      setNewsletterLoading(false);
    }
  };

  // Handle Notification Settings form submission
  const handleNotificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setToasts([]);

    try {
      console.log('Submitting notification form:', notificationForm);
      const result = await updateNotificationPreferences({
        variables: {
          input: notificationForm
        }
      });
      console.log('Mutation result:', result);
    } catch (err) {
      console.error('Error saving notification settings:', err);
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

  // Show loading state while fetching preferences
  if (notificationPreferencesLoading) {
    return (
      <div className="flex-1 pl-60 pr-1">
        <div className="flex">
          <div className="flex-1 bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F3A26D]"></div>
              <span className="ml-3 text-gray-600">Loading settings...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 pl-60 pr-1">
      <div className="flex">
        <div className="flex-1 bg-white p-6 rounded-lg shadow">
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

            <h2 className="text-xl font-semibold mt-6">Newsletter Subscription</h2>

            <div className="border p-4 rounded-md">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Company Newsletter</h3>
                  <p className="text-sm text-gray-600">
                    {newsletterSubscribed 
                      ? 'You are subscribed to our newsletter and will receive company updates, industry insights, and exclusive offers.'
                      : 'Subscribe to receive company updates, industry insights, and exclusive offers via email.'
                    }
                  </p>
                </div>
                <button
                  type="button"
                  disabled={newsletterLoading}
                  className={`w-14 h-7 rounded-full flex items-center px-1 hover:scale-105 transition-transform duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
                    newsletterSubscribed ? 'bg-[#F3A26D]' : 'bg-gray-300'
                  }`}
                  onClick={handleNewsletterToggle}
                >
                  <span className={`w-5 h-5 bg-white rounded-full transform transition-transform duration-300 ${
                    newsletterSubscribed ? 'translate-x-7' : 'translate-x-0'
                  }`}></span>
                </button>
              </div>
              {newsletterLoading && (
                <div className="mt-2 text-sm text-gray-500">
                  {newsletterSubscribed ? 'Unsubscribing...' : 'Subscribing...'}
                </div>
              )}
            </div>


            {/* Save Button */}
            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={updateLoading || notificationPreferencesLoading}
                className={`px-6 py-2 rounded-md font-medium transition-colors duration-200 ${
                  updateLoading || notificationPreferencesLoading
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-[#F3A26D] text-white hover:bg-[#E8915A]'
                }`}
              >
                {updateLoading ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
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

export default Settings;