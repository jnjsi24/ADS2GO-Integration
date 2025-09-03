import React, { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { X, Eye, User } from 'lucide-react';

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
      profilePicture
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
  profilePicture?: string;
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

// Helper to get full image URL
const getImageUrl = (imagePath: string | undefined | null) => {
  if (!imagePath) return null;
  // If it's already a full URL, return as is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  // If it starts with /uploads, prepend your server URL
  if (imagePath.startsWith('/uploads')) {
    // Replace with your actual server URL
    return `${process.env.REACT_APP_SERVER_URL || 'http://localhost:4000'}${imagePath}`;
  }
  return imagePath;
};

// Profile Picture Component
const ProfilePicture: React.FC<{ 
  driver: Driver; 
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ driver, size = 'sm', className = '' }) => {
  const [imageError, setImageError] = useState(false);
  const imageUrl = getImageUrl(driver.profilePicture);
  
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-24 h-24 text-lg'
  };

  if (imageUrl && !imageError) {
    return (
      <img
        src={imageUrl}
        alt={`${driver.firstName} ${driver.lastName}`}
        className={`${sizeClasses[size]} rounded-full object-cover ${className}`}
        onError={() => setImageError(true)}
      />
    );
  }

  // Fallback to initials
  return (
    <div className={`${sizeClasses[size]} flex items-center justify-center font-semibold text-white rounded-full bg-[#FF9D3D] ${className}`}>
      {getInitials(driver.firstName, driver.lastName)}
    </div>
  );
};

// Document Image Component with Error Handling
const DocumentImage: React.FC<{
  src: string | undefined | null;
  alt: string;
  title: string;
  className?: string;
}> = ({ src, alt, title, className = '' }) => {
  const [imageError, setImageError] = useState(false);
  const imageUrl = getImageUrl(src);

  if (!imageUrl || imageError) {
    return (
      <div className={`${className} bg-gray-200 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center`}>
        <User size={32} className="text-gray-400 mb-2" />
        <p className="text-sm text-gray-500 text-center">No {title} available</p>
      </div>
    );
  }

  return (
    <div className="relative group">
      <p className="font-medium mb-2">{title}</p>
      <img 
        src={imageUrl}
        alt={alt}
        className={`${className} border rounded-lg cursor-pointer hover:opacity-90 transition-opacity`}
        onError={() => setImageError(true)}
        onClick={() => {
          // Open image in a new tab for better viewing
          window.open(imageUrl, '_blank');
        }}
      />
      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-lg flex items-center justify-center">
        <Eye className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={24} />
      </div>
    </div>
  );
};

const ManageRiders: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRiders, setSelectedRiders] = useState<string[]>([]);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedDriverDetails, setSelectedDriverDetails] = useState<Driver | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [driverToReject, setDriverToReject] = useState<string | null>(null);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);

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
    return matchesSearch;
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

  // Approve with selected materials from popup
  const handleConfirmApproveWithMaterials = async () => {
    if (!selectedDriverDetails) return;
    try {
      const override = selectedMaterials.length > 0 ? selectedMaterials : null;
      const result = await approveDriver({
        variables: { driverId: selectedDriverDetails.driverId, materialTypeOverride: override }
      });

      if (result.data?.approveDriver?.success) {
        alert(result.data.approveDriver.message);
        setShowMaterialModal(false);
        setShowDetailsModal(false);
        setSelectedMaterials([]);
        refetch();
      } else {
        alert(result.data?.approveDriver?.message || 'Failed to approve driver');
      }
    } catch (error: any) {
      console.error('Error approving driver with materials:', error);
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

      {/* Search */}
      <div className="flex justify-start items-center mb-4">
        <input
          type="text"
          className="text-xs text-black rounded-xl pl-5 py-3 w-80 shadow-md border border-gray-400 focus:outline-none bg-white"
          placeholder="Search by name, email, contact, or driver ID..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
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
                    <ProfilePicture driver={r} className="mr-2" />
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
                  
                  {r.accountStatus === 'PENDING' && (
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
                  )}
                </div>
              </div>
              
            </div>
          ))}
        </div>
      )}

      {/* Material Selection Modal */}
      {showMaterialModal && selectedDriverDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full m-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Select Material Type(s)</h2>
              <button
                onClick={() => { setShowMaterialModal(false); setSelectedMaterials([]); }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-3">Choose one or more materials to approve for this driver. If you leave it empty, the current server default will be used.</p>

            <div className="grid grid-cols-1 gap-2 mb-4">
              {['CAR_TOP', 'CAR_BODY', 'TRICYCLE_REAR', 'BICYCLE_FRAME', 'MOTORCYCLE_SIDE', 'OTHER'].map((m) => (
                <label key={m} className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedMaterials.includes(m)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSelectedMaterials(prev => checked ? [...prev, m] : prev.filter(x => x !== m));
                    }}
                  />
                  <span>{m.replace('_', ' ')}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                onClick={() => { setShowMaterialModal(false); setSelectedMaterials([]); }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                onClick={handleConfirmApproveWithMaterials}
              >
                Confirm Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedDriverDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto m-4">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-4">
                <ProfilePicture driver={selectedDriverDetails} size="lg" />
                <h2 className="text-2xl font-bold">Driver Details</h2>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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
              <h3 className="text-lg font-semibold mb-4">Documents & Photos</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <DocumentImage
                  src={selectedDriverDetails.licensePictureURL}
                  alt="Driver License"
                  title="Driver License"
                  className="w-full h-40 object-cover"
                />
                <DocumentImage
                  src={selectedDriverDetails.orCrPictureURL}
                  alt="OR/CR Document"
                  title="OR/CR Document"
                  className="w-full h-40 object-cover"
                />
                <DocumentImage
                  src={selectedDriverDetails.vehiclePhotoURL}
                  alt="Vehicle Photo"
                  title="Vehicle Photo"
                  className="w-full h-40 object-cover"
                />
                <DocumentImage
                  src={selectedDriverDetails.profilePicture}
                  alt="Profile Picture"
                  title="Profile Picture"
                  className="w-full h-40 object-cover"
                />
              </div>
            </div>

            {/* Action buttons for pending drivers */}
            {selectedDriverDetails.accountStatus === 'PENDING' && (
              <div className="flex gap-4 mt-6 pt-4 border-t">
                <button
                  className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600"
                  onClick={() => {
                    setSelectedMaterials([]);
                    setShowMaterialModal(true);
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
              </div>
            )}

            {/* Footer actions for non-pending drivers */}
            {selectedDriverDetails.accountStatus !== 'PENDING' && (
              <div className="flex gap-3 justify-end mt-6 pt-4 border-t">
                <button
                  className="px-4 py-2 text-red-600 border border-red-600 rounded hover:bg-red-50"
                  onClick={() => {
                    setShowDetailsModal(false);
                    handleDelete(selectedDriverDetails.driverId);
                  }}
                >
                  Delete Driver
                </button>
                <button
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                  onClick={() => setShowDetailsModal(false)}
                >
                  Close
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