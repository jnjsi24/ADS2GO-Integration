import React, { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { ChevronDown, Edit, X, Eye } from 'lucide-react';
import { TrashIcon } from '@heroicons/react/24/outline';

// === GraphQL ===
const GET_ALL_DRIVERS = gql`
  query GetAllDrivers {
    getAllDrivers {
      id
      driverId
      firstName
      middleName
      lastName
      email
      contactNumber
      vehicleType
      vehicleModel
      vehiclePlateNumber
      accountStatus
      reviewStatus
      installedMaterialType
      address
      licenseNumber
      licensePictureURL
      orCrPictureURL
      vehiclePhotoURL
      dateJoined
      approvalDate
      rejectedReason
      material {
        materialId
        materialType
        category
        description
      }
    }
  }
`;

const APPROVE_DRIVER = gql`
  mutation ApproveDriver($driverId: ID!, $materialTypeOverride: [MaterialTypeEnum!]) {
    approveDriver(driverId: $driverId, materialTypeOverride: $materialTypeOverride) {
      success
      message
      driver {
        id
        driverId
        accountStatus
        reviewStatus
        installedMaterialType
      }
    }
  }
`;

const REJECT_DRIVER = gql`
  mutation RejectDriver($driverId: ID!, $reason: String!) {
    rejectDriver(driverId: $driverId, reason: $reason) {
      success
      message
      driver {
        id
        driverId
        accountStatus
        reviewStatus
        rejectedReason
      }
    }
  }
`;

const DELETE_DRIVER = gql`
  mutation DeleteDriver($driverId: ID!) {
    deleteDriver(driverId: $driverId) {
      success
      message
    }
  }
`;

// === Types ===
interface Driver {
  id: string;
  driverId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  contactNumber: string;
  vehicleType: string;
  vehicleModel: string;
  vehiclePlateNumber: string;
  accountStatus: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED' | 'RESUBMITTED';
  reviewStatus: string;
  installedMaterialType?: string;
  address?: string;
  licenseNumber?: string;
  licensePictureURL?: string;
  orCrPictureURL?: string;
  vehiclePhotoURL?: string;
  dateJoined: string;
  approvalDate?: string;
  rejectedReason?: string;
  material?: {
    materialId: string;
    materialType: string;
    category: string;
    description?: string;
  };
}

// === Helper ===
const getInitials = (firstName: string, lastName: string) =>
  `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();

const ManageRiders: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ACTIVE' | 'PENDING'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedRiders, setSelectedRiders] = useState<string[]>([]);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedDriverDetails, setSelectedDriverDetails] = useState<Driver | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [driverToReject, setDriverToReject] = useState<string | null>(null);

  // Apollo hooks
  const { data, loading, error, refetch } = useQuery(GET_ALL_DRIVERS, {
    context: {
      headers: {
        authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    },
  });

  const [approveDriver] = useMutation(APPROVE_DRIVER, {
    context: {
      headers: {
        authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    },
  });

  const [rejectDriver] = useMutation(REJECT_DRIVER, {
    context: {
      headers: {
        authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    },
  });

  const [deleteDriver] = useMutation(DELETE_DRIVER, {
    context: {
      headers: {
        authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    },
  });

  const riders: Driver[] = data?.getAllDrivers || [];

  // Filter
  const filteredRiders = riders.filter((r: Driver) => {
    const fullName = `${r.firstName} ${r.middleName || ''} ${r.lastName}`.toLowerCase();
    const matchesSearch = fullName.includes(searchTerm.toLowerCase()) || 
                         r.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         r.contactNumber.includes(searchTerm) ||
                         r.driverId.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || r.accountStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Actions
  const handleApprove = async (driverId: string) => {
    try {
      const result = await approveDriver({
        variables: { driverId, materialTypeOverride: null }
      });
      
      if (result.data?.approveDriver?.success) {
        alert(result.data.approveDriver.message);
        refetch();
      } else {
        alert(result.data?.approveDriver?.message || 'Failed to approve driver');
      }
    } catch (error: any) {
      console.error('Error approving driver:', error);
      alert(error.message || 'Failed to approve driver');
    }
  };

  const handleReject = (driverId: string) => {
    setDriverToReject(driverId);
    setShowRejectModal(true);
  };

  const submitReject = async () => {
    if (!driverToReject || !rejectReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    try {
      const result = await rejectDriver({
        variables: { 
          driverId: driverToReject, 
          reason: rejectReason.trim() 
        }
      });

      if (result.data?.rejectDriver?.success) {
        alert(result.data.rejectDriver.message);
        refetch();
        setShowRejectModal(false);
        setRejectReason('');
        setDriverToReject(null);
      } else {
        alert(result.data?.rejectDriver?.message || 'Failed to reject driver');
      }
    } catch (error: any) {
      console.error('Error rejecting driver:', error);
      // More detailed error handling
      if (error.graphQLErrors && error.graphQLErrors.length > 0) {
        alert(`GraphQL Error: ${error.graphQLErrors[0].message}`);
      } else if (error.networkError) {
        alert(`Network Error: ${error.networkError.message}`);
      } else {
        alert(error.message || 'Failed to reject driver');
      }
    }
  };

  const handleDelete = async (driverId: string) => {
    if (!window.confirm('Are you sure you want to delete this driver? This action cannot be undone.')) {
      return;
    }

    try {
      const result = await deleteDriver({ 
        variables: { driverId } 
      });

      if (result.data?.deleteDriver?.success) {
        alert(result.data.deleteDriver.message);
        refetch();
      } else {
        alert(result.data?.deleteDriver?.message || 'Failed to delete driver');
      }
    } catch (error: any) {
      console.error('Error deleting driver:', error);
      alert(error.message || 'Failed to delete driver');
    }
  };

  const handleViewDetails = (driver: Driver) => {
    setSelectedDriverDetails(driver);
    setShowDetailsModal(true);
  };

  // Selection
  const handleSelect = (id: string) => {
    setSelectedRiders(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const allIds = filteredRiders.map((r: Driver) => r.driverId);
    setSelectedRiders(prev => prev.length === allIds.length ? [] : allIds);
  };

  const isAllSelected =
    selectedRiders.length === filteredRiders.length && filteredRiders.length > 0;

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-gray-100 pl-64 pr-5 p-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Drivers List</h1>
      </div>

      {/* Search + Filter */}
      <div className="flex justify-between items-center mb-4">
        <input
          type="text"
          className="text-xs text-black rounded-xl pl-5 py-3 w-80 shadow-md border border-gray-400 focus:outline-none bg-white"
          placeholder="Search by name, email, contact, or driver ID..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <select
          className="text-sm text-black rounded-xl pl-5 py-3 pr-8 w-48 shadow-md border border-gray-400 focus:outline-none bg-white"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as 'all' | 'ACTIVE' | 'PENDING')}
        >
          <option value="all">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="PENDING">Pending</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-10 text-gray-500">Loading drivers...</div>
      ) : error ? (
        <div className="text-center py-10 text-red-500">Error: {error.message}</div>
      ) : filteredRiders.length === 0 ? (
        <div className="text-center py-10 text-gray-500">No drivers found</div>
      ) : (
        <div className="rounded-md shadow-md mb-4 overflow-hidden">
          <div className="grid grid-cols-12 bg-[#3674B5] px-4 py-2 text-sm font-semibold text-white">
            <div className="flex items-center gap-10 col-span-3">
              <input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} />
              <span>Name</span>
            </div>
            <div className="col-span-3">Email</div>
            <div className="col-span-2">Contact</div>
            <div className="col-span-2">Vehicle</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-1 text-center">Action</div>
          </div>

          {filteredRiders.map((r: Driver) => (
            <div key={r.driverId} className="bg-white border-t border-gray-300">
              <div className="grid grid-cols-12 items-center px-4 py-3 text-sm hover:bg-gray-100 transition-colors">
                <div className="col-span-3 gap-7 flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedRiders.includes(r.driverId)}
                    onChange={() => handleSelect(r.driverId)}
                  />
                  <div className="flex items-center">
                    <div className="flex items-center justify-center w-8 h-8 mr-2 text-xs font-semibold text-white rounded-full bg-[#FF9D3D]">
                      {getInitials(r.firstName, r.lastName)}
                    </div>
                    <span className="truncate">
                      {`${r.firstName} ${r.middleName || ''} ${r.lastName}`}
                    </span>
                  </div>
                </div>
                <div className="col-span-3 truncate">{r.email}</div>
                <div className="col-span-2 truncate">{r.contactNumber}</div>
                <div className="col-span-2 truncate">{r.vehicleType}</div>
                <div className="col-span-1">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    r.accountStatus === 'ACTIVE'
                      ? 'bg-green-200 text-green-800'
                      : r.accountStatus === 'PENDING'
                      ? 'bg-yellow-200 text-yellow-800'
                      : r.accountStatus === 'REJECTED'
                      ? 'bg-red-200 text-red-800'
                      : 'bg-gray-200 text-gray-800'
                  }`}>
                    {r.accountStatus}
                  </span>
                </div>
                <div className="col-span-1 flex items-center justify-center gap-1">
                  <button
                    className="bg-blue-500 text-white text-xs px-2 py-1 rounded hover:bg-blue-600"
                    onClick={() => handleViewDetails(r)}
                    title="View Details"
                  >
                    <Eye size={12} />
                  </button>
                  
                  {r.accountStatus === 'PENDING' ? (
                    <>
                      <button
                        className="bg-green-500 text-white text-xs px-2 py-1 rounded hover:bg-green-600"
                        onClick={() => handleApprove(r.driverId)}
                        title="Approve"
                      >
                        ✓
                      </button>
                      <button
                        className="bg-red-500 text-white text-xs px-2 py-1 rounded hover:bg-red-600"
                        onClick={() => handleReject(r.driverId)}
                        title="Reject"
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setExpandedId(expandedId === r.driverId ? null : r.driverId)}
                      className="text-gray-500 hover:text-gray-700"
                      title="Toggle details"
                    >
                      <ChevronDown size={16} className={`transition-transform ${expandedId === r.driverId ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                  
                  <button
                    className="bg-red-600 text-white text-xs px-2 py-1 rounded hover:bg-red-700"
                    onClick={() => handleDelete(r.driverId)}
                    title="Delete"
                  >
                    <TrashIcon className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {expandedId === r.driverId && (
                <div className="bg-gray-50 p-6">
                  <h3 className="text-lg font-bold mb-4">{r.firstName} {r.lastName}</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p><strong>Email:</strong> {r.email}</p>
                      <p><strong>Contact:</strong> {r.contactNumber}</p>
                      <p><strong>Address:</strong> {r.address || 'N/A'}</p>
                      <p><strong>License Number:</strong> {r.licenseNumber || 'N/A'}</p>
                      <p><strong>Date Joined:</strong> {formatDate(r.dateJoined)}</p>
                      {r.approvalDate && <p><strong>Approval Date:</strong> {formatDate(r.approvalDate)}</p>}
                    </div>
                    <div>
                      <p><strong>Vehicle:</strong> {r.vehicleType} {r.vehicleModel}</p>
                      <p><strong>Plate Number:</strong> {r.vehiclePlateNumber}</p>
                      <p><strong>Material Type:</strong> {r.installedMaterialType || 'N/A'}</p>
                      {r.material && (
                        <>
                          <p><strong>Material ID:</strong> {r.material.materialId}</p>
                          <p><strong>Material Category:</strong> {r.material.category}</p>
                        </>
                      )}
                      {r.rejectedReason && <p><strong>Rejection Reason:</strong> {r.rejectedReason}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button
                      className="p-1 text-gray-500 rounded-full hover:bg-gray-200"
                      onClick={() => setExpandedId(null)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedDriverDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Driver Details</h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">Personal Information</h3>
                <div className="space-y-2">
                  <p><strong>Driver ID:</strong> {selectedDriverDetails.driverId}</p>
                  <p><strong>Full Name:</strong> {`${selectedDriverDetails.firstName} ${selectedDriverDetails.middleName || ''} ${selectedDriverDetails.lastName}`}</p>
                  <p><strong>Email:</strong> {selectedDriverDetails.email}</p>
                  <p><strong>Contact:</strong> {selectedDriverDetails.contactNumber}</p>
                  <p><strong>Address:</strong> {selectedDriverDetails.address || 'N/A'}</p>
                  <p><strong>License Number:</strong> {selectedDriverDetails.licenseNumber || 'N/A'}</p>
                  <p><strong>Account Status:</strong> 
                    <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${
                      selectedDriverDetails.accountStatus === 'ACTIVE'
                        ? 'bg-green-200 text-green-800'
                        : selectedDriverDetails.accountStatus === 'PENDING'
                        ? 'bg-yellow-200 text-yellow-800'
                        : selectedDriverDetails.accountStatus === 'REJECTED'
                        ? 'bg-red-200 text-red-800'
                        : 'bg-gray-200 text-gray-800'
                    }`}>
                      {selectedDriverDetails.accountStatus}
                    </span>
                  </p>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-3">Vehicle & Material Information</h3>
                <div className="space-y-2">
                  <p><strong>Vehicle Type:</strong> {selectedDriverDetails.vehicleType}</p>
                  <p><strong>Vehicle Model:</strong> {selectedDriverDetails.vehicleModel}</p>
                  <p><strong>Plate Number:</strong> {selectedDriverDetails.vehiclePlateNumber}</p>
                  <p><strong>Material Type:</strong> {selectedDriverDetails.installedMaterialType || 'N/A'}</p>
                  {selectedDriverDetails.material && (
                    <>
                      <p><strong>Material ID:</strong> {selectedDriverDetails.material.materialId}</p>
                      <p><strong>Material Category:</strong> {selectedDriverDetails.material.category}</p>
                      {selectedDriverDetails.material.description && (
                        <p><strong>Material Description:</strong> {selectedDriverDetails.material.description}</p>
                      )}
                    </>
                  )}
                  <p><strong>Date Joined:</strong> {formatDate(selectedDriverDetails.dateJoined)}</p>
                  {selectedDriverDetails.approvalDate && (
                    <p><strong>Approval Date:</strong> {formatDate(selectedDriverDetails.approvalDate)}</p>
                  )}
                  {selectedDriverDetails.rejectedReason && (
                    <p><strong>Rejection Reason:</strong> {selectedDriverDetails.rejectedReason}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Document Images */}
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3">Documents</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {selectedDriverDetails.licensePictureURL && (
                  <div>
                    <p className="font-medium mb-2">License Picture</p>
                    <img 
                      src={selectedDriverDetails.licensePictureURL} 
                      alt="License"
                      className="w-full h-40 object-cover border rounded"
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder-document.png';
                      }}
                    />
                  </div>
                )}
                {selectedDriverDetails.orCrPictureURL && (
                  <div>
                    <p className="font-medium mb-2">OR/CR Picture</p>
                    <img 
                      src={selectedDriverDetails.orCrPictureURL} 
                      alt="OR/CR"
                      className="w-full h-40 object-cover border rounded"
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder-document.png';
                      }}
                    />
                  </div>
                )}
                {selectedDriverDetails.vehiclePhotoURL && (
                  <div>
                    <p className="font-medium mb-2">Vehicle Photo</p>
                    <img 
                      src={selectedDriverDetails.vehiclePhotoURL} 
                      alt="Vehicle"
                      className="w-full h-40 object-cover border rounded"
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder-vehicle.png';
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons for pending drivers */}
            {selectedDriverDetails.accountStatus === 'PENDING' && (
              <div className="flex gap-4 mt-6 pt-4 border-t">
                <button
                  className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600"
                  onClick={() => {
                    handleApprove(selectedDriverDetails.driverId);
                    setShowDetailsModal(false);
                  }}
                >
                  Approve Driver
                </button>
                <button
                  className="bg-red-500 text-white px-6 py-2 rounded hover:bg-red-600"
                  onClick={() => {
                    setShowDetailsModal(false);
                    handleReject(selectedDriverDetails.driverId);
                  }}
                >
                  Reject Driver
                </button>
                <button
                  className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700"
                  onClick={() => {
                    setShowDetailsModal(false);
                    handleDelete(selectedDriverDetails.driverId);
                  }}
                >
                  Delete Driver
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full m-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Reject Driver</h2>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                  setDriverToReject(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for rejection (required):
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
                placeholder="Please provide a reason for rejecting this driver application..."
              />
            </div>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                  setDriverToReject(null);
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={submitReject}
                disabled={!rejectReason.trim()}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400"
              >
                Reject Driver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageRiders;  