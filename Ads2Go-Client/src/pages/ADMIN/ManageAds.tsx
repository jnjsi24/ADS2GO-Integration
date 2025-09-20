import React, { useState, useEffect } from 'react';
import { X, Trash, Tablet, CalendarPlus, CalendarMinus, Mail, CalendarRange, Coins} from 'lucide-react';
import { useQuery, useMutation } from '@apollo/client';
import { gql } from '@apollo/client';
import { useAdminAuth } from '../../contexts/AdminAuthContext';

// GraphQL Queries and Mutations
const GET_ALL_ADS = gql`
  query GetAllAds {
    getAllAds {
      id
      title
      description
      adType
      adFormat
      status
      startTime
      endTime
      mediaFile
      reasonForReject
      approveTime
      rejectTime
      price
      totalPrice
      durationDays
      numberOfDevices
      adLengthSeconds
      playsPerDayPerDevice
      totalPlaysPerDay
      pricePerPlay
      createdAt
      updatedAt
      userId {
        id
        firstName
        lastName
        email
      }
      materialId {
        id
      }
      planId {
        id
        durationDays
        numberOfDevices
        adLengthSeconds
        playsPerDayPerDevice
        pricePerPlay
      }
    }
  }
`;

const UPDATE_AD = gql`
  mutation UpdateAd($id: ID!, $input: UpdateAdInput!) {
    updateAd(id: $id, input: $input) {
      id
      status
      reasonForReject
      approveTime
      rejectTime
    }
  }
`;

const DELETE_AD = gql`
  mutation DeleteAd($id: ID!) {
    deleteAd(id: $id)
  }
`;

// === Types ===
interface User {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
}

interface Material {
  id: string;
}

interface AdsPlan {
  id: string;
  durationDays: number;
  numberOfDevices: number;
  adLengthSeconds: number;
  playsPerDayPerDevice: number;
  pricePerPlay: number;
}

interface Ad {
  id: string;
  title: string;
  description: string;
  adType: 'DIGITAL' | 'NON_DIGITAL';
  adFormat: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RUNNING' | 'ENDED';
  startTime: string;
  endTime: string;
  mediaFile: string;
  reasonForReject?: string;
  approveTime?: string;
  rejectTime?: string;
  price: number;
  totalPrice: number;
  durationDays: number;
  numberOfDevices: number;
  adLengthSeconds: number;
  playsPerDayPerDevice: number;
  totalPlaysPerDay: number;
  pricePerPlay: number;
  createdAt: string;
  updatedAt: string;
  userId: User | null;
  materialId: Material | null;
  planId: AdsPlan | null;
}

