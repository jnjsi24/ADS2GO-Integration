// src/pages/AdDetailsPage.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, gql } from '@apollo/client';
import { 
  ChevronLeft, 
  ChevronRight,
  ChevronDown, 
  Truck, 
  Trophy, 
  XCircle, 
  Loader2, 
  X,
  Wifi, 
  WifiOff, 
  Target, 
  AlertTriangle, 
  CheckCircle, 
  Smartphone, 
  Bell,
  QrCode,
  MapPin,
  Activity,
  Info,
  CreditCard
} from 'lucide-react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { DELETE_AD } from '../../graphql/user';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmationModal from '../../components/ConfirmationModal';
import RouteMap from '../../components/RouteMap';
import MapView from '../../components/MapView';
import Payment from './Payment';
import playbackWebSocketService from '../../services/playbackWebSocketService';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

const GET_MY_ADS = gql`
  query GetMyAds {
    getMyAds {
      id
      title
      description
      adFormat
      mediaFile
      adType
      vehicleType
      price
      status
      paymentStatus
      reasonForReject
      createdAt
      startTime
      endTime
      adLengthSeconds
      durationDays
      planId {
        id
        name
        durationDays
        playsPerDayPerDevice
        numberOfDevices
        adLengthSeconds
        pricePerPlay
        totalPrice
      }
      materialId {
        id
        materialId
        materialType
        category
        description
        mountedAt
        dismountedAt
      }
    }
  }
`;



type QrImpression = {
  id: string;
  timestamp: string;
  scans: number;
  adId: string;
  adTitle: string;
  materialId: string;
  location?: {
    lat: number;
    lng: number;
    address: string;
  };
};

type DeviceNotification = {
  id: string;
  type: 'DEVICE_ONLINE' | 'DEVICE_OFFLINE' | 'MILESTONE_ACHIEVED' | 'QR_SCAN' | 'DEVICE_ERROR';
  message: string;
  timestamp: string;
  materialId: string;
  deviceId: string;
  data?: any;
  read: boolean;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
};

type DeviceLocation = {
  deviceId: string;
  materialId: string;
  lat: number;
  lng: number;
  address: string;
  timestamp: string;
  isOnline: boolean;
  lastSeen: string;
  totalDistance: number;
  currentHours: number;
};

