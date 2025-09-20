import React, { useState } from 'react';

interface Driver {
  driverId: string;
  fullName: string;
  email: string;
  contactNumber: string;
  vehiclePlateNumber: string;
}

interface DriverWithVehicleType extends Driver {
  vehicleType: 'CAR' | 'MOTORCYCLE' | 'BUS' | 'JEEP' | 'E_TRIKE';
  preferredMaterialType?: ('POSTER' | 'LCD' | 'STICKER' | 'HEADDRESS' | 'BANNER')[];
}

interface Material {
  id: string;
  materialId: string;
  vehicleType: 'CAR' | 'MOTORCYCLE' | 'BUS' | 'JEEP' | 'E_TRIKE';
  materialType: 'POSTER' | 'LCD' | 'STICKER' | 'HEADDRESS' | 'BANNER';
  description?: string;
  requirements: string;
  category: 'DIGITAL' | 'NON_DIGITAL';
  driverId?: string;
  driver?: Driver;
  mountedAt?: string;
  dismountedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface DriverAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  material: Material | null;
  drivers: DriverWithVehicleType[];
  materials: Material[];
  onAssign: (driverId: string) => void;
  assigning: boolean;
}

const DriverAssignmentModal: React.FC<DriverAssignmentModalProps> = ({
  isOpen,
  onClose,
  material,
  drivers,
  materials,
  onAssign,
  assigning
}) => {
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');

  // Filter available drivers based on material requirements AND preferences
  const getCompatibleDrivers = (material: Material): DriverWithVehicleType[] => {
    console.log('Filtering drivers for material:', material);
    console.log('All drivers:', drivers);
    
    // Get all driver IDs that currently have materials assigned
    const assignedDriverIds = materials
      .filter(mat => mat.driverId)
      .map(mat => mat.driverId);

    console.log('Assigned driver IDs:', assignedDriverIds);

    // Filter drivers by vehicle type compatibility, availability, and material preferences
    const compatibleDrivers = drivers.filter((driver: DriverWithVehicleType) => {
      const isVehicleTypeCompatible = driver.vehicleType === material.vehicleType;
      const isDriverAvailable = !assignedDriverIds.includes(driver.driverId);
      
      // Check if driver has material preferences
      const hasPreferences = driver.preferredMaterialType && driver.preferredMaterialType.length > 0;
      
      // If driver has preferences, check if the material type matches their preferences
      const matchesPreferences = hasPreferences 
        ? driver.preferredMaterialType!.includes(material.materialType)
        : true; // If no preferences set, accept all compatible material types
      
      console.log(`Driver ${driver.fullName}:`, {
        vehicleType: driver.vehicleType,
        isVehicleTypeCompatible,
        isDriverAvailable,
        hasPreferences,
        preferredMaterialType: driver.preferredMaterialType,
        materialType: material.materialType,
        matchesPreferences
      });

      return isVehicleTypeCompatible && isDriverAvailable && matchesPreferences;
    });

    console.log('Compatible drivers found:', compatibleDrivers);
    return compatibleDrivers;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDriverId || !material) {
      alert('Please select a driver');
      return;
    }

    try {
      // Note: The backend logic will automatically find and assign an available material
      // of the appropriate type for this driver. Since we're selecting a specific material
      // through the UI, we inform the user about this behavior.
      await onAssign(selectedDriverId);
    } catch (error) {
      console.error('Error assigning material:', error);
    }
  };

  const handleClose = () => {
    setSelectedDriverId('');
    onClose();
  };

  if (!isOpen || !material) return null;

  const compatibleDrivers = getCompatibleDrivers(material);

  return (
    <div
      className="fixed inset-0 z-[51] flex items-end justify-center mr-11 p-6"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-lg shadow-lg w-full max-w-sm p-6 translate-y-[1rem] transform transition-transform duration-300 ease-in-out scale-100" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Target Material Details */}
        <h2 className="text-lg font-bold text-center text-gray-800 mb-4">
          Target Material Details
        </h2>

        {/* Table for Material Info */}
        <div className="rounded-lg overflow-hidden  mb-6">
          <table className="table-auto w-full border-collapse text-sm">
            <tbody className="bg-white text-gray-700">
              <tr className="border-b">
                <td className="px-4 py-2 font-bold w-1/3">ID:</td>
                <td className="px-4 py-2 text-right text-gray-900">{material.materialId}</td>
              </tr>
              <tr className="border-b">
                <td className="px-4 py-2 font-bold">Type:</td>
                <td className="px-4 py-2 text-right text-gray-900">{material.materialType}</td>
              </tr>
              <tr className="border-b">
                <td className="px-4 py-2 font-bold whitespace-nowrap">Vehicle Type:</td>
                <td className="px-4 py-2 text-right text-gray-900">{material.vehicleType}</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-bold">Category:</td>
                <td className="px-4 py-2 text-right text-gray-900">{material.category}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Select Driver */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Select Driver
            </label>
            <select
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline focus:outline-gray-300"
              disabled={compatibleDrivers.length === 0}
            >
              <option value="">Choose a driver...</option>
              {compatibleDrivers.map((driver) => (
                <option key={driver.driverId} value={driver.driverId}>
                  {driver.fullName} - {driver.vehiclePlateNumber} ({driver.vehicleType})
                </option>
              ))}
            </select>
            {compatibleDrivers.length === 0 && (
              <p className="text-red-600 text-sm mt-2">No compatible drivers found!</p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex justify-between gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={assigning || compatibleDrivers.length === 0}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50"
            >
              {assigning ? "Assigning..." : "Assign Driver"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DriverAssignmentModal;
