import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { useMutation } from '@apollo/client';
import { toast } from 'sonner';
import { UPDATE_ADMIN_USER } from '../../graphql/admin';

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
  loginId: string;
  statusHistory: string;
  companyName?: string;
  houseAddress?: string;
}

const SiteSettings: React.FC = () => {
  const { admin, setAdmin } = useAdminAuth();
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState('Account Settings');
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
    loginId: `id/${admin?.email?.split('@')[0] || 'ceo'}`,
    statusHistory: 'Active',
    companyName: admin?.companyName,
    houseAddress: admin?.houseAddress,
  });

  const initialAccountFormRef = useRef(accountForm);

  // State for profile image
  const [profileImage, setProfileImage] = useState<string | null>(null);

  // State for toast notifications
  const [toasts, setToasts] = useState<Toast[]>([]);
  // State to toggle form editability
  const [isFormEditable, setIsFormEditable] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mutation for updating admin details - using existing UPDATE_ADMIN_USER
  const [updateAdminDetails] = useMutation(UPDATE_ADMIN_USER, {
    onCompleted: (data) => {
      console.log('Mutation response:', data);
      if (data?.updateAdminDetails?.success) {
        console.log('Update successful, new user data:', data.updateAdminDetails.user);
        // Update the admin context with the new data
        setAdmin({
          ...(admin || {}),
          ...data.updateAdminDetails.user,
          name: `${data.updateAdminDetails.user.firstName || admin?.firstName || ''} ${data.updateAdminDetails.user.middleName || admin?.middleName || ''} ${data.updateAdminDetails.user.lastName || admin?.lastName || ''}`.replace(/\s+/g, ' ').trim()
        });
        toast.success('Profile updated successfully!');
        setIsFormEditable(false);
      } else {
        console.error('Update failed:', data?.updateAdminDetails?.message);
        toast.error(data?.updateAdminDetails?.message || 'Failed to update profile');
      }
      setIsSubmitting(false);
    },
    onError: (error) => {
      console.error('Mutation error:', error);
      toast.error('Failed to update profile. Please try again.');
      setIsSubmitting(false);
    },
  });

  // Update form when user data changes
  useEffect(() => {
    if (user) {
      const newFormData: AccountFormState = {
        firstName: user.firstName || '',
        middleName: user.middleName,
        lastName: user.lastName || '',
        title: 'CEO',
        practice: 'Finance',
        branch: 'Quezon City',
        email: user.email || '',
        contactNumber: user.contactNumber,
        loginId: `id/${user.email?.split('@')[0] || 'user'}`,
        statusHistory: 'Active',
        companyName: user.companyName,
        houseAddress: user.houseAddress,
      };
      setAccountForm(newFormData);
      initialAccountFormRef.current = newFormData;
    }
  }, [user]);

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
      // Validate file type
      if (!file.type.startsWith('image/')) {
        addToast('Please upload an image file.', 'error');
        return;
      }
      // Validate file size (e.g., max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        addToast('Image size must be less than 5MB.', 'error');
        return;
      }
      // Read the file as a data URL
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
    setSecurityForm({ recoveryEmail: '', recoveryPhone: '' });
    setToasts([]);
  };

  // Handle form input changes for Security, Notification, and Account Settings
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setAccountForm(prev => ({
      ...prev,
      [name]: value,
    }));
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

    try {
      // Simulate an API call to set the recovery email
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
      // Simulate an API call to save notification settings
      console.log('Saving notification settings:', notificationForm);
      addToast('Notification settings saved successfully!', 'success');
    } catch (err) {
      addToast('Failed to save notification settings. Please try again.', 'error');
    }
  };

  // Validate Account Settings form
  const validateAccountForm = (): boolean => {
    let isValid = true;
    
    // Name validation
    if (!/^[A-Za-z\s]+$/.test(accountForm.firstName) || !/^[A-Za-z\s]*$/.test(accountForm.middleName || '') || !/^[A-Za-z\s]+$/.test(accountForm.lastName)) {
      addToast('Name fields can only contain letters and spaces.', 'error');
      isValid = false;
    }
    
    // Email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountForm.email)) {
      addToast('Please enter a valid email address.', 'error');
      isValid = false;
    }
    
    // Phone number validation (if provided)
    if (accountForm.contactNumber && !/^[0-9+\-\s()]*$/.test(accountForm.contactNumber)) {
      addToast('Please enter a valid phone number.', 'error');
      isValid = false;
    }
    
    return isValid;
  };

  // Handle Account Settings form submission
  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateAccountForm()) {
      console.log('Form validation failed');
      return;
    }

    const userId = (user as any)?._id || (user as any)?.id || (user as any)?.userId;
    if (!userId) {
      console.error('User ID is missing');
      toast.error('User ID is missing. Please try again.');
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Prepare the input object with only the fields that have values
      const input: any = {};
      
      // Only include fields that have values and are different from initial
      if (accountForm.firstName !== initialAccountFormRef.current.firstName) {
        input.firstName = accountForm.firstName;
      }
      if (accountForm.middleName !== initialAccountFormRef.current.middleName) {
        input.middleName = accountForm.middleName || ''; // Allow empty string for middle name
      }
      if (accountForm.lastName !== initialAccountFormRef.current.lastName) {
        input.lastName = accountForm.lastName;
      }
      if (accountForm.email !== initialAccountFormRef.current.email) {
        input.email = accountForm.email;
      }
      if (accountForm.contactNumber !== initialAccountFormRef.current.contactNumber) {
        input.contactNumber = accountForm.contactNumber;
      }
      if (accountForm.companyName !== initialAccountFormRef.current.companyName) {
        input.companyName = accountForm.companyName;
      }
      if (accountForm.houseAddress !== initialAccountFormRef.current.houseAddress) {
        input.houseAddress = accountForm.houseAddress;
      }

      // Only proceed if there are changes
      if (Object.keys(input).length === 0) {
        console.log('No changes detected, skipping update');
        toast.info('No changes detected.');
        setIsSubmitting(false);
        return;
      }

      console.log('Calling updateAdminDetails with:', {
        adminId: userId,
        input
      });

      // Call the mutation
      const result = await updateAdminDetails({
        variables: {
          adminId: userId,
          input,
        },
      });

      console.log('Mutation result:', result);
      
      if (result.data?.updateAdminDetails?.success) {
        console.log('Update successful, updating initial form ref and user context');
        
        // Update the local form reference
        initialAccountFormRef.current = { ...accountForm };
        
        // Update the user context with the new data
        if (setUser) {
          console.log('Updating user context with new data');
          setUser({
            ...(user || {}),
            ...input,
            name: `${input.firstName || user?.firstName || ''} ${input.middleName || user?.middleName || ''} ${input.lastName || user?.lastName || ''}`.replace(/\s+/g, ' ').trim()
          });
        }
        
        toast.success('Profile updated successfully!');
        setIsFormEditable(false);
      } else {
        const errorMessage = result.data?.updateAdminDetails?.message || 'Unknown error';
        console.error('Update failed:', errorMessage);
        toast.error(`Failed to update profile: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Error in handleAccountSubmit:', error);
      toast.error('Failed to update profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Deactivate Account
  const handleDeactivateAccount = () => {
    if (window.confirm('Are you sure you want to deactivate your account? This will reactivate upon signing in.')) {
      console.log('Deactivating account...');
      // Simulate API call to deactivate account
      addToast('Account deactivated successfully.', 'success');
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
    setAccountForm(initialAccountFormRef.current);
    setProfileImage(null); // Reset profile image on back
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
            className={`text-[#3674B5] cursor-pointer ${activeTab === 'Security and Privacy' ? 'font-bold border-b-2 border-[#3674B5]' : 'text-black'}`}
            onClick={() => handleTabChange('Security and Privacy')}
          >
            Security and Privacy
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
              <button onClick={toggleFormEditable} className="text-teal-60f0 hover:text-teal-800">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.536L15.232 5.232z" />
                </svg>
              </button>
            </div>
            <form className="space-y-4" onSubmit={handleAccountSubmit}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">First Name</label>
                  <input
                    type="text"
                    name="firstName"
                    value={accountForm.firstName}
                    onChange={handleInputChange}
                    placeholder={isFormEditable ? "Enter first name" : ""}
                    className={`mt-1 block w-80 h-10 pl-2 rounded-md ${isFormEditable ? 'border border-black placeholder-gray-500 bg-white' : 'border-gray-300 bg-white'}`}
                    disabled={!isFormEditable}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Middle Name</label>
                  <input
                    type="text"
                    name="middleName"
                    value={accountForm.middleName || ''}
                    onChange={handleInputChange}
                    placeholder={isFormEditable ? "Enter middle name" : ""}
                    className={`mt-1 block w-80 h-10 pl-2 rounded-md ${isFormEditable ? 'border border-black placeholder-gray-500 bg-white' : 'border-gray-300 bg-white'}`}
                    disabled={!isFormEditable}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Last Name</label>
                  <input
                    type="text"
                    name="lastName"
                    value={accountForm.lastName}
                    onChange={handleInputChange}
                    placeholder={isFormEditable ? "Enter last name" : ""}
                    className={`mt-1 block w-80 h-10 pl-2 rounded-md ${isFormEditable ? 'border border-black placeholder-gray-500 bg-white' : 'border-gray-300 bg-white'}`}
                    disabled={!isFormEditable}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Title</label>
                  <input
                    type="text"
                    name="title"
                    value={accountForm.title}
                    onChange={handleInputChange}
                    placeholder={isFormEditable ? "Enter title" : ""}
                    className={`mt-1 block w-80 h-10 pl-2 rounded-md ${isFormEditable ? 'border border-black placeholder-gray-500 bg-white' : 'border-gray-300 bg-white'}`}
                    disabled={!isFormEditable}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Field</label>
                  <select
                    name="practice"
                    value={accountForm.practice}
                    onChange={handleInputChange}
                    className={`mt-1 block w-80 h-10 pl-2 rounded-md appearance-none ${isFormEditable ? 'border border-black placeholder-gray-500 bg-white' : 'border-gray-300 bg-white'}`}
                    disabled={!isFormEditable}
                  >
                    <option value="">{isFormEditable ? "Select a field" : accountForm.practice}</option>
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
                    onChange={handleInputChange}
                    className={`mt-1 block w-80 h-10 pl-2 rounded-md appearance-none ${isFormEditable ? 'border border-black placeholder-gray-500 bg-white' : 'border-gray-300 bg-white'}`}
                    disabled={!isFormEditable}
                  >
                    <option value="">{isFormEditable ? "Select a branch" : accountForm.branch}</option>
                    {branchOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={accountForm.email}
                    onChange={handleInputChange}
                    placeholder={isFormEditable ? "Enter email" : ""}
                    className={`mt-1 block w-80 h-10 pl-2 rounded-md ${isFormEditable ? 'border border-black placeholder-gray-500 bg-white' : 'border-gray-300 bg-white'}`}
                    disabled={!isFormEditable}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                  <input
                    type="tel"
                    name="contactNumber"
                    value={accountForm.contactNumber || ''}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      const contactNumberLength = accountForm.contactNumber?.length ?? 0;
                      if (contactNumberLength >= 11 && e.key !== 'Backspace' && e.key !== 'Delete' && e.key !== 'Tab') {
                        e.preventDefault();
                      }
                    }}
                    placeholder={isFormEditable ? "Enter phone number" : ""}
                    inputMode="numeric"
                    pattern="[0-9\s\+\-\(\)]*"
                    maxLength={20}
                    className={`mt-1 block w-80 h-10 pl-2 rounded-md ${isFormEditable ? 'border border-black placeholder-gray-500 bg-white' : 'border-gray-300 bg-white'}`}
                    disabled={!isFormEditable}
                  />
                </div>
                {/* Non-editable fields remain unchanged */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Login ID</label>
                  <input
                    type="text"
                    name="loginId"
                    value={accountForm.loginId}
                    className={`mt-1 block w-80 h-10 pl-2 rounded-md ${isFormEditable ? 'bg-white' : 'border-gray-300 bg-white'}`}
                    disabled
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status History</label>
                  <input
                    type="text"
                    name="statusHistory"
                    value={accountForm.statusHistory}
                    className={`mt-1 block w-80 h-10 pl-2 rounded-md ${isFormEditable ? 'bg-white' : 'border-gray-300 bg-white'}`}
                    disabled
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Company Name</label>
                  <input
                    type="text"
                    name="companyName"
                    value={accountForm.companyName || ''}
                    onChange={handleInputChange}
                    placeholder={isFormEditable ? "Enter company name" : ""}
                    className={`mt-1 block w-80 h-10 pl-2 rounded-md ${isFormEditable ? 'border border-black placeholder-gray-500 bg-white' : 'border-gray-300 bg-white'}`}
                    disabled={!isFormEditable}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">House Address</label>
                  <input
                    type="text"
                    name="houseAddress"
                    value={accountForm.houseAddress || ''}
                    onChange={handleInputChange}
                    placeholder={isFormEditable ? "Enter house address" : ""}
                    className={`mt-1 block w-80 h-10 pl-2 rounded-md ${isFormEditable ? 'border border-black placeholder-gray-500 bg-white' : 'border-gray-300 bg-white'}`}
                    disabled={!isFormEditable}
                  />
                </div>
              </div>
              {isFormEditable && (
                <div className="flex justify-end space-x-4 mt-4">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#3674B5] text-white rounded-md hover:bg-[#3674B5]"
                  >
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={handleBack}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                  >
                    Back
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Profile Section */}
          <div className="w-1/4 ml-6 bg-white p-6 rounded-lg shadow flex flex-col items-center">
            <div
              className="w-48 h-48 rounded-full flex items-center justify-center mb-4 cursor-pointer hover:scale-105 transition-all duration-300"
              style={{
                backgroundImage: profileImage ? `url(${profileImage})` : 'none',
                backgroundColor: profileImage ? 'transparent' : '#FF9D3D',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
              onClick={() => isFormEditable && document.getElementById('profileImageInput')?.click()}
            >
              {!profileImage && (
                <span className="text-white text-4xl font-bold">
                  {getInitials(`${user?.firstName ?? ''} ${user?.middleName ?? ''} ${user?.lastName ?? ''}`.trim())}
                </span>
              )}
            </div>
            {isFormEditable && (
              <div className="mb-4">
                <input
                  type="file"
                  id="profileImageInput"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => document.getElementById('profileImageInput')?.click()}
                  className="px-4 py-2 bg-[#3674B5] text-white rounded-md hover:bg-[#3674B5] text-sm"
                >
                  Upload Photo
                </button>
              </div>
            )}
            <h3 className="text-lg font-semibold">{accountForm.firstName} {accountForm.middleName} {accountForm.lastName}</h3>
            <div className="text-sm text-gray-500 mb-4">{accountForm.title}</div>
            <div className="space-y-2 text-sm text-teal-600 w-full">
              <div className="flex">
                <span className="mr-2">📧</span> <a href={`mailto:${accountForm.email}`}>{accountForm.email}</a>
                <div className="flex">
                  <span className="mr-2 pl-4">📞</span> <a href={`tel:${accountForm.contactNumber}`}>{accountForm.contactNumber}</a>
                  <span className="ml-2 pl-4 cursor-pointer">⋮</span>
                </div>
              </div>
              <div className="flex flex-col items-center space-y-2">
                <div className="flex items-center">
                  <span className="mr-2 pr-8">📅 Calendar</span>
                </div>
                <div className="flex items-center">
                  <span className="mr-2 pr-6">🏖️ Vacations</span>
                </div>
                <div className="flex items-center">
                  <span className="mr-2 pr-5">⏰ Timesheet</span>
                </div>
                <div className="flex items-center">
                  <span className="mr-2 pr-[-5]">📄 Corporate CV</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Rest of the tabs (Security and Privacy, Notification Settings) remain unchanged */}
      {activeTab === 'Security and Privacy' && (
        <div className="flex">
          <div className="flex-1 bg-[#f9f9fc] p-6 mt-6">
            <h2 className="text-xl font-semibold mb-4">Account Details</h2>
            <div className="space-y-6">

              <div className="border p-4 rounded-md">
                <h3 className="text-lg font-semibold">Verify Email Address</h3>
                <p className="text-sm text-gray-600">Verify your email address to confirm your credentials</p>
                <div className="flex justify-end mt-[-1]">
                  <button
                    className="px-4 py-2 bg-[#3674B5] text-white rounded-md hover:bg-[#3674B5]"
                    disabled
                  >
                    Verified
                  </button>
                </div>
              </div>

              <div className="border p-4 rounded-md">
                <h3 className="text-lg font-semibold">Update Password</h3>
                <p className="text-sm text-gray-600">Change your password to update and protect your account</p>
                <div className="flex justify-end mt-[-1]">
                  <button
                    className="mt-2 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
                    onClick={() => alert('clicked')}>
                    Change Password
                  </button>
                </div>
              </div>

              <h2 className="text-xl font-semibold mt-6">Recovery Settings</h2>

              <div className="border p-4 rounded-md">
                <h3 className="text-lg font-semibold">Recovery Email Address</h3>
                <p className="text-sm text-gray-600">Set recovery email to secure your account</p>
                <form className="mt-2 space-y-4" onSubmit={handleRecoveryEmailSubmit}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Another Email Address</label>
                    <input
                      type="email"
                      name="email"
                      value={securityForm.recoveryEmail}
                      onChange={handleInputChange}
                      placeholder="example@gmail.com"
                      className="mt-1 p-2 block w-full bg-gray-100 border-gray-300 rounded-md"
                    />
                  </div>
                  <div className="flex justify-end mt-[-1]">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900"
                    >
                      Save
                    </button>
                  </div>
                </form>
              </div>

              <div className="border p-4 rounded-md">
                <h3 className="text-lg font-semibold">Recovery Phone Number</h3>
                <p className="text-sm text-gray-600">Add phone number to setup SMS recovery for your account</p>
                <div className="flex justify-end mt-[-1]">
                  <button
                    className="mt-2 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
                    onClick={() => alert('clicked')}
                  >
                    Setup
                  </button>
                </div>
              </div>

              <div className="border p-4 rounded-md">
                <h3 className="text-lg font-semibold">Deactivate Account</h3>
                <p className="text-sm text-gray-600">This will deactivate your account and will reactivate upon signing in again.</p>
                <div className="flex justify-end mt-[-1]">
                  <button
                    className="mt-2 px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
                    onClick={handleDeactivateAccount}
                  >
                    Deactivate
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Notification Settings' && (
        <div className="flex">
          <div className="flex-1 bg-[#f9f9fc] p-6 mt-6 ">
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
                    className={`w-14 h-7 rounded-full flex items-center px-1 hover:scale-105 transition-all duration-300 ${notificationForm.enableDesktopNotifications ? 'bg-[#3674B5]' : 'bg-gray-300'}`}
                    onClick={() => handleToggleChange('enableDesktopNotifications')}
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
                    className={`w-14 h-7 rounded-full flex items-center px-1 hover:scale-105 transition-all duration-300  ${notificationForm.enableNotificationBadge ? 'bg-[#3674B5]' : 'bg-gray-300'}`}
                    onClick={() => handleToggleChange('enableNotificationBadge')}
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
                  onChange={handleInputChange}
                  className="mt-2 block w-32 border-gray-300 rounded-md"
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
                    className={`w-14 h-7 rounded-full flex items-center px-1 hover:scale-105 transition-all duration-300  ${notificationForm.communicationEmails ? 'bg-[#3674B5]' : 'bg-gray-300'}`}
                    onClick={() => handleToggleChange('communicationEmails')}
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
                    className={`w-14 h-7 rounded-full flex items-center px-1 hover:scale-105 transition-all duration-300  ${notificationForm.announcementsEmails ? 'bg-[#3674B5]' : 'bg-gray-300'}`}
                    onClick={() => handleToggleChange('announcementsEmails')}
                  >
                    <span className={`w-5 h-5 bg-white rounded-full transform ${notificationForm.announcementsEmails ? 'translate-x-7' : 'translate-x-0'} transition-transform duration-200`}></span>
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
                    className={`w-14 h-7 rounded-full flex items-center px-1 hover:scale-105 transition-all duration-300  ${notificationForm.disableNotificationSounds ? 'bg-[#3674B5]' : 'bg-gray-300'}`}
                    onClick={() => handleToggleChange('disableNotificationSounds')}
                  >
                    <span className={`w-5 h-5 bg-white rounded-full transform ${notificationForm.disableNotificationSounds ? 'translate-x-7' : 'translate-x-0'} transition-transform duration-200`}></span>
                  </button>
                </div>
              </div>
            </form>
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