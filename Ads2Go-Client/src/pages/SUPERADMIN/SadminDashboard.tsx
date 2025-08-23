//pages/SUPERADMIN/SadminDashboard.tsx


import React, { useState, useEffect } from 'react';
import { Search, Trash2, Pencil, UserPlus, ArrowUp, ArrowDown } from 'lucide-react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_ALL_ADMINS } from '../../graphql/queries/getAllAdmins';
import { CREATE_ADMIN_USER } from '../../graphql/mutations/createAdminUser';
import { UPDATE_ADMIN_USER } from "../../graphql/mutations/updateAdminUser";
import { DELETE_USER } from '../../graphql/mutations/deleteUser';


interface Admin {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  role: 'USER' | 'ADMIN' | 'SUPERADMIN';
  isEmailVerified: boolean;
  companyName?: string;
  companyAddress?: string;
  houseAddress?: string;
  contactNumber?: string;
  profilePicture?: string;
  createdAt: string | number;
}

interface AdminFormData {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  companyName: string;
  companyAddress: string;
  contactNumber: string;
  profilePicture?: File | null;
}

interface FormErrors {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  companyName?: string;
  companyAddress?: string;
  contactNumber?: string;
  profilePicture?: string;
  general?: string;
}

type Toast = {
  id: number;
  message: string;
  type: 'error' | 'success';
};

const SadminDashboard: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [showCreateAdminPopup, setShowCreateAdminPopup] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [adminToDelete, setAdminToDelete] = useState<Admin | null>(null);
  const [adminToEdit, setAdminToEdit] = useState<Admin | null>(null);

  const [newAdminFormData, setNewAdminFormData] = useState<AdminFormData>({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
    companyAddress: '',
    contactNumber: '',
    profilePicture: null as File | null,
  });

  // Debug: Log form state changes
  useEffect(() => {
    const isFormValid = (
      newAdminFormData.firstName &&
      newAdminFormData.lastName &&
      newAdminFormData.email &&
      newAdminFormData.password &&
      newAdminFormData.confirmPassword &&
      newAdminFormData.contactNumber &&
      newAdminFormData.companyName &&
      newAdminFormData.companyAddress &&
      newAdminFormData.password === newAdminFormData.confirmPassword &&
      /^\d{10}$/.test(newAdminFormData.contactNumber)
    );
    
    console.log('Form state update:', {
      ...newAdminFormData,
      password: '***',
      confirmPassword: '***',
      isFormValid,
      contactNumberLength: newAdminFormData.contactNumber?.length,
      contactNumberIsValid: /^\d{10}$/.test(newAdminFormData.contactNumber)
    });
  }, [newAdminFormData]);
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [editAdminFormData, setEditAdminFormData] = useState({
    id: '',
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    contactNumber: '',
    companyName: '',
    companyAddress: '',
    password: '',
  });

  const [editErrors, setEditErrors] = useState<{ [key: string]: string }>({
    firstName: '',
    lastName: '',
    email: '',
    contactNumber: '',
    companyName: '',
    companyAddress: '',
  });

  const [newAdminErrors, setNewAdminErrors] = useState<FormErrors>({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
    companyAddress: '',
    contactNumber: '',
  });

  const { loading, error, data, refetch } = useQuery(GET_ALL_ADMINS);

  // Mutations with success and error handlers
  const [createAdminUser, { loading: creatingAdmin }] = useMutation(CREATE_ADMIN_USER, {
    onCompleted: () => {
      addToast('Admin user created successfully!', 'success');
      setShowCreateAdminPopup(false);
      resetNewAdminForm();
      refetch();
    },
    onError: (error) => {
      addToast(`Error creating admin: ${error.message}`, 'error');
    }
  });

  const [updateAdminUser] = useMutation(UPDATE_ADMIN_USER, {
    onCompleted: () => {
      addToast('Admin user updated successfully!', 'success');
      setAdminToEdit(null);
      refetch();
    },
    onError: (error) => {
      addToast(`Error updating admin: ${error.message}`, 'error');
    }
  });

  const [deleteUserMutation, { loading: deletingUser }] = useMutation(DELETE_USER, {
    onCompleted: () => {
      addToast('Admin user deleted successfully!', 'success');
      setAdminToDelete(null);
      refetch();
    },
    onError: (error) => {
      addToast(`Error deleting admin: ${error.message}`, 'error');
    }
  });

