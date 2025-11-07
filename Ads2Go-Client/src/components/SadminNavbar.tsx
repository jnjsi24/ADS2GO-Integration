// src/components/SadminNavbar.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  BarChart3,
  DollarSign,
  User,
  Bell,
  Calculator,
  Menu,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SadminNavbar: React.FC = () => {
  const { logout, admin } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDropupOpen, setIsDropupOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropupRef = useRef<HTMLDivElement>(null);
  const mobileDropupRef = useRef<HTMLDivElement>(null);

  const handleLogout = useCallback(async () => {
    await logout();
    setIsDropupOpen(false);
    setIsMobileMenuOpen(false);
  }, [logout]);

  const toggleDropup = useCallback(() => {
    setIsDropupOpen((prev) => !prev);
  }, []);

  const closeDropup = useCallback(() => {
    setIsDropupOpen(false);
  }, []);

  // Close dropup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const isClickInsideDropup = dropupRef.current?.contains(target);
      const isClickInsideMobileDropup = mobileDropupRef.current?.contains(target);
      const isClickOnProfileButton = target.closest('[data-profile-toggle]');
      const isClickOnNotificationButton = target.closest('button[title="View notifications"]');
      
      if (!isClickInsideDropup && !isClickInsideMobileDropup && !isClickOnProfileButton && !isClickOnNotificationButton) {
        closeDropup();
      }
    };

    if (isDropupOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropupOpen, closeDropup]);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (isMobileMenuOpen && !target.closest('.mobile-menu') && !target.closest('.hamburger-button')) {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobileMenuOpen]);

  const getInitials = useCallback((firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return '?';
    const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`;
    return initials.toUpperCase();
  }, []);

  const menuItems = [
    { label: 'Dashboard', path: '/sadmin-dashboard', icon: <LayoutDashboard size={20} /> },
    { label: 'Manage Admin', path: '/sadmin-admin', icon: <Users size={20} /> },
    { label: 'Pricing', path: '/sadmin-pricing', icon: <DollarSign size={20} /> },
    { label: 'Driver Salary', path: '/sadmin-driver-salary', icon: <Calculator size={20} /> },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[999] lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Hamburger Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="hamburger-button absolute top-4 left-4 z-[1100] p-2 lg:hidden transition-colors"
        aria-label="Toggle menu"
      >
        {!isMobileMenuOpen && <Menu size={24} className="text-gray-800" />}
      </button>

      {/* Mobile User Profile & Dropup Menu - Fixed Top Right */}
      <div className="absolute top-4 right-4 z-[1100] lg:hidden">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              navigate('/sadmin-notifications');
              setIsMobileMenuOpen(false);
            }}
            className="relative p-2 text-gray-800 hover:text-gray-900 transition-all duration-300 ease-out"
            title="View notifications"
          >
            <Bell size={20} />
            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              <span className="text-xs text-white font-bold">7</span>
            </div>
          </button>
          
          <div className="relative">
            <div
              data-profile-toggle
              className="cursor-pointer p-2 transition-all duration-300 ease-out"
              onClick={toggleDropup}
            >
              <div className="w-8 h-8 rounded-full flex border border-black/30 items-center justify-center relative overflow-hidden">
                {admin?.profilePicture ? (
                  <img
                    src={admin.profilePicture}
                    alt={`${admin.firstName} ${admin.lastName}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const initialsSpan = e.currentTarget.nextElementSibling as HTMLElement;
                      if (initialsSpan) initialsSpan.style.display = 'flex';
                    }}
                  />
                ) : null}
                <span 
                  className="text-black/70 font-semibold flex items-center justify-center w-full h-full text-xs bg-[#FF9D3D]"
                  style={{ display: admin?.profilePicture ? 'none' : 'flex' }}
                >
                  {admin ? getInitials(admin.firstName, admin.lastName) : '?'}
                </span>
              </div>
            </div>

            {/* Dropup Menu for Mobile */}
            <div 
              ref={mobileDropupRef}
              className={`absolute top-12 right-0 w-32
                        bg-white backdrop-blur-md border border-gray-200 rounded-lg shadow-lg
                        transition-all duration-300 ease-in-out transform ${
                          isDropupOpen 
                            ? 'opacity-100 translate-y-0 scale-100' 
                            : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
                        }`}
            >
              <div className="py-2">
                <button
                  onClick={() => {
                    navigate('/sadmin-account');
                    closeDropup();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center space-x-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <User size={18} />
                  <span>Profile</span>
                </button>
                
                <button
                  onClick={() => {
                    navigate('/sadmin-settings');
                    closeDropup();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center space-x-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <Settings size={18} />
                  <span>Settings</span>
                </button>
                
                <hr className="my-1" />
                
                <button
                  onClick={() => {
                    handleLogout();
                    closeDropup();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center space-x-3 px-4 py-3 text-left text-red-600 hover:text-red-400 transition-colors"
                >
                  <LogOut size={18} />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Static navbar with smooth animations - Desktop */}
      <div 
        className={`mobile-menu h-screen w-60 flex flex-col justify-between fixed transition-all duration-500 ease-in-out shadow-xl bg-white
                  ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{
          willChange: 'auto',
          transform: isMobileMenuOpen ? 'translateZ(0)' : undefined,
          backfaceVisibility: 'hidden',
          top: 0,
          left: 0,
          zIndex: 1000,
        }}
      >
        <div className="p-2">
          {/* Logo */}
          <div className="flex mt-12 items-center justify-center space-x-3 mb-10">
            <img src="/image/Ads2GoLogoText.png" alt="Logo" className="w-32 h-12" />
          </div>

          {/* Menu Items */}
          <nav className="flex flex-col space-y-4 text-black/60 text-md">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-1 ml-6 hover:text-[#3674B5] transition-colors ${
                  location.pathname === item.path ? 'text-[#3674B5] border-l-4 border-[#3674B5]/80 font-bold' : ''
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>

        {/* Profile Section with Dropup Menu - Desktop Only */}
        <div className="border-t border-gray-200 text-sm text-gray-500 p-4 relative hidden lg:block">
          <div className="flex items-center justify-between">
            {/* Profile Button */}
            <button
              data-profile-toggle
              onClick={toggleDropup}
              className="flex items-center space-x-3 cursor-pointer hover:bg-black/10 rounded-lg p-2 transition-all flex-1"
            >
              <div className="relative">
                {admin?.profilePicture ? (
                  <img
                    src={admin.profilePicture}
                    alt="Profile"
                    className="rounded-full w-10 h-10 object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#FF9D3D] flex items-center justify-center text-white font-semibold">
                    {admin ? getInitials(admin.firstName, admin.lastName) : '?'}
                  </div>
                )}
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
              </div>
              <div className="overflow-hidden text-left">
                <p className="font-semibold text-gray-800 truncate">
                  {admin ? `${admin.firstName || ''} ${admin.lastName || ''}` : 'SuperAdmin User'}
                </p>
              </div>
            </button>

            {/* Notifications Button */}
            <Link
              to="/sadmin-notifications"
              className="relative p-2 text-black/70 hover:text-gray-600 transition-colors hover:bg-black/10 rounded-lg"
              title="Notifications"
            >
              <Bell className="h-5 w-5" />
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-xs text-white font-bold">7</span>
              </div>
            </Link>
          </div>

          {/* Dropup Menu - Desktop Only */}
          <div ref={dropupRef}>
            <AnimatePresence>
              {isDropupOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute bottom-16 left-2 right-2 bg-white border rounded-lg shadow-lg overflow-hidden z-50"
                >
                  <div className="py-2">
                    <button
                      onClick={() => {
                        navigate('/sadmin-account');
                        closeDropup();
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <User size={18} />
                      <span>Profile</span>
                    </button>
                    <button
                      onClick={() => {
                        navigate('/sadmin-settings');
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
    </>
  );
};

export default SadminNavbar;