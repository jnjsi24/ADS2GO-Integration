import React from 'react';
import { ChevronDown, Plus } from 'lucide-react';

interface MaterialFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedType: 'All' | 'POSTER' | 'LCD' | 'STICKER' | 'HEADDRESS' | 'BANNER';
  onTypeChange: (value: 'All' | 'POSTER' | 'LCD' | 'STICKER' | 'HEADDRESS' | 'BANNER') => void;
  statusFilter: 'All' | 'Used' | 'Available';
  onStatusChange: (value: 'All' | 'Used' | 'Available') => void;
  onCreateClick: () => void;
}

const MaterialFilters: React.FC<MaterialFiltersProps> = ({
  searchTerm,
  onSearchChange,
  selectedType,
  onTypeChange,
  statusFilter,
  onStatusChange,
  onCreateClick
}) => {
  return (
    <div className="flex justify-between items-center mb-6">
      <h1 className="text-3xl font-bold text-gray-800">Materials List</h1>
      <div className="flex flex-col items-end gap-3">
        <div className="flex gap-2">
          <input
            type="text"
            className="text-xs text-black rounded-xl pl-5 py-3 w-80 shadow-md focus:outline-none bg-white"
            placeholder="Search materials..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <div className="relative w-40">
            <select
              className="appearance-none w-full text-xs text-black rounded-xl pl-5 pr-10 py-3 shadow-md focus:outline-none bg-white"
              value={selectedType}
              onChange={(e) => onTypeChange(e.target.value as typeof selectedType)}
            >
              <option value="All">All Materials</option>
              <option value="LCD">LCD</option>
              <option value="BANNER">BANNER</option>
              <option value="STICKER">STICKER</option>
              <option value="HEADDRESS">HEADDRESS</option>
              <option value="POSTER">POSTER</option>
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>
          </div>

          <div className="relative w-40">
            <select
              className="appearance-none w-full text-xs text-black rounded-xl pl-5 pr-10 py-3 shadow-md focus:outline-none bg-white"
              value={statusFilter}
              onChange={(e) => onStatusChange(e.target.value as typeof statusFilter)}
            >
              <option value="All">All Status</option>
              <option value="Used">Used</option>
              <option value="Available">Available</option>
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaterialFilters;
