import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import {
  LayoutDashboard,
  Users,
  Bike,
  Package,
  FileText,
  Megaphone,
  LogOut,
  MapPin,
  Mail,
} from 'lucide-react';

const AdminSidebar: React.FC = () => {
  const { logout, admin } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/admin-login');
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return '?';
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const menuItems = [
    { label: 'Dashboard', path: '/admin', icon: <LayoutDashboard size={20} /> },
    { label: 'View Users', path: '/admin/users', icon: <Users size={20} /> },
    { label: 'View Riders', path: '/admin/riders', icon: <Bike size={20} /> },
    { label: 'Materials', path: '/admin/materials', icon: <Package size={20} /> },
    { label: 'Screen Tracking', path: '/admin/tablet-tracking', icon: <MapPin size={20} /> },
    { label: 'Newsletter', path: '/admin/newsletter', icon: <Mail size={20} /> },
    { label: 'Reports', path: '/admin/reports', icon: <FileText size={20} /> },
    { label: 'AdsPanel', path: '/admin/ads', icon: <Megaphone size={20} /> },
    { label: 'Manage Ads', path: '/admin/manage-ads', icon: <Megaphone size={20} /> },
  ];

  return (
    <div className="h-screen w-60 text-gray-300 flex flex-col justify-between fixed p-6">
      <div>
        <div className="flex items-center space-x-3 mb-10">
          <img src="/image/blue-logo.png" alt="Logo" className="w-8 h-8" />
          <span className="text-2xl text-black font-bold">Ads2Go</span>
        </div>

        <nav className="flex flex-col space-y-2 text-black">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-[#3674B5] hover:text-white ${
                location.pathname === item.path ? 'bg-[#3674B5] text-white font-semibold' : ''
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="pt-5 border-t border-gray-400 text-sm text-gray-500 flex flex-col">
        {/* Profile Section - FIXED: Navigate to admin settings */}
        <div
          className="flex items-center space-x-3 mb-4 cursor-pointer"
          onClick={() => navigate('/admin/SiteSettings')} // CHANGED THIS LINE
        >
          <div className="w-10 h-10 rounded-full bg-[#FF9D3D] flex items-center justify-center relative">
            <span className="text-white font-semibold">
              {admin ? getInitials(admin.firstName, admin.lastName) : '...'}
            </span>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></span>
          </div>
          <div>
            {admin ? (
              <p className="font-semibold ">
                {`${admin.firstName} ${admin.lastName}`}
              </p>
            ) : (
              <>
                <p className="font-semibold text-gray-800">Loading...</p>
                <p className="text-sm text-gray-500">Please wait</p>
              </>
            )}
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center space-x-2 text-sm text-[#FF2929] hover:text-red-500 transition px-4 py-2 rounded-lg bg-red-50"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default AdminSidebar;