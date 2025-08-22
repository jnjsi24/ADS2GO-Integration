import React, { useState } from 'react';
import { ChevronDown, Mail, Phone, MapPin, Edit, X, MoreVertical, CheckSquare } from 'lucide-react';
import { TrashIcon } from '@heroicons/react/24/outline';

interface User {
  id: number;
  lastName: string;
  firstName: string;
  middleName: string;
  company: string;
  address: string;
  contact: string;
  email: string;
  status: 'active' | 'inactive';
  city: string;
  adsCount: number;
  ridersCount: number;
}

// Mock data for users and cities
const mockUsers: User[] = [
  {
    id: 1,
    lastName: 'Garcia',
    firstName: 'Juan',
    middleName: 'Santos',
    company: 'TechCorp',
    address: '123 Ayala Ave.',
    contact: '09171234567',
    email: 'juan.garcia@techcorp.com',
    status: 'active',
    city: 'Makati',
    adsCount: 5,
    ridersCount: 12,
  },
  {
    id: 2,
    lastName: 'Reyes',
    firstName: 'Maria',
    middleName: 'Lopez',
    company: 'AgriFarm Inc.',
    address: '456 Quezon Blvd.',
    contact: '09987654321',
    email: 'maria.reyes@agrifarm.com',
    status: 'inactive',
    city: 'Quezon City',
    adsCount: 3,
    ridersCount: 7,
  },
  {
    id: 3,
    lastName: 'Cruz',
    firstName: 'Pedro',
    middleName: 'Dela Cruz',
    company: 'BuildIt',
    address: '789 Katipunan St.',
    contact: '09182345678',
    email: 'pedro.cruz@buildit.com',
    status: 'active',
    city: 'Manila',
    adsCount: 8,
    ridersCount: 15,
  },
  {
    id: 4,
    lastName: 'Dela Rosa',
    firstName: 'Ana',
    middleName: 'Mendoza',
    company: 'SmartBuild',
    address: '101 Maginhawa St.',
    contact: '09174561234',
    email: 'ana.rosa@smartbuild.com',
    status: 'active',
    city: 'Pasig',
    adsCount: 2,
    ridersCount: 3,
  },
  {
    id: 5,
    lastName: 'Santos',
    firstName: 'Carlos',
    middleName: 'Rivera',
    company: 'GreenFields',
    address: '34 Davao St.',
    contact: '09176543210',
    email: 'carlos.santos@greenfields.com',
    status: 'inactive',
    city: 'Davao',
    adsCount: 0,
    ridersCount: 0,
  },
  {
    id: 6,
    lastName: 'Navarro',
    firstName: 'Liza',
    middleName: 'Gomez',
    company: 'BioTech PH',
    address: '88 Baguio Hilltop Rd.',
    contact: '09171239876',
    email: 'liza.navarro@biotechph.com',
    status: 'active',
    city: 'Baguio',
    adsCount: 4,
    ridersCount: 9,
  },
  {
    id: 7,
    lastName: 'Lopez',
    firstName: 'Miguel',
    middleName: 'Torres',
    company: 'AutoMate',
    address: '14 Iloilo Ave.',
    contact: '09223456789',
    email: 'miguel.lopez@automate.com',
    status: 'inactive',
    city: 'Iloilo',
    adsCount: 1,
    ridersCount: 2,
  },
  {
    id: 8,
    lastName: 'Torres',
    firstName: 'Sofia',
    middleName: 'Reyes',
    company: 'NextGen',
    address: '22 Taguig Rd.',
    contact: '09181234567',
    email: 'sofia.torres@nextgen.com',
    status: 'active',
    city: 'Taguig',
    adsCount: 6,
    ridersCount: 11,
  },
  {
    id: 9,
    lastName: 'Fernandez',
    firstName: 'Marco',
    middleName: 'Luis',
    company: 'CloudLink',
    address: '77 Makati Ave.',
    contact: '09331234567',
    email: 'marco.fernandez@cloudlink.com',
    status: 'active',
    city: 'Makati',
    adsCount: 4,
    ridersCount: 10,
  },
  {
    id: 10,
    lastName: 'Ramirez',
    firstName: 'Isabel',
    middleName: 'Delos Santos',
    company: 'HealthPlus',
    address: '65 Quezon Ave.',
    contact: '09451234567',
    email: 'isabel.ramirez@healthplus.com',
    status: 'inactive',
    city: 'Quezon City',
    adsCount: 2,
    ridersCount: 4,
  },
];

const cities = ['Manila', 'Quezon City', 'Cebu', 'Davao', 'Iloilo', 'Baguio', 'Makati', 'Taguig', 'Pasig', 'Parañaque'];

