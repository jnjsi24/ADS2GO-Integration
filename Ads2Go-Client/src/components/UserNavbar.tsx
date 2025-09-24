import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useUserAuth } from '../contexts/UserAuthContext';
import {
  LayoutDashboard,
  Megaphone,
  Settings,
  LogOut,
  CreditCard,
  HelpCircle
} from 'lucide-react';

const DrawOutlineLink = ({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) => (
  <Link
    to={to}
    className={`
      group relative flex items-center px-4 py-2 font-medium
      transition-colors duration-[400ms]
      ${active ? 'text-white bg-[#185ADB]' : 'text-white/90 hover:text-white'}
    `}
  >
    <span className="relative z-10 flex items-center space-x-3">{children}</span>

    {/* TOP */}
    <span className="absolute left-0 top-0 h-[2px] w-0 bg-[#185ADB] transition-all duration-100 group-hover:w-full" />
    {/* RIGHT */}
    <span className="absolute right-0 top-0 h-0 w-[2px] bg-[#185ADB] transition-all delay-100 duration-100 group-hover:h-full" />
    {/* BOTTOM */}
    <span className="absolute bottom-0 right-0 h-[2px] w-0 bg-[#185ADB] transition-all delay-200 duration-100 group-hover:w-full" />
    {/* LEFT */}
    <span className="absolute bottom-0 left-0 h-0 w-[2px] bg-[#185ADB] transition-all delay-300 duration-100 group-hover:h-full" />
  </Link>
);

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
    { label: 'Settings', icon: <Settings size={20} />, path: '/settings' },
    { label: 'Help', icon: <HelpCircle size={20} />, path: '/help' },
  ];

  return (
<div className="bg-black/20 backdrop-blur-md shadow-inner fixed rounded-lg top-3 bottom-3 left-3 p-3 flex flex-col justify-between z-50 w-64">
      <div className="p-3">
        {/* Logo */}
        <div className="flex items-center pl-5 mt-5 space-x-3 mb-10">
          <img src="/image/white-logo.png" alt="Logo" className="w-8 h-8" />
          <span className="text-white/80 text-2xl font-bold">Ads2Go</span>
        </div>

        {/* Navigation with Outline Animation */}
        <ul className="space-y-5 mt-16">
          {navLinks.map(link => (
            <li key={link.label}>
              <DrawOutlineLink to={link.path} active={location.pathname === link.path}>
                {link.icon}
                <span>{link.label}</span>
              </DrawOutlineLink>
            </li>
          ))}
        </ul>
      </div>

      {/* User Profile & Logout */}
      <div className="p-4">
        <div
          className="flex items-center space-x-3 mb-4 cursor-pointer"
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
              <p className="font-semibold text-white/80">{`${user.firstName} ${user.lastName}`}</p>
            ) : (
              <>
                <p className="font-semibold text-gray-300">Loading...</p>
                <p className="text-sm text-gray-400">Please wait</p>
              </>
            )}
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center space-x-2 text-sm text-red-300 hover:text-red-500 transition px-4 py-2 bg-red-50/10 border border-red-500/20"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default SideNavbar;
