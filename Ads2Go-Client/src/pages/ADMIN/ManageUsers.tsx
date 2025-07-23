import React, { useState, useEffect } from 'react';

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

interface AdForm {
  id: string;
  type: 'ads';
  title: string;
  description: string;
  vehicleType: string;
  material: string;
  plan: string;
  format: string;
  mediaUrl: string;
  companyName: string;
  companyEmail: string;
  dateStarted: string;
  dateEnded: string;
  status: string;
}

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
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [citySearch, setCitySearch] = useState('');
  const [showCityModal, setShowCityModal] = useState(false);
  const [activeTab, setActiveTab] = useState('User List');
  const [expandedId, setExpandedId] = useState<string | number | null>(null); // Updated to handle both string and number
  const [selectedItems, setSelectedItems] = useState<Set<string | number>>(new Set());

  // Mock data for ads
  const [mockData, setMockData] = useState<AdForm[] | null>(null);

  useEffect(() => {
    const mockAdForms: AdForm[] = [
      {
        id: "1",
        type: "ads",
        title: "Summer Sale Ad",
        description: "Promoting summer discounts on scooters",
        vehicleType: "Scooter",
        material: "Vinyl",
        plan: "Premium",
        format: "Video",
        mediaUrl: "https://example.com/media/summer-sale.mp4",
        companyName: "Summer Co.",
        companyEmail: "sales@summerco.com",
        dateStarted: "2025-06-01",
        dateEnded: "2025-06-30",
        status: "pending",
      },
      {
        id: "2",
        type: "ads",
        title: "New Bike Launch",
        description: "Introducing our latest bike model",
        vehicleType: "Motorcycle",
        material: "Metal",
        plan: "Basic",
        format: "Image",
        mediaUrl: "https://example.com/media/bike-launch.jpg",
        companyName: "Bike Innovations",
        companyEmail: "info@bikeinnovations.com",
        dateStarted: "2025-07-01",
        dateEnded: "2025-07-15",
        status: "pending",
      },
    ];
    setMockData(mockAdForms);
  }, []);

  const filteredUsers = mockUsers.filter((user) => {
    const matchesSearch = user.firstName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    const matchesCity = !selectedCity || user.city === selectedCity;
    return matchesSearch && matchesStatus && matchesCity;
  });

  const forms = mockData || [];

  const handleApprove = () => {
    alert('Form approved successfully');
    setExpandedId(null);
    setSelectedItems(new Set());
  };

  const handleReject = () => {
    alert('Form rejected successfully');
    setExpandedId(null);
    setSelectedItems(new Set());
  };

  const toggleExpand = (id: string | number) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds: (string | number)[] = activeTab === 'User List' ? filteredUsers.map(user => user.id) : forms.map(form => form.id);
      setSelectedItems(new Set(allIds));
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleItemSelect = (id: string | number) => {
    const newSelectedItems = new Set(selectedItems);
    if (newSelectedItems.has(id)) {
      newSelectedItems.delete(id);
    } else {
      newSelectedItems.add(id);
    }
    setSelectedItems(newSelectedItems);
  };

  return (
    <div className="pt-10 pb-10 pl-72 p-8 bg-[#f9f9fc] ">
      <div className="bg-[#f9f9fc] w-full">
        {/* Header with Dropdown Title and Add New Button */}
        <div className="flex justify-between items-center mb-6">
          <select
            className="px-3 py-1 text-2xl bg-[#f9f9fc] font-bold text-gray-800 focus:outline-none"
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
          >
            <option value="User List">User List</option>
            <option value="Manage Ads">Manage Ads</option>
          </select>
          <button 
            className="px-4 py-2 bg-[#3674B5] text-white rounded-md hover:bg-[#578FCA] hover:scale-105 transition-all duration-300"
          >
            Add New User
          </button>
        </div>

        {/* Search Bar and Filters */}
        <div className="flex justify-between items-center mb-4">
          <input
            type="text"
            className="border rounded px-3 py-1 text-sm w-64"
            placeholder="Search by first name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="flex space-x-2">
            <select
              className="border rounded px-3 py-1 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <select
              className="border rounded px-3 py-1 text-sm"
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
          </div>
        </div>

        {showCityModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-start pt-20 z-50">
            <div className="bg-white p-4 rounded-lg w-80 shadow-lg">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold">Select a City</h3>
                <button onClick={() => setShowCityModal(false)}>×</button>
              </div>
              <input
                type="text"
                placeholder="Search cities..."
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
                className="w-full border px-2 py-1 rounded mb-3"
              />
              <div className="max-h-60 overflow-y-auto">
                {cities
                  .filter(city => city.toLowerCase().includes(citySearch.toLowerCase()))
                  .map(city => (
                    <div
                      key={city}
                      onClick={() => {
                        setSelectedCity(city);
                        setShowCityModal(false);
                        setCitySearch('');
                      }}
                      className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                    >
                      {city}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        <div className="overflow-auto rounded-md mb-4">
          {activeTab === 'User List' ? (
            <table className="min-w-full text-sm">
              <thead className="bg-[#3674B5]">
                <tr>
                  <th className="px-2 py-2 text-left text-sm font-semibold text-white w-32">
                    <div className="flex justify-center">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filteredUsers.length > 0 && filteredUsers.every(user => selectedItems.has(user.id))}
                          onChange={handleSelectAll}
                          className="mr-1"
                        />
                        Select All
                      </label>
                    </div>
                  </th>
                  <th className="px-2 py-2 text-left text-sm font-semibold text-white">First Name</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-white">Last Name</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-white">Email</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-white">Status</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-white">Last Access</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-white">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <React.Fragment key={user.id}>
                    <tr
                      className="bg-white border-t border-gray-300 cursor-pointer hover:bg-gray-100"
                      onClick={() => toggleExpand(user.id)}
                    >
                      <td className="px-2 py-3"> {/* Changed to py-3 for spacing like in the image */}
                        <div className="flex justify-center">
                          <input
                            type="checkbox"
                            checked={selectedItems.has(user.id)}
                            onChange={() => handleItemSelect(user.id)}
                            className="mr-1"
                          />
                        </div>
                      </td>
                      <td className="px-2 py-3"> {/* Changed to py-3 for spacing like in the image */}
                        <img
                          src={`https://via.placeholder.com/40?text=${user.firstName[0]}`}
                          alt={user.firstName}
                          className="w-8 h-8 rounded-full mr-2 inline-block"
                        />
                        {user.firstName}
                      </td>
                      <td className="px-4 py-3"> {/* Changed to py-3 for spacing like in the image */}
                        {user.lastName}
                      </td>
                      <td className="px-4 py-3"> {/* Changed to py-3 for spacing like in the image */}
                        {user.email}
                      </td>
                      <td className="px-4 py-3"> {/* Changed to py-3 for spacing like in the image */}
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            user.status === 'active' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                          }`}
                        >
                          {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3"> {/* Changed to py-3 for spacing like in the image */}
                        {user.status === 'active' ? 'Active Now' : 'Muted for 24 hours'}
                      </td>
                      <td className="px-4 py-3"> {/* Changed to py-3 for spacing like in the image */}
                        <button className="text-blue-600 text-xs">...</button>
                      </td>
                    </tr>
                    {expandedId === user.id && (
                      <tr className="bg-gray-50">
                        <td colSpan={7} className="p-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                            <div><strong>Middle Name:</strong> {user.middleName}</div>
                            <div><strong>Company:</strong> {user.company}</div>
                            <div><strong>Address:</strong> {user.address}</div>
                            <div><strong>Contact:</strong> {user.contact}</div>
                            <div><strong>City:</strong> {user.city}</div>
                            <div><strong>Ads Count:</strong> {user.adsCount}</div>
                            <div><strong>Riders Count:</strong> {user.ridersCount}</div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-[#3674B5]">
                <tr>
                  <th className="px-2 py-2 text-left text-sm font-semibold text-white w-32">
                    <div className="flex justify-center">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={forms.length > 0 && forms.every(form => selectedItems.has(form.id))}
                          onChange={handleSelectAll}
                          className="mr-1"
                        />
                        Select All
                      </label>
                    </div>
                  </th>
                  <th className="px-2 py-2 text-left text-sm font-semibold text-white">Title</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-white">Company Name</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-white">Company Email</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-white">Date Started</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-white">Date Ended</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-white">Action</th>
                </tr>
              </thead>
              <tbody>
                {forms.map((form, index) => (
                  <React.Fragment key={form.id}>
                    <tr
                      className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} cursor-pointer hover:bg-gray-100`}
                      onClick={() => toggleExpand(form.id)}
                    >
                      <td className="px-2 py-3"> {/* Changed to py-3 for spacing like in the image */}
                        <div className="flex justify-center">
                          <input
                            type="checkbox"
                            checked={selectedItems.has(form.id)}
                            onChange={() => handleItemSelect(form.id)}
                            className="mr-1"
                          />
                        </div>
                      </td>
                      <td className="px-2 py-3"> {/* Changed to py-3 for spacing like in the image */}
                        {form.title}
                      </td>
                      <td className="px-4 py-3"> {/* Changed to py-3 for spacing like in the image */}
                        {form.companyName}
                      </td>
                      <td className="px-4 py-3"> {/* Changed to py-3 for spacing like in the image */}
                        {form.companyEmail}
                      </td>
                      <td className="px-4 py-3"> {/* Changed to py-3 for spacing like in the image */}
                        {form.dateStarted}
                      </td>
                      <td className="px-4 py-3"> {/* Changed to py-3 for spacing like in the image */}
                        {form.dateEnded}
                      </td>
                      <td className="px-4 py-3"> {/* Changed to py-3 for spacing like in the image */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApprove();
                          }}
                          className="bg-green-500 text-white px-2 py-1 rounded mr-2"
                        >
                          Approve
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReject();
                          }}
                          className="bg-red-500 text-white px-2 py-1 rounded"
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                    {expandedId === form.id && (
                      <tr className="bg-gray-50">
                        <td colSpan={7} className="p-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                            <div><strong>Description:</strong> {form.description}</div>
                            <div><strong>Vehicle Type:</strong> {form.vehicleType}</div>
                            <div><strong>Material:</strong> {form.material}</div>
                            <div><strong>Plan:</strong> {form.plan}</div>
                            <div><strong>Format:</strong> {form.format}</div>
                            <div>
                              <strong>Media:</strong><br />
                              {form.format === 'Video' ? (
                                <video controls className="w-40 h-40 object-cover rounded">
                                  <source src={form.mediaUrl} type="video/mp4" />
                                  Your browser does not support the video tag.
                                </video>
                              ) : form.format === 'Image' ? (
                                <img src={form.mediaUrl} alt="Ad Media" className="w-40 h-40 object-cover rounded" />
                              ) : null}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {forms.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-gray-500 py-3">No forms available.</td> {/* Changed to py-3 for consistency */}
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Found: {activeTab === 'User List' ? filteredUsers.length : forms.length} {activeTab === 'User List' ? 'user(s)' : 'form(s)'}</span>
          <div className="flex space-x-2">
            <button className="px-4 py-2 border border-green-600 text-green-600 rounded hover:bg-green-50 text-sm">
              Export to Excel
            </button>
            <div className="flex items-center space-x-2">
              <button className="px-2 py-1 border rounded text-sm"></button>
              <span className="px-2 py-1">1 2 3</span>
              <button className="px-2 py-1 border rounded text-sm"></button>
              <span className="text-sm text-gray-600">19 20</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageUsers;