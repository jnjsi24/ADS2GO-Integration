import React, { useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  const materialOptions = [
  { label: 'All Materials', value: 'All' },  
  { label: 'LCD', value: 'LCD' },
  { label: 'Banner', value: 'BANNER' },
  { label: 'Sticker', value: 'STICKER' },
  { label: 'Headdress', value: 'HEADDRESS' },
  { label: 'Poster', value: 'POSTER' },
];


const statusOptions = [
  { label: 'All Status', value: 'All' }, 
  { label: 'Used', value: 'Used' },
  { label: 'Available', value: 'Available' },
];


  // State for animated dropdowns
  const [showMaterialDropdown, setShowMaterialDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  

  return (
    <div className="flex flex-col gap-3 mb-6">
      {/* First row: Heading + Filters */}
      <div className="flex justify-between items-center">
        {/* Heading */}
        <h1 className="text-3xl font-bold text-gray-800">Materials List</h1>

        {/* Filters */}
        <div className="flex gap-2">
          {/* Search */}
          <input
            type="text"
            className="text-xs text-black rounded-lg pl-5 py-3 w-80 shadow-md focus:outline-none bg-white"
            placeholder="Search materials..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />

          {/* Material Dropdown */}
          <div className="relative w-40">
            <button
              onClick={() => setShowMaterialDropdown(!showMaterialDropdown)}
              className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2"
            >
              {materialOptions.find(mat => mat.value === selectedType)?.label}
              <ChevronDown
                size={16}
                className={`transform transition-transform duration-200 ${
                  showMaterialDropdown ? 'rotate-180' : 'rotate-0'
                }`}
              />
            </button>
            <AnimatePresence>
              {showMaterialDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute z-10 top-full mt-2 w-full rounded-lg shadow-lg bg-white overflow-hidden"
                >
                  {materialOptions.map(mat => (
                    <button
                      key={mat.value}
                      onClick={() => {
                        onTypeChange(mat.value as typeof selectedType);
                        setShowMaterialDropdown(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-xs ml-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                    >
                      {mat.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Status Dropdown */}
          <div className="relative w-40">
            <button
              onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2"
            >
              {statusOptions.find(status => status.value === statusFilter)?.label}
              <ChevronDown
                size={16}
                className={`transform transition-transform duration-200 ${
                  showStatusDropdown ? 'rotate-180' : 'rotate-0'
                }`}
              />
            </button>
            <AnimatePresence>
              {showStatusDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute z-10 top-full mt-2 w-full rounded-lg shadow-lg bg-white overflow-hidden"
                >
                  {statusOptions.map(status => (
                    <button
                      key={status.value}
                      onClick={() => {
                        onStatusChange(status.value as typeof statusFilter);
                        setShowStatusDropdown(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-xs ml-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                    >
                      {status.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Second row: Create button */}
      <div className="flex justify-end">
        <button
          onClick={onCreateClick}
          className="py-3 bg-[#feb011] text-xs text-white rounded-lg w-40 hover:bg-[#FF9B45] hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2"
        >
          <Plus size={16} />
          Create Material
        </button>
      </div>
    </div>
  );
};

export default MaterialFilters;