// Set admins filtered by role ADMIN whenever data changes
useEffect(() => {
  if (data && data.getAllAdmins) {
    const adminUsers = data.getAllAdmins.filter((user: Admin) => user.role === 'ADMIN');
    console.log('Admin data from server:', adminUsers); // Debug log
    setAdmins(adminUsers);
  }
}, [data]);


  // Helper to reset new admin form and errors
  const resetNewAdminForm = () => {
    setNewAdminFormData({
      firstName: '',
      middleName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      companyName: '',
      companyAddress: '',
      contactNumber: '',
      profilePicture: null,
    });
    setNewAdminErrors({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      companyName: '',
      companyAddress: '',
      contactNumber: '',
    });
  };

  // Toast helper
  const addToast = (message: string, type: 'error' | 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3000);
  };

  // Simple date display helper
  const formatDate = (dateInput: any): string => {
    if (!dateInput) return 'N/A';
    return dateInput; // Just return the raw value
  };

  // Handle form input changes
  const handleNewAdminChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name === 'contactNumber') {
      // Allow only digits and limit to 11 characters
      const digits = value.replace(/\D/g, '').slice(0, 11);
      setNewAdminFormData(prev => ({
        ...prev,
        [name]: digits
      }));
    } else {
      setNewAdminFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    
    // Clear error for this field if it exists
    if (newAdminErrors[name as keyof typeof newAdminErrors]) {
      setNewAdminErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Filter and sort admins
  const filteredAndSortedAdmins = admins
    .filter((admin) => {
      const lowerSearch = searchTerm.toLowerCase();
      const createdAtStr = admin.createdAt ? String(admin.createdAt) : '';
      return (
        admin.firstName.toLowerCase().includes(lowerSearch) ||
        admin.lastName.toLowerCase().includes(lowerSearch) ||
        admin.email.toLowerCase().includes(lowerSearch) ||
        (admin.companyName?.toLowerCase().includes(lowerSearch) ?? false) ||
        (admin.companyAddress?.toLowerCase().includes(lowerSearch) ?? false) ||
        (admin.contactNumber?.toLowerCase().includes(lowerSearch) ?? false) ||
        createdAtStr.toLowerCase().includes(lowerSearch)
      );
    })
    .sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();

      if (isNaN(dateA) && isNaN(dateB)) return 0;
      if (isNaN(dateA)) return 1;
      if (isNaN(dateB)) return -1;

    return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
  });

/**
 * Validates the new admin form data
 * @returns Object containing validation result and error messages
 */
const validateNewAdminForm = (): { isValid: boolean; errors: FormErrors } => {
  // Log form data for debugging (excluding sensitive fields)
  if (process.env.NODE_ENV === 'development') {
    console.log('[DEBUG] Validating form with data:', {
      ...newAdminFormData,
      password: '***',
      confirmPassword: '***',
      contactNumberLength: newAdminFormData.contactNumber?.length,
      companyName: newAdminFormData.companyName || 'empty',
      companyAddress: newAdminFormData.companyAddress || 'empty',
      profilePicture: newAdminFormData.profilePicture ? 'File selected' : 'No file'
    });
  }

  // Initialize errors object with all possible error fields
  const errors: FormErrors = {
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
    companyAddress: '',
    contactNumber: '',
    profilePicture: '',
    general: ''
  };
  
  let isValid = true;
  
  // Helper function to add error and mark form as invalid
  const addError = (field: keyof FormErrors, message: string): void => {
    if (errors[field] === undefined) {
      console.warn(`Attempted to set error for unknown field: ${field}`);
      errors.general = errors.general || 'An unexpected error occurred';
    } else {
      errors[field] = message;
    }
    isValid = false;
  };
  
  const nameRegex = /^[A-Za-z\s-']+$/;
  
  // Validate first name
  if (!newAdminFormData.firstName?.trim()) {
    addError('firstName', 'First Name is required.');
  } else if (newAdminFormData.firstName.trim().length < 2) {
    addError('firstName', 'First Name must be at least 2 characters long.');
  } else if (!nameRegex.test(newAdminFormData.firstName.trim())) {
    addError('firstName', 'First Name contains invalid characters. Only letters, spaces, hyphens, and apostrophes are allowed.');
  }

  // Validate middle name (optional)
  if (newAdminFormData.middleName?.trim() && !nameRegex.test(newAdminFormData.middleName.trim())) {
    addError('middleName', 'Middle Name contains invalid characters. Only letters, spaces, hyphens, and apostrophes are allowed.');
  }

  // Validate last name
  if (!newAdminFormData.lastName?.trim()) {
    addError('lastName', 'Last Name is required.');
  } else if (newAdminFormData.lastName.trim().length < 2) {
    addError('lastName', 'Last Name must be at least 2 characters long.');
  } else if (!nameRegex.test(newAdminFormData.lastName.trim())) {
    addError('lastName', 'Last Name contains invalid characters. Only letters, spaces, hyphens, and apostrophes are allowed.');
  }
  
  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!newAdminFormData.email?.trim()) {
    addError('email', 'Email is required.');
  } else if (!emailRegex.test(newAdminFormData.email.trim())) {
    addError('email', 'Please enter a valid email address.');
  }

  // Validate password
  if (!newAdminFormData.password) {
    addError('password', 'Password is required.');
  } else if (newAdminFormData.password.length < 8) {
    addError('password', 'Password must be at least 8 characters long.');
  } else if (!/\d/.test(newAdminFormData.password) || 
             !/[a-z]/.test(newAdminFormData.password) || 
             !/[A-Z]/.test(newAdminFormData.password)) {
    addError('password', 'Password must contain at least one uppercase letter, one lowercase letter, and one number.');
  }

  // Validate confirm password
  if (newAdminFormData.password !== newAdminFormData.confirmPassword) {
    addError('confirmPassword', 'Passwords do not match.');
  }

  // Validate company name
  if (!newAdminFormData.companyName?.trim()) {
    addError('companyName', 'Company Name is required.');
  } else if (newAdminFormData.companyName.trim().length < 2) {
    addError('companyName', 'Company Name must be at least 2 characters long.');
  }

  // Validate company address
  if (!newAdminFormData.companyAddress?.trim()) {
    addError('companyAddress', 'Company Address is required.');
  } else if (newAdminFormData.companyAddress.trim().length < 5) {
    addError('companyAddress', 'Please enter a valid company address.');
  }

  // Validate contact number (Philippine format: 09XXXXXXXXX or +639XXXXXXXXX)
  const phMobileRegex = /^(09|\+639)\d{9}$/;
  if (!newAdminFormData.contactNumber?.trim()) {
    addError('contactNumber', 'Contact Number is required.');
  } else {
    const cleanNumber = newAdminFormData.contactNumber.replace(/\D/g, '');
    
    if (/^9\d{9}$/.test(cleanNumber)) {
      // Format as 09XXXXXXXXX if only 10 digits starting with 9
      newAdminFormData.contactNumber = `0${cleanNumber}`;
    } else if (!/^09\d{9}$/.test(cleanNumber)) {
      addError('contactNumber', 'Please provide a valid Philippine phone number (e.g., 9123456789 or 09123456789).');
    }
  }
  
  // Validate profile picture (optional but if provided, check type)
  if (newAdminFormData.profilePicture) {
    const validImageTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!validImageTypes.includes(newAdminFormData.profilePicture.type)) {
      addError('profilePicture', 'Please upload a valid image file (JPEG, PNG, or GIF).');
    } else if (newAdminFormData.profilePicture.size > 5 * 1024 * 1024) {
      addError('profilePicture', 'Image size should not exceed 5MB.');
    }
  }

  // Set the errors in state
  setNewAdminErrors(errors);
  
  // Return validation result
  const result = { isValid, errors };
  
  if (process.env.NODE_ENV === 'development') {
    console.log('[DEBUG] Validation result:', result);
  }
  
  return result;
};

/**
 * Handles the submission of the new admin form
 * @param e - Form submission event
 */
const handleNewAdminSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
  e.preventDefault();
  
  // Set submitting state to disable the form
  setSubmitting(true);
  
  try {
    // Clear any previous errors
    setNewAdminErrors({});
    
    // Validate form data
    console.log('[DEBUG] Starting form validation...');
    const { isValid, errors } = validateNewAdminForm();
    
    if (!isValid) {
      console.log('[DEBUG] Form validation failed:', errors);
      setNewAdminErrors(errors);
      addToast('Please fix the errors in the form', 'error');
      return;
    }
    
    console.log('[DEBUG] Form validation passed, preparing data for submission...');
    
    // Prepare form data for submission
    const formData = new FormData();
    
    // Add all form fields to formData
    Object.entries(newAdminFormData).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        formData.append(key, value);
      }
    });
    
    console.log('[DEBUG] Submitting form data...');
    // Log form data (excluding sensitive information)
    if (process.env.NODE_ENV === 'development') {
      console.log('[DEBUG] Form data being submitted:', {
        ...newAdminFormData,
        password: '***',
        confirmPassword: '***',
        profilePicture: newAdminFormData.profilePicture ? 'File selected' : 'No file',
        contactNumber: newAdminFormData.contactNumber ? '***' : 'Not provided'
      });
    }
    console.log('Form validation result:', { isValid, errors });
    
    if (!isValid) {
      setNewAdminErrors(errors);
      console.log('Form is not valid, stopping submission');
      return;
    }
    
    console.log('Form is valid, proceeding with submission');
    
    // Prepare the input object for the API call
    const input = {
      firstName: newAdminFormData.firstName.trim(),
      middleName: newAdminFormData.middleName.trim() || null,
      lastName: newAdminFormData.lastName.trim(),
      email: newAdminFormData.email.toLowerCase(),
      password: newAdminFormData.password,
      companyName: newAdminFormData.companyName.trim(),
      companyAddress: newAdminFormData.companyAddress.trim(),
      contactNumber: newAdminFormData.contactNumber,
      ...(newAdminFormData.profilePicture && { profilePicture: newAdminFormData.profilePicture })
    };
    
    // Log the input data (excluding sensitive information)
    if (process.env.NODE_ENV === 'development') {
      console.log('[DEBUG] Calling createAdminUser mutation with input:', {
        ...input,
        password: '***', // Don't log actual password
        confirmPassword: '***' // Don't log actual confirm password
      });
    }
    
    try {
      // Call the createAdminUser mutation
      const { data } = await createAdminUser({
        variables: { input },
        refetchQueries: [{ query: GET_ALL_ADMINS }]
      });
      
      if (data?.createAdminUser) {
        // Show success message
        addToast('Admin user created successfully!', 'success');
        
        // Reset the form
        resetNewAdminForm();
        
        // Close the popup
        setShowCreateAdminPopup(false);
        
        // Refresh the admin list
        if (refetch) {
          await refetch();
        }
      }
    } catch (error: unknown) {
      console.error('Error creating admin user:', error);
      
      // Handle GraphQL errors
      if (error && typeof error === 'object' && 'graphQLErrors' in error) {
        const graphQLError = error as { graphQLErrors: Array<{ message: string }> };
        graphQLError.graphQLErrors.forEach(({ message }) => {
          addToast(`Error: ${message}`, 'error');
        });
      } else {
        // Handle network or other errors
        const errorMessage = error instanceof Error ? error.message : 'An error occurred while creating the admin user. Please try again.';
        addToast(errorMessage, 'error');
      }
    } finally {
      // Always set submitting to false when done
      setSubmitting(false);
    }
  } catch (error: unknown) {
    console.error('Unexpected error during form submission:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.';
    addToast(errorMessage, 'error');
  } finally {
    setSubmitting(false);
  }
};

  // Reset form and close popup
  const resetForm = () => {
    setNewAdminFormData({
      firstName: '',
      middleName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      companyName: '',
      companyAddress: '',
      contactNumber: '',
      profilePicture: null,
    });
    setShowCreateAdminPopup(false);
  };
  
  const togglePasswordVisibility = () => setShowPassword(!showPassword);
  const toggleConfirmPasswordVisibility = () => setShowConfirmPassword(!showConfirmPassword);

  // Delete admin
  const confirmDeleteAdmin = (admin: Admin) => {
    setAdminToDelete(admin);
  };

  const executeDeleteAdmin = async () => {
    if (!adminToDelete) {
      console.error('No admin selected for deletion');
      return;
    }
    
    try {
      await deleteUserMutation({ variables: { id: adminToDelete.id } });
    } catch {
      // Handled by onError
    }
  };

  // Edit admin handlers
  const handleEditAdmin = (admin: Admin) => {
    setAdminToEdit(admin);
    // Set initialContactNumber to empty string if no contact number exists
    const initialContactNumber = admin.contactNumber
      ? admin.contactNumber.startsWith('+63 ')
        ? admin.contactNumber
        : `+63 ${admin.contactNumber.replace(/\D/g, '').slice(0, 10)}`
      : '';

    setEditAdminFormData({
      id: admin.id,
      firstName: admin.firstName,
      middleName: admin.middleName || '',
      lastName: admin.lastName,
      email: admin.email,
      contactNumber: initialContactNumber,
      companyName: admin.companyName || '',
      companyAddress: admin.companyAddress || '',
      password: '',
    });
    setEditErrors({
      firstName: '',
      lastName: '',
      email: '',
      contactNumber: '',
      companyName: '',
      companyAddress: '',
    });
  };

  const handleEditAdminChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let updatedValue = value;
    if (name === 'contactNumber') {
      const digitsOnly = value.replace(/\D/g, '');
      const limitedDigits = digitsOnly.slice(0, 10);
      updatedValue = `+63 ${limitedDigits}`;
    }
    setEditAdminFormData((prev) => ({ ...prev, [name]: updatedValue }));
    if (editErrors[name]) {
      setEditErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateEditForm = (): boolean => {
    let isValid = true;
    const newErrors: { [key: string]: string } = {
      firstName: '',
      lastName: '',
      email: '',
      contactNumber: '',
      companyName: '',
      companyAddress: '',
    };
    const nameRegex = /^[A-Za-z\s]+$/;
    if (!editAdminFormData.firstName.trim() || !nameRegex.test(editAdminFormData.firstName)) {
      newErrors.firstName = 'First Name should not contain numbers or symbols and cannot be empty.';
      isValid = false;
    }
    if (!editAdminFormData.lastName.trim() || !nameRegex.test(editAdminFormData.lastName)) {
      newErrors.lastName = 'Last Name should not contain numbers or symbols and cannot be empty.';
      isValid = false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!editAdminFormData.email.trim() || !emailRegex.test(editAdminFormData.email)) {
      newErrors.email = 'Please enter a valid email address.';
      isValid = false;
    }
    
    // Make phone number validation optional - only validate if there's a value
    if (editAdminFormData.contactNumber) {
      const phoneRegex = /^\+63\s?\d{10}$/;
      if (!phoneRegex.test(editAdminFormData.contactNumber)) {
        newErrors.contactNumber = 'Please provide a valid phone number (e.g., +63 9123456789).';
        isValid = false;
      }
    }
    
    // Make company name and address optional
    // Only validate format if there's a value
    if (editAdminFormData.companyName && !editAdminFormData.companyName.trim()) {
      newErrors.companyName = 'Company Name cannot be empty if provided.';
      isValid = false;
    }
    
    if (editAdminFormData.companyAddress && !editAdminFormData.companyAddress.trim()) {
      newErrors.companyAddress = 'Company Address cannot be empty if provided.';
      isValid = false;
    }
    
    setEditErrors(newErrors);
    return isValid;
  };

const handleUpdateAdminSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!adminToEdit) return;
  if (!validateEditForm()) return;

  try {
    await updateAdminUser({
      variables: {
        adminId: editAdminFormData.id,
        input: {
          firstName: editAdminFormData.firstName,
          middleName: editAdminFormData.middleName || null,
          lastName: editAdminFormData.lastName,
          email: editAdminFormData.email,
          contactNumber: editAdminFormData.contactNumber || undefined,
          companyName: editAdminFormData.companyName,
          companyAddress: editAdminFormData.companyAddress,
          password: editAdminFormData.password || undefined,
        },
      },
    });
  } catch {
    // Error handled globally by onError
  }
};



  const handleCancelEdit = () => {
    setAdminToEdit(null);
    setEditErrors({
      firstName: '',
      lastName: '',
      email: '',
      contactNumber: '',
      companyName: '',
      companyAddress: '',
    });
  };

  const handleCancelCreateAdmin = () => {
    setShowCreateAdminPopup(false);
    resetNewAdminForm();
  };

  if (loading) return <p className="ml-64 p-8">Loading admins...</p>;
  if (error) {
    console.log('GraphQL query error:', error);
    return <p className="ml-64 p-8 text-red-500">Error: {error.message || 'An error occurred'}</p>;
  }

  return (
    <div className="min-h-screen ml-64 bg-gray-100 pb-5">
      {/* Header Section */}
      <div className="p-6 pb-0 flex justify-between items-end">
        <div>
          <h1 className="text-4xl mt-8 font-semibold text-gray-800">Admins</h1>
          <p className="text-gray-600 mt-2">Manage your admin accounts</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search admins..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-3xl text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={() => setShowCreateAdminPopup(true)}
            className="flex items-center bg-[#3674B5] text-white text-xs space-x-2 px-4 py-3 border border-gray-300 rounded-3xl text-gray-700 hover:bg-[#0E2A47] transition-colors"
          >
            <UserPlus size={18} />
            <span>Add New Admin</span>
          </button>
          <button
            onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
            className="flex items-center space-x-2 px-4 py-3 border border-white rounded-3xl bg-[#1b5087] text-white text-xs hover:bg-[#0E2A47] transition-colors"
          >
            {sortOrder === 'newest' ? <ArrowUp size={18} /> : <ArrowDown size={18} />}
            <span>{sortOrder === 'newest' ? 'Newest' : 'Oldest'}</span>
          </button>
        </div>
      </div>

      {/* Admins List */}
      <div className="mx-6 mt-4 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1.5fr_1fr_1fr_1.5fr_1fr_0.5fr] gap-4 px-6 py-3 text-sm font-semibold text-[#3674B5] bg-gray-100">
          <span>Name</span>
          <span>Company</span>
          <span>Contact</span>
          <span>Email</span>
          <span>Date Created</span>
          <span className="text-center">Actions</span>
        </div>
        {filteredAndSortedAdmins.length > 0 ? (
          <ul className="space-y-3 pb-5">
            {filteredAndSortedAdmins.map((admin) => (
              <li
                key={admin.id}
                className="group grid grid-cols-[1.5fr_1fr_1fr_1.5fr_1fr_0.5fr] gap-4 px-6 py-4 bg-white rounded-xl h-20 shadow-md items-center hover:bg-[#3674B5] transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm font-semibold group-hover:bg-white group-hover:text-[#3674B5]">
                    {admin.firstName.charAt(0)}
                    {admin.lastName.charAt(0)}
                  </div>
                  <p className="font-medium text-gray-900 group-hover:text-white">
                    {admin.firstName} {admin.lastName}
                  </p>
                </div>
                <p className="text-sm text-gray-900 group-hover:text-white">{admin.companyName || 'N/A'}</p>
                <p className="text-sm text-gray-900 group-hover:text-white">{admin.contactNumber || 'N/A'}</p>
                <p className="text-sm text-gray-900 truncate group-hover:text-white">{admin.email}</p>
                <div className="text-sm text-gray-600 group-hover:text-white">
                  <span>{admin.createdAt ? formatDate(admin.createdAt) : 'N/A'}</span>
                </div>
                <div className="flex justify-center space-x-2">
                  <button
                    onClick={() => handleEditAdmin(admin)}
                    className="p-2 rounded-full hover:bg-[#0E2A47] group-hover:text-white"
                  >
                    <Pencil size={18} />
                  </button>
                  <button
                    onClick={() => confirmDeleteAdmin(admin)}
                    className="p-2 rounded-full hover:bg-[#0E2A47] group-hover:text-white"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-8 text-gray-500">No admins found.</div>
        )}
      </div>

      {/* New Admin Popup */}
      {showCreateAdminPopup && (
        <div className="fixed inset-0 z-50 flex justify-end pr-2">
          <div
            className="fixed inset-0 bg-black bg-opacity-30"
            onClick={handleCancelCreateAdmin}
          ></div>
          <div className="relative w-full md:w-1/2 lg:w-1/3 max-w-xl h-full pb-6 rounded-l-3xl bg-gray-100 shadow-lg transform transition-transform duration-300 ease-in-out animate-slideIn">
            <div className="p-6 h-full overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-[#3674B5]">Add New Admin</h2>
                <button
                  onClick={handleCancelCreateAdmin}
                  className="text-gray-500 hover:text-gray-700"
                ></button>
              </div>
              <form onSubmit={handleNewAdminSubmit} className="space-y-6">
                {/* Profile Picture at the top */}
                <div className="flex flex-col items-center mb-6">
                  <label htmlFor="newAdminProfilePicture" className="block text-sm font-medium text-gray-500 mb-2">
                    Profile Picture
                  </label>
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border-2 border-[#3674B5]">
                      {newAdminFormData.profilePicture ? (
                        <img 
                          src={URL.createObjectURL(newAdminFormData.profilePicture as Blob)} 
                          alt="Profile Preview" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <UserPlus size={32} className="text-gray-400" />
                      )}
                    </div>
                    <input
                      id="newAdminProfilePicture"
                      type="file"
                      name="profilePicture"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setNewAdminFormData({
                            ...newAdminFormData,
                            profilePicture: e.target.files[0]
                          });
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                  <span className="mt-2 text-xs text-gray-500">Click to upload</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  <div>
                    <label htmlFor="newAdminFirstName" className="block text-sm font-medium text-gray-500 mb-1">
                      First Name *
                    </label>
                    <input
                      id="newAdminFirstName"
                      type="text"
                      name="firstName"
                      value={newAdminFormData.firstName}
                      onChange={handleNewAdminChange}
                      className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
                      required
                    />
                    {newAdminErrors.firstName && (
                      <p className="text-red-500 text-xs mt-1">{newAdminErrors.firstName}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="newAdminMiddleName" className="block text-sm font-medium text-gray-500 mb-1">
                      Middle Name
                    </label>
                    <input
                      id="newAdminMiddleName"
                      type="text"
                      name="middleName"
                      value={newAdminFormData.middleName}
                      onChange={handleNewAdminChange}
                      className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
                    />
                    {newAdminErrors.middleName && (
                      <p className="text-red-500 text-xs mt-1">{newAdminErrors.middleName}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="newAdminLastName" className="block text-sm font-medium text-gray-500 mb-1">
                      Last Name *
                    </label>
                    <input
                      id="newAdminLastName"
                      type="text"
                      name="lastName"
                      value={newAdminFormData.lastName}
                      onChange={handleNewAdminChange}
                      className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
                      required
                    />
                    {newAdminErrors.lastName && (
                      <p className="text-red-500 text-xs mt-1">{newAdminErrors.lastName}</p>
                    )}
                  </div>
                </div>
                <div>
                  <label htmlFor="newAdminEmail" className="block text-sm font-medium text-gray-500 mb-1">
                    Email *
                  </label>
                  <input
                    id="newAdminEmail"
                    type="email"
                    name="email"
                    value={newAdminFormData.email}
                    onChange={handleNewAdminChange}
                    className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
                    required
                  />
                  {newAdminErrors.email && (
                    <p className="text-red-500 text-xs mt-1">{newAdminErrors.email}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="newAdminCompanyName" className="block text-sm font-medium text-gray-500 mb-1">
                    Company Name *
                  </label>
                  <input
                    id="newAdminCompanyName"
                    type="text"
                    name="companyName"
                    value={newAdminFormData.companyName}
                    onChange={handleNewAdminChange}
                    className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
                    required
                  />
                  {newAdminErrors.companyName && (
                    <p className="text-red-500 text-xs mt-1">{newAdminErrors.companyName}</p>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  <div>
                    <label htmlFor="newAdminPassword" className="block text-sm font-medium text-gray-500 mb-1">
                      Password *
                    </label>
                    <div className="relative">
                      <input
                        id="newAdminPassword"
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={newAdminFormData.password}
                        onChange={handleNewAdminChange}
                        className="w-full py-2 pr-8 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
                        required
                      />
                      <button
                        type="button"
                        onClick={togglePasswordVisibility}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showPassword ? '👁️' : '👁️‍🗨️'}
                      </button>
                    </div>
                    {newAdminErrors.password && (
                      <p className="text-red-500 text-xs mt-1">{newAdminErrors.password}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="newAdminConfirmPassword" className="block text-sm font-medium text-gray-500 mb-1">
                      Confirm Password *
                    </label>
                    <div className="relative">
                      <input
                        id="newAdminConfirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        name="confirmPassword"
                        value={newAdminFormData.confirmPassword}
                        onChange={handleNewAdminChange}
                        className="w-full py-2 pr-8 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
                        required
                      />
                      <button
                        type="button"
                        onClick={toggleConfirmPasswordVisibility}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                      </button>
                    </div>
                    {newAdminErrors.confirmPassword && (
                      <p className="text-red-500 text-xs mt-1">{newAdminErrors.confirmPassword}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-y-6">
                  <div>
                    <label htmlFor="newAdminContactNumber" className="block text-sm font-medium text-gray-500 mb-1">
                      Contact Number *
                    </label>
                    <div className="flex items-center py-2 border-b border-[#3674B5] focus-within:border-[#3674B5] transition-colors">
                      <span className="text-gray-700 select-none pr-1">+63</span>
                      <input
                        id="newAdminContactNumber"
                        name="contactNumber"
                        type="tel"
                        value={newAdminFormData.contactNumber}
                        onChange={handleNewAdminChange}
                        maxLength={10}
                        className="flex-grow focus:outline-none bg-transparent"
                        required
                      />
                    </div>
                    {newAdminErrors.contactNumber && (
                      <p className="text-red-500 text-xs mt-1">{newAdminErrors.contactNumber}</p>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt -2">
                    * Required fields
                  </div>
                  <div>
                    <label htmlFor="newAdminCompanyAddress" className="block text-sm font-medium text-gray-500 mb-1">
                      Company Address *
                    </label>
                    <input
                      id="newAdminCompanyAddress"
                      type="text"
                      name="companyAddress"
                      value={newAdminFormData.companyAddress}
                      onChange={handleNewAdminChange}
                      className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
                      required
                    />
                    {newAdminErrors.companyAddress && (
                      <p className="text-red-500 text-xs mt-1">{newAdminErrors.companyAddress}</p>
                    )}
                  </div>
                </div>
                <div className="flex justify-between pt-6">
                  <button
                    type="button"
                    onClick={handleCancelCreateAdmin}
                    className="px-5 py-2 rounded-lg hover:bg-gray-200 border border-gray-300 text-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={false} // Temporarily force enabled for debugging
                    className="px-6 py-2 rounded-lg bg-[#3674B5] hover:bg-[#0E2A47] text-white font-semibold shadow hover:scale-105 transition-all duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Create Admin
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Admin Popup */}
      {adminToEdit && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-4">
          <div className="fixed inset-0 bg-black bg-opacity-30" onClick={handleCancelEdit}></div>
          <div className="relative w-full md:w-1/2 lg:w-1/3 max-w-xl h-auto pb-6 rounded-3xl bg-gray-100 mt-2 shadow-lg transform transition-transform duration-300 ease-in-out animate-slideIn">
            <div className="p-6 h-full overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-[#3674B5]">Edit Admin</h2>
                <button onClick={handleCancelEdit} className="text-gray-500 hover:text-gray-700"></button>
              </div>
              <form onSubmit={handleUpdateAdminSubmit} className="space-y-4 mt-9">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
    <div>
      <label htmlFor="editFirstName" className="block text-sm font-medium text-gray-500 mb-1">
        First Name
      </label>
      <input
        id="editFirstName"
        name="firstName"
        type="text"
        value={editAdminFormData.firstName}
        onChange={handleEditAdminChange}
        className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
        required
      />
      {editErrors.firstName && <p className="text-red-500 text-xs mt-1">{editErrors.firstName}</p>}
    </div>

    <div>
      <label htmlFor="editMiddleName" className="block text-sm font-medium text-gray-500 mb-1">
        Middle Name
      </label>
      <input
        id="editMiddleName"
        name="middleName"
        type="text"
        value={editAdminFormData.middleName || ''}
        onChange={handleEditAdminChange}
        className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
      />
    </div>

    <div>
      <label htmlFor="editLastName" className="block text-sm font-medium text-gray-500 mb-1">
        Last Name
      </label>
      <input
        id="editLastName"
        name="lastName"
        type="text"
        value={editAdminFormData.lastName}
        onChange={handleEditAdminChange}
        className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
        required
      />
      {editErrors.lastName && <p className="text-red-500 text-xs mt-1">{editErrors.lastName}</p>}
    </div>

    <div>
      <label htmlFor="editEmail" className="block text-sm font-medium text-gray-500 mb-1">
        Email Address
      </label>
      <input
        id="editEmail"
        name="email"
        type="email"
        value={editAdminFormData.email}
        onChange={handleEditAdminChange}
        className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
        required
      />
      {editErrors.email && <p className="text-red-500 text-xs mt-1">{editErrors.email}</p>}
    </div>

    <div>
      <label htmlFor="editContactNumber" className="block text-sm font-medium text-gray-500 mb-1">
        Phone Number
      </label>
      <div className="flex items-center py-2 border-b border-[#3674B5] focus-within:border-[#3674B5] transition-colors">
        <span className="text-gray-700 select-none pr-1">+63</span>
        <input
          id="editContactNumber"
          name="contactNumber"
          type="tel"
          value={editAdminFormData.contactNumber.replace('+63 ', '')}
          onChange={handleEditAdminChange}
          maxLength={10}
          className="flex-grow focus:outline-none bg-transparent"
        />
      </div>
      {editErrors.contactNumber && <p className="text-red-500 text-xs mt-1">{editErrors.contactNumber}</p>}
    </div>

    <div>
      <label htmlFor="editCompanyName" className="block text-sm font-medium text-gray-500 mb-1">
        Company Name
      </label>
      <input
        id="editCompanyName"
        name="companyName"
        type="text"
        value={editAdminFormData.companyName}
        onChange={handleEditAdminChange}
        className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
      />
      {editErrors.companyName && <p className="text-red-500 text-xs mt-1">{editErrors.companyName}</p>}
    </div>

    <div>
      <label htmlFor="editCompanyAddress" className="block text-sm font-medium text-gray-500 mb-1">
        Company Address
      </label>
      <input
        id="editCompanyAddress"
        name="companyAddress"
        type="text"
        value={editAdminFormData.companyAddress}
        onChange={handleEditAdminChange}
        className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
      />
      {editErrors.companyAddress && <p className="text-red-500 text-xs mt-1">{editErrors.companyAddress}</p>}
    </div>

    <div>
      <label htmlFor="editPassword" className="block text-sm font-medium text-gray-500 mb-1">
        New Password <span className="text-gray-400 text-xs">(leave blank to keep current)</span>
      </label>
      <input
        id="editPassword"
        name="password"
        type="password"
        value={editAdminFormData.password || ''}
        onChange={handleEditAdminChange}
        className="w-full py-2 border-b border-[#3674B5] focus:outline-none focus:border-[#3674B5] transition-colors bg-transparent"
      />
    </div>
  </div>

  <div className="flex justify-between pt-4">
    <button
      type="button"
      onClick={handleCancelEdit}
      className="px-5 py-2 rounded-lg hover:bg-gray-200 border border-gray-300 text-gray-700"
    >
      Cancel
    </button>
    <button
      type="submit"
      disabled={Object.values(editErrors).some((error) => error !== '')}
      className="bg-[#3674B5] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#1b5087] transition-colors shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed"
    >
      Update Admin
    </button>
  </div>
</form>

            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {adminToDelete && (
        <div className="fixed bottom-4 right-4 z-50 flex items-end justify-end">
          <div className="bg-[#3674B5] p-8 rounded-lg shadow-xl max-w-sm w-full transform transition-transform duration-300 ease-in-out animate-slideIn">
            <h3 className="text-xl font-semibold text-white mb-4">Confirm Deletion</h3>
            <p className="text-white mb-6">
              Are you sure you want to delete admin{' '}
              <span className="font-bold">
                {adminToDelete?.firstName || 'this admin'} {adminToDelete?.lastName || ''}
              </span>
              ? This action cannot be undone.
            </p>
            <div className="flex justify-between pt-4">
              <button
                onClick={() => setAdminToDelete(null)}
                className="px-5 py-2 rounded-lg hover:bg-gray-400 hover:text-black border border-gray-300 text-white"
              >
                Cancel
              </button>
              <button
                onClick={executeDeleteAdmin}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-2 rounded-lg shadow-md text-white ${
              toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
            }`}
          >
            {toast.message}
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

export default SadminDashboard;