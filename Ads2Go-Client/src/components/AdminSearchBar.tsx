import React from 'react';
import * as FaIcons from 'react-icons/fa';

const FaSearch = FaIcons.FaSearch as React.FC<React.SVGProps<SVGSVGElement>>;

interface AdminSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const AdminSearchBar: React.FC<AdminSearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Quick search',
}) => {
  return (
    <div className="flex items-center bg-white border border-gray-300 rounded-md px-2 py-1 shadow-sm w-full max-w-xs">
      <button className="bg-[#0D2C54] p-2 rounded-md text-white flex items-center justify-center mr-2">
        <FaSearch className="text-white text-sm" />
      </button>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
      />
    </div>
  );
};

export default AdminSearchBar;