const ManageUsers: React.FC = () => {
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);

  // Helper function to get initials for the user avatar
  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      setUsers((prev) => prev.filter((user) => user.id !== id));
      if (expandedId === id) setExpandedId(null);
    }
  };

  // Filter users based on search term, status, and city
  const filteredUsers = users.filter((user) => {
    const fullName = `${user.firstName} ${user.middleName} ${user.lastName}`.toLowerCase();
    const matchesSearch = fullName.includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    const matchesCity = !selectedCity || user.city === selectedCity;
    return matchesSearch && matchesStatus && matchesCity;
  });

  // Toggle the expanded user card
  const toggleExpand = (id: number) => {
    setExpandedId(prev => (prev === id ? null : id));
  };
  
  // Handle individual user selection
  const handleUserSelect = (id: number) => {
    setSelectedUsers(prevSelected =>
      prevSelected.includes(id)
        ? prevSelected.filter(userId => userId !== id)
        : [...prevSelected, id]
    );
  };
  
  // Handle select all users
  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(user => user.id));
    }
  };

  const isAllSelected = selectedUsers.length === filteredUsers.length && filteredUsers.length > 0;

  return (
    <div className="min-h-screen bg-gray-100 pl-64 pr-5 p-10">
      <div className="bg-gray-100 w-full min-h-screen">
        {/* Header with Title and Add New Button */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="px-3 py-1 text-3xl font-bold text-gray-800">User List</h1>
          <button 
            className="px-4 py-2 bg-[#3674B5] text-white rounded-xl w-36 hover:bg-[#578FCA] hover:scale-105 transition-all duration-300"
          >
            Add New User
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
            {/* Status Filter with SVG */}
            <div className="relative w-32">
              <select
                className="text-sm text-black rounded-xl pl-5 py-3 pr-8 w-full shadow-md border border-gray-400 focus:outline-none appearance-none bg-white"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* City Filter with SVG */}
            <div className="relative w-36">
              <select
                className="text-sm text-black rounded-xl pl-5 py-3 pr-8 w-full shadow-md border border-gray-400 focus:outline-none appearance-none bg-white"
                value={selectedCity || ''}
                onChange={(e) => setSelectedCity(e.target.value || null)}
              >
                <option value="">Filter by City</option>
                {cities.map(city => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* User List - Refactored to use divs */}
        <div className="rounded-xl shadow-md mb-4 overflow-hidden">
          {/* Table Header is now always visible. Refactored to use a 12-column grid. */}
          <div className="grid grid-cols-12 gap-4 bg-[#3674B5] px-4 py-2 text-sm font-semibold text-white">
            {/* The col-span for Name is increased to 3 */}
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
            {/* The col-span for Email is increased to 3 */}
            <div className="col-span-3">Email</div>
            {/* The col-span for Company is increased to 2 */}
            <div className="col-span-2">Company</div>
            {/* The col-span for Status is now 1 */}
            <div className="col-span-1">Status</div>
            {/* The col-span for Last Access is now 2 */}
            <div className="col-span-2">Last Access</div>
            {/* The col-span for Action is now 1 */}
            <div className="col-span-1 text-center">Action</div>
          </div>

          {/* User Cards */}
          {filteredUsers.map((user) => (
            <div
              key={user.id}
              className={`
                bg-white border-t border-gray-300 transition-all duration-500 ease-in-out transform origin-top
                ${expandedId === user.id ? 'z-10 relative scale-105 shadow-xl' : ''}
              `}
            >
              {expandedId !== user.id ? (
                // Collapsed User Card. Refactored to match the 12-column grid.
                <div
                  className="grid grid-cols-12 gap-4 items-center px-4 py-3 text-sm hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <div className="col-span-3 gap-7 flex items-center" onClick={() => toggleExpand(user.id)}>
                    <input
                      type="checkbox"
                      className="form-checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={(e) => {
                          e.stopPropagation();
                          handleUserSelect(user.id);
                      }}
                    />
                    <div
                      className="flex items-center"
                    >
                      <div className="flex items-center justify-center w-8 h-8 mr-2 text-xs font-semibold text-white rounded-full bg-[#FF9D3D]">
                        {getInitials(user.firstName, user.lastName)}
                      </div>
                      <span className="truncate">
                        {user.firstName} {user.middleName} {user.lastName}
                      </span>
                    </div>
                  </div>
                  <div className="col-span-3 truncate" onClick={() => toggleExpand(user.id)}>{user.email}</div>
                  <div className="col-span-2 truncate" onClick={() => toggleExpand(user.id)}>{user.company}</div>
                  <div className="col-span-1" onClick={() => toggleExpand(user.id)}>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        user.status === 'active' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                      }`}
                    >
                      {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                    </span>
                  </div>
                  <div className="col-span-2 truncate" onClick={() => toggleExpand(user.id)}>
                    {user.status === 'active' ? 'Active Now' : 'Muted for 24 hours'}
                  </div>
                  <div className="col-span-1 flex items-center justify-center gap-2">
                    <button onClick={() => toggleExpand(user.id)}>
                      <ChevronDown size={16} className="inline-block text-gray-500" />
                    </button>
                  </div>
                </div>
              ) : (
                // Expanded User Card with new UI
                <div className="bg-white p-6 shadow-xl rounded-md flex flex-col lg:flex-row items-start justify-between">
                  {/* Left Section: Avatar, Name, Personal Details */}
                  <div className="flex items-start pl-6 gap-4 mb-6 lg:mb-0 lg:pr-8 border-b lg:border-b-0 lg:border-r border-gray-200 w-full lg:w-1/3">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white bg-[#FF9D3D] shadow-md">
                        {getInitials(user.firstName, user.lastName)}
                      </div>
                      <span className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white ${user.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    </div>
                    <div className="flex-grow">
                      <h3 className="text-xl font-bold text-gray-800 mb-1">
                        {user.firstName} {user.lastName}
                      </h3>
                      <div className="text-sm text-gray-600 space-y-1">
                        {/* ID Detail */}
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700">ID:</span>
                          <span className="text-gray-600">{user.id}</span>
                        </div>
                        {/* City Detail */}
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700">City:</span>
                          <span className="text-gray-600">{user.city}</span>
                        </div>
                        {/* Company Detail */}
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700">Company:</span>
                          <span className="text-gray-600">{user.company}</span>
                        </div>
                        {/* Status Detail */}
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700">Status:</span>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            user.status === 'active' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                          }`}>
                            {user.status === 'active' ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Middle Section: Work Details */}
                  <div className="flex flex-col gap-4 mt-6 lg:mb-0 lg:px-8 border-b lg:border-b-0 lg:border-r border-gray-200 w-full lg:w-1/3">
                    <div className="text-sm">
                      <div className="space-y-2">
                        {/* Position Detail */}
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700">Position:</span>
                          <span className="text-gray-600">N/A</span>
                        </div>
                        {/* Department Detail */}
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700">Department:</span>
                          <span className="text-gray-600">N/A</span>
                        </div>
                        {/* Ads Count Detail */}
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700">Ads Count:</span>
                          <span className="text-gray-600">{user.adsCount}</span>
                        </div>
                        {/* Riders Count Detail */}
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700">Riders Count:</span>
                          <span className="text-gray-600">{user.ridersCount}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Right Section: Contacts & Address */}
                  <div className="flex flex-col gap-4 w-full lg:w-1/3 pt-6 lg:pt-0 lg:pl-8">
                    {/* Icons and Close Button - Top Right */}
                    <div className="absolute top-4 right-4 pr-6 flex items-center gap-2">
                      <button className="p-1 text-[#3674B5] rounded-full hover:bg-gray-100 transition-colors">
                        <Edit size={16} />
                      </button>
                      <button className="p-1 text-red-500 rounded-full hover:bg-gray-100 transition-colors" onClick={() => handleDelete(user.id)}>
                        <TrashIcon className="w-4 h-4" />
                      </button>
                      <button className="p-1 text-gray-500 rounded-full hover:bg-gray-100 transition-colors" onClick={() => toggleExpand(user.id)}>
                        <X size={16} />
                      </button>
                      <button className="p-1 text-gray-500 rounded-full hover:bg-gray-100 transition-colors">
                        <MoreVertical size={16} />
                      </button>
                    </div>
                    <div className="text-sm mt-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Mail size={16} />
                          <span>{user.email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Phone size={16} />
                          <span>{user.contact}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <MapPin size={16} />
                          <p>{user.address}, {user.city}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          {filteredUsers.length === 0 && (
            <div className="p-4 text-center text-gray-500">No users found.</div>
          )}
        </div>

        {/* Footer with user count and pagination (simplified) */}
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gray-600">Found: {filteredUsers.length} user(s) - Selected: {selectedUsers.length}</span>
          <div className="flex space-x-2">
            <button 
              className="px-4 py-2 text-sm text-green-600 transition-colors border border-green-600 rounded hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={selectedUsers.length === 0}
            >
              Export {selectedUsers.length > 0 ? `${selectedUsers.length} Selected Users` : 'to Excel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageUsers;