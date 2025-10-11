import React, { useState, useEffect } from 'react';
import { X, Check, Calendar, UserPlus, UserX, QrCode, History } from 'lucide-react';
import MaterialUsageHistoryModal from './MaterialUsageHistoryModal';

interface Driver {
  driverId: string;
  fullName: string;
  email: string;
  contactNumber: string;
  vehiclePlateNumber: string;
}

interface InspectionPhoto {
  url: string;
  uploadedAt: string;
  uploadedBy: string;
  description?: string;
  month: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
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
  materialCondition?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED';
  inspectionPhotos?: InspectionPhoto[];
  photoComplianceStatus?: 'COMPLIANT' | 'NON_COMPLIANT' | 'PENDING';
  lastInspectionDate?: string;
  nextInspectionDue?: string;
}

interface MaterialDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  material: Material | null;
  onRemoveFromDriver: (id: string) => void;
  onAssignDriver: (material: Material) => void;
  onShowConnectionDetails: (materialId: string, slotNumber: number) => void;
  editingDates: { [key: string]: { mountedAt: string; dismountedAt: string } };
  savingDates: { [key: string]: boolean };
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
  onUpdateEditingDate,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showUsageHistory, setShowUsageHistory] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
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
        hour12: true,
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'N/A';
    }
  };

  if (!isOpen || !material) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-black bg-opacity-50"
      onClick={handleClose}
    >
      <div
        className={`fixed ${
          isMobile
            ? 'inset-x-4 top-16 bottom-6 w-auto max-h-[80vh] rounded-md'
            : 'top-2 bottom-2 right-2 w-full max-w-xl rounded-lg'
        } bg-white shadow-xl transform transition-all duration-300 ease-in-out ${
          isModalOpen
            ? isMobile
              ? 'scale-100 opacity-100'
              : 'translate-x-0 opacity-100'
            : isMobile
              ? 'scale-95 opacity-0'
              : 'translate-x-full opacity-0'
        } flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between ${isMobile ? 'p-4' : 'p-6'} border-b pb-4`}>
          <div className="flex gap-3 items-center">
            <h2 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-gray-800`}>
              {material.materialId}
            </h2>
            <span
              className={`px-3 py-1 text-xs font-medium rounded-full ${
                getStatus(material) === 'Used'
                  ? 'bg-red-200 text-red-800'
                  : 'bg-green-200 text-green-800'
              }`}
            >
              {getStatus(material)}
            </span>
          </div>
          {isMobile && (
            <button
              onClick={handleClose}
              className="p-1 rounded-full hover:bg-gray-200"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className={`flex-grow overflow-y-auto ${isMobile ? 'p-4' : 'p-6'}`}>
          {/* Driver Details Table */}
          <div className="rounded-lg overflow-hidden mb-6">
            <h3 className="text-md font-bold text-gray-800 py-2">
              Driver Details
            </h3>
            {isMobile ? (
              <div className="bg-white text-sm grid grid-cols-[1fr,2fr] gap-4 px-4 py-2">
                <div className="space-y-3">
                  <span className="block text-gray-900">Driver Name</span>
                  <span className="block text-gray-900">Plate Number</span>
                  <span className="block text-gray-900">Car Type</span>
                  <span className="block text-gray-900">Contact</span>
                  <span className="block text-gray-900">Email</span>
                  <span className="block text-gray-900">Created</span>
                  <span className="block text-gray-900">Updated</span>
                </div>
                <div className="space-y-3">
                  <span className="block font-semibold">{material.driver?.fullName || 'N/A'}</span>
                  <span className="block font-semibold">{material.driver?.vehiclePlateNumber || 'N/A'}</span>
                  <span className="block font-semibold">{material.vehicleType || 'N/A'}</span>
                  <span className="block font-semibold">{material.driver?.contactNumber || 'N/A'}</span>
                  <span className="block font-semibold">{material.driver?.email || 'N/A'}</span>
                  <span className="block font-semibold">{formatDate(material.createdAt)}</span>
                  <span className="block font-semibold">{formatDate(material.updatedAt)}</span>
                </div>
              </div>
            ) : (
              <div className="bg-white text-sm grid sm:grid-cols-2 gap-4 px-4 py-2">
                <div className="pb-2">
                  <span className="block text-gray-900">Driver Name</span>
                  <span className="block font-semibold">{material.driver?.fullName || 'N/A'}</span>
                </div>
                <div className="pb-2">
                  <span className="block text-gray-900">Plate Number</span>
                  <span className="block font-semibold">{material.driver?.vehiclePlateNumber || 'N/A'}</span>
                </div>
                <div className="pb-2">
                  <span className="block text-gray-900">Car Type</span>
                  <span className="block font-semibold">{material.vehicleType || 'N/A'}</span>
                </div>
                <div className="pb-2">
                  <span className="block text-gray-900">Contact</span>
                  <span className="block font-semibold">{material.driver?.contactNumber || 'N/A'}</span>
                </div>
                <div className="pb-2">
                  <span className="block text-gray-900">Email</span>
                  <span className="block font-semibold">{material.driver?.email || 'N/A'}</span>
                </div>
                <div className="pb-2">
                  <span className="block text-gray-900">Created</span>
                  <span className="block font-semibold">{formatDate(material.createdAt)}</span>
                </div>
                <div>
                  <span className="block text-gray-900">Updated</span>
                  <span className="block font-semibold">{formatDate(material.updatedAt)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Dates */}
          <div className={`grid ${isMobile ? 'grid-cols-1' : 'sm:grid-cols-2'} gap-4 mb-6`}>
            {/* Mounted Date */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Mounted Date:</span>
                {!editingDates[material.id] && (
                  <button
                    onClick={() => onStartEditingDates(material.id, material)}
                    className="group flex items-center text-gray-700 rounded-md overflow-hidden h-6 w-7 hover:w-14 transition-[width] duration-300"
                  >
                    <Calendar className="w-4 h-4 flex-shrink-0 mx-auto ml-1.5 group-hover:ml-1 transition-all duration-300" />
                    <span className="opacity-0 group-hover:opacity-100 ml-1 group-hover:mr-3 whitespace-nowrap text-xs transition-all duration-300">
                      Edit
                    </span>
                  </button>
                )}
              </div>
              {editingDates[material.id] ? (
                <>
                  <div className="relative mt-1">
                    <input
                      type="datetime-local"
                      value={editingDates[material.id].mountedAt || ''}
                      onChange={(e) => onUpdateEditingDate(material.id, 'mountedAt', e.target.value)}
                      className="w-full text-sm px-3 py-2 border rounded-lg appearance-none [::-webkit-calendar-picker-indicator]:opacity-0"
                    />
                  </div>
                  <div className="flex justify-between gap-2 pt-2">
                    <button
                      onClick={() => onCancelEditingDates(material.id)}
                      disabled={savingDates[material.id]}
                      className="px-3 py-1 text-black border text-xs rounded hover:bg-gray-100 disabled:bg-gray-400 flex items-center gap-1"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => onSaveDateChanges(material.id)}
                      disabled={savingDates[material.id]}
                      className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 disabled:bg-gray-400 flex items-center gap-1"
                    >
                      {savingDates[material.id] ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="w-full text-sm px-3 py-2 bg-gray-50 shadow-md border rounded-lg mt-1">
                  {formatDate(material.mountedAt)}
                </div>
              )}
            </div>

            {/* Dismounted Date */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Dismounted Date:</span>
                {!editingDates[material.id] && (
                  <button
                    onClick={() => onStartEditingDates(material.id, material)}
                    className="group flex items-center text-gray-700 rounded-md overflow-hidden h-6 w-7 hover:w-14 transition-[width] duration-300"
                  >
                    <Calendar className="w-4 h-4 flex-shrink-0 mx-auto ml-1.5 group-hover:ml-1 transition-all duration-300" />
                    <span className="opacity-0 group-hover:opacity-100 ml-1 group-hover:mr-3 whitespace-nowrap text-xs transition-all duration-300">
                      Edit
                    </span>
                  </button>
                )}
              </div>
              {editingDates[material.id] ? (
                <div className="relative mt-1">
                  <input
                    type="datetime-local"
                    value={editingDates[material.id].dismountedAt || ''}
                    onChange={(e) => onUpdateEditingDate(material.id, 'dismountedAt', e.target.value)}
                    className="w-full text-sm px-3 py-2 border rounded-lg appearance-none [::-webkit-calendar-picker-indicator]:opacity-0"
                  />
                </div>
              ) : (
                <div className="w-full text-sm px-3 py-2 bg-gray-50 shadow-md border rounded-lg mt-1">
                  {formatDate(material.dismountedAt)}
                </div>
              )}
            </div>
          </div>

          {/* Description and Requirements */}
          <div className="mb-6">
            <div className={`flex ${isMobile ? 'flex-col' : 'gap-6'}`}>
              <div className={`${isMobile ? 'w-full mb-4' : 'w-1/2'}`}>
                <span className="text-sm font-semibold">Description:</span>
                <textarea
                  value={material.description || 'N/A'}
                  readOnly
                  className="w-full text-sm mt-2 py-2 h-20 resize-none focus:outline-none px-3"
                />
              </div>
              <div className={`${isMobile ? 'w-full' : 'w-1/2'}`}>
                <span className="text-sm font-semibold">Requirements:</span>
                <textarea
                  value={material.requirements || 'N/A'}
                  readOnly
                  className="w-full text-sm mt-2 py-2 h-20 resize-none focus:ring-1 focus:outline-none px-3 ring-gray-200"
                />
              </div>
            </div>
          </div>

          {/* QR Code Section for HEADDRESS materials */}
          {material.materialType === 'HEADDRESS' && (
            <div className="mt-10 space-y-4">
              <h4 className="text-md font-bold text-gray-800 border-b pb-2">
                QR Codes
              </h4>
              <div className="flex gap-2">
                <button
                  onClick={() => onShowConnectionDetails(material.materialId, 1)}
                  className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition-colors"
                  title="View tablet connection details for Slot 1"
                >
                  <QrCode size={16} />
                  Slot 1
                </button>
                <button
                  onClick={() => onShowConnectionDetails(material.materialId, 2)}
                  className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition-colors"
                  title="View tablet connection details for Slot 2"
                >
                  <QrCode size={16} />
                  Slot 2
                </button>
              </div>
            </div>
          )}

          {/* Material Condition and Inspection Photos Section */}
          <div className="mt-10 space-y-4">
            <h4 className="text-md font-bold text-gray-800">
              Material Condition & Inspection
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-semibold text-gray-700">Condition:</span>
                <div className="mt-1">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      material.materialCondition === 'EXCELLENT'
                        ? 'bg-green-200 text-green-800'
                        : material.materialCondition === 'GOOD'
                        ? 'bg-blue-200 text-blue-800'
                        : material.materialCondition === 'FAIR'
                        ? 'bg-yellow-200 text-yellow-800'
                        : material.materialCondition === 'POOR'
                        ? 'bg-orange-200 text-orange-800'
                        : material.materialCondition === 'DAMAGED'
                        ? 'bg-red-200 text-red-800'
                        : 'bg-gray-200 text-gray-800'
                    }`}
                  >
                    {material.materialCondition || 'GOOD'}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-sm font-semibold text-gray-700">Photo Compliance:</span>
                <div className="mt-1">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      material.photoComplianceStatus === 'COMPLIANT'
                        ? 'bg-green-200 text-green-800'
                        : material.photoComplianceStatus === 'NON_COMPLIANT'
                        ? 'bg-red-200 text-red-800'
                        : 'bg-yellow-200 text-yellow-800'
                    }`}
                  >
                    {material.photoComplianceStatus || 'PENDING'}
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-semibold text-gray-700">Last Inspection:</span>
                <div className="w-full text-sm px-3 py-2 bg-gray-50 shadow-md border rounded-lg mt-1">
                  {formatDate(material.lastInspectionDate) || 'N/A'}
                </div>
              </div>
              <div>
                <span className="text-sm font-semibold text-gray-700">Next Inspection Due:</span>
                <div className="w-full text-sm px-3 py-2 bg-gray-50 shadow-md border rounded-lg mt-1">
                  {formatDate(material.nextInspectionDue) || 'N/A'}
                </div>
              </div>
            </div>
            <div>
              <span className="text-sm font-semibold text-gray-700">Monthly Inspection Photos:</span>
              {material.inspectionPhotos && material.inspectionPhotos.length > 0 ? (
                <div className="mt-2 space-y-3">
                  {material.inspectionPhotos.map((photo, index) => (
                    <div key={index} className="border rounded-lg p-3 bg-gray-50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700">{photo.month}</span>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              photo.status === 'APPROVED'
                                ? 'bg-green-200 text-green-800'
                                : photo.status === 'REJECTED'
                                ? 'bg-red-200 text-red-800'
                                : 'bg-yellow-200 text-yellow-800'
                            }`}
                          >
                            {photo.status}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">{formatDate(photo.uploadedAt)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <img
                          src={photo.url}
                          alt={`Inspection photo for ${photo.month}`}
                          className={`${isMobile ? 'w-16 h-16' : 'w-20 h-20'} object-cover rounded border`}
                          onError={(e) => {
                            e.currentTarget.src = '/placeholder-image.png';
                          }}
                        />
                        <div className="flex-1">
                          {photo.description && (
                            <p className="text-sm text-gray-600 mb-1">{photo.description}</p>
                          )}
                          <p className="text-xs text-gray-500">Uploaded by: {photo.uploadedBy}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 p-4 border-2 border-dashed border-gray-300 rounded-lg text-center">
                  <p className="text-sm text-gray-500">No inspection photos available</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Monthly photos will appear here once uploaded by drivers
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`p-${isMobile ? '4' : '6'} mt-auto`}>
          <div
            className={`flex ${
              isMobile ? 'justify-between gap-2 w-full' : 'justify-between'
            }`}
          >
            {/* Usage History Button */}
            <button
              onClick={() => setShowUsageHistory(true)}
              className={`flex items-center gap-2 px-3 py-2 bg-blue-500 text-white text-xs sm:text-sm rounded-lg hover:bg-blue-600 transition-colors ${
                isMobile ? 'w-1/2 justify-center' : 'w-36 justify-start'
              }`}
              title="View driver usage history"
            >
              <History size={16} />
              Usage History
            </button>

            {/* Conditional Button */}
            {getStatus(material) === 'Available' ? (
              <button
                onClick={() => onAssignDriver(material)}
                className={`flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 text-white text-xs sm:text-sm rounded-lg hover:bg-blue-600 transition-colors ${
                  isMobile ? 'w-1/2' : 'w-48'
                }`}
              >
                <UserPlus size={16} />
                Assign Driver
              </button>
            ) : (
              <button
                onClick={() => onRemoveFromDriver(material.id)}
                className={`flex items-center justify-center gap-2 px-3 py-2 bg-red-500 text-white text-xs sm:text-sm rounded-lg hover:bg-red-600 transition-colors ${
                  isMobile ? 'w-1/2' : 'w-48'
                }`}
              >
                <UserX size={16} />
                Remove Driver
              </button>
            )}
          </div>
        </div>

        {/* Usage History Modal */}
        <MaterialUsageHistoryModal
          isOpen={showUsageHistory}
          onClose={() => setShowUsageHistory(false)}
          materialId={material.id}
          materialName={material.materialId}
        />
      </div>
    </div>
  );
};

export default MaterialDetailsModal;