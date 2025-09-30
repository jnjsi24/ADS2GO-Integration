import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { toast } from 'sonner';
import { useQuery, useMutation } from '@apollo/client';
import { GET_ADMIN_NOTIFICATION_PREFERENCES } from '../../graphql/admin/queries/getAdminNotificationPreferences';
import { UPDATE_ADMIN_NOTIFICATION_PREFERENCES } from '../../graphql/admin/mutations/updateAdminNotificationPreferences';

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

interface AccountFormState {
  firstName: string;
  middleName?: string;
  lastName: string;
  title: string;
  practice: string;
  branch: string;
  email: string;
  contactNumber?: string;
  companyName?: string;
  houseAddress?: string;
}

const SiteSettings: React.FC = () => {
  const { admin, setAdmin } = useAdminAuth();
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState('Account Settings');
  // State for Notification Settings form
  const [notificationForm, setNotificationForm] = useState({
    enableDesktopNotifications: false,
    enableNotificationBadge: true,
    pushNotificationTimeout: '10',
    communicationEmails: false,
    announcementsEmails: true,
  });
  // State for Account Settings form
  const [accountForm, setAccountForm] = useState<AccountFormState>({
    firstName: admin?.firstName || '',
    middleName: admin?.middleName,
    lastName: admin?.lastName || '',
    title: 'CEO',
    practice: 'Finance',
    branch: 'Quezon City',
    email: admin?.email || 'ceo@yes.com',
    contactNumber: admin?.contactNumber,
    companyName: admin?.companyName,
    houseAddress: admin?.houseAddress,
  });


  // State for profile image
  const [profileImage, setProfileImage] = useState<string | null>(null);

  // State for toast notifications
  const [toasts, setToasts] = useState<Toast[]>([]);

  // GraphQL queries and mutations
  const { data: notificationPreferencesData, loading: notificationPreferencesLoading } = useQuery(GET_ADMIN_NOTIFICATION_PREFERENCES, {
    onCompleted: (data) => {
      if (data?.getAdminNotificationPreferences) {
        setNotificationForm({
          enableDesktopNotifications: data.getAdminNotificationPreferences.enableDesktopNotifications,
          enableNotificationBadge: data.getAdminNotificationPreferences.enableNotificationBadge,
          pushNotificationTimeout: data.getAdminNotificationPreferences.pushNotificationTimeout,
          communicationEmails: data.getAdminNotificationPreferences.communicationEmails,
          announcementsEmails: data.getAdminNotificationPreferences.announcementsEmails,
        });
      }
    },
    onError: (error) => {
      console.error('Error fetching notification preferences:', error);
      addToast('Failed to load notification preferences', 'error');
    }
  });

  const [updateNotificationPreferences] = useMutation(UPDATE_ADMIN_NOTIFICATION_PREFERENCES, {
    onCompleted: (data) => {
      if (data?.updateAdminNotificationPreferences?.success) {
        addToast('Notification preferences updated successfully', 'success');
      }
    },
    onError: (error) => {
      console.error('Error updating notification preferences:', error);
      addToast('Failed to update notification preferences', 'error');
    }
  });

  // Update form when admin data changes
  useEffect(() => {
    if (admin) {
      const newFormData: AccountFormState = {
        firstName: admin.firstName || '',
        middleName: admin.middleName,
        lastName: admin.lastName || '',
        title: 'CEO',
        practice: 'Finance',
        branch: 'Quezon City',
        email: admin.email || '',
        contactNumber: admin.contactNumber,
        companyName: admin.companyName,
        houseAddress: admin.houseAddress,
      };
      setAccountForm(newFormData);
    }
  }, [admin]);

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
    // Auto-dismiss after 5 seconds
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
    // Later: Persist setting to backend or local storage
  };

  const handleManageUsers = () => {
    alert('Navigate to Manage Users page');
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    // Reset form state when switching tabs
    setToasts([]);
  };

  // Handle notification preference changes
  const handleNotificationToggle = async (field: keyof typeof notificationForm) => {
    const newValue = !notificationForm[field];
    const updatedForm = { ...notificationForm, [field]: newValue };
    setNotificationForm(updatedForm);

    try {
      await updateNotificationPreferences({
        variables: {
          input: {
            [field]: newValue
          }
        }
      });
    } catch (error) {
      console.error('Error updating notification preference:', error);
      // Revert the change on error
      setNotificationForm(notificationForm);
    }
  };

  const handleNotificationSelectChange = async (field: keyof typeof notificationForm, value: string) => {
    const updatedForm = { ...notificationForm, [field]: value };
    setNotificationForm(updatedForm);

    try {
      await updateNotificationPreferences({
        variables: {
          input: {
            [field]: value
          }
        }
      });
    } catch (error) {
      console.error('Error updating notification preference:', error);
      // Revert the change on error
      setNotificationForm(notificationForm);
    }
  };







  return (
    <div className="pt-10 pb-10 pl-72 p-8 bg-[#f9f9fc]">
      <div className="bg-[#f9f9fc] w-full">
        <div className="space-x-4">
          <span
            className={`text-[#3674B5] cursor-pointer ${activeTab === 'Account Settings' ? 'font-bold border-b-2 border-[#3674B5]' : 'text-black'}`}
            onClick={() => handleTabChange('Account Settings')}
          >
            Account Settings
          </span>
          <span
            className={`text-[#3674B5] cursor-pointer ${activeTab === 'Notification Settings' ? 'font-bold border-b-2 border-[#3674B5]' : 'text-black'}`}
            onClick={() => handleTabChange('Notification Settings')}
          >
            Notification Settings
          </span>
        </div>
      </div>
      {/* Tab Content */}
      {activeTab === 'Account Settings' && (
        <div className="flex mt-6">
          {/* Form Section */}
          <div className="flex-1 bg-[#f9f9fc] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">My details</h2>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">First Name</label>
                    <input
                      type="text"
                      name="firstName"
                      value={accountForm.firstName}
                      className="mt-1 block w-full h-10 pl-2 rounded-md border-gray-300 bg-gray-100"
                      disabled
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Middle Name</label>
                    <input
                      type="text"
                      name="middleName"
                      value={accountForm.middleName || ''}
                      className="mt-1 block w-full h-10 pl-2 rounded-md border-gray-300 bg-gray-100"
                      disabled
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Last Name</label>
                    <input
                      type="text"
                      name="lastName"
                      value={accountForm.lastName}
                      className="mt-1 block w-full h-10 pl-2 rounded-md border-gray-300 bg-gray-100"
                      disabled
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Title</label>
                    <input
                      type="text"
                      name="title"
                      value={accountForm.title}
                      className="mt-1 block w-full h-10 pl-2 rounded-md border-gray-300 bg-gray-100"
                      disabled
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Field</label>
                    <select
                      name="practice"
                      value={accountForm.practice}
                      className="mt-1 block w-full h-10 pl-2 rounded-md appearance-none border-gray-300 bg-gray-100"
                      disabled
                    >
                      <option value="">{accountForm.practice}</option>
                      {fieldOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Branch</label>
                    <select
                      name="branch"
                      value={accountForm.branch}
                      className="mt-1 block w-full h-10 pl-2 rounded-md appearance-none border-gray-300 bg-gray-100"
                      disabled
                    >
                      <option value="">{accountForm.branch}</option>
                      {branchOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={accountForm.email}
                    className="mt-1 block w-full h-10 pl-2 rounded-md border-gray-300 bg-gray-100"
                    disabled
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                  <input
                    type="tel"
                    name="contactNumber"
                    value={accountForm.contactNumber || ''}
                    className="mt-1 block w-full h-10 pl-2 rounded-md border-gray-300 bg-gray-100"
                    disabled
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Company Name</label>
                  <input
                    type="text"
                    name="companyName"
                    value={accountForm.companyName || ''}
                    className="mt-1 block w-full h-10 pl-2 rounded-md border-gray-300 bg-gray-100"
                    disabled
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">House Address</label>
                  <input
                    type="text"
                    name="houseAddress"
                    value={accountForm.houseAddress || ''}
                    className="mt-1 block w-full h-10 pl-2 rounded-md border-gray-300 bg-gray-100"
                    disabled
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Profile Section */}
          <div className="w-1/4 ml-6 bg-white p-6 rounded-lg shadow flex flex-col items-center">
            <div
              className="w-48 h-48 rounded-full flex items-center justify-center mb-4"
              style={{
                backgroundImage: profileImage ? `url(${profileImage})` : 'none',
                backgroundColor: profileImage ? 'transparent' : '#FF9D3D',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              {!profileImage && (
                <span className="text-white text-4xl font-bold">
                  {getInitials(`${admin?.firstName ?? ''} ${admin?.middleName ?? ''} ${admin?.lastName ?? ''}`.trim())}
                </span>
              )}
            </div>
            <h3 className="text-lg font-semibold">{accountForm.firstName} {accountForm.middleName} {accountForm.lastName}</h3>
            <div className="text-sm text-gray-500 mb-4">{accountForm.title}</div>
            <div className="space-y-2 text-sm text-teal-600 w-full">
              <div className="flex items-center">
                <span className="mr-2">📧</span> 
                <a href={`mailto:${accountForm.email}`}>{accountForm.email}</a>
              </div>
              <div className="flex items-center">
                <span className="mr-2">📞</span> 
                <a href={`tel:${accountForm.contactNumber}`}>{accountForm.contactNumber}</a>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Notification Settings' && (
        <div className="flex">
          <div className="flex-1 bg-[#f9f9fc] p-6 mt-6 ">
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
                    className={`w-14 h-7 rounded-full flex items-center px-1 ${notificationForm.enableDesktopNotifications ? 'bg-[#3674B5]' : 'bg-gray-300'}`}
                    onClick={() => handleNotificationToggle('enableDesktopNotifications')}
                  >
                    <span className={`w-5 h-5 bg-white rounded-full transform ${notificationForm.enableDesktopNotifications ? 'translate-x-7' : 'translate-x-0'} transition-transform duration-200`}></span>
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
                    className={`w-14 h-7 rounded-full flex items-center px-1 ${notificationForm.enableNotificationBadge ? 'bg-[#3674B5]' : 'bg-gray-300'}`}
                    onClick={() => handleNotificationToggle('enableNotificationBadge')}
                  >
                    <span className={`w-5 h-5 bg-white rounded-full transform ${notificationForm.enableNotificationBadge ? 'translate-x-7' : 'translate-x-0'} transition-transform duration-200`}></span>
                  </button>
                </div>
              </div>

              <div className="border p-4 rounded-md">
                <h3 className="text-lg font-semibold">Push Notification Time-out</h3>
                <select
                  name="pushNotificationTimeout"
                  value={notificationForm.pushNotificationTimeout}
                  className="mt-2 block w-32 border-gray-300 rounded-md bg-white"
                  onChange={(e) => handleNotificationSelectChange('pushNotificationTimeout', e.target.value)}
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
                    className={`w-14 h-7 rounded-full flex items-center px-1 ${notificationForm.communicationEmails ? 'bg-[#3674B5]' : 'bg-gray-300'}`}
                    onClick={() => handleNotificationToggle('communicationEmails')}
                  >
                    <span className={`w-5 h-5 bg-white rounded-full transform ${notificationForm.communicationEmails ? 'translate-x-7' : 'translate-x-0'} transition-transform duration-200`}></span>
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
                    className={`w-14 h-7 rounded-full flex items-center px-1 ${notificationForm.announcementsEmails ? 'bg-[#3674B5]' : 'bg-gray-300'}`}
                    onClick={() => handleNotificationToggle('announcementsEmails')}
                  >
                    <span className={`w-5 h-5 bg-white rounded-full transform ${notificationForm.announcementsEmails ? 'translate-x-7' : 'translate-x-0'} transition-transform duration-200`}></span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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