// Real-time QR scan data will be fetched from API

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
  paymentStatus?: string | null;
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
  // Server returns an array of materials; keep type aligned with actual data shape
  materialId: Array<{
  id: string;
  materialId: string;
  materialType: string;
  category: string;
  description: string;
  mountedAt: string;
  dismountedAt: string;
  }>;
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
  const [selectedAd, setSelectedAd] = useState("Loading...");
  const [showAdDropdown, setShowAdDropdown] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [showRejectionToast, setShowRejectionToast] = useState(true);
  
  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentType, setSelectedPaymentType] = useState("");
  const [debugLogged, setDebugLogged] = useState(false);
  const [showStatusInfo, setShowStatusInfo] = useState(false);
  
  // Delete success tracking
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  
  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showStatusInfo) {
        setShowStatusInfo(false);
      }
    };

    if (showStatusInfo) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showStatusInfo]);
  
  // Initialize adOptions with default value
  const [adOptions, setAdOptions] = useState<string[]>(["Loading..."]);
  
  // Material filtering state
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [allDeviceLocations, setAllDeviceLocations] = useState<DeviceLocation[]>([]);
  
  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (showAdDropdown && !target.closest('.dropdown-container')) {
        setShowAdDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAdDropdown]);
  
  // Real-time data states
  const [qrImpressions, setQrImpressions] = useState<QrImpression[]>([]);
  const [deviceNotifications, setDeviceNotifications] = useState<DeviceNotification[]>([]);
  const [deviceLocations, setDeviceLocations] = useState<DeviceLocation[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [dataLoading, setDataLoading] = useState(true);
  
  // Fetch user ads (which already include paymentStatus)
  const { loading, error, data } = useQuery(GET_MY_ADS, {
    fetchPolicy: 'network-only',
  });

  // Handle query errors
  useEffect(() => {
    if (error) {
      console.error('Error fetching ads:', error);
    }
  }, [error]);

  // Delete ad mutation
  const [deleteAd, { loading: deleteLoading, error: deleteError, data: deleteData }] = useMutation(DELETE_AD, {
    refetchQueries: [{ query: GET_MY_ADS }],
  });

  // Handle delete mutation success/error
  useEffect(() => {
    if (deleteError) {
      console.error('Error deleting ad:', deleteError);
      alert('Failed to delete advertisement. Please try again.');
    }
    if (deleteData) {
      setDeleteSuccess(true);
    }
  }, [deleteError, deleteData]);

  // Navigate after successful delete
  useEffect(() => {
    if (deleteSuccess) {
      navigate('/advertisements');
    }
  }, [deleteSuccess, navigate]);

  const confirmDelete = () => {
    if (ad) {
      deleteAd({ variables: { id: ad.id } });
      setShowDeleteModal(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
  };

  // Get the ad data (which includes paymentStatus)
  const ads = data?.getMyAds || [];
  
  // Find the specific ad by ID
  const ad = ads.find((ad: any) => ad.id === id);
  
  // Get payment status directly from the ad model
  const paymentStatus = ad?.paymentStatus || null;
  const adStatus = ad?.status || 'PENDING';
  
  // Determine if payment button should show based on your requirements:
  // - PENDING: Admin hasn't approved yet (no payment button)
  // - APPROVED: Admin approved, user can pay (show payment button)
  // - RUNNING: Already paid and running (no payment button)
  // - REJECTED: Admin rejected (no payment button)
  const shouldShowPaymentButton = adStatus === 'APPROVED' && paymentStatus === 'PENDING';
  
  // Strict requirements: Both PAID and APPROVED/RUNNING to show detailed information
  const isFullyPaidAndApproved = paymentStatus === 'PAID' && (adStatus === 'APPROVED' || adStatus === 'RUNNING');
  
  // Debug payment status (only log once per ad)
  if (ad?.id && ad?.title && !debugLogged) {
    console.log('🔍 Payment Status Debug:', {
      adId: ad.id,
      adTitle: ad.title,
      adStatus: adStatus,
      paymentStatus: paymentStatus,
      shouldShowButton: shouldShowPaymentButton,
      isFullyPaidAndApproved: isFullyPaidAndApproved,
      rawAdData: {
        status: ad.status,
        paymentStatus: ad.paymentStatus
      }
    });
    setDebugLogged(true);
  }

  // Update material options when ad data is available
  React.useEffect(() => {
    if (ad?.materialId && Array.isArray(ad.materialId) && ad.materialId.length > 0) {
      const materials = ad.materialId;
      // console.log('🔍 Material data (array):', materials); // Debug log
      
      // Create options for each material
      const newOptions = materials.map((material: any, index: number) => {
        return `${material.materialId || `Material ${index + 1}`} (${material.materialType || 'Unknown Type'})`;
      });
      
      setAdOptions(newOptions);
      setSelectedAd(newOptions[0]);
      
      // Set the first material as selected by default
      if (materials.length > 0) {
        setSelectedMaterialId(materials[0].materialId);
      }
    } else if (ad && (!ad.materialId || !Array.isArray(ad.materialId) || ad.materialId.length === 0)) {
      setAdOptions(["No Material Available"]);
      setSelectedAd("No Material Available");
      setSelectedMaterialId(null);
    }
  }, [ad?.materialId]);

  // Filter devices based on selected material
  React.useEffect(() => {
    if (selectedMaterialId && allDeviceLocations.length > 0) {
      const filteredDevices = allDeviceLocations.filter(device => 
        device.materialId === selectedMaterialId
      );
      setDeviceLocations(filteredDevices);
      // console.log(`🔍 Filtered devices for material ${selectedMaterialId}:`, filteredDevices);
    } else if (allDeviceLocations.length > 0) {
      // Show all devices if no specific material is selected
      setDeviceLocations(allDeviceLocations);
    }
  }, [selectedMaterialId, allDeviceLocations]);

  const closeRejectionToast = () => {
    setShowRejectionToast(false);
  };

  const shouldShowRejectionToast = ad?.status === 'REJECTED' && ad?.reasonForReject && showRejectionToast;
  
  // Set fallback device ID directly (no API call needed)
  const setFallbackDeviceId = () => {
    setDeviceId('TABLET-21G93-1758642873206');
  };

  // Fetch QR scan data for this ad
  const fetchQRScans = useCallback(async (adId: string) => {
    try {
      const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace('/graphql', '').replace(/\/$/, '');
      // Use correct endpoint with query parameter instead of path parameter
      const response = await fetch(`${baseUrl}/ads/qr-scans?adId=${adId}`);
      
      if (!response.ok) {
        // Endpoint doesn't exist, skip QR scans
        console.log('⚠️ QR scans endpoint not available, skipping QR data fetch');
        return;
      }
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setQrImpressions(result.data);
        }
      }
    } catch (error) {
      console.log('⚠️ QR scans endpoint not available, skipping QR data fetch');
    }
  }, []);

  // Fetch device notifications for this ad's materials
  const fetchDeviceNotifications = useCallback(async (materialIds: string[]) => {
    // This endpoint doesn't exist on the server, so we'll skip it
    console.log('⚠️ Device notifications endpoint not available, skipping notifications fetch');
    return;
  }, []);

  // Fetch device locations for this ad using the same endpoint as admin pages
  const fetchDeviceLocations = useCallback(async (adId: string) => {
    try {
      const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace('/graphql', '').replace(/\/$/, '');
      const complianceUrl = `${baseUrl}/screenTracking/compliance?date=${new Date().toISOString().split('T')[0]}`;
      
      // console.log(`🔍 [AdDetailsPage] Fetching device data from compliance endpoint: ${complianceUrl}`);
      
      const response = await fetch(complianceUrl, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        // Endpoint doesn't exist, skip device locations
        console.log('⚠️ Compliance endpoint not available, skipping device locations fetch');
        return;
      }
      
      if (response.ok) {
        const complianceData = await response.json();
        // console.log('✅ [AdDetailsPage] Compliance data received:', complianceData);
        
        if (complianceData.success && complianceData.data?.screens) {
          // Filter screens that have this ad deployed
          const relevantScreens = complianceData.data.screens.filter((screen: any) => {
            // Check if any of the ad's materials match this screen's materialId
            return ad?.materialId && Array.isArray(ad.materialId) && 
                   ad.materialId.some((material: any) => material.materialId === screen.materialId);
          });
          
          // console.log(`📱 Found ${relevantScreens.length} devices for ad ${adId} out of ${complianceData.data.screens.length} total screens`);
          
          const locations: DeviceLocation[] = relevantScreens.map((screen: any) => ({
            deviceId: screen.materialId,
            materialId: screen.materialId,
            lat: screen.currentLocation?.lat || 0,
            lng: screen.currentLocation?.lng || 0,
            address: screen.currentLocation?.address || 'Location not available',
            timestamp: screen.lastSeen,
            isOnline: screen.isOnline,
            lastSeen: screen.lastSeen,
            totalDistance: screen.totalDistanceToday || 0,
            currentHours: screen.currentHours || 0
          }));
          
          setAllDeviceLocations(locations);
          setDeviceLocations(locations);
        } else {
          console.error('❌ [AdDetailsPage] Invalid compliance data format:', complianceData);
        }
      } else {
        const errorData = await response.json();
        console.error('❌ [AdDetailsPage] API Error:', errorData);
      }
    } catch (error) {
      console.log('⚠️ Compliance endpoint not available, skipping device locations fetch');
    }
  }, [ad?.materialId]);

  // Debug logging and fetch device ID
  React.useEffect(() => {
    if (ad) {
      // console.log('🔍 Ad Details Debug:', {
      //   id: ad.id,
      //   title: ad.title,
      //   adFormat: ad.adFormat,
      //   adLengthSeconds: ad.adLengthSeconds,
      //   materialId: ad.materialId,
      //   planName: ad.planId?.name
      // });
      
      // Set fallback device ID directly (no API call needed)
      setFallbackDeviceId();

      // Fetch real-time data for this ad
      if (ad.id) {
        fetchQRScans(ad.id);
        fetchDeviceLocations(ad.id);
      }
      
      if (ad.materialId && Array.isArray(ad.materialId) && ad.materialId.length > 0) {
        const materialIds: string[] = ad.materialId.map((material: any) => material.materialId);
        fetchDeviceNotifications(materialIds);
      }
    }
  }, [ad, fetchQRScans, fetchDeviceNotifications, fetchDeviceLocations]);

  // WebSocket integration for real-time updates
  useEffect(() => {
    // console.log('🔌 [AdDetailsPage] Setting up WebSocket connection');
    
    // Check initial WebSocket connection status
    if (playbackWebSocketService.isWebSocketConnected()) {
      setConnectionStatus('connected');
      // console.log('🔌 [AdDetailsPage] WebSocket already connected');
    } else {
      setConnectionStatus('connecting');
      // console.log('🔌 [AdDetailsPage] WebSocket connecting...');
    }
    
    // Subscribe to real-time device updates
    const unsubscribe = playbackWebSocketService.subscribe((update) => {
      // console.log('🔌 [AdDetailsPage] Received WebSocket update:', update);
      
      // Update connection status to connected when we receive any update
      if (connectionStatus !== 'connected') {
        setConnectionStatus('connected');
      }
      
      if (update.type === 'deviceUpdate') {
        // Update device status in real-time
        updateDeviceStatus(update.deviceId, update.isOnline ?? false, update.lastSeen);
      } else if (update.type === 'locationUpdate') {
        // Handle real-time location updates
        updateDeviceLocation(update.deviceId, update.location);
      }
    });

    // Set up periodic connection status check
    const statusCheckInterval = setInterval(() => {
      const isConnected = playbackWebSocketService.isWebSocketConnected();
      setConnectionStatus(isConnected ? 'connected' : 'disconnected');
    }, 5000);

    // Cleanup subscription on unmount
    return () => {
      // console.log('🔌 [AdDetailsPage] Cleaning up WebSocket subscription');
      clearInterval(statusCheckInterval);
      unsubscribe();
    };
  }, [connectionStatus]);

  // Helper function to update device status in real-time
  const updateDeviceStatus = useCallback((deviceId: string, isOnline: boolean, lastSeen?: string) => {
    setDeviceLocations(prevLocations => {
      return prevLocations.map(location => {
        if (location.deviceId === deviceId) {
          return {
            ...location,
            isOnline,
            lastSeen: lastSeen || location.lastSeen
          };
        }
        return location;
      });
    });

    // Add notification for device status change
    const notification: DeviceNotification = {
      id: `device-${deviceId}-${Date.now()}`,
      type: isOnline ? 'DEVICE_ONLINE' : 'DEVICE_OFFLINE',
      message: `Device ${isOnline ? 'came online' : 'went offline'}`,
      timestamp: new Date().toISOString(),
      materialId: deviceLocations.find(l => l.deviceId === deviceId)?.materialId || '',
      deviceId,
      read: false,
      priority: 'MEDIUM'
    };

    setDeviceNotifications(prev => [notification, ...prev.slice(0, 49)]); // Keep last 50 notifications
    setLastUpdate(new Date());
  }, [deviceLocations]);

  // Helper function to update device location in real-time
  const updateDeviceLocation = useCallback((deviceId: string, locationData: any) => {
    if (!locationData || !locationData.lat || !locationData.lng) {
      return;
    }
    
    setDeviceLocations(prevLocations => {
      return prevLocations.map(location => {
        if (location.deviceId === deviceId) {
          return {
            ...location,
            lat: locationData.lat,
            lng: locationData.lng,
            address: locationData.address || location.address,
            timestamp: locationData.timestamp || new Date().toISOString()
          };
        }
        return location;
      });
    });
    setLastUpdate(new Date());
  }, []);

  // Helper function to handle QR scan updates
  const handleQRScanUpdate = useCallback((update: any) => {
    if (update.adId === ad?.id) {
      const qrImpression: QrImpression = {
        id: `qr-${Date.now()}`,
        timestamp: new Date().toISOString(),
        scans: 1,
        adId: update.adId,
        adTitle: update.adTitle || ad?.title || '',
        materialId: update.materialId || '',
        location: update.location ? {
          lat: update.location.lat,
          lng: update.location.lng,
          address: update.location.address || 'Unknown location'
        } : undefined
      };

      setQrImpressions(prev => [qrImpression, ...prev.slice(0, 49)]); // Keep last 50 scans

      // Add notification for QR scan
      const notification: DeviceNotification = {
        id: `qr-${Date.now()}`,
        type: 'QR_SCAN',
        message: `QR code scanned for ${update.adTitle || ad?.title}`,
        timestamp: new Date().toISOString(),
        materialId: update.materialId || '',
        deviceId: update.deviceId || '',
        read: false,
        priority: 'LOW'
      };

      setDeviceNotifications(prev => [notification, ...prev.slice(0, 49)]);
      setLastUpdate(new Date());
    }
  }, [ad]);

  // Check for 8-hour milestone notifications
  useEffect(() => {
    deviceLocations.forEach(location => {
      if (location.currentHours >= 8 && location.isOnline) {
        // Check if we already have a milestone notification for this device today
        const today = new Date().toISOString().split('T')[0];
        const existingMilestone = deviceNotifications.find(n => 
          n.type === 'MILESTONE_ACHIEVED' && 
          n.deviceId === location.deviceId &&
          n.timestamp.startsWith(today)
        );

        if (!existingMilestone) {
          const notification: DeviceNotification = {
            id: `milestone-${location.deviceId}-${Date.now()}`,
            type: 'MILESTONE_ACHIEVED',
            message: `Device reached 8-hour milestone! (${location.currentHours.toFixed(1)}h)`,
            timestamp: new Date().toISOString(),
            materialId: location.materialId,
            deviceId: location.deviceId,
            read: false,
            priority: 'HIGH'
          };

          setDeviceNotifications(prev => [notification, ...prev.slice(0, 49)]);
        }
      }
    });
  }, [deviceLocations, deviceNotifications]);
  

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

  // Calculate duration in days between start and end dates
  const calculateDuration = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return 'N/A';
    
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return 'N/A';
      
      // Calculate difference in milliseconds
      const diffTime = end.getTime() - start.getTime();
      
      // Convert to days
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return diffDays;
    } catch (error) {
      console.error('Duration calculation error:', error);
      return 'N/A';
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
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 relative">
              <span
                className={`inline-block w-fit items-center justify-center text-sm font-semibold rounded-md px-3 py-1 ${
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
              
              {/* Info button for PENDING, APPROVED, and RUNNING status */}
              {(ad.status === 'PENDING' || ad.status === 'APPROVED' || ad.status === 'RUNNING') && (
                <div className="relative">
                  <button
                    onClick={() => setShowStatusInfo(true)}
                    className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                    title={ad.status === 'PENDING' ? "What does PENDING mean?" : ad.status === 'APPROVED' ? "What does APPROVED mean?" : "What does RUNNING mean?"}
                  >
                    <Info className="w-4 h-4" />
                  </button>
                  
                  {/* Status Info Tooltip */}
                  {showStatusInfo && (
                    <div className="absolute bottom-8 left-0 z-50 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          {ad.status === 'PENDING' ? '⏳' : ad.status === 'APPROVED' ? '✅' : '▶️'}
                        </span>
                        <span className="font-normal">
                          {ad.status === 'PENDING' 
                            ? 'Waiting for admin approval. You\'ll be able to proceed with payment once it\'s approved.'
                            : ad.status === 'APPROVED'
                            ? 'Your ad has been approved by the admin. You can now proceed with payment to start running your advertisement.'
                            : 'Your advertisement is currently displaying right now.'
                          }
                        </span>
                      </div>
                      {/* Arrow pointing to the info button */}
                      <div className="absolute -bottom-1 left-4 w-2 h-2 bg-gray-900 transform rotate-45"></div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Payment Button - Only show when ad is APPROVED and payment is PENDING */}
            {shouldShowPaymentButton && (
              <button
                onClick={() => {
                  setSelectedPaymentType("");
                  setShowPaymentModal(true);
                }}
                className="bg-[#3674B5] hover:bg-[#3674B5]/90 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Make Payment
              </button>
            )}
          </div>
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
              {/* Always show Details tab */}
              <div className="relative">
                <button
                  onClick={() => setActiveTab('Details')}
                  className={`whitespace-nowrap py-2 px-4 font-medium relative overflow-hidden ${
                    activeTab === 'Details' ? 'text-black/80' : 'text-black/60 hover:text-black/90'
                  }`}
                >
                  Details

                  {/* Hover underline with framer-motion */}
                  <motion.div
                    className="absolute left-0 bottom-0 h-1 bg-gradient-to-r from-orange-400 to-orange-700 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: activeTab === 'Details' ? '100%' : 0 }}
                    whileHover={{ width: '100%' }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                </button>
              </div>
              
              {/* Only show Ad Activity tab if fully paid and approved */}
              {isFullyPaidAndApproved && (
                <div className="relative">
                  <button
                    onClick={() => setActiveTab('AdActivity')}
                    className={`whitespace-nowrap py-2 px-4 font-medium relative overflow-hidden ${
                      activeTab === 'AdActivity' ? 'text-black/80' : 'text-black/60 hover:text-black/90'
                    }`}
                  >
                    Ad Activity

                    {/* Hover underline with framer-motion */}
                    <motion.div
                      className="absolute left-0 bottom-0 h-1 bg-gradient-to-r from-orange-400 to-orange-700 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: activeTab === 'AdActivity' ? '100%' : 0 }}
                      whileHover={{ width: '100%' }}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  </button>
                </div>
              )}
            </div>

            {/* Delete Button - Only show if not fully paid and approved */}
            {!isFullyPaidAndApproved && (
              <button
                onClick={() => setShowDeleteModal(true)}
                disabled={deleteLoading || ad?.status !== 'PENDING'}
                className="px-4 py-2 bg-red-200 text-red-600 rounded-lg font-semibold hover:bg-red-300 hover:text-white/80 disabled:cursor-not-allowed"
              >
                {deleteLoading ? 'Deleting...' : 'Delete Ad'}
              </button>
            )}
          </div>

          {activeTab === 'Details' && (
            <div className="grid grid-cols-2 bg-white/60 p-4 rounded-lg shadow-md min-h-[200px]">
              {/* Left: Table-style info */}
              <div className="flex flex-col justify-start">
                <table className="w-full text-sm mt-5 text-black/80">
                  <tbody>
                    <tr>
                      <td className="py-2">Start Date:</td>
                      <td className="py-2 font-semibold text-right">{formatDate(ad.startTime)}</td>
                    </tr>
                    <tr>
                      <td className="py-2">End Date:</td>
                      <td className="py-2 font-semibold text-right">{formatDate(ad.endTime)}</td>
                    </tr>
                    <tr>
                      <td className="py-2">Duration:</td>
                      <td className="py-2 font-semibold text-right">{calculateDuration(ad.startTime, ad.endTime)} days</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Right: Devices (upper right), Plan, Duration, Format (lower right) */}
              <div className="flex flex-col justify-between h-full">
                {/* Upper right: Devices section */}
                <div className="flex justify-end">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-black/90 mb-2">Devices:</p>
                    {ad.materialId && Array.isArray(ad.materialId) && ad.materialId.length > 0 ? (
                      <div className="space-y-1">
                        {ad.materialId.map((material: any, index: number) => (
                          <div key={material.id || index} className="text-sm text-black/70">
                            🚗 - {material.materialId || 'N/A'}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-black/70">No devices assigned</p>
                    )}
                  </div>
                </div>

                {/* Lower right: Plan, Duration, Format */}
                <div className="flex flex-col items-end space-y-2 mt-4">
                  <p className="text-sm font-semibold text-center text-black/90">{ad.planId?.name}</p>
                  <p className="text-sm font-semibold text-center text-black/90">{ad.adLengthSeconds ? `${ad.adLengthSeconds} seconds` : 'N/A'}</p>
                  <p className="text-sm font-semibold text-center text-black/90">{ad.adFormat || 'N/A'}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'AdActivity' && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {/* Real-time notifications */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Ad Activity</h3>
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${
                    connectionStatus === 'connected' ? 'bg-green-500' : 
                    connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}></div>
                  <span className="text-xs text-gray-500">
                    {connectionStatus === 'connected' ? 'Live' : 
                     connectionStatus === 'connecting' ? 'Connecting...' : 'Offline'}
                  </span>
                </div>
              </div>

              {/* Device Notifications */}
              {deviceNotifications.map((notification) => (
                <div key={notification.id} className="flex items-start bg-white/60 space-x-3 p-3 mr-3 shadow-md rounded-lg">
                  <div className="flex-shrink-0 mt-0.5">
                    {notification.type === 'DEVICE_ONLINE' && <Wifi size={20} className="text-green-500" />}
                    {notification.type === 'DEVICE_OFFLINE' && <WifiOff size={20} className="text-red-500" />}
                    {notification.type === 'MILESTONE_ACHIEVED' && <Target size={20} className="text-blue-500" />}
                    {notification.type === 'QR_SCAN' && <QrCode size={20} className="text-purple-500" />}
                    {notification.type === 'DEVICE_ERROR' && <AlertTriangle size={20} className="text-orange-500" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-black/90 text-sm font-medium">{notification.message}</p>
                    <p className="text-black/70 text-xs">
                      {new Date(notification.timestamp).toLocaleString()}
                      {notification.priority === 'HIGH' && (
                        <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">
                          High Priority
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ))}

              {/* QR Scan Activity */}
              {qrImpressions.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-md font-semibold text-gray-800 mb-2">QR Code Scans</h4>
                  {qrImpressions.map((impression) => (
                    <div key={impression.id} className="flex items-start bg-white/60 space-x-3 p-3 mr-3 shadow-md rounded-lg mb-2">
                      <QrCode size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-black/90 text-sm font-medium">
                          QR code scanned {impression.scans} time{impression.scans > 1 ? 's' : ''}
                        </p>
                        <p className="text-black/70 text-xs">
                          {new Date(impression.timestamp).toLocaleString()}
                          {impression.location && (
                            <span className="ml-2 text-gray-500">
                              • {impression.location.address}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {deviceNotifications.length === 0 && qrImpressions.length === 0 && (
                <div className="text-center bg-white/60 rounded-lg text-black/90 py-8">
                  <Activity className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium mb-2">No Activity Yet</p>
                  <p className="text-sm text-gray-600">
                    Device activity and QR scans will appear here in real-time.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Tablet Activity - Only show if fully paid and approved */}
        {isFullyPaidAndApproved && (
          <div className="space-y-4">
            {/* Map + Activity List */}
            <div className="flex items-start space-x-6">
            {/* Live Map */}
            <div className="w-96 h-64 rounded-lg overflow-hidden shadow border border-gray-200">
              {deviceLocations.length > 0 ? (
                <MapView
                  center={[
                    deviceLocations.reduce((sum, loc) => sum + loc.lat, 0) / deviceLocations.length,
                    deviceLocations.reduce((sum, loc) => sum + loc.lng, 0) / deviceLocations.length
                  ]}
                  zoom={12}
                  style={{ height: '100%', width: '100%' }}
                >
                  {deviceLocations.map((location) => (
                    <Marker
                      key={location.deviceId}
                      position={[location.lat, location.lng]}
                      icon={new L.DivIcon({
                        html: `
                          <div style="
                            width: 30px !important; 
                            height: 30px !important; 
                            background-color: ${location.isOnline ? '#22c55e' : '#ef4444'} !important; 
                            border: 2px solid ${location.isOnline ? '#16a34a' : '#dc2626'} !important; 
                            border-radius: 50% !important; 
                            box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
                            display: flex !important;
                            align-items: center !important;
                            justify-content: center !important;
                            font-size: 16px !important;
                            cursor: pointer !important;
                          ">
                            <span style="filter: drop-shadow(0 1px 1px rgba(0,0,0,0.3)) !important;">🚗</span>
                          </div>
                        `,
                        className: 'custom-vehicle-icon',
                        iconSize: [30, 30],
                        iconAnchor: [15, 15],
                        popupAnchor: [0, -15]
                      })}
                    >
                      <Popup maxWidth={250} maxHeight={300}>
                        <div className="p-2 space-y-2 max-w-xs">
                          <div className="border-b pb-2">
                            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                              <span className="text-lg">🚗</span>
                              Device {location.deviceId.slice(-4)}
                            </h3>
                          </div>
                          <div className="space-y-1 text-xs">
                            <p><span className="font-medium">Status:</span> {location.isOnline ? 'Online' : 'Offline'}</p>
                            <p><span className="font-medium">Hours:</span> {location.currentHours.toFixed(1)}h</p>
                            <p><span className="font-medium">Distance:</span> {location.totalDistance.toFixed(1)} km</p>
                            <p><span className="font-medium">Address:</span> {location.address}</p>
                            <p><span className="font-medium">Last Seen:</span> {new Date(location.lastSeen).toLocaleTimeString()}</p>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapView>
              ) : (
                <div className="flex items-center justify-center h-full bg-gray-100">
                  <div className="text-center">
                    <MapPin className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-xs text-gray-600">No devices found</p>
                    <p className="text-xs text-gray-500">Devices will appear when online</p>
                  </div>
                </div>
              )}
            </div>

            {/* Device List */}
            <div className="flex flex-col space-y-4 flex-1">
              {/* Material Selection Dropdown */}
              <div className="relative mb-4 w-60 dropdown-container">
                <button
                  onClick={() => setShowAdDropdown(!showAdDropdown)}
                  className="flex items-center rounded-md justify-between w-full text-xs text-black pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white/60 backdrop-blur-md gap-2"
                >
                  <div className="flex flex-col items-start">
                    <div className="font-medium">
                      {ad?.materialId && Array.isArray(ad.materialId) && ad.materialId.length > 0 
                        ? ad.materialId[0].materialId 
                        : 'No Material'}
                    </div>
                    <div className="text-gray-500 text-xs">
                      ({ad?.materialId && Array.isArray(ad.materialId) && ad.materialId.length > 0 
                        ? ad.materialId[0].materialType 
                        : 'Unknown Type'})
                    </div>
                  </div>
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
                      className="absolute z-50 top-full mt-2 w-full shadow-lg bg-white/90 rounded-md backdrop-blur-md overflow-hidden border border-gray-200"
                    >
                      {adOptions.map((adOption, index) => {
                        // Find the corresponding material ID
                        const materialId = ad?.materialId && Array.isArray(ad.materialId) && ad.materialId[index] 
                          ? ad.materialId[index].materialId 
                          : null;
                        
                        return (
                          <button
                            key={adOption}
                            onClick={() => {
                              setSelectedAd(adOption);
                              setSelectedMaterialId(materialId);
                              setShowAdDropdown(false);
                            }}
                            className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-white/70"
                          >
                            {adOption}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="max-h-64 overflow-y-auto">
                {deviceLocations.map((location, index) => (
                  <div key={location.deviceId} className="flex items-start space-x-2">
                    <div className={`flex-shrink-0 w-6 h-6 rounded-full text-white flex items-center justify-center font-bold text-xs ${
                      location.isOnline ? 'bg-green-500' : 'bg-red-500'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex flex-col">
                      <p className="text-xs text-black/90">
                        {new Date(location.lastSeen).toLocaleTimeString()} | {location.totalDistance.toFixed(1)} km
                      </p>
                      <p className={`text-sm font-semibold px-2 py-1 rounded ${
                        location.isOnline 
                          ? 'text-green-600 bg-green-50' 
                          : 'text-red-600 bg-red-50'
                      }`}>
                        {location.isOnline ? 'Online' : 'Offline'} • {location.currentHours.toFixed(1)}h today
                      </p>
                      <p className="text-xs text-gray-500">{location.address}</p>
                    </div>
                  </div>
                ))}
                {deviceLocations.length === 0 && (
                  <div className="text-center text-black/90 py-10">
                    <MapPin className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p>No devices found for this ad.</p>
                    <p className="text-xs text-gray-500 mt-1">Devices will appear here when they come online.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        )}
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

      {/* Payment Modal */}
      {showPaymentModal && ad && (
        <Payment
          paymentItem={{
            id: ad.id,
            productName: ad.title,
            amount: `$${ad.price.toFixed(2)}`,
            totalPrice: `$${ad.price.toFixed(2)}`,
            paymentType: selectedPaymentType,
            adType: ad.adType,
            durationDays: ad.durationDays,
            adFormat: ad.adFormat,
            adLengthSeconds: ad.adLengthSeconds,
            status: paymentStatus,
            adStatus: ad.status
          }}
          paymentType={selectedPaymentType}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => {
            setShowPaymentModal(false);
            // Optionally refresh the ad data
            window.location.reload();
          }}
        />
      )}

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
