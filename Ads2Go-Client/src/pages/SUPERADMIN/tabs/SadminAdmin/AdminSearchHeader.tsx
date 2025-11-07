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
    <div className="p-6 pb-0 pt-10 flex justify-between items-end">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900 mt-5">Admins</h1>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="text"
            className="text-xs text-black rounded-lg pl-5 py-3 w-80 shadow-md focus:outline-none bg-white"
            placeholder="Search admins..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          onClick={onCreateAdminClick}
          className="flex items-center bg-[#3674B5] text-white text-xs space-x-2 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 shadow-md hover:shadow-lg transition-colors"
        >
          <UserPlus size={18} />
          <span>Add New Admin</span>
        </button>
      </div>
    </div>
  );
};

export default AdminSearchHeader;
