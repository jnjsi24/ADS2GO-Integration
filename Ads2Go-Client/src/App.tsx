// Ads2Go-Client/src/App.tsx

import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import VerifiedRoute from './components/VerifiedRoute';

// Navbars
import UserNavbar from './components/UserNavbar';
import AdminNavbar from './components/AdminNavbar';
import SadminNavbar from './components/SadminNavbar';

// Public Pages
import Login from './pages/AUTH/Login';
import AdminLogin from './pages/AUTH/AdminLogin';
import Register from './pages/USERS/Register';
import ForgotPass from './pages/USERS/ForgotPass';
import VerifyEmail from './pages/USERS/VerifyEmail';

// Regular User Pages
import Landing from './pages/USERS/Landing';
import Dashboard from './pages/USERS/Dashboard';
import Settings from './pages/USERS/Settings';
import Payment from './pages/USERS/Payment';
import CreateAdvertisement from './pages/USERS/CreateAdvertisement';

// Admin Pages
import AdminDashboard from './pages/ADMIN/AdminDashboard';
import ManageUsers from './pages/ADMIN/ManageUsers';
import SiteSettings from './pages/ADMIN/SiteSettings';
import ManageRiders from './pages/ADMIN/ManageRiders';
import AdminAdsControl from './pages/ADMIN/AdminAdsControl';
import Materials from './pages/ADMIN/Materials';

// Super Admin Pages
import SadminDashboard from './pages/SUPERADMIN/SadminDashboard';

const AppContent: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  const hideNavbarOnRoutes = [
    '/admin-login',
    '/login',
    '/register',
    '/verify-email',
    '/forgot-password'
  ];

  const showNavbar = !hideNavbarOnRoutes.includes(location.pathname);

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Show Navbar only on authenticated pages */}
      {showNavbar && (
        <>
          {user?.role === 'SUPERADMIN' && <SadminNavbar />}
          {user?.role === 'ADMIN' && <AdminNavbar />}
          {user?.role === 'USER' && <UserNavbar />}
        </>
      )}

      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPass />} />
        <Route path="/verify-email" element={<VerifyEmail />} />

        {/* Regular User Routes - Hybrid Approach */}
        <Route path="/landing" element={
          <PrivateRoute><Landing /></PrivateRoute>
        } />
        <Route path="/dashboard" element={
          <PrivateRoute><Dashboard /></PrivateRoute>
        } />
        <Route path="/settings" element={
          <PrivateRoute><Settings /></PrivateRoute>
        } />
        <Route path="/payment" element={
          <VerifiedRoute><Payment /></VerifiedRoute>
        } />
        <Route path="/create-advertisement" element={
          <VerifiedRoute><CreateAdvertisement /></VerifiedRoute>
        } />

        {/* Admin Private Routes */}
        <Route path="/admin" element={
          <PrivateRoute><AdminDashboard /></PrivateRoute>
        } />
        <Route path="/admin/users" element={
          <PrivateRoute><ManageUsers /></PrivateRoute>
        } />
        <Route path="/admin/settings" element={
          <PrivateRoute><SiteSettings /></PrivateRoute>
        } />
        <Route path="/admin/riders" element={
          <PrivateRoute><ManageRiders /></PrivateRoute>
        } />
        <Route path="/admin/ads" element={
          <PrivateRoute><AdminAdsControl /></PrivateRoute>
        } />
        <Route path="/admin/materials" element={
          <PrivateRoute><Materials /></PrivateRoute>
        } />

        {/* Super Admin Private Route */}
        <Route path="/sadmin-dashboard" element={
          <PrivateRoute><SadminDashboard /></PrivateRoute>
        } />

        {/* Default Routes */}
        <Route path="/" element={<Navigate to="/landing" />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </div>
  );
};

const App: React.FC = () => {
  return <AppContent />;
};

export default App;
