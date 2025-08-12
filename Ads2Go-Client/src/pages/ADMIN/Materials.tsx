import React, { useState } from 'react';
import { ChevronDown, Mail, Phone, MapPin, Edit, X, MoreVertical } from 'lucide-react';
import { TrashIcon } from '@heroicons/react/24/outline';

interface Material {
  id: string;
  name: string;
  shortName: string;
  status: 'Used' | 'Available';
  startDate: string;
  endDate: string;
  usedBy: string;
  type: 'LCD' | 'BANNER' | 'STICKER' | 'HEADDRESS';
}

const mockData: Material[] = [
  { id: '001', name: 'LCD', shortName: 'ABCAPP', status: 'Available', startDate: 'N/A', endDate: 'N/A', usedBy: 'N/A', type: 'LCD' },
  { id: '002', name: 'BANNER', shortName: 'ABCAPP', status: 'Used', startDate: '11.01.2008', endDate: '11.01.2009', usedBy: 'ABC', type: 'BANNER' },
  { id: '003', name: 'STICKER', shortName: 'ABCAPP', status: 'Available', startDate: 'N/A', endDate: 'N/A', usedBy: 'N/A', type: 'STICKER' },
  { id: '004', name: 'Headress', shortName: 'ABCAPP', status: 'Available', startDate: 'N/A', endDate: 'N/A', usedBy: 'N/A', type: 'HEADDRESS' },
  { id: '005', name: 'LCD', shortName: 'ABCAPP', status: 'Available', startDate: 'N/A', endDate: 'N/A', usedBy: 'N/A', type: 'LCD' },
  { id: '006', name: 'LCD', shortName: 'ABCAPP', status: 'Available', startDate: 'N/A', endDate: 'N/A', usedBy: 'N/A', type: 'LCD' },
  { id: '007', name: 'LCD', shortName: 'ABCAPP', status: 'Available', startDate: 'N/A', endDate: 'N/A', usedBy: 'N/A', type: 'LCD' },
  { id: '008', name: 'LCD', shortName: 'ABCAPP', status: 'Used', startDate: '11.01.2008', endDate: '11.01.2009', usedBy: 'ABC', type: 'LCD' },
  { id: '009', name: 'LCD', shortName: 'ABCAPP', status: 'Available', startDate: 'N/A', endDate: 'N/A', usedBy: 'N/A', type: 'LCD' },
];

