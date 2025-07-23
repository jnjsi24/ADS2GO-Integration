import React, { useState } from 'react';

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

  const filtered = mockData.filter((material) => {
    const typeMatch = selectedType === 'All' || material.type === selectedType;
    const searchMatch =
      material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.shortName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.usedBy.toLowerCase().includes(searchTerm.toLowerCase());

    // Only apply status filter if at least one checkbox is checked
    const statusMatch = !showUsed && !showAvailable ? true : (showUsed && material.status === 'Used') || (showAvailable && material.status === 'Available');
    return typeMatch && searchMatch && statusMatch;
  });

  return (
    <div className="pt-10 pb-10 pl-72 p-8 bg-[#f9f9fc]">
      <div className="bg-[#f9f9fc] w-full">
        {/* Header with Dropdown Title and Add New Button */}
        <div className="flex justify-between items-center mb-6">
          <p className="px-3 py-1 text-2xl font-bold text-gray-800 focus:outline-none"> Materials List
          </p>
          <button
            className="px-4 py-2 bg-[#3674B5] text-white rounded-md hover:bg-[#578FCA] hover:scale-105 transition-all duration-300"
          >
            Add New Material
          </button>
        </div>

        {/* Search Bar and Filters */}
        <div className="flex justify-between items-center mb-4">
          <input
            type="text"
            className="border rounded px-3 py-1 text-sm w-64"
            placeholder="Search materials..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="flex items-center space-x-4">
            <select
              className="border rounded px-3 py-1 text-sm"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as 'All' | 'LCD' | 'BANNER' | 'STICKER' | 'HEADDRESS')}
            >
              <option value="All">All Materials</option>
              <option value="LCD">LCD</option>
              <option value="BANNER">BANNER</option>
              <option value="STICKER">STICKER</option>
              <option value="HEADDRESS">HEADDRESS</option>
            </select>
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={showUsed} onChange={() => setShowUsed(!showUsed)} />
              Used {mockData.filter((d) => d.status === 'Used').length}
            </label>
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={showAvailable} onChange={() => setShowAvailable(!showAvailable)} />
              Available {mockData.filter((d) => d.status === 'Available').length}
            </label>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-auto rounded-md mb-4">
          <table className="min-w-full text-sm">
            <thead className="bg-[#3674B5]">
              <tr>
                <th className="px-2 py-2 text-left text-sm font-semibold text-white w-32">
                  <div className="flex justify-center">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="mr-1"
                      />
                      Select All
                    </label>
                  </div>
                </th>
                <th className="px-2 py-2 text-left text-sm font-semibold text-white">ID</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-white">Material Name</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-white">Short Name</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-white">Status</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-white">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((material) => (
                <React.Fragment key={material.id}>
                  <tr
                    className="bg-white border-t border-gray-300 cursor-pointer hover:bg-gray-100"
                    onClick={() => setExpandedId(expandedId === material.id ? null : material.id)}
                  >
                    <td className="px-2 py-3">
                      <div className="flex justify-center">
                        <input
                          type="checkbox"
                          className="mr-1"
                        />
                      </div>
                    </td>
                    <td className="px-2 py-3">{material.id}</td>
                    <td className="px-4 py-3">{material.name}</td>
                    <td className="px-4 py-3">{material.shortName}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          material.status === 'Used' ? 'bg-red-200 text-red-800' : 'bg-green-200 text-green-800'
                        }`}
                      >
                        {material.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 flex space-x-2">
                      <button
                        className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 flex items-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                  {expandedId === material.id && (
                    <tr className="bg-gray-50">
                      <td colSpan={6} className="p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          <div><strong>Type:</strong> {material.type}</div>
                          <div><strong>Start Date:</strong> {material.startDate}</div>
                          <div><strong>End Date:</strong> {material.endDate}</div>
                          <div><strong>Used By:</strong> {material.usedBy}</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Found: {filtered.length}</span>
          <button className="px-4 py-2 border border-green-600 text-green-600 rounded hover:bg-green-50 text-sm">
            Export to Excel
          </button>
        </div>

        {/* Pagination */}
        <div className="flex justify-center items-center mt-6 gap-2 text-sm flex-wrap">
          <button className="px-2 py-1 border rounded text-gray-400 cursor-not-allowed">← Previous</button>
          <button className="px-2 py-1 bg-blue-600 text-white rounded">1</button>
          <button className="px-2 py-1">2</button>
          <button className="px-2 py-1">3</button>
          <button className="px-2 py-1">4</button>
          <button className="px-2 py-1">5</button>
          <span>...</span>
          <button className="px-2 py-1">31</button>
          <button className="px-2 py-1 border rounded text-blue-600">Next →</button>
          <button className="px-2 py-1 text-blue-600">Show all</button>
        </div>
      </div>
    </div>
  );
};

export default Materials;