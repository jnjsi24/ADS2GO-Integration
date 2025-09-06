import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { TrashIcon } from '@heroicons/react/24/outline';
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [adToReject, setAdToReject] = useState<string | null>(null);

  // GraphQL Hooks
  const { data, loading, error, refetch } = useQuery(GET_ALL_ADS, {
    errorPolicy: 'all',
    fetchPolicy: 'cache-and-network'
  });

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
    setExpandedId(expandedId === ad.id ? null : ad.id);
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
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Advertisements Management</h1>

      {/* Search + Filter */}
      <div className="flex justify-between items-center mb-4">
        <input
          type="text"
          placeholder="Search by title, advertiser, or Ad ID..."
          className="text-xs text-black rounded-xl pl-5 py-3 w-80 shadow-md border border-gray-400 focus:outline-none bg-white"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <select
          className="text-sm text-black rounded-xl pl-5 py-3 pr-8 w-48 shadow-md border border-gray-400 focus:outline-none bg-white"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as 'all' | 'APPROVED' | 'PENDING' | 'REJECTED')}
        >
          <option value="all">All Status</option>
          <option value="APPROVED">Approved</option>
          <option value="PENDING">Pending</option>
          <option value="REJECTED">Rejected</option>
        </select>
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
        <div className="text-center py-10 text-gray-500 bg-white rounded-lg shadow">
          {searchTerm || statusFilter !== 'all' ? 'No ads match your search criteria' : 'No ads found'}
        </div>
      ) : (
        <div className="rounded-md shadow-md mb-4 overflow-hidden">
          <div className="grid grid-cols-12 bg-[#3674B5] px-4 py-3 text-sm font-semibold text-white">
            <div className="col-span-3">Title</div>
            <div className="col-span-3">Advertiser</div>
            <div className="col-span-2">Ad Type</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2 text-center">Actions</div>
          </div>

          {filteredAds.map((ad: Ad) => (
            <div key={ad.id} className="bg-white border-t border-gray-300">
              <div
                className="grid grid-cols-12 items-center px-4 py-3 text-sm hover:bg-gray-100 transition-colors cursor-pointer"
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
                        className="bg-green-500 text-white text-xs px-3 py-1 rounded hover:bg-green-600 transition-colors"
                        onClick={(e) => { e.stopPropagation(); handleApprove(ad.id); }}
                        title="Approve"
                      >
                        Approve
                      </button>
                      <button
                        className="bg-red-500 text-white text-xs px-3 py-1 rounded hover:bg-red-600 transition-colors"
                        onClick={(e) => { e.stopPropagation(); handleReject(ad.id); }}
                        title="Reject"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  <button
                    className="bg-red-600 text-white text-xs px-2 py-1 rounded hover:bg-red-700 transition-colors"
                    onClick={(e) => { e.stopPropagation(); handleDelete(ad.id); }}
                    title="Delete"
                  >
                    <TrashIcon className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {expandedId === ad.id && (
                <div className="bg-gray-50 p-6 transition-all duration-300 border-t">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                    {/* Column 1: Ad Information */}
                    <div>
                      <h3 className="text-lg font-semibold mb-3 text-gray-800">Ad Information</h3>
                      <div className="space-y-2">
                        <div><strong className="text-gray-600">Ad ID:</strong> <span className="text-gray-800">{ad.id}</span></div>
                        <div><strong className="text-gray-600">Title:</strong> <span className="text-gray-800">{ad.title}</span></div>
                        <div><strong className="text-gray-600">Advertiser:</strong> <span className="text-gray-800">{getAdvertiserName(ad.userId)}</span></div>
                        <div><strong className="text-gray-600">Email:</strong> <span className="text-gray-800">{ad.userId?.email || 'N/A'}</span></div>
                        <div><strong className="text-gray-600">Ad Type:</strong> <span className="text-gray-800">{ad.adType}</span></div>
                        <div><strong className="text-gray-600">Format:</strong> <span className="text-gray-800">{ad.adFormat}</span></div>
                        <div><strong className="text-gray-600">Material ID:</strong> <span className="text-gray-800">{ad.materialId?.id || 'N/A'}</span></div>
                      </div>
                    </div>
                    
                    {/* Column 2: Details & Status */}
                    <div>
                      <h3 className="text-lg font-semibold mb-3 text-gray-800">Campaign Details</h3>
                      <div className="space-y-2">
                        <div><strong className="text-gray-600">Status:</strong> 
                          <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${
                            ad.status === 'APPROVED' ? 'bg-green-200 text-green-800' :
                            ad.status === 'PENDING' ? 'bg-yellow-200 text-yellow-800' :
                            ad.status === 'REJECTED' ? 'bg-red-200 text-red-800' :
                            ad.status === 'RUNNING' ? 'bg-blue-200 text-blue-800' :
                            'bg-gray-200 text-gray-800'
                          }`}>{ad.status}</span>
                        </div>
                        <div><strong className="text-gray-600">Start Date:</strong> <span className="text-gray-800">{formatDate(ad.startTime)}</span></div>
                        <div><strong className="text-gray-600">End Date:</strong> <span className="text-gray-800">{formatDate(ad.endTime)}</span></div>
                        <div><strong className="text-gray-600">Duration:</strong> <span className="text-gray-800">{ad.durationDays} days</span></div>
                        <div><strong className="text-gray-600">Price:</strong> <span className="text-gray-800 font-semibold">{formatCurrency(ad.totalPrice)}</span></div>
                        <div><strong className="text-gray-600">Devices:</strong> <span className="text-gray-800">{ad.numberOfDevices}</span></div>
                        <div><strong className="text-gray-600">Plays/Day:</strong> <span className="text-gray-800">{ad.totalPlaysPerDay}</span></div>
                        {ad.status === 'APPROVED' && ad.approveTime && (
                          <div><strong className="text-green-600">Approved:</strong> <span className="text-gray-800">{formatDate(ad.approveTime)}</span></div>
                        )}
                        {ad.status === 'REJECTED' && ad.rejectTime && (
                          <div><strong className="text-red-600">Rejected:</strong> <span className="text-gray-800">{formatDate(ad.rejectTime)}</span></div>
                        )}
                        {ad.reasonForReject && (
                          <div><strong className="text-red-600">Reason:</strong> <span className="text-red-800">{ad.reasonForReject}</span></div>
                        )}
                      </div>
                    </div>

                    {/* Column 3: Description & Media */}
                    <div>
                      <h3 className="text-lg font-semibold mb-3 text-gray-800">Description & Media</h3>
                      <div className="space-y-3">
                        <div>
                          <strong className="text-gray-600">Description:</strong>
                          <p className="text-justify mt-1 text-gray-800">{ad.description || 'No description provided'}</p>
                        </div>
                        {ad.mediaFile && (
                          <div>
                            <strong className="text-gray-600">Media Preview:</strong>
                            <div className="mt-2">
                              {ad.adFormat === 'IMAGE' ? (
                                <img 
                                  src={ad.mediaFile} 
                                  alt="Ad media"
                                  className="w-full h-48 object-contain border rounded bg-gray-100"
                                  onError={(e) => {
                                    e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBhdmFpbGFibGU8L3RleHQ+PC9zdmc+';
                                  }}
                                />
                              ) : ad.adFormat === 'VIDEO' ? (
                                <video 
                                  controls 
                                  className="w-full h-48 border rounded bg-gray-100"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    const errorDiv = document.createElement('div');
                                    errorDiv.className = 'w-full h-48 border rounded bg-gray-100 flex items-center justify-center';
                                    errorDiv.innerHTML = '<span class="text-gray-500">Video not available</span>';
                                    e.currentTarget.parentNode?.appendChild(errorDiv);
                                  }}
                                >
                                  <source src={ad.mediaFile} />
                                  Your browser does not support the video tag.
                                </video>
                              ) : (
                                <div className="w-full h-48 border rounded bg-gray-100 flex items-center justify-center">
                                  <a 
                                    href={ad.mediaFile} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-500 hover:text-blue-700 underline"
                                  >
                                    View Media File
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
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