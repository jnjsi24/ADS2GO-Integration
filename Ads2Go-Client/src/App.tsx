import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { UserAuthProvider, useUserAuth } from './contexts/UserAuthContext';
import { AdminAuthProvider, useAdminAuth } from './contexts/AdminAuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { memoryOptimizer } from './utils/memoryOptimization';


// Import Navbars
import UserNavbar from './components/UserNavbar';
import AdminNavbar from './components/AdminNavbar';
import SadminNavbar from './components/SadminNavbar';

// Regular user pages - Lazy load heavy components
import Login from './pages/AUTH/Login';
import Register from './pages/USERS/Register';
import ForgotPass from './pages/USERS/ForgotPass';
import VerifyEmail from './pages/USERS/VerifyEmail';
import Landing from './pages/USERS/Landing';
import Account from './pages/USERS/Account';
import Help from './pages/USERS/Help';
import Settings from './pages/USERS/Settings';

// Lazy load heavy components
import { LazyCreateAdvertisement, LazyDashboard, LazyAdvertisements, LazyPaymentHistory, LazyAdDetailsPage } from './utils/lazyComponents';

// Admin pages - Lazy load heavy components
import AdminLogin from './pages/AUTH/AdminLogin';
import AdminDashboard from './pages/ADMIN/AdminDashboard';
import SiteSettings from './pages/ADMIN/SiteSettings';
import ManageRiders from './pages/ADMIN/ManageRiders';
import AdminAdsControl from './pages/ADMIN/AdminAdsControl';
import Materials from './pages/ADMIN/Materials';
import Reports from './pages/ADMIN/Reports';
import ScreenTracking from './pages/ADMIN/ScreenTracking';

// Lazy load heavy admin components
import { LazyManageUsers, LazyManageAds, LazySadminDashboard } from './utils/lazyComponents';

// Super Admin pages
import SuperAdminLogin from './pages/AUTH/SuperAdminLogin';
import SadminSettings from './pages/SUPERADMIN/SadminSettings';
import SadminAccount from './pages/SUPERADMIN/SadminAccount';
import SadminPlans from './pages/SUPERADMIN/SadminPlans';

// Initialize Firebase when the app starts
console.log('🚀 Initializing Firebase...');
import('./firebase/init')
  .then(() => console.log('🔥 Firebase initialization complete'))
  .catch((error) => console.error('❌ Firebase initialization failed:', error));

