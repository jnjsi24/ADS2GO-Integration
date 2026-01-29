// src/pages/AdDetailsPage.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client';
import { 
  ChevronLeft, 
  ChevronDown, 
  XCircle, 
  X,
  Wifi, 
  WifiOff, 
  Target, 
  AlertTriangle, 
  QrCode,
  MapPin,
  Activity,
  Info,
  RefreshCw,
  Calendar,
  Edit,
  MoreVertical,
  Trash2,
  CreditCard,
  WalletCards,
  BarChart3
} from 'lucide-react';
import { DELETE_AD } from '../../graphql/user';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmationModal from '../../components/ConfirmationModal';
import MapView from '../../components/MapView';
import Payment from './Payment';
import EditAdModal from '../../components/EditAdModal';
import playbackWebSocketService from '../../services/playbackWebSocketService';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { useMyAdsStatic } from '../../hooks/useMyAds';
import { GET_MY_ADS } from '../../graphql/user/queries/getMyAds';
import { GET_USER_ADS_WITH_PAYMENTS } from '../../graphql/user/queries/getUserAdsWithPayments';
import { screenComplianceService } from '../../services/screenComplianceService';
import { useToast, ToastContainer } from '../../components/ToastNotification';

// ✅ REMOVED: Inline query definition - now using centralized import
// const GET_MY_ADS = gql`
//   query GetMyAds {
//     getMyAds {
//       id
//       title
//       description
//       adFormat
//       mediaFile
//       adType
//       vehicleType
//       price
//       status
//       paymentStatus
//       reasonForReject
//       createdAt
//       startTime
//       endTime
//       adLengthSeconds
//       durationDays
//       planId {
//         id
//         name
//         durationDays
//         playsPerDayPerDevice
//         numberOfDevices
//         adLengthSeconds
//         pricePerPlay
//         totalPrice
//       }
//       materialId {
//         id
//         materialId
//         materialType
//         category
//         description
//         mountedAt
//         dismountedAt
//       }
//     }
//   }
// `;



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
  type: 'DEVICE_ONLINE' | 'DEVICE_OFFLINE' | 'MILESTONE_ACHIEVED' | 'QR_SCAN' | 'DEVICE_ERROR' | 'AD_EXPIRING_SOON';
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
  slotNumber?: number; // Slot number (1-5)
  isMasterDevice?: boolean; // Is this the master device for its material
  source?: 'websocket' | 'polling' | string;
};

type MaterialSlotInfo = {
  materialId: string;
  slots: Array<{
    slotNumber: number;
    deviceId: string;
    isOnline: boolean;
  }>;
  masterDeviceId: string | null; // ID of the current master device
};

// Real-time QR scan data will be fetched from API

// Ad type structure (not explicitly typed, using any)
// Server returns an array of materials; keep type aligned with actual data shape

const AdDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToast();
  const [showAdDropdown, setShowAdDropdown] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRejectionToast, setShowRejectionToast] = useState(true);
  
  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentType, setSelectedPaymentType] = useState("");
  const [debugLogged, setDebugLogged] = useState(false);
  const [showStatusInfo, setShowStatusInfo] = useState(false);
  
  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showPaymentTooltip, setShowPaymentTooltip] = useState(false);
  
  // Delete success tracking
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  
  // Archived ad banner visibility
  const [showArchivedBanner, setShowArchivedBanner] = useState(true);
  
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
  const [selectedAd, setSelectedAd] = useState<string>("Loading...");
  
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
  const [materialSlots, setMaterialSlots] = useState<MaterialSlotInfo[]>([]); // Track slots for each material
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  // Analytics data states
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  
  // ✅ Use cache-and-network to ensure fresh data while maintaining cache benefits
  // This ensures material assignments are always up-to-date
  const { loading, error, data, refetch } = useMyAdsStatic({
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
  });

  // Handle query errors
  useEffect(() => {
    if (error) {
      console.error('Error fetching ads:', error);
    }
  }, [error]);

  // Delete ad mutation
  // ✅ OPTIMIZATION: Now uses centralized GET_MY_ADS import for refetchQueries
  const [deleteAd, { loading: deleteLoading, error: deleteError, data: deleteData }] = useMutation(DELETE_AD, {
    refetchQueries: [{ query: GET_MY_ADS }],
  });

  // Handle delete mutation success/error
  useEffect(() => {
    if (deleteError) {
      console.error('Error deleting ad:', deleteError);
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

  const confirmDelete = (reason?: string) => {
    if (ad) {
      deleteAd({ variables: { id: ad.id, reason: reason || null } });
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
  // Mobile tab visibility rules by status - Analytics shows only for deleted (ARCHIVED) and ended (ENDED) ads
  // ✅ Analytics tab should only appear for historical data on completed/deleted ads
  const showAnalyticsTab = paymentStatus === 'PAID' && (adStatus === 'ENDED' || adStatus === 'ARCHIVED');
  const showDevicesTab = adStatus === 'RUNNING';

  const shouldFetchPaymentDetails = paymentStatus === 'PAID';
  const { data: paymentsData } = useQuery(GET_USER_ADS_WITH_PAYMENTS, {
    skip: !shouldFetchPaymentDetails,
    fetchPolicy: 'cache-first',
  });

  const paymentDetails = React.useMemo(() => {
    if (!shouldFetchPaymentDetails) return null;
    const entries = paymentsData?.getUserAdsWithPayments || [];
    const match = entries.find((entry: any) => entry?.ad?.id === ad?.id);
    return match?.payment || null;
  }, [paymentsData, shouldFetchPaymentDetails, ad?.id]);
  
  // Ensure mobile active tab is valid for current status
  // mobile tab guard effect is declared after activeTab state
  
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
      
      // Create options for each material, with "All Materials" as first option
      const materialOptions = materials.map((material: any, index: number) => {
        return `${material.materialId || `Material ${index + 1}`} (${material.materialType || 'Unknown Type'})`;
      });
      
      // Add "All Materials" option at the beginning
      const newOptions = [`All Materials`, ...materialOptions];
      
      setAdOptions(newOptions);
      setSelectedAd(newOptions[0]); // Default to "All Materials"
      
      // ✅ Keep selectedMaterialId as null to show all markers by default
      setSelectedMaterialId(null);
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

  // ✅ PHASE 2 OPTIMIZATION: Use shared compliance service with caching
  // Fetch device locations for this ad using the same endpoint as admin pages
  const fetchDeviceLocations = useCallback(async (adId: string) => {
    try {
      const complianceData = await screenComplianceService.getCompliance(null, false);
      
      if (complianceData.success) {
        if (complianceData.data?.materialScreens) {
          // ✅ Use materialScreens (car-level data) instead of screens (individual device records)
          const relevantScreens = complianceData.data.materialScreens.filter((screen: any) => {
            // Check if any of the ad's materials match this screen's materialId
            return ad?.materialId && Array.isArray(ad.materialId) && 
                   ad.materialId.some((material: any) => material.materialId === screen.materialId);
          });
          
          console.log(`📱 Found ${relevantScreens.length} cars for ad ${adId} out of ${complianceData.data.materialScreens.length} total materials`);
          
          // Extract material slot information for master device detection
          const slotInfoArray: MaterialSlotInfo[] = relevantScreens.map((screen: any) => {
            const slotStatus = screen.slotStatus || {};
            const slots = [];
            
            // Add Slot 1 if exists
            if (slotStatus.slot1?.deviceId) {
              slots.push({
                slotNumber: 1,
                deviceId: slotStatus.slot1.deviceId,
                isOnline: slotStatus.slot1.online || false
              });
            }
            
            // Add Slot 2 if exists
            if (slotStatus.slot2?.deviceId) {
              slots.push({
                slotNumber: 2,
                deviceId: slotStatus.slot2.deviceId,
                isOnline: slotStatus.slot2.online || false
              });
            }
            
            // Determine master device: Slot 1 if online, else Slot 2 if online, else null
            let masterDeviceId = null;
            if (slotStatus.slot1?.online && slotStatus.slot1?.deviceId) {
              masterDeviceId = slotStatus.slot1.deviceId;
            } else if (slotStatus.slot2?.online && slotStatus.slot2?.deviceId) {
              masterDeviceId = slotStatus.slot2.deviceId;
            }
            
            console.log(`🎯 [Master Device] Material ${screen.materialId}: Master = ${masterDeviceId || 'None'}`);
            
            return {
              materialId: screen.materialId,
              slots,
              masterDeviceId
            };
          });
          
          setMaterialSlots(slotInfoArray);
          
          // Map ALL relevant screens to DeviceLocation (don't filter by GPS for status display)
          const newLocationsFromPolling: DeviceLocation[] = relevantScreens.map((screen: any) => ({
            deviceId: screen.materialId,
            materialId: screen.materialId,
            lat: screen.currentLocation?.lat || 0,
            lng: screen.currentLocation?.lng || 0,
            address: screen.currentLocation?.address || 'Location not available',
            timestamp: screen.lastSeen,
            isOnline: screen.isOnline,
            lastSeen: screen.lastSeen,
            totalDistance: screen.totalDistance || 0,
            currentHours: screen.totalHours || 0,
            source: 'polling' as const // Track that this came from polling
          }));
          
          // ✅ SMART MERGE: Merge polling data with existing WebSocket data
          // Prefer WebSocket updates over polling if they're recent (within 5 seconds)
          setAllDeviceLocations(prevLocations => {
            const mergedLocations = new Map<string, DeviceLocation>();
            
            // First, add all existing locations (preserve WebSocket updates)
            prevLocations.forEach(loc => {
              mergedLocations.set(loc.deviceId, loc);
            });
            
            // Then, merge new polling data (only update if newer or if device doesn't exist)
            newLocationsFromPolling.forEach(newLoc => {
              const existingLoc = mergedLocations.get(newLoc.deviceId);
              
              if (!existingLoc) {
                // New device - add it
                mergedLocations.set(newLoc.deviceId, newLoc);
              } else {
                // Existing device - check timestamps
                const existingTimestamp = new Date(existingLoc.timestamp || existingLoc.lastSeen).getTime();
                const newTimestamp = new Date(newLoc.timestamp || newLoc.lastSeen).getTime();
                const existingSource = (existingLoc as any).source || 'unknown';
                const isExistingFromWebSocket = existingSource === 'websocket';
                
                // ✅ PREFER WEBSOCKET: If existing is from WebSocket and polling is recent, ignore polling
                if (isExistingFromWebSocket && newTimestamp - existingTimestamp < 5000) {
                  // Keep existing WebSocket data (it's more recent)
                  return;
                }
                
                // ✅ PREFER NEWER: If polling data is newer, use it
                if (newTimestamp > existingTimestamp) {
                  // Merge: keep WebSocket GPS if it exists and is recent, otherwise use polling
                  const mergedLoc: DeviceLocation = {
                    ...existingLoc,
                    // Keep existing GPS if it's from WebSocket and recent, otherwise use polling
                    lat: (isExistingFromWebSocket && newTimestamp - existingTimestamp < 5000) 
                      ? existingLoc.lat 
                      : newLoc.lat,
                    lng: (isExistingFromWebSocket && newTimestamp - existingTimestamp < 5000) 
                      ? existingLoc.lng 
                      : newLoc.lng,
                    // Always update other fields from polling
                    address: newLoc.address || existingLoc.address,
                    timestamp: newLoc.timestamp || existingLoc.timestamp,
                    isOnline: newLoc.isOnline !== undefined ? newLoc.isOnline : existingLoc.isOnline,
                    lastSeen: newLoc.lastSeen || existingLoc.lastSeen,
                    totalDistance: newLoc.totalDistance || existingLoc.totalDistance,
                    currentHours: newLoc.currentHours || existingLoc.currentHours,
                    source: (existingLoc as any).source || 'polling' // Keep original source
                  };
                  mergedLocations.set(newLoc.deviceId, mergedLoc);
                } else {
                  // Existing data is newer - keep it
                  return;
                }
              }
            });
            
            return Array.from(mergedLocations.values());
          });
          
          // ✅ SMART MERGE for map locations (filtered GPS)
          setDeviceLocations(prevLocations => {
            const filteredPollingLocations = newLocationsFromPolling.filter((loc) => {
              const hasValidLocation = loc.lat !== 0 && loc.lng !== 0;
              return hasValidLocation;
            });
            
            const mergedLocations = new Map<string, DeviceLocation>();
            
            // First, add all existing map locations (preserve WebSocket GPS updates)
            prevLocations.forEach(loc => {
              mergedLocations.set(loc.deviceId, loc);
            });
            
            // Then, merge new polling data (only update if newer or if device doesn't exist)
            filteredPollingLocations.forEach(newLoc => {
              const existingLoc = mergedLocations.get(newLoc.deviceId);
              
              if (!existingLoc) {
                // New device with valid GPS - add it
                mergedLocations.set(newLoc.deviceId, newLoc);
              } else {
                // Existing device - check timestamps
                const existingTimestamp = new Date(existingLoc.timestamp || existingLoc.lastSeen).getTime();
                const newTimestamp = new Date(newLoc.timestamp || newLoc.lastSeen).getTime();
                const existingSource = (existingLoc as any).source || 'unknown';
                const isExistingFromWebSocket = existingSource === 'websocket';
                
                // ✅ PREFER WEBSOCKET: If existing is from WebSocket and polling is recent, ignore polling GPS
                if (isExistingFromWebSocket && newTimestamp - existingTimestamp < 5000) {
                  // Keep existing WebSocket GPS (it's more recent)
                  return;
                }
                
                // ✅ PREFER NEWER: If polling data is newer, use it
                if (newTimestamp > existingTimestamp) {
                  // Merge: keep WebSocket GPS if it exists and is recent, otherwise use polling
                  const mergedLoc: DeviceLocation = {
                    ...existingLoc,
                    // Keep existing GPS if it's from WebSocket and recent, otherwise use polling
                    lat: (isExistingFromWebSocket && newTimestamp - existingTimestamp < 5000) 
                      ? existingLoc.lat 
                      : newLoc.lat,
                    lng: (isExistingFromWebSocket && newTimestamp - existingTimestamp < 5000) 
                      ? existingLoc.lng 
                      : newLoc.lng,
                    // Always update other fields from polling
                    address: newLoc.address || existingLoc.address,
                    timestamp: newLoc.timestamp || existingLoc.timestamp,
                    isOnline: newLoc.isOnline !== undefined ? newLoc.isOnline : existingLoc.isOnline,
                    lastSeen: newLoc.lastSeen || existingLoc.lastSeen,
                    source: (existingLoc as any).source || 'polling' // Keep original source
                  };
                  mergedLocations.set(newLoc.deviceId, mergedLoc);
                } else {
                  // Existing data is newer - keep it
                  return;
                }
              }
            });
            
            return Array.from(mergedLocations.values());
          });
          
          console.log(`📊 [AdDetailsPage] Merged ${newLocationsFromPolling.length} devices from polling with existing data`);
        } else {
          console.error('❌ [AdDetailsPage] Invalid compliance data format:', complianceData);
        }
      } else {
        console.error('❌ [AdDetailsPage] API Error: compliance service returned unsuccessful result');
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
      
      // Fetch real-time data for this ad (initial fetch)
      if (ad.id) {
        fetchQRScans(ad.id);
        fetchDeviceLocations(ad.id);
      }
      
      if (ad.materialId && Array.isArray(ad.materialId) && ad.materialId.length > 0) {
        const materialIds: string[] = ad.materialId.map((material: any) => material.materialId);
        fetchDeviceNotifications(materialIds);
      }

      // ✅ Set up auto-refresh every 5 seconds for real-time status updates (silent background refresh)
      const refreshInterval = setInterval(() => {
        // Silently refresh device locations and status in background for real-time updates
        if (ad.id) {
          fetchDeviceLocations(ad.id); // Updates device online/offline status every 5s
          fetchQRScans(ad.id);
        }
        
        if (ad.materialId && Array.isArray(ad.materialId) && ad.materialId.length > 0) {
          const materialIds: string[] = ad.materialId.map((material: any) => material.materialId);
          fetchDeviceNotifications(materialIds);
        }
      }, 5000); // Refresh every 5 seconds for real-time status

      // Cleanup interval on unmount
      return () => {
        clearInterval(refreshInterval);
      };
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
        // Handle real-time location updates (legacy)
        updateDeviceLocation(update.deviceId, update.location);
      } else if (update.type === 'adPlaybackUpdate' && update.gpsData) {
        // ✅ NEW: Extract GPS from playback updates (real-time - every 1-5 seconds)
        const locationData = {
          lat: update.gpsData.lat,
          lng: update.gpsData.lng,
          speed: update.gpsData.speed * 3.6, // Convert m/s to km/h
          heading: update.gpsData.heading,
          accuracy: update.gpsData.accuracy,
          timestamp: update.gpsData.timestamp,
          address: '', // Will be geocoded if needed
          isOnline: true // Device is online if sending playback updates
        };
        
        // Update device location in real-time
        updateDeviceLocation(update.deviceId, locationData);
        
        // Also update device online status
        updateDeviceStatus(update.deviceId, true, update.timestamp);
      } else if (String(update.type) === 'qrScanUpdate' || String(update.type) === 'qrScan') {
        // ✅ NEW: Handle QR scan updates from WebSocket
        console.log('📱 [QR Scan] Received QR scan update:', update);
        handleQRScanUpdate(update);
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

  // Helper function to check if a device is the master for its material
  const isMasterDevice = useCallback((deviceId: string): boolean => {
    // Find the material slot info that contains this deviceId
    const materialInfo = materialSlots.find(m => 
      m.slots.some(s => s.deviceId === deviceId)
    );
    
    if (!materialInfo) {
      // If we don't have slot info yet, assume it's a master (to avoid missing notifications)
      return true;
    }
    
    // Check if this device is the current master
    return materialInfo.masterDeviceId === deviceId;
  }, [materialSlots]);

  // Helper function to update device status in real-time
  const updateDeviceStatus = useCallback((deviceId: string, isOnline: boolean, lastSeen?: string) => {
    // Find matching materialId for this deviceId
    const matchingMaterial = materialSlots.find(m => 
      m.slots.some(s => s.deviceId === deviceId) || m.masterDeviceId === deviceId
    );
    const materialId = matchingMaterial?.materialId;
    
    const updateStatus = (prevLocations: DeviceLocation[]) => {
      return prevLocations.map(location => {
        // Match by deviceId (from WebSocket) or materialId (from polling)
        const isMatchingDevice = location.deviceId === deviceId || 
                                 location.materialId === deviceId ||
                                 (materialId && location.materialId === materialId);
        
        if (isMatchingDevice) {
          return {
            ...location,
            isOnline,
            lastSeen: lastSeen || location.lastSeen,
            source: (location as any).source || 'websocket' // Preserve source or mark as WebSocket
          };
        }
        return location;
      });
    };
    
    setDeviceLocations(updateStatus);
    setAllDeviceLocations(updateStatus);

    // ✅ MASTER DEVICE FILTER: Only create notifications for master devices
    if (!isMasterDevice(deviceId)) {
      console.log(`🔇 [Notification] Skipping notification for ${deviceId} - not a master device`);
      return;
    }

    console.log(`📢 [Notification] Creating notification for master device ${deviceId}`);

    // Add notification for device status change (ONLY for master devices)
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
  }, [deviceLocations, isMasterDevice, materialSlots]);

  // Helper function to update device location in real-time
  const updateDeviceLocation = useCallback((deviceId: string, locationData: any) => {
    if (!locationData || !locationData.lat || !locationData.lng) {
      return;
    }
    
    // ✅ TIMESTAMP VALIDATION: Only accept newer locations
    const newTimestamp = new Date(locationData.timestamp || new Date()).getTime();
    
    // Find matching materialId for this deviceId (WebSocket sends deviceId, but we store by materialId)
    const matchingMaterial = materialSlots.find(m => 
      m.slots.some(s => s.deviceId === deviceId) || m.masterDeviceId === deviceId
    );
    const materialId = matchingMaterial?.materialId;
    
    // Update both allDeviceLocations and deviceLocations
    const updateLocation = (prevLocations: DeviceLocation[]) => {
      return prevLocations.map(location => {
        // Match by deviceId (from WebSocket) or materialId (from polling)
        const isMatchingDevice = location.deviceId === deviceId || 
                                 location.materialId === deviceId ||
                                 (materialId && location.materialId === materialId);
        
        if (isMatchingDevice) {
          const currentTimestamp = location.timestamp 
            ? new Date(location.timestamp).getTime() 
            : 0;
          
          // Only update if new timestamp is newer
          if (newTimestamp <= currentTimestamp) {
            return location; // Keep existing location (it's newer)
          }
          
          return {
            ...location,
            lat: locationData.lat,
            lng: locationData.lng,
            address: locationData.address || location.address,
            timestamp: locationData.timestamp || new Date().toISOString(),
            isOnline: locationData.isOnline !== undefined ? locationData.isOnline : location.isOnline,
            lastSeen: locationData.timestamp || location.lastSeen,
            source: 'websocket' as const // Mark as WebSocket update
          };
        }
        return location;
      });
    };
    
    setDeviceLocations(updateLocation);
    setAllDeviceLocations(updateLocation);
    setLastUpdate(new Date());
  }, [materialSlots]);

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
  
  // ✅ NEW: Check for ad expiring soon notification
  useEffect(() => {
    if (!ad || !ad.endTime) return;
    
    const now = new Date();
    const endDate = new Date(ad.endTime);
    const daysUntilEnd = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    // Show notification if ad is ending within 2 days
    if (daysUntilEnd > 0 && daysUntilEnd <= 2) {
      // Check if we already have an expiring notification for this ad
      const existingExpiringNotification = deviceNotifications.find(n => 
        n.type === 'AD_EXPIRING_SOON' && 
        n.data?.adId === ad.id
      );
      
      if (!existingExpiringNotification) {
        console.log(`⏰ [Ad Expiring] Ad "${ad.title}" expires in ${daysUntilEnd} day(s)`);
        
        const message = daysUntilEnd === 1 
          ? `Your ad campaign "${ad.title}" will end tomorrow!`
          : `Your ad campaign "${ad.title}" will end in ${daysUntilEnd} days`;
        
        const notification: DeviceNotification = {
          id: `expiring-${ad.id}-${Date.now()}`,
          type: 'AD_EXPIRING_SOON',
          message,
          timestamp: new Date().toISOString(),
          materialId: '', // Not device-specific
          deviceId: '', // Not device-specific
          data: { adId: ad.id, daysUntilEnd },
          read: false,
          priority: 'HIGH'
        };
        
        setDeviceNotifications(prev => [notification, ...prev.slice(0, 49)]);
      }
    }
  }, [ad, deviceNotifications]);
  
  // State for active tab
  const [activeTab, setActiveTab] = useState<'Details' | 'AdActivity' | 'TabletActivity' | 'Analytics'>('Details');

  // Fetch analytics data for the ad (works for archived ads too)
  useEffect(() => {
    if (showAnalyticsTab && ad?.id && activeTab === 'Analytics') {
      const fetchAnalytics = async () => {
        setAnalyticsLoading(true);
        setAnalyticsError(null);
        try {
          const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace('/graphql', '').replace(/\/$/, '');
          const url = `${baseUrl}/api/adAnalytics/${ad.id}`;
          
          console.log('📊 Fetching analytics from:', url);
          const response = await fetch(url);
          
          // Try to parse JSON even if response is not ok to get the error message
          let result;
          try {
            result = await response.json();
          } catch (parseError) {
            // If JSON parsing fails, use status text
            throw new Error(`Failed to fetch analytics: ${response.statusText}`);
          }
          
          if (!response.ok) {
            throw new Error(result.message || `Failed to fetch analytics: ${response.statusText}`);
          }
          
          if (result.success && result.data) {
            setAnalyticsData(result.data);
            console.log('✅ Analytics data loaded:', {
              totalPlays: result.data.totalPlays,
              totalQRScans: result.data.totalQRScans,
              devices: result.data.devicePerformance?.length || 0,
              daily: result.data.dailyPerformance?.length || 0
            });
          } else {
            throw new Error(result.message || 'Failed to fetch analytics');
          }
        } catch (error: any) {
          console.error('Error fetching ad analytics:', error);
          setAnalyticsError(error.message || 'Failed to load analytics');
        } finally {
          setAnalyticsLoading(false);
        }
      };

      fetchAnalytics();
    }
  }, [showAnalyticsTab, ad?.id, activeTab]);
  
  // Ensure mobile active tab is valid for current status
  useEffect(() => {
    // Only switch away from Analytics tab if it's not available
    if (!showAnalyticsTab && activeTab === 'Analytics') {
      setActiveTab('Details');
      return;
    }
    // Only switch away from TabletActivity tab if it's not available
    if (!showDevicesTab && activeTab === 'TabletActivity') {
      // Switch to AdActivity if available, otherwise Details
      setActiveTab(isFullyPaidAndApproved ? 'AdActivity' : 'Details');
      return;
    }
  }, [showAnalyticsTab, showDevicesTab, activeTab, isFullyPaidAndApproved]);
  
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

  if (!ad) {
    return (
      <div className="relative flex-1 pl-60 p-6 h-screen flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-fixed blur-xl brightness-90"
          style={{
            backgroundImage: "url('/image/bg.jpg')",
          }}
        ></div>
  
        {/* Overlay Content */}
        <div className="relative z-10 text-center text-black/90 backdrop-blur-md">
          <h1 className="text-3xl font-bold mb-4">Ad Not Found</h1>
          <p className="mb-6 text-sm text-black/70 md:text-base">
            The advertisement you are looking for does not exist.
          </p>
          <button
            onClick={() => navigate('/advertisements')}
            className="text-black rounded-lg transition-colors flex items-center justify-center mx-auto"
          >
            <ChevronLeft size={20} className="mr-2" /> Back to Advertisements
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden lg:pl-72 px-4 sm:px-5 lg:pr-5 py-6 lg:p-5 pt-0 lg:pt-5">
    {/* Background Image */}
    <div
      className="fixed inset-0 bg-cover bg-center bg-no-repeat blur-sm brightness-90"
      style={{ backgroundImage: "url('/image/bg.jpg')" }}/>
    <div className="fixed inset-0 bg-white/40 backdrop-blur-xl" />

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
                  <div className="flex-shrink-0">
                    <XCircle size={20} className="text-red-500 mt-0.5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-black mb-1">
                      Advertisement Rejected
                    </h4>
                    <p className="text-sm text-black">
                      {ad.reasonForReject || 'Your advertisement has been rejected. Please contact support for more information.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeRejectionToast}
                  className="flex-shrink-0 ml-4 text-black/60 hover:text-red-600 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Archived Ad Banner - Show when ad is archived but still viewable */}
      <AnimatePresence>
        {ad?.isArchived && showArchivedBanner && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 max-w-2xl w-full mx-4"
          >
            <div className="bg-amber-50 border border-amber-200 rounded-lg shadow-lg p-4 flex items-start space-x-3">
              <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-amber-900 mb-1">
                  Advertisement Archived
                </h4>
                <p className="text-sm text-amber-800">
                  This advertisement has been deleted. You can still view its historical data and analytics, but it will be permanently removed after 30 days.
                  {ad.archivedAt && (
                    <span className="block mt-1 text-xs text-amber-700">
                      Archived on: {new Date(ad.archivedAt).toLocaleDateString()}
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setShowArchivedBanner(false)}
                className="flex-shrink-0 text-amber-600 hover:text-amber-800 transition-colors"
                aria-label="Dismiss banner"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    {/* Content Layer */}
    <div className="relative z-10 min-h-screen rounded-xl p-3 sm:p-5">
      {/* Mobile Header (hidden, actions moved near title) */}
      <div className="hidden lg:hidden" />

      {/* MOBILE VIEW */}
      <div className="block lg:hidden">
        {/* Media with back button overlay */}
        <div className="relative overflow-hidden bg-white/60 flex items-center justify-center h-72 mb-2">
          <button
            onClick={() => navigate('/advertisements')}
            className="absolute z-50 top-2 left-2 w-8 h-8 flex items-center justify-center rounded-md bg-white/80 text-black shadow"
            aria-label="Back"
          >
            <ChevronLeft size={18} />
          </button>
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
                Your browser does not support the video tag.
              </video>
            )
          ) : (
            <div className="text-black/90 text-sm">No Media Available</div>
          )}
        </div>

        {/* Title row with status and kebab */}
        <div className="flex items-start justify-between px-2 mb-2 p-2">
          <div>
            <h2 className="text-lg text-black/90 font-bold leading-tight">{ad.title}</h2>
            <p className="text-[13px] text-black/70"> ₱ {ad.price.toFixed(2)}</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-block text-[11px] font-semibold rounded px-2 py-1 ${
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
            <div className="relative">
              <button
                onClick={() => setShowMobileMenu((v) => !v)}
                className="p-1.5 rounded-md text-black/80"
                aria-label="More actions"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              <AnimatePresence>
                {showMobileMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-24 bg-white/90 backdrop-blur-md shadow-lg rounded-md border border-gray-200"
                  >
                    {/* Edit button — only visible when PENDING */}
                    {ad.status === 'PENDING' && (
                      <button
                        onClick={() => {
                          setShowEditModal(true);
                          setShowMobileMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-white/70 text-xs flex items-center gap-2"
                      >
                        <Edit className="w-4 h-4" /> Edit
                      </button>
                    )}

                    {/* Delete button — visible for PENDING, RUNNING, APPROVED, and SCHEDULED ads */}
                    <button
                      onClick={() => {
                        if (ad.status === 'PENDING' || ad.status === 'RUNNING' || ad.status === 'APPROVED' || ad.status === 'SCHEDULED') {
                          setShowDeleteModal(true);
                          setShowMobileMenu(false);
                        }
                      }}
                      disabled={!(ad.status === 'PENDING' || ad.status === 'RUNNING' || ad.status === 'APPROVED' || ad.status === 'SCHEDULED')}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 text-xs transition-colors duration-200
                        ${
                          ad.status === 'PENDING'
                            ? 'text-red-600 hover:bg-white/70 cursor-pointer'
                            : 'text-gray-400 cursor-not-allowed'
                        }`}
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>
        </div>


        {/* Tabs (status-aligned) */}
        <div className="flex items-center gap-3 text-[13px] px-1 mb-2">
          {/* Details Tab */}
          <div className="relative">
          <button
            onClick={() => setActiveTab('Details')}
              className={`relative px-1 py-1 font-medium transition-colors ${
                activeTab === 'Details' ? 'text-black/90 font-semibold' : 'text-black/70 hover:text-black/90'
              }`}
          >
            Details
              <motion.span
                className="absolute left-0 bottom-0 h-[2px] rounded-full"
                style={{ background: '#FF9D3D' }}
                initial={{ width: 0 }}
                animate={{ width: activeTab === 'Details' ? '100%' : 0 }}
                whileHover={{ width: '100%' }}
                transition={{ duration: 0.3 }}
              />
          </button>
          </div>

          {/* Device Tab (only if visible) */}
          {showDevicesTab && (
            <div className="relative">
            <button
              onClick={() => setActiveTab('TabletActivity')}
                className={`relative px-1 py-1 font-medium transition-colors ${
                  activeTab === 'TabletActivity' ? 'text-black/90 font-semibold' : 'text-black/70 hover:text-black/90'
                }`}
            >
              Device
                <motion.span
                  className="absolute left-0 bottom-0 h-[2px] rounded-full"
                  style={{ background: '#FF9D3D' }}
                  initial={{ width: 0 }}
                  animate={{ width: activeTab === 'TabletActivity' ? '100%' : 0 }}
                  whileHover={{ width: '100%' }}
                  transition={{ duration: 0.3 }}
                />
            </button>
            </div>
          )}

          {/* QR Scan Activity Tab (only if fully paid and approved) */}
          {isFullyPaidAndApproved && (
            <div className="relative">
            <button
              onClick={() => setActiveTab('AdActivity')}
                className={`relative px-1 py-1 font-medium transition-colors ${
                  activeTab === 'AdActivity' ? 'text-black/90 font-semibold' : 'text-black/70 hover:text-black/90'
                }`}
            >
              QR Scan Activity
                <motion.span
                  className="absolute left-0 bottom-0 h-[2px] rounded-full"
                  style={{ background: '#FF9D3D' }}
                  initial={{ width: 0 }}
                  animate={{ width: activeTab === 'AdActivity' ? '100%' : 0 }}
                  whileHover={{ width: '100%' }}
                  transition={{ duration: 0.3 }}
                />
            </button>
            </div>
          )}
        </div>


        {/* Details (mobile) */}
        {activeTab === 'Details' && (
          <div className="p-3 mb-20">
            <p className="text-black/80 text-[13px] leading-5 mb-4">{ad.description}</p>
            <table className="w-full text-xs text-black/80">
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
        )}

        {/* Analytics (mobile) */}
        {activeTab === 'Analytics' && showAnalyticsTab && (
          <div className="space-y-4 mb-20 p-3">
            {analyticsLoading ? (
              <div className="text-center bg-white/60 rounded-lg text-black/90 py-8">
                <RefreshCw className="w-10 h-10 mx-auto mb-3 text-gray-400 animate-spin" />
                <p className="text-base font-medium mb-1">Loading Analytics...</p>
                <p className="text-xs text-gray-600">Fetching historical data...</p>
              </div>
            ) : analyticsError ? (
              <div className="text-center bg-white/60 rounded-lg text-black/90 py-8">
                <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-red-400" />
                <p className="text-base font-medium mb-1 text-red-600">Error Loading Analytics</p>
                <p className="text-xs text-gray-600">{analyticsError}</p>
              </div>
            ) : analyticsData ? (
              <div className="space-y-4 bg-white/60 rounded-lg p-4 shadow-md">
                {/* Simple Text Display */}
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-black/80">Ads Play:</span>
                    <span className="font-semibold text-black">{analyticsData.totalPlays || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-black/80">Play Time:</span>
                    <span className="font-semibold text-black">
                      {analyticsData.totalPlayTime 
                        ? `${Math.floor(analyticsData.totalPlayTime / 3600)}h ${Math.floor((analyticsData.totalPlayTime % 3600) / 60)}m`
                        : '0h 0m'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-black/80">QR Scans:</span>
                    <span className="font-semibold text-black">{analyticsData.totalQRScans || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-black/80">Devices:</span>
                    <span className="font-semibold text-black">{analyticsData.devicePerformance?.length || 0}</span>
                  </div>
                </div>

                {/* Show message only if truly no data */}
                {(!analyticsData.totalPlays || analyticsData.totalPlays === 0) && 
                 (!analyticsData.totalQRScans || analyticsData.totalQRScans === 0) && (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-600">No analytics data available for this advertisement.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center bg-white/60 rounded-lg text-black/90 py-8">
                <p className="text-sm text-gray-600">No analytics data available for this advertisement.</p>
              </div>
            )}
          </div>
        )}

        {/* Activity (mobile) */}
        {activeTab === 'AdActivity' && (
          <div className="space-y-2 max-h-72 overflow-y-auto mb-20">
            <div className="flex items-center space-x-2 px-1">
              <div className={`w-2.5 h-2.5 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' : 
                connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
              }`}></div>
              <span className="text-xs text-gray-500">
                {connectionStatus === 'connected' ? 'Live' : 
                 connectionStatus === 'connecting' ? 'Connecting...' : 'Offline'}
              </span>
            </div>
            {deviceNotifications.length === 0 && qrImpressions.length === 0 && (
              <div className="text-center bg-white/60 rounded-lg text-black/90 py-8">
                <Activity className="w-10 h-10 mx-auto mb-3 text-gray-400" />
                <p className="text-base font-medium mb-1">No Activity Yet</p>
                <p className="text-xs text-gray-600">Device activity and QR scans will appear here.</p>
              </div>
            )}
            {deviceNotifications.map((notification) => (
              <div key={notification.id} className="flex items-start bg-white/60 space-x-3 p-3 shadow-md rounded-lg">
                <div className="flex-shrink-0 mt-0.5">
                  {notification.type === 'DEVICE_ONLINE' && <Wifi size={18} className="text-green-500" />}
                  {notification.type === 'DEVICE_OFFLINE' && <WifiOff size={18} className="text-red-500" />}
                  {notification.type === 'MILESTONE_ACHIEVED' && <Target size={18} className="text-blue-500" />}
                  {notification.type === 'QR_SCAN' && <QrCode size={18} className="text-purple-500" />}
                  {notification.type === 'DEVICE_ERROR' && <AlertTriangle size={18} className="text-orange-500" />}
                  {notification.type === 'AD_EXPIRING_SOON' && <Calendar size={18} className="text-yellow-600" />}
                </div>
                <div className="flex-1">
                  <p className="text-black/90 text-sm font-medium">{notification.message}</p>
                  <p className="text-black/70 text-xs">{new Date(notification.timestamp).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Device (mobile) */}
        {activeTab === 'TabletActivity' && (
          <div className="space-y-3 mb-20">
            {/* Device List (mobile) */}
            <div className="max-h-64 overflow-y-auto">
              {deviceLocations.map((location, index) => (
                <div key={location.deviceId} className="flex items-start space-x-2">
                  <div className="flex flex-col">
                    {location.address && location.address !== 'Location not available' && (
                      <p className="text-xs text-gray-500">{location.address}</p>
                    )}
                  </div>
                </div>
              ))}
              {deviceLocations.length === 0 && (
                <div className="text-center text-black/90 py-10">
                  <Activity className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p>No devices found for this ad.</p>
                  <p className="text-xs text-gray-500 mt-1">Devices will appear here when they come online.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bottom fixed Make Payment */}
        {shouldShowPaymentButton && (
          <div className="fixed bottom-4 left-0 right-0 px-4">
            <button
              onClick={() => { setSelectedPaymentType(""); setShowPaymentModal(true); }}
              className="w-full bg-[#3674B5] hover:bg-[#3674B5]/90 text-white py-3 rounded-md text-sm font-medium shadow"
            >
              Make Payment
            </button>
          </div>
        )}
      </div>

      {/* DESKTOP VIEW */}
      <button
        onClick={() => navigate('/advertisements')}
        className="py-2 text-black/90 rounded-lg hover:text-black/90 transition-colors flex items-center mb-4 hidden lg:flex"
      >
        <ChevronLeft size={20} className="mr-2" /> Back to Advertisements
      </button>

      {/* Top Row: Media (Left) + Info (Right) */}
      <div className="hidden lg:grid grid-cols-2 gap-8">
          {adStatus === 'PENDING' && (
            <div className="col-span-2">
              <div className="flex justify-end">
                <div className="flex items-center gap-2 rounded-full bg-yellow-100/90 px-4 py-2 text-sm font-medium text-yellow-800 shadow-sm">
                  <span className="inline-flex h-2 w-2 rounded-full bg-yellow-500 animate-pulse"></span>
                  <span>Your advertisement is under admin review</span>
                </div>
              </div>
            </div>
          )}

        {/* Left: Media */}
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
                Your browser does not support the video tag.
              </video>
            )
          ) : (
            <div className="text-black/90 text-xl">No Media Available</div>
          )}
        </div>

        {/* Right: Status, Title, Description, Price, Properties */}
        <div className="grid grid-cols-[1fr_auto] gap-4">
          {/* Main Content Column */}
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
            </div>

            <h2 className="text-4xl text-black/90 font-bold">{ad.title}</h2>
            <p className="text-2xl text-black/90 font-semibold mb-5"> ₱ {ad.price.toFixed(2)}</p>
            <p className="text-black/70">{ad.description}</p>
            
            {/* Timestamp Display */}
            <div className="mt-4 space-y-1 text-sm text-gray-500">
            <p className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Created: {new Date(ad.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
            {/* Only show "Edited" for PENDING ads (user can edit PENDING ads only) */}
            {ad.status === 'PENDING' && ad.updatedAt && new Date(ad.updatedAt).getTime() > new Date(ad.createdAt).getTime() && (
              <p className="flex items-center gap-2 text-orange-600">
                <RefreshCw className="w-4 h-4" />
                Edited: {new Date(ad.updatedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            )}
          </div>
          </div>

          {/* Buttons Column - Super small, designated for buttons only */}
          <div className="w-12 flex flex-col gap-2 items-start">
            {/* Edit Button - Only show when ad is PENDING */}
            {ad.status === 'PENDING' && (
              <button
                onClick={() => setShowEditModal(true)}
                className="w-10 h-10 rounded-full bg-white border border-gray-300 shadow-sm hover:shadow-md hover:bg-gray-50 transition-all duration-200 flex items-center justify-center"
                title="Edit"
              >
                <Edit className="w-4 h-4 text-gray-700" />
              </button>
            )}
            
            {/* Delete Button - Show for PENDING, RUNNING, APPROVED, and SCHEDULED ads */}
            {(ad.status === 'PENDING' || ad.status === 'RUNNING' || ad.status === 'APPROVED' || ad.status === 'SCHEDULED') && (
              <button
                onClick={() => setShowDeleteModal(true)}
                disabled={deleteLoading}
                className="w-10 h-10 rounded-full bg-white border border-gray-300 shadow-sm hover:shadow-md hover:bg-gray-50 transition-all duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                title="Delete"
              >
                <Trash2 className="w-4 h-4 text-red-700" />
              </button>
            )}
            
            {/* Make Payment Button - Only show when ad is APPROVED and payment is PENDING */}
            {shouldShowPaymentButton && (
              <button
                onClick={() => {
                  setSelectedPaymentType("");
                  setShowPaymentModal(true);
                }}
                className="w-10 h-10 rounded-full bg-white border border-gray-300 shadow-sm hover:shadow-md hover:bg-gray-50 transition-all duration-200 flex items-center justify-center"
                title="Make Payment"
              >
                <CreditCard className="w-4 h-4 text-gray-500" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: Left (Tablet Activity) + Right (Tabs + Delete) */}
      <div className="hidden lg:grid grid-cols-2 gap-8 pt-10">
        {/* Left: Tablet Activity - Only show if fully paid and approved */}
        {isFullyPaidAndApproved && (
          <div className="flex flex-col">
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* ---- Device List ---- */}
              <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-3">
                {deviceLocations.length > 0 ? (
                  deviceLocations.map((location, index) => (
                    <div key={location.deviceId} className="flex items-start space-x-2">
                      <div className="flex flex-col">
                        {location.address && location.address !== 'Location not available' && (
                          <p className="text-xs text-gray-500">{location.address}</p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10">
                    <Activity className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-xs text-gray-600">No devices found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Right: Tabs + Delete */}
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4 ">
            {/* Tabs */}
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
                    className="absolute left-0 bottom-0 h-1 rounded-full"
                    style={{
                      background: '#FF9D3D',
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: activeTab === 'Details' ? '100%' : 0 }}
                    whileHover={{ width: '100%' }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                </button>
              </div>
              
              {/* Only show QR Scan Activity tab if fully paid and approved */}
              {isFullyPaidAndApproved && (
                <div className="relative">
                  <button
                    onClick={() => setActiveTab('AdActivity')}
                    className={`whitespace-nowrap py-2 px-4 font-medium relative overflow-hidden ${
                      activeTab === 'AdActivity' ? 'text-black/80' : 'text-black/60 hover:text-black/90'
                    }`}
                  >
                    QR Scan Activity

                    {/* Hover underline with framer-motion */}
                    <motion.div
                      className="absolute left-0 bottom-0 h-1 rounded-full"
                      style={{
                        background: '#FF9D3D',
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: activeTab === 'AdActivity' ? '100%' : 0 }}
                      whileHover={{ width: '100%' }}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  </button>
                </div>
              )}

              {/* Analytics tab - Show for PAID ads (including archived) */}
              {showAnalyticsTab && (
                <div className="relative">
                  <button
                    onClick={() => setActiveTab('Analytics')}
                    className={`whitespace-nowrap py-2 px-4 font-medium relative overflow-hidden ${
                      activeTab === 'Analytics' ? 'text-black/80' : 'text-black/60 hover:text-black/90'
                    }`}
                  >
                    Analytics

                    {/* Hover underline with framer-motion */}
                    <motion.div
                      className="absolute left-0 bottom-0 h-1 rounded-full"
                      style={{
                        background: '#FF9D3D',
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: activeTab === 'Analytics' ? '100%' : 0 }}
                      whileHover={{ width: '100%' }}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'Details' && (
            <div className="space-y-6 min-h-[200px]">
              {/* TOP: Device Name + Status Badge */}
              <div className="flex items-center gap-3 w-full">
                <div className="flex items-center gap-2">
                  <span className="text-md font-medium text-gray-800">
                    {ad.materialId && Array.isArray(ad.materialId) && ad.materialId.length > 0
                      ? ad.materialId[0].materialId || 'N/A'
                      : 'No Device'}
                  </span>
              </div>

                {/* Show status only if fully paid & approved */}
                {isFullyPaidAndApproved && ad.materialId && Array.isArray(ad.materialId) && ad.materialId.length > 0 && (
                  (() => {
                    const firstMaterial = ad.materialId[0];
                    const device = allDeviceLocations.find(loc => loc.materialId === firstMaterial.materialId);
                    const isOnline = device?.isOnline || false;

                    return (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                          isOnline
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        <span className="relative flex h-2 w-2">
                          <span
                            className={`absolute inline-flex h-full w-full rounded-full ${
                              isOnline ? 'animate-ping bg-green-400 opacity-75' : 'bg-red-400'
                            }`}
                          ></span>
                          <span
                            className={`relative inline-flex h-2 w-2 rounded-full ${
                              isOnline ? 'bg-green-500' : 'bg-red-500'
                            }`}
                          ></span>
                        </span>
                        {isOnline ? 'Online' : 'Offline'}
                      </span>
                    );
                  })()
                )}

                {paymentStatus === 'PAID' && (
                  <div
                    className="relative ml-auto"
                    onMouseEnter={() => setShowPaymentTooltip(true)}
                    onMouseLeave={() => setShowPaymentTooltip(false)}
                  >
                    <button
                      type="button"
                      onClick={() => setShowPaymentTooltip((prev) => !prev)}
                      onFocus={() => setShowPaymentTooltip(true)}
                      onBlur={() => setShowPaymentTooltip(false)}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-white/70 shadow hover:shadow-md transition"
                      aria-label="View payment information"
                    >
                      <WalletCards className="h-4 w-4 text-gray-700" />
                    </button>

                    {showPaymentTooltip && (
                      <div className="absolute right-0 top-10 z-50 w-64 rounded-lg border border-white/80 bg-white/95 p-3 text-left shadow-xl">
                        <p className="text-xs font-semibold text-gray-800 mb-2">Payment Details</p>
                        <div className="space-y-1 text-xs text-gray-600">
                          <div className="flex justify-between">
                            <span>Method</span>
                            <span className="font-medium text-gray-800">
                              {paymentDetails?.paymentType || 'N/A'}
                              </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Receipt ID</span>
                            <span className="font-medium text-gray-800">
                              {paymentDetails?.receiptId || 'N/A'}
                                    </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Status</span>
                            <span className="font-semibold text-green-500">
                              {(paymentDetails?.paymentStatus || paymentStatus || 'N/A').toString().toUpperCase()}
                                    </span>
                          </div>
                        </div>
                      </div>
                                  )}
                  </div>
                              )}
                            </div>

              {/* MIDDLE: Start Date | End Date | Duration */}
              <div className="grid grid-cols-3 gap-6 text-center">
                <div>
                  <p className="mt-1 text-md text-black">
                    {formatDate(ad.startTime)}
                  </p>
                  <p className="text-xs text-gray-600">Start Date</p>

                      </div>
                <div>
                  <p className="mt-1 text-md text-black">
                    {formatDate(ad.endTime)}
                  </p>
                  <p className="text-xs text-gray-600">End Date</p>

                </div>
                <div>
                  <p className="mt-1 text-md text-black">
                    {calculateDuration(ad.startTime, ad.endTime)} days
                  </p>
                  <p className="text-xs text-gray-600">Duration</p>

                  </div>
                </div>

              {/* BOTTOM: Format | Runtime */}
              <div className="grid grid-cols-3 gap-6 text-center">
                <div>
                  <p className="mt-1 text-md text-black">
                    {ad.adFormat || 'N/A'}
                  </p>
                  <p className="text-xs text-gray-600">Format</p>

                </div>
                <div>
                  <p className="mt-1 text-md text-black">
                    {ad.adLengthSeconds ? `${ad.adLengthSeconds} seconds` : 'N/A'}
                  </p>
                  <p className="text-xs text-gray-600">Runtime</p>

                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'AdActivity' && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {/* Device Notifications */}
              {deviceNotifications.map((notification) => (
                <div key={notification.id} className="flex items-start bg-white/60 space-x-3  mr-3 shadow-md rounded-lg">
                  <div className="flex-shrink-0 mt-0.5">
                    {notification.type === 'DEVICE_ONLINE' && <Wifi size={20} className="text-green-500" />}
                    {notification.type === 'DEVICE_OFFLINE' && <WifiOff size={20} className="text-red-500" />}
                    {notification.type === 'MILESTONE_ACHIEVED' && <Target size={20} className="text-blue-500" />}
                    {notification.type === 'QR_SCAN' && <QrCode size={20} className="text-purple-500" />}
                    {notification.type === 'DEVICE_ERROR' && <AlertTriangle size={20} className="text-orange-500" />}
                    {notification.type === 'AD_EXPIRING_SOON' && <Calendar size={20} className="text-yellow-600" />}
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
                <div>
                  {qrImpressions.map((impression, index) => (
                    <div key={`${impression.id}-${index}`} className="flex items-start bg-white/60 space-x-3 p-3 mr-3 shadow-md rounded-lg mb-2">
                      <QrCode size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-black/90 text-sm font-medium">
                          QR code scanned from {impression.materialId || 'Unknown Device'}
                        </p>
                        <p className="text-black/70 text-xs">
                          {new Date(impression.timestamp).toLocaleString()}
                          {impression.location && (impression.location.address || (impression.location.lat && impression.location.lng)) && (
                            <span className="ml-2 text-gray-500">
                              • {impression.location.address || `GPS: ${impression.location.lat.toFixed(4)}, ${impression.location.lng.toFixed(4)}`}
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

          {/* Analytics Tab Content (Desktop) */}
          {activeTab === 'Analytics' && showAnalyticsTab && (
            <div className="space-y-4 bg-white/60 rounded-lg p-6 shadow-md">
              {analyticsLoading ? (
                <div className="text-center py-12">
                  <RefreshCw className="w-12 h-12 mx-auto mb-4 text-gray-400 animate-spin" />
                  <p className="text-lg font-medium mb-2">Loading Analytics...</p>
                  <p className="text-sm text-gray-600">Fetching historical data...</p>
                </div>
              ) : analyticsError ? (
                <div className="text-center py-12">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-400" />
                  <p className="text-lg font-medium mb-2 text-red-600">Error Loading Analytics</p>
                  <p className="text-sm text-gray-600">{analyticsError}</p>
                </div>
              ) : analyticsData ? (
                <div className="space-y-6">
                  {/* Simple Text Display */}
                  <div className="space-y-4 text-base">
                    <div className="flex justify-between items-center">
                      <span className="text-black/80">Ads Play:</span>
                      <span className="font-semibold text-black">{analyticsData.totalPlays || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-black/80">Play Time:</span>
                      <span className="font-semibold text-black">
                        {analyticsData.totalPlayTime 
                          ? `${Math.floor(analyticsData.totalPlayTime / 3600)}h ${Math.floor((analyticsData.totalPlayTime % 3600) / 60)}m`
                          : '0h 0m'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-black/80">QR Scans:</span>
                      <span className="font-semibold text-black">{analyticsData.totalQRScans || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-black/80">Devices:</span>
                      <span className="font-semibold text-black">{analyticsData.devicePerformance?.length || 0}</span>
                    </div>
                  </div>

                  {/* Show message only if truly no data */}
                  {(!analyticsData.totalPlays || analyticsData.totalPlays === 0) && 
                   (!analyticsData.totalQRScans || analyticsData.totalQRScans === 0) && (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-600">No analytics data available for this advertisement.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-sm text-gray-600">No analytics data available for this advertisement.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title="Delete Advertisement"
        message={
          ad?.status === 'RUNNING' || ad?.status === 'APPROVED' || ad?.status === 'SCHEDULED'
            ? "Are you sure you want to delete this running advertisement? This action cannot be undone and the ad will be immediately removed from all devices. No refund will be issued."
            : "Are you sure you want to delete this advertisement? This action cannot be undone."
        }
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
        requireTitleConfirmation={true}
        confirmationTitle={ad?.title || ''}
        requireReason={true}
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
            // Refresh the ad data to show updated payment status
            refetch();
          }}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && ad && (
        <EditAdModal
          ad={ad}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            console.log('Ad updated successfully, refetching ads...');
            refetch();
          }}
        />
      )}

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  </div>
);
};

export default AdDetailsPage;

