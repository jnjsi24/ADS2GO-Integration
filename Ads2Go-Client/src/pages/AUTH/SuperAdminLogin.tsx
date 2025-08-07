import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LOGIN_ADMIN_MUTATION } from '../../graphql/mutations/LoginAdmin';

const SuperAdminLogin: React.FC = () => {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const [loginAdmin, { loading }] = useMutation(LOGIN_ADMIN_MUTATION, {
    onCompleted(data) {
      const { token, user } = data.loginAdmin;

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
      deviceId: 'superadmin-web-client',
      deviceType: 'web',
      deviceName: navigator.userAgent,
    };

    loginAdmin({ variables: { email, password, deviceInfo } });
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
            <h1 className="text-4xl font-bold text-gray-800">SuperAdmin Login</h1>
          </div>
          <p className="text-sm text-gray-500">Sign in to your SuperAdmin account</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
            />
          </div>

          <div className="mb-4 relative">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3 flex items-center"
              >
                {showPassword ? (
                  <EyeSlashIcon className="h-5 w-5 text-gray-500" />
                ) : (
                  <EyeIcon className="h-5 w-5 text-gray-500" />
                )}
              </button>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-[#3674B5] text-white font-semibold rounded-md shadow hover:bg-[#2e5f96] transition"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SuperAdminLogin;
