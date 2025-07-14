import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Home,
  Settings,
  LogOut,
  CreditCard,
  Users,
  HelpCircle
} from 'lucide-react';

const SideNavbar: React.FC = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getInitials = (name?: string) => {
    if (!name) return '?';
    const names = name.split(' ');
    return names.map(n => n[0]).join('').toUpperCase();
  };

  const navLinks = [
    { label: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/dashboard' },
    { label: 'Home', icon: <Home size={20} />, path: '/home' },
    { label: 'Settings', icon: <Settings size={20} />, path: '/settings' },
    { label: 'Payment', icon: <CreditCard size={20} />, path: '/payment' },
    { label: 'Accounts', icon: <Users size={20} />, path: '/accounts' },
    { label: 'Help', icon: <HelpCircle size={20} />, path: '/help' },
  ];

  return (
    <div className="h-screen w-64 bg-[#0F172A] text-white flex flex-col justify-between shadow-xl fixed">
      <div className="p-6">
        {/* Logo */}
        <div className="flex items-center space-x-3 mb-10">
          <img src="/image/white-logo.png" alt="Logo" className="w-8 h-8" />
          <span className="text-2xl font-bold">Ads2Go</span>
        </div>

        {/* Navigation */}
        <ul className="space-y-2">
          {navLinks.map(link => (
            <li key={link.label}>
              <Link
                to={link.path}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-[#1E293B] transition ${
                  location.pathname === link.path ? 'bg-[#1E293B]' : ''
                }`}
              >
                {link.icon}
                <span>{link.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* User Profile & Logout */}
      <div className="p-6 border-t border-gray-700 flex items-center justify-between">
        <div
          className="w-10 h-10 rounded-full bg-[#FF9D3D] flex items-center justify-center cursor-pointer hover:bg-[#F6C794]"
          onClick={() => navigate('/settings')}
        >
          <span className="text-white font-semibold">{getInitials(user?.name)}</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center space-x-2 text-sm text-red-400 hover:text-red-500 transition"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default SideNavbar;
