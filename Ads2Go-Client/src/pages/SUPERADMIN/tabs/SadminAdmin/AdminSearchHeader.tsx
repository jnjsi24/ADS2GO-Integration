import React from 'react';
import { UserPlus, ArrowUp, ArrowDown } from 'lucide-react';

interface AdminSearchHeaderProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  sortOrder: 'newest' | 'oldest';
  setSortOrder: (order: 'newest' | 'oldest') => void;
  onCreateAdminClick: () => void;
}

const AdminSearchHeader: React.FC<AdminSearchHeaderProps> = ({
  searchTerm,
  setSearchTerm,
  sortOrder,
  setSortOrder,
  onCreateAdminClick,
}) => {
  return (
    <div className="p-4 sm:p-6 pb-0 pt-6 sm:pt-10 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
      <div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-900 mt-10 sm:mt-5">Admins</h1>
      </div>
      <div className="flex flex-row items-center gap-2 w-full sm:w-auto">
        <div className="relative flex-1 sm:flex-none sm:w-64 lg:w-80">
          <input
            type="text"
            className="text-xs text-black rounded-lg pl-4 sm:pl-5 py-2 sm:py-3 w-full shadow-md focus:outline-none bg-white"
            placeholder="Search admins..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          onClick={onCreateAdminClick}
          className="flex items-center justify-center bg-[#3674B5] text-white text-xs space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg shadow-md hover:shadow-lg transition-colors whitespace-nowrap flex-shrink-0"
        >
          <span className="sm:hidden">+</span>
          <UserPlus size={16} className="hidden sm:block sm:w-[18px] sm:h-[18px]" />
          <span className="whitespace-nowrap">
            <span className="sm:hidden">Add Admin</span>
            <span className="hidden sm:inline">Add New Admin</span>
          </span>
        </button>
      </div>
    </div>
  );
};

export default AdminSearchHeader;
