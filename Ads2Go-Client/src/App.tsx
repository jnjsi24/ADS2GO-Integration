import React, { useEffect, useState, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { UserAuthProvider, useUserAuth } from './contexts/UserAuthContext';
import { AdminAuthProvider, useAdminAuth } from './contexts/AdminAuthContext';
import { DeviceStatusProvider } from './contexts/DeviceStatusContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { AdminNotificationSettingsProvider } from './contexts/AdminNotificationSettingsContext';
import { AdminNotificationProvider } from './contexts/AdminNotificationContext';
import ProtectedRoute from './components/ProtectedRoute';

// Import Navbars (keep these synchronous as they're used on every page)
import UserNavbar from './components/UserNavbar';
import AdminNavbar from './components/AdminNavbar';
import SadminNavbar from './components/SadminNavbar';

// ✅ PERFORMANCE OPTIMIZATION: Lazy load all pages for code splitting
// This reduces initial bundle size by ~60-70%

// Regular user pages - Lazy loaded
const Login = lazy(() => import('./pages/AUTH/Login'));
const Register = lazy(() => import('./pages/USERS/Register'));
const ForgotPass = lazy(() => import('./pages/USERS/ForgotPass'));
const Dashboard = lazy(() => import('./pages/USERS/Dashboard'));
const VerifyEmail = lazy(() => import('./pages/USERS/VerifyEmail'));
const Landing = lazy(() => import('./pages/USERS/Landing'));
const Account = lazy(() => import('./pages/USERS/Account'));
const Payment = lazy(() => import('./pages/USERS/Payment'));
const CreateAdvertisement = lazy(() => import('./pages/USERS/CreateAdvertisement'));
const Advertisements = lazy(() => import('./pages/USERS/Advertisements'));
const Help = lazy(() => import('./pages/USERS/Help'));
const About = lazy(() => import('./pages/USERS/About'));
const PaymentHistory = lazy(() => import('./pages/USERS/PaymentHistory'));
const Settings = lazy(() => import('./pages/USERS/Settings'));
const AdDetailsPage = lazy(() => import('./pages/USERS/AdDetailsPage'));
const DetailedAnalytics = lazy(() => import('./pages/USERS/DetailedAnalytics'));
const Notifications = lazy(() => import('./pages/USERS/Notifications'));
const GoogleOAuthCompletion = lazy(() => import('./pages/AUTH/GoogleOAuthCompletion'));
const GoogleOAuthCallback = lazy(() => import('./pages/AUTH/GoogleOAuthCallback'));

// Admin pages - Lazy loaded
const AdminLogin = lazy(() => import('./pages/AUTH/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/ADMIN/AdminDashboard'));
const ManageUsers = lazy(() => import('./pages/ADMIN/ManageUsers'));
const SiteSettings = lazy(() => import('./pages/ADMIN/SiteSettings'));
const ManageDrivers = lazy(() => import('./pages/ADMIN/ManageDrivers'));
const AdminAdsControl = lazy(() => import('./pages/ADMIN/AdminAdsControl'));
const Materials = lazy(() => import('./pages/ADMIN/Materials'));
const Reports = lazy(() => import('./pages/ADMIN/Reports'));
const ManageAds = lazy(() => import('./pages/ADMIN/ManageAds'));
const ScreenTracking = lazy(() => import('./pages/ADMIN/ScreenTracking'));
const FAQManagement = lazy(() => import('./pages/ADMIN/FAQManagement'));
const NewsletterManagement = lazy(() => import('./pages/ADMIN/NewsletterManagement'));
const UserAdsPage = lazy(() => import('./pages/ADMIN/UserAdsPage'));
const AdminNotifications = lazy(() => import('./pages/ADMIN/AdminNotifications'));
const AdminAccount = lazy(() => import('./pages/ADMIN/AdminAccount'));
const DeviceDataHistoryV2 = lazy(() => import('./pages/ADMIN/DeviceDataHistoryV2'));

// Super Admin pages - Lazy loaded
const SuperAdminLogin = lazy(() => import('./pages/AUTH/SuperAdminLogin'));
const SadminDashboard = lazy(() => import('./pages/SUPERADMIN/SadminDashboard'));
const SadminSettings = lazy(() => import('./pages/SUPERADMIN/SadminSettings'));
const SadminAccount = lazy(() => import('./pages/SUPERADMIN/SadminAccount'));
const SadminPricing = lazy(() => import('./pages/SUPERADMIN/SadminPricing'));
const SadminDriverSalary = lazy(() => import('./pages/SUPERADMIN/SadminDriverSalary'));
const SadminAdmin = lazy(() => import('./pages/SUPERADMIN/SadminAdmin'));
const SadminNotifications = lazy(() => import('./pages/SUPERADMIN/SadminNotifications'));
const SadminAnalytics = lazy(() => import('./pages/SUPERADMIN/SadminAnalytics'));

// Loading component for Suspense fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-white">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3674B5] mx-auto mb-4"></div>
      <p className="text-gray-600">Loading...</p>
    </div>
  </div>
);

// Initialize Firebase when the app starts
import('./firebase/init')
  .catch((error) => console.error('❌ Firebase initialization failed:', error));

// Separate components for admin and user routes to avoid conditional hooks
const AdminAppContent: React.FC = () => {
  const { admin } = useAdminAuth();
  
  return (
    <AdminNotificationSettingsProvider>
      <AdminNotificationProvider>
        <div className="min-h-screen bg-white text-black">
          {/* Show navbar depending on admin role */}
          {admin?.role === 'SUPERADMIN' && <SadminNavbar />}
          {admin?.role === 'ADMIN' && <AdminNavbar />}
      
      <Routes>
        {/* Public routes */}
        <Route 
          path="/admin-login" 
          element={
            <Suspense fallback={<PageLoader />}>
              <AdminLogin />
            </Suspense>
          } 
        />
        <Route 
          path="/sadmin-login" 
          element={
            <Suspense fallback={<PageLoader />}>
              <SuperAdminLogin />
            </Suspense>
          } 
        />

        {/* Protected Admin Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <AdminDashboard />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <ManageUsers />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/SiteSettings"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <SiteSettings />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/drivers"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <ManageDrivers />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/ads"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <AdminAdsControl />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/materials"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <Materials />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <Reports />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/manage-ads"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <ManageAds />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/faq"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <FAQManagement />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/newsletter"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <NewsletterManagement />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/account"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <AdminAccount />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/tablet-tracking"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <ScreenTracking />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/ads-by-user/:userId"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <UserAdsPage />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/notifications"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <AdminNotifications />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/device-data-history"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <DeviceDataHistoryV2 />
              </Suspense>
            </ProtectedRoute>
          }
        />

        {/* Protected SuperAdmin Routes */}
        <Route
          path="/sadmin-dashboard"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <SadminDashboard />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/sadmin-settings"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <SadminSettings />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/sadmin-account"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <SadminAccount />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/sadmin-pricing"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <SadminPricing />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/sadmin-driver-salary"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <SadminDriverSalary />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/sadmin-notifications"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <SadminNotifications />
              </Suspense>
            </ProtectedRoute>
          }
        />
         <Route
          path="/sadmin-admin"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <SadminAdmin />
              </Suspense>
            </ProtectedRoute>
          }
        /> 
        <Route
          path="/sadmin-analytics"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <SadminAnalytics />
              </Suspense>
            </ProtectedRoute>
          }
        />

        {/* Default redirects */}
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="*" element={<Navigate to="/admin-login" replace />} />
      </Routes>
      </div>
      </AdminNotificationProvider>
    </AdminNotificationSettingsProvider>
  );
};

