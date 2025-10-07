import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { useUserAuth } from '../contexts/UserAuthContext';
import { useAdminAuth } from '../contexts/AdminAuthContext';

interface ProtectedRouteProps {
  children: React.ReactElement;
  requireAuth?: boolean;
  allowedRoles?: ('USER' | 'ADMIN' | 'SUPERADMIN')[];
}

const PUBLIC_PATHS = ['/login', '/admin-login', '/sadmin-login']; // Public pages

// ✅ Banter Loader Component
const Loader = () => {
  return (
    <StyledWrapper>
      {/* Background with blur & overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-fixed blur-sm brightness-90"
        style={{
          backgroundImage: "url('/image/bg2.jpg')",
        }}
      ></div>
      <div className="absolute inset-0 bg-white/40 backdrop-blur-xl"></div>

      {/* Loader animation */}
      <div className="relative z-10 flex items-center justify-center min-h-screen">
        <div className="banter-loader">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="banter-loader__box" />
          ))}
        </div>
      </div>
    </StyledWrapper>
  );
};

const StyledWrapper = styled.div`
  position: fixed;
  inset: 0;
  overflow: hidden;
  z-index: 50;

  .banter-loader {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 72px;
    height: 72px;
    margin-left: -36px;
    margin-top: -36px;
  }

  .banter-loader__box {
    float: left;
    position: relative;
    width: 20px;
    height: 20px;
    margin-right: 6px;
    margin-bottom: 6px;
  }

  .banter-loader__box:nth-child(3n) {
    margin-right: 0;
  }

  .banter-loader__box:before {
  content: "";
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(27, 80, 135, 0.6);
  backdrop-filter: blur(6px);
  box-shadow: 0 2px 6px rgba(27, 80, 135, 0.4);
  animation-duration: 4s;
  animation-iteration-count: infinite;
}

@keyframes moveBox-1 {
    9.0909090909% {
      transform: translate(-26px, 0);
    }

    18.1818181818% {
      transform: translate(0px, 0);
    }

    27.2727272727% {
      transform: translate(0px, 0);
    }

    36.3636363636% {
      transform: translate(26px, 0);
    }

    45.4545454545% {
      transform: translate(26px, 26px);
    }

    54.5454545455% {
      transform: translate(26px, 26px);
    }

    63.6363636364% {
      transform: translate(26px, 26px);
    }

    72.7272727273% {
      transform: translate(26px, 0px);
    }

    81.8181818182% {
      transform: translate(0px, 0px);
    }

    90.9090909091% {
      transform: translate(-26px, 0px);
    }

    100% {
      transform: translate(0px, 0px);
    }
  }

  .banter-loader__box:nth-child(1) {
    animation: moveBox-1 4s infinite;
  }

  @keyframes moveBox-2 {
    9.0909090909% {
      transform: translate(0, 0);
    }

    18.1818181818% {
      transform: translate(26px, 0);
    }

    27.2727272727% {
      transform: translate(0px, 0);
    }

    36.3636363636% {
      transform: translate(26px, 0);
    }

    45.4545454545% {
      transform: translate(26px, 26px);
    }

    54.5454545455% {
      transform: translate(26px, 26px);
    }

    63.6363636364% {
      transform: translate(26px, 26px);
    }

    72.7272727273% {
      transform: translate(26px, 26px);
    }

    81.8181818182% {
      transform: translate(0px, 26px);
    }

    90.9090909091% {
      transform: translate(0px, 26px);
    }

    100% {
      transform: translate(0px, 0px);
    }
  }

  .banter-loader__box:nth-child(2) {
    animation: moveBox-2 4s infinite;
  }

  @keyframes moveBox-3 {
    9.0909090909% {
      transform: translate(-26px, 0);
    }

    18.1818181818% {
      transform: translate(-26px, 0);
    }

    27.2727272727% {
      transform: translate(0px, 0);
    }

    36.3636363636% {
      transform: translate(-26px, 0);
    }

    45.4545454545% {
      transform: translate(-26px, 0);
    }

    54.5454545455% {
      transform: translate(-26px, 0);
    }

    63.6363636364% {
      transform: translate(-26px, 0);
    }

    72.7272727273% {
      transform: translate(-26px, 0);
    }

    81.8181818182% {
      transform: translate(-26px, -26px);
    }

    90.9090909091% {
      transform: translate(0px, -26px);
    }

    100% {
      transform: translate(0px, 0px);
    }
  }

  .banter-loader__box:nth-child(3) {
    animation: moveBox-3 4s infinite;
  }

  @keyframes moveBox-4 {
    9.0909090909% {
      transform: translate(-26px, 0);
    }

    18.1818181818% {
      transform: translate(-26px, 0);
    }

    27.2727272727% {
      transform: translate(-26px, -26px);
    }

    36.3636363636% {
      transform: translate(0px, -26px);
    }

    45.4545454545% {
      transform: translate(0px, 0px);
    }

    54.5454545455% {
      transform: translate(0px, -26px);
    }

    63.6363636364% {
      transform: translate(0px, -26px);
    }

    72.7272727273% {
      transform: translate(0px, -26px);
    }

    81.8181818182% {
      transform: translate(-26px, -26px);
    }

    90.9090909091% {
      transform: translate(-26px, 0px);
    }

    100% {
      transform: translate(0px, 0px);
    }
  }

  .banter-loader__box:nth-child(4) {
    animation: moveBox-4 4s infinite;
  }

  @keyframes moveBox-5 {
    9.0909090909% {
      transform: translate(0, 0);
    }

    18.1818181818% {
      transform: translate(0, 0);
    }

    27.2727272727% {
      transform: translate(0, 0);
    }

    36.3636363636% {
      transform: translate(26px, 0);
    }

    45.4545454545% {
      transform: translate(26px, 0);
    }

    54.5454545455% {
      transform: translate(26px, 0);
    }

    63.6363636364% {
      transform: translate(26px, 0);
    }

    72.7272727273% {
      transform: translate(26px, 0);
    }

    81.8181818182% {
      transform: translate(26px, -26px);
    }

    90.9090909091% {
      transform: translate(0px, -26px);
    }

    100% {
      transform: translate(0px, 0px);
    }
  }

  .banter-loader__box:nth-child(5) {
    animation: moveBox-5 4s infinite;
  }

  @keyframes moveBox-6 {
    9.0909090909% {
      transform: translate(0, 0);
    }

    18.1818181818% {
      transform: translate(-26px, 0);
    }

    27.2727272727% {
      transform: translate(-26px, 0);
    }

    36.3636363636% {
      transform: translate(0px, 0);
    }

    45.4545454545% {
      transform: translate(0px, 0);
    }

    54.5454545455% {
      transform: translate(0px, 0);
    }

    63.6363636364% {
      transform: translate(0px, 0);
    }

    72.7272727273% {
      transform: translate(0px, 26px);
    }

    81.8181818182% {
      transform: translate(-26px, 26px);
    }

    90.9090909091% {
      transform: translate(-26px, 0px);
    }

    100% {
      transform: translate(0px, 0px);
    }
  }

  .banter-loader__box:nth-child(6) {
    animation: moveBox-6 4s infinite;
  }

  @keyframes moveBox-7 {
    9.0909090909% {
      transform: translate(26px, 0);
    }

    18.1818181818% {
      transform: translate(26px, 0);
    }

    27.2727272727% {
      transform: translate(26px, 0);
    }

    36.3636363636% {
      transform: translate(0px, 0);
    }

    45.4545454545% {
      transform: translate(0px, -26px);
    }

    54.5454545455% {
      transform: translate(26px, -26px);
    }

    63.6363636364% {
      transform: translate(0px, -26px);
    }

    72.7272727273% {
      transform: translate(0px, -26px);
    }

    81.8181818182% {
      transform: translate(0px, 0px);
    }

    90.9090909091% {
      transform: translate(26px, 0px);
    }

    100% {
      transform: translate(0px, 0px);
    }
  }

  .banter-loader__box:nth-child(7) {
    animation: moveBox-7 4s infinite;
  }

  @keyframes moveBox-8 {
    9.0909090909% {
      transform: translate(0, 0);
    }

    18.1818181818% {
      transform: translate(-26px, 0);
    }

    27.2727272727% {
      transform: translate(-26px, -26px);
    }

    36.3636363636% {
      transform: translate(0px, -26px);
    }

    45.4545454545% {
      transform: translate(0px, -26px);
    }

    54.5454545455% {
      transform: translate(0px, -26px);
    }

    63.6363636364% {
      transform: translate(0px, -26px);
    }

    72.7272727273% {
      transform: translate(0px, -26px);
    }

    81.8181818182% {
      transform: translate(26px, -26px);
    }

    90.9090909091% {
      transform: translate(26px, 0px);
    }

    100% {
      transform: translate(0px, 0px);
    }
  }

  .banter-loader__box:nth-child(8) {
    animation: moveBox-8 4s infinite;
  }

  @keyframes moveBox-9 {
    9.0909090909% {
      transform: translate(-26px, 0);
    }

    18.1818181818% {
      transform: translate(-26px, 0);
    }

    27.2727272727% {
      transform: translate(0px, 0);
    }

    36.3636363636% {
      transform: translate(-26px, 0);
    }

    45.4545454545% {
      transform: translate(0px, 0);
    }

    54.5454545455% {
      transform: translate(0px, 0);
    }

    63.6363636364% {
      transform: translate(-26px, 0);
    }

    72.7272727273% {
      transform: translate(-26px, 0);
    }

    81.8181818182% {
      transform: translate(-52px, 0);
    }

    90.9090909091% {
      transform: translate(-26px, 0);
    }

    100% {
      transform: translate(0px, 0);
    }
  }

  .banter-loader__box:nth-child(9) {
    animation: moveBox-9 4s infinite;
  }`;

// ✅ AdminProtectedRoute
const AdminProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = true,
  allowedRoles = []
}) => {
  const location = useLocation();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const { admin, isLoading, isInitialized, isLoggingOut } = useAdminAuth();

  const isPublicPath = PUBLIC_PATHS.includes(location.pathname);
  if (isPublicPath) requireAuth = false;

  useEffect(() => {
    if (!isLoading && isInitialized && !isLoggingOut) {
      if (!requireAuth) return setIsAuthorized(true);
      if (!admin) return setIsAuthorized(false);
      if (allowedRoles.length === 0) return setIsAuthorized(true);

      const hasRequiredRole = allowedRoles.some(role => admin.role === role);
      setIsAuthorized(hasRequiredRole);
    }
  }, [admin, isLoading, isInitialized, isLoggingOut, requireAuth, allowedRoles]);

  if (isLoading || !isInitialized || isLoggingOut || isAuthorized === null) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white z-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (requireAuth && !admin) {
    const isSuperAdminRoute = location.pathname.startsWith('/sadmin');
    const redirectPath = isSuperAdminRoute ? '/sadmin-login' : '/admin-login';
    return <Navigate to={redirectPath} state={{ from: location }} replace />;
  }

  if (requireAuth && admin && isAuthorized === false) {
    const isSuperAdminRoute = location.pathname.startsWith('/sadmin');
    const redirectPath = isSuperAdminRoute ? '/sadmin-login' : '/admin-login';
    return <Navigate to={redirectPath} replace />;
  }

  if (!requireAuth && admin) {
    const redirectPath = admin.role === 'ADMIN' ? '/admin' : '/sadmin-dashboard';
    return <Navigate to={redirectPath} replace />;
  }

  return children;
};

