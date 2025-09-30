import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUserAuth } from '../contexts/UserAuthContext';
import { useAdminAuth } from '../contexts/AdminAuthContext';

interface ProtectedRouteProps {
  children: React.ReactElement;
  requireAuth?: boolean;
  allowedRoles?: ('USER' | 'ADMIN' | 'SUPERADMIN')[];
}

const PUBLIC_PATHS = ['/login', '/sadmin-login']; // Public pages

// Protected route for admin routes (uses only AdminAuthContext)
const AdminProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children, 
  requireAuth = true,
  allowedRoles = []
}) => {
  const location = useLocation();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const { admin, isLoading, isInitialized, isLoggingOut } = useAdminAuth();
  
  // AdminProtectedRoute render

  // If current path is public, no auth required
  const isPublicPath = PUBLIC_PATHS.includes(location.pathname);
  if (isPublicPath) requireAuth = false;

  useEffect(() => {
    // AdminProtectedRoute effect
    
    if (!isLoading && isInitialized && !isLoggingOut) {
      if (!requireAuth) {
        // No auth required
        setIsAuthorized(true);
        return;
      }

      if (!admin) {
        // No authenticated admin
        setIsAuthorized(false);
        return;
      }

      if (allowedRoles.length === 0) {
        // No specific roles required
        setIsAuthorized(true);
        return;
      }

      const hasRequiredRole = allowedRoles.some(role => admin.role === role);
      console.log('🔍 Role check:', { adminRole: admin.role, allowedRoles, hasRequiredRole });
      setIsAuthorized(hasRequiredRole);
    }
  }, [admin, isLoading, isInitialized, requireAuth, allowedRoles]);

  if (isLoading || !isInitialized || isLoggingOut || isAuthorized === null) {
    // AdminProtectedRoute loading
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white z-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (requireAuth && !admin) {
    // Determine redirect based on current route
    const isSuperAdminRoute = location.pathname.startsWith('/sadmin');
    const redirectPath = isSuperAdminRoute ? '/sadmin-login' : '/admin-login';
    console.log('🔄 AdminProtectedRoute: No auth, redirecting to:', redirectPath);
    return <Navigate to={redirectPath} state={{ from: location }} replace />;
  }

  if (requireAuth && admin && isAuthorized === false) {
    // Determine redirect based on current route
    const isSuperAdminRoute = location.pathname.startsWith('/sadmin');
    const redirectPath = isSuperAdminRoute ? '/sadmin-login' : '/admin-login';
    console.log('🚫 AdminProtectedRoute: Unauthorized, redirecting to:', redirectPath);
    return <Navigate to={redirectPath} replace />;
  }

  if (!requireAuth && admin) {
    const redirectPath = admin.role === 'ADMIN' ? '/admin' : '/sadmin-dashboard';
    console.log('🔄 AdminProtectedRoute: Redirecting authenticated admin to:', redirectPath);
    return <Navigate to={redirectPath} replace />;
  }

        // AdminProtectedRoute: Rendering children
  return children;
};

// Protected route for user routes (uses only UserAuthContext)
const UserProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children, 
  requireAuth = true,
  allowedRoles = []
}) => {
  const location = useLocation();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const { user, isLoading, isInitialized } = useUserAuth();

  // If current path is public, no auth required
  const isPublicPath = PUBLIC_PATHS.includes(location.pathname);
  if (isPublicPath) requireAuth = false;

  useEffect(() => {
    console.log('🔒 UserProtectedRoute effect:', { 
      isLoading, 
      isInitialized, 
      requireAuth, 
      user: user ? { id: user.userId, role: user.role } : null,
      allowedRoles 
    });
    
    if (!isLoading && isInitialized) {
      if (!requireAuth) {
        // No auth required
        setIsAuthorized(true);
        return;
      }

      if (!user) {
        console.log('❌ No authenticated user');
        setIsAuthorized(false);
        return;
      }

      if (allowedRoles.length === 0) {
        // No specific roles required
        setIsAuthorized(true);
        return;
      }

      const hasRequiredRole = allowedRoles.some(role => user.role === role);
      console.log('🔍 Role check:', { userRole: user.role, allowedRoles, hasRequiredRole });
      setIsAuthorized(hasRequiredRole);
    }
  }, [user, isLoading, isInitialized, requireAuth, allowedRoles]);

  if (isLoading || !isInitialized || isAuthorized === null) {
    console.log('⏳ UserProtectedRoute loading...');
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white z-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (requireAuth && !user) {
    console.log('🚫 UserProtectedRoute: No auth, redirecting to login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAuth && user && isAuthorized === false) {
    console.log('🚫 UserProtectedRoute: Unauthorized, redirecting to home');
    return <Navigate to="/" replace />;
  }

  if (!requireAuth && user) {
    console.log('🔄 UserProtectedRoute: Redirecting authenticated user to dashboard');
    return <Navigate to="/dashboard" replace />;
  }

  console.log('✅ UserProtectedRoute: Rendering children');
  return children;
};

// Main ProtectedRoute component that determines which type to use based on the route
const ProtectedRoute: React.FC<ProtectedRouteProps> = (props) => {
  const location = useLocation();
  
  // Check if we're on admin routes to determine which protected route to use
  const isAdminRoute = location.pathname.startsWith('/admin') || 
                      location.pathname.startsWith('/sadmin') ||
                      location.pathname === '/admin-login' ||
                      location.pathname === '/sadmin-login';
  
  if (isAdminRoute) {
    return <AdminProtectedRoute {...props} />;
  } else {
    return <UserProtectedRoute {...props} />;
  }
};

export default ProtectedRoute;
