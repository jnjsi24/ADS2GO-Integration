import React, { useState, useEffect } from 'react';
import { useMutation } from '@apollo/client';
import { VERIFY_EMAIL_MUTATION, RESEND_VERIFICATION_CODE_MUTATION } from '../../services/graphql';
import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';

const VerifyEmail: React.FC = () => {
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const { navigate, setUser, setUserEmail, userEmail, debugToken } = useAuth();

  const [verifyEmail, { loading: verifyLoading }] = useMutation(VERIFY_EMAIL_MUTATION);
  const [resendVerificationCode, { loading: resendLoading }] = useMutation(RESEND_VERIFICATION_CODE_MUTATION);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  useEffect(() => {
    setError('');
    setSuccessMessage('');
  }, []);

  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    try {
      const { data } = await verifyEmail({ variables: { code: verificationCode } });

      if (data?.verifyEmail?.success) {
        const token = data.verifyEmail.token;

        if (token) {
          localStorage.setItem('token', token);
          const decoded = debugToken(token);
          if (decoded) {
            setUser(decoded);
            setUserEmail(decoded.email);
          }
        }

        setSuccessMessage('Email verified successfully! Redirecting to login...');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setError('Verification failed. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed due to a network error.');
    }
  };

  const handleResendCode = async () => {
    if (!canResend) return;

    setError('');
    setSuccessMessage('');

    try {
      const { data } = await resendVerificationCode({ variables: { email: userEmail } });

      if (data?.resendVerificationCode?.success) {
        setCountdown(60);
        setCanResend(false);
        setSuccessMessage('Verification code resent successfully!');
      } else {
        setError('Failed to resend verification code.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to resend verification code.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <form onSubmit={handleVerification} className="bg-white shadow-md rounded px-8 pt-6 pb-8">
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Enter Verification Code
            </label>
            <input
              type="text"
              maxLength={6}
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 border-gray-300 leading-tight focus:outline-none focus:shadow-outline"
              placeholder="6-digit code"
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm mb-4 flex items-center">
              <ExclamationCircleIcon className="h-5 w-5 mr-2" />
              {error}
            </div>
          )}

          {successMessage && (
            <div className="text-green-500 text-sm mb-4 flex items-center">
              <CheckCircleIcon className="h-5 w-5 mr-2" />
              {successMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={verificationCode.length !== 6 || verifyLoading}
            className={`w-full py-2 px-4 rounded focus:outline-none focus:shadow-outline ${
              verificationCode.length === 6 && !verifyLoading
                ? 'bg-blue-500 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {verifyLoading ? 'Verifying...' : 'Verify'}
          </button>

          <div className="text-center mt-4">
            <p className="text-sm text-gray-600">
              Didn't receive the code?{' '}
              <button
                type="button"
                onClick={handleResendCode}
                disabled={!canResend || resendLoading}
                className={`font-medium ${
                  canResend && !resendLoading ? 'text-blue-600 hover:text-blue-500' : 'text-gray-400 cursor-not-allowed'
                }`}
              >
                {resendLoading ? 'Sending...' : canResend ? 'Resend Code' : `Resend in ${countdown}s`}
              </button>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VerifyEmail;
