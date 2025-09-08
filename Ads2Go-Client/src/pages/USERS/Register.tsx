import React, { useState } from 'react';
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
    houseAddress: '',         // <-- Added this field
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
      case 'houseAddress':               // <-- Validate houseAddress too
        if (!value.trim()) return 'House address is required';
        if (value.length < 5) return 'House address must be at least 5 characters';
        return '';
      case 'contactNumber':
        if (!value.trim()) return 'Contact number is required';
        if (!/^(09\d{9}|\+639\d{9})$/.test(value)) {
  return 'Please use a valid Philippine mobile number (e.g., 09123456789 or +639123456789)';
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
    setRegistrationError('');

    if (!validateStep()) return;

    setIsSubmitting(true); // Start submitting state

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
        navigate('/verify-email');
      } else {
        setRegistrationError('Registration failed. Please try again.');
      }
    } catch (err) {
      setRegistrationError(
        err instanceof Error ? err.message : 'An unexpected error occurred'
      );
    } finally {
      setIsSubmitting(false); // End submitting state
    }
  };

  return (
    <>
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black opacity-80">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
            onLoadedData={() => setIsLoading(false)}
          >
            <source src="/image/loading.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>
      )}
      <div className="relative min-h-screen flex items-center justify-start bg-[#fdfdfd]">
        {/* Video Background */}
        <video
          autoPlay
          loop
          muted
          playsInline
           className="fixed top-1/2 left-1 -translate-y-1/2 w-[100vw] h-auto object-cover"
        >
          <source src="/image/signup.mp4" type="video/mp4" />
        </video>

        {/* Overlay to darken the video */}
        <div className="absolute inset-0"></div>

        {/* Form Container */}
        <div className="relative z-10 w-full max-w-lg mx-auto sm:mx-0 sm:ml-32 p-8 rounded-xl shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-5xl font-extrabold" style={{ color: '#000000' }}>
              Sign up
            </h2>
            <div className="flex items-center space-x-2">
              <span className="text-gray-600 font-semibold">Sign with</span>
              <button
                type="button"
                className="bg-none rounded-full p-2 shadow-md hover:bg-gray-100"
              >
                <img
                src="/image/g.png"
                alt="Google logo"
                className="h-5 w-5 "
                />
              </button>
            </div>
          </div>

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
                  <label htmlFor="firstName" className="block text-sm text-black">
                    First Name
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={handleChange}
                    className={`mt-1 block w-full border border-gray-400  rounded-xl  shadow-lg py-2 px-4 text-lg focus:outline-none`}
                    
                  />
                  {errors.firstName && <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>}
                </div>
                <div>
                  <label htmlFor="middleName" className="block text-md text-[#2E2E2E]" style={{ color: '#000000' }}>
                    Middle Name
                  </label>
                  <input
                    id="middleName"
                    name="middleName"
                    type="text"
                    value={formData.middleName}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-400   rounded-xl  shadow-lg py-2 px-4 text-lg focus:outline-none"
                    
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-md text-[#2E2E2E]" style={{ color: '#000000' }}>
                    Last Name
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={handleChange}
                    className={`mt-1 block w-full border border-gray-400 rounded-xl shadow-lg py-2 px-4 text-lg focus:outline-none`}
                  />
                  {errors.lastName && <p className="mt-1 text-red-600">{errors.lastName}</p>}
                </div>
                <button
                  type="button"
                  onClick={handleNext}
                  className="w-60 py-3 px-4 bg-[#FF9800] text-white font-semibold rounded-md hover:bg-[#FF9B45] focus:outline-none"
                >
                  Next
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <label htmlFor="companyName" className="block text-md text-[#2E2E2E]" style={{ color: '#000000' }}>
                    Company/Business Name *
                  </label>
                  <input
                    id="companyName"
                    name="companyName"
                    type="text"
                    value={formData.companyName}
                    onChange={handleChange}
                    className={`mt-1 block w-full border border-gray-400   rounded-xl  shadow-lg py-2 px-4 text-lg focus:outline-none`}
                    
                  />
                  {errors.companyName && <p className="mt-1 text-sm text-red-600">{errors.companyName}</p>}
                </div>
                <div>
                  <label htmlFor="companyAddress" className="block text-md text-[#2E2E2E]" style={{ color: '#000000' }}>
                    Company/Business Address *
                  </label>
                  <input
                    id="companyAddress"
                    name="companyAddress"
                    type="text"
                    value={formData.companyAddress}
                    onChange={handleChange}
                    className={`mt-1 block w-full border border-gray-400   rounded-xl  shadow-lg py-2 px-4 text-lg focus:outline-none`}
                    
                  />
                  {errors.companyAddress && <p className="mt-1 text-sm text-red-600">{errors.companyAddress}</p>}
                </div>
                <div>
                  <label htmlFor="houseAddress" className="block text-sm text-[#2E2E2E]" style={{ color: '#000000' }}>
                    House Address *
                  </label>
                  <input
                    id="houseAddress"
                    name="houseAddress"
                    type="text"
                    value={formData.houseAddress}
                    onChange={handleChange}
                    className={`mt-1 block w-full border border-gray-400   rounded-xl  shadow-lg py-2 px-4 text-md focus:outline-none`}
                    
                  />
                  {errors.houseAddress && <p className="mt-1 text-sm text-red-600">{errors.houseAddress}</p>}
                </div>
                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={handlePrevious}
                    className="w-1/2 mr-2 px-3 border text-gray-800 font-semibold rounded-md hover:bg-gray-100 focus:outline-none"
                    
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="w-full ml-2 py-3 px-4 bg-[#FF9800] text-white font-semibold rounded-md hover:bg-[#FF9B45] focus:outline-none"
           
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <label htmlFor="contactNumber" className="block text-md text-[#2E2E2E]" style={{ color: '#000000' }}>
                    Contact Number *
                  </label>
                  <input
                    id="contactNumber"
                    name="contactNumber"
                    type="text"
                    value={formData.contactNumber}
                    onChange={handleChange}
                    className={`mt-1 block w-full border border-gray-400   rounded-xl  shadow-lg py-2 px-4 text-lg focus:outline-none`}
                    
                  />
                  {errors.contactNumber && <p className="mt-1 text-sm text-red-600">{errors.contactNumber}</p>}
                </div>
                <div>
                  <label htmlFor="email" className="block text-md text-[#2E2E2E]" style={{ color: '#000000' }}>
                    Email Address *
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`mt-1 block w-full border border-gray-400   rounded-xl  shadow-lg py-2 px-4 text-lg focus:outline-none`}
                    
                  />
                  {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
                </div>
                <div>
                  <label htmlFor="password" className="block text-md text-[#2E2E2E]">
                    Password
                  </label>
                  <div className="relative mt-1">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={handleChange}
                      className="block w-full border border-gray-400 rounded-xl shadow-lg py-2 px-4 text-lg focus:outline-none"
                      
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(prev => !prev)}
                      className="absolute inset-y-0 right-3 flex items-center text-gray-500"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="block text-md text-[#2E2E2E]">
                    Confirm Password
                  </label>
                  <div className="relative mt-1">
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="block w-full border border-gray-400 rounded-xl shadow-lg py-2 px-4 text-lg focus:outline-none"
                      
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(prev => !prev)}
                      className="absolute inset-y-0 right-3 flex items-center text-gray-500"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>}
                </div>
                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={handlePrevious}
                    className="w-1/2 mr-2 py-3 px-4 border text-gray-800 font-semibold rounded-md hover:bg-gray-100 focus:outline-none"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting} // Disable the button while submitting
                    className={`w-full py-3 px-4 text-white font-semibold rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
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
            <div className="text-center mt-6">
              <span className="text-gray-800">Already have an account?</span>
              <a href="/login" className="text-blue-600 ml-1 hover:underline">
                Log in
              </a>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default Register;