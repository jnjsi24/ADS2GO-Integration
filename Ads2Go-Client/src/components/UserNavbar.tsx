import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useUserAuth } from '../contexts/UserAuthContext';
import {
  LayoutDashboard,
  Megaphone,
  Settings,
  LogOut,
  CreditCard,
  HelpCircle,
  Bell
} from 'lucide-react';
import NotificationBell from './NotificationBell';

const SideNavbar: React.FC = () => {
  const { logout, user } = useUserAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return '?';
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const navLinks = [
    { label: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/dashboard' },
    { label: 'Advertisements', icon: <Megaphone size={20} />, path: '/advertisements' },
    { label: 'Payment History', icon: <CreditCard size={20} />, path: '/history' },
    { label: 'Notifications', icon: <Bell size={20} />, path: '/notifications' },
    { label: 'Settings', icon: <Settings size={20} />, path: '/settings' },
    { label: 'Help', icon: <HelpCircle size={20} />, path: '/help' },
  ];

  return (
    <div className="h-screen w-60 bg-[#1B4F9C] text-gray-200 flex flex-col justify-between fixed">
      <div className="p-6">
        {/* Logo */}
        <div className="flex items-center pl-3 space-x-3 mb-10">
          <img src="/image/white-logo.png" alt="Logo" className="w-8 h-8" />
          <span className="text-2xl text-white font-bold">Ads2Go</span>
        </div>

        {/* Navigation */}
        <ul className="space-y-5 mt-16">
          {navLinks.map(link => (
            <li key={link.label} className="relative group">
              <Link
                to={link.path}
                className={`relative flex items-center px-4 rounded-md py-2 overflow-hidden transition-colors ${
                  location.pathname === link.path
                    ? 'text-white font-bold bg-[#3367cc]'
                    : 'text-gray-200 hover:text-gray-300'
                }`}
              >
                {/* Background animation */}
                <span className="absolute left-0 top-0 w-0 h-full bg-[#3367cc] transition-all duration-300 ease-out group-hover:w-full rounded-md z-0"></span>

                <span className="relative z-10 flex items-center space-x-3">
                  {link.icon}
                  <span>{link.label}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* User Profile & Logout */}
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div
            className="flex items-center space-x-3 cursor-pointer flex-1"
            onClick={() => navigate('/account')}
          >
            <div className="w-10 h-10 rounded-full bg-[#FF9D3D] flex items-center justify-center relative">
              <span className="text-white font-semibold">
                {user ? getInitials(user.firstName, user.lastName) : '...'}
              </span>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></span>
            </div>
            <div>
              {user ? (
                <p className="font-semibold text-white">
                  {`${user.firstName} ${user.lastName}`}
                </p>
              ) : (
                <>
                  <p className="font-semibold text-gray-800">Loading...</p>
                  <p className="text-sm text-gray-500">Please wait</p>
                </>
              )}
            </div>
          </div>
          <NotificationBell />
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

export default SideNavbar;
