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
  const { logout, admin } = useAdminAuth();
  const { totalDisplayCount } = useAdminNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  const [isDropupOpen, setIsDropupOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dropupRef = useRef<HTMLDivElement>(null);

  // Responsive collapse based on window width
  useEffect(() => {
    const handleResize = () => {
      setIsCollapsed(window.innerWidth < 1024); // collapse if below lg breakpoint
    };
    handleResize(); // run initially
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = async () => {
    await logout();
    setIsDropupOpen(false);
  };

  const toggleDropup = () => setIsDropupOpen((prev) => !prev);
  const closeDropup = () => setIsDropupOpen(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropupRef.current && !dropupRef.current.contains(event.target as Node)) {
        closeDropup();
      }
    };
    if (isDropupOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropupOpen]);

  const getInitials = (firstName?: string, lastName?: string) =>
    !firstName && !lastName ? '?' : `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();

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

  const sidebarWidth = isCollapsed ? (isHovered ? 'w-60' : 'w-16') : 'w-60';

  return (
    <motion.div
      className={`h-screen fixed flex flex-col justify-between bg-white shadow-lg transition-all duration-300 z-40`}
      onMouseEnter={() => isCollapsed && setIsHovered(true)}
      onMouseLeave={() => isCollapsed && setIsHovered(false)}
      animate={{ width: sidebarWidth }}
    >
      <div className="p-4">
        {/* Logo */}
        <div className="flex items-center pl-2 pt-7 space-x-3 mb-8">
          <img src="/image/blue-logo.png" alt="Logo" className="w-8 h-8" />
          {(!isCollapsed || isHovered) && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-2xl text-black font-bold whitespace-nowrap"
            >
              Ads2Go
            </motion.span>
          )}
        </div>

        {/* Menu Items */}
        <nav className="flex flex-col space-y-2 text-black">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-md text-sm hover:bg-[#3674B5] hover:text-white ${
                location.pathname === item.path ? 'bg-[#3674B5] text-white font-semibold' : ''
              }`}
            >
              {item.icon}
              {(!isCollapsed || isHovered) && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="whitespace-nowrap"
                >
                  {item.label}
                </motion.span>
              )}
            </Link>
          ))}
        </nav>
      </div>

      {/* Profile + Notifications */}
      <div className="p-4 border-t border-gray-200 text-sm text-gray-500 relative">
        <div className="flex items-center justify-between">
          <div
            className="flex items-center space-x-3 cursor-pointer hover:bg-black/10 rounded-lg p-2 transition-all"
            onClick={toggleDropup}
          >
            <div className="w-10 h-10 rounded-full bg-[#FF9D3D] flex items-center justify-center relative">
              <span className="text-white font-semibold">
                {admin ? getInitials(admin.firstName, admin.lastName) : '...'}
              </span>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></span>
            </div>
            {(!isCollapsed || isHovered) && (
              <div>
                <p className="font-semibold text-gray-800">
                  {admin ? `${admin.firstName} ${admin.lastName}` : 'Loading...'}
                </p>
              </div>
            )}
          </div>
          {(!isCollapsed || isHovered) && (
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
          )}
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
                className="absolute bottom-16 left-2 bg-white border rounded-lg shadow-lg w-52 overflow-hidden"
              >
                <div className="py-2">
                  <button
                    onClick={() => {
                      navigate('/admin/account');
                      closeDropup();
                    }}
                    className="w-full flex items-center space-x-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <User size={18} />
                    <span>Profile</span>
                  </button>
                  <button
                    onClick={() => {
                      navigate('/admin/SiteSettings');
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
                    className="w-full flex items-center space-x-3 px-4 py-3 text-left text-red-600 hover:text-red-400 transition-colors"
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
    </motion.div>
  );
};

export default AdminSidebar;
