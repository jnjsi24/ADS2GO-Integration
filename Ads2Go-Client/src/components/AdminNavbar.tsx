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
  Menu,
  X,
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const dropupRef = useRef<HTMLDivElement>(null);

  // Responsive collapse based on window width
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768); // mobile breakpoint
      setIsCollapsed(width >= 768 && width < 1024); // tablet breakpoint
      if (width >= 768) {
        setIsMobileMenuOpen(false); // close mobile menu on larger screens
      }
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

  const sidebarWidth = isCollapsed ? (isHovered ? 240 : 64) : 240;

  return (
    <>
      {/* Mobile Menu Button */}
      {isMobile && (
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-lg text-black hover:bg-gray-100 transition-colors"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      )}

      {/* Overlay for mobile */}
      {isMobile && isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <motion.div
        className={`h-screen fixed flex flex-col justify-between bg-white shadow-lg z-40 ${
          isMobile ? (isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full') : ''
        }`}
        style={{ width: isMobile ? '240px' : `${sidebarWidth}px` }}
        onMouseEnter={() => !isMobile && isCollapsed && setIsHovered(true)}
        onMouseLeave={() => !isMobile && isCollapsed && setIsHovered(false)}
        animate={!isMobile ? { width: sidebarWidth } : {}}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
      <div className={`${isCollapsed && !isHovered ? 'p-2' : 'p-4'} overflow-y-auto flex-1 transition-all duration-300`}>
        {/* Logo */}
        <div className={`flex items-center mb-8 transition-all duration-300 ${
          isCollapsed && !isHovered ? 'pt-7 justify-center' : 'pl-2 pt-7 space-x-3'
        }`}>
          <img src="/image/blue-logo.png" alt="Logo" className="w-8 h-8 flex-shrink-0" />
          {(isMobile || !isCollapsed || isHovered) && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="text-2xl text-black font-bold whitespace-nowrap overflow-hidden"
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
              onClick={() => isMobile && setIsMobileMenuOpen(false)}
              className={`flex items-center gap-3 rounded-md text-sm pt-2 hover:bg-[#3674B5] hover:text-white transition-colors ${
                isCollapsed && !isHovered ? 'px-2 py-3 justify-center' : 'px-4 py-3'
              } ${
                location.pathname === item.path ? 'bg-[#3674B5] text-white font-semibold' : ''
              }`}
              title={isCollapsed && !isHovered ? item.label : undefined}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {(isMobile || !isCollapsed || isHovered) && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  className="whitespace-nowrap overflow-hidden"
                >
                  {item.label}
                </motion.span>
              )}
            </Link>
          ))}
        </nav>
      </div>

      {/* Profile + Notifications */}
      <div className={`border-t border-gray-200 text-sm text-gray-500 relative flex-shrink-0 transition-all duration-300 ${
        isCollapsed && !isHovered ? 'p-2' : 'p-4'
      }`}>
        <div className={`flex items-center ${isCollapsed && !isHovered ? 'flex-col gap-2' : 'justify-between'}`}>
          <div
            className={`flex items-center cursor-pointer hover:bg-black/10 rounded-lg p-2 transition-all ${
              isCollapsed && !isHovered ? 'justify-center' : 'space-x-3'
            }`}
            onClick={toggleDropup}
            title={isCollapsed && !isHovered ? (admin ? `${admin.firstName} ${admin.lastName}` : 'Profile') : undefined}
          >
            <div className="w-10 h-10 rounded-full bg-[#FF9D3D] flex items-center justify-center relative flex-shrink-0">
              <span className="text-white font-semibold">
                {admin ? getInitials(admin.firstName, admin.lastName) : '...'}
              </span>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></span>
            </div>
            {(isMobile || !isCollapsed || isHovered) && (
              <div className="overflow-hidden">
                <p className="font-semibold text-gray-800 truncate">
                  {admin ? `${admin.firstName} ${admin.lastName}` : 'Loading...'}
                </p>
              </div>
            )}
          </div>
          <button
            onClick={() => {
              navigate('/admin/notifications');
              isMobile && setIsMobileMenuOpen(false);
            }}
            className={`relative p-2 text-black/70 hover:text-gray-600 transition-colors ${
              isCollapsed && !isHovered ? 'hover:bg-black/10 rounded-lg' : ''
            }`}
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
                className="absolute bottom-16 left-2 right-2 bg-white border rounded-lg shadow-lg overflow-hidden"
              >
                <div className="py-2">
                  <button
                    onClick={() => {
                      navigate('/admin/account');
                      closeDropup();
                      isMobile && setIsMobileMenuOpen(false);
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
                      isMobile && setIsMobileMenuOpen(false);
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
    </>
  );
};

export default AdminSidebar;
