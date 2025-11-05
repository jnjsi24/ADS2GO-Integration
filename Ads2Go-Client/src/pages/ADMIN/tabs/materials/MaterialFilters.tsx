import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MaterialFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedType: 'All' | 'POSTER' | 'LCD' | 'STICKER' | 'HEADDRESS' | 'BANNER';
  onTypeChange: (value: 'All' | 'POSTER' | 'LCD' | 'STICKER' | 'HEADDRESS' | 'BANNER') => void;
  statusFilter: 'All' | 'Used' | 'Available';
  onStatusChange: (value: 'All' | 'Used' | 'Available') => void;
  sortBy: string;
  onSortChange: (value: string) => void;
}

const MaterialFilters: React.FC<MaterialFiltersProps> = ({
  searchTerm,
  onSearchChange,
  selectedType,
  onTypeChange,
  statusFilter,
  onStatusChange,
  sortBy,
  onSortChange,
}) => {
  const materialOptions = [
    { label: 'All Devices', value: 'All' },
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

  const sortByOptions = ['Newest First', 'Oldest First', 'ID: Low to High', 'ID: High to Low'];

  const [showMaterialDropdown, setShowMaterialDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile screen width
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex flex-col gap-3 mb-6">
      {/* First Row: Heading + Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        {/* Heading */}
        <h1
          className={`text-2xl md:text-3xl font-bold text-gray-800 ${
            isMobile ? 'pt-10' : ''
          }`}
        >
          Devices List
        </h1>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
          {/* Search */}
          <input
            type="text"
            className="text-xs text-black rounded-lg pl-5 py-3 w-full md:w-80 shadow-md focus:outline-none bg-white"
            placeholder="Search devices..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />

          {/* For mobile: status + material filters side by side */}
          {isMobile ? (
            <>
              <div className="flex gap-2 w-full">
                {/* Status Dropdown */}
                <div className="relative flex-1">
                  <button
                    onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                    className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-4 pr-3 py-3 shadow-md focus:outline-none bg-white gap-2"
                  >
                    {statusOptions.find((s) => s.value === statusFilter)?.label}
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
                        {statusOptions.map((status) => (
                          <button
                            key={status.value}
                            onClick={() => {
                              onStatusChange(status.value as typeof statusFilter);
                              setShowStatusDropdown(false);
                            }}
                            className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100"
                          >
                            {status.label}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Material Dropdown */}
                <div className="relative flex-1">
                  <button
                    onClick={() => setShowMaterialDropdown(!showMaterialDropdown)}
                    className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-4 pr-3 py-3 shadow-md focus:outline-none bg-white gap-2"
                  >
                    {materialOptions.find((m) => m.value === selectedType)?.label}
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
                        {materialOptions.map((mat) => (
                          <button
                            key={mat.value}
                            onClick={() => {
                              onTypeChange(mat.value as typeof selectedType);
                              setShowMaterialDropdown(false);
                            }}
                            className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100"
                          >
                            {mat.label}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Sort Dropdown (Mobile) */}
              <div className="relative w-full">
                <button
                  onClick={() => setShowSortDropdown(!showSortDropdown)}
                  className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-4 pr-3 py-3 shadow-md focus:outline-none bg-white gap-2"
                >
                  <span className="truncate">{sortBy}</span>
                  <ChevronDown
                    size={16}
                    className={`transform transition-transform duration-200 ${
                      showSortDropdown ? 'rotate-180' : 'rotate-0'
                    }`}
                  />
                </button>
                <AnimatePresence>
                  {showSortDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute z-10 top-full mt-2 w-full rounded-lg shadow-lg bg-white overflow-hidden"
                    >
                      {sortByOptions.map((option) => (
                        <button
                          key={option}
                          onClick={() => {
                            onSortChange(option);
                            setShowSortDropdown(false);
                          }}
                          className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100"
                        >
                          {option}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          ) : (
            // Desktop Filters (unchanged)
            <>
              {/* Material Dropdown */}
              <div className="relative w-full md:w-40">
                <button
                  onClick={() => setShowMaterialDropdown(!showMaterialDropdown)}
                  className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2"
                >
                  {materialOptions.find((mat) => mat.value === selectedType)?.label}
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
                      {materialOptions.map((mat) => (
                        <button
                          key={mat.value}
                          onClick={() => {
                            onTypeChange(mat.value as typeof selectedType);
                            setShowMaterialDropdown(false);
                          }}
                          className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100"
                        >
                          {mat.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Status Dropdown */}
              <div className="relative w-full md:w-40">
                <button
                  onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                  className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2"
                >
                  {statusOptions.find((s) => s.value === statusFilter)?.label}
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
                      {statusOptions.map((status) => (
                        <button
                          key={status.value}
                          onClick={() => {
                            onStatusChange(status.value as typeof statusFilter);
                            setShowStatusDropdown(false);
                          }}
                          className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100"
                        >
                          {status.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Sort Dropdown (Desktop) */}
              <div className="relative w-full md:w-40">
                <button
                  onClick={() => setShowSortDropdown(!showSortDropdown)}
                  className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2"
                >
                  <span className="truncate">{sortBy}</span>
                  <ChevronDown
                    size={16}
                    className={`transform transition-transform duration-200 ${
                      showSortDropdown ? 'rotate-180' : 'rotate-0'
                    }`}
                  />
                </button>
                <AnimatePresence>
                  {showSortDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute z-10 top-full mt-2 w-full rounded-lg shadow-lg bg-white overflow-hidden"
                    >
                      {sortByOptions.map((option) => (
                        <button
                          key={option}
                          onClick={() => {
                            onSortChange(option);
                            setShowSortDropdown(false);
                          }}
                          className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100"
                        >
                          {option}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MaterialFilters;
