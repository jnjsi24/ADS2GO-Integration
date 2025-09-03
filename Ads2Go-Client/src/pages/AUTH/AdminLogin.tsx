import React, { useState } from 'react';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { useNavigate } from 'react-router-dom';

const AdminLogin: React.FC = () => {
  const { login } = useAdminAuth();
  const navigate = useNavigate();
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
      const admin = await login(email, password);
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
    <div className="relative flex min-h-screen bg-[#fdfdfd]">
      {/* Video Background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed top-1/2 left-10 -translate-y-1/2 w-[50vw] h-auto object-cover "
      >
        <source src="/image/admin.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      
      {/* Dark overlay for video */}
      <div className="absolute inset-0"></div>

      {/* Form Container */}
      <div className="relative z-10 w-full max-w-xl ml-auto mr-28 flex flex-col justify-center px-10">
        <div className="p-8 rounded-xl shadow-xl bg-[#fdfdfd]">
          <div className="flex items-center space-x-2 mb-6">
            <h1 className="text-5xl font-extrabold text-black">Admin Log in</h1>
          </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-gray-700 font-semibold mb-2 text-lg">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-400 rounded-xl shadow-lg focus:outline-none"
              placeholder="admin@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-2 text-lg">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-400 rounded-xl shadow-lg focus:outline-none"
                placeholder="••••••••••••••••••••"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="absolute inset-y-0 right-4 flex items-center"
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
            className="w-full py-3 rounded-lg bg-[#0A192F] text-white text-lg font-bold hover:bg-[#091a2c] transition disabled:bg-gray-400"
          >
            {isLoggingIn ? (
              <div className="flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Logging in...
              </div>
            ) : (
              'LOGIN'
            )}
          </button>
        </form>
      </div>
    </div>
    </div>
  );
};

export default AdminLogin;
