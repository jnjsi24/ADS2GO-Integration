import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../src/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactElement;
  requireAuth?: boolean;
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireAuth = true,
  allowedRoles = []
}) => {
  const { user, isLoading, isInitialized } = useAuth();
  const location = useLocation();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  // Check if user has required role
  useEffect(() => {
    if (!isLoading && isInitialized) {
      if (!requireAuth) {
        setIsAuthorized(true);
        return;
      }

      if (!user) {
        setIsAuthorized(false);
        return;
      }

      // If no specific roles required, just check authentication
      if (allowedRoles.length === 0) {
        setIsAuthorized(true);
        return;
      }

      // Check if user has one of the allowed roles
      const hasRequiredRole = allowedRoles.some(role => user.role === role);
      setIsAuthorized(hasRequiredRole);
    }
  }, [user, isLoading, isInitialized, requireAuth, allowedRoles]);

  // Show loading state while checking auth
  if (isLoading || !isInitialized || isAuthorized === null) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white z-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Redirect to login if authentication is required but user is not logged in
  if (requireAuth && !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Redirect to unauthorized if user doesn't have required role
  if (requireAuth && user && isAuthorized === false) {
    // You can create a dedicated "unauthorized" page if needed
    return <Navigate to="/" replace />;
  }

  // Redirect to dashboard if user is logged in but tries to access auth pages
  if (!requireAuth && user) {
    const redirectPath = user.role === 'ADMIN' ? '/admin' : 
                        user.role === 'SUPERADMIN' ? '/sadmin-dashboard' : '/home';
    return <Navigate to={redirectPath} replace />;
  }

  // If all checks pass, render the protected content
  return children;
};

export default ProtectedRoute;