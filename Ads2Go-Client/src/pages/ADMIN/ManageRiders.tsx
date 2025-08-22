import React, { useState } from 'react';
import { ChevronDown, Mail, Phone, MapPin, Edit, X, MoreVertical, CheckSquare } from 'lucide-react';
import { TrashIcon } from '@heroicons/react/24/outline';

interface Riders {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  password: string;
  contactNumber: string;
  email: string;
  licenseNumber: string;
  licensePicture: string;
  orcrPicture: string;
  plateNumber: string;
  vehicleType: string;
  vehicleModel: string;
  materialsSupported: string;
  materialsID: string;
  status: 'Active' | 'Applicant';
  distanceTraveled: number;
  assignedAds: string;
  areaBase: string;
}

const mockRiders: Riders[] = [
  {
    id: 'R1',
    firstName: 'Juan',
    middleName: 'Santos',
    lastName: 'Dela Cruz',
    password: '••••••••',
    contactNumber: '09171234567',
    email: 'juan.delacruz@example.com',
    licenseNumber: 'DLN-123456789',
    licensePicture: 'license1.jpg',
    orcrPicture: 'orcr1.jpg',
    plateNumber: 'ABC-1234',
    vehicleType: 'Car',
    vehicleModel: 'Toyota Vios',
    materialsSupported: 'LCD Screen, Stickers',
    materialsID: 'M-001',
    status: 'Active',
    distanceTraveled: 1200,
    assignedAds: 'Company A',
    areaBase: 'Quezon City',
  },
  {
    id: 'R2',
    firstName: 'Maria',
    middleName: '',
    lastName: 'Reyes',
    password: '••••••••',
    contactNumber: '09981234567',
    email: 'maria.reyes@example.com',
    licenseNumber: 'DLN-987654321',
    licensePicture: 'license2.jpg',
    orcrPicture: 'orcr2.jpg',
    plateNumber: 'XYZ-5678',
    vehicleType: 'Motorcycle',
    vehicleModel: 'Honda TMX 125',
    materialsSupported: 'Posters, LCD Screen',
    materialsID: 'M-002',
    status: 'Applicant',
    distanceTraveled: 500,
    assignedAds: 'Company B',
    areaBase: 'Makati City',
  },
  {
    id: 'R3',
    firstName: 'Carlos',
    middleName: 'B.',
    lastName: 'Gonzales',
    password: '••••••••',
    contactNumber: '09081234567',
    email: 'carlos.g@example.com',
    licenseNumber: 'DLN-1122334455',
    licensePicture: 'license3.jpg',
    orcrPicture: 'orcr3.jpg',
    plateNumber: 'LMN-4567',
    vehicleType: 'Electric Tricycle',
    vehicleModel: 'E-Trike X',
    materialsSupported: 'LCD Screen',
    materialsID: 'M-003',
    status: 'Active',
    distanceTraveled: 800,
    assignedAds: 'Company C',
    areaBase: 'Taguig City',
  },
];

