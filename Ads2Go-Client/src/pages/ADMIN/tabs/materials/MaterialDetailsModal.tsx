import React, { useState } from 'react';
import { X, Check, Calendar, UserPlus, UserX, QrCode, Edit } from 'lucide-react';

interface Driver {
  driverId: string;
  fullName: string;
  email: string;
  contactNumber: string;
  vehiclePlateNumber: string;
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

interface MaterialDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  material: Material | null;
  onRemoveFromDriver: (id: string) => void;
  onAssignDriver: (material: Material) => void;
  onShowConnectionDetails: (materialId: string, slotNumber: number) => void;
  editingDates: {[key: string]: {mountedAt: string, dismountedAt: string}};
  savingDates: {[key: string]: boolean};
  onStartEditingDates: (materialId: string, material: Material) => void;
  onCancelEditingDates: (materialId: string) => void;
  onSaveDateChanges: (materialId: string) => void;
  onUpdateEditingDate: (materialId: string, field: 'mountedAt' | 'dismountedAt', value: string) => void;
}

const MaterialDetailsModal: React.FC<MaterialDetailsModalProps> = ({
  isOpen,
  onClose,
  material,
  onRemoveFromDriver,
  onAssignDriver,
  onShowConnectionDetails,
  editingDates,
  savingDates,
  onStartEditingDates,
  onCancelEditingDates,
  onSaveDateChanges,
  onUpdateEditingDate
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        setIsModalOpen(true);
      }, 10);
    } else {
      setIsModalOpen(false);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const getStatus = (material: Material): 'Used' | 'Available' => {
    return material.driverId ? 'Used' : 'Available';
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'N/A';
    }
  };

  if (!isOpen || !material) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
      onClick={handleClose}
    >
      <div
        className={`fixed top-2 bottom-2 right-2 max-w-xl w-full bg-white shadow-xl rounded-lg flex flex-col transform transition-transform duration-300 ease-in-out ${
          isModalOpen ? "translate-x-0" : "translate-x-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6 border-b pb-4 p-6">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-800">
              {material.materialId}
            </h2>
          </div>
          <span
            className={`px-3 py-1 text-xs mr-40 font-medium rounded-full ${
              getStatus(material) === "Used"
                ? "bg-red-200 text-red-800"
                : "bg-green-200 text-green-800"
            }`}
          >
            {getStatus(material)}
          </span>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-grow overflow-y-auto px-6 pb-6">
          {/* Material Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div>
              <span className="text-xs font-semibold">Name:</span>
              <div className="w-full text-xl py-2 font-bold">
                {material.materialType}
              </div>
            </div>
            <div>
              <span className="text-xs font-semibold">Category:</span>
              <div className="w-full text-xl py-2 font-bold">
                {material.category}
              </div>
            </div>
            <div>
              <span className="text-xs font-semibold">Vehicle Type:</span>
              <div className="w-full text-xl py-2 font-bold">
                {material.vehicleType}
              </div>
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div>
              <span className="text-sm font-semibold">Description:</span>
              <textarea
                value={material.description || "N/A"}
                readOnly
                className="w-full text-sm mt-2 py-2 h-20 resize-none focus:outline-none"
              />
            </div>
            <div>
              <span className="text-sm font-semibold">Requirements:</span>
              <textarea
                value={material.requirements || "N/A"}
                readOnly
                className="w-full text-sm px-3 mt-2 py-2 border rounded-lg h-20 resize-none focus:ring-1 focus:outline-none ring-gray-200"
              />
            </div>
          </div>

          {/* Driver Details Table */}
          <div className="rounded-lg overflow-hidden border border-gray-200 mb-6">
            <h3 className="text-sm font-bold text-gray-800 text-center px-4 py-2 bg-gray-50 border-b">
              Driver Details
            </h3>
            <table className="table-auto w-full border-collapse">
              <tbody className="bg-white text-sm">
                <tr className="border-b">
                  <td className="px-4 py-2 text-left text-gray-700 font-semibold">Driver Name</td>
                  <td className="px-4 py-2 text-left pl-20 text-gray-900">
                    {material.driver?.fullName || "N/A"}
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-2 text-left text-gray-700 font-semibold">Plate Number</td>
                  <td className="px-4 py-2 text-left pl-20 text-gray-900">
                    {material.driver?.vehiclePlateNumber || "N/A"}
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-2 text-left text-gray-700 font-semibold">Car Type</td>
                  <td className="px-4 py-2 text-left pl-20 text-gray-900">
                    {material.vehicleType || "N/A"}
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-2 text-left text-gray-700 font-semibold">Contact</td>
                  <td className="px-4 py-2 text-left pl-20 text-gray-900">
                    {material.driver?.contactNumber || "N/A"}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-left text-gray-700 font-semibold">Email</td>
                  <td className="px-4 py-2 text-left pl-20 text-gray-900">
                    {material.driver?.email || "N/A"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {/* Mounted Date */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Mounted Date:</span>
                {!editingDates[material.id] && (
                  <button
                    onClick={() => onStartEditingDates(material.id, material)}
                    className="text-blue-500 hover:text-blue-600 text-xs flex items-center gap-1"
                  >
                    <Edit size={12} />
                    Edit
                  </button>
                )}
              </div>
              {editingDates[material.id] ? (
                <>
                  <div className="relative mt-1">
                    <input
                      type="datetime-local"
                      value={editingDates[material.id].mountedAt || ""}
                      onChange={(e) =>
                        onUpdateEditingDate(
                          material.id,
                          "mountedAt",
                          e.target.value
                        )
                      }
                      className="w-full text-sm px-3 py-2 border rounded-lg appearance-none [::-webkit-calendar-picker-indicator]:opacity-0"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => onSaveDateChanges(material.id)}
                      disabled={savingDates[material.id]}
                      className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 disabled:bg-gray-400 flex items-center gap-1"
                    >
                      {savingDates[material.id] ? "Saving..." : (
                        <>
                          <Check size={12} /> Save
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => onCancelEditingDates(material.id)}
                      disabled={savingDates[material.id]}
                      className="px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 disabled:bg-gray-400 flex items-center gap-1"
                    >
                      <X size={12} /> Cancel
                    </button>
                  </div>
                </>
              ) : (
                <div className="w-full text-sm px-3 py-2 bg-gray-100 border rounded-lg mt-1">
                  {formatDate(material.mountedAt)}
                </div>
              )}
            </div>

            {/* Dismounted Date */}
            <div>
              <span className="text-sm font-semibold text-gray-700">Dismounted Date:</span>
              {editingDates[material.id] ? (
                <div className="relative mt-1">
                  <input
                    type="datetime-local"
                    value={editingDates[material.id].dismountedAt || ""}
                    onChange={(e) =>
                      onUpdateEditingDate(
                        material.id,
                        "dismountedAt",
                        e.target.value
                      )
                    }
                    className="w-full text-sm px-3 py-2 border rounded-lg  appearance-none [::-webkit-calendar-picker-indicator]:opacity-0"
                  />
                </div>
              ) : (
                <div className="w-full text-sm px-3 py-2 bg-gray-100 border rounded-lg mt-1">
                  {formatDate(material.dismountedAt)}
                </div>
              )}
            </div>

            {/* Created */}
            <div>
              <span className="text-sm font-semibold text-gray-700">Created:</span>
              <div className="w-full text-sm px-3 py-2 bg-gray-100 border rounded-lg">
                {formatDate(material.createdAt)}
              </div>
            </div>

            {/* Updated */}
            <div>
              <span className="text-sm font-semibold text-gray-700">Updated:</span>
              <div className="w-full text-sm px-3 py-2 bg-gray-100 border rounded-lg">
                {formatDate(material.updatedAt)}
              </div>
            </div>
          </div>

          {/* QR Code Section for HEADDRESS materials */}
          {material.materialType === "HEADDRESS" && (
            <div className="mt-6 space-y-4">
              <h4 className="text-md font-semibold text-gray-800 border-b pb-2">
                QR Codes
              </h4>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    onShowConnectionDetails(material.materialId, 1)
                  }
                  className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition-colors"
                  title="View tablet connection details for Slot 1"
                >
                  <QrCode size={16} />
                  Slot 1
                </button>
                <button
                  onClick={() =>
                    onShowConnectionDetails(material.materialId, 2)
                  }
                  className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition-colors"
                  title="View tablet connection details for Slot 2"
                >
                  <QrCode size={16} />
                  Slot 2
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t mt-auto">
          <div className="flex justify-end">
            {getStatus(material) === "Available" ? (
              <button
                onClick={() => onAssignDriver(material)}
                className="w-48 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                <UserPlus size={16} />
                Assign Driver
              </button>
            ) : (
              <button
                onClick={() => onRemoveFromDriver(material.id)}
                className="w-48 flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                <UserX size={16} />
                Remove Driver
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaterialDetailsModal;
