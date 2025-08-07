import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LOGIN_MUTATION } from '../../graphql/mutations/Login';

const SadminLogin: React.FC = () => {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const [login, { loading }] = useMutation(LOGIN_MUTATION, {
    onCompleted(data) {
      const { token, user } = data.login;

      // Ensure the user is a SUPERADMIN
      if (!user || user.role?.toUpperCase() !== 'SUPERADMIN') {
        setError('You are not authorized to access the SuperAdmin panel.');
        localStorage.removeItem('token');
        setUser(null);
        return;
      }

      localStorage.setItem('token', token);
      setUser(user);
      navigate('/sadmin-dashboard');
    },
    onError(err) {
      console.error('SuperAdmin login error:', err);
      setError(err.message || 'Login failed. Please try again.');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const deviceInfo = {
      userAgent: navigator.userAgent,
      ip: '127.0.0.1', // You can replace this with a real IP from backend if needed
      platform: navigator.platform || 'unknown',
    };

    try {
      await login({
        variables: {
          input: {
            email,
            password,
            deviceInfo,
          },
        },
      });
    } catch (err) {
      console.error('Unexpected login error:', err);
    }
  };

  return (
    <div className="min-h-screen flex items-center relative overflow-hidden">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0"
        src="/image/video.mp4"
      >
        Your browser does not support the video tag.
      </video>

      <div className="absolute inset-0 bg-black opacity-0 z-10"></div>

      <div className="absolute top-14 right-20 z-30">
        <span className="text-[#3674B5] text-4xl font-bold">Ads 2 Go</span>
      </div>

      <div className="absolute right-20 top-1/2 transform -translate-y-1/2 bg-white rounded-3xl shadow-xl p-6 h-3/5 w-full max-w-lg z-20">
        <div className="text-left mb-8">
          <div className="flex justify-between items-center mb-2">
            <h1 className="text-4xl font-bold text-gray-900">Sign in</h1>
            <div className="flex items-center space-x-2 text-gray-500 text-sm">
              <span>Sign with</span>
              <img src="https://www.google.com/favicon.ico" alt="Google icon" className="w-5 h-5 rounded-full" />
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-gray-700 text-sm font-medium mb-2">
              Username or email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-5 py-3 rounded-xl bg-gray-100 border border-gray-200 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Omar@beyond.com"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label htmlFor="password" className="block text-gray-700 text-sm font-medium">
                Password
              </label>
              <button type="button" className="text-blue-600 text-xs font-medium hover:underline">
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-3 rounded-xl bg-gray-100 border border-gray-200 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="absolute inset-y-0 right-4 flex items-center text-gray-500 hover:text-gray-700"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#3674B5] text-white text-lg font-semibold hover:bg-[#0E2A47] transition-colors duration-200 disabled:bg-blue-300 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Logging in...
              </div>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        <div className="text-center mt-8">
          <p className="text-gray-500 text-sm">
            Don't have account?{' '}
            <a href="#" className="text-blue-600 font-medium hover:underline">
              Sign up
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SadminLogin;
