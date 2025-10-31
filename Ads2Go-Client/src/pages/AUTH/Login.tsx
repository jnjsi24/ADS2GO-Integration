import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { Link } from 'react-router-dom';
import {EyeIcon, EyeOff, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Login: React.FC = () => {
  const { navigateToRegister, login, loginWithGoogle } = useUserAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isGoogleLoggingIn, setIsGoogleLoggingIn] = useState(false);
  const [checked, setChecked] = useState(() => {
    // Restore checkbox state from localStorage
    return localStorage.getItem('keepLoggedIn') === 'true';
  });
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);


  const [validationErrors, setValidationErrors] = useState({
    email: '',
    password: ''
  });

  // Handle video loading and playback
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      // Ensure video plays on load
      video.addEventListener('loadeddata', () => {
        setVideoLoaded(true);
        video.play().catch(console.error);
      });
      
      // Handle video errors
      video.addEventListener('error', () => {
        console.log('Video failed to load, falling back to image background');
        setVideoLoaded(false);
        setVideoError(true);
      });
    }
  }, []);

  // Handle autofill detection
  useEffect(() => {
    const checkAutofill = () => {
      const emailInput = document.getElementById('email') as HTMLInputElement;
      const passwordInput = document.getElementById('password') as HTMLInputElement;
      
      if (emailInput && emailInput.value && !email) {
        setEmail(emailInput.value);
      }
      if (passwordInput && passwordInput.value && !password) {
        setPassword(passwordInput.value);
      }
    };

    // Check immediately
    checkAutofill();
    
    // Check after a short delay to catch autofill
    const timeoutId = setTimeout(checkAutofill, 100);
    
    // Listen for animation events that might indicate autofill
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    
    if (emailInput) {
      emailInput.addEventListener('animationstart', checkAutofill);
    }
    if (passwordInput) {
      passwordInput.addEventListener('animationstart', checkAutofill);
    }

    return () => {
      clearTimeout(timeoutId);
      if (emailInput) {
        emailInput.removeEventListener('animationstart', checkAutofill);
      }
      if (passwordInput) {
        passwordInput.removeEventListener('animationstart', checkAutofill);
      }
    };
  }, [email, password]);

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
      const user = await login(email, password, checked);
      if (user) {
        // Store user data immediately after successful login
        storeUserData(user);
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

  const handleGoogleLogin = async () => {
    try {
      setIsGoogleLoggingIn(true);
      setError('');
      
      console.log('🔄 Starting Google OAuth login...');
      const user = await loginWithGoogle();
      
      if (user) {
        console.log('✅ Google login successful, user:', user);
        // The UserAuthContext will handle navigation
      } else {
        setError('Google login failed. Please try again.');
      }
    } catch (error: any) {
      console.error('Google login error:', error);
      setError(error.message || 'Google login failed');
    } finally {
      setIsGoogleLoggingIn(false);
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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ minHeight: '100vh' }}>
      <style>
        {`
          input:-webkit-autofill,
          input:-webkit-autofill:hover,
          input:-webkit-autofill:focus,
          input:-webkit-autofill:active {
            -webkit-text-fill-color: white !important;
            transition: background-color 5000s ease-in-out 0s;
            caret-color: white;
            box-shadow: 0 0 0px 1000px transparent inset !important;
          }

          input:-webkit-autofill ~ label,
          input:-webkit-autofill:hover ~ label,
          input:-webkit-autofill:focus ~ label,
          input:-webkit-autofill:active ~ label {
            color: rgba(255, 255, 255, 0.7) !important;
            font-weight: bold !important;
          }
        `}
      </style>

      {/* Video Background */}
      {!videoError && (
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0"
          style={{
            minWidth: '100%',
            minHeight: '127%',
            width: 'auto',
            height: 'auto',
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            objectFit: 'cover',
            zIndex: -1
          }}
          poster="/image/login.png"
        >
          <source src="/image/Ads2Go.mp4" type="video/mp4" />
        </video>
      )}
      
      {/* Fallback Image Background if video fails */}
      {videoError && (
        <div 
          className="absolute inset-0 bg-cover bg-center z-0"
          style={{ 
            backgroundImage: "url('/image/login.png')",
            minWidth: '100%',
            minHeight: '100%',
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: '0',
            left: '0',
            zIndex: -1
          }}
        />
      )}
      
      {/* Dark overlay for better text readability */}
      <div className="absolute inset-0 bg-black bg-opacity-40 z-0"></div>
      
      {/* Loading indicator for video */}
      {!videoLoaded && !videoError && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
        </div>
      )}

      {/* Mobile View */}
      <div className="relative z-10 w-full px-4 py-6 md:hidden">
        <div className="max-w-md mx-auto">
          
          
          {/* Mobile Form Card */}
          <div className="bg-white/20 backdrop-blur-lg border border-white/30 rounded-md p-6 shadow-2xl">
            {/* Ads2Go Logo - Mobile */}
            <div className="flex justify-center mb-4">
              <img 
                src="/image/Ads2GoLogoText.png" 
                alt="Ads2Go Logo" 
                className="h-10 w-auto object-contain"
              />
            </div>
            
            {/* Login Title - Mobile */}
            <h1 className="text-3xl font-bold text-center mb-6 text-white">
              Login
            </h1>
            <form className="space-y-4" onSubmit={handleSubmit} noValidate>
              <div className="relative mt-4">
                <input
                  type="email"
                  id="email-mobile"
                  placeholder=""
                  required
                  value={email}
                  onChange={handleEmailChange}
                  className={`peer w-full px-0 pt-5 pb-2 text-white border-b bg-transparent focus:outline-none focus:border-blue-500 focus:ring-0 placeholder-transparent transition text-sm ${validationErrors.email ? 'border-red-400' : 'border-gray-300'}`}
                  style={{ backgroundColor: 'transparent' }}
                />
                <label
                  htmlFor="email-mobile"
                  className={`absolute left-0 text-white bg-transparent transition-all duration-200 ${email
                    ? '-top-2 text-xs text-white/70 font-bold'  
                    : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-placeholder-shown:text-white'} peer-focus:-top-2 peer-focus:text-xs peer-focus:text-white/70 peer-focus:font-bold`}
                >
                  Enter your email 
                </label>
                {validationErrors.email && (
                  <p className="text-red-400 text-xs mt-1">{validationErrors.email}</p>
                )}
              </div>

              <div className="relative mt-6">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password-mobile"
                  placeholder=" "
                  required
                  value={password}
                  onChange={handlePasswordChange}
                  className={`peer w-full pr-8 pt-5 text-white pb-2 border-b bg-transparent focus:outline-none focus:border-blue-500 focus:ring-0 placeholder-transparent transition text-sm ${validationErrors.password ? 'border-red-400' : 'border-gray-300'}`}
                  style={{ backgroundColor: 'transparent' }}
                />

                <label
                  htmlFor="password-mobile"
                  className={`absolute left-0 text-white bg-transparent transition-all duration-200 ${password
                    ? '-top-2 text-xs text-white/70 font-bold'  
                    : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-placeholder-shown:text-white'} peer-focus:-top-2 peer-focus:text-xs peer-focus:text-white/70 peer-focus:font-bold`}
                >
                  Enter your password
                </label>

                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center px-2 cursor-pointer"
                >
                  {showPassword ? (
                    <EyeIcon className="h-5 w-5 text-white" />   
                  ) : (
                    <EyeOff className="h-5 w-5 text-white" />
                  )}
                </button>

                {validationErrors.password && (
                  <p className="text-red-400 text-xs mt-1">{validationErrors.password}</p>
                )}
              </div>

              {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

              <div className="flex flex-col gap-3 text-sm mt-5">
                <div className="flex justify-between items-center">
                  <div
                    className="flex items-center space-x-2 cursor-pointer"
                    onClick={() => setChecked((prev) => !prev)}
                  >
                    <div
                      className="relative w-4 h-4 border border-gray-400 rounded flex items-center justify-center transition-colors duration-200"
                    >
                      <AnimatePresence>
                        {checked && (
                          <motion.div
                            key="check"
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            className="absolute text-white"
                          >
                            <Check size={8} strokeWidth={3} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <span className="text-white select-none text-xs">Keep me logged in</span>
                  </div>

                  <Link to="/forgot-password" className="text-white/90 hover:underline text-xs">
                    Forgot password?
                  </Link>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className={`w-full py-2 px-4 text-xs shadow-sm transition-colors rounded-md mt-4 ${
                  isLoggingIn
                    ? 'bg-blue-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                } text-white font-semibold text-base`}
              >
                {isLoggingIn ? (
                  <div className="flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin mr-2"></div>
                    Logging in...
                  </div>
                ) : (
                  'Log in'
                )}
              </button>
            </form>

            <div className="my-5 flex justify-center">
              <span className="text-white text-xs text-center">
                or continue with
              </span>
            </div>

            <div className="flex justify-center">
              <button 
                type="button" 
                onClick={handleGoogleLogin}
                disabled={isGoogleLoggingIn || isLoggingIn}
                className={`p-3 border-2 border-white/30 rounded-full bg-white/10 hover:bg-white/20 transition-colors ${
                  isGoogleLoggingIn ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isGoogleLoggingIn ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <img src="/image/g.png" alt="Google logo" className="h-4 w-4" />
                )}
              </button>
            </div>

            <div className="text-center mt-5 text-sm">
              <span className="text-white/70">Don't have an account?</span>
              <Link to="/register" className="text-blue-300 ml-1 underline hover:font-semibold">
                Create an account
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop View */}
      <div className="relative z-10 p-8 sm:p-10 hidden md:flex
                rounded-md shadow-2xl w-full max-w-xl
                bg-white/20 backdrop-blur-lg border border-white/30">
        <div className="w-full">
          {/* Ads2Go Logo - Desktop */}
          <div className="flex justify-center mb-6">
            <img 
              src="/image/Ads2GoLogoText.png" 
              alt="Ads2Go Logo" 
              className="h-12 w-auto object-contain"
            />
          </div>
          
          {/* Login Title - Desktop */}
          <h1 className="text-5xl font-bold text-center mb-8 text-white">
            Login
          </h1>
          
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="relative mt-10">
              <input
                type="email"
                id="email-desktop"
                placeholder=""
                required
                value={email}
                onChange={handleEmailChange}
                className={`peer w-full px-0 pt-5 pb-2 text-white border-b bg-transparent focus:outline-none focus:border-blue-500 focus:ring-0 placeholder-transparent transition ${validationErrors.email ? 'border-red-400' : 'border-gray-300'}`}
                style={{ backgroundColor: 'transparent' }}
              />
              <label
                htmlFor="email-desktop"
                className={`absolute left-0 text-white bg-transparent transition-all duration-200 ${email
                  ? '-top-2 text-sm text-white/70 font-bold'  
                  : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-white'} peer-focus:-top-2 peer-focus:text-sm peer-focus:text-white/70 peer-focus:font-bold`}
              >
                Enter your email 
              </label>
              {validationErrors.email && (
                <p className="text-red-400 text-xs mt-1">{validationErrors.email}</p>
              )}
            </div>

            <div>
              <div className="relative mt-8">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password-desktop"
                  placeholder=" "
                  required
                  value={password}
                  onChange={handlePasswordChange}
                  className={`peer w-full pr-8 pt-5 text-white pb-2 border-b bg-transparent focus:outline-none focus:border-blue-500 focus:ring-0 placeholder-transparent transition ${validationErrors.password ? 'border-red-400' : 'border-gray-300'}`}
                  style={{ backgroundColor: 'transparent' }}
                />

                <label
                  htmlFor="password-desktop"
                  className={`absolute left-0 text-white bg-transparent transition-all duration-200 ${password
                    ? '-top-2 text-sm text-white/70 font-bold'  
                    : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-white'} peer-focus:-top-2 peer-focus:text-sm peer-focus:text-white/70 peer-focus:font-bold`}
                >
                  Enter your password
                </label>

                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center px-2 cursor-pointer"
                >
                  {showPassword ? (
                    <EyeIcon className="h-5 w-5 text-white" />   
                  ) : (
                    <EyeOff className="h-5 w-5 text-white" />
                  )}
                </button>

                {validationErrors.password && (
                  <p className="text-red-400 text-xs mt-1">{validationErrors.password}</p>
                )}
              </div>

              {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

              <div className="flex justify-between items-center text-sm mt-5">
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
                          className="absolute text-white"
                        >
                          <Check size={11} strokeWidth={3} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <span className="text-white select-none">Keep me logged in</span>
                </div>

                <Link to="/forgot-password" className="text-white/90 hover:underline">
                  Forgot password?
                </Link>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className={`w-full py-2 px-4 shadow-sm transition-colors rounded-md ${
                isLoggingIn
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              } text-white font-semibold text-lg`}
            >
              {isLoggingIn ? (
                <div className="flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin mr-2"></div>
                  Logging in...
                </div>
              ) : (
                'Log in'
              )}
            </button>
          </form>

          <div className="my-6 flex justify-center">
            <span className="text-white text-sm text-center">
              or continue with
            </span>
          </div>

          <div className="flex justify-center space-x-4">
            <button 
              type="button" 
              onClick={handleGoogleLogin}
              disabled={isGoogleLoggingIn || isLoggingIn}
              className={`p-3 border-2 border-white/30 rounded-full bg-white/10 hover:bg-white/20 transition-colors ${
                isGoogleLoggingIn ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isGoogleLoggingIn ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <img src="/image/g.png" alt="Google logo" className="h-6 w-6" />
              )}
            </button>
          </div>

          <div className="text-center mt-6 text-sm">
            <span className="text-white/70">Don't have an account?</span>
            <Link to="/register" className="text-blue-300 ml-1 underline hover:font-semibold">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;