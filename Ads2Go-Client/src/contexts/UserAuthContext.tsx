import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { useMutation, useApolloClient, useLazyQuery } from '@apollo/client';
import {
  LOGIN_MUTATION,
  REGISTER_MUTATION,
  LOGOUT_MUTATION,
  GET_OWN_USER_DETAILS,
} from '../graphql/user';
import { jwtDecode } from 'jwt-decode';
import { NewsletterService } from '../services/newsletterService';
import { generateGoogleOAuthURL } from '../config/googleOAuth';
import { clearApolloCache } from '../services/apolloClient';
import { clearDetailedAnalyticsCache } from '../pages/USERS/DetailedAnalytics';

// Types
type UserRole = 'USER';

interface User {
  userId: string;
  email: string;
  role: UserRole;
  isEmailVerified: boolean;
  firstName: string;
  middleName?: string;
  lastName: string;
  houseAddress?: string;
  companyName?: string;
  companyAddress?: string;
  contactNumber?: string;
  profilePicture?: string | null;
}

interface UserAuthContextType {
  user: User | null;
  userEmail: string;
  setUser: (user: User | null) => void;
  setUserEmail: (email: string) => void;
  login: (email: string, password: string, keepLoggedIn?: boolean) => Promise<User | null>;
  loginWithGoogle: () => Promise<User | null>;
  register: (userData: any) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  navigate: (path: string) => void;
  debugToken: (token: string) => User | null;
  navigateToRegister: () => void;
}

// Context
const UserAuthContext = createContext<UserAuthContextType | undefined>(undefined);

export const UserAuthProvider: React.FC<{
  children: React.ReactNode;
  navigate: (path: string) => void;
}> = ({ children, navigate }) => {
  const hasRedirectedRef = useRef(false);
  const justLoggedInRef = useRef(false); // Track if we just logged in to prevent initializeAuth from overwriting
  const isInitializingRef = useRef(false); // Prevent multiple simultaneous initializations
  const initializationAttemptRef = useRef(0); // Track initialization attempts
  const [user, setUser] = useState<User | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [loginMutation] = useMutation(LOGIN_MUTATION);
  const [registerMutation] = useMutation(REGISTER_MUTATION);
  const [logoutMutation] = useMutation(LOGOUT_MUTATION);
  const apolloClient = useApolloClient();
  const [fetchUserDetails] = useLazyQuery(GET_OWN_USER_DETAILS);

  const publicPages = ['/login', '/register', '/forgot-password'];

  const navigateToRegister = useCallback(() => {
    navigate('/register');
  }, [navigate]);

  useEffect(() => {
    const initializeAuth = async () => {
      // Prevent multiple simultaneous initializations
      if (isInitializingRef.current) {
        console.log('⏸️ [UserAuth] Initialization already in progress, skipping...');
        return;
      }

      // If already initialized and user exists, don't re-initialize
      if (isInitialized && user) {
        return;
      }

      isInitializingRef.current = true;
      initializationAttemptRef.current += 1;
      const attemptNumber = initializationAttemptRef.current;

      try {
        setIsLoading(true);
        setIsInitialized(false);

        const token = localStorage.getItem('userToken');
        const keepLoggedIn = localStorage.getItem('keepLoggedIn') === 'true';
        const loginTimestamp = localStorage.getItem('loginTimestamp');

        if (!token) {
          setUser(null);
          setUserEmail('');
          setIsLoading(false);
          setIsInitialized(true);
          isInitializingRef.current = false;
          return;
        }

        // Check if persistent login has expired (30 days)
        if (keepLoggedIn && loginTimestamp) {
          const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000; // 30 days
          const isExpired = Date.now() - parseInt(loginTimestamp) > thirtyDaysInMs;
          
          if (isExpired) {
            localStorage.removeItem('userToken');
            localStorage.removeItem('keepLoggedIn');
            localStorage.removeItem('loginTimestamp');
            setUser(null);
            setUserEmail('');
            setIsLoading(false);
            setIsInitialized(true);
            isInitializingRef.current = false;
            return;
          }
        } else if (!keepLoggedIn) {
          // If not persistent login, check if token is expired (24 hours)
          try {
            const decoded = jwtDecode<any>(token);
            const tokenExpiry = decoded.exp * 1000; // Convert to milliseconds
            const isTokenExpired = Date.now() > tokenExpiry;
            
            if (isTokenExpired) {
              localStorage.removeItem('userToken');
              localStorage.removeItem('keepLoggedIn');
              localStorage.removeItem('loginTimestamp');
              setUser(null);
              setUserEmail('');
              setIsLoading(false);
              setIsInitialized(true);
              isInitializingRef.current = false;
              return;
            }
          } catch (error) {
            // Token is invalid (can't decode) - clear it
            localStorage.removeItem('userToken');
            localStorage.removeItem('keepLoggedIn');
            localStorage.removeItem('loginTimestamp');
            setUser(null);
            setUserEmail('');
            setIsLoading(false);
            setIsInitialized(true);
            isInitializingRef.current = false;
            return;
          }
        }

        try {
          const decoded = jwtDecode<any>(token);
          if (!decoded?.email || decoded?.role !== 'USER') {
            throw new Error('Invalid user token');
          }

          // If we just logged in, skip fetching (user state is already set from login response)
          // This prevents overwriting fresh login data with potentially stale cache
          // The flag is set in login() before setting user state, so if it's true, we just logged in
          if (justLoggedInRef.current) {
            // Skip fetching - user state is already set from login response
            // The login() function already set the user state and initialized flags
            setIsLoading(false);
            setIsInitialized(true);
            isInitializingRef.current = false;
            // Don't reset the flag here - let login() reset it after navigation
            return;
          }

          // Retry logic for network failures
          let retries = 3;
          let lastError: any = null;
          let freshUserRaw: any = null;

          while (retries > 0) {
            try {
              // Check if token still exists (might have been cleared by another initialization)
              const currentToken = localStorage.getItem('userToken');
              if (!currentToken || currentToken !== token) {
                console.log('🔄 [UserAuth] Token changed during initialization, aborting...');
                isInitializingRef.current = false;
                return;
              }

              // Use cache-first for performance on initial load, but verify user matches token
              // For app reloads, this will use cache if available (faster)
              const { data } = await fetchUserDetails({
                fetchPolicy: 'cache-and-network', // Use cache if available, but fetch fresh in background
              });
              freshUserRaw = data?.getOwnUserDetails;
              
              if (freshUserRaw) {
                break; // Success, exit retry loop
              }
              
              // If no data but no error, might be a cache issue - try network-only on retry
              if (retries > 1) {
                console.log(`🔄 [UserAuth] Attempt ${attemptNumber}: No user data, retrying with network-only...`);
                const { data: networkData } = await fetchUserDetails({
                  fetchPolicy: 'network-only',
                });
                freshUserRaw = networkData?.getOwnUserDetails;
                if (freshUserRaw) {
                  break; // Success
                }
              }
              
              throw new Error('User not found');
            } catch (fetchError: any) {
              lastError = fetchError;
              retries--;
              
              // Check if it's a network error (should retry) vs token/auth error (should not retry)
              const isNetworkError = 
                fetchError?.networkError ||
                fetchError?.message?.includes('Failed to fetch') ||
                fetchError?.message?.includes('NetworkError') ||
                fetchError?.message?.includes('timeout') ||
                fetchError?.message?.includes('ECONNRESET');
              
              const isAuthError = 
                fetchError?.message?.includes('Not authenticated') ||
                fetchError?.message?.includes('Unauthorized') ||
                fetchError?.graphQLErrors?.some((e: any) => 
                  e.message?.includes('Not authenticated') || 
                  e.message?.includes('Unauthorized')
                );
              
              // If it's an auth error, don't retry - token is invalid
              if (isAuthError) {
                console.error('❌ [UserAuth] Authentication error, token is invalid:', fetchError);
                throw new Error('Invalid user token');
              }
              
              // If it's a network error and we have retries left, wait and retry
              if (isNetworkError && retries > 0) {
                console.log(`🔄 [UserAuth] Attempt ${attemptNumber}: Network error, retrying... (${retries} attempts left)`);
                await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries))); // Exponential backoff
                continue;
              }
              
              // If no retries left or not a network error, throw
              throw fetchError;
            }
          }

          if (!freshUserRaw) {
            throw lastError || new Error('User not found');
          }

          // Helper function to construct full image URL
          const getImageUrl = (imagePath: string | undefined | null) => {
            if (!imagePath) return null;
            // If it's already a full URL, return as is
            if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
              return imagePath;
            }
            // If it starts with /uploads, prepend server URL
            if (imagePath.startsWith('/uploads')) {
              const serverUrl = process.env.REACT_APP_SERVER_URL;
              if (!serverUrl) {
                console.error('REACT_APP_SERVER_URL not configured');
                return imagePath; // Return original path as fallback
              }
              return `${serverUrl}${imagePath}`;
            }
            return imagePath;
          };

          const freshUser: User = {
            userId: freshUserRaw.id,
            email: freshUserRaw.email,
            role: freshUserRaw.role,
            isEmailVerified: freshUserRaw.isEmailVerified,
            firstName: freshUserRaw.firstName,
            middleName: freshUserRaw.middleName,
            lastName: freshUserRaw.lastName,
            houseAddress: freshUserRaw.houseAddress,
            companyName: freshUserRaw.companyName,
            companyAddress: freshUserRaw.companyAddress,
            contactNumber: freshUserRaw.contactNumber,
            profilePicture: getImageUrl(freshUserRaw.profilePicture),
          };
          
          // Only update state if the user email matches the token (prevent showing wrong user)
          // Also, don't overwrite if we already have the correct user (prevents unnecessary updates)
          if (freshUser.email === decoded.email) {
            // Only update if user is null or email doesn't match (prevents overwriting fresh login data)
            if (!user || user.email !== freshUser.email) {
              setUser(freshUser);
              setUserEmail(freshUser.email);
            }
          } else {
            // Token email doesn't match fetched user - clear everything
            console.error('Token email does not match user email');
            localStorage.removeItem('userToken');
            localStorage.removeItem('keepLoggedIn');
            localStorage.removeItem('loginTimestamp');
            setUser(null);
            setUserEmail('');
          }
          
          setIsLoading(false);
          setIsInitialized(true);
          isInitializingRef.current = false;

          if (!hasRedirectedRef.current) {
            if (freshUser.email === decoded.email && !freshUser.isEmailVerified) {
              hasRedirectedRef.current = true;
              navigate('/verify-email');
            } else if (freshUser.email === decoded.email && publicPages.includes(window.location.pathname)) {
              hasRedirectedRef.current = true;
              console.log('🔄 Redirecting from public page to dashboard');
              navigate('/dashboard');
            }
          }
        } catch (err: any) {
          // Only clear token if it's a token validation error, not a network error
          const isTokenError = 
            err?.message?.includes('Invalid user token') ||
            err?.message?.includes('Invalid token') ||
            err?.message?.includes('User not found') ||
            err?.graphQLErrors?.some((e: any) => 
              e.message?.includes('Not authenticated') || 
              e.message?.includes('Unauthorized')
            );
          
          const isNetworkError = 
            err?.networkError ||
            err?.message?.includes('Failed to fetch') ||
            err?.message?.includes('NetworkError') ||
            err?.message?.includes('timeout') ||
            err?.message?.includes('ECONNRESET');
          
          if (isTokenError) {
            // Token is invalid - clear it
            console.error('❌ [UserAuth] Token validation error:', err);
            localStorage.removeItem('userToken');
            localStorage.removeItem('keepLoggedIn');
            localStorage.removeItem('loginTimestamp');
            setUser(null);
            setUserEmail('');
          } else if (isNetworkError) {
            // Network error - don't clear token, just log and keep existing state if available
            console.warn('⚠️ [UserAuth] Network error during initialization, keeping existing state:', err);
            // If we have a user in state, keep it; otherwise set loading to false
            if (!user) {
              setIsLoading(false);
              setIsInitialized(true);
            }
          } else {
            // Unknown error - be conservative and don't clear token
            console.error('❌ [UserAuth] Unknown error during initialization:', err);
            setIsLoading(false);
            setIsInitialized(true);
          }
          
          isInitializingRef.current = false;
        }
      } catch (err) {
        console.error('❌ [UserAuth] Error in initializeAuth outer catch:', err);
        // Only clear token if it's clearly invalid
        const isTokenError = 
          err instanceof Error && (
            err.message.includes('Invalid') ||
            err.message.includes('expired')
          );
        
        if (isTokenError) {
          localStorage.removeItem('userToken');
          localStorage.removeItem('keepLoggedIn');
          localStorage.removeItem('loginTimestamp');
        }
        
        setUser(null);
        setUserEmail('');
        setIsLoading(false);
        setIsInitialized(true);
        isInitializingRef.current = false;
      }
    };

    initializeAuth().catch((err) => {
      console.error('❌ [UserAuth] Error in initializeUserAuth promise catch:', err);
      setIsLoading(false);
      setIsInitialized(true);
      isInitializingRef.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchUserDetails, navigate]); // Intentionally not including user to avoid re-running on user state changes

  const login = async (email: string, password: string, keepLoggedIn: boolean = false): Promise<User | null> => {
    try {
      // Clear previous user state and Apollo cache to prevent stale data
      setUser(null);
      setUserEmail('');
      
      // Clear Apollo cache for user queries to prevent showing previous user's cached data
      try {
        await apolloClient.cache.evict({ fieldName: 'getOwnUserDetails' });
        await apolloClient.cache.gc();
      } catch (cacheError) {
        console.warn('Error clearing cache:', cacheError);
      }
      
      const deviceInfo = {
        deviceId: 'web-client',
        deviceType: 'web',
        deviceName: navigator.userAgent,
      };

      const result = await loginMutation({
        variables: { email, password, deviceInfo, keepLoggedIn },
      });

      // Check for GraphQL errors first
      if (result.errors && result.errors.length > 0) {
        const errorMessage = result.errors[0].message;
        if (errorMessage.includes('Account is temporarily locked')) {
          throw new Error('Your account is temporarily locked because you entered wrong credentials many times. Please try again later.');
        }
        throw new Error(errorMessage);
      }

      const token = result.data?.loginUser?.token;
      const userRaw = result.data?.loginUser?.user;

      if (token && userRaw && userRaw.role === 'USER') {
        localStorage.setItem('userToken', token);
        
        // Store persistent login preference
        if (keepLoggedIn) {
          localStorage.setItem('keepLoggedIn', 'true');
          localStorage.setItem('loginTimestamp', Date.now().toString());
        } else {
          localStorage.removeItem('keepLoggedIn');
          localStorage.removeItem('loginTimestamp');
        }

        // Helper function to construct full image URL (same as in initializeAuth)
        const getImageUrl = (imagePath: string | undefined | null) => {
          if (!imagePath) return null;
          // If it's already a full URL, return as is
          if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
            return imagePath;
          }
          // If it starts with /uploads, prepend server URL
          if (imagePath.startsWith('/uploads')) {
            const serverUrl = process.env.REACT_APP_SERVER_URL;
            if (!serverUrl) {
              console.error('REACT_APP_SERVER_URL not configured');
              return imagePath; // Return original path as fallback
            }
            return `${serverUrl}${imagePath}`;
          }
          return imagePath;
        };

        // Use login response data directly - it's already fresh from the server
        // No need for an extra network request, which speeds up login significantly
        const user: User = {
          userId: userRaw.id,
          email: userRaw.email,
          role: userRaw.role,
          isEmailVerified: userRaw.isEmailVerified,
          firstName: userRaw.firstName,
          middleName: userRaw.middleName,
          lastName: userRaw.lastName,
          houseAddress: userRaw.houseAddress,
          companyName: userRaw.companyName,
          companyAddress: userRaw.companyAddress,
          contactNumber: userRaw.contactNumber,
          profilePicture: getImageUrl(userRaw.profilePicture),
        };
        
        // Set flag to prevent initializeAuth from overwriting this fresh data
        justLoggedInRef.current = true;
        
        // Update state immediately with fresh login data
        setUser(user);
        setUserEmail(user.email);
        setIsLoading(false);
        setIsInitialized(true);

        if (!user.isEmailVerified) {
          navigate('/verify-email');
          // Reset flag after a delay to allow initializeAuth to see it
          setTimeout(() => {
            justLoggedInRef.current = false;
          }, 2000);
          return user;
        }

        // Navigate immediately - no delay needed
        navigate('/dashboard');
        
        // Reset flag after navigation (initializeAuth won't overwrite now)
        setTimeout(() => {
          justLoggedInRef.current = false;
        }, 2000);

        return user;
      } else {
        throw new Error('Invalid login response or user type');
      }
    } catch (error: any) {
      // Reset flag on error
      justLoggedInRef.current = false;
      
      // Extract GraphQL or network error message for UI
      const graphQLError = error?.graphQLErrors?.[0]?.message;
      const networkError = error?.networkError?.message;
      const message = graphQLError || networkError || error?.message || 'Login failed';
      console.log('User login attempt failed:', message);
      
      // Handle specific error cases
      if (message.includes('Account is temporarily locked')) {
        throw new Error('Your account is temporarily locked because you entered wrong credentials many times. Please try again later.');
      }
      
      // Throw so the component can display the specific backend error
      throw new Error(message);
    }
  };

  const loginWithGoogle = async (): Promise<User | null> => {
    try {
      console.log('🔄 Starting Google OAuth login...');
      
      // Generate Google OAuth URL and redirect to Google
      const oauthUrl = generateGoogleOAuthURL();
      console.log('🔄 Redirecting to Google OAuth...');
      
      // Redirect to Google OAuth
      window.location.href = oauthUrl;
      
      // This function won't return normally as we're redirecting
      return null;
    } catch (error: any) {
      console.error('Google OAuth login error:', error);
      throw new Error(error.message || 'Google login failed');
    }
  };

  const register = async (userData: any): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, errors } = await registerMutation({
        variables: { input: userData },
      });

      // Check for GraphQL errors first
      if (errors && errors.length > 0) {
        const errorMessage = errors[0].message;
        console.error('GraphQL registration error:', errorMessage);
        return { success: false, error: errorMessage };
      }

      const userRaw = data?.createUser;
      if (!userRaw) return { success: false, error: 'Registration failed. Please try again.' };

      if (userRaw.token) {
        localStorage.setItem('userToken', userRaw.token);
      }

              const user: User = {
          userId: userRaw.id,
          email: userRaw.email,
          role: userRaw.role,
          isEmailVerified: userRaw.isEmailVerified,
          firstName: userRaw.firstName,
          middleName: userRaw.middleName,
          lastName: userRaw.lastName,
          houseAddress: userRaw.houseAddress,
          companyName: userRaw.companyName,
          companyAddress: userRaw.companyAddress,
          contactNumber: userRaw.contactNumber,
          profilePicture: userRaw.profilePicture,
        };

      setUser(user);
      setUserEmail(user.email);

      // Automatically subscribe user to newsletter
      try {
        await NewsletterService.subscribeToNewsletter(user.email, 'registration');
      } catch (error) {
        console.error('Failed to subscribe user to newsletter:', error);
        // Don't fail registration if newsletter subscription fails
      }

      if (!user.isEmailVerified) {
        navigate('/verify-email');
      } else {
        navigate('/dashboard');
      }

      return { success: true };
    } catch (error: any) {
      console.error('Registration error:', error);
      
      // Extract specific error message from various error sources
      let errorMessage = 'Registration failed. Please try again.';
      
      if (error?.graphQLErrors && error.graphQLErrors.length > 0) {
        errorMessage = error.graphQLErrors[0].message;
      } else if (error?.networkError?.result?.errors && error.networkError.result.errors.length > 0) {
        errorMessage = error.networkError.result.errors[0].message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      return { success: false, error: errorMessage };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      // First, clear user state to prevent any new authenticated requests
      setUser(null);
      setUserEmail('');

      // Clear localStorage
      localStorage.removeItem('userToken');
      localStorage.removeItem('keepLoggedIn');
      localStorage.removeItem('loginTimestamp');
      localStorage.removeItem('user');

      // Try to call logout mutation (but don't fail if it doesn't work)
      try {
        await logoutMutation();
      } catch (error) {
        console.error('Logout mutation error:', error);
        // Continue with logout even if mutation fails
      }

      // Clear Apollo store AFTER clearing tokens and state (no refetch)
      await apolloClient.clearStore();
      
      // ✅ Clear persistent cache from localStorage
      clearApolloCache();
      clearDetailedAnalyticsCache();
      
      // Navigate to login
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Even if there's an error, ensure we clear everything and navigate
      setUser(null);
      setUserEmail('');
      localStorage.removeItem('userToken');
      localStorage.removeItem('keepLoggedIn');
      localStorage.removeItem('loginTimestamp');
      localStorage.removeItem('user');
      navigate('/login');
    }
  };

  const debugToken = useCallback((token: string): User | null => {
    try {
      return jwtDecode<User>(token);
    } catch (error) {
      console.error('Token decoding error:', error);
      return null;
    }
  }, []);

  const contextValue = useMemo(
    () => ({
      user,
      userEmail,
      setUser,
      setUserEmail,
      login,
      loginWithGoogle,
      register,
      logout,
      isAuthenticated: !!user,
      isLoading,
      isInitialized,
      navigate,
      debugToken,
      navigateToRegister,
    }),
    [
      user,
      userEmail,
      isLoading,
      isInitialized,
      // Remove function dependencies to prevent unnecessary re-renders
    ]
  );

  return (
    <UserAuthContext.Provider value={contextValue}>
      {children}
    </UserAuthContext.Provider>
  );
};

export const useUserAuth = (): UserAuthContextType => {
  const context = useContext(UserAuthContext);
  if (!context) {
    throw new Error('useUserAuth must be used within a UserAuthProvider');
  }
  return context;
};
