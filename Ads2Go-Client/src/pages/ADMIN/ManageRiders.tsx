import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { 
  X, 
  Trash,
  Eye, 
  User, 
  IdCard, 
  CalendarClock, 
  Mail, 
  CalendarCheck2, 
  Phone, 
  MapPin, 
  } from 'lucide-react';
import { GET_ALL_DRIVERS } from '../../graphql/admin/queries/manageRiders';
import { APPROVE_DRIVER, REJECT_DRIVER, DELETE_DRIVER } from '../../graphql/admin/mutations/manageRiders';

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
  setShowImageModal: (show: boolean) => void;
  setModalImageSrc: (src: string) => void;
}> = ({ src, alt, title, className = '', setShowImageModal, setModalImageSrc }) => {
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
      />
      <button 
        className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-lg flex items-center justify-center"
        onClick={() => {
          setModalImageSrc(imageUrl); 
          setShowImageModal(true);
        }}
      >
        <Eye className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={24} />
      </button>
    </div>
  );
};

const ManageRiders: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ACTIVE' | 'PENDING' | 'REJECTED'>('all');
  const [selectedRiders, setSelectedRiders] = useState<string[]>([]);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDriverDetails, setSelectedDriverDetails] = useState<Driver | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectionNotification, setShowRejectionNotification] = useState(true);
  const [driverToReject, setDriverToReject] = useState<string | null>(null);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImageSrc, setModalImageSrc] = useState('');

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
    setCurrentImageIndex(0);
    setShowDetailsModal(true);
    // Trigger animation after modal is rendered
    setTimeout(() => {
      setIsModalOpen(true);
    }, 10);
    if (driver.accountStatus === 'REJECTED') {
    setShowRejectionNotification(true);
  }
  };
  
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setShowDetailsModal(false);
      setSelectedDriverDetails(null);
    }, 300); // Matches the transition duration
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
      {/* Header with Title and Filters */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Riders Management</h1>
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Search by name or Rider ID..."
            className="text-xs text-black rounded-xl pl-5 py-3 w-80 shadow-md focus:outline-none bg-white"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          {/* Custom Dropdown with SVG */}
          <div className="relative w-40">
            <select
              className="appearance-none w-full text-xs text-black rounded-xl pl-5 pr-10 py-3 shadow-md focus:outline-none bg-white"
              value={statusFilter}
              onChange={e =>
                setStatusFilter(e.target.value as 'all' | 'ACTIVE' | 'PENDING' | 'REJECTED')
              }
            >
              <option value="all">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="ACTIVE">Active</option>
              <option value="REJECTED">Rejected</option>
            </select>
            {/* SVG Arrow */}
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
              <svg
                className="w-4 h-4 text-gray-500"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-10 text-gray-500">Loading drivers...</div>
      ) : error ? (
        <div className="text-center py-10 text-red-500">Error: {error.message}</div>
      ) : filteredRiders.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          {searchTerm || statusFilter !== 'all' ? 'No riders match your search criteria' : 'No riders found'}
        </div>
      ) : (
        <div className="rounded-md mb-4 overflow-hidden">
          <div className="grid grid-cols-12 gap-1 px-4 py-2 text-sm font-semibold text-gray-600">
            <div className="flex items-center gap-2 ml-1 col-span-3">
              <input
                type="checkbox"
                className="form-checkbox"
                onChange={(e) => {}}
                onClick={handleSelectAll}
                checked={isAllSelected}
              />
              <span className="cursor-pointer ml-2" onClick={handleSelectAll}>Name</span>
              <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>
            </div>
            <div className="col-span-3 ml-16">Email</div>
            <div className="col-span-2">Contact</div>
            <div className="col-span-2 mr-16">Vehicle</div>
            <div className="col-span-1 flex items-center gap-1">
              <span>Status</span>
              <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>
            </div>
            <div className="col-span-1 text-center">Action</div>
          </div>

          {filteredRiders.map((r: Driver) => (
            <div key={r.driverId} className="bg-white mb-3 rounded-lg shadow-md">
              <div
                className="grid grid-cols-12 items-center px-5 py-4 text-sm hover:bg-gray-100 transition-colors cursor-pointer"
                onClick={() => handleViewDetails(r)}
              >
                <div className="col-span-3 gap-7 flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedRiders.includes(r.driverId)}
                    onChange={(e) => {
                      e.stopPropagation(); // Prevents row click when checkbox is clicked
                      handleSelect(r.driverId);
                    }}
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
                <div className="col-span-1 flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                  {r.accountStatus === 'PENDING' && (
                    <>
                      <button
                        className="border border-green-500 text-green-500 text-xs px-2 py-1 rounded hover:bg-green-600 hover:text-white"
                        onClick={() => handleApprove(r.driverId)}
                        title="Approve"
                      >
                        Accept
                      </button>
                      <button
                        className="border border-red-500 text-red-500 text-xs px-2 py-1 rounded hover:bg-red-600 hover:text-white"
                        onClick={() => handleReject(r.driverId)}
                        title="Reject"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  <button
                    className="text-red-500 text-md hover:text-red-700"
                    onClick={() => handleDelete(r.driverId)}
                    title="Delete Driver"
                  >
                    <Trash size={16} />
                  </button>
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

      {/* Details Modal (Slide-in from right) */}
      {showDetailsModal && selectedDriverDetails && (
        <div
          className="fixed inset-0 z-50 overflow-hidden"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }} // Custom backdrop
          onClick={handleCloseModal}
        >
          <div
            className={`fixed top-2 bottom-2 right-2 max-w-xl w-full bg-white shadow-xl rounded-lg flex flex-col transform transition-transform duration-300 ease-in-out 
              ${isModalOpen ? 'translate-x-0' : 'translate-x-full'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Section (Fixed) */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between text-black">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <ProfilePicture driver={selectedDriverDetails} size="lg" className="ring-2 ring-white" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-bold">
                        {`${selectedDriverDetails.firstName} ${selectedDriverDetails.middleName || ""} ${selectedDriverDetails.lastName}`}
                      </h2>
                      {/* Status Badge */}
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          selectedDriverDetails.accountStatus === "ACTIVE"
                            ? "bg-green-200 text-green-800"
                            : selectedDriverDetails.accountStatus === "PENDING"
                            ? "bg-yellow-200 text-yellow-800"
                            : selectedDriverDetails.accountStatus === "REJECTED"
                            ? "bg-red-200 text-red-800"
                            : "bg-gray-200 text-gray-800"
                        }`}
                      >
                        {selectedDriverDetails.accountStatus}
                      </span>
                    </div>
                    <span className="text-sm font-light opacity-80">{selectedDriverDetails.driverId}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Content Section (Scrollable) */}
            <div className="p-6 overflow-y-auto flex-1">
              {/* Vehicle & Material Information */}
              <div className="mb-6">
                <h3 className="text-xl text-center font-bold text-gray-800 mb-4">Vehicle & Material Information</h3>
                <div className="overflow-x-auto rounded-lg">
                  <table className="w-96 mx-auto divide-y divide-gray-200">
                    <tbody className="bg-white divide-y divide-gray-200">
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500">Vehicle Type</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-bold">{selectedDriverDetails.vehicleType}</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500">Vehicle Model</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-bold">{selectedDriverDetails.vehicleModel}</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500">Plate Number</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-bold">{selectedDriverDetails.vehiclePlateNumber}</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500">Material Type</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-bold">{selectedDriverDetails.installedMaterialType || 'N/A'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Rider Details */}
              <div className="mb-6">
                <h3 className="text-xl font-bold text-center text-gray-800 mb-4">Rider Details:</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700">
                  <div className="flex items-center space-x-3">
                    <IdCard size={20} className="text-gray-500" />
                    <p>{selectedDriverDetails.licenseNumber}</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Mail size={20} className="text-gray-500" />
                    <p>{selectedDriverDetails.email}</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CalendarClock size={20} className="text-gray-500" />
                    <p>{formatDate(selectedDriverDetails.dateJoined)}</p>
                  </div>

                  <div className="flex items-center space-x-3">
                    <MapPin size={20} className="text-gray-500" />
                    <p>{selectedDriverDetails.address || 'N/A'}</p>
                  </div>

                  <div className="flex items-center space-x-2">
                    {selectedDriverDetails.approvalDate && (
                      <>
                        <CalendarCheck2 size={20} className="text-gray-500" />
                        <span className="text-gray-700">
                          {formatDate(selectedDriverDetails.approvalDate)}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center space-x-3">
                    <Phone size={20} className="text-gray-500" />
                    <p>{selectedDriverDetails.contactNumber}</p>
                  </div>
                </div>
              </div>

              {/* Documents & Photos Carousel */}
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">Documents & Photos</h3>
                {selectedDriverDetails && (() => {
                  const documents = [
                    { src: selectedDriverDetails.profilePicture, title: 'Profile Picture' },
                    { src: selectedDriverDetails.licensePictureURL, title: 'Driver License' },
                    { src: selectedDriverDetails.orCrPictureURL, title: 'OR/CR Document' },
                    { src: selectedDriverDetails.vehiclePhotoURL, title: 'Vehicle Photo' },
                  ].filter(doc => doc.src); // Filter out any documents with a null or undefined source

                  if (documents.length === 0) {
                    return <p className="text-center text-gray-500">No documents or photos available.</p>;
                  }

                  return (
                    <div className="relative">
                      {/* Navigation Buttons */}
                      <button
                        className="absolute left-0 top-1/2 transform -translate-y-1/2 text-black p-2 rounded-full opacity-75 hover:opacity-100 transition-opacity z-10"
                        onClick={() =>
                          setCurrentImageIndex(prevIndex =>
                            prevIndex === 0 ? documents.length - 1 : prevIndex - 1
                          )
                        }
                        aria-label="Previous image"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                        </svg>
                      </button>
                      <button
                        className="absolute right-0 top-1/2 transform -translate-y-1/2 text-black p-2 rounded-full opacity-75 hover:opacity-100 transition-opacity z-10"
                        onClick={() =>
                          setCurrentImageIndex(prevIndex =>
                            prevIndex === documents.length - 1 ? 0 : prevIndex + 1
                          )
                        }
                        aria-label="Next image"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </button>

                      {/* Carousel Display */}
                      <DocumentImage
                        key={documents[currentImageIndex].title}
                        src={documents[currentImageIndex].src}
                        alt={documents[currentImageIndex].title}
                        title={documents[currentImageIndex].title}
                        className="w-full h-60 object-contain"
                        setShowImageModal={setShowImageModal}
                        setModalImageSrc={setModalImageSrc}
                      />
                      <p className="text-center text-sm text-gray-500 mt-2">
                        {documents[currentImageIndex].title} ({currentImageIndex + 1} of {documents.length})
                      </p>
                    </div>
                  );
                })()}
              </div>
            </div>
            
            {/* Rejection Notification */}
            {selectedDriverDetails.accountStatus === 'REJECTED' && showRejectionNotification && (
              <div className="fixed bottom-2 right-2 bg-red-600 text-white text-xs p-3 rounded-md shadow-lg max-w-sm z-50 flex justify-between items-start">
                <div>
                  <div className="font-bold mb-1">Driver account has been rejected.</div>
                  <p className="text-lg">Reason: {selectedDriverDetails.rejectedReason || 'No reason provided.'}</p>
                </div>
                <button
                  onClick={() => setShowRejectionNotification(false)}
                  className="text-white hover:text-gray-200 pl-5"
                >
                  ✕
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
              <h2 className="text-xl font-bold text-gray-800">Reject Driver</h2>
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
                Reason for rejection <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                rows={4}
                placeholder="Please provide a detailed reason for rejecting this driver..."
                required
              />
              <p className="text-xs text-gray-500 mt-1">This reason will be visible to the driver.</p>
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
      
      {/* Image Pop-up Modal */}
      {showImageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="relative bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute top-2 right-2 text-black rounded-full p-1 hover:bg-gray-300 transition-colors z-20"
            >
              <X size={20} />
            </button>
            
            <div className="flex justify-center items-center h-full">
              <img src={modalImageSrc} alt="Enlarged Document" className="object-contain max-h-[85vh] w-full" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageRiders;