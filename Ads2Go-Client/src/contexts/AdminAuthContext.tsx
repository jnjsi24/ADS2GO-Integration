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
import { GET_OWN_ADMIN_DETAILS, LOGIN_ADMIN_MUTATION } from '../graphql/admin';
import { GET_OWN_SUPERADMIN_DETAILS, LOGIN_SUPERADMIN_MUTATION } from '../graphql/superadmin';
import { jwtDecode } from 'jwt-decode';

// Types
type AdminRole = 'ADMIN' | 'SUPERADMIN';

interface Admin {
  userId: string;
  email: string;
  recoveryEmail?: string;
  role: AdminRole;
  isEmailVerified: boolean;
  firstName: string;
  middleName?: string;
  lastName: string;
  companyName?: string;
  companyAddress?: string;
  contactNumber?: string;
  profilePicture?: string;
  houseAddress?: string;
  postalCode?: string;
  taxId?: string;
}

interface AdminAuthContextType {
  admin: Admin | null;
  adminEmail: string;
  setAdmin: (admin: Admin | null) => void;
  setAdminEmail: (email: string) => void;
  login: (email: string, password: string) => Promise<Admin | null>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  navigate: (path: string) => void;
  debugToken: (token: string) => Admin | null;
}

// Context
const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider: React.FC<{
  children: React.ReactNode;
  navigate: (path: string) => void;
}> = ({ children, navigate }) => {
  const hasRedirectedRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [adminEmail, setAdminEmail] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Debug admin state changes
  useEffect(() => {
    console.log('🔍 AdminAuthContext: Admin state changed to:', admin);
    console.log('🔍 AdminAuthContext: Admin state change time:', new Date().toISOString());
    console.log('🔍 AdminAuthContext: Admin state change URL:', window.location.href);
  }, [admin]);

  // Wrapper for setAdmin to add debugging
  const setAdminWithDebug = useCallback((newAdmin: Admin | null) => {
    console.log('🔧 AdminAuthContext: setAdmin called with:', newAdmin);
    console.log('🔧 AdminAuthContext: Previous admin state was:', admin);
    console.log('🔧 AdminAuthContext: Call stack:', new Error().stack);
    console.log('🔧 AdminAuthContext: Current time:', new Date().toISOString());
    console.log('🔧 AdminAuthContext: Current URL:', window.location.href);
    setAdmin(newAdmin);
  }, []); // Remove admin dependency to prevent recreation
  const [loginAdminMutation] = useMutation(LOGIN_ADMIN_MUTATION);
  const [loginSuperAdminMutation] = useMutation(LOGIN_SUPERADMIN_MUTATION);
  const apolloClient = useApolloClient();
  const [fetchAdminDetails] = useLazyQuery(GET_OWN_ADMIN_DETAILS);
  const [fetchSuperAdminDetails] = useLazyQuery(GET_OWN_SUPERADMIN_DETAILS);

  // Store fetch functions in refs to avoid dependency issues
  const fetchAdminDetailsRef = useRef(fetchAdminDetails);
  const fetchSuperAdminDetailsRef = useRef(fetchSuperAdminDetails);
  
  // Update refs when functions change
  useEffect(() => {
    fetchAdminDetailsRef.current = fetchAdminDetails;
    fetchSuperAdminDetailsRef.current = fetchSuperAdminDetails;
  }, [fetchAdminDetails, fetchSuperAdminDetails]);

  const publicPages = ['/admin-login', '/superadmin-login'];

  useEffect(() => {
    console.log('🔄 AdminAuthContext: useEffect triggered, hasInitializedRef.current:', hasInitializedRef.current);
    console.log('🔄 AdminAuthContext: Current admin state:', admin);
    console.log('🔄 AdminAuthContext: Current loading state:', isLoading);
    console.log('🔄 AdminAuthContext: Current initialized state:', isInitialized);
    
    // Prevent multiple initializations
    if (hasInitializedRef.current) {
      console.log('🔄 AdminAuthContext: Already initialized, skipping...');
      return;
    }
    
    // If we already have an admin and are not loading, skip initialization
    if (admin && isInitialized && !isLoading) {
      console.log('🔄 AdminAuthContext: Admin already authenticated, skipping initialization...');
      hasInitializedRef.current = true; // Mark as initialized to prevent future runs
      return;
    }
    
    const initializeAuth = async () => {
      
      console.log('🔄 AdminAuthContext: Starting initialization...');
      setIsLoading(true);
      setIsInitialized(false);

      const token = localStorage.getItem('adminToken');

      if (!token) {
        setAdmin(null);
        setAdminEmail('');
        setIsLoading(false);
        setIsInitialized(true);
        return;
      }

      try {
        console.log('🔍 AdminAuthContext: Decoding token:', token.substring(0, 50) + '...');
        const decoded = jwtDecode<any>(token);
        console.log('🔍 AdminAuthContext: Decoded token:', decoded);
        
        if (!decoded?.email || !['ADMIN', 'SUPERADMIN'].includes(decoded?.role)) {
          console.error('❌ AdminAuthContext: Invalid token - email or role mismatch:', { email: decoded?.email, role: decoded?.role });
          throw new Error('Invalid admin token');
        }

        let freshAdminRaw: any;
        let freshAdmin: Admin;

        // Fetch admin details from backend based on role
        if (decoded.role === 'ADMIN') {
          console.log('🔍 AdminAuthContext: Fetching admin details for role:', decoded.role);
          
          // Double-check that the token is still valid
          const currentToken = localStorage.getItem('adminToken');
          if (!currentToken || currentToken !== token) {
            console.error('❌ AdminAuthContext: Token changed during initialization');
            throw new Error('Token changed during initialization');
          }
          
          const { data } = await fetchAdminDetailsRef.current();
          console.log('🔍 AdminAuthContext: Admin details response:', data);
          freshAdminRaw = data?.getOwnAdminDetails;
          
          if (!freshAdminRaw) {
            console.error('❌ AdminAuthContext: Admin details not found in response');
            throw new Error('Admin not found');
          }

          freshAdmin = {
            userId: freshAdminRaw.id,
            email: freshAdminRaw.email,
            role: freshAdminRaw.role,
            isEmailVerified: freshAdminRaw.isEmailVerified,
            firstName: freshAdminRaw.firstName,
            middleName: freshAdminRaw.middleName,
            lastName: freshAdminRaw.lastName,
            companyName: freshAdminRaw.companyName,
            companyAddress: freshAdminRaw.companyAddress,
            contactNumber: freshAdminRaw.contactNumber,
            profilePicture: freshAdminRaw.profilePicture,
          };
        } else if (decoded.role === 'SUPERADMIN') {
          console.log('🔍 AdminAuthContext: Fetching superadmin details for role:', decoded.role);
          
          // Double-check that the token is still valid
          const currentToken = localStorage.getItem('adminToken');
          if (!currentToken || currentToken !== token) {
            console.error('❌ AdminAuthContext: Token changed during initialization');
            throw new Error('Token changed during initialization');
          }
          
          const { data } = await fetchSuperAdminDetailsRef.current();
          console.log('🔍 AdminAuthContext: Superadmin details response:', data);
          freshAdminRaw = data?.getOwnSuperAdminDetails;
          
          if (!freshAdminRaw) {
            console.error('❌ AdminAuthContext: Superadmin details not found in response');
            throw new Error('SuperAdmin not found');
          }

          freshAdmin = {
            userId: freshAdminRaw.id,
            email: freshAdminRaw.email,
            recoveryEmail: freshAdminRaw.recoveryEmail,
            role: freshAdminRaw.role,
            isEmailVerified: freshAdminRaw.isEmailVerified,
            firstName: freshAdminRaw.firstName,
            middleName: freshAdminRaw.middleName,
            lastName: freshAdminRaw.lastName,
            companyName: freshAdminRaw.companyName,
            companyAddress: freshAdminRaw.companyAddress,
            contactNumber: freshAdminRaw.contactNumber,
            profilePicture: freshAdminRaw.profilePicture,
          };
        } else {
          throw new Error('Invalid admin role');
        }

        console.log('✅ AdminAuthContext: Setting admin state:', freshAdmin);
        setAdminWithDebug(freshAdmin);
        setAdminEmail(freshAdmin.email);
        setIsLoading(false);
        setIsInitialized(true);
        hasInitializedRef.current = true;

        if (!hasRedirectedRef.current) {
          if (publicPages.includes(window.location.pathname)) {
            let redirectPath = '/admin';
            if (freshAdmin.role === 'SUPERADMIN') {
              redirectPath = '/sadmin-dashboard';
            }

            if (window.location.pathname !== redirectPath) {
              hasRedirectedRef.current = true;
              navigate(redirectPath);
            }
          }
        }
      } catch (err) {
        console.error('Error initializing admin auth:', err);
        // Don't clear the admin state if there's a GraphQL error during initialization
        // Only clear if it's a token validation error
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (errorMessage === 'Invalid admin token' || errorMessage === 'Admin not found' || errorMessage === 'SuperAdmin not found') {
          localStorage.removeItem('adminToken');
          setAdminWithDebug(null);
          setAdminEmail('');
        }
        setIsLoading(false);
        setIsInitialized(true);
        hasInitializedRef.current = true;
      }
    };

    initializeAuth().catch((err) => {
      console.error('Error in initializeAdminAuth:', err);
      setIsLoading(false);
      setIsInitialized(true);
    });
  }, []); // Empty dependency array to prevent infinite loops

  const login = async (email: string, password: string): Promise<Admin | null> => {
    try {
      const deviceInfo = {
        deviceId: 'admin-web-client',
        deviceType: 'web',
        deviceName: navigator.userAgent,
      };

      // Try admin login first
      try {
        const result = await loginAdminMutation({
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

        if (result.data?.loginAdmin?.token && result.data?.loginAdmin?.admin) {
          const { token, admin: adminRaw } = result.data.loginAdmin;
          localStorage.setItem('adminToken', token);

          const adminUser: Admin = {
            userId: adminRaw.id,
            email: adminRaw.email,
            role: adminRaw.role,
            isEmailVerified: adminRaw.isEmailVerified,
            firstName: adminRaw.firstName,
            middleName: adminRaw.middleName,
            lastName: adminRaw.lastName,
            companyName: adminRaw.companyName,
            companyAddress: adminRaw.companyAddress,
            contactNumber: adminRaw.contactNumber,
            profilePicture: adminRaw.profilePicture,
          };

          console.log('✅ AdminAuthContext: Login successful, setting admin:', adminUser);
          setAdminWithDebug(adminUser);
          setAdminEmail(adminUser.email);
          hasInitializedRef.current = true; // Mark as initialized to prevent re-running

          // Reset Apollo Client to ensure new token is used
          await apolloClient.resetStore();
          console.log('✅ AdminAuthContext: Apollo Client reset complete');

          // Wait a bit longer to ensure the token is properly set
          setTimeout(() => {
            console.log('🔍 AdminAuthContext: Navigating to /admin after login');
            navigate('/admin');
          }, 500);

          return adminUser;
        }
      } catch (adminError) {
        // Admin login failed, try superadmin login
        try {
          const result = await loginSuperAdminMutation({
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

          if (result.data?.loginSuperAdmin?.token && result.data?.loginSuperAdmin?.superAdmin) {
            const { token, superAdmin: superAdminRaw } = result.data.loginSuperAdmin;
            localStorage.setItem('adminToken', token);

            const adminUser: Admin = {
              userId: superAdminRaw.id,
              email: superAdminRaw.email,
              role: superAdminRaw.role,
              isEmailVerified: superAdminRaw.isEmailVerified,
              firstName: superAdminRaw.firstName,
              middleName: superAdminRaw.middleName,
              lastName: superAdminRaw.lastName,
              companyName: superAdminRaw.companyName,
              companyAddress: superAdminRaw.companyAddress,
              contactNumber: superAdminRaw.contactNumber,
              profilePicture: superAdminRaw.profilePicture,
            };

            console.log('✅ AdminAuthContext: Superadmin login successful, setting admin:', adminUser);
            setAdminWithDebug(adminUser);
            setAdminEmail(adminUser.email);
            hasInitializedRef.current = true; // Mark as initialized to prevent re-running

            // Reset Apollo Client to ensure new token is used
            await apolloClient.resetStore();
            console.log('✅ AdminAuthContext: Apollo Client reset complete');

            // Wait a bit longer to ensure the token is properly set
            setTimeout(() => {
              console.log('🔍 AdminAuthContext: Navigating to /sadmin-dashboard after login');
              navigate('/sadmin-dashboard');
            }, 500);

            return adminUser;
          }
        } catch (superAdminError) {
          // Both admin and superadmin login failed
          throw new Error('Invalid admin credentials');
        }
      }

      throw new Error('Login failed');
    } catch (error: any) {
      // Extract GraphQL or network error message for UI
      const graphQLError = error?.graphQLErrors?.[0]?.message;
      const networkError = error?.networkError?.message;
      const message = graphQLError || networkError || error?.message || 'Login failed';
      console.error('Admin login error:', message);
      
      // Handle specific error cases
      if (message.includes('Account is temporarily locked')) {
        throw new Error('Your account is temporarily locked because you entered wrong credentials many times. Please try again later.');
      }
      
      // Throw so the component can display the specific backend error
      throw new Error(message);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      // First, clear admin state to prevent any new authenticated requests
      setAdminWithDebug(null);
      setAdminEmail('');

      // Clear localStorage
      localStorage.removeItem('adminToken');

      // Reset Apollo store AFTER clearing tokens and state
      await apolloClient.resetStore();
      
      // Navigate to admin login
      navigate('/admin-login');
    } catch (error) {
      console.error('Logout error:', error);
      // Even if there's an error, ensure we clear everything and navigate
      setAdminWithDebug(null);
      setAdminEmail('');
      localStorage.removeItem('adminToken');
      navigate('/admin-login');
    }
  };

  const debugToken = useCallback((token: string): Admin | null => {
    try {
      return jwtDecode<Admin>(token);
    } catch (error) {
      console.error('Token decoding error:', error);
      return null;
    }
  }, []);

  const contextValue = useMemo(
    () => {
      console.log('🔄 AdminAuthContext: Creating context value with admin:', admin);
      console.log('🔄 AdminAuthContext: Context dependencies changed:', {
        adminChanged: !!admin,
        adminEmailChanged: !!adminEmail,
        isLoadingChanged: isLoading,
        isInitializedChanged: isInitialized
      });
      return {
        admin,
        adminEmail,
        setAdmin: setAdminWithDebug,
        setAdminEmail,
        login,
        logout,
        isAuthenticated: !!admin,
        isLoading,
        isInitialized,
        navigate,
        debugToken,
      };
    },
    [
      admin,
      adminEmail,
      isLoading,
      isInitialized,
      login,
      logout,
      navigate,
      debugToken,
    ]
  );

  return (
    <AdminAuthContext.Provider value={contextValue}>
      {!isLoading && isInitialized ? children : null}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = (): AdminAuthContextType => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};
