import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, gql } from '@apollo/client';
import { useAuth } from '../../contexts/AuthContext';
import { LOGIN_SUPERADMIN_MUTATION } from '../../graphql/superadmin'; // ✅ UPDATED




const SuperAdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [loginSuperAdmin, { loading }] = useMutation(LOGIN_SUPERADMIN_MUTATION, {
    onCompleted: (data) => {
      console.log('SuperAdmin login successful:', data);
      
      if (data?.loginSuperAdmin?.token) {
        localStorage.setItem('token', data.loginSuperAdmin.token);
        localStorage.setItem('role', data.loginSuperAdmin.superAdmin.role || 'SUPERADMIN'); // from backend

        setUser({ ...data.loginSuperAdmin.superAdmin }); // use backend role

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
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded shadow-md w-full max-w-md"
      >
        <h2 className="text-2xl font-bold mb-6 text-center">Super Admin Login</h2>

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
          className="w-full p-2 border border-gray-300 rounded mb-4"
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
          className="w-full p-2 border border-gray-300 rounded mb-6"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-700 text-white py-2 rounded hover:bg-blue-800 disabled:opacity-50"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
};

export default SuperAdminLogin;
