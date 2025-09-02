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
  login: (email: string, password: string) => Promise<User | null>;
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
      console.log('🔍 UserAuthContext: Token from localStorage:', token ? 'Token exists' : 'No token');

      if (!token) {
        console.log('❌ UserAuthContext: No token found, setting user to null');
        setUser(null);
        setUserEmail('');
        setIsLoading(false);
        setIsInitialized(true);
        return;
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
          profilePicture: freshUserRaw.profilePicture,
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

  const login = async (email: string, password: string): Promise<User | null> => {
    try {
      const deviceInfo = {
        deviceId: 'web-client',
        deviceType: 'web',
        deviceName: navigator.userAgent,
      };

      const { data } = await loginMutation({
        variables: { email, password, deviceInfo },
      });

      const token = data?.loginUser?.token;
      const userRaw = data?.loginUser?.user;

      if (token && userRaw && userRaw.role === 'USER') {
        localStorage.setItem('userToken', token);

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
      console.error('User login error:', error.message || error);
      alert(error.message || 'Login failed');
      return null;
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
      localStorage.removeItem('userToken');

      try {
        await logoutMutation();
      } catch (error) {
        console.error('Logout mutation error:', error);
      }

      setUser(null);
      setUserEmail('');
      await apolloClient.resetStore();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
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
      login,
      register,
      logout,
      navigate,
      debugToken,
      navigateToRegister,
    ]
  );

  return (
    <UserAuthContext.Provider value={contextValue}>
      {!isLoading && isInitialized ? children : null}
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
