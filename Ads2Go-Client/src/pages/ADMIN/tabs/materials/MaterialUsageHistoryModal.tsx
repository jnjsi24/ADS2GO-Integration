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

  const { data, loading, error } = useQuery<{ getMaterialUsageHistory: MaterialUsageHistoryResponse }>(
    GET_MATERIAL_USAGE_HISTORY,
    {
      variables: { materialId },
      skip: !isOpen || !materialId,
      fetchPolicy: 'cache-and-network'
    }
  );

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
    if (entry.isActive) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Active
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <Clock className="w-3 h-3 mr-1" />
          Completed
        </span>
      );
    }
  };

  const getReasonBadge = (reason: string, type: 'assignment' | 'unassignment') => {
    const colors = {
      'INITIAL_ASSIGNMENT': 'bg-blue-100 text-blue-800',
      'REASSIGNMENT': 'bg-orange-100 text-orange-800',
      'MANUAL_ASSIGNMENT': 'bg-purple-100 text-purple-800',
      'DRIVER_LEAVE': 'bg-red-100 text-red-800',
      'MATERIAL_DAMAGE': 'bg-red-100 text-red-800',
      'MANUAL_REMOVAL': 'bg-gray-100 text-gray-800',
      'SYSTEM_UPDATE': 'bg-yellow-100 text-yellow-800'
    };

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colors[reason as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>
        {reason.replace(/_/g, ' ').toLowerCase()}
      </span>
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
      onClick={handleClose}
    >
      <div
        className={`fixed top-2 bottom-2 right-2 max-w-2xl w-full bg-white shadow-xl rounded-lg flex flex-col transform transition-transform duration-300 ease-in-out ${
          isModalOpen ? "translate-x-0" : "translate-x-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6 border-b pb-4 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">
                Driver Usage History
              </h2>
              <p className="text-sm text-gray-500">
                {materialName}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-grow overflow-y-auto px-6 pb-6">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-2 text-gray-600">Loading usage history...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-2" />
                <p className="text-red-600">Error loading usage history</p>
                <p className="text-sm text-gray-500 mt-1">{error.message}</p>
              </div>
            </div>
          )}

          {data?.getMaterialUsageHistory?.usageHistory && (
            <>
              {data.getMaterialUsageHistory.usageHistory.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <User className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600">No usage history found</p>
                    <p className="text-sm text-gray-500 mt-1">
                      This material has never been assigned to any driver
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {data.getMaterialUsageHistory.usageHistory.map((entry, index) => (
                    <div key={entry.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                      {/* Entry Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-semibold text-blue-600">
                              {index + 1}
                            </span>
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {entry.driverInfo.fullName}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {entry.driverInfo.driverId}
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(entry)}
                      </div>

                      {/* Driver Info */}
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Contact</p>
                          <p className="text-sm text-gray-900">{entry.driverInfo.contactNumber}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Vehicle</p>
                          <p className="text-sm text-gray-900">{entry.driverInfo.vehiclePlateNumber}</p>
                        </div>
                      </div>

                      {/* Assignment Info */}
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Assigned</p>
                          <p className="text-sm text-gray-900">{formatDate(entry.assignedAt)}</p>
                          {getReasonBadge(entry.assignmentReason, 'assignment')}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Unassigned</p>
                          <p className="text-sm text-gray-900">{formatDate(entry.unassignedAt)}</p>
                          {entry.unassignmentReason && getReasonBadge(entry.unassignmentReason, 'unassignment')}
                        </div>
                      </div>

                      {/* Usage Duration */}
                      {entry.usageDuration && (
                        <div className="mb-3">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Usage Duration</p>
                          <p className="text-sm text-gray-900">
                            {entry.usageDuration} day{entry.usageDuration !== 1 ? 's' : ''}
                          </p>
                        </div>
                      )}

                      {/* Mount/Dismount Dates */}
                      {(entry.mountedAt || entry.dismountedAt) && (
                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Mounted</p>
                            <p className="text-sm text-gray-900">{formatDate(entry.mountedAt)}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Dismounted</p>
                            <p className="text-sm text-gray-900">{formatDate(entry.dismountedAt)}</p>
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      {entry.notes && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                          <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">{entry.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t mt-auto">
          <div className="flex justify-end">
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaterialUsageHistoryModal;
