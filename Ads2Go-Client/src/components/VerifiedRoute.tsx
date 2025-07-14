// Ads2Go-Client/src/components/VerifiedRoute.tsx

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface VerifiedRouteProps {
  children: JSX.Element;
}

const VerifiedRoute: React.FC<VerifiedRouteProps> = ({ children }) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (!user.isEmailVerified) {
    return <Navigate to="/verify-email" />;
  }

  return children;
};

export default VerifiedRoute;
