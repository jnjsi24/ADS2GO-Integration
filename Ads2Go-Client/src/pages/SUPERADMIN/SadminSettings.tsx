
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { User, Lock, Bell, CheckCircle } from 'lucide-react';
import ToastNotifications from './tabs/SadminAdmin/ToastNotifications';

// Function to get initials from name
const getInitials = (name: string | undefined) => {
  if (!name) return '';
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// Toast notification type
type Toast = {
  id: number;
  message: string;
  type: 'error' | 'success';
};

const SadminSettings: React.FC = () => {
  const { admin } = useAdminAuth();
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState('Security and Privacy');
  
  // State for Security and Privacy form
  const [securityForm, setSecurityForm] = useState({
    recoveryEmail: '',
    recoveryPhone: '',
  });
  
  // State for Notification Settings form
  const [notificationForm, setNotificationForm] = useState({
    enableDesktopNotifications: false,
    enableNotificationBadge: true,
    pushNotificationTimeout: '10',
    communicationEmails: false,
    announcementsEmails: true,
    disableNotificationSounds: true,
  });
  
  // State for profile image
  const [profileImage, setProfileImage] = useState<string | null>(null);

  // State for toast notifications
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  // State to toggle form editability
  const [isFormEditable, setIsFormEditable] = useState(false);

  // Dropdown options for Field
  const fieldOptions = [
    'Finance',
    'Marketing',
    'Human Resources',
    'Information Technology',
    'Operations',
    'Sales',
    'Customer Service',
    'Research and Development',
    'Legal',
    'Others',
  ];

  // Dropdown options for Branch (Philippine cities/areas)
  const branchOptions = [
    'Quezon City',
    'Makati City',
    'Manila',
    'Pasig City',
    'Taguig City',
    'Cebu City',
    'Davao City',
    'Parañaque City',
    'Las Piñas City',
    'Mandaluyong City',
  ];

  // Handle file input change for profile image
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        addToast('Please upload an image file.', 'error');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        addToast('Image size must be less than 5MB.', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Add toast notification
  const addToast = (message: string, type: 'error' | 'success' = 'error') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  // Remove toast notification
  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const handleToggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleManageUsers = () => {
    addToast('Navigating to Manage Users page (feature not implemented in this component).', 'success');
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSecurityForm({ recoveryEmail: '', recoveryPhone: '' });
    setToasts([]);
  };

  // Handle form input changes for Security and Notification
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setNotificationForm((prev) => ({ ...prev, [name]: checked }));
    } else {
      setNotificationForm((prev) => ({ ...prev, [name]: value }));
      setSecurityForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  // Handle toggle button change for notifications
  const handleToggleChange = (field: keyof typeof notificationForm) => {
    setNotificationForm((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  // Handle Recovery Email form submission
  const handleRecoveryEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setToasts([]);

    const { recoveryEmail } = securityForm;

    if (!recoveryEmail) {
      addToast('Recovery email is required.', 'error');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recoveryEmail)) {
      addToast('Please enter a valid email address.', 'error');
      return;
    }

    try {
      console.log('Setting recovery email:', { recoveryEmail });
      addToast('Recovery email set successfully!', 'success');
      setSecurityForm((prev) => ({ ...prev, recoveryEmail: '' }));
    } catch (err) {
      addToast('Failed to set recovery email. Please try again.', 'error');
    }
  };

  // Handle Notification Settings form submission
  const handleNotificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setToasts([]);

    try {
      console.log('Saving notification settings:', notificationForm);
      addToast('Notification settings saved successfully!', 'success');
    } catch (err) {
      addToast('Failed to save notification settings. Please try again.', 'error');
    }
  };

  // Handle Deactivate Account
  const handleDeactivateAccount = () => {
    addToast('Account deactivated successfully. It will reactivate upon signing in.', 'success');
    console.log('Deactivating account...');
  };

  // Toggle form editability
  const toggleFormEditable = () => {
    setIsFormEditable(!isFormEditable);
    setToasts([]);
  };

  // Handle Back button click
  const handleBack = () => {
    setIsFormEditable(false);
    setToasts([]);
    setProfileImage(null);
  };

  return (
    <div className="font-sans min-h-screen bg-gray-100 p-9 ml-60 flex"> 
      {/* Left Navigation */}
      <aside className="w-64 bg-white shadow-lg h-min p-6 rounded-3xl mr-6">
        <nav className="space-y-4">
          <button
            className={`w-full flex items-center p-3 rounded-xl text-left transition-colors duration-200 ${
              activeTab === 'Security and Privacy'
                ? 'bg-[#E6F0F8] text-[#3674B5] font-semibold'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
            onClick={() => handleTabChange('Security and Privacy')}
          >
            <Lock size={20} className="mr-3" />
            Security and Privacy
          </button>
          <button
            className={`w-full flex items-center p-3 rounded-xl text-left transition-colors duration-200 ${
              activeTab === 'Notification Settings'
                ? 'bg-[#E6F0F8] text-[#3674B5] font-semibold'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
            onClick={() => handleTabChange('Notification Settings')}
          >
            <Bell size={20} className="mr-3" />
            Notification Settings
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1">
        {activeTab === 'Security and Privacy' && (
          <div className="bg-white rounded-3xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Security and Privacy</h2>
            <div className="space-y-6">
              {/* Verify Email Address */}
              <div className="border border-gray-200 p-4 rounded-xl shadow-sm">
                <h3 className="text-lg font-semibold text-gray-800">Verify Email Address</h3>
                <p className="text-sm text-gray-600 mb-4">Verify your email address to confirm your credentials.</p>
                <div className="flex justify-end">
                  <button
                    className="px-6 py-2 bg-[#3674B5] text-white rounded-lg hover:bg-[#1b5087] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled
                  >
                    Verified
                  </button>
                </div>
              </div>

              {/* Update Password */}
              <div className="border border-gray-200 p-4 rounded-xl shadow-sm">
                <h3 className="text-lg font-semibold text-gray-800">Update Password</h3>
                <p className="text-sm text-gray-600 mb-4">Change your password to update and protect your account.</p>
                <div className="flex justify-end">
                  <button
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                    onClick={() => addToast('Change Password functionality not implemented.', 'success')}
                  >
                    Change Password
                  </button>
                </div>
              </div>

              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">Recovery Settings</h2>

              {/* Recovery Email Address */}
              <div className="border border-gray-200 p-4 rounded-xl shadow-sm">
                <h3 className="text-lg font-semibold text-gray-800">Recovery Email Address</h3>
                <p className="text-sm text-gray-600 mb-4">Set recovery email to secure your account.</p>
                <form className="space-y-4" onSubmit={handleRecoveryEmailSubmit}>
                  <div>
                    <label htmlFor="recoveryEmail" className="block text-sm font-medium text-gray-700">Another Email Address</label>
                    <input
                      id="recoveryEmail"
                      type="email"
                      name="recoveryEmail"
                      value={securityForm.recoveryEmail}
                      onChange={handleInputChange}
                      placeholder="example@gmail.com"
                      className="mt-1 p-2 block w-full bg-gray-50 border border-gray-300 rounded-md focus:ring-[#3674B5] focus:border-[#3674B5]"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-6 py-2 bg-[#3674B5] text-white rounded-lg hover:bg-[#1b5087] transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </form>
              </div>

              {/* Recovery Phone Number */}
              <div className="border border-gray-200 p-4 rounded-xl shadow-sm">
                <h3 className="text-lg font-semibold text-gray-800">Recovery Phone Number</h3>
                <p className="text-sm text-gray-600 mb-4">Add phone number to set up SMS recovery for your account.</p>
                <div className="flex justify-end">
                  <button
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                    onClick={() => addToast('Setup Phone Recovery functionality not implemented.', 'success')}
                  >
                    Setup
                  </button>
                </div>
              </div>

              {/* Deactivate Account */}
              <div className="border border-gray-200 p-4 rounded-xl shadow-sm">
                <h3 className="text-lg font-semibold text-gray-800">Deactivate Account</h3>
                <p className="text-sm text-gray-600 mb-4">This will deactivate your account and will reactivate upon signing in again.</p>
                <div className="flex justify-end">
                  <button
                    className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    onClick={handleDeactivateAccount}
                  >
                    Deactivate
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Notification Settings' && (
          <div className="bg-white rounded-3xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Notification Settings</h2>
            <form className="space-y-6" onSubmit={handleNotificationSubmit}>
              {/* Enable Desktop Notification */}
              <div className="border border-gray-200 p-4 rounded-xl shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Enable Desktop Notification</h3>
                    <p className="text-sm text-gray-600">Receive notifications for all messages, contacts, and documents.</p>
                  </div>
                  <button
                    type="button"
                    className={`w-14 h-7 rounded-full flex items-center px-1 hover:scale-105 transition-all duration-300 ${notificationForm.enableDesktopNotifications ? 'bg-[#3674B5]' : 'bg-gray-300'}`}
                    onClick={() => handleToggleChange('enableDesktopNotifications')}
                  >
                    <span className={`w-5 h-5 bg-white rounded-full transform ${notificationForm.enableDesktopNotifications ? 'translate-x-7' : 'translate-x-0'} transition-transform duration-200`}></span>
                  </button>
                </div>
              </div>

              {/* Enable Notification Badge */}
              <div className="border border-gray-200 p-4 rounded-xl shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Enable Notification Badge</h3>
                    <p className="text-sm text-gray-600">Show a red badge on the app icon when you have unread messages.</p>
                  </div>
                  <button
                    type="button"
                    className={`w-14 h-7 rounded-full flex items-center px-1 hover:scale-105 transition-all duration-300 ${notificationForm.enableNotificationBadge ? 'bg-[#3674B5]' : 'bg-gray-300'}`}
                    onClick={() => handleToggleChange('enableNotificationBadge')}
                  >
                    <span className={`w-5 h-5 bg-white rounded-full transform ${notificationForm.enableNotificationBadge ? 'translate-x-7' : 'translate-x-0'} transition-transform duration-200`}></span>
                  </button>
                </div>
              </div>

              {/* Push Notification Time-out */}
              <div className="border border-gray-200 p-4 rounded-xl shadow-sm">
                <h3 className="text-lg font-semibold text-gray-800">Push Notification Time-out</h3>
                <select
                  name="pushNotificationTimeout"
                  value={notificationForm.pushNotificationTimeout}
                  onChange={handleInputChange}
                  className="mt-2 block w-full md:w-48 p-2 border border-gray-300 rounded-md focus:ring-[#3674B5] focus:border-[#3674B5] bg-white"
                >
                  <option value="5">5 Minutes</option>
                  <option value="10">10 Minutes</option>
                  <option value="15">15 Minutes</option>
                  <option value="30">30 Minutes</option>
                </select>
              </div>

              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">Email Notifications</h2>

              {/* Communication Emails */}
              <div className="border border-gray-200 p-4 rounded-xl shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Communication Emails</h3>
                    <p className="text-sm text-gray-600">Receive emails for messages, contacts, and documents.</p>
                  </div>
                  <button
                    type="button"
                    className={`w-14 h-7 rounded-full flex items-center px-1 hover:scale-105 transition-all duration-300 ${notificationForm.communicationEmails ? 'bg-[#3674B5]' : 'bg-gray-300'}`}
                    onClick={() => handleToggleChange('communicationEmails')}
                  >
                    <span className={`w-5 h-5 bg-white rounded-full transform ${notificationForm.communicationEmails ? 'translate-x-7' : 'translate-x-0'} transition-transform duration-200`}></span>
                  </button>
                </div>
              </div>

              {/* Announcements & Updates */}
              <div className="border border-gray-200 p-4 rounded-xl shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Announcements & Updates</h3>
                    <p className="text-sm text-gray-600">Receive emails about product updates, improvements, etc.</p>
                  </div>
                  <button
                    type="button"
                    className={`w-14 h-7 rounded-full flex items-center px-1 hover:scale-105 transition-all duration-300 ${notificationForm.announcementsEmails ? 'bg-[#3674B5]' : 'bg-gray-300'}`}
                    onClick={() => handleToggleChange('announcementsEmails')}
                  >
                    <span className={`w-5 h-5 bg-white rounded-full transform ${notificationForm.announcementsEmails ? 'translate-x-7' : 'translate-x-0'} transition-transform duration-200`}></span>
                  </button>
                </div>
              </div>

              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">Sounds</h2>

              {/* Disable All Notification Sounds */}
              <div className="border border-gray-200 p-4 rounded-xl shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Disable All Notification Sounds</h3>
                    <p className="text-sm text-gray-600">Mute all notifications for messages, contacts, and documents.</p>
                  </div>
                  <button
                    type="button"
                    className={`w-14 h-7 rounded-full flex items-center px-1 hover:scale-105 transition-all duration-300 ${notificationForm.disableNotificationSounds ? 'bg-[#3674B5]' : 'bg-gray-300'}`}
                    onClick={() => handleToggleChange('disableNotificationSounds')}
                  >
                    <span className={`w-5 h-5 bg-white rounded-full transform ${notificationForm.disableNotificationSounds ? 'translate-x-7' : 'translate-x-0'} transition-transform duration-200`}></span>
                  </button>
                </div>
              </div>
              <div className="flex justify-end mt-6">
                <button
                  type="submit"
                  className="px-6 py-3 bg-[#3674B5] text-white rounded-lg font-semibold hover:bg-[#1b5087] transition-colors shadow-md"
                >
                  Save Notification Settings
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Toast Notifications */}
      <ToastNotifications toasts={toasts} onRemove={removeToast} />

    </div>
  );
};

export default SadminSettings;



//

