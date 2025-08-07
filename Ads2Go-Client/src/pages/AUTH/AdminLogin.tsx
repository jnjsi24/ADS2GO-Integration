import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LOGIN_ADMIN_MUTATION } from '../../graphql/mutations/LoginAdmin'; // ✅ UPDATED

const AdminLogin: React.FC = () => {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const [loginAdmin, { loading }] = useMutation(LOGIN_ADMIN_MUTATION, {
    onCompleted(data) {
      const { token, user } = data.loginAdmin;

      if (!user || (user.role?.toUpperCase() !== 'ADMIN' && user.role?.toUpperCase() !== 'SUPERADMIN')) {
        setError('You are not authorized to access the admin panel.');
        return;
      }

      localStorage.setItem('token', token);
      setUser(user);
      navigate('/admin');
    },
    onError(err) {
      console.error('Admin login error:', err);
      setError(err.message || 'Login failed. Please try again.');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const deviceInfo = {
      deviceId: 'admin-web-client',
      deviceType: 'web',
      deviceName: navigator.userAgent,
    };

    loginAdmin({ variables: { email, password, deviceInfo } });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A192F] px-4">
      <div className="bg-white rounded-2xl shadow-xl p-12 w-full max-w-xl">
        <div className="text-center mb-10">
          <img alt="Ads2Go Logo" className="mx-auto my-5 w-32 h-32" />
          <h2 className="text-xl font-semibold text-gray-800">Admin Login</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-gray-700 font-semibold mb-2 text-lg">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-6 py-4 rounded-lg bg-[#CBF3F0] text-black placeholder:text-black text-base focus:outline-none"
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
                className="w-full px-6 py-4 rounded-lg bg-[#CBF3F0] text-black placeholder:text-black text-base focus:outline-none"
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
            disabled={loading}
            className="w-full py-3 rounded-lg bg-[#0A192F] text-white text-lg font-bold hover:bg-[#091a2c] transition disabled:bg-gray-400"
          >
            {loading ? (
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
