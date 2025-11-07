import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

const SuperAdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const { loginSuperAdmin } = useAdminAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

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
    setErrorMsg('');
    setLoading(true);

    try {
      const result = await loginSuperAdmin(email, password);
      if (result) {
        // SuperAdmin login successful, navigating
        // Navigation handled by AdminAuthContext
      }
    } catch (error: any) {
      setErrorMsg(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative" style={{ minHeight: '100vh' }}>
      <style>
        {`
          input:-webkit-autofill,
          input:-webkit-autofill:hover,
          input:-webkit-autofill:focus,
          input:-webkit-autofill:active {
            -webkit-text-fill-color: white !important;
            transition: background-color 5000s ease-in-out 0s;
            caret-color: white;
            box-shadow: 0 0 0px 1000px transparent inset !important;
          }

          input:-webkit-autofill ~ label,
          input:-webkit-autofill:hover ~ label,
          input:-webkit-autofill:focus ~ label,
          input:-webkit-autofill:active ~ label {
            color: rgba(255, 255, 255, 0.7) !important;
            font-weight: bold !important;
          }
        `}
      </style>

      {/* Background Image - Fixed to cover entire viewport */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat z-0"
        style={{ 
          backgroundImage: "url('/image/L2.jpg')",
          width: '100vw',
          height: '100vh',
          zIndex: -1
        }}
      />

      {/* Dark overlay - Fixed to cover entire viewport */}
      <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-md z-0"></div>

      {/* Mobile View */}
      <div className="relative z-10 w-full px-4 py-6 md:hidden">
        <div className="max-w-md mx-auto">
          <div className="bg-white/20 backdrop-blur-lg border border-white/30 rounded-md p-6 shadow-2xl">
            <div className="flex justify-center mb-4">
              <img 
                src="/image/Ads2GoLogoText.png" 
                alt="Ads2Go Logo" 
                className="h-10 w-auto object-contain"
              />
            </div>
            <h1 className="text-3xl font-bold text-center mb-6 text-white">Super Admin Log in</h1>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative mt-2">
                <input
                  type="email"
                  id="email-mobile"
                  placeholder=" "
                  required
                  value={email}
                  onChange={handleEmailChange}
                  autoComplete="email"
                  className={`peer w-full px-0 pt-5 pb-2 text-white border-b bg-transparent focus:outline-none focus:border-blue-500 focus:ring-0 placeholder-transparent transition ${validationErrors.email ? 'border-red-400' : 'border-gray-300'}`}
                  style={{ backgroundColor: 'transparent' }}
                />
                <label
                  htmlFor="email-mobile"
                  className={`absolute left-0 text-white bg-transparent transition-all duration-200 ${email
                    ? '-top-2 text-xs text-white/70 font-bold'
                    : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-placeholder-shown:text-white'} peer-focus:-top-2 peer-focus:text-xs peer-focus:text-white/70 peer-focus:font-bold`}
                >
                  Enter your email or recovery email
                </label>
                {validationErrors.email && (
                  <p className="text-red-300 text-xs mt-1">{validationErrors.email}</p>
                )}
              </div>

              <div className="relative mt-6">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password-mobile"
                  placeholder=" "
                  required
                  value={password}
                  onChange={handlePasswordChange}
                  autoComplete="current-password"
                  className={`peer w-full pr-8 text-white px-0 pt-5 pb-2 border-b bg-transparent focus:outline-none focus:border-blue-500 focus:ring-0 placeholder-transparent transition ${validationErrors.password ? 'border-red-400' : 'border-gray-300'}`}
                  style={{ backgroundColor: 'transparent' }}
                />
                <label
                  htmlFor="password-mobile"
                  className={`absolute left-0 text-white bg-transparent transition-all duration-200 ${password
                    ? '-top-2 text-xs text-white/70 font-bold'
                    : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-placeholder-shown:text-white'} peer-focus:-top-2 peer-focus:text-xs peer-focus:text-white/70 peer-focus:font-bold`}
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
                  <p className="text-red-300 text-xs mt-1">{validationErrors.password}</p>
                )}
              </div>

              {errorMsg && <p className="text-red-300 text-xs">{errorMsg}</p>}

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-2 px-4 text-xs shadow-sm transition-colors rounded-md ${
                  loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-700 hover:bg-blue-800 active:bg-blue-900'
                } text-white font-semibold text-base`}
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Logging in...
                  </div>
                ) : (
                  'Login'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Desktop View */}
      <div className="relative z-10 p-8 sm:p-10 hidden md:flex rounded-md shadow-2xl w-full max-w-md bg-white/20 backdrop-blur-lg border border-white/30">
        <div className="w-full">
          <div className="flex justify-center mb-6">
            <img 
              src="/image/Ads2GoLogoText.png" 
              alt="Ads2Go Logo" 
              className="h-12 w-auto object-contain"
            />
          </div>
          <h1 className="text-4xl font-bold text-center mb-8 text-white">Super Admin Log in</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative mt-2">
              <input
                type="email"
                id="email-desktop"
                placeholder=" "
                required
                value={email}
                onChange={handleEmailChange}
                autoComplete="email"
                className={`peer w-full px-0 pt-5 pb-2 text-white border-b bg-transparent focus:outline-none focus:border-blue-500 focus:ring-0 placeholder-transparent transition ${validationErrors.email ? 'border-red-400' : 'border-gray-300'}`}
                style={{ backgroundColor: 'transparent' }}
              />
              <label
                htmlFor="email-desktop"
                className={`absolute left-0 text-white bg-transparent transition-all duration-200 ${email
                  ? '-top-2 text-sm text-white/70 font-bold'
                  : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-white'} peer-focus:-top-2 peer-focus:text-sm peer-focus:text-white/70 peer-focus:font-bold`}
              >
                Enter your email or recovery email
              </label>
              {validationErrors.email && (
                <p className="text-red-300 text-xs mt-1">{validationErrors.email}</p>
              )}
            </div>

            <div className="relative mt-6">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password-desktop"
                placeholder=" "
                required
                value={password}
                onChange={handlePasswordChange}
                autoComplete="current-password"
                className={`peer w-full pr-8 text-white px-0 pt-5 pb-2 border-b bg-transparent focus:outline-none focus:border-blue-500 focus:ring-0 placeholder-transparent transition ${validationErrors.password ? 'border-red-400' : 'border-gray-300'}`}
                style={{ backgroundColor: 'transparent' }}
              />
              <label
                htmlFor="password-desktop"
                className={`absolute left-0 text-white bg-transparent transition-all duration-200 ${password
                  ? '-top-2 text-sm text-white/70 font-bold'
                  : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-white'} peer-focus:-top-2 peer-focus:text-sm peer-focus:text-white/70 peer-focus:font-bold`}
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
                <p className="text-red-300 text-xs mt-1">{validationErrors.password}</p>
              )}
            </div>

            {errorMsg && <p className="text-red-300 text-sm">{errorMsg}</p>}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2 px-4 shadow-sm transition-colors rounded-md ${
                loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              } text-white font-semibold text-lg`}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Logging in...
                </div>
              ) : (
                'Login'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminLogin;
