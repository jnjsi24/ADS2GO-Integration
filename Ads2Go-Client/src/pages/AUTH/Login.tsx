import React, { useState, useCallback } from 'react';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { Link } from 'react-router-dom';

const Login: React.FC = () => {
  const { navigateToRegister, login } = useUserAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoggingIn(true);

    try {
      const user = await login(email, password);
      if (user) {
        console.log('Login successful, user:', user);
      } else {
        setError('Login failed. Please check your credentials.');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error.message || 'Login failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRegisterClick = useCallback(() => {
    navigateToRegister();
  }, [navigateToRegister]);

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Mobile Hero Section */}
      <div className="md:hidden bg-gradient-to-r from-blue-500 to-purple-600 text-white py-8 px-6 text-center">
        <h2 className="text-2xl font-bold mb-2">Turn Every Road Into Your Billboard</h2>
        <p className="text-blue-100">Connect with your audience wherever they go</p>
      </div>

      {/* Left Panel - Visual/Promotional */}
      <div className="hidden md:flex md:w-1/2 relative bg-gradient-to-br from-blue-400 via-blue-500 to-purple-600 overflow-hidden">
        {/* Background Image */}
        <img
          src="/image/login.png"
          alt="Login background"
          className="absolute inset-0 w-full h-full object-cover opacity-80"
        />
        
        {/* Overlay with hero text */}
        <div className="relative z-10 flex flex-col justify-center items-center w-full h-full px-12">
          <div className="text-center">
            <h2 className="text-5xl md:text-6xl font-bold text-white mb-8 leading-tight">
              Turn Every Road<br />
              Into Your Billboard
            </h2>
            {/* Location pins overlay */}
            <div className="absolute top-20 left-16 w-8 h-8 text-blue-300">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
            </div>
            <div className="absolute top-32 right-20 w-6 h-6 text-blue-200">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
            </div>
            <div className="absolute bottom-32 left-24 w-7 h-7 text-blue-400">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full md:w-1/2 flex flex-col justify-center items-center bg-white px-4 sm:px-8 py-8 sm:py-12 flex-1">
        <div className="w-full max-w-md">
          {/* Form */}
          <form className="space-y-6" onSubmit={handleSubmit}>
            <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">Log in</h1>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-colors"
                placeholder="Enter your email"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-colors"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
            </div>
            
            {/* Error */}
            {error && <p className="text-red-500 text-sm">{error}</p>}

            {/* Terms & Privacy */}
            <div className="flex items-start space-x-3 text-sm">
              <input 
                type="checkbox" 
                id="terms" 
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-0.5" 
              />
              <label htmlFor="terms" className="text-gray-600 leading-relaxed">
                I agree to the{' '}
                <a href="#" className="text-blue-600 hover:underline font-medium">terms of service</a> and{' '}
                <a href="#" className="text-blue-600 hover:underline font-medium">privacy policy</a>.
              </label>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoggingIn}
              className={`w-full py-3 px-4 rounded-lg transition-all duration-200 ${
                isLoggingIn 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg transform hover:-translate-y-0.5'
              } text-white font-semibold text-base`}
            >
              {isLoggingIn ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Logging in...
                </div>
              ) : (
                'Log in'
              )}
            </button>

            {/* Social Sign-in */}
            <div className="text-center">
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">or Log in With</span>
                </div>
              </div>
              <div className="flex justify-center space-x-3 sm:space-x-4 flex-wrap">
                <button className="p-2 sm:p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0">
                  <img src="/image/g.png" alt="Google" className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
                <button className="p-2 sm:p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0">
                  <img src="/image/f.png" alt="Facebook" className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
                <button className="p-2 sm:p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0">
                  <img src="/image/i.png" alt="Instagram" className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
                <button className="p-2 sm:p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0">
                  <img src="/image/t.png" alt="Twitter" className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
                <button className="p-2 sm:p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0">
                  <img src="/image/l.png" alt="LinkedIn" className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              </div>
            </div>

            {/* Sign Up Link */}
            <div className="text-center text-sm">
              <span className="text-gray-600">Don't have an account? </span>
              <Link to="/register" className="text-blue-600 hover:underline font-medium">
                Sign up
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
