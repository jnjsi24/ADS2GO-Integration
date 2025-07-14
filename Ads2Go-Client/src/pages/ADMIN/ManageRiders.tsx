import React, { useState } from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';

interface Rider {
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
  distanceTraveled: number;           // new
  assignedAds: string;                // new
  areaBase: string;                   // new
}


const mockRiders: Rider[] = [
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
    distanceTraveled: 1200, // new
    assignedAds: 'Company A', // new
    areaBase: 'Quezon City', // new
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
    distanceTraveled: 500, // new
    assignedAds: 'Company B', // new
    areaBase: 'Makati City', // new
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
    distanceTraveled: 800, // new
    assignedAds: 'Company C', // new
    areaBase: 'Taguig City', // new
  },
];


const ManageRider: React.FC = () => {
  const [riders, setRiders] = useState<Rider[]>(mockRiders);
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'applicants'>('active');

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this rider?')) {
      setRiders((prev) => prev.filter((r) => r.id !== id));
    }
  };

  const handleApprove = (id: string) => {
    setRiders((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status: 'Active' } : r
      )
    );
  };

  const activeRiders = riders.filter((r) => r.status === 'Active');
  const applicants = riders.filter((r) => r.status === 'Applicant');

  const renderRiderTable = (title: string, data: Rider[], showApproveButton = false) => (
    <div className="mb-10">
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      <table className="w-full bg-gray-800 rounded-lg overflow-hidden shadow-md">
        <thead className="bg-gray-700 text-white">
          <tr>
            <th className="p-3 text-left">Name</th>
            <th className="p-3 text-left">Email</th>
            <th className="p-3 text-left">Vehicle</th>
            <th className="p-3 text-left">Plate #</th>
            <th className="p-3 text-left">Contact</th>
            <th className="p-3 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((rider) => (
            <tr key={rider.id} className="border-b border-gray-600">
              <td className="p-3 cursor-pointer" onClick={() => setSelectedRider(rider)}>
                {rider.firstName} {rider.lastName}
              </td>
              <td className="p-3">{rider.email}</td>
              <td className="p-3">{rider.vehicleModel}</td>
              <td className="p-3">{rider.plateNumber}</td>
              <td className="p-3">{rider.contactNumber}</td>
              <td className="p-3 flex space-x-2">
                {showApproveButton && (
                  <button
                    onClick={() => handleApprove(rider.id)}
                    className="bg-green-500 px-3 py-1 rounded hover:bg-green-600"
                  >
                    Approve
                  </button>
                )}
                <button
                  onClick={() => setSelectedRider(rider)}
                  className="bg-blue-500 px-3 py-1 rounded hover:bg-blue-600"
                >
                  View
                </button>
                <button
                  onClick={() => handleDelete(rider.id)}
                  className="bg-red-500 px-3 py-1 rounded hover:bg-red-600 flex items-center"
                >
                  <TrashIcon className="w-4 h-4 mr-1" /> Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="p-8 bg-gray-900 min-h-screen text-white">
      <h1 className="text-2xl font-bold mb-4">Manage Riders</h1>

      {/* Navbar for Tabs */}
      <div className="mb-6 flex space-x-4">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 rounded-lg ${activeTab === 'active' ? 'bg-blue-600' : 'bg-gray-700'} hover:bg-blue-600`}
        >
          Active Riders
        </button>
        <button
          onClick={() => setActiveTab('applicants')}
          className={`px-4 py-2 rounded-lg ${activeTab === 'applicants' ? 'bg-blue-600' : 'bg-gray-700'} hover:bg-blue-600`}
        >
          Rider Applicants
        </button>
      </div>

      {/* Render Table Based on Active Tab */}
      {activeTab === 'active' && renderRiderTable('Active Riders', activeRiders)}
      {activeTab === 'applicants' && renderRiderTable('Rider Applicants', applicants, true)}

      {selectedRider && (
  <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex justify-center items-center z-50">
    <div className="bg-gray-800 p-6 rounded-lg w-[500px] space-y-2">
      <h2 className="text-xl font-bold mb-4">Rider Details</h2>
      <p><strong>Name:</strong> {selectedRider.firstName} {selectedRider.middleName} {selectedRider.lastName}</p>
      <p><strong>Email:</strong> {selectedRider.email}</p>
      <p><strong>Contact:</strong> {selectedRider.contactNumber}</p>
      <p><strong>License #:</strong> {selectedRider.licenseNumber}</p>
      <p><strong>Plate #:</strong> {selectedRider.plateNumber}</p>
      <p><strong>Vehicle:</strong> {selectedRider.vehicleType} - {selectedRider.vehicleModel}</p>
      <p><strong>Materials Supported:</strong> {selectedRider.materialsSupported}</p>
      <p><strong>Materials ID:</strong> {selectedRider.materialsID}</p>
      <p><strong>Distance Traveled:</strong> {selectedRider.distanceTraveled} km</p>
      <p><strong>Assigned Ads:</strong> {selectedRider.assignedAds}</p>
      <p><strong>Area Base / City:</strong> {selectedRider.areaBase}</p>
      <p><strong>License Pic:</strong> {selectedRider.licensePicture}</p>
      <p><strong>ORCR Pic:</strong> {selectedRider.orcrPicture}</p>

      <button
        onClick={() => setSelectedRider(null)}
        className="mt-4 bg-gray-600 px-3 py-1 rounded"
      >
        Close
      </button>
    </div>
  </div>
)}

    </div>
  );
};

export default ManageRider;
