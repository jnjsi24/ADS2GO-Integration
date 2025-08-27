import React, { useState } from 'react';
import { X } from 'lucide-react';
import { TrashIcon } from '@heroicons/react/24/outline';

// === Types ===
interface Ad {
  id: string;
  adId: string;
  title: string;
  description: string;
  advertiserName: string;
  adType: string;
  status: 'PENDING' | 'ACTIVE' | 'REJECTED';
  startDate: string;
  endDate: string;
  mediaURL?: string;
  rejectionReason?: string;
}

// === Mock Data ===
const mockAds: Ad[] = [
  {
    id: '1',
    adId: 'AD001',
    title: 'Coca-Cola LED Billboard',
    description: 'A bright LED ad displayed on jeepneys in Manila.',
    advertiserName: 'Coca-Cola Philippines',
    adType: 'LED',
    status: 'ACTIVE',
    startDate: '2025-08-01',
    endDate: '2025-09-01',
    mediaURL: 'https://via.placeholder.com/400x200?text=Coca-Cola+Ad'
  },
  {
    id: '2',
    adId: 'AD002',
    title: 'Nike Just Do It Campaign',
    description: 'Vinyl sticker ad on buses across Metro Manila.',
    advertiserName: 'Nike',
    adType: 'VINYL',
    status: 'PENDING',
    startDate: '2025-09-05',
    endDate: '2025-10-05',
    mediaURL: 'https://via.placeholder.com/400x200?text=Nike+Ad'
  },
  {
    id: '3',
    adId: 'AD003',
    title: 'Jollibee Promo',
    description: 'Special chickenjoy ad on motorcycles.',
    advertiserName: 'Jollibee Foods Corp',
    adType: 'LED',
    status: 'REJECTED',
    startDate: '2025-07-15',
    endDate: '2025-08-15',
    rejectionReason: 'Low-quality media file submitted',
    mediaURL: 'https://via.placeholder.com/400x200?text=Jollibee+Ad'
  }
];

const ManageAds: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ACTIVE' | 'PENDING'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [adToReject, setAdToReject] = useState<string | null>(null);

  // Filtered ads
  const filteredAds = mockAds.filter(ad => {
    const matchesSearch =
      ad.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ad.advertiserName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ad.adId.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || ad.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatDate = (date: string) => (date ? new Date(date).toLocaleDateString() : 'N/A');

  // Mock Actions
  const handleApprove = (adId: string) => {
    alert(`Approving ad ${adId}`);
  };

  const handleReject = (adId: string) => {
    setAdToReject(adId);
    setShowRejectModal(true);
  };

  const submitReject = () => {
    if (!adToReject || !rejectReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }
    alert(`Rejecting ad ${adToReject} with reason: ${rejectReason}`);
    setShowRejectModal(false);
    setRejectReason('');
    setAdToReject(null);
  };

  const handleDelete = (adId: string) => {
    if (window.confirm('Are you sure you want to delete this ad?')) {
      alert(`Deleting ad ${adId}`);
    }
  };

  const handleRowClick = (ad: Ad) => {
    setExpandedId(expandedId === ad.adId ? null : ad.adId);
  };

  return (
    <div className="min-h-screen bg-gray-100 pl-64 pr-5 p-10">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Advertisements</h1>

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
          onChange={e => setStatusFilter(e.target.value as 'all' | 'ACTIVE' | 'PENDING')}
        >
          <option value="all">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="PENDING">Pending</option>
        </select>
      </div>

      {/* Table */}
      {filteredAds.length === 0 ? (
        <div className="text-center py-10 text-gray-500">No ads found</div>
      ) : (
        <div className="rounded-md shadow-md mb-4 overflow-hidden">
          <div className="grid grid-cols-12 bg-[#3674B5] px-4 py-2 text-sm font-semibold text-white">
            <div className="col-span-3">Title</div>
            <div className="col-span-3">Advertiser</div>
            <div className="col-span-2">Ad Type</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2 text-center">Action</div>
          </div>

          {filteredAds.map(ad => (
            <div key={ad.adId} className="bg-white border-t border-gray-300">
              <div
                className="grid grid-cols-12 items-center px-4 py-3 text-sm hover:bg-gray-100 transition-colors cursor-pointer"
                onClick={() => handleRowClick(ad)}
              >
                <div className="col-span-3 truncate">{ad.title}</div>
                <div className="col-span-3 truncate">{ad.advertiserName}</div>
                <div className="col-span-2">{ad.adType}</div>
                <div className="col-span-2">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      ad.status === 'ACTIVE'
                        ? 'bg-green-200 text-green-800'
                        : ad.status === 'PENDING'
                        ? 'bg-yellow-200 text-yellow-800'
                        : 'bg-red-200 text-red-800'
                    }`}
                  >
                    {ad.status}
                  </span>
                </div>
                <div className="col-span-2 flex items-center justify-center gap-1">
                  {ad.status === 'PENDING' && (
                    <>
                      <button
                        className="bg-green-500 text-white text-xs px-2 py-1 rounded hover:bg-green-600"
                        onClick={(e) => { e.stopPropagation(); handleApprove(ad.adId); }}
                        title="Approve"
                      >
                        Approved
                      </button>
                      <button
                        className="bg-red-500 text-white text-xs px-2 py-1 rounded hover:bg-red-600"
                        onClick={(e) => { e.stopPropagation(); handleReject(ad.adId); }}
                        title="Reject"
                      >
                        Rejected
                      </button>
                    </>
                  )}
                  <button
                    className="bg-red-600 text-white text-xs px-2 py-1 rounded hover:bg-red-700"
                    onClick={(e) => { e.stopPropagation(); handleDelete(ad.adId); }}
                    title="Delete"
                  >
                    <TrashIcon className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {expandedId === ad.adId && (
                <div className="bg-gray-50 p-6 transition-all duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                    {/* Column 1: Ad Information */}
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Ad Information</h3>
                      <div className="space-y-1">
                        <p><strong>Ad ID:</strong> {ad.adId}</p>
                        <p><strong>Title:</strong> {ad.title}</p>
                        <p><strong>Advertiser:</strong> {ad.advertiserName}</p>
                        <p><strong>Ad Type:</strong> {ad.adType}</p>
                      </div>
                    </div>
                    
                    {/* Column 2: Details & Status */}
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Details & Status</h3>
                      <div className="space-y-1">
                        <p><strong>Status:</strong> {ad.status}</p>
                        <p><strong>Start Date:</strong> {formatDate(ad.startDate)}</p>
                        <p><strong>End Date:</strong> {formatDate(ad.endDate)}</p>
                        {ad.rejectionReason && (
                          <p className="text-red-600"><strong>Reason:</strong> {ad.rejectionReason}</p>
                        )}
                      </div>
                    </div>

                    {/* Column 3: Description & Media */}
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Description & Media</h3>
                      <p className="text-justify mb-2">{ad.description}</p>
                      {ad.mediaURL && (
                          <div className="mt-4">
                            <img 
                              src={ad.mediaURL} 
                              alt="Ad media"
                              className="w-full h-60 object-cover border rounded"
                              onError={(e) => {
                                e.currentTarget.src = '/placeholder-ad.png';
                              }}
                            />
                          </div>
                        )}
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
              <h2 className="text-xl font-bold">Reject Ad</h2>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                  setAdToReject(null);
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
                placeholder="Please provide a reason for rejecting this ad..."
              />
            </div>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                  setAdToReject(null);
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
                Reject Ad
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageAds;