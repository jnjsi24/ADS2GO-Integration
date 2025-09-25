import { AdminFormData, FormErrors, EditAdminFormData, EditErrors } from './types';

// Date display helper
export const formatDate = (dateInput: any): string => {
  if (!dateInput) return 'N/A';
  
  try {
    // Handle different date formats
    let date: Date;
    
    if (typeof dateInput === 'number') {
      // If it's a timestamp (milliseconds)
      date = new Date(dateInput);
    } else if (typeof dateInput === 'string') {
      // If it's a date string, try to parse it
      // First, try to parse as ISO string
      date = new Date(dateInput);
      
      // If that fails, try to parse as timestamp string
      if (isNaN(date.getTime()) && /^\d+$/.test(dateInput)) {
        date = new Date(parseInt(dateInput));
      }
    } else {
      // If it's already a Date object
      date = dateInput;
    }
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date input:', dateInput, 'Type:', typeof dateInput);
      return 'Invalid Date';
    }
    
    // Format the date as "MMM DD, YYYY" (e.g., "Jan 15, 2024")
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date:', error, 'Input:', dateInput);
    return 'Invalid Date';
  }
};

// Validate new admin form
export const validateNewAdminForm = (formData: AdminFormData): { isValid: boolean; errors: FormErrors } => {
  // Log form data for debugging (excluding sensitive fields)
  if (process.env.NODE_ENV === 'development') {
    console.log('[DEBUG] Validating form with data:', {
      ...formData,
      password: '***',
      confirmPassword: '***',
      contactNumberLength: formData.contactNumber?.length,
      companyName: formData.companyName || 'empty',
      companyAddress: formData.companyAddress || 'empty',
      profilePicture: formData.profilePicture ? 'File selected' : 'No file'
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
  if (!formData.firstName?.trim()) {
    addError('firstName', 'First Name is required.');
  } else if (formData.firstName.trim().length < 2) {
    addError('firstName', 'First Name must be at least 2 characters long.');
  } else if (!nameRegex.test(formData.firstName.trim())) {
    addError('firstName', 'First Name contains invalid characters. Only letters, spaces, hyphens, and apostrophes are allowed.');
  }

  // Validate middle name (optional)
  if (formData.middleName?.trim() && !nameRegex.test(formData.middleName.trim())) {
    addError('middleName', 'Middle Name contains invalid characters. Only letters, spaces, hyphens, and apostrophes are allowed.');
  }

  // Validate last name
  if (!formData.lastName?.trim()) {
    addError('lastName', 'Last Name is required.');
  } else if (formData.lastName.trim().length < 2) {
    addError('lastName', 'Last Name must be at least 2 characters long.');
  } else if (!nameRegex.test(formData.lastName.trim())) {
    addError('lastName', 'Last Name contains invalid characters. Only letters, spaces, hyphens, and apostrophes are allowed.');
  }
  
  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!formData.email?.trim()) {
    addError('email', 'Email is required.');
  } else if (!emailRegex.test(formData.email.trim())) {
    addError('email', 'Please enter a valid email address.');
  }

  // Validate password
  if (!formData.password) {
    addError('password', 'Password is required.');
  } else if (formData.password.length < 8) {
    addError('password', 'Password must be at least 8 characters long.');
  } else if (!/\d/.test(formData.password) || 
             !/[a-z]/.test(formData.password) || 
             !/[A-Z]/.test(formData.password)) {
    addError('password', 'Password must contain at least one uppercase letter, one lowercase letter, and one number.');
  }

  // Validate confirm password
  if (formData.password !== formData.confirmPassword) {
    addError('confirmPassword', 'Passwords do not match.');
  }

  // Validate company name
  if (!formData.companyName?.trim()) {
    addError('companyName', 'Company Name is required.');
  } else if (formData.companyName.trim().length < 2) {
    addError('companyName', 'Company Name must be at least 2 characters long.');
  }

  // Validate company address
  if (!formData.companyAddress?.trim()) {
    addError('companyAddress', 'Company Address is required.');
  } else if (formData.companyAddress.trim().length < 5) {
    addError('companyAddress', 'Please enter a valid company address.');
  }

  // Validate contact number (Philippine format: 09XXXXXXXXX or +639XXXXXXXXX)
  if (!formData.contactNumber?.trim()) {
    addError('contactNumber', 'Contact Number is required.');
  } else {
    const cleanNumber = formData.contactNumber.replace(/\D/g, '');
    
    if (/^9\d{9}$/.test(cleanNumber)) {
      // Format as 09XXXXXXXXX if only 10 digits starting with 9
      formData.contactNumber = `0${cleanNumber}`;
    } else if (!/^09\d{9}$/.test(cleanNumber)) {
      addError('contactNumber', 'Please provide a valid Philippine phone number (e.g., 9123456789 or 09123456789).');
    }
  }
  
  // Validate profile picture (optional but if provided, check type)
  if (formData.profilePicture) {
    const validImageTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!validImageTypes.includes(formData.profilePicture.type)) {
      addError('profilePicture', 'Please upload a valid image file (JPEG, PNG, or GIF).');
    } else if (formData.profilePicture.size > 5 * 1024 * 1024) {
      addError('profilePicture', 'Image size should not exceed 5MB.');
    }
  }

  // Return validation result
  const result = { isValid, errors };
  
  if (process.env.NODE_ENV === 'development') {
    console.log('[DEBUG] Validation result:', result);
  }
  
  return result;
};

// Validate edit form
export const validateEditForm = (formData: EditAdminFormData): boolean => {
  let isValid = true;
  const newErrors: EditErrors = {
    firstName: '',
    lastName: '',
    email: '',
    contactNumber: '',
    companyName: '',
    companyAddress: '',
  };
  const nameRegex = /^[A-Za-z\s]+$/;
  
  if (!formData.firstName.trim() || !nameRegex.test(formData.firstName)) {
    newErrors.firstName = 'First Name should not contain numbers or symbols and cannot be empty.';
    isValid = false;
  }
  if (!formData.lastName.trim() || !nameRegex.test(formData.lastName)) {
    newErrors.lastName = 'Last Name should not contain numbers or symbols and cannot be empty.';
    isValid = false;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!formData.email.trim() || !emailRegex.test(formData.email)) {
    newErrors.email = 'Please enter a valid email address.';
    isValid = false;
  }
  
  // Make phone number validation optional - only validate if there's a value
  if (formData.contactNumber) {
    const phoneRegex = /^\+63\s?\d{10}$/;
    if (!phoneRegex.test(formData.contactNumber)) {
      newErrors.contactNumber = 'Please provide a valid phone number (e.g., +63 9123456789).';
      isValid = false;
    }
  }
  
  // Make company name and address optional
  // Only validate format if there's a value
  if (formData.companyName && !formData.companyName.trim()) {
    newErrors.companyName = 'Company Name cannot be empty if provided.';
    isValid = false;
  }
  
  if (formData.companyAddress && !formData.companyAddress.trim()) {
    newErrors.companyAddress = 'Company Address cannot be empty if provided.';
    isValid = false;
  }
  
  return isValid;
};
