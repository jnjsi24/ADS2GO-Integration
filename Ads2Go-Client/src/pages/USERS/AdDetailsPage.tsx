// src/pages/AdDetailsPage.tsx
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { ChevronLeft, ChevronDown, CheckCircle, Truck, Trophy, XCircle, Loader2 } from 'lucide-react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { GET_MY_ADS } from '../../graphql/admin/queries/getAd';
import { DELETE_AD } from '../../graphql/user';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmationModal from '../../components/ConfirmationModal';


// Ad type (updated to include startTime and endTime)
type Ad = {
  id: string;
  title: string;
  description: string;
  adFormat: string;
  mediaFile?: string;
  adType: string;
  vehicleType: string;
  price: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RUNNING';
  reasonForReject?: string;
  createdAt: string;
  startTime: string;  // Campaign start date
  endTime: string;    // Campaign end date
  planId: {
    id: string;
    name: string;
    durationDays: number;
    playsPerDayPerDevice: number;
    numberOfDevices: number;
    adLengthSeconds: number;
    pricePerPlay: number;
    totalPrice: number;
  };
  materialId: {
    id: string;
    materialType: string;
    category: string;
    description: string;
    mountedAt: string;
    dismountedAt: string;
  };
  // Additional fields for display
  riders?: number;
  plan?: string;
  format?: string;
  imagePath?: string;
};



// Type for notifications
type Notification = {
  id: number;
  riderName: string;
  type: 'avail' | 'on_the_move' | 'completed' | 'cancelled';
  timestamp: string;
};

// Sample notification data
const sampleNotifications: Notification[] = [
  { id: 1, riderName: 'Jose Pascual', type: 'avail', timestamp: '2024-07-20 10:00 AM' },
  // ... rest of the notifications
];

// Utility function to mask the name
const maskName = (fullName: string): string => {
  const parts = fullName.split(' ');
  if (parts.length === 0) return '';

  const maskedParts = parts.map((part, index) => {
    if (part.length <= 1) return part; // Don't mask single character parts (e.g., "A")

    if (index === 0) { // First name masking (e.g., "Jose" -> "Jo**")
      if (part.length <= 2) return part; // Names like "Jo" remain "Jo"
      return part.substring(0, 2) + '*'.repeat(part.length - 2);
    } else { // Subsequent names (e.g., last name: "Pascual" -> "P***al")
      // This is a specific masking pattern based on the example
      if (part.length < 3) { // For names like "Li" (2 chars)
          return part.substring(0, 1) + '*'.repeat(part.length - 1); // "Li" -> "L*"
      }
      if (part.length === 3) { // For names like "Lee" (3 chars)
          return part.substring(0, 1) + '**'; // "Lee" -> "L**"
      }
      // For names 4 chars or longer, apply the "P***al" style
      // First char + fixed 3 asterisks + last 2 chars
      const firstChar = part.substring(0, 1);
      const lastTwoChars = part.substring(part.length - 2);
      return firstChar + '***' + lastTwoChars; // Hardcoding 3 asterisks
    }
  });
  return maskedParts.join(' ');
};

// Helper function to generate notification text
const getNotificationText = (notification: Notification) => {
  const maskedRiderName = maskName(notification.riderName); // Mask the rider's name
  switch (notification.type) {
    case 'avail':
      return `Rider ${maskedRiderName} has availed this ad.`;
    case 'on_the_move':
      return `Rider ${maskedRiderName} is on the move.`;
    case 'completed':
      return `Rider ${maskedRiderName} has completed the ad task.`;
    case 'cancelled':
      return `Rider ${maskedRiderName} cancelled the ad task.`;
    default:
      return '';
  }
};

const AdDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const adOptions = ["Material 1", "Material 2", "Material 3"];
  const [selectedAd, setSelectedAd] = useState(adOptions[0]);
  const [showAdDropdown, setShowAdDropdown] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Fetch all ads and filter by ID
  const { loading, error, data } = useQuery(GET_MY_ADS, {
    fetchPolicy: 'network-only',
    onError: (err) => {
      console.error('Error fetching ads:', err);
    },
  });

  // Delete ad mutation
  const [deleteAd, { loading: deleteLoading }] = useMutation(DELETE_AD, {
    refetchQueries: [{ query: GET_MY_ADS }],
    onCompleted: () => {
      navigate('/advertisements');
    },
    onError: (err) => {
      console.error('Error deleting ad:', err);
      alert('Failed to delete advertisement. Please try again.');
    },
  });

  const confirmDelete = () => {
    if (ad) {
      deleteAd({ variables: { id: ad.id } });
      setShowDeleteModal(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
  };

  // Find the specific ad by ID
  const ad = data?.getMyAds?.find((ad: Ad) => ad.id === id);
  
  // Debug logging
  React.useEffect(() => {
    if (ad) {
      console.log('🔍 Ad Details Debug:', {
        id: ad.id,
        title: ad.title,
        adFormat: ad.adFormat,
        adLengthSeconds: ad.adLengthSeconds,
        materialId: ad.materialId?.materialId,
        planName: ad.planId?.name
      });
    }
  }, [ad]);

  const tabletActivities = [
    { id: 1, ad: 'Material 1', gps: '14.5995° N, 120.9842° E', timestamp: '2025-09-16 09:30 AM', lastSeen: '3 mins ago', kmTraveled: 12.4 },
    { id: 2, ad: 'Material 1', gps: '10.6000° N, 120.9850° K', timestamp: '2025-09-16 09:40 AM', lastSeen: '10 mins ago', kmTraveled: 6.7 },
    { id: 3, ad: 'Material 2', gps: '82.4630° S, 121.0437° G', timestamp: '2025-09-16 09:45 AM', lastSeen: '10 mins ago', kmTraveled: 8.9 },
    { id: 4, ad: 'Material 3', gps: '92.4377° W, 121.0244° M', timestamp: '2025-09-16 10:00 AM', lastSeen: '2 mins ago', kmTraveled: 15.2 },
  ];
  

  // State for selected period filter (for chart)
  const [selectedPeriod, setSelectedPeriod] = useState<'Weekly' | 'Daily'>('Daily');
  // State for active tab
  const [activeTab, setActiveTab] = useState<'Details' | 'AdActivity' | 'TabletActivity'>('Details');
  
  // Fixed format date function to handle both timestamp strings and date strings
  const formatDate = (dateValue: string | number) => {
    if (!dateValue) return 'N/A';
    
    try {
      let date: Date;
      
      // Check if it's a timestamp string (all digits)
      if (typeof dateValue === 'string' && /^\d+$/.test(dateValue)) {
        // Convert timestamp string to number and create date
        date = new Date(parseInt(dateValue));
      } else if (typeof dateValue === 'number') {
        // Handle numeric timestamp
        date = new Date(dateValue);
      } else {
        // Handle regular date string
        date = new Date(dateValue);
      }
      
      if (isNaN(date.getTime())) return 'Invalid Date';
      
      const options: Intl.DateTimeFormatOptions = { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
      };
      return date.toLocaleDateString('en-US', options);
    } catch (error) {
      console.error('Date formatting error:', error, 'Input:', dateValue);
      return 'Invalid Date';
    }
  };

  // Format date range for display
  const formatDateRange = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return 'Dates not set';
    try {
      const start = formatDate(startDate);
      const end = formatDate(endDate);
      if (start === 'Invalid Date' || end === 'Invalid Date') return 'Invalid Date Range';
      return `${start} - ${end}`;
    } catch (error) {
      return 'Invalid Date Range';
    }
  };
  
  // Show loading state
  if (loading && !ad) {
    return (
      <div className="flex-1 ml-60 p-6 bg-gray-100 h-screen flex items-center justify-center">
        <div className="flex flex-col items-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
          <p className="text-gray-600">Loading ad details...</p>
        </div>
      </div>
    );
  }
  
  // Show error state
  if (error) {
    return (
      <div className="flex-1 ml-60 p-6 bg-gray-100 h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error loading ad</h2>
          <p className="text-gray-600 mb-4">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const handlePeriodChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedPeriod(event.target.value as 'Weekly' | 'Daily');
  };

  if (!ad) {
    return (
      <div className="flex-1 ml-60 p-6 bg-white h-screen flex items-center justify-center">
        <div className="text-center text-gray-700">
          <h1 className="text-3xl font-bold mb-4">Ad Not Found</h1>
          <p className="mb-6">The advertisement you are looking for does not exist.</p>
          <button
            onClick={() => navigate('/advertisements')}
            className="px-6 py-3 bg-[#3674B5] text-white rounded-lg hover:bg-[#578FCA] transition-colors flex items-center justify-center mx-auto"
          >
            <ChevronLeft size={20} className="mr-2" /> Back to Advertisements
          </button>
        </div>
      </div>
    );
  }

  // Function to generate mock profit data based on selected period
  const getChartData = () => {
    const baseProfit = ad.price * 0.7; // Assume profit is 70% of the price for demonstration
    const data = [];

    switch (selectedPeriod) {
      case 'Daily':
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        for (let i = 0; i < 7; i++) {
          const profitVariation = (Math.random() - 0.5) * (baseProfit * 0.2); // +/- 10% variation
          data.push({ day: days[i], profit: parseFloat((baseProfit + profitVariation).toFixed(2)) });
        }
        break;
      case 'Weekly':
        for (let i = 1; i <= 5; i++) { // 5 weeks of data
          const profitVariation = (Math.random() - 0.5) * (baseProfit * 0.3); // +/- 15% variation
          data.push({ week: `Week ${i}`, profit: parseFloat((baseProfit * 4 + profitVariation).toFixed(2)) }); // Scale for weekly
        }
        break;
    }
    return data;
  };

  return (
    <div className="min-h-screen bg-white ml-60">

      <div className="bg-white rounded-lg p-8 grid grid-cols-2 gap-8">
        {/* LEFT Section (Details, Description, Price, Profit Chart / Notifications) */}
        <div className="flex flex-col space-y-8">
          {/* Back button moved here, above the status and title */}
          <button
            onClick={() => navigate('/advertisements')}
            className="py-2 w-60 text-gray-800 rounded-lg hover:text-gray-500 transition-colors flex items-center" // Added mb-4 for spacing
          >
            <ChevronLeft size={20} className="mr-2" /> Back to Advertisements
          </button>
          
          <div>
            <div className="flex items-center gap-3">
              <span className={`inline-block px-3 py-1 text-sm font-semibold rounded-full ${ad.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : ad.status === 'APPROVED' ? 'bg-green-100 text-green-800' : ad.status === 'REJECTED' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                {ad.status}
              </span>
              {ad.status === 'REJECTED' && ad.reasonForReject && (
                <span className="text-red-600 text-sm flex items-center">
                  <XCircle size={16} className="mr-1" />
                  {ad.reasonForReject}
                </span>
              )}
            </div>
            <h2 className="text-5xl font-bold mt-4 mb-2">{ad.title}</h2>
            <p className="text-3xl mt-3 text-gray-800 font-semibold">${ad.price.toFixed(2)}</p>
            <p className="text-gray-700 mt-6 mb-5 text-md leading-relaxed">{ad.description}</p>
          </div>

          {/* Tabs - simplified for ad details */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex items-center mt-4" aria-label="Tabs">
              <div className="flex space-x-8 relative">
                {['Details', 'AdActivity', 'TabletActivity'].map((tab) => (
                  <div key={tab} className="relative">
                    <button
                      onClick={() =>
                        setActiveTab(tab as 'Details' | 'AdActivity' | 'TabletActivity')
                      }
                      className={`whitespace-nowrap py-4 px-1 font-medium text-sm ${
                        activeTab === tab ? 'text-orange-600' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {tab === 'AdActivity'
                        ? 'Ad Activity'
                        : tab === 'TabletActivity'
                        ? 'Tablet Activity'
                        : tab}
                    </button>

                    {/* Underline animation */}
                    <motion.div
                      layoutId="underline"
                      className="absolute left-0 bottom-0 h-1 bg-gradient-to-r from-orange-400 to-orange-700 rounded-full"
                      animate={{ width: activeTab === tab ? '100%' : 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />

                  </div>
                ))}
              </div>

              <button
                onClick={() => setShowDeleteModal(true)}
                disabled={deleteLoading || ad?.status !== 'PENDING'}
                className={`ml-auto px-4 py-2 border border-red-300 text-red-600 rounded-lg font-medium hover:bg-red-50 transition-colors shadow-sm ${
                  deleteLoading || ad?.status !== 'PENDING' ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {deleteLoading ? 'Deleting...' : 'Delete Ad'}
              </button>
            </nav>
          </div>

          {/* Conditionally rendered content based on activeTab */}
          {activeTab === 'Details' && (
            <div className="space-y-6">
              {/* Campaign Schedule */}
              <div className="bg-white">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-bold text-gray-600">Start Date:</span>
                    <span className="text-sm text-gray-800">
                      {formatDate(ad.startTime)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-bold text-gray-600">End Date:</span>
                    <span className="text-sm text-gray-800">
                      {formatDate(ad.endTime)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-bold text-gray-600">Duration:</span>
                    <span className="text-sm text-gray-800">
                      {ad.planId?.durationDays || 'N/A'} days
                    </span>
                  </div>
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm font-bold text-blue-800">
                      Campaign Period: {formatDateRange(ad.startTime, ad.endTime)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'AdActivity' && (
            // Ad Activity Notifications
            <div className="bg-none rounded-lg">
              <div className="space-y-2 max-h-80 rounded-lg shadow-md overflow-y-auto custom-scrollbar">
                {sampleNotifications.map(notif => (
                  <div key={notif.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg shadow-md">
                    {/* Icon based on notification type */}
                    {notif.type === 'avail' && <CheckCircle size={20} className="text-green-500 flex-shrink-0 mt-0.5" />}
                    {notif.type === 'on_the_move' && <Truck size={20} className="text-blue-500 flex-shrink-0 mt-0.5" />}
                    {notif.type === 'completed' && <Trophy size={20} className="text-purple-500 flex-shrink-0 mt-0.5" />}
                    {notif.type === 'cancelled' && <XCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />}
                    <div className="flex-1">
                      <p className="text-[#1b5087] text-sm font-medium">{getNotificationText(notif)}</p>
                      <p className="text-gray-500 text-xs">{notif.timestamp}</p>
                    </div>
                  </div>
                  
                ))}
                {sampleNotifications.length === 0 && (
                  <p className="text-center text-gray-500 py-10">No activities found for this ad.</p>
                )}
              </div>
            </div>
          )}

          {/* Tablet Activity Tab */}
          {activeTab === 'TabletActivity' && (
            <div className="bg-none rounded-lg">
              {/* Filter Dropdown */}
              <div className="relative mb-4 w-60">
                <button
                  onClick={() => setShowAdDropdown(!showAdDropdown)}
                  className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2"
                >
                  {selectedAd}
                  <ChevronDown
                    size={16}
                    className={`transform transition-transform duration-200 ${showAdDropdown ? 'rotate-180' : 'rotate-0'}`}
                  />
                </button>

                <AnimatePresence>
                  {showAdDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute z-10 top-full mt-1 w-full rounded-lg shadow-lg bg-white overflow-hidden"
                    >
                      {adOptions.map((ad) => (
                        <button
                          key={ad}
                          onClick={() => {
                            setSelectedAd(ad);
                            setShowAdDropdown(false);
                          }}
                          className="block w-full text-left pl-6 px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                        >
                          {ad}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Map + Activity List */}
              <div className="flex items-start space-x-6">
                {/* Map */}
                <div className="rounded-lg overflow-hidden shadow border border-gray-200">
                  <img
                    src="/image/gps.jpg"
                    alt="Map preview"
                    className="w-96 h-64 object-cover"
                  />
                </div>

                {/* Activity List */}
                <div className="flex flex-col space-y-4 flex-1 max-h-64 overflow-y-auto">
                  {tabletActivities
                    .filter((activity) => activity.ad === selectedAd)
                    .map((activity, index) => (
                      <div key={activity.id} className="flex items-start space-x-2">
                        {/* Number Circle */}
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#3674B5] text-white flex items-center justify-center font-bold text-xs">
                          {index + 1}
                        </div>

                        {/* GPS and timestamp */}
                        <div className="flex flex-col">
                          <p className="text-sm font-semibold text-gray-900">{activity.gps}</p>
                          <p className="text-xs text-gray-500">
                            {activity.lastSeen} | {activity.kmTraveled} km
                          </p>
                          <p className="text-xs text-gray-400">
                            {activity.timestamp}
                          </p>
                        </div>
                      </div>
                    ))}

                  {tabletActivities.filter((activity) => activity.ad === selectedAd).length === 0 && (
                    <p className="text-center text-gray-500 py-10">
                      No activity found for this ad.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT Section (Media, Properties, Levels, Stats) */}
        <div className="flex flex-col space-y-8">
          {/* Main Media Display - Fixed based on ManageAds.tsx */}
          <div className="rounded-xl overflow-hidden bg-gray-200 flex items-center justify-center" style={{ height: '400px' }}>
            {ad.mediaFile ? (
              ad.adFormat === 'IMAGE' ? (
                <img 
                  src={ad.mediaFile} 
                  alt={ad.title}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBhdmFpbGFibGU8L3RleHQ+PC9zdmc+';
                  }}
                />
              ) : ad.adFormat === 'VIDEO' ? (
                <video 
                  controls 
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'w-full h-full flex items-center justify-center';
                    errorDiv.innerHTML = '<span class="text-gray-500 text-xl">Video not available</span>';
                    e.currentTarget.parentNode?.appendChild(errorDiv);
                  }}
                >
                  <source src={ad.mediaFile} />
                  Your browser does not support the video tag.
                </video>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <a 
                    href={ad.mediaFile} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-700 underline text-xl"
                  >
                    View Media File
                  </a>
                </div>
              )
            ) : (
              <div className="text-gray-500 text-xl">No Media Available</div>
            )}
          </div>

          {/* Properties Section */}
          <div className="bg-white">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* MATERIAL */}
              <div className="border bg-gray-100 rounded-lg p-2 flex flex-col items-center justify-center text-center">
                <p className="text-sm font-semibold text-gray-900">
                  {ad.materialId?.materialId || 'N/A'}
                </p>
                <p className="text-xs text-gray-500">MATERIAL</p>
              </div>

              {/* AD PLAN */}
              <div className="border bg-gray-100 rounded-lg p-2 flex flex-col items-center justify-center text-center">
                <p className="text-sm font-semibold text-gray-900">
                  {ad.planId?.name || 'Plan Deleted'}
                </p>
                <p className="text-xs text-gray-500">AD PLAN</p>
              </div>

              {/* AD LENGTH */}
              <div className="border bg-gray-100 rounded-lg p-2 flex flex-col items-center justify-center text-center">
                <p className="text-sm font-semibold text-gray-900">
                  {ad.adLengthSeconds ? `${ad.adLengthSeconds}s` : 'N/A'}
                </p>
                <p className="text-xs text-gray-500">AD LENGTH</p>
              </div>

              {/* AD FORMAT */}
              <div className="border bg-gray-100 rounded-lg p-2 flex flex-col items-center justify-center text-center">
                <p className="text-sm font-semibold text-gray-900">
                  {ad.adFormat || 'N/A'}
                </p>
                <p className="text-xs text-gray-500">AD FORMAT</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title="Delete Advertisement"
        message="Are you sure you want to delete this advertisement? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
      />
    </div>
  );
};

export default AdDetailsPage;
