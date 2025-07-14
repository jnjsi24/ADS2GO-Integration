import React from 'react';

interface MaterialEntry {
  id: string;
  name: string;
  vehicleType: string;
  status: 'Available' | 'In Use by Rider';
  riderId?: string;
  riderName?: string;
}

const mockMaterials: MaterialEntry[] = [
  { id: 'MAT001', name: 'LCD Screen', vehicleType: 'Car', status: 'In Use by Rider', riderId: 'RID123', riderName: 'Juan Dela Cruz' },
  { id: 'MAT002', name: 'Stickers', vehicleType: 'Car', status: 'Available' },
  { id: 'MAT003', name: 'Posters', vehicleType: 'Car', status: 'In Use by Rider', riderId: 'RID124', riderName: 'Maria Santos' },
  { id: 'MAT004', name: 'LCD HEAD DRESS', vehicleType: 'Car', status: 'Available' },

  { id: 'MAT005', name: 'Posters', vehicleType: 'Motorcycle', status: 'In Use by Rider', riderId: 'RID125', riderName: 'Jose Rizal' },
  { id: 'MAT006', name: 'LCD Screen', vehicleType: 'Motorcycle', status: 'Available' },

  { id: 'MAT007', name: 'Posters', vehicleType: 'Electric Tricycle', status: 'Available' },
  { id: 'MAT008', name: 'LCD Screen', vehicleType: 'Electric Tricycle', status: 'In Use by Rider', riderId: 'RID126', riderName: 'Andres Bonifacio' },
];

const Materials: React.FC = () => {
  return (
    <div className="p-8 bg-gray-900 min-h-screen text-white">
      <h1 className="text-2xl font-bold mb-6">Materials Overview</h1>

      <table className="w-full bg-gray-800 rounded-lg overflow-hidden shadow-md">
        <thead className="bg-gray-700 text-white">
          <tr>
            <th className="p-3 text-left">Material ID</th>
            <th className="p-3 text-left">Material</th>
            <th className="p-3 text-left">Vehicle Type</th>
            <th className="p-3 text-left">Status</th>
            <th className="p-3 text-left">Rider ID</th>
            <th className="p-3 text-left">Rider Name</th>
          </tr>
        </thead>
        <tbody>
          {mockMaterials.map((material, idx) => (
            <tr key={idx} className="border-b border-gray-600">
              <td className="p-3">{material.id}</td>
              <td className="p-3">{material.name}</td>
              <td className="p-3">{material.vehicleType}</td>
              <td className={`p-3 font-semibold ${material.status === 'Available' ? 'text-green-400' : 'text-yellow-400'}`}>
                {material.status}
              </td>
              <td className="p-3">{material.status === 'In Use by Rider' ? material.riderId : '—'}</td>
              <td className="p-3">{material.status === 'In Use by Rider' ? material.riderName : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Materials;
