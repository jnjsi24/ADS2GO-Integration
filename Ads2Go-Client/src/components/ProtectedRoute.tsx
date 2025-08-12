import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../src/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactElement;
  requireAuth?: boolean;
  allowedRoles?: string[];
}

const PUBLIC_PATHS = ['/login', '/superadmin-login']; // Public pages

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireAuth = true,
  allowedRoles = []
}) => {
  const { user, isLoading, isInitialized } = useAuth();
  const location = useLocation();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  // If current path is public, no auth required
  const isPublicPath = PUBLIC_PATHS.includes(location.pathname);
  if (isPublicPath) requireAuth = false;

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

      if (allowedRoles.length === 0) {
        setIsAuthorized(true);
        return;
      }

      const hasRequiredRole = allowedRoles.some(role => user.role === role);
      setIsAuthorized(hasRequiredRole);
    }
  }, [user, isLoading, isInitialized, requireAuth, allowedRoles]);

  if (isLoading || !isInitialized || isAuthorized === null) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white z-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (requireAuth && !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAuth && user && isAuthorized === false) {
    return <Navigate to="/" replace />;
  }

  if (!requireAuth && user) {
    const redirectPath = user.role === 'ADMIN' ? '/admin' : 
                        user.role === 'SUPERADMIN' ? '/sadmin-dashboard' : '/home';
    return <Navigate to={redirectPath} replace />;
  }

  return children;
};

export default ProtectedRoute;
