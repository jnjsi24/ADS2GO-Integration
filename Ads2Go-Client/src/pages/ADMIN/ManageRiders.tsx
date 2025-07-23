import React, { useState } from 'react';
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

interface RiderApplication extends Omit<Riders, 'firstName' | 'lastName' | 'middleName'> {
  name: string;
  selfie: string;
  startOfRiding: string;
  applyingForAds: string;
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

const mockRiderApplications: RiderApplication[] = [
  {
    id: '3',
    name: 'Juan Dela Cruz',
    email: 'juan@example.com',
    contactNumber: '09123456789',
    licenseNumber: 'L1234567',
    licensePicture: 'https://example.com/images/license-juan.jpg',
    orcrPicture: 'https://example.com/images/orcr-juan.jpg',
    plateNumber: 'ABC123',
    vehicleType: 'Scooter',
    vehicleModel: '',
    materialsSupported: 'Vinyl, Metal',
    materialsID: 'MAT001',
    status: 'Applicant',
    distanceTraveled: 0,
    assignedAds: '',
    areaBase: 'Quezon City',
    selfie: 'https://example.com/images/selfie-juan.jpg',
    startOfRiding: '2025-06-15',
    applyingForAds: 'Summer Sale Ad',
    password: '••••••••',
  },
  {
    id: '4',
    name: 'Maria Santos',
    email: 'maria@example.com',
    contactNumber: '09198765432',
    licenseNumber: 'L7654321',
    licensePicture: 'https://example.com/images/license-maria.jpg',
    orcrPicture: 'https://example.com/images/orcr-maria.jpg',
    plateNumber: 'XYZ789',
    vehicleType: 'Motorcycle',
    vehicleModel: '',
    materialsSupported: 'Vinyl',
    materialsID: 'MAT002',
    status: 'Applicant',
    distanceTraveled: 0,
    assignedAds: '',
    areaBase: 'Manila',
    selfie: 'https://example.com/images/selfie-maria.jpg',
    startOfRiding: '2025-06-20',
    applyingForAds: 'New Bike Launch',
    password: '••••••••',
  },
];

const ManageRiders: React.FC = () => {
  const [riders, setRiders] = useState<Riders[]>(mockRiders);
  const [riderApplications, setRiderApplications] = useState<RiderApplication[]>(mockRiderApplications);
  const [activeTab, setActiveTab] = useState<'Riders List' | 'Manage Application'>('Riders List');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Applicant'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this rider?')) {
      setRiders((prev) => prev.filter((r) => r.id !== id));
      if (expandedId === id) setExpandedId(null);
    }
  };

  const handleApprove = (id: string) => {
    const application = riderApplications.find((r) => r.id === id);
    if (application) {
      setRiders((prev) => [
        ...prev,
        {
          ...application,
          firstName: application.name.split(' ')[0] || '',
          middleName: application.name.split(' ')[1] || '',
          lastName: application.name.split(' ')[2] || '',
          vehicleModel: application.vehicleType, // Assuming vehicleModel can be derived from vehicleType for now
          distanceTraveled: 0,
          assignedAds: application.applyingForAds,
        } as Riders,
      ]);
      setRiderApplications((prev) => prev.filter((r) => r.id !== id));
    }
  };

  const filteredRiders = riders.filter((rider) => {
    const matchesSearch = rider.firstName.toLowerCase().includes(searchTerm.toLowerCase()) || rider.lastName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || rider.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeRiders = filteredRiders.filter((r) => r.status === 'Active');
  const applicants = filteredRiders.filter((r) => r.status === 'Applicant');
  const filteredApplications = riderApplications.filter((application) => {
    const matchesSearch = application.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || application.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="pt-10 pb-10 pl-72 p-8 bg-[#f9f9fc]">
      <div className="bg-[#f9f9fc] w-full">
        {/* Header with Dropdown Title and Add New Button */}
        <div className="flex justify-between items-center mb-6">
          <select
            className="px-3 py-1 text-2xl bg-[#f9f9fc] font-bold text-gray-800 focus:outline-none"
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as 'Riders List' | 'Manage Application')}
          >
            <option value="Riders List">Riders List</option>
            <option value="Manage Application">Manage Application</option>
          </select>
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
            className="border rounded px-3 py-1 text-sm w-64"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="flex space-x-2">
            <select
              className="border rounded px-3 py-1 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'Active' | 'Applicant')}
            >
              <option value="all">All Status</option>
              <option value="Active">Active</option>
              <option value="Applicant">Applicant</option>
            </select>
          </div>
        </div>

        <div className="overflow-auto rounded-md mb-4">
          {activeTab === 'Riders List' ? (
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
                  <th className="px-2 py-2 text-left text-sm font-semibold text-white">First Name</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-white">Last Name</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-white">Email</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-white">Status</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-white">Action</th>
                </tr>
              </thead>
              <tbody>
                {activeRiders.map((rider) => (
                  <React.Fragment key={rider.id}>
                    <tr
                      className="bg-white border-t border-gray-300 cursor-pointer hover:bg-gray-100"
                      onClick={() => setExpandedId(expandedId === rider.id ? null : rider.id)}
                    >
                      <td className="px-2 py-3">
                        <div className="flex justify-center">
                          <input
                            type="checkbox"
                            className="mr-1"
                          />
                        </div>
                      </td>
                      <td className="px-2 py-3">
                        <img
                          src={`https://via.placeholder.com/40?text=${rider.firstName[0]}`}
                          alt={rider.firstName}
                          className="w-8 h-8 rounded-full mr-2 inline-block"
                        />
                        {rider.firstName}
                      </td>
                      <td className="px-4 py-3">{rider.lastName}</td>
                      <td className="px-4 py-3">{rider.email}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium bg-green-200 text-green-800`}
                        >
                          {rider.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 flex space-x-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(rider.id); }}
                          className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 flex items-center"
                        >
                          <TrashIcon className="w-4 h-4 mr-1" /> Delete
                        </button>
                      </td>
                    </tr>
                    {expandedId === rider.id && (
                      <tr className="bg-gray-50">
                        <td colSpan={6} className="p-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                            <div><strong>Contact:</strong> {rider.contactNumber}</div>
                            <div><strong>License #:</strong> {rider.licenseNumber}</div>
                            <div><strong>Plate #:</strong> {rider.plateNumber}</div>
                            <div><strong>Vehicle:</strong> {rider.vehicleType} - {rider.vehicleModel}</div>
                            <div><strong>Materials Supported:</strong> {rider.materialsSupported}</div>
                            <div><strong>Materials ID:</strong> {rider.materialsID}</div>
                            <div><strong>Distance Traveled:</strong> {rider.distanceTraveled} km</div>
                            <div><strong>Assigned Ads:</strong> {rider.assignedAds}</div>
                            <div><strong>Area Base:</strong> {rider.areaBase}</div>
                            <div>
                              <strong>License Pic:</strong><br />
                              <img src={rider.licensePicture} alt="License" className="w-40 h-40 object-cover rounded" />
                            </div>
                            <div>
                              <strong>ORCR Pic:</strong><br />
                              <img src={rider.orcrPicture} alt="ORCR" className="w-40 h-40 object-cover rounded" />
                            </div>
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
                          className="mr-1"
                        />
                        Select All
                      </label>
                    </div>
                  </th>
                  <th className="px-2 py-2 text-left text-sm font-semibold text-white">Name</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-white">Email</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-white">Contact</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-white">Vehicle</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-white">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredApplications.map((application) => (
                  <React.Fragment key={application.id}>
                    <tr
                      className="bg-white cursor-pointer hover:bg-gray-100"
                      onClick={() => setExpandedId(expandedId === application.id ? null : application.id)}
                    >
                      <td className="px-2 py-3">
                        <div className="flex justify-center">
                          <input
                            type="checkbox"
                            className="mr-1"
                          />
                        </div>
                      </td>
                      <td className="px-2 py-3">
                        <img
                          src={`https://via.placeholder.com/40?text=${application.name[0]}`}
                          alt={application.name}
                          className="w-8 h-8 rounded-full mr-2 inline-block"
                        />
                        {application.name}
                      </td>
                      <td className="px-4 py-3">{application.email}</td>
                      <td className="px-4 py-3">{application.contactNumber}</td>
                      <td className="px-4 py-3">{application.vehicleType}</td>
                      <td className="px-4 py-3 flex space-x-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleApprove(application.id); }}
                          className="bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600"
                        >
                          Approve
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(application.id); }}
                          className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 flex items-center"
                        >
                          <TrashIcon className="w-4 h-4 mr-1" /> Delete
                        </button>
                      </td>
                    </tr>
                    {expandedId === application.id && (
                      <tr className="bg-gray-50">
                        <td colSpan={6} className="p-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                            <div><strong>Plate Number:</strong> {application.plateNumber}</div>
                            <div><strong>Materials Supported:</strong> {application.materialsSupported} ({application.materialsID})</div>
                            <div><strong>License Number:</strong> {application.licenseNumber}</div>
                            <div><strong>Area Base:</strong> {application.areaBase}</div>
                            <div>
                              <strong>Selfie:</strong><br />
                              <img src={application.selfie} alt="Selfie" className="h-20 w-20 rounded-full object-cover border" />
                            </div>
                            <div>
                              <strong>License Picture:</strong><br />
                              <img src={application.licensePicture} alt="License Picture" className="w-40 h-40 object-cover rounded" />
                            </div>
                            <div>
                              <strong>OR/CR Picture:</strong><br />
                              <img src={application.orcrPicture} alt="OR/CR Picture" className="w-40 h-40 object-cover rounded" />
                            </div>
                            <div><strong>Applying for Ads:</strong> {application.applyingForAds}</div>
                            <div><strong>Start of Riding:</strong> {application.startOfRiding}</div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Found: {activeTab === 'Riders List' ? activeRiders.length : filteredApplications.length} {activeTab === 'Riders List' ? 'rider(s)' : 'applicant(s)'}</span>
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

export default ManageRiders;