import React, { useState, useEffect, ChangeEvent } from 'react';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Toast notification type
type Toast = {
  id: number;
  message: string;
  type: 'error' | 'success';
};

// Interface for form data
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

const AccountSettings: React.FC = () => {
  const { admin } = useAdminAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [showFieldDropdown, setShowFieldDropdown] = useState(false);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);

  const [formData, setFormData] = useState<AccountFormState>({
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
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Dropdown options
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

  // Handle resizing
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarCollapsed(true);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update form when admin changes
  useEffect(() => {
    if (admin) {
      setFormData({
        firstName: admin.firstName || '',
        middleName: admin.middleName,
        lastName: admin.lastName || '',
        title: 'CEO',
        practice: 'Finance',
        branch: 'Quezon City',
        email: admin.email || 'ceo@yes.com',
        contactNumber: admin.contactNumber,
        companyName: admin.companyName,
        houseAddress: admin.houseAddress,
      });
    }
  }, [admin]);

  // Toast handling
  const addToast = (message: string, type: 'error' | 'success' = 'error') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter(t => t.id !== id)), 5000);
  };

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter(t => t.id !== id));
  };

  // Handle input change
  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Validation
  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (formData.firstName && !/^[a-zA-Z\s]+$/.test(formData.firstName)) {
      newErrors.firstName = "First Name should not contain numbers or special characters";
    }
    if (formData.lastName && !/^[a-zA-Z\s]+$/.test(formData.lastName)) {
      newErrors.lastName = "Last Name should not contain numbers or special characters";
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }
    if (formData.contactNumber) {
      const clean = formData.contactNumber.replace(/\D/g, '');
      if (clean.length !== 10 || !clean.startsWith('9')) {
        newErrors.contactNumber = "Philippine mobile numbers must be 10 digits starting with 9";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleUpdate = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!validateForm()) return addToast("Please fix the errors", 'error');
    addToast("Profile updated successfully!", 'success');
    setIsEditing(false);
  };

  const handleCancel = () => {
    if (admin) {
      setFormData({
        firstName: admin.firstName || '',
        middleName: admin.middleName,
        lastName: admin.lastName || '',
        title: 'CEO',
        practice: 'Finance',
        branch: 'Quezon City',
        email: admin.email || 'ceo@yes.com',
        contactNumber: admin.contactNumber,
        companyName: admin.companyName,
        houseAddress: admin.houseAddress,
      });
    }
    setErrors({});
    setIsEditing(false);
  };

  const contentPadding = sidebarCollapsed ? 'pl-28' : 'pl-64';

  return (
    <div className={`min-h-screen bg-[#f9f9fc] ${isMobile ? 'px-4 pt-7' : `${contentPadding} pr-5`} flex items-center justify-center`}>
      {/* Mobile Header */}
      {isMobile && <h1 className="text-xl font-bold text-[#3674B5] mb-4">Account Settings</h1>}

      {/* Outer Card */}
      <div className="rounded-xl shadow-lg flex flex-col lg:flex-row w-full max-w-6xl overflow-hidden min-h-[650px]">
        {/* Left */}
        <aside className="flex flex-col items-center justify-center p-8 bg-black/10 lg:w-1/3">
          <div className="relative w-36 h-36 rounded-full overflow-hidden mb-4 flex items-center justify-center bg-[#FF9D3D] text-white text-3xl font-bold">
            {profileImage ? (
              <img src={profileImage} alt="Profile" className="object-cover w-full h-full" onError={() => setProfileImage(null)} />
            ) : (
              <span>{getInitials(`${formData.firstName} ${formData.middleName || ''} ${formData.lastName}`)}</span>
            )}
          </div>
          <h2 className="text-xl font-semibold mb-1">{formData.firstName} {formData.middleName} {formData.lastName}</h2>
          <p className="text-sm text-black/80 mb-6">{formData.email}</p>
        </aside>

        {/* Right */}
        <section className="flex-grow p-8 space-y-10 bg-white/20">
          {!isMobile && <h2 className="text-2xl font-bold text-gray-800">Account Settings</h2>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {[
              { id: 'firstName', label: 'First Name', type: 'text' },
              { id: 'lastName', label: 'Last Name', type: 'text' },
              { id: 'middleName', label: 'Middle Name', type: 'text' },
              { id: 'title', label: 'Title', type: 'text' },
              { id: 'email', label: 'Email Address', type: 'email' },
              { id: 'companyName', label: 'Company Name', type: 'text' },
              { id: 'houseAddress', label: 'House Address', type: 'text' },
            ].map(({ id, label, type }) => (
              <div key={id} className="relative mt-6">
                <input
                  type={type}
                  id={id}
                  name={id}
                  value={(formData as any)[id] || ''}
                  onChange={handleChange}
                  disabled={!isEditing}
                  placeholder=""
                  className={`peer w-full px-0 pt-5 pb-2 border-b bg-transparent text-black/80 focus:outline-none focus:border-[#3674B5] placeholder-transparent transition ${
                    isEditing ? 'border-black/30' : 'border-gray-300'
                  }`}
                />
                <label
                  htmlFor={id}
                  className={`absolute left-0 transition-all duration-200 ${
                    (formData as any)[id]
                      ? '-top-2 text-sm text-black font-semibold'
                      : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-black'
                  } peer-focus:-top-2 peer-focus:text-sm peer-focus:text-black peer-focus:font-semibold`}
                >
                  {label}
                </label>
                {isEditing && errors[id] && (
                  <p className="text-red-500 text-xs mt-1">{errors[id]}</p>
                )}
              </div>
            ))}
            {/* Contact Number Field with +63 Prefix */}
            <div className="relative mt-6">
              <input
                type="text"
                id="contactNumber"
                name="contactNumber"
                value={formData.contactNumber || ''}
                onChange={(e) => {
                  // Automatically strip non-digits and prevent +63 duplication
                  const clean = e.target.value.replace(/\D/g, '');
                  setFormData((prev) => ({ ...prev, contactNumber: clean }));
                }}
                disabled={!isEditing}
                placeholder="9123456789"
                className={`peer w-full pl-12 pt-5 pb-2 border-b bg-transparent text-black/80 focus:outline-none focus:border-[#3674B5] placeholder-gray-400 transition ${
                  isEditing ? 'border-black/30' : 'border-gray-300'
                }`}
              />
              <label
                htmlFor="contactNumber"
                className={`absolute left-0 transition-all duration-200 ${
                  formData.contactNumber
                    ? '-top-2 text-sm text-black font-semibold'
                    : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-black'
                } peer-focus:-top-2 peer-focus:text-sm peer-focus:text-black peer-focus:font-semibold`}
              >
                Contact Number
              </label>

              {/* Fixed +63 Prefix */}
              <span className="absolute top-[22px] left-0 text-black font-medium text-base select-none">
                +63
              </span>

              {isEditing && errors.contactNumber && (
                <p className="text-red-500 text-xs mt-1">{errors.contactNumber}</p>
              )}
            </div>


            {/* Field Dropdown */}
            <div className="relative mt-6">
              <label className="block mb-2 text-sm font-semibold text-gray-700">
                Field
              </label>
              {isEditing ? (
                <div className="relative flex-1 sm:flex-none sm:w-full">
                  <button
                    onClick={() => setShowFieldDropdown(!showFieldDropdown)}
                    className="flex items-center justify-between w-full text-sm text-black rounded-lg pl-4 pr-3 py-3 shadow-md focus:outline-none gap-2"
                  >
                    <span className="truncate">{formData.practice}</span>
                    <ChevronDown
                      size={16}
                      className={`flex-shrink-0 transform transition-transform duration-200 ${
                        showFieldDropdown ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  <AnimatePresence>
                    {showFieldDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="absolute z-10 bottom-full mb-2 w-full rounded-lg shadow-lg bg-white overflow-hidden"          >
                        {fieldOptions.map((option) => (
                          <button
                            key={option}
                            onClick={() => {
                              setFormData((prev) => ({ ...prev, practice: option }));
                              setShowFieldDropdown(false);
                            }}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                          >
                            {option}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <p className="text-gray-800 pt-2">{formData.practice}</p>
              )}
            </div>

            {/* Branch Dropdown (Styled like Status Filter) */}
            <div className="relative mt-6">
              <label className="block mb-2 text-sm font-semibold text-gray-700">
                Branch
              </label>
              {isEditing ? (
                <div className="relative flex-1 sm:flex-none sm:w-full">
                  <button
                    onClick={() => setShowBranchDropdown(!showBranchDropdown)}
                    className="flex items-center justify-between w-full text-sm text-black rounded-lg pl-4 pr-3 py-3 shadow-md focus:outline-none gap-2"
                  >
                    <span className="truncate">{formData.branch}</span>
                    <ChevronDown
                      size={16}
                      className={`flex-shrink-0 transform transition-transform duration-200 ${
                        showBranchDropdown ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  <AnimatePresence>
                    {showBranchDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="absolute z-10 bottom-full mb-2 w-full rounded-lg shadow-lg bg-white overflow-hidden"          >
                        {branchOptions.map((option) => (
                          <button
                            key={option}
                            onClick={() => {
                              setFormData((prev) => ({ ...prev, branch: option }));
                              setShowBranchDropdown(false);
                            }}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                          >
                            {option}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <p className="text-gray-800 pt-2">{formData.branch}</p>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Toasts */}
      <div className={`fixed ${isMobile ? 'bottom-2 right-2' : 'bottom-4 right-4'} space-y-2 z-50`}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`text-white px-4 py-2 rounded-md shadow-lg flex items-center justify-between max-w-xs animate-slideIn ${
              t.type === 'error' ? 'bg-red-400' : 'bg-green-400'
            }`}
          >
            <span>{t.message}</span>
            <button onClick={() => removeToast(t.id)} className="ml-4 text-white">✕</button>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slideIn { animation: slideIn 0.3s ease-out; }
      `}</style>
    </div>
  );
};

export default AccountSettings;
