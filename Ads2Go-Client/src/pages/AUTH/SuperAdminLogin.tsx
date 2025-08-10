import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@apollo/client';
import { useAuth } from '../../contexts/AuthContext';
import { LOGIN_ADMIN_MUTATION } from '../../graphql/mutations/LoginAdmin';

const SuperAdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [loginAdmin, { loading }] = useMutation(LOGIN_ADMIN_MUTATION, {
    onCompleted: (data) => {
      if (data?.loginAdmin?.token) {
        localStorage.setItem('token', data.loginAdmin.token);
        localStorage.setItem('role', data.loginAdmin.user.role || 'SUPERADMIN'); // from backend

        setUser({ ...data.loginAdmin.user }); // use backend role

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

    loginAdmin({ variables: { email, password, deviceInfo } });
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Video Background */}
      <video
        className="absolute inset-0 w-full h-full object-cover"
        src="/image/video.mp4"
        autoPlay
        loop
        muted
      />
      {/* Semi-transparent overlay to make the form more readable */}
      <div className="absolute inset-0"></div>

      {/* Login Form Container */}
      <div className="relative z-10 flex min-h-screen items-center justify-end px-36 py-8 ">
        <form
          onSubmit={handleSubmit}
          className="bg-white p-8 rounded-3xl shadow-lg w-full max-w-md h-[400px]"
        >
          <h2 className="text-2xl font-bold mb-16 text-center">Super Admin Login</h2>

          {errorMsg && (
            <div className="mb-4 text-red-600 text-center font-semibold">{errorMsg}</div>
          )}

          <label className="block mb-2 font-semibold" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full p-2 border border-gray-300 rounded-lg mb-4"
          />

          <label className="block mb-2 font-semibold" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full p-2 border border-gray-300 rounded-lg mb-6"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-700 text-white py-2 rounded-lg hover:bg-blue-800 disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SuperAdminLogin;