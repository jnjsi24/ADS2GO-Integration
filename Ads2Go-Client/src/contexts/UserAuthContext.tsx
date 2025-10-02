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
  profilePicture?: string;
}

interface UserAuthContextType {
  user: User | null;
  userEmail: string;
  setUser: (user: User | null) => void;
  setUserEmail: (email: string) => void;
  login: (email: string, password: string, keepLoggedIn?: boolean) => Promise<User | null>;
  loginWithGoogle: () => Promise<User | null>;
  register: (userData: any) => Promise<boolean>;
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
      setIsLoading(true);
      setIsInitialized(false);

      const token = localStorage.getItem('userToken');
      const keepLoggedIn = localStorage.getItem('keepLoggedIn') === 'true';
      const loginTimestamp = localStorage.getItem('loginTimestamp');
      
      console.log('🔍 UserAuthContext: Token from localStorage:', token ? 'Token exists' : 'No token');
      console.log('🔍 UserAuthContext: Keep logged in:', keepLoggedIn);

      if (!token) {
        console.log('❌ UserAuthContext: No token found, setting user to null');
        setUser(null);
        setUserEmail('');
        setIsLoading(false);
        setIsInitialized(true);
        return;
      }

      // Check if persistent login has expired (30 days)
      if (keepLoggedIn && loginTimestamp) {
        const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000; // 30 days
        const isExpired = Date.now() - parseInt(loginTimestamp) > thirtyDaysInMs;
        
        if (isExpired) {
          console.log('❌ UserAuthContext: Persistent login expired, clearing data');
          localStorage.removeItem('userToken');
          localStorage.removeItem('keepLoggedIn');
          localStorage.removeItem('loginTimestamp');
          setUser(null);
          setUserEmail('');
          setIsLoading(false);
          setIsInitialized(true);
          return;
        }
      } else if (!keepLoggedIn) {
        // If not persistent login, check if token is expired (24 hours)
        try {
          const decoded = jwtDecode<any>(token);
          const tokenExpiry = decoded.exp * 1000; // Convert to milliseconds
          const isTokenExpired = Date.now() > tokenExpiry;
          
          if (isTokenExpired) {
            console.log('❌ UserAuthContext: Token expired, clearing data');
            localStorage.removeItem('userToken');
            localStorage.removeItem('keepLoggedIn');
            localStorage.removeItem('loginTimestamp');
            setUser(null);
            setUserEmail('');
            setIsLoading(false);
            setIsInitialized(true);
            return;
          }
        } catch (error) {
          console.log('❌ UserAuthContext: Invalid token format, clearing data');
          localStorage.removeItem('userToken');
          localStorage.removeItem('keepLoggedIn');
          localStorage.removeItem('loginTimestamp');
          setUser(null);
          setUserEmail('');
          setIsLoading(false);
          setIsInitialized(true);
          return;
        }
      }

      try {
        console.log('🔍 UserAuthContext: Decoding JWT token...');
        const decoded = jwtDecode<any>(token);
        console.log('🔍 UserAuthContext: Decoded token:', decoded);
        if (!decoded?.email || decoded?.role !== 'USER') {
          console.log('❌ UserAuthContext: Invalid token - email or role mismatch');
          throw new Error('Invalid user token');
        }

        console.log('🔍 UserAuthContext: Fetching user details...');
        const { data } = await fetchUserDetails();
        console.log('🔍 UserAuthContext: Raw response:', data);
        const freshUserRaw = data?.getOwnUserDetails;
        console.log('🔍 UserAuthContext: User details:', freshUserRaw);
        
        if (!freshUserRaw) {
          throw new Error('User not found');
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

        console.log('🔄 UserAuthContext: Setting user from initialization:', freshUser);
        setUser(freshUser);
        setUserEmail(freshUser.email);
        setIsLoading(false);
        setIsInitialized(true);

        if (!hasRedirectedRef.current) {
          if (!freshUser.isEmailVerified) {
            hasRedirectedRef.current = true;
            navigate('/verify-email');
          } else if (publicPages.includes(window.location.pathname)) {
            hasRedirectedRef.current = true;
            console.log('🔄 Redirecting from public page to dashboard');
            navigate('/dashboard');
          }
        }
      } catch (err) {
        console.error('Error initializing user auth:', err);
        localStorage.removeItem('userToken');
        setUser(null);
        setUserEmail('');
        setIsLoading(false);
        setIsInitialized(true);
      }
    };

    initializeAuth().catch((err) => {
      console.error('Error in initializeUserAuth:', err);
      setIsLoading(false);
      setIsInitialized(true);
    });
  }, [fetchUserDetails, navigate]);

  const login = async (email: string, password: string, keepLoggedIn: boolean = false): Promise<User | null> => {
    try {
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

        console.log('🔄 UserAuthContext: Setting user from login:', user);
        setUser(user);
        setUserEmail(user.email);

        if (!user.isEmailVerified) {
          navigate('/verify-email');
          return user;
        }

        console.log('🚀 Navigating to dashboard...');
        setTimeout(() => {
          console.log('📍 Executing navigation to /dashboard');
          navigate('/dashboard');
        }, 0);

        return user;
      } else {
        throw new Error('Invalid login response or user type');
      }
    } catch (error: any) {
      // Extract GraphQL or network error message for UI
      const graphQLError = error?.graphQLErrors?.[0]?.message;
      const networkError = error?.networkError?.message;
      const message = graphQLError || networkError || error?.message || 'Login failed';
      console.error('User login error:', message);
      
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

  const register = async (userData: any): Promise<boolean> => {
    try {
      const { data } = await registerMutation({
        variables: { input: userData },
      });

      const userRaw = data?.createUser;
      if (!userRaw) return false;

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

      return true;
    } catch (error) {
      console.error('Registration error:', error);
      return false;
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

      // Reset Apollo store AFTER clearing tokens and state
      await apolloClient.resetStore();
      
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
