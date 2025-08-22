import React, { useState } from 'react';
import { ChevronDown, TrashIcon, Edit, X } from 'lucide-react';

interface Material {
  id: string;
  name: string;
  shortName: string;
  status: 'Used' | 'Available';
  startDate: string;
  endDate: string;
  riderName: string;
  type: 'LCD' | 'BANNER' | 'STICKER' | 'HEADDRESS';
  usedVehicle: string;
}

const mockData: Material[] = [
  { id: '001', name: 'LCD', shortName: 'ABCAPP', status: 'Available', startDate: 'N/A', endDate: 'N/A', riderName: 'N/A', type: 'LCD', usedVehicle: 'N/A' },
  { id: '002', name: 'BANNER', shortName: 'ABCAPP', status: 'Used', startDate: '11.01.2008', endDate: '11.01.2009', riderName: 'Juan Garcia', type: 'BANNER', usedVehicle: 'Motorcycle' },
  { id: '003', name: 'STICKER', shortName: 'ABCAPP', status: 'Available', startDate: 'N/A', endDate: 'N/A', riderName: 'N/A', type: 'STICKER', usedVehicle: 'N/A' },
  { id: '004', name: 'Headress', shortName: 'ABCAPP', status: 'Available', startDate: 'N/A', endDate: 'N/A', riderName: 'N/A', type: 'HEADDRESS', usedVehicle: 'N/A' },
  { id: '005', name: 'LCD', shortName: 'ABCAPP', status: 'Available', startDate: 'N/A', endDate: 'N/A', riderName: 'N/A', type: 'LCD', usedVehicle: 'N/A' },
  { id: '006', name: 'LCD', shortName: 'ABCAPP', status: 'Available', startDate: 'N/A', endDate: 'N/A', riderName: 'N/A', type: 'LCD', usedVehicle: 'N/A' },
  { id: '007', name: 'LCD', shortName: 'ABCAPP', status: 'Available', startDate: 'N/A', endDate: 'N/A', riderName: 'N/A', type: 'LCD', usedVehicle: 'N/A' },
  { id: '008', name: 'LCD', shortName: 'ABCAPP', status: 'Used', startDate: '11.01.2008', endDate: '11.01.2009', riderName: 'Pedro Cruz', type: 'LCD', usedVehicle: 'Car' },
  { id: '009', name: 'LCD', shortName: 'ABCAPP', status: 'Available', startDate: 'N/A', endDate: 'N/A', riderName: 'N/A', type: 'LCD', usedVehicle: 'N/A' },
];

const Materials: React.FC = () => {
  const [selectedType, setSelectedType] = useState<'All' | 'LCD' | 'BANNER' | 'STICKER' | 'HEADDRESS'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Used' | 'Available'>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);

  const filtered = mockData.filter((material) => {
    const typeMatch = selectedType === 'All' || material.type === selectedType;
    const searchMatch =
      material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.shortName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.riderName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.usedVehicle.toLowerCase().includes(searchTerm.toLowerCase());

    const statusMatch = statusFilter === 'All' || material.status === statusFilter;
    return typeMatch && searchMatch && statusMatch;
  });

  const handleMaterialSelect = (id: string) => {
    setSelectedMaterials(prevSelected =>
      prevSelected.includes(id)
        ? prevSelected.filter(materialId => materialId !== id)
        : [...prevSelected, id]
    );
  };

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
            <div className="relative w-32">
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
            {/* Merged Status Filter */}
            <div className="relative w-32">
              <select
                className="text-xs text-black rounded-xl pl-5 py-3 pr-8 w-full shadow-md border border-gray-400 focus:outline-none appearance-none bg-white"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'All' | 'Used' | 'Available')}
              >
                <option value="All">All Status</option>
                <option value="Used">Used</option>
                <option value="Available">Available</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl shadow-md mb-4 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 bg-[#3674B5] px-4 py-2 text-sm font-semibold text-white">
            <div className="flex items-center gap-10 col-span-2">
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
            <div className="col-span-2">Rider Name</div>
            <div className="col-span-2">Used Vehicle</div>
            <div className="col-span-1 text-center">Action</div>
          </div>
          {/* Table Body */}
          {filtered.map((material) => (
            <div
              key={material.id}
              className={`
                bg-white border-t border-gray-300 transition-all duration-500 ease-in-out transform origin-top
                ${expandedId === material.id ? 'z-10 relative scale-105 shadow-xl' : ''}
              `}
            >
              {expandedId !== material.id ? (
                // Collapsed Card
                <div
                  className="grid grid-cols-12 items-center px-4 py-3 text-sm hover:bg-gray-100 transition-colors cursor-pointer"
                  onClick={() => setExpandedId(material.id)}
                >
                  <div className="col-span-2 gap-10 flex items-center">
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
                  <div className="col-span-2 truncate">{material.riderName}</div>
                  <div className="col-span-2 truncate">{material.usedVehicle}</div>
                  <div className="col-span-1 flex justify-center items-center">
                    <ChevronDown size={16} className="text-gray-500" />
                  </div>
                </div>
              ) : (
                // Expanded Details
                <div className="bg-white p-6 shadow-xl rounded-md flex flex-col lg:flex-row items-start justify-between">
                  {/* Left Section: Details */}
                  <div className="flex items-start pl-6 gap-4 mb-6 lg:mb-0 lg:pr-8 border-b lg:border-b-0 lg:border-r border-gray-200 w-full lg:w-1/3">
                    <div className="flex-grow">
                      <h3 className="text-xl font-bold text-gray-800 mb-1">
                        {material.name}
                      </h3>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700">ID:</span>
                          <span className="text-gray-600">{material.id}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700">Short Name:</span>
                          <span className="text-gray-600">{material.shortName}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700">Type:</span>
                          <span className="text-gray-600">{material.type}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700">Status:</span>
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              material.status === 'Used' ? 'bg-red-200 text-red-800' : 'bg-green-200 text-green-800'
                            }`}
                          >
                            {material.status.charAt(0).toUpperCase() + material.status.slice(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Middle Section: Performance Details */}
                  <div className="flex flex-col gap-4 mt-6 lg:mb-0 lg:px-8 border-b lg:border-b-0 lg:border-r border-gray-200 w-full lg:w-1/3">
                    <div className="text-sm">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700">Start Date:</span>
                          <span className="text-gray-600">{material.startDate}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700">End Date:</span>
                          <span className="text-gray-600">{material.endDate}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Section: Actions and Rider/Vehicle details */}
                  <div className="flex flex-col gap-4 w-full lg:w-1/3 pt-6 lg:pt-0 lg:pl-8">
                    <div className="absolute top-4 right-4 pr-6 flex items-center gap-2">
                      <button className="p-1 text-[#3674B5] rounded-full hover:bg-gray-100 transition-colors">
                        <Edit size={16} />
                      </button>
                      <button className="p-1 text-red-500 rounded-full hover:bg-gray-100 transition-colors">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                      <button className="p-1 text-gray-500 rounded-full hover:bg-gray-100 transition-colors" onClick={() => setExpandedId(null)}>
                        <X size={16} />
                      </button>
                    </div>
                    <div className="text-sm mt-6">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700">Rider Name:</span>
                          <span className="text-gray-600">{material.riderName}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700">Used Vehicle:</span>
                          <span className="text-gray-600">{material.usedVehicle}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="p-4 text-center text-gray-500">No materials found.</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center text-gray-600 mt-4">
          <span className="text-sm">Found: {filtered.length} materials - Selected: {selectedMaterials.length}</span>
          <button className="px-4 py-2 border border-green-600 text-green-600 rounded-xl hover:bg-green-50 text-sm">
            Export {selectedMaterials.length > 0 ? `${selectedMaterials.length} Selected Materials` : 'to Excel'}
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