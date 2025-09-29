import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@apollo/client';
import { exchangeCodeForToken, getGoogleUserInfo } from '../../config/googleOAuth';
import { COMPLETE_GOOGLE_OAUTH_MUTATION } from '../../graphql/user/mutations/CompleteGoogleOAuth';

const GoogleOAuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [completeGoogleOAuth] = useMutation(COMPLETE_GOOGLE_OAUTH_MUTATION);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        console.log('🔄 Processing Google OAuth callback...');

        // Get authorization code from URL
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');

        if (error) {
          console.error('❌ OAuth error:', error);
          setError(`OAuth error: ${error}`);
          setIsProcessing(false);
          return;
        }

        if (!code) {
          console.error('❌ No authorization code received');
          setError('No authorization code received from Google');
          setIsProcessing(false);
          return;
        }

        console.log('✅ Authorization code received, exchanging for token...');

        // Exchange code for access token
        const tokenResponse = await exchangeCodeForToken(code);
        console.log('✅ Token exchange successful');

        // Get user info from Google
        const userInfo = await getGoogleUserInfo(tokenResponse.access_token);
        console.log('✅ User info retrieved:', userInfo);

        // Extract user data from Google response
        const googleUserData = {
          email: userInfo.email,
          firstName: userInfo.given_name || '',
          lastName: userInfo.family_name || '',
          profilePicture: userInfo.picture || '',
          isEmailVerified: userInfo.verified_email,
          googleId: userInfo.id,
          authProvider: 'google'
        };

        // Check if user already exists by attempting to complete OAuth
        try {
          console.log('🔍 Checking if user already exists...');
          const checkResult = await completeGoogleOAuth({
            variables: {
              input: {
                googleId: googleUserData.googleId,
                email: googleUserData.email,
                firstName: googleUserData.firstName,
                lastName: googleUserData.lastName,
                profilePicture: googleUserData.profilePicture,
                middleName: '', // Empty for existing user check
                companyName: 'Google', // Placeholder
                companyAddress: 'Google', // Placeholder
                contactNumber: '09123456789', // Placeholder
                houseAddress: '', // Optional
              }
            }
          });

          if (checkResult.data?.completeGoogleOAuthProfile?.token && checkResult.data?.completeGoogleOAuthProfile?.user) {
            console.log('✅ User already exists, logging in directly');
            const { token, user: userRaw } = checkResult.data.completeGoogleOAuthProfile;
            
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

            // Store user data in localStorage
            localStorage.setItem('user', JSON.stringify(user));

            // Clear session storage
            sessionStorage.removeItem('googleOAuthData');

            // Navigate to dashboard
            navigate('/dashboard');
            return;
          }
        } catch (checkError) {
          console.log('🆕 User does not exist, proceeding to completion form');
        }

        // Store Google user data temporarily for the completion form
        console.log('🔄 Storing Google OAuth data:', googleUserData);
        sessionStorage.setItem('googleOAuthData', JSON.stringify(googleUserData));

        // Redirect to completion form
        console.log('🔄 Redirecting to completion form...');
        navigate('/auth/google/complete');

      } catch (error: any) {
        console.error('❌ OAuth callback error:', error);
        setError(error.message || 'Failed to complete Google authentication');
        setIsProcessing(false);
      }
    };

    handleOAuthCallback();
  }, [searchParams, navigate]);

  if (isProcessing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Processing Google Sign-In</h1>
          <p className="text-gray-600">
            Please wait while we complete your Google authentication...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Authentication Failed</h1>
          <p className="text-gray-600 mb-6">
            {error}
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

  return null;
};

export default GoogleOAuthCallback;
