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
  User,
  Menu,
  X
} from 'lucide-react';

const SideNavbar: React.FC = () => {
  // Only get user data for profile display - navigation stays static
  const { user, logout } = useUserAuth();
  const { displayBadgeCount } = useNotifications();
  const navigate = useNavigate();
  const [isDropupOpen, setIsDropupOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
  const NavigationItem = React.memo(({ link, isActive }: { link: typeof navLinks[0], isActive: boolean }) => (
    <li className="relative group">
      <Link
        to={link.path}
        onClick={() => setIsMobileMenuOpen(false)}
        className={`
          nav-link relative flex items-center px-4 py-2 overflow-hidden transition-all duration-300 ease-out
        `}
        style={{
          borderLeft: isActive ? '4px solid #3674B5' : '4px solid transparent',
          transition: 'border-left-color 0.3s ease-out',
          color: isActive ? '#1B5087' : '#374151',
          fontWeight: isActive ? 'bold' : 'normal',
          textDecoration: 'none',
          backgroundColor: 'transparent'
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.currentTarget.style.borderLeftColor = '#3674B5';
            e.currentTarget.style.color = '#1B5087';
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.borderLeftColor = 'transparent';
            e.currentTarget.style.color = '#374151';
          }
        }}
      >
        <span className="relative z-10 flex items-center space-x-3">
          {link.icon}
          <span>{link.label}</span>
        </span>
      </Link>
    </li>
  ));
  
  


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
            border-top: none !important;
            border-right: none !important;
            border-bottom: none !important;
            outline: none !important;
            will-change: transform, background-color, color, border-left-color;
            backface-visibility: hidden;
          }
          .nav-link:focus {
            outline: none !important;
          }
          .nav-link:visited {
            color: inherit !important;
          }
          .nav-link span {
            color: inherit !important;
          }
        `
      }} />

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
        className="hamburger-button fixed top-4 left-4 z-[1100] p-2 rounded-lg bg-white/10 shadow-lg lg:hidden hover:bg-gray-100 transition-colors"
        aria-label="Toggle menu"
      >
        {isMobileMenuOpen ? <X size={24} className="text-gray-800" /> : <Menu size={24} className="text-gray-800" />}
      </button>
      
      {/* Static navbar with smooth animations - Desktop */}
      <div 
        className={`mobile-menu h-screen w-60 flex flex-col justify-between fixed transition-all duration-500 ease-in-out shadow-xl
          bg-white/90 lg:bg-white/10
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


      <div className="p-6">
        {/* Logo */}
        <div className="flex mt-6 items-center pl-3 space-x-3 mb-10">
          <img src="/image/black-logo.png" alt="Logo" className="w-8 h-8" />
          <span className="text-2xl text-black/70 font-bold">Ads2Go</span>
        </div>

        {/* Navigation - Completely Static */}
        <ul className="space-y-5 mt-16">
          {navLinks.map(link => {
            const isActive = window.location.pathname === link.path;
            console.log(`Nav item ${link.label}: path=${link.path}, current=${window.location.pathname}, isActive=${isActive}`);
            return (
              <NavigationItem
                key={link.label}
                link={link}
                isActive={isActive}
              />
            );
          })}
        </ul>
      </div>

      {/* User Profile & Dropup Menu - Static */}
      <div className="p-6 relative">
        <div className="flex items-center justify-between mb-4">
          <div
            className="flex items-center space-x-3 cursor-pointer hover:bg-black/10 flex-1 rounded-lg p-2 transition-all duration-300 ease-out"
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
                className="text-black/70 font-semibold flex items-center justify-center w-full h-full"
                style={{ display: user?.profilePicture ? 'none' : 'flex' }}
              >
                {user ? getInitials(user.firstName, user.lastName) : '...'}
              </span>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></span>
            </div>
            <div>
              {user ? (
                <p className="font-bold text-black/70">
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
            className="relative p-2 text-black/70 hover:text-black/90 rounded-lg transition-all duration-300 ease-out"
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
          className={`absolute bottom-24 left-2 w-56
                    bg-white/20 backdrop-blur-md border border-white/30 rounded-lg shadow-lg
                    transition-all duration-300 ease-in-out transform ${
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
                setIsMobileMenuOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-4 py-3 text-left text-gray-700 hover:bg-white/30 transition-colors"
            >
              <User size={18} />
              <span>Profile</span>
            </button>
            
            <button
              onClick={() => {
                navigate('/settings');
                closeDropup();
                setIsMobileMenuOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-4 py-3 text-left text-gray-700 hover:bg-white/30 transition-colors"
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
    </>
  );
};

export default SideNavbar;
