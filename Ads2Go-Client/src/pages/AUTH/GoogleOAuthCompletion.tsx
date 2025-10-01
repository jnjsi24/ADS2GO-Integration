import React, { useState } from 'react';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { useMutation } from '@apollo/client';
import { COMPLETE_GOOGLE_OAUTH_MUTATION } from '../../graphql/user/mutations/CompleteGoogleOAuth';
import { motion } from 'framer-motion';

interface GoogleOAuthCompletionProps {
  googleUserData: {
    firstName: string;
    lastName: string;
    email: string;
    profilePicture?: string;
    googleId: string;
  } | null;
}

const GoogleOAuthCompletion: React.FC<GoogleOAuthCompletionProps> = ({ googleUserData }) => {
  const { navigate, setUser, setUserEmail } = useUserAuth();
  const [completeGoogleOAuth] = useMutation(COMPLETE_GOOGLE_OAUTH_MUTATION);
  
  const [formData, setFormData] = useState({
    lastName: googleUserData?.lastName || '', // Use Google's lastName or empty
    middleName: '',
    companyName: '',
    companyAddress: '',
    contactNumber: '',
    houseAddress: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Debug logging
  console.log('🔍 GoogleOAuthCompletion received googleUserData:', googleUserData);
  
  // Add safety check for googleUserData
  if (!googleUserData || !googleUserData.email || !googleUserData.googleId) {
    console.log('❌ Invalid googleUserData, showing error page');
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Invalid Session</h1>
          <p className="text-gray-600 mb-6">
            Your Google authentication session has expired or is invalid. Please try logging in again.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Validate lastName if not provided by Google
    if (!googleUserData?.lastName && !formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    } else if (!googleUserData?.lastName && formData.lastName.trim().length < 2) {
      newErrors.lastName = 'Last name must be at least 2 characters long';
    }

    if (!formData.companyName.trim()) {
      newErrors.companyName = 'Company/Business name is required';
    } else if (formData.companyName.trim().length < 2) {
      newErrors.companyName = 'Company name must be at least 2 characters long';
    }

    if (!formData.companyAddress.trim()) {
      newErrors.companyAddress = 'Company/Business address is required';
    } else if (formData.companyAddress.trim().length < 10) {
      newErrors.companyAddress = 'Company address must be at least 10 characters long';
    }

    if (!formData.contactNumber.trim()) {
      newErrors.contactNumber = 'Contact number is required';
    } else {
      const phoneRegex = /^(09\d{9}|\+639\d{9})$/;
      if (!phoneRegex.test(formData.contactNumber.trim())) {
        newErrors.contactNumber = 'Please enter a valid Philippine mobile number (09XXXXXXXXX or +639XXXXXXXXX)';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      console.log('🔄 Submitting Google OAuth completion with data:', {
        email: googleUserData.email,
        firstName: googleUserData.firstName,
        lastName: googleUserData.lastName || formData.lastName,
        companyName: formData.companyName
      });

      const result = await completeGoogleOAuth({
        variables: {
          input: {
            googleId: googleUserData.googleId,
            email: googleUserData.email,
            firstName: googleUserData.firstName,
            lastName: googleUserData.lastName || formData.lastName, // Use form data if Google didn't provide it
            profilePicture: googleUserData.profilePicture,
            middleName: formData.middleName,
            companyName: formData.companyName,
            companyAddress: formData.companyAddress,
            contactNumber: formData.contactNumber,
            houseAddress: formData.houseAddress,
          }
        }
      });

      console.log('📥 Google OAuth completion response:', result.data);

      if (result.data?.completeGoogleOAuthProfile?.token && result.data?.completeGoogleOAuthProfile?.user) {
        const { token, user: userRaw } = result.data.completeGoogleOAuthProfile;
        
        // Store token
        localStorage.setItem('userToken', token);
        localStorage.setItem('keepLoggedIn', 'true');
        localStorage.setItem('loginTimestamp', Date.now().toString());

        // Create user object
        const user = {
          userId: userRaw.id,
          email: userRaw.email,
          role: userRaw.role,
          isEmailVerified: userRaw.isEmailVerified,
          firstName: userRaw.firstName,
          middleName: userRaw.middleName,
          lastName: userRaw.lastName,
          houseAddress: userRaw.houseAddress,
          companyName: userRaw.companyName,
          companyAddress: userRaw.companyAddress,
          contactNumber: userRaw.contactNumber,
          profilePicture: userRaw.profilePicture,
        };

        // Set user in context
        setUser(user);
        setUserEmail(user.email);

        // Store user data in localStorage (same as regular login)
        localStorage.setItem('user', JSON.stringify(user));

        // Clear session storage
        sessionStorage.removeItem('googleOAuthData');

        // Navigate to dashboard
        navigate('/dashboard');
      } else {
        throw new Error('Failed to complete Google OAuth profile');
      }
    } catch (error: any) {
      console.error('Error completing profile:', error);
      setErrors({ submit: error.message || 'Failed to complete profile' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-2xl"
      >
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full overflow-hidden">
            {googleUserData.profilePicture ? (
              <img 
                src={googleUserData.profilePicture} 
                alt="Profile" 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-blue-500 flex items-center justify-center text-white text-2xl font-bold">
                {googleUserData.firstName[0]}{googleUserData.lastName[0]}
              </div>
            )}
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Complete Your Profile
          </h1>
          <p className="text-gray-600">
            Welcome, {googleUserData.firstName}! Please provide additional information to complete your account setup.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Pre-filled Google Data */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">Information from Google</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Name:</span>
                <span className="ml-2 text-gray-600">
                  {googleUserData.firstName} {googleUserData.lastName || '(Last name not provided)'}
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Email:</span>
                <span className="ml-2 text-gray-600">{googleUserData.email}</span>
              </div>
            </div>
          </div>

          {/* Required Fields */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Required Information</h3>
            
            {/* Middle Name (Optional) */}
            <div>
              <label htmlFor="middleName" className="block text-sm font-medium text-gray-700 mb-1">
                Middle Name (Optional)
              </label>
              <input
                type="text"
                id="middleName"
                name="middleName"
                value={formData.middleName}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your middle name"
              />
            </div>

            {/* Last Name - Required if not provided by Google */}
            {!googleUserData.lastName && (
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.lastName ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter your last name"
                  required
                />
                {errors.lastName && (
                  <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
                )}
              </div>
            )}

            {/* Company Name */}
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
                Company/Business Name *
              </label>
              <input
                type="text"
                id="companyName"
                name="companyName"
                value={formData.companyName}
                onChange={handleInputChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.companyName ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter your company or business name"
                required
              />
              {errors.companyName && (
                <p className="mt-1 text-sm text-red-600">{errors.companyName}</p>
              )}
            </div>

            {/* Company Address */}
            <div>
              <label htmlFor="companyAddress" className="block text-sm font-medium text-gray-700 mb-1">
                Company/Business Address *
              </label>
              <textarea
                id="companyAddress"
                name="companyAddress"
                value={formData.companyAddress}
                onChange={handleInputChange}
                rows={3}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.companyAddress ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter your complete company or business address"
                required
              />
              {errors.companyAddress && (
                <p className="mt-1 text-sm text-red-600">{errors.companyAddress}</p>
              )}
            </div>

            {/* Contact Number */}
            <div>
              <label htmlFor="contactNumber" className="block text-sm font-medium text-gray-700 mb-1">
                Contact Number *
              </label>
              <input
                type="tel"
                id="contactNumber"
                name="contactNumber"
                value={formData.contactNumber}
                onChange={handleInputChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.contactNumber ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="09XXXXXXXXX or +639XXXXXXXXX"
                required
              />
              {errors.contactNumber && (
                <p className="mt-1 text-sm text-red-600">{errors.contactNumber}</p>
              )}
            </div>

            {/* House Address (Optional) */}
            <div>
              <label htmlFor="houseAddress" className="block text-sm font-medium text-gray-700 mb-1">
                House Address (Optional)
              </label>
              <textarea
                id="houseAddress"
                name="houseAddress"
                value={formData.houseAddress}
                onChange={handleInputChange}
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your house address (optional)"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors ${
              isSubmitting
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Completing Profile...
              </div>
            ) : (
              'Complete Profile & Continue'
            )}
          </button>

          {errors.submit && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}
        </form>
      </motion.div>
    </div>
  );
};

export default GoogleOAuthCompletion;
