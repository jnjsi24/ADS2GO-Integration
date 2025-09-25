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
import { GET_OWN_ADMIN_DETAILS, LOGIN_ADMIN_MUTATION } from '../graphql/admin';
import { GET_OWN_SUPERADMIN_DETAILS, LOGIN_SUPERADMIN_MUTATION } from '../graphql/superadmin';
import { jwtDecode } from 'jwt-decode';

// 🚨 Firebase imports removed except analytics/storage usage
import { auth } from '../firebase'; // still available for storage/analytics if needed

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
  const [loginUserMutation] = useMutation(LOGIN_MUTATION);
  const [loginAdminMutation] = useMutation(LOGIN_ADMIN_MUTATION);
  const [loginSuperAdminMutation] = useMutation(LOGIN_SUPERADMIN_MUTATION);
  const [registerMutation] = useMutation(REGISTER_MUTATION);
  const [logoutMutation] = useMutation(LOGOUT_MUTATION);
  const apolloClient = useApolloClient();
  const [fetchUserDetails] = useLazyQuery(GET_OWN_USER_DETAILS);
  const [fetchAdminDetails] = useLazyQuery(GET_OWN_ADMIN_DETAILS);
  const [fetchSuperAdminDetails] = useLazyQuery(GET_OWN_SUPERADMIN_DETAILS);

  // ✅ Added /superadmin-login to publicPages
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
        setUser(null);
        setUserEmail('');
        setIsLoading(false);
        setIsInitialized(true);
        return;
      }

      try {
        const decoded = jwtDecode<any>(token);
        if (!decoded?.email) {
          throw new Error('Invalid token');
        }

        let freshUserRaw: any;
        let freshUser: User;

        // Fetch user details from backend based on role
        if (decoded.role === 'ADMIN') {
          const { data } = await fetchAdminDetails();
          freshUserRaw = data?.getOwnAdminDetails;
          
          if (!freshUserRaw) {
            throw new Error('Admin not found');
          }

          freshUser = {
            userId: freshUserRaw.id,
            email: freshUserRaw.email,
            role: freshUserRaw.role,
            isEmailVerified: freshUserRaw.isEmailVerified,
            firstName: freshUserRaw.firstName,
            middleName: freshUserRaw.middleName,
            lastName: freshUserRaw.lastName,
            companyName: freshUserRaw.companyName,
            companyAddress: freshUserRaw.companyAddress,
            contactNumber: freshUserRaw.contactNumber,
          };
        } else if (decoded.role === 'SUPERADMIN') {
          const { data } = await fetchSuperAdminDetails();
          freshUserRaw = data?.getOwnSuperAdminDetails;
          
          if (!freshUserRaw) {
            throw new Error('SuperAdmin not found');
          }

          freshUser = {
            userId: freshUserRaw.id,
            email: freshUserRaw.email,
            role: freshUserRaw.role,
            isEmailVerified: freshUserRaw.isEmailVerified,
            firstName: freshUserRaw.firstName,
            middleName: freshUserRaw.middleName,
            lastName: freshUserRaw.lastName,
            companyName: freshUserRaw.companyName,
            companyAddress: freshUserRaw.companyAddress,
            contactNumber: freshUserRaw.contactNumber,
          };
        } else {
          // Regular user
          const { data } = await fetchUserDetails();
          freshUserRaw = data?.getOwnUserDetails;
          
          if (!freshUserRaw) {
            throw new Error('User not found');
          }

          freshUser = {
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
        }

        setUser(freshUser);
        setUserEmail(freshUser.email);
        setIsLoading(false);
        setIsInitialized(true);

        if (!hasRedirectedRef.current) {
          if (window.location.pathname === '/superadmin-login') {
            return;
          }

          if (!freshUser.isEmailVerified) {
            hasRedirectedRef.current = true;
            navigate('/verify-email');
          } else if (
            publicPages.includes(window.location.pathname) ||
            window.location.pathname === '/verify-email'
          ) {
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
        console.error('Error initializing auth:', err);
        localStorage.removeItem('token');
        setUser(null);
        setUserEmail('');
        setIsLoading(false);
        setIsInitialized(true);
      }
    };

    initializeAuth().catch((err) => {
      console.error('Error in initializeAuth:', err);
      setIsLoading(false);
      setIsInitialized(true);
    });
  }, [fetchUserDetails, fetchAdminDetails, fetchSuperAdminDetails, navigate]);

  const login = async (email: string, password: string): Promise<User | null> => {
    try {
      const deviceInfo = {
        deviceId: 'web-client',
        deviceType: 'web',
        deviceName: navigator.userAgent,
      };

      // Try admin login first
      try {
        const { data: adminData } = await loginAdminMutation({
          variables: { email, password, deviceInfo },
        });

        if (adminData?.loginAdmin?.token && adminData?.loginAdmin?.admin) {
          const { token, admin } = adminData.loginAdmin;
          localStorage.setItem('token', token);

          const user: User = {
            userId: admin.id,
            email: admin.email,
            role: admin.role,
            isEmailVerified: admin.isEmailVerified,
            firstName: admin.firstName,
            middleName: admin.middleName,
            lastName: admin.lastName,
            companyName: admin.companyName,
            companyAddress: admin.companyAddress,
            contactNumber: admin.contactNumber,
            profilePicture: admin.profilePicture,
          };

          setUser(user);
          setUserEmail(user.email);

          setTimeout(() => {
            navigate('/admin');
          }, 0);

          return user;
        }
      } catch (adminError) {
        // Admin login failed, try superadmin login
        try {
          const { data: superAdminData } = await loginSuperAdminMutation({
            variables: { email, password, deviceInfo },
          });

          if (superAdminData?.loginSuperAdmin?.token && superAdminData?.loginSuperAdmin?.superAdmin) {
            const { token, superAdmin } = superAdminData.loginSuperAdmin;
            localStorage.setItem('token', token);

            const user: User = {
              userId: superAdmin.id,
              email: superAdmin.email,
              role: superAdmin.role,
              isEmailVerified: superAdmin.isEmailVerified,
              firstName: superAdmin.firstName,
              middleName: superAdmin.middleName,
              lastName: superAdmin.lastName,
              companyName: superAdmin.companyName,
              companyAddress: superAdmin.companyAddress,
              contactNumber: superAdmin.contactNumber,
              profilePicture: superAdmin.profilePicture,
            };

            setUser(user);
            setUserEmail(user.email);

            setTimeout(() => {
              navigate('/sadmin-dashboard');
            }, 0);

            return user;
          }
        } catch (superAdminError) {
          // Both admin and superadmin login failed, try regular user login
        }
      }

      // If we reach here, try regular user login as fallback
      try {
        const result = await loginUserMutation({
          variables: { email, password, deviceInfo },
        });

        // Check for GraphQL errors first
        if (result.errors && result.errors.length > 0) {
          const errorMessage = result.errors[0].message;
          if (errorMessage.includes('Account is temporarily locked')) {
            throw new Error('Your account is temporarily locked because you entered wrong credentials many times. Please try again later.');
          }
          throw new Error(errorMessage);
        }

        if (result.data?.login?.token && result.data?.login?.user) {
          const { token, user: userRaw } = result.data.login;
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
            navigate('/home');
          }, 0);

          return user;
        }
      } catch (userError) {
        // All login attempts failed
        throw new Error('Invalid credentials');
      }

      // This should never be reached, but TypeScript requires it
      throw new Error('Login failed');
    } catch (error: any) {
      console.error('Login error:', error.message || error);
      
      // Handle specific error cases
      if (error.message && error.message.includes('Account is temporarily locked')) {
        throw new Error('Your account is temporarily locked because you entered wrong credentials many times. Please try again later.');
      }
      
      // Let the Login component handle error display instead of using alert()
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
      // ✅ No Firebase signOut — only clear tokens and backend logout
      localStorage.removeItem('token');

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
    <AuthContext.Provider value={contextValue}>
      {!isLoading && isInitialized ? children : null}
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
