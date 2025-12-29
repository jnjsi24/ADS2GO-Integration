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
  loginAdmin: (email: string, password: string) => Promise<Admin | null>;
  loginSuperAdmin: (email: string, password: string) => Promise<Admin | null>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  isLoggingOut: boolean;
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
  const isInitializingRef = useRef(false); // Prevent multiple simultaneous initializations
  const initializationAttemptRef = useRef(0); // Track initialization attempts
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [adminEmail, setAdminEmail] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Admin state tracking
  useEffect(() => {
    // Admin state changed
  }, [admin]);

  // Wrapper for setAdmin
  const setAdminWithDebug = useCallback((newAdmin: Admin | null) => {
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

  const publicPages = ['/admin-login', '/sadmin-login'];

  useEffect(() => {
    // Prevent multiple initializations
    if (hasInitializedRef.current && isInitialized && admin) {
      return;
    }
    
    // Prevent multiple simultaneous initializations
    if (isInitializingRef.current) {
      console.log('⏸️ [AdminAuth] Initialization already in progress, skipping...');
      return;
    }
    
    // If we already have an admin and are not loading, skip initialization
    if (admin && isInitialized && !isLoading) {
      hasInitializedRef.current = true; // Mark as initialized to prevent future runs
      return;
    }
    
    const initializeAuth = async () => {
      isInitializingRef.current = true;
      initializationAttemptRef.current += 1;
      const attemptNumber = initializationAttemptRef.current;
      
      // Starting initialization
      setIsLoading(true);
      setIsInitialized(false);

      const token = localStorage.getItem('adminToken');

      if (!token) {
        setAdmin(null);
        setAdminEmail('');
        setIsLoading(false);
        setIsInitialized(true);
        isInitializingRef.current = false;
        return;
      }

      try {
        const decoded = jwtDecode<any>(token);
        
        if (!decoded?.email || !['ADMIN', 'SUPERADMIN'].includes(decoded?.role)) {
          console.error('❌ AdminAuthContext: Invalid token - email or role mismatch:', { email: decoded?.email, role: decoded?.role });
          throw new Error('Invalid admin token');
        }

        let freshAdminRaw: any;
        let freshAdmin: Admin;

        // Retry logic for network failures
        let retries = 3;
        let lastError: any = null;

        while (retries > 0) {
          try {
            // Double-check that the token is still valid
            const currentToken = localStorage.getItem('adminToken');
            if (!currentToken || currentToken !== token) {
              console.log('🔄 [AdminAuth] Token changed during initialization, aborting...');
              isInitializingRef.current = false;
              return;
            }

            // Fetch admin details from backend based on role
            if (decoded.role === 'ADMIN') {
              const { data } = await fetchAdminDetailsRef.current({
                fetchPolicy: retries === 3 ? 'cache-and-network' : 'network-only',
              });
              freshAdminRaw = data?.getOwnAdminDetails;
              
              if (!freshAdminRaw) {
                throw new Error('Admin not found');
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
                profilePicture: getImageUrl(freshAdminRaw.profilePicture),
              };
              break; // Success, exit retry loop
            } else if (decoded.role === 'SUPERADMIN') {
              const { data } = await fetchSuperAdminDetailsRef.current({
                fetchPolicy: retries === 3 ? 'cache-and-network' : 'network-only',
              });
              freshAdminRaw = data?.getOwnSuperAdminDetails;
              
              if (!freshAdminRaw) {
                throw new Error('SuperAdmin not found');
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
                profilePicture: getImageUrl(freshAdminRaw.profilePicture),
              };
              break; // Success, exit retry loop
            } else {
              throw new Error('Invalid admin role');
            }
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
              console.error('❌ [AdminAuth] Authentication error, token is invalid:', fetchError);
              throw new Error('Invalid admin token');
            }
            
            // If it's a network error and we have retries left, wait and retry
            if (isNetworkError && retries > 0) {
              console.log(`🔄 [AdminAuth] Attempt ${attemptNumber}: Network error, retrying... (${retries} attempts left)`);
              await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries))); // Exponential backoff
              continue;
            }
            
            // If no retries left or not a network error, throw
            throw fetchError;
          }
        }

        if (!freshAdmin) {
          throw lastError || new Error('Admin not found');
        }

        setAdminWithDebug(freshAdmin);
        setAdminEmail(freshAdmin.email);
        setIsLoading(false);
        setIsInitialized(true);
        hasInitializedRef.current = true;
        isInitializingRef.current = false;

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
      } catch (err: any) {
        console.error('❌ [AdminAuth] Error initializing admin auth:', err);
        
        // Only clear token if it's a token validation error, not a network error
        const isTokenError = 
          err?.message?.includes('Invalid admin token') ||
          err?.message?.includes('Admin not found') ||
          err?.message?.includes('SuperAdmin not found') ||
          err?.message?.includes('Invalid admin role') ||
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
          localStorage.removeItem('adminToken');
          setAdminWithDebug(null);
          setAdminEmail('');
        } else if (isNetworkError) {
          // Network error - don't clear token, just log and keep existing state if available
          console.warn('⚠️ [AdminAuth] Network error during initialization, keeping existing state:', err);
          // If we have an admin in state, keep it; otherwise set loading to false
          if (!admin) {
            setIsLoading(false);
            setIsInitialized(true);
          }
        } else {
          // Unknown error - be conservative and don't clear token
          console.error('❌ [AdminAuth] Unknown error during initialization:', err);
          setIsLoading(false);
          setIsInitialized(true);
        }
        
        hasInitializedRef.current = true;
        isInitializingRef.current = false;
      }
    };

    initializeAuth().catch((err) => {
      console.error('❌ [AdminAuth] Error in initializeAdminAuth promise catch:', err);
      setIsLoading(false);
      setIsInitialized(true);
      isInitializingRef.current = false;
    });
  }, []); // Empty dependency array to prevent infinite loops

  const loginSuperAdmin = async (email: string, password: string): Promise<Admin | null> => {
    try {
      const deviceInfo = {
        deviceId: 'admin-web-client',
        deviceType: 'web',
        deviceName: navigator.userAgent,
      };

      // Only try superadmin login - reject regular admins
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
          profilePicture: getImageUrl(superAdminRaw.profilePicture),
        };

        // Superadmin-only login successful
        setAdminWithDebug(adminUser);
        setAdminEmail(adminUser.email);
        hasInitializedRef.current = true; // Mark as initialized to prevent re-running

        // Reset Apollo Client to ensure new token is used
        await apolloClient.resetStore();
        // Apollo Client reset complete

        // Wait a bit longer to ensure the token is properly set
        setTimeout(() => {
          // Navigating to /sadmin-dashboard after superadmin-only login
          hasRedirectedRef.current = true; // Prevent initialization effect from overriding
          navigate('/sadmin-dashboard');
        }, 500);

        return adminUser;
      }

      throw new Error('SuperAdmin login failed');
    } catch (error: any) {
      // Extract GraphQL or network error message for UI
      const graphQLError = error?.graphQLErrors?.[0]?.message;
      const networkError = error?.networkError?.message;
      const message = graphQLError || networkError || error?.message || 'SuperAdmin login failed';
      
      // Handle specific error cases
      if (message.includes('Account is temporarily locked')) {
        throw new Error('Your account is temporarily locked because you entered wrong credentials many times. Please try again later.');
      }
      
      // Throw so the component can display the specific backend error
      throw new Error(message);
    }
  };

  const loginAdmin = async (email: string, password: string): Promise<Admin | null> => {
    try {
      const deviceInfo = {
        deviceId: 'admin-web-client',
        deviceType: 'web',
        deviceName: navigator.userAgent,
      };

      // Only try admin login - reject super admins
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
          profilePicture: getImageUrl(adminRaw.profilePicture),
        };
        setAdminWithDebug(adminUser);
        setAdminEmail(adminUser.email);
        hasInitializedRef.current = true; // Mark as initialized to prevent re-running

        // Reset Apollo Client to ensure new token is used
        await apolloClient.resetStore();
        // Apollo Client reset complete

        // Wait a bit longer to ensure the token is properly set
        setTimeout(() => {
          // Navigating to /admin after admin-only login
          hasRedirectedRef.current = true; // Prevent initialization effect from overriding
          navigate('/admin');
        }, 500);

        return adminUser;
      }

      throw new Error('Admin login failed');
    } catch (error: any) {
      // Extract GraphQL or network error message for UI
      const graphQLError = error?.graphQLErrors?.[0]?.message;
      const networkError = error?.networkError?.message;
      const message = graphQLError || networkError || error?.message || 'Admin login failed';
      
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
      // Set logout flag to prevent ProtectedRoute from redirecting
      setIsLoggingOut(true);
      
      // Store the current admin role before clearing state
      const currentAdminRole = admin?.role;
      
      // Navigate first based on the user's role
      if (currentAdminRole === 'SUPERADMIN') {
        navigate('/sadmin-login');
      } else {
        navigate('/admin-login');
      }
      
      // Then clear admin state
      setAdminWithDebug(null);
      setAdminEmail('');

      // Clear localStorage
      localStorage.removeItem('adminToken');

      // Clear Apollo store AFTER clearing tokens and state (no refetch)
      await apolloClient.clearStore();
    } catch (error) {
      console.error('Logout error:', error);
      // Even if there's an error, ensure we clear everything and navigate
      const currentAdminRole = admin?.role;
      
      if (currentAdminRole === 'SUPERADMIN') {
        navigate('/sadmin-login');
      } else {
        navigate('/admin-login');
      }
      
      setAdminWithDebug(null);
      setAdminEmail('');
      localStorage.removeItem('adminToken');
    } finally {
      // Reset logout flag
      setIsLoggingOut(false);
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
      // Creating context value with admin
      // Context dependencies changed
      return {
        admin,
        adminEmail,
        setAdmin: setAdminWithDebug,
        setAdminEmail,
        loginAdmin,
        loginSuperAdmin,
        logout,
        isAuthenticated: !!admin,
        isLoading,
        isInitialized,
        isLoggingOut,
        navigate,
        debugToken,
      };
    },
    [
      admin,
      adminEmail,
      isLoading,
      isInitialized,
      isLoggingOut,
      loginAdmin,
      loginSuperAdmin,
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
