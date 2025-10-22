// src/pages/AdDetailsPage.tsx
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { ChevronLeft, ChevronRight, QrCode, ChevronDown, CheckCircle, Truck, Trophy, XCircle, Loader2, X } from 'lucide-react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { GET_MY_ADS } from '../../graphql/admin/queries/getAd';
import { DELETE_AD } from '../../graphql/user';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmationModal from '../../components/ConfirmationModal';
import RouteMap from '../../components/RouteMap';


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
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [showRejectionToast, setShowRejectionToast] = useState(true);
  
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

  const closeRejectionToast = () => {
    setShowRejectionToast(false);
  };

  const shouldShowRejectionToast = ad?.status === 'REJECTED' && ad?.reasonForReject && showRejectionToast;
  
  // Function to fetch device ID from material ID
  const fetchDeviceId = async (materialId: string) => {
    try {
      const response = await fetch(
        `${(process.env.REACT_APP_API_URL || 'http://localhost:5000').replace('/graphql', '').replace(/\/$/, '')}/screenTracking/deviceByMaterial/${materialId}`
      );
      const result = await response.json();
      
      if (result.success && result.data && result.data.deviceId) {
        setDeviceId(result.data.deviceId);
        console.log('🔍 Found device ID:', result.data.deviceId, 'for material:', materialId);
      } else {
        // Fallback to hardcoded device ID if not found
        setDeviceId('TABLET-21G93-1758642873206');
        console.log('⚠️ Using fallback device ID for material:', materialId);
      }
    } catch (error) {
      console.error('Error fetching device ID:', error);
      // Fallback to hardcoded device ID
      setDeviceId('TABLET-21G93-1758642873206');
    }
  };

  // Debug logging and fetch device ID
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
      
      // Fetch device ID if material ID is available
      if (ad.materialId?.materialId) {
        fetchDeviceId(ad.materialId.materialId);
      } else {
        // Use fallback device ID
        setDeviceId('TABLET-21G93-1758642873206');
      }
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
      <div className="relative flex-1 h-screen flex items-center justify-center overflow-hidden">
        {/* === Background Image === */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-fixed blur-sm brightness-90"
          style={{
            backgroundImage: "url('/image/bg.jpg')",
          }}
        ></div>

        {/* === Overlay Tint === */}
        <div className="absolute inset-0 bg-white/30 backdrop-blur-lg"></div>

      </div>
    );
  }
  
  // Show error state
  if (error) {
    return (
      <div className="flex-1 ml-60 p-6 bg-gray-100 h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error loading ad</h2>
          <p className="text-black/90 mb-4">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-black rounded hover:bg-blue-600"
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
        <div className="text-center text-black/90">
          <h1 className="text-3xl font-bold mb-4">Ad Not Found</h1>
          <p className="mb-6">The advertisement you are looking for does not exist.</p>
          <button
            onClick={() => navigate('/advertisements')}
            className="py-3 bg-[#3674B5] text-black rounded-lg hover:bg-[#578FCA] transition-colors flex items-center justify-center mx-auto"
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
  <div className="relative min-h-screen overflow-hidden lg:pl-72 px-4 sm:px-5 lg:pr-5 py-6 lg:p-5 pt-20 lg:pt-5">
    {/* Background Image */}
    <div
      className="absolute inset-0 bg-cover bg-center bg-fixed blur-sm brightness-90"
      style={{
        backgroundImage: "url('/image/bg.jpg')",
      }}
    ></div>

    {/* Overlay */}
    <div className="absolute inset-0 bg-white/30 backdrop-blur-lg"></div>

    {/* Rejection Toast */}
    <AnimatePresence>
      {shouldShowRejectionToast && (
        <motion.div
          initial={{ opacity: 0, x: 300, scale: 0.8 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 300, scale: 0.8 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="fixed top-6 right-6 z-50 max-w-sm"
        >
          <div className="bg-white/70 shadow-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <XCircle size={20} className="text-red-500 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-black mb-1">
                    Advertisement Rejected
                  </h4>
                  <p className="text-sm text-black">{ad.reasonForReject}</p>
                </div>
              </div>
              <button
                onClick={closeRejectionToast}
                className="ml-4 text-black/60 hover:text-red-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* --------------------- DESKTOP VIEW --------------------- */}
    <div className="relative z-10 hidden lg:block min-h-screen rounded-xl p-3 sm:p-5">
      <button
        onClick={() => navigate('/advertisements')}
        className="py-2 text-black/90 rounded-lg hover:text-black/90 transition-colors flex items-center mb-4"
      >
        <ChevronLeft size={20} className="mr-2" /> Back to Advertisements
      </button>

      {/* Top Row: Media + Info */}
      <div className="grid grid-cols-2 gap-8">
        {/* Media */}
        <div className="overflow-hidden bg-white/60 flex items-center justify-center h-96">
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
              </video>
            )
          ) : (
            <div className="text-black/90 text-xl">No Media Available</div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col space-y-4">
          <span
            className={`inline-block w-fit text-sm font-semibold rounded-md px-3 py-1 ${
              ad.status === 'PENDING'
                ? 'bg-yellow-100 text-yellow-800'
                : ad.status === 'APPROVED'
                ? 'bg-green-100 text-green-800'
                : ad.status === 'REJECTED'
                ? 'bg-red-100 text-red-800'
                : 'bg-gray-100 text-black/90'
            }`}
          >
            {ad.status}
          </span>
          <h2 className="text-4xl text-black/90 font-bold">{ad.title}</h2>
          <p className="text-2xl text-black/90 font-semibold mb-5">${ad.price.toFixed(2)}</p>
          <p className="text-black/70">{ad.description}</p>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-2 gap-8 pt-10">
        {/* Left Tabs */}
        <div className="space-y-4">
          <div className="flex justify-between mb-4">
            <div className="flex space-x-4 relative">
              {['Details', 'AdActivity'].map((tab) => (
                <div key={tab} className="relative">
                  <button
                    onClick={() =>
                      setActiveTab(tab === 'AdActivity' ? 'AdActivity' : 'Details')
                    }
                    className={`whitespace-nowrap py-2 px-4 font-medium relative ${
                      activeTab === tab ? 'text-black/80' : 'text-black/60 hover:text-black/90'
                    }`}
                  >
                    {tab === 'AdActivity' ? 'Ad Activity' : tab}
                    <motion.div
                      className="absolute left-0 bottom-0 h-1 bg-gradient-to-r from-orange-400 to-orange-700 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: activeTab === tab ? '100%' : 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowDeleteModal(true)}
              disabled={deleteLoading || ad?.status !== 'PENDING'}
              className="px-4 py-2 bg-red-200 text-red-600 rounded-lg font-semibold hover:bg-red-300 hover:text-white/80 disabled:cursor-not-allowed"
            >
              {deleteLoading ? 'Deleting...' : 'Delete Ad'}
            </button>
          </div>

          {activeTab === 'Details' && (
            <div className="grid grid-cols-2 bg-white/60 p-3 shadow-md">
              <div>
                <table className="w-full text-sm text-black/80">
                  <tbody>
                    <tr><td>Start Date:</td><td className="font-semibold text-right">{formatDate(ad.startTime)}</td></tr>
                    <tr><td>End Date:</td><td className="font-semibold text-right">{formatDate(ad.endTime)}</td></tr>
                    <tr><td>Duration:</td><td className="font-semibold text-right">{ad.planId?.durationDays || 'N/A'} days</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col mt-5 items-end space-y-2">
                <p className="text-sm font-semibold">{ad.materialId?.materialId || 'N/A'}</p>
                <p className="text-sm font-semibold">{ad.planId?.name}</p>
                <p className="text-sm font-semibold">{ad.adLengthSeconds ? `${ad.adLengthSeconds} seconds` : 'N/A'}</p>
                <p className="text-sm font-semibold">{ad.adFormat || 'N/A'}</p>
              </div>
            </div>
          )}

          {activeTab === 'AdActivity' && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {sampleQrImpressions.length > 0 ? (
                sampleQrImpressions.map((imp) => (
                  <div key={imp.id} className="flex items-start bg-white/60 space-x-3 p-3 shadow-md">
                    <QrCode size={20} className="text-green-500 mt-0.5" />
                    <div>
                      <p className="text-black/90 text-sm font-medium">QR code scanned {imp.scans} times.</p>
                      <p className="text-black/70 text-xs">{imp.timestamp}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center bg-white/60 rounded-lg text-black/90 py-5">No QR impressions found for this ad.</p>
              )}
            </div>
          )}
        </div>

        {/* Right Map & Activity */}
        <div className="space-y-4">
          <div className="relative mb-4 w-60">
            <button
              onClick={() => setShowAdDropdown(!showAdDropdown)}
              className="flex items-center justify-between w-full text-xs text-black pl-6 pr-4 py-3 bg-white/60 shadow-md rounded-md"
            >
              {selectedAd}
              <ChevronDown
                size={16}
                className={`transition-transform ${showAdDropdown ? 'rotate-180' : 'rotate-0'}`}
              />
            </button>

            <AnimatePresence>
              {showAdDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute z-10 top-full mt-2 w-full bg-white/60 rounded-md shadow-lg overflow-hidden"
                >
                  {adOptions.map((adOption) => (
                    <button
                      key={adOption}
                      onClick={() => {
                        setSelectedAd(adOption);
                        setShowAdDropdown(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-white/70"
                    >
                      {adOption}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-start space-x-6">
            <div className="w-96 h-64 rounded-lg overflow-hidden shadow border border-gray-200">
              {deviceId ? (
                <RouteMap deviceId={deviceId} style={{ height: '100%', width: '100%' }} showMetrics={false} />
              ) : (
                <div className="flex items-center justify-center h-full bg-gray-100">
                  <p className="text-xs text-gray-600">Loading device...</p>
                </div>
              )}
            </div>

            <div className="flex flex-col space-y-4 flex-1 max-h-64 overflow-y-auto">
              {tabletActivities
                .filter((activity) => activity.ad === selectedAd)
                .map((activity, index) => (
                  <div key={activity.id} className="flex items-start space-x-2">
                    <div className="w-6 h-6 rounded-full bg-[#3674B5]/70 text-white flex items-center justify-center font-bold text-xs">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{activity.gps}</p>
                      <p className="text-xs">
                        {activity.lastSeen} | {activity.kmTraveled} km
                      </p>
                      <p className="text-xs">{activity.timestamp}</p>
                    </div>
                  </div>
                ))}
              {tabletActivities.filter((a) => a.ad === selectedAd).length === 0 && (
                <p className="text-center text-black/90 py-10">No activity found for this ad.</p>
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

    {/* --------------------- MOBILE VIEW --------------------- */}
    <div className="relative z-10 block lg:hidden min-h-screen">
      {/* Main Card Container */}
      <div className="overflow-hidden">
        {/* Media Section */}
        <div className="relative h-64 bg-gradient-to-br from-orange-100 to-blue-100">
          {ad.mediaFile ? (
            ad.adFormat === 'IMAGE' ? (
              <img
                src={ad.mediaFile}
                alt={ad.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src =
                    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBhdmFpbGFibGU8L3RleHQ+PC9zdmc+';
                }}
              />
            ) : (
              <video controls className="w-full h-full object-cover">
                <source src={ad.mediaFile} />
              </video>
            )
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">No Media Available</div>
          )}
          
          {/* Chevron Right Icon */}
          <button 
            onClick={() => navigate('/advertisements')}
            className="absolute top-4 right-4 w-8 h-8 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition-colors"
          >
            <ChevronRight size={20} className="text-gray-700" />
          </button>
        </div>

        {/* Content Section */}
        <div className="pt-4 space-y-4">
          {/* Status Badges Row */}
          <div className="flex flex-wrap gap-2">
            <span
              className={`px-3 py-1 rounded-md text-xs font-semibold ${
                ad.status === 'PENDING'
                  ? ' text-yellow-700 border-2 border-yellow-500'
                  : ad.status === 'APPROVED'
                  ? 'text-green-700 border-2 border-green-500'
                  : ad.status === 'REJECTED'
                  ? 'text-red-700 border-2 border-red-500'
                  : 'text-gray-700 border-2 border-gray-500'
              }`}
            >
              {ad.status}
            </span>
            <span className="px-3 py-1 rounded-md text-xs font-semibold text-blue-700 bg-white/60">
              {ad.adLengthSeconds ? `${ad.adLengthSeconds} seconds` : 'N/A'}
            </span>
            <span className="px-3 py-1 rounded-md text-xs font-semibold text-purple-700 bg-white/60">
              {ad.materialId?.materialId || 'N/A'}
            </span>
            <span className="px-3 py-1 rounded-md text-xs font-semibold text-orange-700 bg-white/60">
              {ad.planId?.durationDays || 'N/A'} days
            </span>
          </div>

          {/* Title and Price */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{ad.title}</h2>
            <p className="text-xl font-semibold text-gray-900 mt-1">${ad.price.toFixed(2)}</p>
          </div>

          {/* Tab Navigation */}
          <div>
            <div className="flex space-x-7">
              {[
                { key: 'Details', label: 'About' },
                { key: 'AdActivity', label: 'Ad Activity' },
                { key: 'TabletActivity', label: 'Map Activity' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as 'Details' | 'AdActivity' | 'TabletActivity')}
                  className={`pb-3 px-1 pt-2 text-sm font-medium transition-colors relative ${
                    activeTab === tab.key
                      ? 'text-[#3674B5]'
                      : 'text-black/70 hover:text-black/90'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.key && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3674B5]"
                      initial={false}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="min-h-[300px] max-h-[400px] overflow-y-auto">
            {activeTab === 'Details' && (
              <div className="space-y-3 text-sm">
                <p className="text-black">{ad.description || 'No description available.'}</p>
                <div className="pt-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Start Date:</span>
                    <span className="font-medium text-gray-900">{formatDate(ad.startTime)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">End Date:</span>
                    <span className="font-medium text-gray-900">{formatDate(ad.endTime)}</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'AdActivity' && (
              <div className="space-y-3">
                {sampleQrImpressions.length > 0 ? (
                  sampleQrImpressions.map((imp) => (
                    <div key={imp.id} className="flex items-start space-x-3">
                      <QrCode size={20} className="text-green-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          QR code scanned {imp.scans} times.
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{imp.timestamp}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 text-gray-500">
                    <QrCode size={48} className="mx-auto mb-3 text-gray-300" />
                    <p>No QR scans yet</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'TabletActivity' && (
              <div className="space-y-4">
                {/* Material Selector */}
                <div className="relative">
                  <select
                    value={selectedAd}
                    onChange={(e) => setSelectedAd(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {adOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Map */}
                <div className="w-full h-48 rounded-lg overflow-hidden border border-gray-200">
                  {deviceId ? (
                    <RouteMap deviceId={deviceId} style={{ height: '100%', width: '100%' }} showMetrics={false} />
                  ) : (
                    <div className="flex items-center justify-center h-full bg-gray-50">
                      <Loader2 className="animate-spin text-gray-400" size={24} />
                    </div>
                  )}
                </div>

                {/* Activity List */}
                <div className="space-y-2">
                  {tabletActivities
                    .filter((activity) => activity.ad === selectedAd)
                    .map((activity, index) => (
                      <div key={activity.id} className="flex items-start space-x-3">
                        <div className="w-6 h-6 rounded-full bg-[#3674B5] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {index + 1}
                        </div>
                        <div className="flex-1 text-sm">
                          <p className="font-medium text-black/90">{activity.gps}</p>
                          <p className="text-xs text-black/70 mt-1">
                            {activity.lastSeen} • {activity.kmTraveled} km
                          </p>
                          <p className="text-xs text-black/70">{activity.timestamp}</p>
                        </div>
                      </div>
                    ))}
                  {tabletActivities.filter((a) => a.ad === selectedAd).length === 0 && (
                    <div className="text-center py-10 text-black/70">
                      <Truck size={48} className="mx-auto mb-3 text-black/70" />
                      <p>No activity found</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-4">
            {ad.status === 'APPROVED' && (
              <button
                onClick={() => navigate('/payment')}
                className="w-full py-3 bg-[#3674B5] hover:bg-[#3674B5]/80 text-white font-semibold rounded-lg transition-colors shadow-sm"
              >
                Pay Now
              </button>
            )}
            {ad.status === 'PENDING' && (
              <button
                onClick={() => setShowDeleteModal(true)}
                disabled={deleteLoading}
                className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteLoading ? 'Deleting...' : 'Delete Advertisement'}
              </button>
            )}
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
  </div>
);

};

export default AdDetailsPage;
