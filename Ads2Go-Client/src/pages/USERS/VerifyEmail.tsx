import React, { useState, useEffect, useRef } from 'react';
import { useMutation } from '@apollo/client';
import { VERIFY_EMAIL_MUTATION, RESEND_VERIFICATION_CODE_MUTATION } from '../../graphql/user';
import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { useUserAuth } from '../../contexts/UserAuthContext';

const VerifyEmail: React.FC = () => {
  const [code, setCode] = useState<string[]>(new Array(6).fill(''));
  const inputRefs = useRef<HTMLInputElement[]>([]);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const { navigate, setUser, setUserEmail, userEmail, debugToken } = useUserAuth();

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const { value } = e.target;
    // Allow only one character and digits
    const sanitizedValue = value.replace(/\D/g, '').slice(0, 1);

    const newCode = [...code];
    newCode[index] = sanitizedValue;
    setCode(newCode);

    if (sanitizedValue && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').slice(0, 6).replace(/\D/g, '');
    const newCode = [...code];
    for (let i = 0; i < pasteData.length; i++) {
      newCode[i] = pasteData[i];
      if (inputRefs.current[i + 1]) {
        inputRefs.current[i + 1].focus();
      }
    }
    setCode(newCode);
  };

  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    try {
      const { data } = await verifyEmail({
        variables: { code: code.join('') } // ✅ use joined string
      });

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
    <div className="relative min-h-screen">
      {/* Video Background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src="/image/verify.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>

      {/* Overlay to darken the video and make text readable */}
      <div className="absolute inset-0"></div>

      <div className="relative z-10 p-10 top-14 left-80 max-w-lg w-full space-y-8">
        <form onSubmit={handleVerification} className="bg-none px-8 pt-6 pb-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold">Email Verification</h2>
          </div>
          <div className="mb-4">
            <div className="flex justify-between items-center space-x-2">
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={el => (inputRefs.current[index] = el!)}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleInputChange(e, index)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  onPaste={handlePaste}
                  className="w-12 h-12 text-2xl text-center border-2 border-gray-300 rounded-lg shadow-sm focus:border-[#FF9800] focus:ring-[#FF9800] outline-none"
                />
              ))}
            </div>
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
            disabled={code.join('').length !== 6 || verifyLoading}
            className={`w-full py-2 px-4 rounded focus:outline-none focus:shadow-outline ${
              code.join('').length === 6 && !verifyLoading
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