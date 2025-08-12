import React, { useState, useCallback } from 'react';
import { useMutation } from '@apollo/client';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { LOGIN_MUTATION } from '../../graphql/mutations/Login';

const Login: React.FC = () => {
  const { navigateToRegister, setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const [loginUser, { loading }] = useMutation(LOGIN_MUTATION, {
    onCompleted(data) {
      console.log('Login successful:', data);

      const { token, user } = data.loginUser;

      localStorage.setItem('token', token);
      setUser(user);

      if (user.role?.toUpperCase() === 'ADMIN' || user.role?.toUpperCase() === 'SUPERADMIN') {
        setError('Admin users must use the dedicated admin login page.');
        return;
      }

      if (!user.isEmailVerified) {
        navigate('/verify-email');
        return;
      }

      navigate('/dashboard');
    },
    onError(error) {
      console.error('Login error:', error);
      setError(error.message.replace('GraphQL error: ', ''));
    },
  });

  const handleRegisterClick = useCallback(() => {
    navigateToRegister();
  }, [navigateToRegister]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const deviceInfo = {
      deviceId: 'web-client',
      deviceType: 'web',
      deviceName: navigator.userAgent,
    };

    loginUser({ variables: { email, password, deviceInfo } });
  };

  return (
    <div className="flex min-h-screen bg-white">
      <div className="w-full md:w-1/2 flex flex-col justify-center px-10">
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-gray-900">
            Artificial Intelligence Driving Results For The Travel Industry
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            Welcome back! Please login to your account.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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

          <div className="flex justify-between items-center text-sm">
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" />
              Remember Me
            </label>
            <Link to="/forgot-password" className="text-indigo-600 hover:underline">
              Forgot Password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-500 hover:bg-teal-600 disabled:bg-teal-300 text-white py-2 rounded-md transition"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Logging in...
              </div>
            ) : (
              'Login'
            )}
          </button>
        </form>

        <p className="text-sm mt-4 text-gray-600">
          Don't have an account?{' '}
          <button onClick={handleRegisterClick} className="text-indigo-600 hover:underline">
            Sign Up
          </button>
        </p>
      </div>

      <div className="hidden md:flex w-1/2 flex-col relative bg-[#0e2a47]">
        <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center text-white">
          <div className="text-xl font-bold">Ads2Go</div>
          <nav className="space-x-6">
            <Link to="/" className="text-indigo-400 underline">
              Home
            </Link>
            <Link to="/about" className="hover:text-indigo-300">
              About us
            </Link>
            <Link to="/blog" className="hover:text-indigo-300">
              Blog
            </Link>
            <Link to="/pricing" className="hover:text-indigo-300">
              Pricing
            </Link>
          </nav>
        </div>
        <img src="/image/image.jpeg" alt="Scooter Advertisement" className="w-full h-full object-cover" />
      </div>
    </div>
  );
};

export default Login;
