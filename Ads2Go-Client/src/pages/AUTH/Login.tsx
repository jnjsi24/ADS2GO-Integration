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
        // Login successful - the UserAuthContext will handle navigation
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
    <div className="relative flex min-h-screen bg-[#fdfdfd]">
      {/* Video Background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed top-1/2 left-1 -translate-y-1/2 w-[60vw] h-auto object-cover"
      >
        <source src="/image/login.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      
      {/* Dark overlay for video */}
      <div className="absolute inset-0"></div>

      {/* Form Container */}
      <div className="relative z-10 w-full max-w-xl ml-auto mr-12 flex flex-col justify-center px-10">
        <div className="p-8 rounded-xl shadow-2xl bg-[#fdfdfd]">
          <div className="flex items-center space-x-2 mb-6">
            <h1 className="text-5xl font-extrabold text-black">Log in</h1>
          </div>

          {/* Social Sign-in Buttons */}
          <div className="flex space-x-2 mb-6">
            <button
              type="button"
              className="flex-1 flex items-center justify-center py-2 px-4 border border-gray-300 rounded-lg shadow-sm bg-white hover:bg-gray-100 transition"
            >
              <img
                src="/image/g.png"
                alt="Google logo"
                className="h-5 w-5 mr-2"
              />

              <span>Sign in with Google</span>
            </button>
            <button
              type="button"
              className="py-2 px-3 border border-gray-300 rounded-lg shadow-sm bg-white hover:bg-gray-100 transition"
            >
             <img
                src="/image/f.png"
                alt="Facebook logo"
                className="h-5 w-5"
              />

            </button>
            <button
              type="button"
              className="py-2 px-3 border border-gray-300 rounded-lg shadow-sm bg-white hover:bg-gray-100 transition"
            >
              <img src="https://upload.wikimedia.org/wikipedia/commons/c/ce/X_logo_2023.svg" alt="X logo" className="h-5 w-5" />
            </button>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-md text-gray-700 font-semibold mb-1">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-400 rounded-xl shadow-lg focus:outline-none"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="password" className="block text-md text-gray-700 font-semibold">
                  Password
                </label>
                <Link to="/forgot-password" className="text-blue-500 hover:underline text-sm font-semibold">
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-400 rounded-xl shadow-lg focus:outline-none"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-3 flex items-center"
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

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={isLoggingIn}
              className={`w-full py-3 px-4 rounded-lg shadow-md transition-colors ${
                isLoggingIn ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#FF9800] hover:bg-[#FF9B45]'
              } text-white font-semibold text-lg`}
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
            <div className="text-center mt-6">
              <span className="text-gray-800">Don't have an account?</span>
              <button onClick={handleRegisterClick} className="text-blue-600 ml-1 hover:underline">
                Sign up
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;