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
import CreateAdvertisement from './pages/USERS/CreateAdvertisement';
import Advertisements from './pages/USERS/Advertisements';
import AdDetailsPage from './pages/USERS/AdDetailsPage';
import Help from './pages/USERS/Help';
import History from './pages/USERS/PaymentHistory';
import Settings from './pages/USERS/Settings';

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
import SadminDashboard from './pages/SUPERADMIN/SadminDashboard';
import SadminLogin from './pages/AUTH/SadminLogin'; // Import SadminLogin
import SadminAccount from './pages/SUPERADMIN/SadminAccount';
import SadminSettings from './pages/SUPERADMIN/SadminSettings'; 


const AppContent: React.FC = () => {
  const { user } = useAuth(); // Removed isLoadingAuth
  const location = useLocation();

  // Log the user role for debugging purposes
  console.log('Current User Role in AppContent:', user?.role);
  console.log('Current Pathname:', location.pathname);


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

  // If current path is a public page, no navbar shown
  if (hideNavbarOnRoutes.includes(location.pathname)) {
    return (
      <Routes>
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/sadmin-login" element={<SadminLogin />} /> {/* Sadmin Login Route */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPass />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/landing" element={<Landing />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Determine which Navbar to render based on user role
  let NavbarComponent = null;
  if (user?.role === 'SUPERADMIN') {
    NavbarComponent = SadminNavbar;
  } else if (user?.role === 'ADMIN') {
    NavbarComponent = AdminNavbar;
  } else if (user?.role === 'USER') {
    NavbarComponent = UserNavbar;
  }
  // If user is logged in but role is not recognized or is null/undefined, no navbar will be rendered here.
  // This prevents unintended navbars from showing.

  return (
    <div className="">
      {/* Render the appropriate Navbar if it exists */}
      {NavbarComponent && <NavbarComponent />}

      {/* Main content area, takes remaining width and accounts for sidebar */}
      {/* The ml-64 here assumes your sidebars are 60 units wide (w-60) + some padding/margin */}
        <Routes>
          {/* Public routes (already handled by hideNavbarOnRoutes, but kept for clarity if needed) */}
          <Route path="/login" element={<Login />} />
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/sadmin-login" element={<SadminLogin />} /> {/* Sadmin Login Route */}
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

          {/* Protected Admin Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole={['ADMIN', 'SUPERADMIN']}>
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


          {/* Protected SuperAdmin Route */}
          <Route
            path="/sadmin-dashboard"
            element={
              <ProtectedRoute requiredRole="SUPERADMIN">
                <SadminDashboard />
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
            path="/sadmin-settings"
            element={
              <ProtectedRoute>
                <SadminSettings />
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