// ✅ UserProtectedRoute
const UserProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = true,
  allowedRoles = []
}) => {
  const location = useLocation();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const { user, isLoading, isInitialized } = useUserAuth();

  const isPublicPath = PUBLIC_PATHS.includes(location.pathname);
  if (isPublicPath) requireAuth = false;

  useEffect(() => {
    if (!isLoading && isInitialized) {
      if (!requireAuth) return setIsAuthorized(true);
      if (!user) return setIsAuthorized(false);
      if (allowedRoles.length === 0) return setIsAuthorized(true);

      const hasRequiredRole = allowedRoles.some(role => user.role === role);
      setIsAuthorized(hasRequiredRole);
    }
  }, [user, isLoading, isInitialized, requireAuth, allowedRoles]);

  if (isLoading || !isInitialized || isAuthorized === null) {
    return <Loader />;
  }

  if (requireAuth && !user)
    return <Navigate to="/login" state={{ from: location }} replace />;

  if (requireAuth && user && isAuthorized === false)
    return <Navigate to="/" replace />;

  if (!requireAuth && user)
    return <Navigate to="/dashboard" replace />;

  return children;
};

// ✅ Admin Loader (white background)
const AdminLoader = () => {
  return (
    <StyledWrapper>
      {/* Plain white background */}
      <div className="absolute inset-0 bg-none"></div>

      {/* Loader animation */}
      <div className="relative z-10 flex items-center justify-center min-h-screen">
        <div className="banter-loader">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="banter-loader__box" />
          ))}
        </div>
      </div>
    </StyledWrapper>
  );
};

// ✅ Main ProtectedRoute
const ProtectedRoute: React.FC<ProtectedRouteProps> = (props) => {
  const location = useLocation();
  
  const isAdminRoute =
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/sadmin') ||
    location.pathname === '/admin-login' ||
    location.pathname === '/sadmin-login';

  return isAdminRoute ? <AdminProtectedRoute {...props} /> : <UserProtectedRoute {...props} />;
};

export { Loader, AdminLoader };
export default ProtectedRoute;