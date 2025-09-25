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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-black/30 to-gray-200">
      {/* Form Container */}
      <div className="w-full max-w-md p-10">
        <h1 className="text-4xl font-bold text-black mb-6 text-center">Admin Log in</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
        {/* Email */}
        <div className="relative">
          <input
            type="email"
            id="email"
            placeholder=" " // keep placeholder empty for peer
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`peer w-full px-0 pt-5 pb-2 border-b bg-transparent focus:outline-none focus:border-blue-500 transition ${
              error ? 'border-red-400' : 'border-gray-400'
            }`}
          />
          <label
            htmlFor="email"
            className={`absolute left-0 text-black transition-all duration-200 ${
              email
                ? '-top-2 text-sm text-black font-bold'
                : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-black'
            } peer-focus:-top-2 peer-focus:text-sm peer-focus:text-black peer-focus:font-bold`}
          >
            Email
          </label>
          {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </div>

        {/* Password */}
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            id="password"
            placeholder=" "
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`peer w-full px-0 pt-5 pb-2 border-b bg-transparent focus:outline-none focus:border-blue-500 transition ${
              error ? 'border-red-400' : 'border-gray-400'
            }`}
          />
          <label
            htmlFor="password"
            className={`absolute left-0 text-black transition-all duration-200 ${
              password
                ? '-top-2 text-sm text-black font-bold'
                : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-black'
            } peer-focus:-top-2 peer-focus:text-sm peer-focus:text-black peer-focus:font-bold`}
          >
            Password
          </label>
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

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoggingIn}
          className="w-full py-2 bg-[#0A192F] text-white text-lg font-bold hover:bg-[#091a2c] transition disabled:bg-gray-400"
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
  );
};

export default AdminLogin;