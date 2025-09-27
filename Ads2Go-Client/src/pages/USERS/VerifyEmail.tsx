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
    const sanitizedValue = e.target.value.replace(/\D/g, '').slice(0, 1);
    const newCode = [...code];
    newCode[index] = sanitizedValue;
    setCode(newCode);
    if (sanitizedValue && index < 5) inputRefs.current[index + 1]?.focus();
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
      if (inputRefs.current[i + 1]) inputRefs.current[i + 1].focus();
    }
    setCode(newCode);
  };

  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    try {
      const { data } = await verifyEmail({ variables: { code: code.join('') } });
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
    <div
      className="relative flex items-center justify-center min-h-screen bg-cover bg-center"
      style={{ backgroundImage: "url('/image/login.png')" }}
    >
      {/* Overlay for better contrast */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-lg" />

      {/* Centered Form */}
      <div className="relative z-10 w-full max-w-md px-8 py-10 bg-white/40 rounded-xl shadow-2xl">
        <form onSubmit={handleVerification}>
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white">Email Verification</h2>
            <p className="text-sm text-white/70 mt-1">
              Enter the 6-digit code sent to your email.
            </p>
          </div>

          {/* Code Inputs */}
          <div className="mb-6">
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
                  className="w-12 h-12 text-2xl text-center border-2 border-gray-300 rounded-lg shadow-sm outline-none bg-white/90"
                />
              ))}
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="text-red-500 text-sm mb-4 flex items-center justify-center">
              <ExclamationCircleIcon className="h-5 w-5 mr-2" />
              {error}
            </div>
          )}

          {successMessage && (
            <div className="text-green-600 text-sm mb-4 flex items-center justify-center">
              <CheckCircleIcon className="h-5 w-5 mr-2" />
              {successMessage}
            </div>
          )}

          {/* Verify Button */}
          <button
            type="submit"
            disabled={code.join('').length !== 6 || verifyLoading}
            className={`w-full py-2 px-4 rounded font-semibold focus:outline-none transition-colors ${
              code.join('').length === 6 && !verifyLoading
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {verifyLoading ? 'Verifying...' : 'Verify'}
          </button>

          {/* Resend Code */}
          <div className="text-center mt-10">
            <p className="text-sm text-white">
              Didn&apos;t receive the code?{' '}
              <button
                type="button"
                onClick={handleResendCode}
                disabled={!canResend || resendLoading}
                className={`font-semibold ${
                  canResend && !resendLoading
                    ? 'text-white hover:text-blue-500'
                    : 'text-white/70 cursor-not-allowed'
                }`}
              >
                {resendLoading
                  ? 'Sending...'
                  : canResend
                  ? 'Resend Code'
                  : `Resend in ${countdown}s`}
              </button>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VerifyEmail;
