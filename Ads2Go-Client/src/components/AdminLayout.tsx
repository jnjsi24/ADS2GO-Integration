import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminAuthProvider } from '../contexts/AdminAuthContext';
import AdminNavbar from './AdminNavbar';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const navigate = useNavigate();

  return (
    <AdminAuthProvider navigate={navigate}>
      <div className="min-h-screen bg-gray-100">
        <AdminNavbar />
        <main className="pl-64">
          {children}
        </main>
      </div>
    </AdminAuthProvider>
  );
};

export default AdminLayout;