const ManageAds: React.FC = () => {
  const { admin, isLoading, isInitialized } = useAdminAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'APPROVED' | 'PENDING' | 'REJECTED'>('all');
  const [showAdDetailsModal, setShowAdDetailsModal] = useState(false);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const [isAdModalOpen, setIsAdModalOpen] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [adToReject, setAdToReject] = useState<string | null>(null);
  const [showRejectionNotification, setShowRejectionNotification] = useState(true);

  const [animatingAdId, setAnimatingAdId] = useState<string | null>(null);

  
  // Helper function to trigger animation
  const triggerButtonAnimation = (adId: string, callback: () => void) => {
    setAnimatingAdId(adId);
    setTimeout(() => {
      callback();
      setAnimatingAdId(null); // Reset animation
    }, 300); // duration of animation
  };

  // Update handlers to use animation
  const handleApproveWithAnimation = (adId: string) => {
    triggerButtonAnimation(adId, () => handleApprove(adId));
  };

  const handleRejectWithAnimation = (adId: string) => {
    triggerButtonAnimation(adId, () => handleReject(adId));
  };

  const handleDeleteWithAnimation = (adId: string) => {
    triggerButtonAnimation(adId, () => handleDelete(adId));
  };



  // GraphQL Hooks
  const { data, loading, error, refetch } = useQuery(GET_ALL_ADS, {
    errorPolicy: 'all',
    fetchPolicy: 'cache-and-network'
  });

  const handleViewAdDetails = (ad: Ad) => {
  setSelectedAd(ad);
  setShowAdDetailsModal(true);

  // Trigger slide-in animation after modal is rendered
  setTimeout(() => {
    setIsAdModalOpen(true);
  }, 10);
  if (ad.status === 'REJECTED') {
    setShowRejectionNotification(true);
  }
};


  const handleCloseAdModal = () => {
  setIsAdModalOpen(false); // trigger slide-out
  setTimeout(() => {
    setShowAdDetailsModal(false);
    setSelectedAd(null);
  }, 300); // match the duration of your transition
};



  const [updateAd] = useMutation(UPDATE_AD, {
    onCompleted: (data) => {
      console.log('Ad updated successfully:', data);
      refetch(); // Refresh the ads list
    },
    onError: (error) => {
      console.error('Error updating ad:', error);
      alert(`Error updating ad: ${error.message}`);
    }
  });

  const [deleteAd] = useMutation(DELETE_AD, {
    onCompleted: () => {
      refetch(); // Refresh the ads list
    },
    onError: (error) => {
      console.error('Error deleting ad:', error);
      alert(`Error deleting ad: ${error.message}`);
    }
  });

  // Show loading state while authentication is being checked
  if (isLoading || !isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Check if admin is authenticated
  if (!admin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Access Denied</h2>
          <p className="text-gray-600">You must be logged in to access this page.</p>
        </div>
      </div>
    );
  }

  // Filtered ads
  const filteredAds = data?.getAllAds?.filter((ad: Ad) => {
    const matchesSearch =
      ad.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ad.userId?.firstName && ad.userId?.lastName && `${ad.userId.firstName} ${ad.userId.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())) ||
      ad.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || ad.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  const formatDate = (date: string) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  };

  const getAdvertiserName = (user: User | null) => {
    if (!user) return 'N/A';
    if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`;
    return user.email || 'N/A';
  };

  // Actions
  const handleApprove = async (adId: string) => {
    try {
      await updateAd({
        variables: {
          id: adId,
          input: {
            status: 'APPROVED'
          }
        }
      });
      alert(`Ad ${adId} approved successfully!`);
    } catch (error) {
      console.error('Error approving ad:', error);
    }
  };

  const handleReject = (adId: string) => {
    setAdToReject(adId);
    setShowRejectModal(true);
  };

  const submitReject = async () => {
    if (!adToReject || !rejectReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    try {
      await updateAd({
        variables: {
          id: adToReject,
          input: {
            status: 'REJECTED',
            reasonForReject: rejectReason
          }
        }
      });
      alert(`Ad ${adToReject} rejected successfully!`);
      setShowRejectModal(false);
      setRejectReason('');
      setAdToReject(null);
    } catch (error) {
      console.error('Error rejecting ad:', error);
    }
  };

  const handleDelete = async (adId: string) => {
    if (window.confirm('Are you sure you want to delete this ad? This action cannot be undone.')) {
      try {
        await deleteAd({
          variables: { id: adId }
        });
        alert(`Ad ${adId} deleted successfully!`);
      } catch (error) {
        console.error('Error deleting ad:', error);
      }
    }
  };

  const handleRowClick = (ad: Ad) => {
    handleViewAdDetails(ad);
    setShowAdDetailsModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 pl-64 pr-5 p-10">
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-lg text-gray-600">Loading advertisements...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 pl-64 pr-5 p-10">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong className="font-bold">Error loading ads: </strong>
          <span className="block sm:inline">{error.message}</span>
          <button
            onClick={() => refetch()}
            className="mt-2 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pl-64 pr-5 p-10">
      {/* Header with Title and Filters */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Advertisements Management</h1>
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Search by title, advertiser, or Ad ID..."
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
                setStatusFilter(e.target.value as 'all' | 'APPROVED' | 'PENDING' | 'REJECTED')
              }
            >
              <option value="all">All Status</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING">Pending</option>
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


      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Ads</h3>
          <p className="text-2xl font-bold text-gray-900">{data?.getAllAds?.length || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Pending</h3>
          <p className="text-2xl font-bold text-yellow-600">
            {data?.getAllAds?.filter((ad: Ad) => ad.status === 'PENDING').length || 0}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Approved</h3>
          <p className="text-2xl font-bold text-green-600">
            {data?.getAllAds?.filter((ad: Ad) => ad.status === 'APPROVED').length || 0}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Rejected</h3>
          <p className="text-2xl font-bold text-red-600">
            {data?.getAllAds?.filter((ad: Ad) => ad.status === 'REJECTED').length || 0}
          </p>
        </div>
      </div>

      {/* Table */}
      {filteredAds.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          {searchTerm || statusFilter !== 'all' ? 'No ads match your search criteria' : 'No ads found'}
        </div>
      ) : (
        <div className="rounded-md mb-4 overflow-hidden">
          <div className="grid grid-cols-12 px-4 py-3 text-sm font-semibold text-gray-600">
            <div className="col-span-3">Title</div>
            <div className="col-span-3">Advertiser</div>
            <div className="col-span-2">Ad Type</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2 text-center">Actions</div>
          </div>

          {filteredAds.map((ad: Ad) => (
            <div key={ad.id} className="bg-white mb-3 rounded-lg shadow-md">
              <div
                className="grid grid-cols-12 items-center px-5 py-5 text-sm hover:bg-gray-100 transition-colors cursor-pointer"
                onClick={() => handleRowClick(ad)}
              >

                
                <div className="col-span-3 truncate" title={ad.title}>{ad.title}</div>
                <div className="col-span-3 truncate" title={getAdvertiserName(ad.userId)}>
                  {getAdvertiserName(ad.userId)}
                </div>
                <div className="col-span-2">
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                    {ad.adType}
                  </span>
                </div>
                <div className="col-span-2">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      ad.status === 'APPROVED'
                        ? 'bg-green-200 text-green-800'
                        : ad.status === 'PENDING'
                        ? 'bg-yellow-200 text-yellow-800'
                        : ad.status === 'REJECTED'
                        ? 'bg-red-200 text-red-800'
                        : ad.status === 'RUNNING'
                        ? 'bg-blue-200 text-blue-800'
                        : 'bg-gray-200 text-gray-800'
                    }`}
                  >
                    {ad.status}
                  </span>
                </div>
                <div className="col-span-2 flex items-center justify-center gap-1">
  {ad.status === 'PENDING' && (
    <>
      <button
        className={`border border-green-500 text-green-500 text-xs px-2 py-1 rounded hover:bg-green-600 hover:text-white transform transition-all duration-300 ${
          animatingAdId === ad.id ? 'scale-105 bg-green-600 text-white' : ''
        }`}
        onClick={(e) => { e.stopPropagation(); handleApproveWithAnimation(ad.id); }}
        title="Approve"
      >
        Approve
      </button>
      <button
        className={`border border-red-500 text-red-500 text-xs px-2 py-1 rounded hover:bg-red-600 hover:text-white transform transition-all duration-300 ${
          animatingAdId === ad.id ? 'scale-105 bg-red-600 text-white' : ''
        }`}
        onClick={(e) => { e.stopPropagation(); handleRejectWithAnimation(ad.id); }}
        title="Reject"
      >
        Reject
      </button>
    </>
  )}
  <button
    className={`text-red-500 text-md hover:text-red-700 transform transition-all duration-300 ${
      animatingAdId === ad.id ? 'scale-105 text-red-700' : ''
    }`}
    onClick={(e) => { e.stopPropagation(); handleDeleteWithAnimation(ad.id); }}
    title="Delete"
  >
    <Trash className="w-4 h-4" />
  </button>
</div>

              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ad Details Modal */}
      {showAdDetailsModal && selectedAd && (
        <div
          className="fixed inset-0 z-50 overflow-hidden"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={handleCloseAdModal} // closes the modal on outside click
        >
          <div
            className={`fixed top-2 bottom-2 right-2 max-w-2xl w-full bg-white shadow-xl rounded-lg transform transition-transform duration-300 ease-in-out ${
              isAdModalOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
            onClick={(e) => e.stopPropagation()} // stops click from closing modal
          >
            <div className="h-full p-6 overflow-y-auto">

              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl font-bold text-white bg-[#FF9D3D] mr-4 shadow-md">
                    {selectedAd.userId?.firstName ? selectedAd.userId.firstName[0] : 'U'}
                    {selectedAd.userId?.lastName ? selectedAd.userId.lastName[0] : 'N'}
                  </div>
                  <div>
                    <div className="flex items-center flex-wrap gap-2">
                      <h2 className="text-2xl font-bold text-gray-800">{getAdvertiserName(selectedAd.userId)}</h2>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          selectedAd.status === 'APPROVED'
                            ? 'bg-green-200 text-green-800'
                            : selectedAd.status === 'PENDING'
                            ? 'bg-yellow-200 text-yellow-800'
                            : selectedAd.status === 'REJECTED'
                            ? 'bg-red-200 text-red-800'
                            : selectedAd.status === 'RUNNING'
                            ? 'bg-blue-200 text-blue-800'
                            : 'bg-gray-200 text-gray-800'
                        }`}
                      >  
                        {selectedAd.status}
                      </span>

                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-200 text-blue-800">{selectedAd.adType}</span>
                    </div>
                    <p className="text-sm text-gray-500">{selectedAd.id}</p>
                  </div>
                </div>
              </div>

              {/* Main Content */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                {/* Media Preview */}
                <div className="flex flex-col space-y-4">
                  {selectedAd.mediaFile ? (
                    selectedAd.adFormat === 'IMAGE' ? (
                      <img
                        src={selectedAd.mediaFile}
                        alt="Ad media"
                        className="w-full h-64 object-contain bg-gray-100 rounded-lg shadow-md"
                        onError={(e) => { e.currentTarget.src = 'data:image/svg+xml;base64,...'; }}
                      />
                    ) : selectedAd.adFormat === 'VIDEO' ? (
                      <video controls className="w-full h-64 bg-gray-100 rounded-lg shadow-md">
                        <source src={selectedAd.mediaFile} />
                        Your browser does not support the video tag.
                      </video>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500 bg-gray-100 rounded-lg">Media not available</div>
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 bg-gray-100 rounded-lg">Media not available</div>
                  )}
                </div>

                {/* Details */}
                <div className="flex flex-col space-y-4">
                  <h3 className="text-3xl mt-2 font-bold text-[#1B5087]">{selectedAd.title || 'N/A'}</h3>
                  <p className="text-gray-600 pb-16 text-sm">{selectedAd.description || 'No description provided'}</p>
                  <div className="flex items-center space-x-3">
                  <Tablet size={24} className="text-gray-500" />
                    <span className="truncate">{selectedAd.materialId?.id || 'N/A'}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Coins size={24} className="text-gray-500" />
                    <span className="font-semibold text-lg text-[#FF9B45]">{formatCurrency(selectedAd.price)}</span>
                  </div>
                </div>
              </div>

              {/* Campaign Details */}
              <div className="mt-10">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Campaign Details</h4>
                <div className="mt-4 pt-4 grid grid-cols-1 md:grid-cols-2 gap-y-4 md:gap-x-6">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                    <CalendarRange size={20} className="text-gray-500" />
                    <p>{selectedAd.durationDays} Days</p>
                    </div>
                    <div className="flex items-center space-x-3">
                    <CalendarPlus size={20} className="text-gray-500" />
                    <p>{formatDate(selectedAd.startTime)} Days</p>
                    </div>
                    <div className="flex items-center space-x-3">
                    <CalendarMinus size={20} className="text-gray-500" />
                    <p>{formatDate(selectedAd.endTime)} Days</p>
                    </div>
                    <div className="flex items-center space-x-3">
                    <Mail size={20} className="text-gray-500" />
                    <p>{selectedAd.userId?.email}</p>
                    </div>
                  </div>
                  <div className="space-y-2 border-l border-gray-300 md:border-none md:pr-10 md:pt-0 pt-4">
                    <div className="flex justify-between">
                      <span className="font-semibold text-gray-800">Devices:</span>
                      <span>{selectedAd.numberOfDevices}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-semibold text-gray-800">Plays/Day:</span>
                      <span>{selectedAd.totalPlaysPerDay}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-semibold text-gray-800">Format:</span>
                      <span>{selectedAd.adFormat}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Rejection Notification */}
            {selectedAd.status === 'REJECTED' && showRejectionNotification && (
              <div className="fixed bottom-2 right-2 bg-red-600 text-white text-xs p-3 rounded-md shadow-lg max-w-sm z-50 flex justify-between items-start">
                <div>
                  <div className="font-bold mb-1">Advertisemnet has been rejected.</div>
                  <p className="text-lg">Reason: {selectedAd.reasonForReject || 'No reason provided.'}</p>
                </div>
                <button
                  onClick={() => setShowRejectionNotification(false)} // closes the notification
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
              <h2 className="text-xl font-bold text-gray-800">Reject Advertisement</h2>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                  setAdToReject(null);
                }}
                className="text-gray-500 hover:text-gray-700 transition-colors"
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
                placeholder="Please provide a detailed reason for rejecting this advertisement..."
                required
              />
              <p className="text-xs text-gray-500 mt-1">This reason will be visible to the advertiser.</p>
            </div>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                  setAdToReject(null);
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitReject}
                disabled={!rejectReason.trim()}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Reject Advertisement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageAds;