import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { Lock, Bell, ChevronDown, CheckCircle, Eye, EyeOff, AlertTriangle, User } from 'lucide-react';
import { useMutation, useQuery } from '@apollo/client';
import { CHANGE_SUPERADMIN_PASSWORD } from '../../graphql/superadmin/mutations/changeSuperAdminPassword';
import { UPDATE_SUPERADMIN } from '../../graphql/superadmin/mutations/updateSuperAdmin';
import { DEACTIVATE_SUPERADMIN } from '../../graphql/superadmin/mutations/deactivateSuperAdmin';
import { UPDATE_SUPERADMIN_NOTIFICATION_PREFERENCES } from '../../graphql/superadmin/mutations/updateSuperAdminNotificationPreferences';
import { GET_SUPERADMIN_NOTIFICATION_PREFERENCES } from '../../graphql/superadmin/queries/getSuperAdminNotificationPreferences';
import ToastNotifications from './tabs/SadminAdmin/ToastNotifications';
import { motion, AnimatePresence } from 'framer-motion';

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

// Tab configuration
const tabs = [
  { id: 'Security and Privacy', label: 'Security and Privacy', icon: Lock },
  { id: 'Notification Settings', label: 'Notification Settings', icon: Bell },
];

const SadminSettings: React.FC = () => {
  const { admin } = useAdminAuth();
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState('Security and Privacy');
  const [showTimeoutDropdown, setShowTimeoutDropdown] = useState(false);
  const [selectedTimeoutOption, setSelectedTimeoutOption] = useState('10 Minutes');
  const timeoutOptions = ['5 Minutes', '10 Minutes', '15 Minutes', '30 Minutes'];
  
  // State for Security and Privacy form
  const [securityForm, setSecurityForm] = useState({
    recoveryEmail: '',
    recoveryPhone: '',
  });

  // State for password change modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // State for account deactivation modal
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivateConfirmText, setDeactivateConfirmText] = useState('');
  
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

  // GraphQL mutations
  const [changePassword] = useMutation(CHANGE_SUPERADMIN_PASSWORD);
  const [updateSuperAdmin] = useMutation(UPDATE_SUPERADMIN);
  const [deactivateSuperAdmin] = useMutation(DEACTIVATE_SUPERADMIN);
  const [updateNotificationPreferences] = useMutation(UPDATE_SUPERADMIN_NOTIFICATION_PREFERENCES);

  // GraphQL queries
  const { data: notificationData, loading: notificationLoading, refetch: refetchNotifications } = useQuery(GET_SUPERADMIN_NOTIFICATION_PREFERENCES);

  // Update notification form when data is loaded
  React.useEffect(() => {
    if (notificationData?.getOwnSuperAdminDetails?.notificationPreferences) {
      const prefs = notificationData.getOwnSuperAdminDetails.notificationPreferences;
      setNotificationForm({
        enableDesktopNotifications: prefs.enableDesktopNotifications,
        enableNotificationBadge: prefs.enableNotificationBadge,
        pushNotificationTimeout: prefs.pushNotificationTimeout,
        communicationEmails: prefs.communicationEmails,
        announcementsEmails: prefs.announcementsEmails,
        disableNotificationSounds: prefs.disableNotificationSounds,
      });
    }
  }, [notificationData]);

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

  const handleTimeoutChange = (option) => {
    setSelectedTimeoutOption(option);
    setShowTimeoutDropdown(false);
    // optional: also update form or mutation here
    // setNotificationForm({ ...notificationForm, pushNotificationTimeout: option });
  };

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
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 5000);
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

  // Handle password form input changes
  const handlePasswordInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
  };

  // Toggle password visibility
  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
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
    if (recoveryEmail === admin?.email) {
      addToast('Recovery email cannot be the same as your current email.', 'error');
      return;
    }
    try {
      await updateSuperAdmin({
        variables: { input: { recoveryEmail } },
      });
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
      await updateNotificationPreferences({
        variables: { input: notificationForm },
      });
      refetchNotifications();
      addToast('Notification settings saved successfully!', 'success');
    } catch (err) {
      addToast('Failed to save notification settings. Please try again.', 'error');
    }
  };

  // Handle Change Password form submission
  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setToasts([]);
    const { currentPassword, newPassword, confirmPassword } = passwordForm;
    if (newPassword !== confirmPassword) {
      addToast('New passwords do not match.', 'error');
      return;
    }
    if (newPassword.length < 8) {
      addToast('New password must be at least 8 characters.', 'error');
      return;
    }
    try {
      await changePassword({
        variables: {
          currentPassword,
          newPassword,
        },
      });
      addToast('Password changed successfully!', 'success');
      setShowPasswordModal(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      addToast('Failed to change password. Please check your current password.', 'error');
    }
  };

  // Handle Deactivate Account
  const handleDeactivateAccount = async () => {
    try {
      await deactivateSuperAdmin();
      addToast('Account deactivated successfully. You will be logged out.', 'success');
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      addToast('Failed to deactivate account. Please try again.', 'error');
    }
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
    <div className="p-8 pl-72 bg-[#f9f9fc] min-h-screen text-gray-800 font-sans">
      {/* Top Navigation */}
      <nav className="flex space-x-8 px-2 mb-6">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`relative group flex items-center py-3 px-1 font-medium text-sm transition-colors ${
                isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="h-4 w-4 mr-2" />
              {tab.label}
              <span
                className={`absolute bottom-0 left-0 h-0.5 w-full bg-blue-500 transform origin-left transition-transform duration-300 ease-out ${
                  isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                }`}
              />
            </button>
          );
        })}
      </nav>

      {/* Main Content Area */}
      <main className="flex-1">
        {activeTab === 'Security and Privacy' && (
          <div className="">
            <div className="space-y-6">
              {/* Profile Image Upload */}
              <div className="border bg-white border-gray-200 p-4 rounded-xl shadow-md">
                <h3 className="text-lg font-semibold text-gray-800">Profile Image</h3>
                <p className="text-sm text-gray-600 mb-4">Upload or change your profile image.</p>
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-xl">
                    {profileImage ? (
                      <img src={profileImage} alt="Profile" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      getInitials(admin?.name)
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="profile-upload"
                  />
                  <label htmlFor="profile-upload" className="cursor-pointer px-4 py-2 bg-[#3674B5] text-white rounded-lg hover:bg-[#1b5087] transition-colors">
                    Upload Image
                  </label>
                </div>
              </div>

              {/* Verify Email Address */}
              <div className="border bg-white border-gray-200 p-4 rounded-xl shadow-md">
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
              <div className="border bg-white border-gray-200 p-4 rounded-xl shadow-md">
                <h3 className="text-lg font-semibold text-gray-800">Update Password</h3>
                <p className="text-sm text-gray-600 mb-4">Change your password to update and protect your account.</p>
                <div className="flex justify-end">
                  <button
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                    onClick={() => setShowPasswordModal(true)}
                  >
                    Change Password
                  </button>
                </div>
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">Recovery Settings</h2>
              {/* Recovery Email Address */}
              <div className="border bg-white border-gray-200 p-4 rounded-xl shadow-md">
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
              <div className="border bg-white border-gray-200 p-4 rounded-xl shadow-md">
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
              <div className="border bg-white border-gray-200 p-4 rounded-xl shadow-md">
                <h3 className="text-lg font-semibold text-gray-800">Deactivate Account</h3>
                <p className="text-sm text-gray-600 mb-4">This will deactivate your account and will reactivate upon signing in again.</p>
                <div className="flex justify-end">
                  <button
                    className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    onClick={() => setShowDeactivateModal(true)}
                  >
                    Deactivate
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'Notification Settings' && (
          <div>
            <form className="space-y-6" onSubmit={handleNotificationSubmit}>
              {/* Enable Desktop Notification */}
              <div className="border bg-white border-gray-200 p-4 rounded-xl shadow-md">
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
              <div className="border bg-white border-gray-200 p-4 rounded-xl shadow-md">
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
              <div className="border bg-white border-gray-200 p-4 rounded-xl shadow-md">
                <h3 className="text-lg font-semibold text-gray-800">Push Notification Time-out</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Set how long notifications will stay visible on screen.
                </p>

                {/* Dropdown directly below text */}
                <div className="relative w-40">
                  <button
                    type="button"
                    onClick={() => setShowTimeoutDropdown(!showTimeoutDropdown)}
                    className="flex items-center justify-between w-full text-sm text-black rounded-lg pl-4 pr-3 py-2.5 shadow-md focus:outline-none bg-white gap-2"
                  >
                    {selectedTimeoutOption}
                    <ChevronDown
                      size={16}
                      className={`transform transition-transform duration-200 ${
                        showTimeoutDropdown ? 'rotate-180' : 'rotate-0'
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
                        className="absolute z-10 top-full mt-2 w-full rounded-lg shadow-lg bg-white overflow-hidden border border-gray-200"
                      >
                        {timeoutOptions.map((option) => (
                          <button
                            key={option}
                            onClick={() => handleTimeoutChange(option)}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                          >
                            {option}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>


              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">Email Notifications</h2>
              {/* Communication Emails */}
              <div className="border bg-white border-gray-200 p-4 rounded-xl shadow-md">
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
              <div className="border bg-white border-gray-200 p-4 rounded-xl shadow-md">
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
              <div className="border bg-white border-gray-200 p-4 rounded-xl shadow-md">
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

      {/* Password Change Modal */}
      {showPasswordModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
          <div className="flex items-center mb-6">
            <h3 className="text-2xl font-bold text-gray-800">Change Password</h3>
          </div>

          <form className="space-y-8" onSubmit={handleChangePasswordSubmit}>
            {/* Current Password */}
            <div className="relative">
              <input
                id="currentPassword"
                name="currentPassword"
                type={showPasswords.current ? 'text' : 'password'}
                value={passwordForm.currentPassword}
                onChange={handlePasswordInputChange}
                required
                placeholder=" " // important for floating label alignment
                className="peer w-full px-0 pt-4 pb-2 text-black border-b bg-transparent focus:outline-none focus:border-blue-500 focus:ring-0 transition"
              />
              <label
                htmlFor="currentPassword"
                className={`absolute left-0 text-gray-600 transition-all duration-200 ${
                  passwordForm.currentPassword
                    ? '-top-1.5 text-sm text-gray-500 font-bold'
                    : 'top-4 text-base text-gray-400'
                } peer-focus:-top-1.5 peer-focus:text-sm peer-focus:text-gray-500 peer-focus:font-bold`}
              >
                Current Password
              </label>
              <button
                type="button"
                onClick={() => togglePasswordVisibility('current')}
                className="absolute right-0 top-3 text-gray-400 hover:text-gray-600"
              >
                {showPasswords.current ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {/* New Password */}
            <div className="relative">
              <input
                id="newPassword"
                name="newPassword"
                type={showPasswords.new ? 'text' : 'password'}
                value={passwordForm.newPassword}
                onChange={handlePasswordInputChange}
                required
                minLength={8}
                placeholder=" "
                className="peer w-full px-0 pt-4 pb-2 text-black border-b bg-transparent focus:outline-none focus:border-blue-500 focus:ring-0 transition"
              />
              <label
                htmlFor="newPassword"
                className={`absolute left-0 text-gray-600 transition-all duration-200 ${
                  passwordForm.newPassword
                    ? '-top-1.5 text-sm text-gray-500 font-bold'
                    : 'top-4 text-base text-gray-400'
                } peer-focus:-top-1.5 peer-focus:text-sm peer-focus:text-gray-500 peer-focus:font-bold`}
              >
                New Password
              </label>
              <button
                type="button"
                onClick={() => togglePasswordVisibility('new')}
                className="absolute right-0 top-3 text-gray-400 hover:text-gray-600"
              >
                {showPasswords.new ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
              <p className="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
            </div>

            {/* Confirm Password */}
            <div className="relative">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPasswords.confirm ? 'text' : 'password'}
                value={passwordForm.confirmPassword}
                onChange={handlePasswordInputChange}
                required
                minLength={8}
                placeholder=" "
                className="peer w-full px-0 pt-4 pb-2 text-black border-b bg-transparent focus:outline-none focus:border-blue-500 focus:ring-0 transition"
              />
              <label
                htmlFor="confirmPassword"
                className={`absolute left-0 text-gray-600 transition-all duration-200 ${
                  passwordForm.confirmPassword
                    ? '-top-1.5 text-sm text-gray-500 font-bold'
                    : 'top-4 text-base text-gray-400'
                } peer-focus:-top-1.5 peer-focus:text-sm peer-focus:text-gray-500 peer-focus:font-bold`}
              >
                Confirm New Password
              </label>
              <button
                type="button"
                onClick={() => togglePasswordVisibility('confirm')}
                className="absolute right-0 top-3 text-gray-400 hover:text-gray-600"
              >
                {showPasswords.confirm ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {/* Buttons */}
            <div className="flex justify-between space-x-3 pt-6">
              <button
                type="button"
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#3674B5] text-white rounded-lg hover:bg-[#1b5087] transition-colors"
              >
                Change Password
              </button>
            </div>
          </form>
        </div>
      </div>
    )}



      {/* Account Deactivation Modal */}
      {showDeactivateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
            <div className="flex items-center mb-6">
              <AlertTriangle className="text-red-500 mr-3" size={24} />
              <h3 className="text-xl font-bold text-gray-800">Deactivate Account</h3>
            </div>
            <p className="text-gray-600 mb-6">
              This will deactivate your account. You will be logged out and will need to contact support to reactivate.
            </p>
            <div className="mb-6">
              <label htmlFor="deactivateConfirm" className="block text-sm font-medium text-gray-700 mb-2">
                Type <span className="font-bold text-red-600">DEACTIVATE</span> to confirm:
              </label>
              <input
                id="deactivateConfirm"
                type="text"
                value={deactivateConfirmText}
                onChange={(e) => setDeactivateConfirmText(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#3674B5] focus:border-[#3674B5]"
                placeholder="DEACTIVATE"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeactivateModal(false);
                  setDeactivateConfirmText('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeactivateAccount}
                disabled={deactivateConfirmText !== 'DEACTIVATE'}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Deactivate Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <ToastNotifications toasts={toasts} onRemove={removeToast} />

      {/* Inline CSS for animations */}
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

export default SadminSettings;