import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { useAdminNotifications } from '../contexts/AdminNotificationContext';
import {
  LayoutDashboard,
  Users,
  Bike,
  Package,
  FileText,
  Megaphone,
  LogOut,
  MapPin,
  HelpCircle,
  Mail,
  Bell,
  Settings,
  User,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AdminSidebar: React.FC = () => {
  const { logout, admin, isAuthenticated } = useAdminAuth();
  const { displayBadgeCount, unreadCount, enableNotificationBadge, notifications, isLoading, totalPendingCount, totalDisplayCount } = useAdminNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDropupOpen, setIsDropupOpen] = useState(false);
  const dropupRef = useRef<HTMLDivElement>(null);

  // Debug logging
  console.log('🔔 AdminNavbar Debug:', {
    displayBadgeCount,
    unreadCount,
    enableNotificationBadge,
    notificationsCount: notifications.length,
    unreadNotifications: notifications.filter(n => !n.read).length,
    totalPendingCount,
    totalDisplayCount,
    isLoading,
    admin: admin?.email,
  });

  const handleLogout = async () => {
    await logout();
    navigate('/admin-login');
    setIsDropupOpen(false);
  };

  const toggleDropup = () => {
    setIsDropupOpen((prev) => !prev);
  };

  const closeDropup = () => {
    setIsDropupOpen(false);
  };

  // Close dropup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropupRef.current && !dropupRef.current.contains(event.target as Node)) {
        closeDropup();
      }
    };
    if (isDropupOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropupOpen]);

  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return '?';
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const menuItems = [
    { label: 'Dashboard', path: '/admin', icon: <LayoutDashboard size={20} /> },
    { label: 'Advertisers', path: '/admin/users', icon: <Users size={20} /> },
    { label: 'Advertisements', path: '/admin/manage-ads', icon: <Megaphone size={20} /> },
    { label: 'Drivers', path: '/admin/drivers', icon: <Bike size={20} /> },
    { label: 'Devices', path: '/admin/materials', icon: <Package size={20} /> },
    { label: 'Devices Tracking', path: '/admin/tablet-tracking', icon: <MapPin size={20} /> },
    { label: 'Screen Control', path: '/admin/ads', icon: <Megaphone size={20} /> },
    { label: 'Newsletter', path: '/admin/newsletter', icon: <Mail size={20} /> },
    { label: 'Reports', path: '/admin/reports', icon: <FileText size={20} /> },
    { label: 'FAQs', path: '/admin/faq', icon: <HelpCircle size={20} /> },
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
      <div className="pt-5 text-sm text-gray-500 flex flex-col">
        {/* Profile Section with Dropup and Notification Bell */}
        <div className="flex items-center justify-between mb-4">
          <div
            className="flex items-center space-x-3 cursor-pointer hover:bg-black/10 flex-1 rounded-lg p-2 transition-all duration-300 ease-out"
            onClick={toggleDropup}
          >
            <div className="w-10 h-10 rounded-full bg-[#FF9D3D] flex items-center justify-center relative">
              <span className="text-white font-semibold">
                {admin ? getInitials(admin.firstName, admin.lastName) : '...'}
              </span>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></span>
            </div>
            <div>
              {admin ? (
                <p className="font-semibold text-gray-800">
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
            onClick={() => navigate('/admin/notifications')}
            className="relative p-2 text-black/70 hover:text-gray-600 transition-colors"
            title="Notifications"
          >
            <Bell className="h-5 w-5" />
            {totalDisplayCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {totalDisplayCount > 99 ? '99+' : totalDisplayCount}
              </span>
            )}
          </button>
        </div>
        {/* Dropup Menu */}
        <div ref={dropupRef}>
          <AnimatePresence>
            {isDropupOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
                className="absolute bottom-24 left-4 right-6 bg-white border border-white/30 rounded-lg shadow-lg w-52 overflow-hidden"
              >
                <div className="py-2">
                <button
                  onClick={() => {
                    navigate('/admin/account-settings');
                    closeDropup();
                  }}
                  className="w-full flex items-center space-x-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <User size={18} />
                  <span>Profile</span>
                </button>
                <button
                  onClick={() => {
                    navigate('/admin/notification-settings');
                    closeDropup();
                  }}
                  className="w-full flex items-center space-x-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Settings size={18} />
                  <span>Settings</span>
                </button>
                  <hr className="my-1" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center space-x-3 px-4 py-3 text-left text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={18} />
                    <span>Logout</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default AdminSidebar;