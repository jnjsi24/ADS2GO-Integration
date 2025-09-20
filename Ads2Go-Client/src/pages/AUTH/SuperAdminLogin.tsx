import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, gql } from '@apollo/client';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { LOGIN_SUPERADMIN_MUTATION } from '../../graphql/superadmin'; // ✅ UPDATED




const SuperAdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const { setAdmin } = useAdminAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loginSuperAdmin, { loading }] = useMutation(LOGIN_SUPERADMIN_MUTATION, {
    onCompleted: (data) => {
      console.log('SuperAdmin login successful:', data);
      
      if (data?.loginSuperAdmin?.token) {
        localStorage.setItem('adminToken', data.loginSuperAdmin.token);
        localStorage.setItem('role', data.loginSuperAdmin.superAdmin.role || 'SUPERADMIN'); // from backend

        // Transform the GraphQL response to match the Admin interface
        const adminData = {
          ...data.loginSuperAdmin.superAdmin,
          userId: data.loginSuperAdmin.superAdmin.id, // Map id to userId
        };
        setAdmin(adminData); // use backend role

        navigate('/sadmin-dashboard');
      } else {
        setErrorMsg('Invalid login response.');
      }
    },
    onError: (error) => {
      setErrorMsg(error.message || 'Login failed');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // You can generate a better deviceId (e.g., uuid), here is a simple placeholder:
    const deviceInfo = {
      deviceId: 'device_web_' + Date.now(),
      deviceType: 'web',
      deviceName: window.navigator.userAgent || 'browser',
    };

    loginSuperAdmin({ variables: { email, password, deviceInfo } });
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
        <source src="/image/sadmin.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      
      {/* Dark overlay for video */}
      <div className="absolute inset-0"></div>

      {/* Form Container */}
      <div className="relative z-10 w-full max-w-2xl ml-auto mr-12 flex flex-col justify-center px-10">
        <div className="p-8 rounded-xl shadow-xl bg-[#fdfdfd]">
          <div className="flex items-center space-x-2 mb-6">
            <h1 className="text-5xl font-extrabold text-black">Super Admin Log in</h1>
          </div>
        <form onSubmit={handleSubmit} className="space-y-6">
            <div>
            <label className="block text-gray-700 font-semibold mb-2 text-lg" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-400 rounded-xl shadow-lg focus:outline-none"
            />
            </div>
            
            <div>
            <label className="block text-gray-700 font-semibold mb-2 text-lg" htmlFor="password">
              Password
            </label>
            <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-400 rounded-xl shadow-lg focus:outline-none"
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

            {errorMsg && (
              <div className="mb-4 text-red-600 text-center font-semibold">{errorMsg}</div>
            )}
            <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-700 text-white py-2 rounded hover:bg-blue-800 disabled:opacity-50"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminLogin;