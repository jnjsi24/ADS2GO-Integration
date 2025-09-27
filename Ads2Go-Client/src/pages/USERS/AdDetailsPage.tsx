// src/pages/AdDetailsPage.tsx
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { ChevronLeft, QrCode, ChevronDown, CheckCircle, Truck, Trophy, XCircle, Loader2 } from 'lucide-react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { GET_MY_ADS } from '../../graphql/admin/queries/getAd';
import { DELETE_AD } from '../../graphql/user';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmationModal from '../../components/ConfirmationModal';


type QrImpression = {
  id: number;
  timestamp: string;
  scans: number;
};

const sampleQrImpressions: QrImpression[] = [
  { id: 1, timestamp: '2025-09-25 08:00 AM', scans: 15 },
  { id: 2, timestamp: '2025-09-25 09:30 AM', scans: 22 },
  { id: 3, timestamp: '2025-09-25 11:15 AM', scans: 18 },
  { id: 4, timestamp: '2025-09-25 01:00 PM', scans: 30 },
  { id: 5, timestamp: '2025-09-25 02:45 PM', scans: 25 },
];

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
  drivers?: number;
  plan?: string;
  format?: string;
  imagePath?: string;
};



// Type for notifications
type Notification = {
  id: number;
  driverName: string;
  type: 'avail' | 'on_the_move' | 'completed' | 'cancelled';
  timestamp: string;
};

// Sample notification data
const sampleNotifications: Notification[] = [
  { id: 1, driverName: 'Jose Pascual', type: 'avail', timestamp: '2024-07-20 10:00 AM' },
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
  const maskedDriverName = maskName(notification.driverName); // Mask the driver's name
  switch (notification.type) {
    case 'avail':
      return `Driver ${maskedDriverName} has availed this ad.`;
    case 'on_the_move':
      return `Driver ${maskedDriverName} is on the move.`;
    case 'completed':
      return `Driver ${maskedDriverName} has completed the ad task.`;
    case 'cancelled':
      return `Driver ${maskedDriverName} cancelled the ad task.`;
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
          <p className="text-white/90">Loading ad details...</p>
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
          <p className="text-white/90 mb-4">{error.message}</p>
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
      <div className="flex-1 ml-60 p-6  h-screen flex items-center justify-center">
        <div className="text-center text-white/90">
          <h1 className="text-3xl font-bold mb-4">Ad Not Found</h1>
          <p className="mb-6">The advertisement you are looking for does not exist.</p>
          <button
            onClick={() => navigate('/advertisements')}
            className="py-3 bg-[#3674B5] text-white rounded-lg hover:bg-[#578FCA] transition-colors flex items-center justify-center mx-auto"
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
<div
    className="min-h-screen pl-72 pr-5 p-5 bg-cover bg-center bg-no-repeat"
    style={{
      backgroundImage: "linear-gradient(135deg, #3674B5 0%, black 100%)"
    }}
  >      <button
      onClick={() => navigate('/advertisements')}
      className="py-2 text-white/90 rounded-lg hover:text-white/90 transition-colors flex items-center mb-4"
    >
      <ChevronLeft size={20} className="mr-2" /> Back to Advertisements
    </button>

    {/* Top Row: Media (Left) + Info (Right) */}
    <div className="grid grid-cols-2 gap-8">
      {/* Left: Media */}
      <div className="rounded-xl overflow-hidden bg-gray-200 flex items-center justify-center h-96">
        {ad.mediaFile ? (
          ad.adFormat === 'IMAGE' ? (
            <img
              src={ad.mediaFile}
              alt={ad.title}
              className="w-full h-full object-contain"
              onError={(e) => {
                e.currentTarget.src =
                  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBhdmFpbGFibGU8L3RleHQ+PC9zdmc+';
              }}
            />
          ) : (
            <video controls className="w-full h-full object-contain">
              <source src={ad.mediaFile} />
              Your browser does not support the video tag.
            </video>
          )
        ) : (
          <div className="text-white/90 text-xl">No Media Available</div>
        )}
      </div>

      {/* Right: Status, Title, Description, Price, Properties */}
      <div className="flex flex-col space-y-4">
        <span
            className={`inline-block w-fit items-center justify-center text-sm font-semibold rounded-full px-3 py-1 ${

            ad.status === 'PENDING'
              ? 'bg-yellow-100 text-yellow-800'
              : ad.status === 'APPROVED'
              ? 'bg-green-100 text-green-800'
              : ad.status === 'REJECTED'
              ? 'bg-red-100 text-red-800'
              : 'bg-gray-100 text-white/90'
          }`}
        >
          {ad.status}
        </span>

        {ad.status === 'REJECTED' && ad.reasonForReject && (
          <span className="text-red-600 text-sm flex items-center">
            <XCircle size={16} className="mr-1" />
            {ad.reasonForReject}
          </span>
        )}

        <h2 className="text-4xl text-white/90 font-bold">{ad.title}</h2>
        <p className="text-2xl text-white/90 font-semibold mb-5">${ad.price.toFixed(2)}</p>
        <p className="text-white/70">{ad.description}</p>
      </div>
    </div>

    {/* Bottom Row: Left (Tabs + Delete) + Right (Tablet Activity) */}
    <div className="grid grid-cols-2 gap-8 pt-10">
      {/* Left: Tabs + Delete */}
      <div className="space-y-4">
  <div className="flex items-center justify-between mb-4 ">
    {/* Tabs */}
    <div className="flex space-x-4 relative">
      {['Details', 'AdActivity'].map((tab) => (
        <div key={tab} className="relative">
          <button
            onClick={() =>
              setActiveTab(tab === 'AdActivity' ? 'AdActivity' : 'Details')
            }
            className={`whitespace-nowrap py-2 px-4 font-medium relative overflow-hidden ${
              activeTab === tab ? 'text-orange-400' : 'text-white/60 hover:text-white/90'
            }`}
          >
            {tab === 'AdActivity' ? 'Ad Activity' : tab}

            {/* Hover underline with framer-motion */}
            <motion.div
              className="absolute left-0 bottom-0 h-1 bg-gradient-to-r from-orange-400 to-orange-700 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: activeTab === tab ? '100%' : 0 }}
              whileHover={{ width: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
          </button>
        </div>
      ))}
    </div>

    {/* Delete Button */}
    <button
      onClick={() => setShowDeleteModal(true)}
      disabled={deleteLoading || ad?.status !== 'PENDING'}
      className="px-4 py-2 bg-red-300 text-red-900 font-semibold rounded hover:bg-red-700 disabled:cursor-not-allowed"
    >
      {deleteLoading ? 'Deleting...' : 'Delete Ad'}
    </button>
  </div>

        {/* Tab Content */}
        {activeTab === 'Details' && (
          <div className="grid grid-cols-2 gap-4 mt-6">
  {/* Left: Table-style info */}
  <div>
    <table className="w-full text-sm mt-5 text-white/80">
      <tbody>
        <tr>
          <td className="font-semibold py-2">Start Date:</td>
          <td className="py-2 text-right">{formatDate(ad.startTime)}</td>
        </tr>
        <tr>
          <td className="font-semibold py-2">End Date:</td>
          <td className="py-2 text-right">{formatDate(ad.endTime)}</td>
        </tr>
        <tr>
          <td className="font-semibold py-2">Duration:</td>
          <td className="py-2 text-right">{ad.planId?.durationDays || 'N/A'} days</td>
        </tr>
      </tbody>
    </table>
  </div>

  {/* Right: Ad Properties */}
  <div className="flex flex-col mt-5 items-end space-y-2">
    <p className="text-sm font-semibold text-center text-white/90">{ad.materialId?.materialId || 'N/A'}</p>

    <p className="text-sm font-semibold text-center text-white/90">{ad.planId?.name}</p>

    <p className="text-sm font-semibold text-center text-white/90">{ad.adLengthSeconds ? `${ad.adLengthSeconds} seconds` : 'N/A'}</p>

    <p className="text-sm font-semibold text-center text-white/90">{ad.adFormat || 'N/A'}</p>
  </div>
</div>

        )}
        
        {activeTab === 'AdActivity' && (
          <div className="space-y-2 max-h-80 rounded-lg shadow-md overflow-y-auto custom-scrollbar">
            {/* Replace sampleNotifications with sampleQrImpressions */}
            {sampleQrImpressions.map((impression) => (
              <div key={impression.id} className="flex items-start bg-white/10 space-x-3 p-3 rounded-lg shadow-md">
                {/* You can use an icon to represent a QR code, e.g., QrCode from lucide-react */}
                <QrCode size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  {/* Display the impression details */}
                  <p className="text-white/90 text-sm font-medium">QR code scanned {impression.scans} times.</p>
                  <p className="text-white/70 text-xs">{impression.timestamp}</p>
                </div>
              </div>
            ))}
            {/* Update the empty state message */}
            {sampleQrImpressions.length === 0 && (
              <p className="text-center text-white/90 py-10">No QR impressions found for this ad.</p>
            )}
          </div>
        )}
      </div>

      {/* Right: Tablet Activity */}
      <div className="space-y-4">
        {/* Filter Dropdown */}
        <div className="relative mb-4 w-60">
          <button
            onClick={() => setShowAdDropdown(!showAdDropdown)}
            className="flex items-center rounded-md justify-between w-full text-xs text-black pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white/60 backdrop-blur-md gap-2"          >
            {selectedAd}
            <ChevronDown
              size={16}
              className={`transform transition-transform duration-200 ${
                showAdDropdown ? 'rotate-180' : 'rotate-0'
              }`}
            />
          </button>

          <AnimatePresence>
            {showAdDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="absolute z-10 top-full mt-2 w-full shadow-lg bg-white/60 rounded-md backdrop-blur-md overflow-hidden"
              >
                {adOptions.map((adOption) => (
                  <button
                    key={adOption}
                    onClick={() => {
                      setSelectedAd(adOption);
                      setShowAdDropdown(false);
                    }}
                    className="block w-full text-left px-4 py-2 ml-2 text-xs text-gray-700 hover:bg-white/60 transition-colors duration-150"
                  >
                    {adOption}
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
            <img src="/image/gps.jpg" alt="Map preview" className="w-96 h-64 object-cover" />
          </div>

          {/* Activity List */}
          <div className="flex flex-col space-y-4 flex-1 max-h-64 overflow-y-auto">
            {tabletActivities
              .filter((activity) => activity.ad === selectedAd)
              .map((activity, index) => (
                <div key={activity.id} className="flex items-start space-x-2">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#3674B5] text-white flex items-center justify-center font-bold text-xs">
                    {index + 1}
                  </div>
                  <div className="flex flex-col">
                    <p className="text-sm font-semibold text-white/90">{activity.gps}</p>
                    <p className="text-xs text-white/90">
                      {activity.lastSeen} | {activity.kmTraveled} km
                    </p>
                    <p className="text-xs text-white/90">{activity.timestamp}</p>
                  </div>
                </div>
              ))}
            {tabletActivities.filter((activity) => activity.ad === selectedAd).length === 0 && (
              <p className="text-center text-white/90 py-10">No activity found for this ad.</p>
            )}
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
