// src/components/SadminNavbar.tsx
import React from 'react';
import { Link } from 'react-router-dom';

const SadminNavbar: React.FC = () => {
  return (
    <nav className="bg-indigo-600 p-4">
      <ul className="flex space-x-4">
        <li><Link to="/sadmin-dashboard" className="text-white">Dashboard</Link></li>
        <li><Link to="/admin/users" className="text-white">Manage Admins</Link></li>
        <li><Link to="/admin/settings" className="text-white">Settings</Link></li>
      </ul>
    </nav>
  );
};

export default SadminNavbar;