const UserAppContent: React.FC = () => {
  const { user, isLoading, isInitialized } = useUserAuth();
  const location = useLocation();
  // Track viewport to differentiate mobile vs desktop
  const [isMobile, setIsMobile] = useState<boolean>(typeof window !== 'undefined' ? window.innerWidth < 1024 : false);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  // Hide user navbar on ad details pages only when on mobile view
  const isAdDetailsRoute = location.pathname.startsWith('/ad-details/') ||
                           /^\/advertisements\/[^/]+$/.test(location.pathname);
  const hideUserNavbar = isMobile && isAdDetailsRoute;
  
  return (
    <NotificationProvider>
      <div className="min-h-screen bg-white text-black">
        {/* Conditionally show navbar on mobile ad details only; always show on desktop */}
        {!hideUserNavbar && <UserNavbar />}
        
        {/* Main content with smooth transition */}
        <div className="transition-all duration-300 ease-in-out">
          <Routes>
        {/* Public routes */}
        <Route 
          path="/login" 
          element={
            <Suspense fallback={<PageLoader />}>
              <Login />
            </Suspense>
          } 
        />
        <Route 
          path="/register" 
          element={
            <Suspense fallback={<PageLoader />}>
              <Register />
            </Suspense>
          } 
        />
        <Route 
          path="/verify-email" 
          element={
            <Suspense fallback={<PageLoader />}>
              <VerifyEmail />
            </Suspense>
          } 
        />
        <Route 
          path="/landing" 
          element={
            <Suspense fallback={<PageLoader />}>
              <Landing />
            </Suspense>
          } 
        />
        <Route 
          path="/forgot-password" 
          element={
            <Suspense fallback={<PageLoader />}>
              <ForgotPass />
            </Suspense>
          } 
        />
        <Route 
          path="/auth/google/callback" 
          element={
            <Suspense fallback={<PageLoader />}>
              <GoogleOAuthCallback />
            </Suspense>
          } 
        />
        <Route 
          path="/auth/google/complete" 
          element={
            <Suspense fallback={<PageLoader />}>
              <GoogleOAuthCompletion 
                googleUserData={(() => {
                  try {
                    const data = sessionStorage.getItem('googleOAuthData');
                    return data ? JSON.parse(data) : null;
                  } catch (error) {
                    console.error('Error parsing Google OAuth data:', error);
                    return null;
                  }
                })()}
              />
            </Suspense>
          } 
        />

        {/* Protected user routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <Dashboard />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <Account />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/paymentHistory"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <PaymentHistory />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-advertisement"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <CreateAdvertisement />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/advertisements"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <Advertisements />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/advertisements/:id"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <AdDetailsPage />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/ad-details/:id"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <AdDetailsPage />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/help"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <Help />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/about"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <About />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <PaymentHistory />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <Settings />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/detailed-analytics"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <DetailedAnalytics />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <Notifications />
              </Suspense>
            </ProtectedRoute>
          }
        />

        {/* Default redirects */}
        <Route path="/" element={<Navigate to="/landing" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
        </div>
      </div>
    </NotificationProvider>
  );
};

const AppContent: React.FC = () => {
  const location = useLocation();
  
  const publicPages = [
    '/admin-login',
    '/sadmin-login',
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
        <Route 
          path="/admin-login" 
          element={
            <Suspense fallback={<PageLoader />}>
              <AdminLogin />
            </Suspense>
          } 
        />
        <Route 
          path="/sadmin-login" 
          element={
            <Suspense fallback={<PageLoader />}>
              <SuperAdminLogin />
            </Suspense>
          } 
        />
        <Route 
          path="/login" 
          element={
            <Suspense fallback={<PageLoader />}>
              <Login />
            </Suspense>
          } 
        />
        <Route 
          path="/register" 
          element={
            <Suspense fallback={<PageLoader />}>
              <Register />
            </Suspense>
          } 
        />
        <Route 
          path="/forgot-password" 
          element={
            <Suspense fallback={<PageLoader />}>
              <ForgotPass />
            </Suspense>
          } 
        />
        <Route 
          path="/verify-email" 
          element={
            <Suspense fallback={<PageLoader />}>
              <VerifyEmail />
            </Suspense>
          } 
        />
        <Route 
          path="/landing" 
          element={
            <Suspense fallback={<PageLoader />}>
              <Landing />
            </Suspense>
          } 
        />
        <Route path="*" element={<Navigate to="/landing" replace />} />
      </Routes>
    );
  }

  // Check if we're on admin routes to determine which content to show
  const isAdminRoute = location.pathname.startsWith('/admin') || 
                      location.pathname.startsWith('/sadmin') ||
                      location.pathname === '/admin-login' ||
                      location.pathname === '/sadmin-login';
  
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
                      location.pathname === '/sadmin-login';
  
  // Check if we're on user-related routes
  const isUserRoute = location.pathname.startsWith('/dashboard') || 
                     location.pathname.startsWith('/advertisements') ||
                     location.pathname.startsWith('/account') ||
                     location.pathname.startsWith('/settings') ||
                     location.pathname.startsWith('/payment') || // ✅ covers /payment
                     location.pathname.startsWith('/paymentHistory') || 
                     location.pathname === '/login' ||
                     location.pathname === '/register' ||
                     location.pathname === '/verify-email' ||
                     location.pathname === '/auth/google/callback' ||
                     location.pathname === '/auth/google/complete';
  
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
