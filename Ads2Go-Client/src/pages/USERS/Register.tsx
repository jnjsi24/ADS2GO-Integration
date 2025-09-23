import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useUserAuth } from '../../contexts/UserAuthContext';

// CREATE USER
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
  const [isLoading, setIsLoading] = useState(true);
  const [registrationError, setRegistrationError] = useState('');
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Add refs to track submission state and prevent multiple submissions
  const isSubmittingRef = useRef(false);
  const submissionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { register } = useUserAuth();

  const validateField = (name: string, value: string): string => {
    switch (name) {
      case 'firstName':
      case 'lastName':
        if (!value.trim()) return `${name.split(/(?=[A-Z])/).join(' ')} is required`;
        if (!/^[a-zA-Z\s]+$/.test(value)) return 'Only letters and spaces allowed';
        return '';
      case 'companyName':
        if (!value.trim()) return 'Company/Business name is required';
        if (value.length < 2) return 'Company name must be at least 2 characters';
        return '';
      case 'companyAddress':
        if (!value.trim()) return 'Company/Business address is required';
        if (value.length < 5) return 'Address must be at least 5 characters';
        return '';
      case 'houseAddress':
        if (!value.trim()) return 'House address is required';
        if (value.length < 5) return 'House address must be at least 5 characters';
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
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateStep = (): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;
    let fieldsToValidate: (keyof typeof formData)[] = [];

    if (step === 1) {
      fieldsToValidate = ['firstName', 'lastName'];
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
  };

  const handleNext = () => {
    if (validateStep()) {
      setStep(prevStep => prevStep + 1);
    }
  };

  const handlePrevious = () => {
    setStep(prevStep => prevStep - 1);
  };

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

  return (
    <div className="relative flex min-h-screen bg-[#fdfdfd]">
      {/* Background Image on the Right */}
      <img
        src="/image/signup.png"
        alt="Signup background"
        className="absolute top-0 right-0 w-1/2 h-full object-cover hidden md:block"
      />
      {/* Form Container on the Left */}
      <div className="relative z-10 w-full md:w-1/2 h-screen flex flex-col justify-center items-center">
        <div className="p-20 rounded-3xl shadow-2xl bg-white h-full w-[85%] md:w-[790px] ml-4">
          <h2 className="text-4xl font-extrabold text-black mb-8 mt-8">Sign up</h2>

          {registrationError && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
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

          <form className="mt-8 space-y-6" onSubmit={step === 3 ? handleSubmit : (e) => e.preventDefault()}>
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <label htmlFor="firstName" className="block text-md font-bold text-gray-700 mb-1">
                    First Name
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={handleChange}
                    className={`w-full border-b border-gray-300 focus:border-blue-500 focus:outline-none py-2`}
                  />
                  {errors.firstName && <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>}
                </div>
                <div>
                  <label htmlFor="middleName" className="block text-md font-bold text-gray-700 mb-1" style={{ color: '#000000' }}>
                    Middle Name
                  </label>
                  <input
                    id="middleName"
                    name="middleName"
                    type="text"
                    value={formData.middleName}
                    onChange={handleChange}
                    className="w-full border-b border-gray-300 focus:border-blue-500 focus:outline-none py-2"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-md font-bold text-gray-700 mb-1" style={{ color: '#000000' }}>
                    Last Name
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={handleChange}
                    className={`w-full border-b border-gray-300 focus:border-blue-500 focus:outline-none py-2`}
                  />
                  {errors.lastName && <p className="mt-1 text-red-600">{errors.lastName}</p>}
                </div>
                <button
                  type="button"
                  onClick={handleNext}
                  className="w-full py-3 px-4 bg-[#FF9800] text-white font-semibold rounded-full hover:bg-[#FF9B45] focus:outline-none"
                >
                  Next
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <label htmlFor="companyName" className="block text-md font-bold text-gray-700 mb-1" style={{ color: '#000000' }}>
                    Company/Business Name
                  </label>
                  <input
                    id="companyName"
                    name="companyName"
                    type="text"
                    value={formData.companyName}
                    onChange={handleChange}
                    className={`w-full border-b border-gray-300 focus:border-blue-500 focus:outline-none py-2`}
                  />
                  {errors.companyName && <p className="mt-1 text-sm text-red-600">{errors.companyName}</p>}
                </div>
                <div>
                  <label htmlFor="companyAddress" className="block text-md font-bold text-gray-700 mb-1" style={{ color: '#000000' }}>
                    Company/Business Address
                  </label>
                  <input
                    id="companyAddress"
                    name="companyAddress"
                    type="text"
                    value={formData.companyAddress}
                    onChange={handleChange}
                    className={`w-full border-b border-gray-300 focus:border-blue-500 focus:outline-none py-2`}
                  />
                  {errors.companyAddress && <p className="mt-1 text-sm text-red-600">{errors.companyAddress}</p>}
                </div>
                <div>
                  <label htmlFor="houseAddress" className="block text-md font-bold text-gray-700 mb-1" style={{ color: '#000000' }}>
                    House Address
                  </label>
                  <input
                    id="houseAddress"
                    name="houseAddress"
                    type="text"
                    value={formData.houseAddress}
                    onChange={handleChange}
                    className={`w-full border-b border-gray-300 focus:border-blue-500 focus:outline-none py-2`}
                  />
                  {errors.houseAddress && <p className="mt-1 text-sm text-red-600">{errors.houseAddress}</p>}
                </div>
                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={handlePrevious}
                    className="w-40 mr-2 px-3 border justify-start text-gray-800 font-semibold rounded-full hover:bg-gray-100 focus:outline-none"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="w-full ml-2 py-3 px-4 bg-[#FF9800] justify-end text-white font-semibold rounded-full hover:bg-[#FF9B45] focus:outline-none"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <label
                    htmlFor="contactNumber"
                    className="block text-md font-bold text-gray-700 mb-1"
                    style={{ color: '#000000' }}
                  >
                    Contact Number
                  </label>
                  <input
                    id="contactNumber"
                    name="contactNumber"
                    type="text"
                    value={formData.contactNumber}
                    onChange={handleChange}
                    className={`w-full border-b border-gray-300 focus:border-blue-500 focus:outline-none py-2`}
                  />
                  {errors.contactNumber && (
                    <p className="mt-1 text-sm text-red-600">{errors.contactNumber}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="block text-md font-bold text-gray-700 mb-1"
                    style={{ color: '#000000' }}
                  >
                    Email Address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`w-full border-b border-gray-300 focus:border-blue-500 focus:outline-none py-2`}
                  />
                  {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
                </div>

                {/* Password + Confirm Password side by side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Password */}
                  <div>
                    <label htmlFor="password" className="block text-md font-bold text-gray-700 mb-1">
                      Password
                    </label>
                    <div className="relative mt-1">
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={handleChange}
                        className="w-full border-b border-gray-300 focus:border-blue-500 focus:outline-none py-2"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(prev => !prev)}
                        className="absolute inset-y-0 right-3 flex items-center text-gray-500"
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeSlashIcon className="h-5 w-5" />
                        ) : (
                          <EyeIcon className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                    {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label htmlFor="confirmPassword" className="block text-md font-bold text-gray-700 mb-1">
                      Confirm Password
                    </label>
                    <div className="relative mt-1">
                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        className="w-full border-b border-gray-300 focus:border-blue-500 focus:outline-none py-2"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(prev => !prev)}
                        className="absolute inset-y-0 right-3 flex items-center text-gray-500"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? (
                          <EyeSlashIcon className="h-5 w-5" />
                        ) : (
                          <EyeIcon className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={handlePrevious}
                    disabled={isSubmitting}
                    className={`w-40 mr-2 py-3 px-4 border text-gray-800 font-semibold rounded-full focus:outline-none ${
                      isSubmitting 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`w-full py-3 px-4 text-white font-semibold rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      isSubmitting
                        ? 'bg-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-[#FF9B45]'
                    }`}
                    style={{ backgroundColor: isSubmitting ? '#A0A0A0' : '#FF9800' }}
                  >
                    {isSubmitting ? 'Registering...' : 'Register'}
                  </button>
                </div>
              </div>
            )}

            {/* Social Sign-in */}
            <div className="text-center">
              <p className="text-gray-500 text-sm mb-5 mt-10">or Log in With</p>
              <div className="flex justify-center space-x-6">
                <img src="/image/g.png" alt="Google" className="h-6 w-6 cursor-pointer" />
                <img src="/image/f.png" alt="Facebook" className="h-6 w-6 cursor-pointer" />
                <img src="/image/i.png" alt="Instagram" className="h-6 w-6 cursor-pointer" />
                <img src="/image/t.png" alt="Twitter" className="h-6 w-6 cursor-pointer" />
                <img src="/image/l.png" alt="LinkedIn" className="h-6 w-6 cursor-pointer" />
              </div>
            </div>

            {/* Sign Up Link */}
            <div className="text-center mt-6 text-sm">
              <span className="text-gray-700">Already have an account?</span>{' '}
              <a href="/login" className="text-blue-600 hover:underline">Login</a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Register;