import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  Bike,
  Package,
  FileText,
  Megaphone,
  LogOut,
} from 'lucide-react';

const AdminSidebar: React.FC = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Generate initials using firstName and lastName
  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return '?';
    const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`;
    return initials.toUpperCase();
  };

  const menuItems = [
    { label: 'Dashboard', path: '/admin', icon: <LayoutDashboard size={20} /> },
    { label: 'View Users', path: '/admin/users', icon: <Users size={20} /> },
    { label: 'View Riders', path: '/admin/riders', icon: <Bike size={20} /> },
    { label: 'Materials', path: '/admin/materials', icon: <Package size={20} /> },
    { label: 'Reports', path: '/admin/reports', icon: <FileText size={20} /> },
    { label: 'AdsPanel', path: '/admin/ads', icon: <Megaphone size={20} /> },
  ];

  return (
    <div className="w-60 bg-[#C9E6F0] fixed top-5 left-3 bottom-5 shadow-lg flex flex-col justify-between rounded-3xl p-6">
      <div>
        <div className="flex items-center space-x-3 mb-10">
          <img src="/image/blue-logo.png" alt="Logo" className="w-8 h-8" />
          <span className="text-2xl text-black font-bold">Ads2Go</span>
        </div>

        {/* Menu Items */}
        <nav className="flex flex-col space-y-2 text-black">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-3xl hover:bg-[#3674B5] hover:text-white ${
                location.pathname === item.path ? 'bg-[#3674B5] text-white font-semibold' : ''
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Footer combining Profile and Logout */}
      <div className="pt-4 border-t border-gray-400 text-sm text-gray-500 flex flex-col">
        {/* Profile Section */}
        <div className="flex items-center gap-3 pb-4 mb-4 cursor-pointer" onClick={() => navigate('/admin/settings')}>
          {user?.profilePicture ? (
            <img
              src={user.profilePicture}
              alt="Profile"
              className="rounded-full w-10 h-10 object-cover"
            />
          ) : (
            <div className="rounded-full w-10 h-10 bg-gray-500 flex items-center justify-center text-white font-semibold">
              {getInitials(user?.firstName, user?.lastName)}
            </div>
          )}
          <div className="font-semibold text-gray-800">
            {user ? `${user.firstName} ${user.lastName}` : 'Admin User'}
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full text-left bg-red-100 text-black hover:bg-red-200 px-3 py-2 rounded-3xl flex items-center gap-3"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default AdminSidebar;
