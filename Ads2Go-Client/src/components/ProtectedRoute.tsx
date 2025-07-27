import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../src/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactElement;
  requireAuth?: boolean;
  requiredRole?: string | string[]; // Support single role or array of roles
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = true,
  requiredRole = [],
}) => {
  const { user, isLoading, isInitialized } = useAuth();
  const location = useLocation();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  // Normalize roles to array and convert to uppercase for case-insensitive comparison
  const normalizedRoles = Array.isArray(requiredRole)
    ? requiredRole.map((role) => role.toUpperCase())
    : requiredRole
    ? [requiredRole.toUpperCase()]
    : [];

  // Check authorization status
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
      if (normalizedRoles.length === 0) {
        setIsAuthorized(true);
        return;
      }

      // Check if user has one of the required roles (case-insensitive)
      const hasRequiredRole = normalizedRoles.includes(user.role?.toUpperCase());
      setIsAuthorized(hasRequiredRole);
    }
  }, [user, isLoading, isInitialized, requireAuth, normalizedRoles]);

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
  if (requireAuth && user && isAuthorized === false) {
    return <Navigate to="/landing" replace />;
  }

  // Redirect to appropriate dashboard if user is logged in but tries to access auth pages
  if (!requireAuth && user) {
    const redirectPath =
      user.role?.toUpperCase() === 'ADMIN'
        ? '/admin'
        : user.role?.toUpperCase() === 'SUPERADMIN'
        ? '/sadmin-dashboard'
        : '/home';
    return <Navigate to={redirectPath} replace />;
  }

  // If all checks pass, render the protected content
  return children;
};

export default ProtectedRoute;