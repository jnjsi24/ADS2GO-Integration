import React, { useState, useCallback } from 'react';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { Link } from 'react-router-dom';
import {EyeIcon, EyeOff, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Login: React.FC = () => {
  const { navigateToRegister, login } = useUserAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [checked, setChecked] = useState(false);


  const [validationErrors, setValidationErrors] = useState({
    email: '',
    password: ''
  });

  const validateForm = () => {
    const errors = {
      email: '',
      password: ''
    };

    if (!email.trim()) {
      errors.email = 'Please enter your email address';
    }

    if (!password.trim()) {
      errors.password = 'Please enter your password';
    }

    setValidationErrors(errors);
    return !errors.email && !errors.password;
  };

  // Helper function to store user data in multiple formats for compatibility
  const storeUserData = (user: any) => {
    try {
      // Store the original user object
      localStorage.setItem('user', JSON.stringify(user));
      
      // Also store in common alternative keys for better compatibility
      localStorage.setItem('currentUser', JSON.stringify(user));
      localStorage.setItem('authData', JSON.stringify(user));
      
      // Store just the first name separately for easy access
      const firstName = user.firstName || user.first_name || user.name?.split(' ')[0] || user.displayName?.split(' ')[0] || 'User';
      localStorage.setItem('userFirstName', firstName);
      
      // Also store in sessionStorage as backup
      sessionStorage.setItem('user', JSON.stringify(user));
      sessionStorage.setItem('userFirstName', firstName);
      
      console.log('User data stored successfully:', {
        user,
        firstName,
        storageKeys: ['user', 'currentUser', 'authData', 'userFirstName']
      });
      
    } catch (error) {
      console.error('Error storing user data:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Clear previous validation errors
    setValidationErrors({ email: '', password: '' });

    // Validate form before proceeding
    if (!validateForm()) {
      return;
    }

    setIsLoggingIn(true);

    try {
      const user = await login(email, password);
      if (user) {
        // Store user data immediately after successful login
        storeUserData(user);
        
        // Login successful - the UserAuthContext will handle navigation
        console.log('Login successful, user:', user);
      } else {
        setError('Login failed. Please check your credentials.');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      
      // If backend returns a user in error (unlikely), ignore storing and show error instead
      setError(error.message || 'Login failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    // Clear email validation error when user starts typing
    if (validationErrors.email) {
      setValidationErrors(prev => ({ ...prev, email: '' }));
    }
  };

  
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    // Clear password validation error when user starts typing
    if (validationErrors.password) {
      setValidationErrors(prev => ({ ...prev, password: '' }));
    }
  };

  const handleRegisterClick = useCallback(() => {
    navigateToRegister();
  }, [navigateToRegister]);

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center"
      style={{ backgroundImage: "url('/image/login.png')" }}
      
    >
      <div className="absolute inset-0 bg-black bg-opacity-40 z-0"></div>

      <div className="relative z-10 p-8 sm:p-10 
                rounded-xl shadow-2xl w-full max-w-xl
                bg-white/20 backdrop-blur-lg border border-white/30">
        <h1 className="text-5xl font-bold text-center mb-6 text-white">
          Login
        </h1>
        <p className="text-sm text-center text-white mb-6">
          Please enter your login details to log in.
        </p>
        
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
         <div className="relative mt-10">
            <input
              type="email"
              id="email"
              placeholder=""
              required
              value={email}
              onChange={handleEmailChange}
              className={`peer w-full px-0 pt-5 pb-2 border-b bg-transparent focus:outline-none focus:border-blue-500 focus:ring-0placeholder-transparent transition ${validationErrors.email ? 'border-red-400' : 'border-gray-300'}`}
            />
            <label
              htmlFor="email"
              className={`absolute left-0 text-white bg-transparent transition-all duration-200 ${email
                ? '-top-2 text-sm text-black font-bold' // 👈 If input has value, stay floated
                : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-white'} peer-focus:-top-2 peer-focus:text-sm peer-focus:text-white peer-focus:font-bold`}
            >
              Enter your email 
            </label>
            {validationErrors.email && (
              <p className="text-red-500 text-xs mt-1">{validationErrors.email}</p>
            )}
          </div>

          <div>
            <div className="relative mt-8">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                placeholder=" "
                required
                value={password}
                onChange={handlePasswordChange}
                className={`peer w-full pr-8 pt-5 pb-2 border-b bg-transparent focus:outline-none focus:border-blue-500 focus:ring-0 placeholder-transparent transition ${validationErrors.password ? 'border-red-400' : 'border-gray-300'}`}
              />

              <label
                htmlFor="password"
                className={`absolute left-0 text-white transition-all duration-200 ${password
                  ? '-top-2 text-sm text-white font-bold'
                  : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-white'} peer-focus:-top-2 peer-focus:text-sm peer-focus:text-white peer-focus:font-bold`}
              >
                Enter your password
              </label>

              {/* 👁 Single Show/Hide Button */}
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}   // ✅ toggle visibility
                className="absolute inset-y-0 right-0 flex items-center px-2 cursor-pointer"
              >
                {showPassword ? (
                  <EyeIcon className="h-5 w-5 text-white" />   
                ) : (
                  <EyeOff className="h-5 w-5 text-white" />
                )}
              </button>

              {validationErrors.password && (
                <p className="text-red-500 text-xs mt-1">{validationErrors.password}</p>
              )}
            </div>

            {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

            <div className="flex justify-between items-center text-sm mt-5">
              {/* ✅ Animated checkbox with label */}
              <div
                className="flex items-center space-x-2 cursor-pointer"
                onClick={() => setChecked((prev) => !prev)}
              >
                <div
                  className="relative w-5 h-5 border-2 border-gray-400 rounded-md flex items-center justify-center transition-colors duration-200 hover:border-blue-500"
                >
                  <AnimatePresence>
                    {checked && (
                      <motion.div
                        key="check"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className="absolute text-blue-600"
                      >
                        <Check size={16} strokeWidth={3} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <span className="text-white select-none">Keep me logged in</span>
              </div>

              {/* Forgot password link */}
              <Link to="/forgot-password" className="text-[#1B5087] hover:underline">
                Forgot password?
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoggingIn}
            className={`w-full py-2 px-4 rounded-md shadow-sm transition-colors ${
              isLoggingIn
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            } text-white font-semibold`}
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
        </form>

        <div className="flex items-center my-6">
          <div className="flex-grow border-t border-gray-300"></div>
          <span className="mx-4 text-white text-sm">
            or continue with
          </span>
          <div className="flex-grow border-t border-gray-300"></div>
        </div>


        <div className="flex justify-center space-x-4">
          <button type="button" className="p-2 border border-gray-300 rounded-full hover:bg-gray-100 transition-colors">
            <img src="/image/g.png" alt="Google logo" className="h-6 w-6" />
          </button>
          <button type="button" className="p-2 border border-gray-300 rounded-full hover:bg-gray-100 transition-colors">
            <img src="/image/f.png" alt="Facebook logo" className="h-6 w-6" />
          </button>
          <button type="button" className="p-2 border border-gray-300 rounded-full hover:bg-gray-100 transition-colors">
            <img src="https://upload.wikimedia.org/wikipedia/commons/c/ce/X_logo_2023.svg" alt="X logo" className="h-6 w-6" />
          </button>
          <button
            type="button"
            className="p-2 border border-gray-300 rounded-full hover:bg-gray-100 transition-colors"
          >
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png"
              alt="Instagram logo"
              className="h-6 w-6"
            />
          </button>
        </div>

        <div className="text-center mt-6 text-sm">
          <span className="text-white">Don't have an account?</span>
          <Link to="/register" className="text-[#1B5087] ml-1 underline hover:font-semibold">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;