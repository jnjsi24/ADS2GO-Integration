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
    <div className="relative flex min-h-screen items-center justify-center bg-[#fdfdfd]">
      {/* Background Image */}
      <img
        src="/image/login.png"
        alt="Login background"
        className="absolute top-0 left-0 w-1/2 h-full object-cover hidden md:block"
      />

      {/* Form Container (in front) */}
      <div className="relative z-10 w-full md:w-1/2 h-screen flex flex-col justify-center items-center">
        <div className="p-20 rounded-2xl shadow-2xl bg-white h-full w-[85%] md:w-[790px] translate-x-56 ml-72">
        
          {/* Form */}
          <form className="space-y-6" onSubmit={handleSubmit}>
            <h1 className="text-4xl font-extrabold text-black mb-6 mt-16">Log in</h1>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-md font-bold text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border-b border-gray-300 focus:border-blue-500 focus:outline-none py-2"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-md font-bold text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border-b border-gray-300 focus:border-blue-500 focus:outline-none py-2"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-2"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-gray-500" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-gray-500" />
                  )}
                </button>
              </div>
            </div>
            
            {/* Error */}
            {error && <p className="text-red-500 text-sm">{error}</p>}

            {/* Terms & Privacy */}
            <div className="flex items-center space-x-2 text-sm">
              <input type="checkbox" id="terms" className="h-4 w-4 text-blue-500" />
              <label htmlFor="terms" className="text-gray-600">
                I agree to the{' '}
                <a href="#" className="text-blue-500 hover:underline">terms of service</a> and{' '}
                <a href="#" className="text-blue-500 hover:underline">privacy policy</a>.
              </label>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoggingIn}
              className={`w-full py-3 px-4 rounded-full transition-colors ${
                isLoggingIn ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              } text-white font-semibold`}
            >
              {isLoggingIn ? (
                <div className="flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Logging in...
                </div>
              ) : (
                'Log in'
              )}
            </button>

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
              <span className="text-gray-700">Don't have an account?</span>{' '}
              <a href="/register" className="text-blue-600 hover:underline">Sign up</a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
