// src/pages/AdDetailsPage.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@apollo/client';
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
  Trash2
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
  
  // ✅ OPTIMIZATION: Use shared hook (static variant - fetches once, then uses cache)
  // Removed inline query definition, now imports from centralized location
  const { loading, error, data, refetch } = useMyAdsStatic();

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

  const confirmDelete = () => {
    if (ad && ad.status === 'PENDING') {
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
  // Mobile tab visibility rules by status - Analytics only shows for PAID ads
  const showAnalyticsTab = paymentStatus === 'PAID' && (adStatus === 'APPROVED' || adStatus === 'RUNNING');
  const showDevicesTab = adStatus === 'RUNNING';
  
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
      const newOptions = [`All Materials (${materials.length} total)`, ...materialOptions];
      
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
          const allLocations: DeviceLocation[] = relevantScreens.map((screen: any) => ({
            deviceId: screen.materialId,
            materialId: screen.materialId,
            lat: screen.currentLocation?.lat || 0,
            lng: screen.currentLocation?.lng || 0,
            address: screen.currentLocation?.address || 'Location not available',
            timestamp: screen.lastSeen,
            isOnline: screen.isOnline,
            lastSeen: screen.lastSeen,
            totalDistance: screen.totalDistance || 0,
            currentHours: screen.totalHours || 0
          }));
          
          // ✅ For MAP display only: filter out devices with invalid GPS coordinates
          const locationsWithValidGPS: DeviceLocation[] = allLocations.filter((loc) => {
            const hasValidLocation = loc.lat !== 0 && loc.lng !== 0;
            if (!hasValidLocation) {
              console.log(`⚠️ [AdDetailsPage] ${loc.materialId} has no valid GPS - will show status but not on map`);
            }
            return hasValidLocation;
          });
          
          console.log(`📊 [AdDetailsPage] ${allLocations.length} total devices (${locationsWithValidGPS.length} with valid GPS for map)`);
          
          // Use ALL locations for status display (Details tab)
          setAllDeviceLocations(allLocations);
          // Use filtered locations for map display only
          setDeviceLocations(locationsWithValidGPS);
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
  }, [deviceLocations, isMasterDevice]);

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
  
  // Ensure mobile active tab is valid for current status
  useEffect(() => {
    if (!showAnalyticsTab && activeTab === 'AdActivity') {
      setActiveTab('Details');
      return;
    }
    if (!showDevicesTab && activeTab === 'TabletActivity') {
      setActiveTab(showAnalyticsTab ? 'AdActivity' : 'Details');
      return;
    }
  }, [showAnalyticsTab, showDevicesTab, activeTab]);
  
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
                      {ad.reasonForReject}
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
            <p className="text-[13px] text-black/70">${ad.price.toFixed(2)}</p>
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

                    {/* Delete button — always visible, but disabled if not PENDING */}
                    <button
                      onClick={() => {
                        if (ad.status === 'PENDING') {
                          setShowDeleteModal(true);
                          setShowMobileMenu(false);
                        }
                      }}
                      disabled={ad.status !== 'PENDING'}
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
          <button
            onClick={() => setActiveTab('Details')}
            className={`px-1 py-1 ${activeTab === 'Details' ? 'text-black/90 font-semibold underline' : 'text-black/70'}`}
          >
            Details
          </button>
          {showAnalyticsTab && (
            <button
              onClick={() => navigate(`/detailed-analytics?adId=${id}`)}
              className={`px-1 py-1 text-black/70`}
            >
              Analytics
            </button>
          )}
          {showDevicesTab && (
            <button
              onClick={() => setActiveTab('TabletActivity')}
              className={`px-1 py-1 ${activeTab === 'TabletActivity' ? 'text-black/90 font-semibold underline' : 'text-black/70'}`}
            >
              Device
            </button>
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
            <div className="w-full h-56 rounded-lg overflow-hidden shadow border border-gray-200">
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
                            width: 24px !important; 
                            height: 24px !important; 
                            background-color: ${location.isOnline ? '#22c55e' : '#ef4444'} !important; 
                            border: 2px solid ${location.isOnline ? '#16a34a' : '#dc2626'} !important; 
                            border-radius: 50% !important; 
                            box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
                            display: flex !important;
                            align-items: center !important;
                            justify-content: center !important;
                            font-size: 14px !important;
                            cursor: pointer !important;
                          ">
                            <span style="filter: drop-shadow(0 1px 1px rgba(0,0,0,0.3)) !important;">🚗</span>
                          </div>
                        `,
                        className: 'custom-vehicle-icon',
                        iconSize: [24, 24],
                        iconAnchor: [12, 12],
                        popupAnchor: [0, -12]
                      })}
                    >
                      <Popup maxWidth={240} maxHeight={260}>
                        <div className="p-2 space-y-1 max-w-xs">
                          <div className="border-b pb-1">
                            <h3 className="text-xs font-semibold text-gray-900 flex items-center gap-2">
                              <span className="text-base">🚗</span>
                              Device {location.deviceId.slice(-4)}
                            </h3>
                          </div>
                          <div className="space-y-0.5 text-[11px]">
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
                    <MapPin className="w-6 h-6 mx-auto mb-1 text-gray-400" />
                    <p className="text-xs text-gray-600">No devices found</p>
                    <p className="text-[11px] text-gray-500">Devices will appear when online</p>
                  </div>
                </div>
              )}
            </div>
            {/* Material Selection Dropdown (mobile) */}
            <div className="relative w-full dropdown-container">
              <button
                onClick={() => setShowAdDropdown(!showAdDropdown)}
                className="flex items-center rounded-md justify-between w-full text-xs text-black px-4 py-3 shadow-md focus:outline-none bg-white/60 backdrop-blur-md gap-2"
              >
                <div className="flex flex-col items-start">
                  <div className="font-medium">
                    {selectedMaterialId 
                      ? selectedMaterialId
                      : ad?.materialId && Array.isArray(ad.materialId) && ad.materialId.length > 0
                        ? 'All Materials'
                        : 'No Material'}
                  </div>
                  <div className="text-gray-500 text-xs">
                    {selectedMaterialId
                      ? (() => {
                          const material = ad?.materialId?.find((m: any) => m.materialId === selectedMaterialId);
                          return material ? `(${material.materialType || 'Unknown Type'})` : '';
                        })()
                      : ad?.materialId && Array.isArray(ad.materialId) && ad.materialId.length > 0
                        ? `(${ad.materialId.length} locations)`
                        : '(Unknown Type)'}
                  </div>
                </div>
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
                    className="absolute z-50 top-full mt-2 w-full shadow-lg bg-white/90 rounded-md backdrop-blur-md overflow-hidden border border-gray-200"
                  >
                    {adOptions.map((adOption, index) => {
                      const materialId = index === 0 
                        ? null 
                        : ad?.materialId && Array.isArray(ad.materialId) && ad.materialId[index - 1] 
                          ? ad.materialId[index - 1].materialId 
                          : null;
                      return (
                        <button
                          key={adOption}
                          onClick={() => {
                            setSelectedAd(adOption);
                            setSelectedMaterialId(materialId);
                            setShowAdDropdown(false);
                          }}
                          className={`block w-full text-left px-4 py-2 text-xs transition-colors duration-150 ${
                            (index === 0 && !selectedMaterialId) || materialId === selectedMaterialId
                              ? 'bg-blue-50 text-blue-700 font-medium'
                              : 'text-gray-700 hover:bg-white/60'
                          }`}
                        >
                          {adOption}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Device List (mobile) */}
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
            
            {/* Edit Button - Only show when ad is PENDING */}
            {ad.status === 'PENDING' && (
              <button
                onClick={() => setShowEditModal(true)}
                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Edit Ad
              </button>
            )}
            
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
      </div>

      {/* Bottom Row: Left (Tabs + Delete) + Right (Tablet Activity) */}
      <div className="hidden lg:grid grid-cols-2 gap-8 pt-10">
        {/* Left: Tabs + Delete */}
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
                    className="absolute left-0 bottom-0 h-1 bg-gradient-to-r from-orange-400 to-orange-700 rounded-full"
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
                      className="absolute left-0 bottom-0 h-1 bg-gradient-to-r from-orange-400 to-orange-700 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: activeTab === 'AdActivity' ? '100%' : 0 }}
                      whileHover={{ width: '100%' }}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  </button>
                </div>
              )}
              
              {/* Analytics button - show only if paid and approved/running */}
              {showAnalyticsTab && (
                <div className="relative">
                  <button
                    onClick={() => navigate(`/detailed-analytics?adId=${id}`)}
                    className="whitespace-nowrap py-2 px-4 font-medium relative overflow-hidden text-black/60 hover:text-black/90"
                  >
                    Analytics

                    {/* Hover underline with framer-motion */}
                    <motion.div
                      className="absolute left-0 bottom-0 h-1 bg-gradient-to-r from-orange-400 to-orange-700 rounded-full"
                      initial={{ width: 0 }}
                      whileHover={{ width: '100%' }}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  </button>
                </div>
              )}
            </div>

            {/* Delete Button - Only show if pending */}
            {ad?.status === 'PENDING' && (
              <button
                onClick={() => setShowDeleteModal(true)}
                disabled={deleteLoading}
                className="px-4 py-2 bg-red-200 text-red-600 rounded-lg font-semibold hover:bg-red-300 hover:text-white/80 disabled:cursor-not-allowed"
              >
                {deleteLoading ? 'Deleting...' : 'Delete Ad'}
              </button>
            )}
          </div>

          {/* Tab Content */}
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
                    <p className="text-sm font-semibold text-black/90 mb-2">
                      {isFullyPaidAndApproved ? 'Devices:' : 'Initial Devices:'}
                    </p>
                    {ad.materialId && Array.isArray(ad.materialId) && ad.materialId.length > 0 ? (
                      <div className="space-y-1">
                        {ad.materialId.map((material: any, index: number) => {
                          // Only show device status for fully paid and approved ads
                          const shouldShowStatus = isFullyPaidAndApproved;
                          
                          // Find the online status for this material from ALL locations (not just those with GPS)
                          const deviceLocation = allDeviceLocations.find(
                            (loc) => loc.materialId === material.materialId
                          );
                          
                          const isOnline = deviceLocation?.isOnline || false;
                          const lastSeen = deviceLocation?.lastSeen;
                          
                          // Format last seen time
                          const getLastSeenText = () => {
                            if (!lastSeen) return 'Unknown';
                            const now = new Date();
                            const lastSeenDate = new Date(lastSeen);
                            const diffMs = now.getTime() - lastSeenDate.getTime();
                            const diffMins = Math.floor(diffMs / 60000);
                            
                            if (diffMins < 1) return 'Just now';
                            if (diffMins < 60) return `${diffMins}m ago`;
                            const diffHours = Math.floor(diffMins / 60);
                            if (diffHours < 24) return `${diffHours}h ago`;
                            return `${Math.floor(diffHours / 24)}d ago`;
                          };
                          
                          return (
                            <div 
                              key={material.id || index} 
                              className="text-sm flex items-center justify-end space-x-2"
                              title={shouldShowStatus ? (isOnline ? 'Online' : `Offline - Last seen: ${getLastSeenText()}`) : 'Initial device assignment (subject to change)'}
                            >
                              <span className="text-black/70">
                                🚗 {material.materialId || 'N/A'}
                              </span>
                              {/* Only show online/offline status for fully paid and approved ads */}
                              {shouldShowStatus && (
                                <>
                                  {isOnline ? (
                                    <span className="flex items-center text-green-600 font-medium">
                                      <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
                                      Online
                                    </span>
                                  ) : (
                                    <span className="flex items-center text-red-600 font-medium">
                                      <span className="w-2 h-2 bg-red-500 rounded-full mr-1"></span>
                                      Offline
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-black/70">No devices assigned</p>
                    )}
                  </div>
                </div>

                {/* Lower right: Duration, Format */}
                <div className="flex flex-col items-end space-y-2 mt-4">
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
                <div className="mt-4">
                  <h4 className="text-md font-semibold text-gray-800 mb-2">QR Code Scans</h4>
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
                      {selectedMaterialId 
                        ? selectedMaterialId
                        : ad?.materialId && Array.isArray(ad.materialId) && ad.materialId.length > 0
                          ? 'All Materials'
                          : 'No Material'}
                    </div>
                    <div className="text-gray-500 text-xs">
                      {selectedMaterialId
                        ? (() => {
                            const material = ad?.materialId?.find((m: any) => m.materialId === selectedMaterialId);
                            return material ? `(${material.materialType || 'Unknown Type'})` : '';
                          })()
                        : ad?.materialId && Array.isArray(ad.materialId) && ad.materialId.length > 0
                          ? `(${ad.materialId.length} locations)`
                          : '(Unknown Type)'}
                    </div>
                  </div>
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
                      className="absolute z-50 top-full mt-2 w-full shadow-lg bg-white/90 rounded-md backdrop-blur-md overflow-hidden border border-gray-200"
                    >
                      {adOptions.map((adOption, index) => {
                        // First option is "All Materials" (index 0), rest are individual materials
                        // Material array is offset by 1 because of "All Materials" option
                        const materialId = index === 0 
                          ? null // "All Materials" option
                          : ad?.materialId && Array.isArray(ad.materialId) && ad.materialId[index - 1] 
                            ? ad.materialId[index - 1].materialId 
                            : null;
                        
                        return (
                          <button
                            key={adOption}
                            onClick={() => {
                              setSelectedAd(adOption);
                              setSelectedMaterialId(materialId); // null for "All Materials", specific ID for individual materials
                              setShowAdDropdown(false);
                            }}
                            className={`block w-full text-left px-4 py-2 ml-2 text-xs transition-colors duration-150 ${
                              (index === 0 && !selectedMaterialId) || materialId === selectedMaterialId
                                ? 'bg-blue-50 text-blue-700 font-medium'
                                : 'text-gray-700 hover:bg-white/60'
                            }`}
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
