import React, { useState, useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { X, Clock, User, Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import { GET_MATERIAL_USAGE_HISTORY } from '../../../../graphql/admin/queries/materials';

interface DriverInfo {
  driverId: string;
  fullName: string;
  email: string;
  contactNumber: string;
  vehiclePlateNumber: string;
}

interface AdminInfo {
  adminId: string;
  adminName: string;
  adminEmail: string;
}

interface UsageHistoryEntry {
  id: string;
  materialId: string;
  driverId: string;
  driverInfo: DriverInfo;
  assignedAt: string;
  unassignedAt?: string | null;
  mountedAt?: string | null;
  dismountedAt?: string | null;
  usageDuration?: number;
  assignmentReason: string;
  unassignmentReason?: string | null;
  customDismountReason?: string | null;
  assignedByAdmin?: AdminInfo | null;
  unassignedByAdmin?: AdminInfo | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MaterialUsageHistoryResponse {
  success: boolean;
  message: string;
  usageHistory: UsageHistoryEntry[];
}

interface MaterialUsageHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  materialId: string;
  materialName: string;
}

const MaterialUsageHistoryModal: React.FC<MaterialUsageHistoryModalProps> = ({
  isOpen,
  onClose,
  materialId,
  materialName
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const { data, loading, error } = useQuery<{ getMaterialUsageHistory: MaterialUsageHistoryResponse }>(
    GET_MATERIAL_USAGE_HISTORY,
    {
      variables: { materialId },
      skip: !isOpen || !materialId,
      fetchPolicy: 'cache-and-network'
    }
  );

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

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString || dateString === 'null' || dateString === 'undefined') return 'N/A';
    
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

  const getStatusBadge = (entry: UsageHistoryEntry) => {
    return (
      <span className={`inline-flex items-center ${isMobile ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-0.5 text-xs'} rounded-full font-medium bg-green-100 text-green-800`}>
        <CheckCircle className={`${isMobile ? 'w-3 h-3' : 'w-3 h-3'} mr-1`} />
        {entry.isActive ? 'Active' : 'Completed'}
      </span>
    );
  };

  const getReasonBadge = (reason: string, type: 'assignment' | 'unassignment') => {
    const colors = {
      'INITIAL_ASSIGNMENT': 'bg-blue-100 text-blue-800',
      'REASSIGNMENT': 'bg-orange-100 text-orange-800',
      'MANUAL_ASSIGNMENT': 'bg-purple-100 text-purple-800',
      'DRIVER_LEAVE': 'bg-red-100 text-red-800',
      'MATERIAL_DAMAGE': 'bg-red-100 text-red-800',
      'MANUAL_REMOVAL': 'bg-gray-100 text-gray-800',
      'SYSTEM_UPDATE': 'bg-yellow-100 text-yellow-800',
      'CUSTOM': 'bg-indigo-100 text-indigo-800'
    };

    return (
      <span className={`inline-flex items-center ${isMobile ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-xs'} rounded-full font-medium ${colors[reason as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>
        {reason.replace(/_/g, ' ').toLowerCase()}
      </span>
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-black bg-opacity-50"
      onClick={handleClose}
    >
      <div
        className={`fixed ${isMobile ? 'inset-x-4 top-16 bottom-6 w-auto max-h-[80vh]' : 'top-0 bottom-0 w-full max-w-xl'} bg-white shadow-xl rounded-lg flex flex-col transform transition-transform duration-300 ease-in-out ${
          isModalOpen ? (isMobile ? 'scale-100 opacity-100' : 'translate-x-0 opacity-100') : (isMobile ? 'scale-95 opacity-0' : 'translate-x-full opacity-0')
        } ${isMobile ? 'overflow-y-auto' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex justify-between items-center mb-6 pb-4 ${isMobile ? 'p-4' : 'p-6'}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <User className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-blue-600`} />
            </div>
            <div>
              <h2 className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold text-gray-800`}>
                Driver Usage History
              </h2>
              <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-500`}>
                {materialName}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={isMobile ? 18 : 20} />
          </button>
        </div>

        {/* Body */}
        <div className={`flex-grow ${isMobile ? 'px-4 pb-4' : 'px-6 pb-6'} overflow-y-auto`}>
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className={`animate-spin rounded-full ${isMobile ? 'h-6 w-6' : 'h-8 w-8'} border-b-2 border-blue-500`}></div>
              <span className={`${isMobile ? 'text-sm' : 'text-base'} ml-2 text-gray-600`}>Loading usage history...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <AlertCircle className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} text-red-500 mx-auto mb-2`} />
                <p className={`${isMobile ? 'text-sm' : 'text-base'} text-red-600`}>Error loading usage history</p>
                <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-500 mt-1`}>{error.message}</p>
              </div>
            </div>
          )}

          {data?.getMaterialUsageHistory?.usageHistory && (
            <>
              {data.getMaterialUsageHistory.usageHistory.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <User className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} text-gray-400 mx-auto mb-2`} />
                    <p className={`${isMobile ? 'text-sm' : 'text-base'} text-gray-600`}>No usage history found</p>
                    <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-500 mt-1`}>
                      This material has never been assigned to any driver
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {data.getMaterialUsageHistory.usageHistory.map((entry, index) => (
                    <div key={entry.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-md">
                      {/* Entry Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {/* Only show index number if not on mobile */}
                          {!isMobile && (
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-sm font-semibold text-blue-600">
                                {index + 1}
                              </span>
                            </div>
                          )}

                          {/* Driver Name and ID */}
                          <div>
                            <h3
                              className={`${
                                isMobile ? 'text-sm' : 'text-base'
                              } font-semibold text-gray-900`}
                            >
                              {entry.driverInfo.fullName}
                            </h3>
                            <p
                              className={`${
                                isMobile ? 'text-xs' : 'text-sm'
                              } text-gray-500`}
                            >
                              {entry.driverInfo.driverId}
                            </p>
                          </div>
                        </div>

                        {/* Right side badges */}
                        <div
                          className={`flex items-center gap-2 ${
                            isMobile ? 'flex-row flex-wrap justify-end' : ''
                          }`}
                        >
                          {getStatusBadge(entry)}
                          {getReasonBadge(entry.assignmentReason, 'assignment')}
                        </div>
                      </div>

                      {/* Driver Info */}
                      <div className={`${isMobile ? 'grid-cols-[1fr,1fr]' : 'grid-cols-2'} grid gap-4 mb-3`}>
                        <div>
                          <p className={`${isMobile ? 'text-xs' : 'text-xs'} text-gray-500 uppercase tracking-wide`}>Contact</p>
                          <p className={`${isMobile ? 'text-sm' : 'text-sm'} font-medium text-gray-900`}>{entry.driverInfo.contactNumber}</p>
                        </div>
                        <div>
                          <p className={`${isMobile ? 'text-xs' : 'text-xs'} text-gray-500 uppercase tracking-wide`}>Vehicle</p>
                          <p className={`${isMobile ? 'text-sm' : 'text-sm'} font-medium text-gray-900`}>{entry.driverInfo.vehiclePlateNumber}</p>
                        </div>
                      </div>

                      {/* Assignment Info */}
                      <div className={`${isMobile ? 'grid-cols-[1fr,1fr]' : 'grid-cols-2'} grid gap-4 mb-3`}>
                        <div className="space-y-2">
                          <div>
                            <p className={`${isMobile ? 'text-xs' : 'text-xs'} text-gray-500 uppercase tracking-wide`}>Assigned</p>
                            <p className={`${isMobile ? 'text-sm' : 'text-sm'} font-medium text-gray-900`}>{formatDate(entry.assignedAt)}</p>
                          </div>
                          {entry.assignedByAdmin && (
                            <div>
                              <p className={`${isMobile ? 'text-xs' : 'text-xs'} text-blue-600 font-medium`}>
                                Assigned by: {entry.assignedByAdmin.adminName}
                              </p>
                            </div>
                          )}
                          <div>
                            <p className={`${isMobile ? 'text-xs' : 'text-xs'} text-gray-500 uppercase tracking-wide`}>Mounted</p>
                            <p className={`${isMobile ? 'text-sm' : 'text-sm'} font-medium text-gray-900`}>{formatDate(entry.mountedAt)}</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <p className={`${isMobile ? 'text-xs' : 'text-xs'} text-gray-500 uppercase tracking-wide`}>Unassigned</p>
                            <p className={`${isMobile ? 'text-sm' : 'text-sm'} font-medium text-gray-900`}>{formatDate(entry.unassignedAt)}</p>
                          </div>
                          {entry.unassignmentReason && (
                            <div className="mt-1">
                              {getReasonBadge(entry.unassignmentReason, 'unassignment')}
                            </div>
                          )}
                          {entry.unassignedByAdmin && (
                            <div className="mt-1">
                              <p className={`${isMobile ? 'text-xs' : 'text-xs'} text-red-600 font-medium`}>
                                Unassigned by: {entry.unassignedByAdmin.adminName}
                              </p>
                            </div>
                          )}
                          <div>
                            <p className={`${isMobile ? 'text-xs' : 'text-xs'} text-gray-500 uppercase tracking-wide`}>Dismounted</p>
                            <p className={`${isMobile ? 'text-sm' : 'text-sm'} font-medium text-gray-900`}>{formatDate(entry.dismountedAt)}</p>
                          </div>
                        </div>
                      </div>

                      {/* Usage Duration */}
                      {entry.usageDuration && (
                        <div className="mb-3">
                          <p className={`${isMobile ? 'text-xs' : 'text-xs'} font-medium text-gray-500 uppercase tracking-wide`}>Usage Duration</p>
                          <p className={`${isMobile ? 'text-sm' : 'text-sm'} text-gray-900`}>
                            {entry.usageDuration} day{entry.usageDuration !== 1 ? 's' : ''}
                          </p>
                        </div>
                      )}

                      {/* Notes */}
                      {entry.notes && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className={`${isMobile ? 'text-xs' : 'text-xs'} font-medium text-gray-500 uppercase tracking-wide mb-1`}>Notes</p>
                          <p className={`${isMobile ? 'text-sm' : 'text-sm'} text-gray-700 bg-gray-50 p-2 rounded`}>{entry.notes}</p>
                        </div>
                      )}

                      {/* Custom Dismount Reason */}
                      {entry.customDismountReason && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className={`${isMobile ? 'text-xs' : 'text-xs'} font-medium text-gray-500 uppercase tracking-wide mb-1`}>Dismount Reason</p>
                          <p className={`${isMobile ? 'text-sm' : 'text-sm'} text-gray-700 bg-orange-50 p-2 rounded border-l-4 border-orange-200`}>{entry.customDismountReason}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MaterialUsageHistoryModal;