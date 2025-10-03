
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { Lock, Bell, CheckCircle, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { useMutation, useQuery } from '@apollo/client';
import { CHANGE_SUPERADMIN_PASSWORD } from '../../graphql/superadmin/mutations/changeSuperAdminPassword';
import { UPDATE_SUPERADMIN } from '../../graphql/superadmin/mutations/updateSuperAdmin';
import { DEACTIVATE_SUPERADMIN } from '../../graphql/superadmin/mutations/deactivateSuperAdmin';
import { UPDATE_SUPERADMIN_NOTIFICATION_PREFERENCES } from '../../graphql/superadmin/mutations/updateSuperAdminNotificationPreferences';
import { GET_SUPERADMIN_NOTIFICATION_PREFERENCES } from '../../graphql/superadmin/queries/getSuperAdminNotificationPreferences';

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
  });
  
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

    // Check if recovery email is the same as primary email
    if (recoveryEmail === admin?.email) {
      addToast('Recovery email cannot be the same as your primary email address.', 'error');
      return;
    }

    try {
      await updateSuperAdmin({
        variables: {
          superAdminId: admin?.userId,
          input: {
            recoveryEmail: recoveryEmail
          }
        }
      });
      addToast('Recovery email updated successfully!', 'success');
      // Keep the recovery email in the form field instead of clearing it
    } catch (err: any) {
      addToast(err.message || 'Failed to update recovery email. Please try again.', 'error');
    }
  };

  // Handle Notification Settings form submission
  const handleNotificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setToasts([]);

    try {
      await updateNotificationPreferences({
        variables: {
          input: {
            enableDesktopNotifications: notificationForm.enableDesktopNotifications,
            enableNotificationBadge: notificationForm.enableNotificationBadge,
            pushNotificationTimeout: notificationForm.pushNotificationTimeout,
            communicationEmails: notificationForm.communicationEmails,
            announcementsEmails: notificationForm.announcementsEmails,
          }
        }
      });
      
      addToast('Notification settings saved successfully!', 'success');
      // Refetch the data to ensure UI is in sync
      refetchNotifications();
    } catch (err: any) {
      addToast(err.message || 'Failed to save notification settings. Please try again.', 'error');
    }
  };

  // Handle password change
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setToasts([]);

    const { currentPassword, newPassword, confirmPassword } = passwordForm;

    if (!currentPassword || !newPassword || !confirmPassword) {
      addToast('All password fields are required.', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      addToast('New passwords do not match.', 'error');
      return;
    }

    if (newPassword.length < 8) {
      addToast('New password must be at least 8 characters long.', 'error');
      return;
    }

    try {
      await changePassword({
        variables: {
          currentPassword,
          newPassword
        }
      });
      addToast('Password changed successfully!', 'success');
      setShowPasswordModal(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      addToast(err.message || 'Failed to change password. Please try again.', 'error');
    }
  };

  // Handle Deactivate Account
  const handleDeactivateAccount = async () => {
    if (deactivateConfirmText !== 'DEACTIVATE') {
      addToast('Please type DEACTIVATE to confirm.', 'error');
      return;
    }

    try {
      await deactivateSuperAdmin({
        variables: {
          id: admin?.userId
        }
      });
      addToast('Account deactivated successfully. You will be logged out.', 'success');
      setTimeout(() => {
        navigate('/superadmin/login');
      }, 2000);
    } catch (err: any) {
      addToast(err.message || 'Failed to deactivate account. Please try again.', 'error');
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
                    onClick={() => setShowPasswordModal(true)}
                  >
                    Change Password
                  </button>
                </div>
              </div>

              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">Recovery Settings</h2>

              {/* Recovery Email Address */}
              <div className="border border-gray-200 p-4 rounded-xl shadow-sm">
                <h3 className="text-lg font-semibold text-gray-800">Recovery Email Address</h3>
                <p className="text-sm text-gray-600 mb-2">Set recovery email to secure your account.</p>
                <p className="text-xs text-blue-600 mb-4">💡 You can use this recovery email to log in to your account.</p>
                
                {/* Current Recovery Email Display */}
                {admin?.recoveryEmail && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center">
                      <CheckCircle className="text-green-500 mr-2" size={16} />
                      <span className="text-sm text-green-700">
                        Current recovery email: <strong>{admin.recoveryEmail}</strong>
                      </span>
                    </div>
                  </div>
                )}
                
                <form className="space-y-4" onSubmit={handleRecoveryEmailSubmit}>
                  <div>
                    <label htmlFor="recoveryEmail" className="block text-sm font-medium text-gray-700">
                      {admin?.recoveryEmail ? 'Update Recovery Email Address' : 'Another Email Address'}
                    </label>
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
                      {admin?.recoveryEmail ? 'Update Recovery Email' : 'Save Recovery Email'}
                    </button>
                  </div>
                </form>
              </div>


              {/* Deactivate Account */}
              <div className="border border-gray-200 p-4 rounded-xl shadow-sm">
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
          <div className="bg-white rounded-3xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Notification Settings</h2>
            {notificationLoading ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3674B5]"></div>
                <span className="ml-3 text-gray-600">Loading notification settings...</span>
              </div>
            ) : (
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

              <div className="flex justify-end mt-6">
                <button
                  type="submit"
                  className="px-6 py-3 bg-[#3674B5] text-white rounded-lg font-semibold hover:bg-[#1b5087] transition-colors shadow-md"
                >
                  Save Notification Settings
                </button>
              </div>
            </form>
            )}
          </div>
        )}
      </main>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-800 mb-6">Change Password</h3>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              {/* Current Password */}
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    id="currentPassword"
                    name="currentPassword"
                    type={showPasswords.current ? 'text' : 'password'}
                    value={passwordForm.currentPassword}
                    onChange={handlePasswordInputChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#3674B5] focus:border-[#3674B5] pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('current')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.current ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="newPassword"
                    name="newPassword"
                    type={showPasswords.new ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={handlePasswordInputChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#3674B5] focus:border-[#3674B5] pr-10"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('new')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.new ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPasswords.confirm ? 'text' : 'password'}
                    value={passwordForm.confirmPassword}
                    onChange={handlePasswordInputChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#3674B5] focus:border-[#3674B5] pr-10"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('confirm')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.confirm ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
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

      {/* Toast Notifications Container */}
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



//

