import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { UserAuthProvider, useUserAuth } from './contexts/UserAuthContext';
import { AdminAuthProvider, useAdminAuth } from './contexts/AdminAuthContext';
import { DeviceStatusProvider } from './contexts/DeviceStatusContext';
import { NotificationProvider } from './contexts/NotificationContext';
import ProtectedRoute from './components/ProtectedRoute';


// Import Navbars
import UserNavbar from './components/UserNavbar';
import AdminNavbar from './components/AdminNavbar';
import SadminNavbar from './components/SadminNavbar';

// Regular user pages
import Login from './pages/AUTH/Login';
import Register from './pages/USERS/Register';
import ForgotPass from './pages/USERS/ForgotPass';
import Dashboard from './pages/USERS/Dashboard';
import VerifyEmail from './pages/USERS/VerifyEmail';
import Landing from './pages/USERS/Landing';
import Account from './pages/USERS/Account';
import Payment from './pages/USERS/Payment';
import CreateAdvertisement from './pages/USERS/CreateAdvertisement';
import Advertisements from './pages/USERS/Advertisements';
import Help from './pages/USERS/Help';
import PaymentHistory from './pages/USERS/PaymentHistory';
import Settings from './pages/USERS/Settings';
import AdDetailsPage from './pages/USERS/AdDetailsPage';
import Notifications from './pages/USERS/Notifications';
import Analytics from './pages/USERS/Analytics';
import ProfitLossAnalytics from './pages/USERS/ProfitLossAnalytics';
import QRAnalytics from './pages/USERS/QRAnalytics';
import AdsAnalytics from './pages/USERS/AdsAnalytics';
import TabletAnalytics from './pages/USERS/TabletAnalytics';

// Admin pages
import AdminLogin from './pages/AUTH/AdminLogin';
import AdminDashboard from './pages/ADMIN/AdminDashboard';
import ManageUsers from './pages/ADMIN/ManageUsers';
import SiteSettings from './pages/ADMIN/SiteSettings';
import ManageRiders from './pages/ADMIN/ManageRiders';
import AdminAdsControl from './pages/ADMIN/AdminAdsControl';
import Materials from './pages/ADMIN/Materials';
import Reports from './pages/ADMIN/Reports';
import ManageAds from 'pages/ADMIN/ManageAds';
import ScreenTracking from './pages/ADMIN/ScreenTracking';

// Super Admin pages
import SuperAdminLogin from './pages/AUTH/SuperAdminLogin';
import SadminDashboard from './pages/SUPERADMIN/SadminDashboard';
import SadminSettings from './pages/SUPERADMIN/SadminSettings';
import SadminAccount from './pages/SUPERADMIN/SadminAccount';
import SadminPlans from './pages/SUPERADMIN/SadminPlans';
import SadminAdmin from 'pages/SUPERADMIN/SadminAdmin';
import SadminNotifications from './pages/SUPERADMIN/SadminNotifications';

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
              <ManageUsers />
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
              <ManageAds />
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
              <SadminDashboard />
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
        <Route
          path="/sadmin-notifications"
          element={
            <ProtectedRoute>
              <SadminNotifications />
            </ProtectedRoute>
          }
        />
         <Route
          path="/sadmin-admin"
          element={
            <ProtectedRoute>
              <SadminAdmin />
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
    <NotificationProvider>
      <div className="min-h-screen bg-white text-black">
        {/* Show navbar depending on user role */}
        {user?.role === 'USER' && <UserNavbar />}
        
        <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/landing" element={<Landing />} />
        <Route path="/forgot-password" element={<ForgotPass />} />

        {/* Protected user routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
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
              <PaymentHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-advertisement"
          element={
            <ProtectedRoute>
              <CreateAdvertisement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/advertisements"
          element={
            <ProtectedRoute>
              <Advertisements />
            </ProtectedRoute>
          }
        />
        <Route
          path="/advertisements/:id"
          element={
            <ProtectedRoute>
              <AdDetailsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ad-details/:id"
          element={
            <ProtectedRoute>
              <AdDetailsPage />
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
              <PaymentHistory />
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
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <Notifications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <Analytics />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profit-loss-analytics"
          element={
            <ProtectedRoute>
              <ProfitLossAnalytics />
            </ProtectedRoute>
          }
        />
        <Route
          path="/qr-analytics"
          element={
            <ProtectedRoute>
              <QRAnalytics />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ads-analytics"
          element={
            <ProtectedRoute>
              <AdsAnalytics />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tablet-analytics"
          element={
            <ProtectedRoute>
              <TabletAnalytics />
            </ProtectedRoute>
          }
        />

        {/* Default redirects */}
        <Route path="/" element={<Navigate to="/landing" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </div>
    </NotificationProvider>
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
        <Route path="*" element={<Navigate to="/landing" replace />} />
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
  
  // Wrap all routes with DeviceStatusProvider
  const content = (
    <DeviceStatusProvider>
      <AppContent />
    </DeviceStatusProvider>
  );

  // If we're on admin routes, only provide AdminAuthProvider
  if (isAdminRoute) {
    return (
      <AdminAuthProvider navigate={navigate}>
        {content}
      </AdminAuthProvider>
    );
  }
  
  // If we're on user routes, only provide UserAuthProvider
  if (isUserRoute) {
    return (
      <UserAuthProvider navigate={navigate}>
        {content}
      </UserAuthProvider>
    );
  }
  
  // For other routes (like home page), provide both contexts
  return (
    <UserAuthProvider navigate={navigate}>
      <AdminAuthProvider navigate={navigate}>
        {content}
      </AdminAuthProvider>
    </UserAuthProvider>
  );
};

export default App;
