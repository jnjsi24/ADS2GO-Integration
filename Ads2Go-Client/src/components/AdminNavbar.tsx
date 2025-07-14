import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const AdminSidebar: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const menuItems = [
    { label: 'Dashboard', path: '/admin' },
    { label: 'View Users', path: '/admin/users' },
    { label: 'View Riders', path: '/admin/riders' },
    { label: 'Calendar', path: '/admin/calendar' },
    { label: 'Materials', path: '/admin/materials' },
    { label: 'Timesheet', path: '/admin/timesheet' },
    { label: 'Reports', path: '/admin/reports' },
    { label: 'AdsPanel', path: '/admin/ads' },
    { label: 'Settings', path: '/admin/settings' },
  ];

  return (
    <div className="h-screen w-64 bg-white border-r shadow-lg flex flex-col justify-between fixed">
      <div>
        {/* Profile */}
        <div className="flex items-center gap-3 p-4 border-b">
          <img
            src="https://via.placeholder.com/40" // replace with real avatar
            alt="Profile"
            className="rounded-full w-10 h-10"
          />
          <div className="font-semibold">Dominique Ch.</div>
        </div>

        {/* Menu Items */}
        <nav className="flex flex-col px-4 pt-4 space-y-2 text-gray-700">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-2 px-3 py-2 rounded-md hover:bg-blue-100 ${
                location.pathname === item.path ? 'bg-blue-200 font-semibold' : ''
              }`}
            >
              {/* Add icon here if needed */}
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Footer */}
      <div className="p-4 border-t text-sm text-gray-500">
        <button
          onClick={handleLogout}
          className="w-full text-left bg-red-100 text-red-600 hover:bg-red-200 px-3 py-2 rounded-md"
        >
          Logout
        </button>
        <div className="mt-2 text-xs">CAMIOCA<br />Version: 1.0.0.11</div>
      </div>
    </div>
  );
};

export default AdminSidebar;
