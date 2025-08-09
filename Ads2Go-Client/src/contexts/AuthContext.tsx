import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { useMutation, useApolloClient, useLazyQuery } from '@apollo/client';
import {
  LOGIN_MUTATION,
  REGISTER_MUTATION,
  LOGOUT_MUTATION,
} from '../services/graphql';
import { GET_OWN_USER_DETAILS } from '../graphql/queries/getOwnUserDetails';
import { jwtDecode } from 'jwt-decode';

// Types
type UserRole = 'ADMIN' | 'USER' | 'SUPERADMIN';

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

interface AuthContextType {
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
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{
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

  // ✅ Added /superadmin-login
  const publicPages = ['/login', '/register', '/forgot-password', '/superadmin-login'];

  const navigateToRegister = useCallback(() => {
    navigate('/register');
  }, [navigate]);

  useEffect(() => {
    const initializeAuth = async () => {
      setIsLoading(true);
      setIsInitialized(false);
      const token = localStorage.getItem('token');
      if (!token) {
        setIsLoading(false);
        setIsInitialized(true);
        return;
      }

      try {
        const decoded = jwtDecode<any>(token);
        if (!decoded?.email) {
          localStorage.removeItem('token');
          setIsLoading(false);
          setIsInitialized(true);
          return;
        }

        const { data } = await fetchUserDetails();
        const freshUserRaw = data?.getOwnUserDetails;

        if (!freshUserRaw) {
          localStorage.removeItem('token');
          setIsLoading(false);
          setIsInitialized(true);
          return;
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

        setUser(freshUser);
        setUserEmail(freshUser.email);
        setIsLoading(false);
        setIsInitialized(true);

        if (!hasRedirectedRef.current) {
          if (!freshUser.isEmailVerified) {
            hasRedirectedRef.current = true;
            navigate('/verify-email');
          } else if (
            publicPages.includes(window.location.pathname) ||
            window.location.pathname === '/verify-email'
          ) {
            // ✅ Updated role-based redirection with check to avoid redundant redirects
            let redirectPath = '/home';
            if (freshUser.role === 'ADMIN') {
              redirectPath = '/admin';
            } else if (freshUser.role === 'SUPERADMIN') {
              redirectPath = '/sadmin-dashboard';
            }

            if (window.location.pathname !== redirectPath) {
              hasRedirectedRef.current = true;
              navigate(redirectPath);
            }
          }
        }
      } catch (err) {
        console.error('Error restoring auth:', err);
        localStorage.removeItem('token');
        setIsLoading(false);
        setIsInitialized(true);
      }
    };

    initializeAuth();
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

      const token = data?.login?.token;
      const userRaw = data?.login?.user;

      if (token && userRaw) {
        localStorage.setItem('token', token);

        const user: User = {
          userId: userRaw._id || userRaw.userId,
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
          return user;
        }

        setTimeout(() => {
          switch (user.role.toUpperCase()) {
            case 'ADMIN':
              navigate('/admin');
              break;
            case 'SUPERADMIN':
              navigate('/sadmin-dashboard');
              break;
            default:
              navigate('/home');
          }
        }, 0);

        return user;
      } else {
        throw new Error('Invalid login response');
      }
    } catch (error: any) {
      console.error('Login error:', error.message || error);
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
        localStorage.setItem('token', userRaw.token);
      }

      const user: User = {
        userId: userRaw._id || userRaw.userId,
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
        navigate(user.role === 'ADMIN' ? '/admin' : '/home');
      }

      return true;
    } catch (error) {
      console.error('Registration error:', error);
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await logoutMutation();
      localStorage.removeItem('token');
      setUser(null);
      setUserEmail('');
      await apolloClient.resetStore();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const debugToken = (token: string): User | null => {
    try {
      return jwtDecode<User>(token);
    } catch (error) {
      console.error('Token decoding error:', error);
      return null;
    }
  };

  const contextValue: AuthContextType = {
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
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