const Materials: React.FC = () => {
  const [selectedType, setSelectedType] = useState<'All' | 'LCD' | 'BANNER' | 'STICKER' | 'HEADDRESS'>('All');
  const [showUsed, setShowUsed] = useState(true);
  const [showAvailable, setShowAvailable] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);

  const filtered = mockData.filter((material) => {
    const typeMatch = selectedType === 'All' || material.type === selectedType;
    const searchMatch =
      material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.shortName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.usedBy.toLowerCase().includes(searchTerm.toLowerCase());

    const statusMatch = (!showUsed && !showAvailable) ? true : (showUsed && material.status === 'Used') || (showAvailable && material.status === 'Available');
    return typeMatch && searchMatch && statusMatch;
  });
  
  // Handle individual user selection
  const handleMaterialSelect = (id: string) => {
    setSelectedMaterials(prevSelected =>
      prevSelected.includes(id)
        ? prevSelected.filter(materialId => materialId !== id)
        : [...prevSelected, id]
    );
  };
  
  // Handle select all users
  const handleSelectAll = () => {
    if (selectedMaterials.length === filtered.length) {
      setSelectedMaterials([]);
    } else {
      setSelectedMaterials(filtered.map(material => material.id));
    }
  };

  const isAllSelected = selectedMaterials.length === filtered.length && filtered.length > 0;

  return (
    <div className="min-h-screen bg-gray-100 pl-64 pr-5 p-10">
      <div className="bg-gray-100 w-full min-h-screen">
        {/* Header with Title and Add New Button */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="px-3 py-1 text-3xl font-bold text-gray-800">Materials List</h1>
          <button 
            className="px-4 py-2 bg-[#3674B5] text-white rounded-xl w-44 hover:bg-[#578FCA] hover:scale-105 transition-all duration-300"
          >
            Add New Material
          </button>
        </div>

        {/* Search Bar and Filters */}
        <div className="flex justify-between items-center mb-4">
          <input
            type="text"
            className="text-xs text-black rounded-xl pl-5 py-3 w-60 shadow-md border border-gray-400 focus:outline-none appearance-none bg-white"
            placeholder="Search materials..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="flex space-x-2">
            <div className="relative w-40">
              <select
                className="text-xs text-black rounded-xl pl-5 py-3 pr-8 w-full shadow-md border border-gray-400 focus:outline-none appearance-none bg-white"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as 'All' | 'LCD' | 'BANNER' | 'STICKER' | 'HEADDRESS')}
              >
                <option value="All">All Materials</option>
                <option value="LCD">LCD</option>
                <option value="BANNER">BANNER</option>
                <option value="STICKER">STICKER</option>
                <option value="HEADDRESS">HEADDRESS</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </div>
            </div>
            <label className="flex items-center gap-1 text-sm bg-white rounded-xl px-4 shadow-md border border-gray-400">
              <input type="checkbox" checked={showUsed} onChange={() => setShowUsed(!showUsed)} />
              Used ({mockData.filter((d) => d.status === 'Used').length})
            </label>
            <label className="flex items-center gap-1 text-sm bg-white rounded-xl px-4 shadow-md border border-gray-400">
              <input type="checkbox" checked={showAvailable} onChange={() => setShowAvailable(!showAvailable)} />
              Available ({mockData.filter((d) => d.status === 'Available').length})
            </label>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl shadow-md mb-4 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 bg-[#3674B5] px-4 py-2 text-sm font-semibold text-white">
            <div className="flex items-center gap-10 col-span-3">
              <input 
                type="checkbox" 
                className="form-checkbox"
                onChange={(e) => {
                  e.stopPropagation();
                  handleSelectAll();
                }}
                checked={isAllSelected}
              />
              <span className="cursor-pointer" onClick={(e) => { e.stopPropagation(); handleSelectAll(); }}>Name</span>
            </div>
            <div className="col-span-1">ID</div>
            <div className="col-span-2">Short Name</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Used By</div>
            <div className="col-span-2 text-center">Action</div>
          </div>
          {/* Table Body */}
          {filtered.map((material) => (
            <div key={material.id} className="bg-white border-t border-gray-300 transition-all duration-500 ease-in-out transform origin-top">
              {/* Collapsed Card */}
              <div
                className="grid grid-cols-12 items-center px-4 py-3 text-sm hover:bg-gray-100 transition-colors cursor-pointer"
                onClick={() => setExpandedId(expandedId === material.id ? null : material.id)}
              >
                <div className="col-span-3 gap-10 flex items-center">
                  <input
                    type="checkbox"
                    className="form-checkbox"
                    checked={selectedMaterials.includes(material.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleMaterialSelect(material.id);
                    }}
                  />
                  <div className="flex items-center">
                    <span className="truncate">{material.name}</span>
                  </div>
                </div>
                <div className="col-span-1 truncate">{material.id}</div>
                <div className="col-span-2 truncate">{material.shortName}</div>
                <div className="col-span-2">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      material.status === 'Used' ? 'bg-red-200 text-red-800' : 'bg-green-200 text-green-800'
                    }`}
                  >
                    {material.status}
                  </span>
                </div>
                <div className="col-span-2 truncate">{material.usedBy}</div>
                <div className="col-span-2 flex justify-center space-x-2">
                  <button className="text-gray-500 hover:text-gray-700">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                  <button className="text-red-500 hover:text-red-700" onClick={(e) => e.stopPropagation()}>
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedId === material.id && (
                <div className="p-4 bg-gray-50 border-t border-gray-200">
                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                    <div><strong>Type:</strong> {material.type}</div>
                    <div><strong>Start Date:</strong> {material.startDate}</div>
                    <div><strong>End Date:</strong> {material.endDate}</div>
                    <div><strong>Used By:</strong> {material.usedBy}</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center text-gray-600 mt-4">
          <span className="text-sm">Found: {filtered.length} materials</span>
          <button className="px-4 py-2 border border-green-600 text-green-600 rounded-xl hover:bg-green-50 text-sm">
            Export to Excel
          </button>
        </div>

        {/* Pagination */}
        <div className="flex justify-center items-center mt-6 gap-2 text-sm flex-wrap">
          <button className="px-2 py-1 border rounded-xl text-gray-400 cursor-not-allowed">← Previous</button>
          <button className="px-2 py-1 bg-blue-600 text-white rounded-xl">1</button>
          <button className="px-2 py-1 border rounded-xl">2</button>
          <button className="px-2 py-1 border rounded-xl">3</button>
          <button className="px-2 py-1 border rounded-xl">4</button>
          <button className="px-2 py-1 border rounded-xl">5</button>
          <span className="text-gray-500">...</span>
          <button className="px-2 py-1 border rounded-xl">31</button>
          <button className="px-2 py-1 border rounded-xl text-blue-600">Next →</button>
          <button className="px-2 py-1 text-blue-600">Show all</button>
        </div>
      </div>
    </div>
  );
};

export default Materials;