// Separate components for admin and user routes to avoid conditional hooks
const AdminAppContent: React.FC = () => {
  const { admin } = useAdminAuth();
  
  return (
    <div className="min-h-screen bg-white text-black">
      {/* Show navbar depending on admin role */}
      {admin?.role === 'SUPERADMIN' && <SadminNavbar />}
      {admin?.role === 'ADMIN' && <AdminNavbar />}
      
      <Routes>
        {/* Public routes */}
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/superadmin-login" element={<SuperAdminLogin />} />

        {/* Protected Admin Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute>
              <LazyManageUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/SiteSettings"
          element={
            <ProtectedRoute>
              <SiteSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/riders"
          element={
            <ProtectedRoute>
              <ManageRiders />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/ads"
          element={
            <ProtectedRoute>
              <AdminAdsControl />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/materials"
          element={
            <ProtectedRoute>
              <Materials />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/manage-ads"
          element={
            <ProtectedRoute>
              <LazyManageAds />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/tablet-tracking"
          element={
            <ProtectedRoute>
              <ScreenTracking />
            </ProtectedRoute>
          }
        />

        {/* Protected SuperAdmin Routes */}
        <Route
          path="/sadmin-dashboard"
          element={
            <ProtectedRoute>
              <LazySadminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sadmin-settings"
          element={
            <ProtectedRoute>
              <SadminSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sadmin-account"
          element={
            <ProtectedRoute>
              <SadminAccount />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sadmin-plans"
          element={
            <ProtectedRoute>
              <SadminPlans />
            </ProtectedRoute>
          }
        />

        {/* Default redirects */}
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="*" element={<Navigate to="/admin-login" replace />} />
      </Routes>
    </div>
  );
};

const UserAppContent: React.FC = () => {
  const { user } = useUserAuth();
  
  return (
    <div className="min-h-screen bg-white text-black">
      {/* Show navbar depending on user role */}
      {user?.role === 'USER' && <UserNavbar />}
      
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />

        {/* Protected user routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <LazyDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <Account />
            </ProtectedRoute>
          }
        />
        <Route
          path="/paymentHistory"
          element={
            <ProtectedRoute>
              <LazyPaymentHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-advertisement"
          element={
            <ProtectedRoute>
              <LazyCreateAdvertisement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/advertisements"
          element={
            <ProtectedRoute>
              <LazyAdvertisements />
            </ProtectedRoute>
          }
        />
        <Route
          path="/advertisements/:id"
          element={
            <ProtectedRoute>
              <LazyAdDetailsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ad-details/:id"
          element={
            <ProtectedRoute>
              <LazyAdDetailsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/help"
          element={
            <ProtectedRoute>
              <Help />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <LazyPaymentHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />

        {/* Default redirects */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </div>
  );
};

const AppContent: React.FC = () => {
  const location = useLocation();
  
  const publicPages = [
    '/admin-login',
    '/superadmin-login',
    '/login',
    '/register',
    '/forgot-password',
    '/verify-email',
    '/landing',
  ];

  const hideNavbarOnRoutes = publicPages;

  if (hideNavbarOnRoutes.includes(location.pathname)) {
    return (
      <Routes>
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/superadmin-login" element={<SuperAdminLogin />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPass />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/landing" element={<Landing />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Check if we're on admin routes to determine which content to show
  const isAdminRoute = location.pathname.startsWith('/admin') || 
                      location.pathname.startsWith('/sadmin') ||
                      location.pathname === '/admin-login' ||
                      location.pathname === '/superadmin-login';
  
    if (isAdminRoute) {
    return <AdminAppContent />;
  } else {
    return <UserAppContent />;
  }
};

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Initialize memory optimization
  useEffect(() => {
    // Start memory optimization with 30-second intervals
    memoryOptimizer.startOptimization(30000);
    
    // Log memory info periodically
    const memoryInterval = setInterval(() => {
      const memoryInfo = memoryOptimizer.getMemoryInfo();
      if (memoryInfo) {
        console.log('Memory usage:', memoryInfo);
      }
    }, 60000); // Every minute
    
    return () => {
      memoryOptimizer.stopOptimization();
      clearInterval(memoryInterval);
    };
  }, []);
  
  // Check if we're on admin-related routes
  const isAdminRoute = location.pathname.startsWith('/admin') || 
                      location.pathname.startsWith('/sadmin') ||
                      location.pathname === '/admin-login' ||
                      location.pathname === '/superadmin-login';
  
  // Check if we're on user-related routes
  const isUserRoute = location.pathname.startsWith('/dashboard') || 
                     location.pathname.startsWith('/advertisements') ||
                     location.pathname.startsWith('/account') ||
                     location.pathname.startsWith('/settings') ||
                     location.pathname.startsWith('/payment') || // ✅ covers /payment
                     location.pathname.startsWith('/paymentHistory') || 
                     location.pathname === '/login' ||
                     location.pathname === '/register' ||
                     location.pathname === '/verify-email';
  
  // If we're on admin routes, only provide AdminAuthProvider
  if (isAdminRoute) {
    return (
      <AdminAuthProvider navigate={navigate}>
        <AppContent />
      </AdminAuthProvider>
    );
  }
  
  // If we're on user routes, only provide UserAuthProvider
  if (isUserRoute) {
    return (
      <UserAuthProvider navigate={navigate}>
        <AppContent />
      </UserAuthProvider>
    );
  }
  
  // For other routes (like home page), provide both contexts
  return (
    <UserAuthProvider navigate={navigate}>
      <AdminAuthProvider navigate={navigate}>
        <AppContent />
      </AdminAuthProvider>
    </UserAuthProvider>
  );
};

export default App;
