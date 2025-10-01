import React, { useState } from 'react';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { useNavigate } from 'react-router-dom';

const AdminLogin: React.FC = () => {
  const { loginAdmin } = useAdminAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Minimal validation structure to support conditional styles (optional)
  const [validationErrors, setValidationErrors] = useState<{ email?: string; password?: string }>({});

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (validationErrors.email) {
      setValidationErrors((prev) => ({ ...prev, email: undefined }));
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (validationErrors.password) {
      setValidationErrors((prev) => ({ ...prev, password: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoggingIn(true);

    try {
      const admin = await loginAdmin(email, password);
      if (admin) {
        console.log('Admin login successful:', admin);
        // The AdminAuthContext will handle navigation
      } else {
        setError('Login failed. Please check your credentials.');
      }
    } catch (error: any) {
      console.error('Admin login error:', error);
      setError(error.message || 'Login failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div
      className="relative flex items-center justify-center min-h-screen bg-cover bg-center"
      style={{ backgroundImage: "url('/image/login.png')" }}
    >
      {/* Overlay for a subtle darkening effect */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-lg" />
  
      {/* Form Container */}
      <div className="relative z-10 w-full max-w-md px-8 py-10 bg-white/40 rounded-xl shadow-2xl">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <img 
              src="/image/Ads2GoLogoText.png" 
              alt="Ads2Go Logo" 
              className="h-16 w-auto object-contain"
            />
          </div>
          <h1 className="text-3xl font-extrabold text-white">Admin Log in</h1>
        </div>
  
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email with floating label */}
          <div className="relative mt-2">
            <input
              type="email"
              id="email"
              placeholder=" "
              required
              value={email}
              onChange={handleEmailChange}
              autoComplete="email"
              className={`peer w-full px-0 pt-5 pb-2 text-white border-b bg-transparent focus:outline-none focus:border-blue-500 focus:ring-0 placeholder-transparent transition ${validationErrors.email ? 'border-red-400' : 'border-gray-300'}`}
              style={{ backgroundColor: 'transparent' }}
            />
            <label
              htmlFor="email"
              className={`absolute left-0 bg-transparent text-black/80 transition-all duration-200 ${email ? '-top-2 text-sm text-black font-bold' : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-black/80'} peer-focus:-top-2 peer-focus:text-sm peer-focus:text-black/80 peer-focus:font-bold`}
            >
              Enter your email
            </label>
            {validationErrors.email && (
              <p className="text-red-500 text-xs mt-1">{validationErrors.email}</p>
            )}
          </div>

          {/* Password with floating label */}
          <div className="relative mt-6">
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              placeholder=" "
              required
              value={password}
              onChange={handlePasswordChange}
              autoComplete="current-password"
              className={`peer w-full pr-8 text-white px-0 pt-5 pb-2 border-b bg-transparent focus:outline-none focus:border-blue-500 focus:ring-0 placeholder-transparent transition ${validationErrors.password ? 'border-red-400' : 'border-gray-300'}`}
              style={{ backgroundColor: 'transparent' }}
            />
            <label
              htmlFor="password"
              className={`absolute left-0 bg-transparent text-black/80 transition-all duration-200 ${password ? '-top-2 text-sm text-black font-bold' : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-black/80'} peer-focus:-top-2 peer-focus:text-sm peer-focus:text-black/80 peer-focus:font-bold`}
            >
              Enter your password
            </label>
            <button
              type="button"
              className="absolute right-0 bottom-2 flex items-center"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeSlashIcon className="h-5 w-5 text-gray-200" />
              ) : (
                <EyeIcon className="h-5 w-5 text-gray-200" />
              )}
            </button>
            {validationErrors.password && (
              <p className="text-red-500 text-xs mt-1">{validationErrors.password}</p>
            )}
          </div>
  
          {error && <p className="text-red-500 text-sm">{error}</p>}
  
          <button
            type="submit"
            disabled={isLoggingIn}
            className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold transition disabled:bg-gray-400"
          >
            {isLoggingIn ? (
              <div className="flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Logging in...
              </div>
            ) : (
              "LOGIN"
            )}
          </button>
        </form>
      </div>
    </div>
  );
  
};

export default AdminLogin;
