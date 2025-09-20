import React from 'react';
import { Search, UserPlus, ArrowUp, ArrowDown } from 'lucide-react';

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
    <div className="p-6 pb-0 flex justify-between items-end">
      <div>
        <h1 className="text-4xl mt-8 font-semibold text-gray-800">Admins</h1>
        <p className="text-gray-600 mt-2">Manage your admin accounts</p>
      </div>
      <div className="flex items-center space-x-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search admins..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-3xl text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <button
          onClick={onCreateAdminClick}
          className="flex items-center bg-[#3674B5] text-white text-xs space-x-2 px-4 py-3 border border-gray-300 rounded-3xl text-gray-700 hover:bg-[#0E2A47] transition-colors"
        >
          <UserPlus size={18} />
          <span>Add New Admin</span>
        </button>
        <button
          onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
          className="flex items-center space-x-2 px-4 py-3 border border-white rounded-3xl bg-[#1b5087] text-white text-xs hover:bg-[#0E2A47] transition-colors"
        >
          {sortOrder === 'newest' ? <ArrowUp size={18} /> : <ArrowDown size={18} />}
          <span>{sortOrder === 'newest' ? 'Newest' : 'Oldest'}</span>
        </button>
      </div>
    </div>
  );
};

export default AdminSearchHeader;
