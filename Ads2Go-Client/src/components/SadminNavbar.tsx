// src/components/SadminNavbar.tsx
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  FileText, // Assuming you might need this for reports or other admin-like sections
} from 'lucide-react';

const SadminNavbar: React.FC = () => {
  const { logout, user } = useAuth(); // Use the useAuth hook
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/sadmin-login'); // Redirect to general login after logout
  };

  // Generate initials using firstName and lastName (similar to AdminNavbar/UserNavbar)
  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return '?';
    const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`;
    return initials.toUpperCase();
  };

  const menuItems = [
    { label: 'Dashboard', path: '/sadmin-dashboard', icon: <LayoutDashboard size={20} /> },
    { label: 'Settings', path: '/sadmin-settings', icon: <Settings size={20} /> }, // Assuming /admin/settings is where superadmin manages general settings
    // Add more SuperAdmin specific links if needed
  ];

  return (
    <div className="w-64 h-full bg-[#0E2A47] fixed shadow-2xl text-white flex flex-col justify-between pt-10 p-6"> {/* Distinct color for SadminNavbar */}
      <div>
        {/* Logo */}
        <div className="flex items-center space-x-3 mb-10">
          {/* Placeholder for SuperAdmin Logo */}
          <img alt="Ads2Go SAdmin Logo" className="mx-auto w-8 h-8 " src="https://placehold.co/32x32/0E2A47/FFFFFF?text=S" />
          <span className="text-2xl text-white font-bold">SuperAdmin</span>
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

      {/* Footer combining Profile and Logout */}
      <div className="pt-4 border-t border-gray-600 text-sm text-gray-200 flex flex-col">
        {/* Profile Section */}
        <div className="flex items-center gap-3 pb-4 mb-4 cursor-pointer" onClick={() => navigate('/sadmin-account')}> {/* Assuming settings page is shared or sadmin has a dedicated one */}
          {user?.profilePicture ? ( // Assuming user object might have a profilePicture
            <img
              src={user.profilePicture}
              alt="Profile"
              className="rounded-full w-10 h-10 object-cover"
            />
          ) : (
            <div className="rounded-full w-10 h-10 bg-[#FF9D3D] flex items-center justify-center text-white font-semibold">
              {user ? getInitials(user.firstName, user.lastName) : '?'}
            </div>
          )}
          <div className="font-semibold text-white">
            {user ? `${user.firstName || ''} ${user.lastName || ''}` : 'SuperAdmin User'}
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full text-left bg-red-700 text-white hover:bg-red-800 px-3 py-2 rounded-xl flex items-center gap-3 transition"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default SadminNavbar;


//








