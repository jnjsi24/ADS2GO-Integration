import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUserAuth } from '../contexts/UserAuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import {
  LayoutDashboard,
  Megaphone,
  Settings,
  LogOut,
  CreditCard,
  HelpCircle,
  Bell,
  Info,
  User
} from 'lucide-react';

const SideNavbar: React.FC = () => {
  // Only get user data for profile display - navigation stays static
  const { user, logout } = useUserAuth();
  const { displayBadgeCount } = useNotifications();
  const navigate = useNavigate();
  const [isDropupOpen, setIsDropupOpen] = useState(false);
  const dropupRef = useRef<HTMLDivElement>(null);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/login');
  }, [logout, navigate]);

  const toggleDropup = useCallback(() => {
    setIsDropupOpen(prev => !prev);
  }, []);

  const closeDropup = useCallback(() => {
    setIsDropupOpen(false);
  }, []);

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

  const getInitials = useCallback((firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return '?';
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  }, []);

  const navLinks = useMemo(() => [
    { label: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/dashboard' },
    { label: 'Advertisements', icon: <Megaphone size={20} />, path: '/advertisements' },
    { label: 'Payment', icon: <CreditCard size={20} />, path: '/history' },
    { label: 'Help', icon: <HelpCircle size={20} />, path: '/help' },
    { label: 'About Us', icon: <Info size={20} />, path: '/about' },
  ], []);

  // Navigation item with smooth animations but static behavior
  const NavigationItem = React.memo(({ link }: { link: typeof navLinks[0] }) => (
    <li className="relative group">
      <Link
        to={link.path}
        className="nav-link relative flex items-center px-4 rounded-md py-2 overflow-hidden transition-all duration-300 ease-out text-gray-200 hover:text-white hover:bg-[#3367cc]"
      >
        {/* Background animation */}
        <span className="absolute left-0 top-0 w-0 h-full bg-[#3367cc] transition-all duration-300 ease-out group-hover:w-full rounded-md z-0"></span>

        <span className="relative z-10 flex items-center space-x-3">
          {link.icon}
          <span>{link.label}</span>
        </span>
      </Link>
    </li>
  ));


  // Only show navbar for authenticated users
  if (!user || user.role !== 'USER') {
    return null;
  }

  return (
    <>
      {/* CSS for smooth animations without flicker */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .nav-link {
            text-decoration: none !important;
            border: none !important;
            outline: none !important;
            will-change: transform, background-color, color;
            backface-visibility: hidden;
          }
          .nav-link:focus {
            outline: none !important;
          }
          .nav-link:visited {
            color: inherit !important;
          }
        `
      }} />
      
      {/* Static navbar with smooth animations */}
      <div 
        className="h-screen w-60 bg-[#1B4F9C] text-gray-200 flex flex-col justify-between fixed transition-all duration-500 ease-in-out"
        style={{
          willChange: 'auto',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 1000,
        }}
      >
      <div className="p-6">
        {/* Logo */}
        <div className="flex items-center pl-3 space-x-3 mb-10">
          <img src="/image/white-logo.png" alt="Logo" className="w-8 h-8" />
          <span className="text-2xl text-white font-bold">Ads2Go</span>
        </div>

        {/* Navigation - Completely Static */}
        <ul className="space-y-5 mt-16">
          {navLinks.map(link => (
            <NavigationItem 
              key={link.label} 
              link={link} 
            />
          ))}
        </ul>
      </div>

      {/* User Profile & Dropup Menu - Static */}
      <div className="p-6 relative">
        <div className="flex items-center justify-between mb-4">
          <div
            className="flex items-center space-x-3 cursor-pointer flex-1 hover:bg-gray-700 rounded-lg p-2 transition-all duration-300 ease-out"
            onClick={toggleDropup}
          >
            <div className="w-10 h-10 rounded-full bg-[#FF9D3D] flex items-center justify-center relative overflow-hidden">
              {user?.profilePicture ? (
                <img
                  src={user.profilePicture}
                  alt={`${user.firstName} ${user.lastName}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to initials if image fails to load
                    e.currentTarget.style.display = 'none';
                    const initialsSpan = e.currentTarget.nextElementSibling as HTMLElement;
                    if (initialsSpan) initialsSpan.style.display = 'flex';
                  }}
                />
              ) : null}
              <span 
                className="text-white font-semibold flex items-center justify-center w-full h-full"
                style={{ display: user?.profilePicture ? 'none' : 'flex' }}
              >
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
                <div className="space-y-1">
                  <div className="w-32 h-4 bg-gray-400 rounded animate-pulse"></div>
                  <div className="w-24 h-3 bg-gray-400 rounded animate-pulse"></div>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => navigate('/notifications')}
            className="relative p-2 text-gray-200 hover:text-white hover:bg-gray-700 rounded-lg transition-all duration-300 ease-out"
            title="View notifications"
          >
            <Bell size={20} />
            {/* Show notification count badge when there are unread notifications */}
            {displayBadgeCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {displayBadgeCount > 99 ? '99+' : displayBadgeCount}
              </span>
            )}
          </button>
        </div>

        {/* Dropup Menu */}
        <div 
          ref={dropupRef}
          className={`absolute bottom-20 left-6 right-6 bg-white rounded-lg shadow-lg border border-gray-200 transition-all duration-300 ease-in-out transform ${
            isDropupOpen 
              ? 'opacity-100 translate-y-0 scale-100' 
              : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
          }`}
        >
          <div className="py-2">
            <button
              onClick={() => {
                navigate('/account');
                closeDropup();
              }}
              className="w-full flex items-center space-x-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <User size={18} />
              <span>Profile</span>
            </button>
            
            <button
              onClick={() => {
                navigate('/settings');
                closeDropup();
              }}
              className="w-full flex items-center space-x-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Settings size={18} />
              <span>Settings</span>
            </button>
            
            <hr className="my-1" />
            
            <button
              onClick={() => {
                handleLogout();
                closeDropup();
              }}
              className="w-full flex items-center space-x-3 px-4 py-3 text-left text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
      </div>
    </>
  );
};

export default SideNavbar;
