import React, { useState, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserAuth } from '../../contexts/UserAuthContext';
import LocationAutocomplete from '../../components/LocationAutocomplete';

const Register: React.FC = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    companyName: '',
    companyAddress: '',
    houseAddress: '',
    contactNumber: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState(1);
  const [registrationError, setRegistrationError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checked, setChecked] = useState(false);
  
  const isSubmittingRef = useRef(false);
  const submissionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  
  const navigate = useNavigate();
  const { register } = useUserAuth();

  // Helper function to check if address is valid (either hierarchical or free-form)
  const isAddressValid = (address: string): boolean => {
    if (!address || address.trim().length < 5) return false;
    
    // Check if it's just the placeholder text (not valid)
    if (address.includes('Enter house number and street')) {
      return false;
    }
    
    // Check if it's a hierarchical location selection (Region, City, Barangay with postal code)
    const hasRegion = address.includes('National Capital Region') || 
                     address.includes('Region') ||
                     address.includes('Province');
    const hasPostalCode = address.includes('(') && address.includes(')');
    const hasCommas = address.includes(',');
    
    // If it has region, postal code, and commas, check if it has actual address content
    if (hasRegion && hasPostalCode && hasCommas) {
      // Extract the part before the region to check for actual address
      const regionIndex = address.indexOf('National Capital Region');
      if (regionIndex > 0) {
        const addressPart = address.substring(0, regionIndex).trim();
        // Remove common prefixes and check if there's actual content
        const cleanAddressPart = addressPart.replace(/^Enter house number and street,?\s*/i, '').trim();
        return cleanAddressPart.length > 0 && cleanAddressPart !== 'Enter house number and street';
      }
      return true; // If no region found, assume it's valid
    }
    
    // Otherwise, check if it's a valid free-form address
    // Should have at least 5 characters and contain some address-like content
    const trimmedAddress = address.trim();
    if (trimmedAddress.length < 5) return false;
    
    // Check if it contains typical address elements (numbers, street indicators, etc.)
    const hasNumbers = /\d/.test(trimmedAddress);
    const hasStreetIndicators = /\b(st|street|ave|avenue|rd|road|blvd|boulevard|way|drive|dr|lane|ln|place|pl|court|ct|circle|cir)\b/i.test(trimmedAddress);
    const hasLocationIndicators = /\b(manila|quezon|makati|pasig|taguig|mandaluyong|san juan|marikina|caloocan|malabon|navotas|paranaque|las pinas|muntinlupa|pateros|valenzuela|binondo|ermita|intramuros|malate|paco|pandacan|port area|sampaloc|san andres|san miguel|san nicolas|santa ana|santa cruz|santa mesa|tondo|quiapo|santa ana|santa cruz|santa mesa|tondo|quiapo)\b/i.test(trimmedAddress);
    
    // Valid if it has numbers and either street indicators or location indicators
    return hasNumbers && (hasStreetIndicators || hasLocationIndicators);
  };

  const validateField = useCallback((name: string, value: string): string => {
    switch (name) {
      case 'firstName':
      case 'lastName':
        if (!value.trim()) return `${name.split(/(?=[A-Z])/).join(' ')} is required`;
        if (value.trim().length < 2) return `${name.split(/(?=[A-Z])/).join(' ')} must be at least 2 characters`;
        if (!/^[a-zA-Z\s]+$/.test(value.trim())) return `${name.split(/(?=[A-Z])/).join(' ')} can only contain letters and spaces`;
        if (value.trim().length > 50) return `${name.split(/(?=[A-Z])/).join(' ')} must be less than 50 characters`;
        return '';
      case 'middleName':
        // Middle name is optional, but if provided, validate it
        if (value.trim() && value.trim().length < 2) return 'Middle name must be at least 2 characters';
        if (value.trim() && !/^[a-zA-Z\s]+$/.test(value.trim())) return 'Middle name can only contain letters and spaces';
        if (value.trim() && value.trim().length > 50) return 'Middle name must be less than 50 characters';
        return '';
      case 'companyName':
        if (!value.trim()) return 'Company/Business name is required';
        if (value.length < 2) return 'Company name must be at least 2 characters';
        return '';
      case 'companyAddress':
        if (!value.trim()) return 'Company/Business address is required';
        if (value.length < 5) return 'Address must be at least 5 characters';
        // Check if it's just placeholder text
        if (value.includes('Enter house number and street')) {
          return 'Please enter your specific house number and street address';
        }
        // Check if address is valid (either hierarchical or free-form)
        if (!isAddressValid(value)) {
          return 'Please enter a valid address (e.g., "123 Main St, Manila" or select from location dropdown)';
        }
        return '';
      case 'houseAddress':
        if (!value.trim()) return 'House address is required';
        if (value.length < 5) return 'House address must be at least 5 characters';
        // Check if it's just placeholder text
        if (value.includes('Enter house number and street')) {
          return 'Please enter your specific house number and street address';
        }
        // Check if address is valid (either hierarchical or free-form)
        if (!isAddressValid(value)) {
          return 'Please enter a valid address (e.g., "123 Main St, Manila" or select from location dropdown)';
        }
        return '';
      case 'contactNumber':
        if (!value.trim()) return 'Contact number is required';
        if (!/^(09\d{9}|\+639\d{9})$/.test(value)) {
          return 'Please enter a valid Philippine mobile number. Format: 09XXXXXXXXX or +639XXXXXXXXX (10 digits starting with 9)';
        }
        return '';
      case 'email':
        if (!value.trim()) return 'Email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid email format';
        return '';
      case 'password':
        if (!value) return 'Password is required';
        if (value.length < 8) return 'Password must be at least 8 characters';
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/.test(value))
          return 'Password must include uppercase, lowercase, number, and special character';
        return '';
      case 'confirmPassword':
        if (value !== formData.password) return 'Passwords do not match';
        return '';
      default:
        return '';
    }
  }, [formData.password]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Validate the field in real-time
    const error = validateField(name, value);
    setErrors(prev => {
      const newErrors = { ...prev };
      if (error) {
        newErrors[name] = error;
      } else {
        delete newErrors[name];
      }
      return newErrors;
    });
  }, [validateField]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const { name } = e.currentTarget;
    
    // Only apply character restrictions to name fields
    if (name === 'firstName' || name === 'middleName' || name === 'lastName') {
      const char = e.key;
      // Allow letters, spaces, and backspace/delete
      if (!/^[a-zA-Z\s]$/.test(char) && char !== 'Backspace' && char !== 'Delete' && char !== 'ArrowLeft' && char !== 'ArrowRight') {
        e.preventDefault();
      }
    }
  }, []);

  const validateStep = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;
    let fieldsToValidate: (keyof typeof formData)[] = [];

    if (step === 1) {
      fieldsToValidate = ['firstName', 'lastName']; // Only require firstName and lastName
    } else if (step === 2) {
      fieldsToValidate = ['companyName', 'companyAddress', 'houseAddress'];
    } else if (step === 3) {
      fieldsToValidate = ['contactNumber', 'email', 'password', 'confirmPassword'];
    }

    fieldsToValidate.forEach(field => {
      const error = validateField(field, formData[field]);
      if (error) {
        newErrors[field] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [step, formData, validateField]);

  // Check if current step is valid
  const isCurrentStepValid = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    let fieldsToValidate: (keyof typeof formData)[] = [];

    if (step === 1) {
      fieldsToValidate = ['firstName', 'lastName']; // Only require firstName and lastName
    } else if (step === 2) {
      fieldsToValidate = ['companyName', 'companyAddress', 'houseAddress'];
    } else if (step === 3) {
      fieldsToValidate = ['contactNumber', 'email', 'password', 'confirmPassword'];
    }

    fieldsToValidate.forEach(field => {
      const error = validateField(field, formData[field]);
      if (error) {
        newErrors[field] = error;
      }
    });

    return Object.keys(newErrors).length === 0;
  }, [step, formData, validateField]);

  const handleNext = useCallback(() => {
    if (validateStep()) {
      setStep(prevStep => prevStep + 1);
    }
  }, [validateStep]);

  const handlePrevious = useCallback(() => {
    setStep(prevStep => Math.max(1, prevStep - 1));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent multiple submissions
    if (isSubmittingRef.current || isSubmitting) {
      console.log('Registration already in progress, ignoring duplicate submission');
      return;
    }
    
    setRegistrationError('');

    if (!validateStep()) return;

    // Set both state and ref to prevent any race conditions
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    // Clear any existing timeout
    if (submissionTimeoutRef.current) {
      clearTimeout(submissionTimeoutRef.current);
    }

    // Set a timeout to reset submission state after 30 seconds as a failsafe
    submissionTimeoutRef.current = setTimeout(() => {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }, 30000);

    try {
      const registrationData = {
        firstName: formData.firstName.trim(),
        middleName: formData.middleName.trim(),
        lastName: formData.lastName.trim(),
        companyName: formData.companyName.trim(),
        companyAddress: formData.companyAddress.trim(),
        houseAddress: formData.houseAddress.trim(),
        contactNumber: formData.contactNumber.trim(),
        email: formData.email.trim(),
        password: formData.password
      };

      const success = await register(registrationData);
      if (success) {
        // Clear the timeout since we're navigating away
        if (submissionTimeoutRef.current) {
          clearTimeout(submissionTimeoutRef.current);
        }
        navigate('/verify-email');
      } else {
        setRegistrationError('Registration failed. Please try again.');
      }
    } catch (err) {
      setRegistrationError(
        err instanceof Error ? err.message : 'An unexpected error occurred'
      );
    } finally {
      // Reset submission state
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      
      // Clear the timeout
      if (submissionTimeoutRef.current) {
        clearTimeout(submissionTimeoutRef.current);
        submissionTimeoutRef.current = null;
      }
    }
  };

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (submissionTimeoutRef.current) {
        clearTimeout(submissionTimeoutRef.current);
      }
    };
  }, []);

  // Floating Input Component
  const FloatingInput = React.useCallback(({ 
    id, 
    name, 
    type, 
    value, 
    onChange, 
    onKeyPress, 
    error, 
    label, 
    showPasswordToggle = false 
  }: {
    id: string;
    name: string;
    type: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onKeyPress?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    error?: string;
    label: string;
    showPasswordToggle?: boolean;
  }) => (
    <div className="relative mt-8">
      <input
        id={id}
        name={name}
        type={showPasswordToggle ? (name === 'password' ? (showPassword ? 'text' : type) : (showConfirmPassword ? 'text' : type)) : type}
        placeholder=""
        required
        value={value}
        onChange={onChange}
        onKeyPress={onKeyPress}
        className={`peer w-full px-0 pt-5 pb-2 border-b bg-transparent focus:outline-none focus:border-blue-500 focus:ring-0 placeholder-transparent transition ${
          error ? 'border-red-400' : 'border-gray-300'
        } text-white`}
        style={{ backgroundColor: 'transparent' }}
      />
      <label
        htmlFor={id}
        className={`absolute left-0 text-white bg-transparent transition-all duration-200 ${
          value ? '-top-2 text-sm font-bold' : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base'
        } peer-focus:-top-2 peer-focus:text-sm peer-focus:font-bold`}
      >
        {label}
      </label>
      
      {showPasswordToggle && (
        <button
          type="button"
          onClick={() => name === 'password' ? setShowPassword((prev) => !prev) : setShowConfirmPassword((prev) => !prev)}
          className="absolute inset-y-0 right-0 flex items-center px-2 cursor-pointer"
        >
          {(name === 'password' ? showPassword : showConfirmPassword) ? (
            <EyeIcon className="h-5 w-5 text-white" />   
          ) : (
            <EyeSlashIcon className="h-5 w-5 text-white" />
          )}
        </button>
      )}

      {error && (
        <p className="text-red-400 text-xs mt-1">{error}</p>
      )}
    </div>
  ), [showPassword, showConfirmPassword]);

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center"
      style={{ backgroundImage: "url('/image/signup.png')" }}
    >
      <style>
        {`
          input:-webkit-autofill,
          input:-webkit-autofill:hover,
          input:-webkit-autofill:focus,
          input:-webkit-autofill:active {
            -webkit-background-clip: text;
            -webkit-text-fill-color: white;
            transition: background-color 5000s ease-in-out 0s;
            box-shadow: inset 0 0 20px 20px transparent !important;
          }
        `}
      </style>
      <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-40 z-0"></div>

      <div className="relative z-10 p-8 sm:p-10 mb-5 mt-5
                rounded-md shadow-2xl w-full max-w-xl
                bg-transparent backdrop-blur-lg border border-white/30">
        {/* Ads2Go Logo */}
        <div className="flex justify-center mb-6">
          <img 
            src="/image/Ads2GoLogoText.png" 
            alt="Ads2Go Logo" 
            className="h-12 w-auto object-contain"
          />
        </div>
        
        {/* Login Title */}
        <h1 className="text-5xl font-bold text-center mb-6 text-white">
          Sign up
        </h1>

        {registrationError && (
          <div className="bg-red-50/80 backdrop-blur-sm border-l-4 border-red-500 p-4 mb-4 rounded">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-500"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{registrationError}</p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={step === 3 ? handleSubmit : (e) => e.preventDefault()} noValidate>
          {step === 1 && (
            <div className="space-y-6">
              <FloatingInput
                id="firstName"
                name="firstName"
                type="text"
                value={formData.firstName}
                onChange={handleChange}
                onKeyPress={handleKeyPress}
                error={errors.firstName}
                label="First Name"
              />

              <FloatingInput
                id="middleName"
                name="middleName"
                type="text"
                value={formData.middleName}
                onChange={handleChange}
                onKeyPress={handleKeyPress}
                error={errors.middleName}
                label="Middle Name (Optional)"
              />

              <FloatingInput
                id="lastName"
                name="lastName"
                type="text"
                value={formData.lastName}
                onChange={handleChange}
                onKeyPress={handleKeyPress}
                error={errors.lastName}
                label="Last Name"
              />

              <button
                type="button"
                onClick={handleNext}
                disabled={!isCurrentStepValid()}
                className={`w-full py-3 px-4 transition-colors mt-6 ${
                  isCurrentStepValid()
                    ? 'bg-[#3674B5] hover:bg-[#3674B5]/80 cursor-pointer'
                    : 'bg-blue-400 cursor-not-allowed'
                } text-white font-semibold`}
              >
                Next
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <FloatingInput
                id="companyName"
                name="companyName"
                type="text"
                value={formData.companyName}
                onChange={handleChange}
                error={errors.companyName}
                label="Company/Business Name"
              />

              <LocationAutocomplete
                label="Company/Business Address"
                value={formData.companyAddress}
                onChange={(value) => setFormData(prev => ({ ...prev, companyAddress: value }))}
                placeholder="Select company location or enter address..."
                required
                error={errors.companyAddress}
              />
              <LocationAutocomplete
                label="House Address"
                value={formData.houseAddress}
                onChange={(value) => setFormData(prev => ({ ...prev, houseAddress: value }))}
                placeholder="Select house location or enter address..."
                required
                error={errors.houseAddress}
              />

              <div className="flex justify-between gap-4 mt-6">
                <button
                  type="button"
                  onClick={handlePrevious}
                  className="w-40 text-white/80 font-semibold bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!isCurrentStepValid()}
                  className={`flex-1 py-3 px-4 text-white font-semibold transition-colors ${
                    isCurrentStepValid()
                      ? 'bg-[#3674B5] hover:bg-[#3674B5]/80 cursor-pointer'
                      : 'bg-blue-400 cursor-not-allowed'
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <FloatingInput
                id="contactNumber"
                name="contactNumber"
                type="tel"
                value={formData.contactNumber}
                onChange={handleChange}
                error={errors.contactNumber}
                label="Contact Number"
              />

              <FloatingInput
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
                label="Email Address"
              />

              <FloatingInput
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                error={errors.password}
                label="Password"
                showPasswordToggle={true}
              />

              <FloatingInput
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                error={errors.confirmPassword}
                label="Confirm Password"
                showPasswordToggle={true}
              />

              {/* Terms Checkbox */}
              <div className="flex items-center text-sm mt-6">
                <div
                  className="flex items-center space-x-2 cursor-pointer"
                  onClick={() => setShowTermsModal(true)} // 🔹 Opens modal instead of toggling
                >
                  <div className="relative w-5 h-5 border-2 border-white/30 hover:border-white/50 flex items-center justify-center transition-colors duration-200">
                    <AnimatePresence>
                      {checked && (
                        <motion.div
                          key="check"
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          className="absolute text-white"
                        >
                          <Check size={12} strokeWidth={3} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <span className="text-white select-none">I agree to the terms and conditions</span>
                </div>
              </div>

              {/* 🔹 Terms Modal */}
              {showTermsModal && (
                <div className="fixed inset-0 flex -top-6 items-center justify-center bg-black/60 z-50">
                  <div className="bg-white/90 shadow-2xl w-11/12 sm:w-2/3 lg:w-[28rem] max-h-[85vh] overflow-y-auto p-6">
                    <h2 className="text-2xl font-bold mb-4 text-gray-800 text-center">
                      Terms and Conditions
                    </h2>

                    <div className="text-sm text-gray-700 space-y-5 text-justify">
                      <p><strong>Last Updated:</strong> October 20, 2025</p>

                      <section>
                        <h3 className="font-semibold text-gray-900 mb-1">1. Acceptance of Terms</h3>
                        <p>
                          By accessing or using the <strong>Ads2Go</strong> website, application, or services
                          (collectively, the “Service”), you agree to comply with and be bound by these Terms and
                          Conditions. If you do not agree with any part of these terms, you must not use the Service.
                        </p>
                      </section>

                      <section>
                        <h3 className="font-semibold text-gray-900 mb-1">2. Use of the Service</h3>
                        <p>
                          You agree to use Ads2Go only for lawful purposes and in a manner that does not infringe
                          upon the rights of others or interfere with the normal operation of the Service. You are
                          prohibited from posting, uploading, or distributing any unlawful, harmful, or misleading
                          content through Ads2Go.
                        </p>
                      </section>

                      <section>
                        <h3 className="font-semibold text-gray-900 mb-1">3. User Accounts</h3>
                        <p>
                          Certain features of Ads2Go may require you to register for an account. You are responsible
                          for maintaining the confidentiality of your account credentials and for all activities
                          conducted under your account. Ads2Go reserves the right to suspend or terminate accounts
                          involved in any unauthorized or fraudulent activities.
                        </p>
                      </section>

                      <section>
                        <h3 className="font-semibold text-gray-900 mb-1">4. Privacy Policy</h3>
                        <p>
                          Your use of the Service is governed by our <strong>Privacy Policy</strong>, which outlines how
                          we collect, use, and protect your personal information. By using Ads2Go, you consent to the
                          collection and use of your data in accordance with that policy.
                        </p>
                      </section>

                      <section>
                        <h3 className="font-semibold text-gray-900 mb-1">5. Intellectual Property</h3>
                        <p>
                          All content, trademarks, logos, graphics, and other materials provided through Ads2Go are
                          owned by or licensed to <strong>Ads2Go</strong>. You may not reproduce, distribute, modify,
                          or exploit any part of the Service without prior written consent from Ads2Go.
                        </p>
                      </section>

                      <section>
                        <h3 className="font-semibold text-gray-900 mb-1">6. Advertising Content and Responsibility</h3>
                        <p>
                          Users submitting advertisements are solely responsible for ensuring that all ad materials
                          comply with applicable laws and do not infringe upon third-party rights. Ads2Go reserves the
                          right to review, modify, or reject any advertisement that violates our standards or legal
                          requirements.
                        </p>
                      </section>

                      <section>
                        <h3 className="font-semibold text-gray-900 mb-1">7. Limitation of Liability</h3>
                        <p>
                          Ads2Go will not be held liable for any direct, indirect, incidental, or consequential
                          damages resulting from your use or inability to use the Service. All use of the Service is
                          at your own risk.
                        </p>
                      </section>

                      <section>
                        <h3 className="font-semibold text-gray-900 mb-1">8. Changes to Terms</h3>
                        <p>
                          Ads2Go reserves the right to update or modify these Terms and Conditions at any time. Any
                          changes will be effective immediately upon posting, and the updated “Last Updated” date
                          will reflect the revision. Continued use of the Service after changes indicates your
                          acceptance of the new Terms.
                        </p>
                      </section>
                    </div>

                    <div className="flex justify-between gap-3 mt-6">
                      <button
                        onClick={() => setShowTermsModal(false)}
                        className="w-40 text-black/80 font-semibold bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          setChecked(true);
                          setShowTermsModal(false);
                        }}
                        className="w-full px-6 py-2 bg-[#3674B5] hover:bg-[#3674B5]/80 text-white font-semibold transition"
                      >
                        Agree
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-4 mt-6">
                <button
                  type="button"
                  onClick={handlePrevious}
                  disabled={isSubmitting}
                  className={`w-40 text-white/80 font-semibold bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center ${
                    isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/10'
                  }`}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !checked}
                  className={`flex-1 py-3 px-4 transition-colors ${
                    isSubmitting || !checked
                      ? 'bg-blue-400 cursor-not-allowed'
                      : 'bg-[#3674B5] hover:bg-[#3674B5]/80 cursor-pointer'
                  } text-white font-semibold`}
                >
                  {isSubmitting ? (
                    <div className="flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin mr-2"></div>
                      Registering...
                    </div>
                  ) : (
                    'Register'
                  )}
                </button>
              </div>
            </div>
          )}
        </form>

        <div className="my-6 flex justify-center">
          <span className="text-white text-sm text-center">
            or continue with
          </span>
        </div>


        <div className="flex justify-center space-x-4">
          <button type="button" className="p-2 border border-white/50 rounded-full hover:bg-gray-100/20 transition-colors">
            <img src="/image/g.png" alt="Google logo" className="h-6 w-6" />
          </button>
        </div>

        <div className="text-center mt-6 text-sm">
          <span className="text-white">Already have an account?</span>
          <Link to="/login" className="text-blue-300 ml-1 underline hover:font-semibold">
            Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;