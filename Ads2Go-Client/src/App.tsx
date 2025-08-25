import React from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
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
import CreateAdForm from './pages/USERS/CreateAdFormNew';
import Advertisements from './pages/USERS/Advertisements';
import Help from './pages/USERS/Help';
import History from './pages/USERS/PaymentHistory';
import Settings from './pages/USERS/Settings';
import AdDetailsPage from './pages/USERS/AdDetailsPage'; // New import for AdDetailsPage

// Admin pages
import AdminLogin from './pages/AUTH/AdminLogin';
import AdminDashboard from './pages/ADMIN/AdminDashboard';
import ManageUsers from './pages/ADMIN/ManageUsers';
import SiteSettings from './pages/ADMIN/SiteSettings';
import ManageRiders from './pages/ADMIN/ManageRiders';
import AdminAdsControl from './pages/ADMIN/AdminAdsControl';
import Materials from './pages/ADMIN/Materials';
import Reports from './pages/ADMIN/Reports';

// Super Admin pages
import SuperAdminLogin from './pages/AUTH/SuperAdminLogin';
import SadminDashboard from './pages/SUPERADMIN/SadminDashboard';
import SadminSettings from './pages/SUPERADMIN/SadminSettings';
import SadminAccount from './pages/SUPERADMIN/SadminAccount';
import SadminPlans from './pages/SUPERADMIN/SadminPlans';

const AppContent: React.FC = () => {
  const { user } = useAuth();
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

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Show navbar depending on user role */}
      {user?.role === 'SUPERADMIN' && <SadminNavbar />}
      {user?.role === 'ADMIN' && <AdminNavbar />}
      {user?.role === 'USER' && <UserNavbar />}

      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/superadmin-login" element={<SuperAdminLogin />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />

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
          path="/payment"
          element={
            <ProtectedRoute>
              <Payment />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-advertisement"
          element={
            <ProtectedRoute>
              <CreateAdForm />
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
              <History />
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
          path="/ad-details/:id"
          element={
            <ProtectedRoute>
              <AdDetailsPage />
            </ProtectedRoute>
          }
          />

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
          path="/admin/settings"
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
        {/* NEW: Sadmin Account Page */}
        <Route
          path="/sadmin-account"
          element={
            <ProtectedRoute>
              <SadminAccount />
            </ProtectedRoute>
          }
        />
        {/* 👇 NEW */}
        <Route
          path="/sadmin-plans"
          element={
            <ProtectedRoute>
              <SadminPlans />
            </ProtectedRoute>
          }
        />

        {/* Default redirects */}
        <Route path="/" element={<Navigate to="/landing" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </div>
  );
};

const App: React.FC = () => {
  const navigate = useNavigate();
  return (
    <AuthProvider navigate={navigate}>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
