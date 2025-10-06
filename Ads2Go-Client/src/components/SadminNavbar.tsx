// src/components/SadminNavbar.tsx
import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';

const SadminNavbar: React.FC = () => {
  const { logout, admin } = useAdminAuth(); // Use the useAdminAuth hook
  const navigate = useNavigate();
  const location = useLocation();
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/superadmin-login'); // Redirect to superadmin login after logout
  };

  // Generate initials using firstName and lastName (similar to AdminNavbar/UserNavbar)
  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return '?';
    const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`;
    return initials.toUpperCase();
  };

  const menuItems = [
    { label: 'Dashboard', path: '/sadmin-dashboard', icon: <LayoutDashboard size={20} /> },
    { label: 'Analytics', path: '/sadmin-analytics', icon: <BarChart3 size={20} /> },
    { label: 'Manage Admin', path: '/sadmin-admin', icon: <Users size={20} /> },
    { label: 'Pricing', path: '/sadmin-pricing', icon: <DollarSign size={20} /> },
    { label: 'Settings', path: '/sadmin-settings', icon: <Settings size={20} /> },
  ];

  return (
    <div className="w-64 h-full bg-[#0E2A47] fixed shadow-2xl text-white flex flex-col justify-between pt-10 p-4"> {/* Distinct color for SadminNavbar */}
      <div>
        {/* Logo */}
        <div className="flex space-x-3 mb-10">
          {/* Placeholder for SuperAdmin Logo */}
          <img alt="Ads2Go SAdmin Logo" className="w-8 h-8 " src="https://placehold.co/32x32/0E2A47/FFFFFF?text=S" />
          <span className="text-2xl mr-20 text-white font-bold">SuperAdmin</span>
        </div>

        {/* Menu Items */}
        <nav className="flex flex-col space-y-2 pt-5 text-white text-lg">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[#1b5087] hover:text-white transition hover:scale-105 duration-300 ${
                location.pathname === item.path ? 'bg-[#1b5087] font-semibold' : ''
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>

      {/* Profile Section with Dropdown */}
      <div ref={dropdownRef} className="pt-4 text-sm text-gray-200 relative">
        {/* Profile Bar */}
        <button
          onClick={() => setShowProfileDropdown(!showProfileDropdown)}
          className="w-full flex items-center justify-between rounded-lg p-3 mb-2 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            {admin?.profilePicture ? (
              <img
                src={admin.profilePicture}
                alt="Profile"
                className="rounded-full w-10 h-10 object-cover"
              />
            ) : (
              <div className="relative">
                <div className="rounded-full w-10 h-10 bg-[#FF9D3D] flex items-center justify-center text-white font-semibold">
                  {admin ? getInitials(admin.firstName, admin.lastName) : '?'}
                </div>
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0E2A47]"></div>
              </div>
            )}
            <div className="font-semibold text-left ml-1 text-white">
              {admin ? `${admin.firstName || ''} ${admin.lastName || ''}` : 'SuperAdmin User'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative text-gray-300">
              <Bell size={18} />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-xs text-white font-bold">7</span>
              </div>
            </div>
          </div>
        </button>

        {/* Dropdown Menu */}
        {showProfileDropdown && (
          <div className="absolute bottom-16 w-56 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
            <div className="py-2">
              {/* Profile Option */}
              <button
                onClick={() => {
                  navigate('/sadmin-account');
                  setShowProfileDropdown(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <User size={18} className="text-gray-500" />
                <span>Profile</span>
              </button>

              {/* Settings Option */}
              <button
                onClick={() => {
                  navigate('/sadmin-settings');
                  setShowProfileDropdown(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <Settings size={18} className="text-gray-500" />
                <span>Settings</span>
              </button>

              {/* Divider */}
              <div className="border-t border-gray-200 my-1"></div>

              {/* Logout Option */}
              <button
                onClick={() => {
                  handleLogout();
                  setShowProfileDropdown(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut size={18} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SadminNavbar;


//