const ManageRiders: React.FC = () => {
  const [riders, setRiders] = useState<Riders[]>(mockRiders);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Applicant'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedRiders, setSelectedRiders] = useState<string[]>([]);

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this rider?')) {
      setRiders((prev) => prev.filter((r) => r.id !== id));
      if (expandedId === id) setExpandedId(null);
    }
  };
  
  const handleApprove = (id: string) => {
    setRiders((prevRiders) =>
      prevRiders.map((rider) =>
        rider.id === id ? { ...rider, status: 'Active' } : rider
      )
    );
  };

  // Helper function to get initials for the rider avatar
  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const filteredRiders = riders.filter((rider) => {
    const fullName = `${rider.firstName} ${rider.middleName} ${rider.lastName}`.toLowerCase();
    const matchesSearch = fullName.includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || rider.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const dataToDisplay = filteredRiders;

  // Handle individual rider selection
  const handleRiderSelect = (id: string) => {
    setSelectedRiders(prevSelected =>
      prevSelected.includes(id)
        ? prevSelected.filter(riderId => riderId !== id)
        : [...prevSelected, id]
    );
  };

  // Handle select all riders
  const handleSelectAll = () => {
    const allRiderIds = dataToDisplay.map(rider => rider.id);
    if (selectedRiders.length === allRiderIds.length) {
      setSelectedRiders([]);
    } else {
      setSelectedRiders(allRiderIds);
    }
  };

  const isAllSelected = selectedRiders.length === dataToDisplay.length && dataToDisplay.length > 0;

  return (
    <div className="min-h-screen bg-gray-100 pl-64 pr-5 p-10">
      <div className="bg-gray-100 w-full min-h-screen">
        {/* Header with Title and Add New Button */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Riders List</h1>
          <button
            className="px-4 py-2 bg-[#3674B5] text-white rounded-md hover:bg-[#578FCA] hover:scale-105 transition-all duration-300"
          >
            Add New Rider
          </button>
        </div>

        {/* Search Bar and Filters */}
        <div className="flex justify-between items-center mb-4">
          <input
            type="text"
            className="text-xs text-black rounded-xl pl-5 py-3 w-60 shadow-md border border-gray-400 focus:outline-none appearance-none bg-white"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="flex space-x-2">
            <div className="relative w-40">
              <select
                className="text-sm text-black rounded-xl ml-8 pl-5 py-3 pr-8 w-32 shadow-md border border-gray-400 focus:outline-none appearance-none bg-white"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'Active' | 'Applicant')}
              >
                <option value="all">All Status</option>
                <option value="Active">Active</option>
                <option value="Applicant">Applicant</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Rider List */}
        <div className="rounded-md shadow-md mb-4 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 bg-[#3674B5] px-4 py-2 text-sm font-semibold text-white">
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
            <div className="col-span-3">Email</div>
            <div className="col-span-2">Contact</div>
            <div className="col-span-2">Vehicle</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-1 text-center">Action</div>
          </div>

          {/* Rider Cards */}
          {dataToDisplay.map((rider) => (
            <div
              key={rider.id}
              className={`
                bg-white border-t border-gray-300 transition-all duration-500 ease-in-out transform origin-top
                ${expandedId === rider.id ? 'z-10 relative scale-105 shadow-xl' : ''}
              `}
            >
              {expandedId !== rider.id ? (
                // Collapsed Rider Card
                <div
                  className="grid grid-cols-12 items-center px-4 py-3 text-sm hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <div className="col-span-3 gap-7 flex items-center" onClick={() => setExpandedId(rider.id)}>
                    <input
                      type="checkbox"
                      className="form-checkbox"
                      checked={selectedRiders.includes(rider.id)}
                      onChange={(e) => {
                          e.stopPropagation();
                          handleRiderSelect(rider.id);
                      }}
                    />
                    <div className="flex items-center">
                      <div className="flex items-center justify-center w-8 h-8 mr-2 text-xs font-semibold text-white rounded-full bg-[#FF9D3D]">
                        {getInitials(rider.firstName, rider.lastName)}
                      </div>
                      <span className="truncate">
                        {`${rider.firstName} ${rider.middleName} ${rider.lastName}`}
                      </span>
                    </div>
                  </div>
                  <div className="col-span-3 truncate" onClick={() => setExpandedId(rider.id)}>{rider.email}</div>
                  <div className="col-span-2 truncate" onClick={() => setExpandedId(rider.id)}>{rider.contactNumber}</div>
                  <div className="col-span-2 truncate" onClick={() => setExpandedId(rider.id)}>{rider.vehicleType}</div>
                  <div className="col-span-1" onClick={() => setExpandedId(rider.id)}>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        rider.status === 'Active' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'
                      }`}
                    >
                      {rider.status}
                    </span>
                  </div>
                  <div className="col-span-1 flex items-center justify-center gap-2">
                    {rider.status === 'Applicant' ? (
                      <>
                        <button className="bg-green-500 text-white text-xs px-2 py-1 rounded" onClick={(e) => { e.stopPropagation(); handleApprove(rider.id); }}>Accept</button>
                        <button className="bg-red-500 text-white text-xs px-2 py-1 rounded" onClick={(e) => { e.stopPropagation(); handleDelete(rider.id); }}>Decline</button>
                      </>
                    ) : (
                      <button onClick={(e) => { e.stopPropagation(); setExpandedId(rider.id); }}>
                        <ChevronDown size={16} className="inline-block text-gray-500" />
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                // Expanded Rider Card
                <div className="bg-white p-6 shadow-xl rounded-md flex flex-col lg:flex-row items-start justify-between">
                  {/* Left Section: Avatar, Name, Personal Details */}
                  <div className="flex items-start pl-6 gap-4 mb-6 lg:mb-0 lg:pr-8 border-b lg:border-b-0 lg:border-r border-gray-200 w-full lg:w-1/3">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white bg-[#FF9D3D] shadow-md">
                        {getInitials(rider.firstName, rider.lastName)}
                      </div>
                      <span className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white ${rider.status === 'Active' ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                    </div>
                    <div className="flex-grow">
                      <h3 className="text-xl font-bold text-gray-800 mb-1">
                        {`${rider.firstName} ${rider.lastName}`}
                      </h3>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700">ID:</span>
                          <span className="text-gray-600">{rider.id}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700">Area Base:</span>
                          <span className="text-gray-600">{rider.areaBase}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700">Vehicle:</span>
                          <span className="text-gray-600">{rider.vehicleType} - {rider.vehicleModel}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700">Status:</span>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${rider.status === 'Active' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>
                            {rider.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Middle Section: Work Details */}
                  <div className="flex flex-col gap-4 mt-6 lg:mb-0 lg:px-8 border-b lg:border-b-0 lg:border-r border-gray-200 w-full lg:w-1/3">
                    <div className="text-sm">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700">Plate Number:</span>
                          <span className="text-gray-600">{rider.plateNumber}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700">License #:</span>
                          <span className="text-gray-600">{rider.licenseNumber}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700">Materials Supported:</span>
                          <span className="text-gray-600">{rider.materialsSupported}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700">Assigned Ads:</span>
                          <span className="text-gray-600">{rider.assignedAds}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Section: Contacts & Documents */}
                  <div className="flex flex-col gap-4 w-full lg:w-1/3 pt-6 lg:pt-0 lg:pl-8">
                    <div className="absolute top-4 right-4 pr-6 flex items-center gap-2">
                      <button className="p-1 text-[#3674B5] rounded-full hover:bg-gray-100 transition-colors">
                        <Edit size={16} />
                      </button>
                      <button className="p-1 text-red-500 rounded-full hover:bg-gray-100 transition-colors" onClick={() => handleDelete(rider.id)}>
                        <TrashIcon className="w-4 h-4" />
                      </button>
                      <button className="p-1 text-gray-500 rounded-full hover:bg-gray-100 transition-colors" onClick={() => setExpandedId(null)}>
                        <X size={16} />
                      </button>
                    </div>
                    <div className="text-sm mt-6 space-y-4">
                      <div className="flex items-center gap-2 text-gray-600">
                        <img src={`https://via.placeholder.com/40?text=${rider.firstName?.[0]}`} alt="Selfie" className="h-10 w-10 rounded-full object-cover border" />
                        <div>
                          <p className="font-semibold text-gray-700">Selfie</p>
                          <span className="text-xs text-gray-500"></span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <img src={rider.licensePicture} alt="License" className="h-10 w-10 object-cover rounded" />
                        <p className="font-semibold text-gray-700">License Picture</p>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <img src={rider.orcrPicture} alt="OR/CR" className="h-10 w-10 object-cover rounded" />
                        <p className="font-semibold text-gray-700">OR/CR Picture</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          {dataToDisplay.length === 0 && (
            <div className="p-4 text-center text-gray-500">No riders found.</div>
          )}
        </div>

        {/* Footer with user count and pagination (simplified) */}
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gray-600">Found: {dataToDisplay.length} rider(s) - Selected: {selectedRiders.length}</span>
          <div className="flex space-x-2">
            <button
              className="px-4 py-2 text-sm text-green-600 transition-colors border border-green-600 rounded hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={selectedRiders.length === 0}
            >
              Export {selectedRiders.length > 0 ? `${selectedRiders.length} Selected` : 'to Excel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageRiders;