import React, { Suspense } from 'react';

// Lazy load heavy components to reduce initial bundle size
export const LazyCreateAdvertisement = React.lazy(() => import('../pages/USERS/CreateAdvertisement'));
export const LazySadminDashboard = React.lazy(() => import('../pages/SUPERADMIN/SadminDashboard'));
export const LazyManageAds = React.lazy(() => import('../pages/ADMIN/ManageAds'));
export const LazyManageUsers = React.lazy(() => import('../pages/ADMIN/ManageUsers'));
export const LazyPaymentHistory = React.lazy(() => import('../pages/USERS/PaymentHistory'));
export const LazyAdvertisements = React.lazy(() => import('../pages/USERS/Advertisements'));
export const LazyDashboard = React.lazy(() => import('../pages/USERS/Dashboard'));

// Loading component for Suspense
export const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="flex items-center space-x-2">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      <span className="text-lg text-gray-600">Loading...</span>
    </div>
  </div>
);

// Higher-order component for lazy loading with Suspense
export const withLazyLoading = (Component: React.ComponentType<any>) => {
  return (props: any) => (
    <Suspense fallback={<LoadingSpinner />}>
      <Component {...props} />
    </Suspense>
  );
};
