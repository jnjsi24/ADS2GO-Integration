import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  AlertTriangle, 
  Lock, 
  Unlock,
  BarChart3,
  Monitor,
  AlertCircle,
  XCircle,
  PlayCircle,
  Loader2
} from 'lucide-react';
// Icons are imported individually to avoid unused imports
import { ScreenData, AdAnalytics } from '../../types/screenTypes';
import { adsPanelService } from '../../services/adsPanelService';
import playbackWebSocketService from '../../services/playbackWebSocketService';
import { useApolloClient } from '@apollo/client';
import { createGraphQLService } from '../../services/graphQLService';
// Note: screenComplianceService available for future optimization
// import { screenComplianceService } from '../../services/screenComplianceService';

// Import tab components
import Dashboard from './tabs/dashboard/Dashboard';
import { AdminLoader } from "../../components/ProtectedRoute";

// ✨ OPTIMIZATION: Lazy load NotificationDashboard to speed up initial page load
const NotificationDashboard = React.lazy(() => import('./tabs/dashboard/NotificationDashboard'));

const AdminAdsControl: React.FC = () => {
  // Component loaded
  
  // Initialize GraphQL service
  const apolloClient = useApolloClient();
  const graphQLService = createGraphQLService(apolloClient);
  
  const [selectedScreens, setSelectedScreens] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedScreen, setSelectedScreen] = useState<string | null>(null);
  
  // Read URL parameters to set initial tab
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam && ['dashboard', 'notifications'].includes(tabParam)) {
      setActiveTab(tabParam);
      console.log('🔗 URL tab parameter detected:', tabParam, 'Switching to tab:', tabParam);
    }
  }, []);
  
  // Real data states
  const [screens, setScreens] = useState<ScreenData[]>([]);
  const [adAnalytics, setAdAnalytics] = useState<AdAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Removed excessive debug logging
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isCurrentlyPlaying, setIsCurrentlyPlaying] = useState(true); // Default to true since ads play automatically
  const [isLocked, setIsLocked] = useState(false); // Track lock/unlock state
  const [devicePlayStates, setDevicePlayStates] = useState<Record<string, boolean>>({}); // Track individual device play states - default to true (playing) since ads auto-play
  const [deviceLockStates, setDeviceLockStates] = useState<Record<string, boolean>>({}); // Track individual device lock states
  const [isUserControlling, setIsUserControlling] = useState(false); // Track if user is actively controlling devices
  const [showScreenDetails, setShowScreenDetails] = useState(false);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [selectedDeviceForModal, setSelectedDeviceForModal] = useState<ScreenData | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  
  // Use adAnalytics for future features (suppress warning)
  React.useEffect(() => { void adAnalytics; void analyticsLoading; }, [adAnalytics, analyticsLoading]);
  
  // Use ref for hasInitiallyLoaded in interval to avoid recreating interval
  const hasInitiallyLoadedRef = React.useRef(false);
  React.useEffect(() => {
    hasInitiallyLoadedRef.current = hasInitiallyLoaded;
  }, [hasInitiallyLoaded]);
  
  // Use ref for isUserControlling to avoid recreating the main useEffect
  const isUserControllingRef = useRef(false);
  useEffect(() => {
    isUserControllingRef.current = isUserControlling;
  }, [isUserControlling]);

  // Responsive state
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      setSidebarCollapsed(width >= 768 && width < 1024);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // REST API service for all API operations (using compliance endpoint for real-time data)
  const apiService = adsPanelService;

  // Data fetching functions - only for initial load and manual refresh
  const fetchData = useCallback(async (isManualRefresh = false) => {
    const isInitialLoad = !hasInitiallyLoaded;
    
    try {
      if (isManualRefresh) {
        console.log('🔄 Manual refresh - setting refreshing state');
        setIsRefreshing(true);
        setError(null);
      } else if (isInitialLoad) {
        console.log('🔄 Initial load - setting loading state');
        setLoading(true);
      }
      
      console.log('🔄 Fetching data from server...');
      console.log('🔍 isInitialLoad:', isInitialLoad, 'hasInitiallyLoaded:', hasInitiallyLoaded);
      
        const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace('/graphql', '').replace(/\/$/, '');
      // ✨ OPTIMIZATION: Skip geocoding on initial load to speed up response (addresses can load later)
      const skipGeocoding = isInitialLoad ? '&skipGeocoding=true' : '';
      const complianceUrl = `${baseUrl}/screenTracking/compliance?date=${new Date().toISOString().split('T')[0]}${skipGeocoding}`;
      
      console.log('🌐 Compliance URL:', complianceUrl);
      console.log('📍 Skip geocoding:', isInitialLoad ? 'YES (initial load)' : 'NO (refresh)');
      
      const fetchStartTime = Date.now();
      console.log('⏱️ Starting fetch at:', new Date().toISOString());
      
      // ✨ OPTIMIZATION: Fetch compliance and analytics in parallel
      let timeoutId: NodeJS.Timeout | null = null;
      
      const [complianceResult, analyticsResult] = await Promise.allSettled([
        // Fetch screens data using compliance endpoint for real-time status
        // Add 60-second timeout for compliance endpoint (it can be slow on first load)
        Promise.race([
          fetch(complianceUrl, {
          headers: {
            'Content-Type': 'application/json'
          }
          }).then(async res => {
            const fetchDuration = Date.now() - fetchStartTime;
            console.log(`📡 Compliance response received after ${fetchDuration}ms (${(fetchDuration/1000).toFixed(2)}s)!`);
            console.log('📡 Response status:', res.status);
            console.log('📡 Response ok:', res.ok);
            console.log('📡 Response headers:', {
              contentType: res.headers.get('content-type'),
              contentLength: res.headers.get('content-length')
            });
            
            // Clear timeout on successful response
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            
            if (!res.ok) {
              const errorText = await res.text();
              console.error('❌ Response error body:', errorText);
              return Promise.reject(new Error(`HTTP ${res.status}: ${errorText}`));
            }
            
            const jsonData = await res.json();
            console.log('✅ Compliance JSON parsed successfully');
            return jsonData;
          }),
          new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
              console.log('⏱️ Compliance request timed out after 90 seconds (non-critical, will retry)');
              reject(new Error('Compliance request timeout (90s)'));
            }, 90000);
          })
        ]),
        
        // Fetch analytics in parallel (don't block UI)
        (async () => {
          setAnalyticsLoading(true);
          try {
            console.log('🔄 Fetching analytics in parallel...');
            return await apiService.getAdAnalytics();
          } finally {
            setAnalyticsLoading(false);
          }
        })()
      ]);
      
      // Process compliance data (priority - show UI immediately)
      if (complianceResult.status === 'fulfilled') {
        const complianceData = complianceResult.value;
          console.log('📊 Compliance data received:', complianceData);
        console.log('📊 Compliance data structure:', {
          hasData: !!complianceData,
          hasDataProperty: !!complianceData?.data,
          hasScreens: !!complianceData?.data?.screens,
          screensIsArray: Array.isArray(complianceData?.data?.screens),
          screensLength: complianceData?.data?.screens?.length
        });
          
          if (complianceData && complianceData.data && Array.isArray(complianceData.data.screens)) {
            console.log(`✅ Found ${complianceData.data.screens.length} screens with real-time status`);
            
            // Process the screens data to create consolidated entries (one per device)
            const processedScreens = complianceData.data.screens.map((screen: any) => {
              // Create consolidated entry with slot status information
              if (screen.slotStatus && (screen.slotStatus.slot1 || screen.slotStatus.slot2)) {
                // Determine overall online status (at least one slot online)
                const hasOnlineSlot = (screen.slotStatus.slot1?.online || false) || (screen.slotStatus.slot2?.online || false);
                
                // Create status text showing both slots
                const slot1Status = screen.slotStatus.slot1?.online ? 'ONLINE' : 'OFFLINE';
                const slot2Status = screen.slotStatus.slot2?.online ? 'ONLINE' : 'OFFLINE';
                const statusText = `${slot1Status} | ${slot2Status}`;
                
                return {
                  ...screen,
                  deviceId: screen.materialId, // Use materialId as deviceId for consolidated view
                  displayId: screen.materialId,
                  slotNumber: 'Consolidated', // Show as consolidated
                  isOnline: hasOnlineSlot, // Overall online status
                  statusText: statusText,
                  slot1Status: slot1Status,
                  slot2Status: slot2Status,
                  slotStatus: screen.slotStatus, // Keep original slot status for reference
                  // Store actual deviceIds for control commands
                  slot1DeviceId: screen.slotStatus.slot1?.deviceId,
                  slot2DeviceId: screen.slotStatus.slot2?.deviceId
                };
              } else {
                // Single device without slots
                return {
                  ...screen,
                  displayId: screen.displayId || screen.deviceId,
                  slotNumber: screen.slotNumber || 1,
                  statusText: screen.statusText || (screen.isOnline ? 'ONLINE' : 'OFFLINE')
                };
              }
            });
            
            setScreens(processedScreens);
            
            // Log all device IDs for debugging
            console.log('📋 Processed Device IDs:', processedScreens.map((s: any) => ({
              deviceId: s.deviceId,
              materialId: s.materialId,
              slotNumber: s.slotNumber,
              isOnline: s.isOnline,
              statusText: s.statusText,
              lastSeen: s.lastSeen,
              screenMetrics: s.screenMetrics,
              currentAd: s.screenMetrics?.currentAd
            })));
            
            // Initial load complete - current ad info available in screenMetrics
          } else {
            console.warn('⚠️ Unexpected compliance data format:', complianceData);
            setScreens([]);
          }
        } else {
          // Check if it's a timeout error - these are expected and non-critical
          if (complianceResult.reason?.message?.includes('timeout')) {
            console.log('⏱️ Compliance request timed out (non-critical, will retry on next refresh)');
          } else {
            console.error('❌ Error fetching compliance data:', complianceResult.reason);
            console.error('❌ Compliance result status:', complianceResult.status);
            console.error('❌ Full compliance result:', complianceResult);
          }
          setScreens([]);
        }
      
      // ✨ OPTIMIZATION: Show UI now, analytics loads in background
      if (isInitialLoad) {
        console.log('⚡ Setting loading to false - UI ready with compliance data');
        setLoading(false);
        setHasInitiallyLoaded(true);
      }
      
      // Process analytics data (non-blocking)
      if (analyticsResult.status === 'fulfilled') {
        console.log('📊 Analytics data received');
        setAdAnalytics(analyticsResult.value);
      } else {
        // Handle timeout errors specifically - they're expected and non-critical
        if (analyticsResult.reason instanceof Error && 
            (analyticsResult.reason.name === 'TimeoutError' || analyticsResult.reason.message?.includes('timed out'))) {
          console.log('⏱️ Analytics request timed out (non-critical, will retry on next refresh)');
        } else {
          console.error('❌ Error fetching analytics:', analyticsResult.reason);
        }
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      console.error('Error fetching data:', err);
    } finally {
      // Always reset states
      if (isManualRefresh) {
      setIsRefreshing(false);
      }
      setLastRefresh(new Date());
    }
  }, [hasInitiallyLoaded, apiService]);

  // Auto-refresh function that never shows loading
  const autoRefreshData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      console.log('🔄 Auto-refresh - fetching data silently...');
      
        const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace('/graphql', '').replace(/\/$/, '');
      // ✨ OPTIMIZATION: Skip geocoding on auto-refresh to reduce server load
      const complianceUrl = `${baseUrl}/screenTracking/compliance?date=${new Date().toISOString().split('T')[0]}&skipGeocoding=true`;
        
      // ✨ OPTIMIZATION: Parallel fetch for auto-refresh too
      const [complianceResult, analyticsResult] = await Promise.allSettled([
        fetch(complianceUrl, {
          headers: {
            'Content-Type': 'application/json'
          }
        }).then(res => res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))),
        
        apiService.getAdAnalytics()
      ]);
      
      // Process compliance data
      if (complianceResult.status === 'fulfilled') {
        const complianceData = complianceResult.value;
          
          if (complianceData && complianceData.data && Array.isArray(complianceData.data.screens)) {
            // Process the screens data to create consolidated entries (one per device)
            const processedScreens = complianceData.data.screens.map((screen: any) => {
              // Create consolidated entry with slot status information
              if (screen.slotStatus && (screen.slotStatus.slot1 || screen.slotStatus.slot2)) {
                // Determine overall online status (at least one slot online)
                const hasOnlineSlot = (screen.slotStatus.slot1?.online || false) || (screen.slotStatus.slot2?.online || false);
                
                // Create status text showing both slots
                const slot1Status = screen.slotStatus.slot1?.online ? 'ONLINE' : 'OFFLINE';
                const slot2Status = screen.slotStatus.slot2?.online ? 'ONLINE' : 'OFFLINE';
                const statusText = `${slot1Status} | ${slot2Status}`;
                
                return {
                  ...screen,
                  deviceId: screen.materialId, // Use materialId as deviceId for consolidated view
                  displayId: screen.materialId,
                  slotNumber: 'Consolidated', // Show as consolidated
                  isOnline: hasOnlineSlot, // Overall online status
                  statusText: statusText,
                  slot1Status: slot1Status,
                  slot2Status: slot2Status,
                  slotStatus: screen.slotStatus, // Keep original slot status for reference
                  // Store actual deviceIds for control commands
                  slot1DeviceId: screen.slotStatus.slot1?.deviceId,
                  slot2DeviceId: screen.slotStatus.slot2?.deviceId
                };
              } else {
                // Single device without slots
                return {
                  ...screen,
                  displayId: screen.displayId || screen.deviceId,
                  slotNumber: screen.slotNumber || 1,
                  statusText: screen.statusText || (screen.isOnline ? 'ONLINE' : 'OFFLINE')
                };
              }
            });
            
            setScreens(prevScreens => {
              const hasChanged = JSON.stringify(prevScreens) !== JSON.stringify(processedScreens);
              if (hasChanged) {
                console.log('📊 Screen data updated via auto-refresh with real-time status');
                // Auto-refresh complete - screen data updated
              }
              return processedScreens;
            });
          }
      } else {
        console.error('❌ Error fetching screens during auto-refresh:', complianceResult.reason);
      }
      
      // Process analytics data
      if (analyticsResult.status === 'fulfilled') {
        setAdAnalytics(analyticsResult.value);
      } else {
        console.error('❌ Error fetching analytics during auto-refresh:', analyticsResult.reason);
        if (analyticsResult.reason instanceof Error && analyticsResult.reason.name === 'TimeoutError') {
          console.warn('⚠️ Auto-refresh analytics timed out');
        }
      }
      
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error during auto-refresh:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [apiService]);

  // Load data on component mount
  useEffect(() => {
    fetchData();
    
    // Check WebSocket connection status
    console.log('🔌 [AdminAdsControl] WebSocket connected:', playbackWebSocketService.isWebSocketConnected());
    
    // ✨ OPTIMIZATION: Reduced auto-refresh from 10s to 30s to reduce server load
    // WebSocket handles real-time updates, so aggressive polling is unnecessary
    const autoRefreshInterval = setInterval(() => {
      // Don't auto-refresh until initial data has loaded (use ref to avoid recreating interval)
      if (!hasInitiallyLoadedRef.current) {
        console.log('🔄 [AdminAdsControl] Auto-refresh skipped - waiting for initial load');
        return;
      }
      
      if (!isUserControllingRef.current) {
        console.log('🔄 [AdminAdsControl] Auto-refresh triggered');
        autoRefreshData();
      } else {
        console.log('🔄 [AdminAdsControl] Auto-refresh skipped - user is controlling devices');
      }
    }, 30000); // 30 seconds (reduced from 10s)
    
    // ✨ OPTIMIZATION: Debounce timer for deviceList updates
    let deviceListDebounceTimer: NodeJS.Timeout | null = null;
    
    // Subscribe to real-time WebSocket updates for immediate processing
    const unsubscribe = playbackWebSocketService.subscribe((update) => {
      // ✨ OPTIMIZATION: Only log meaningful updates, reduce console spam
      if (update.type !== 'deviceList' || (update as any).devices?.length > 0) {
      console.log('🎬 [AdminAdsControl] Received real-time update:', {
        type: update.type,
        deviceId: update.deviceId,
        adTitle: update.adTitle,
        state: update.state,
        currentTime: update.currentTime,
        progress: update.progress,
        timestamp: update.timestamp,
        isOnline: (update as any).isOnline,
        lastSeen: (update as any).lastSeen,
        devices: (update as any).devices
      });
      }
      
      // Handle different types of WebSocket updates
      if (update.type === 'adPlaybackUpdate') {
        // Process ad playback updates
        setScreens(prevScreens => {
          return prevScreens.map(screen => {
            // Check if the device ID matches either slot1 or slot2 device ID
            const isMatchingDevice = screen.slot1DeviceId === update.deviceId || screen.slot2DeviceId === update.deviceId;
            if (isMatchingDevice) {
              // ✅ FIXED: Check if this is a new ad or an update to the current ad
          const existingCurrentAd = screen.screenMetrics?.currentAd;
          const isNewAd = !existingCurrentAd || existingCurrentAd.adId !== update.adId;
          
          const updatedScreen: ScreenData = {
                ...screen,
                screenMetrics: {
                  isDisplaying: screen.screenMetrics?.isDisplaying ?? true,
                  brightness: screen.screenMetrics?.brightness ?? 100,
                  volume: screen.screenMetrics?.volume ?? 100,
                  adPlayCount: screen.screenMetrics?.adPlayCount ?? 0,
                  maintenanceMode: screen.screenMetrics?.maintenanceMode ?? false,
                  displayHours: screen.screenMetrics?.displayHours ?? 0,
                  adPerformance: screen.screenMetrics?.adPerformance ?? [],
                  lastAdPlayed: screen.screenMetrics?.lastAdPlayed ?? '',
                  ...screen.screenMetrics,
                  currentAd: {
                    adId: update.adId || '',
                    adTitle: update.adTitle || '',
                    adDuration: update.duration || 0,
                    // ✅ FIXED: Only update startTime if this is a new ad or if backend provides it
                    startTime: isNewAd 
                      ? (update.startTime || update.timestamp || new Date().toISOString())
                      : (existingCurrentAd.startTime || update.startTime || update.timestamp || new Date().toISOString()),
                    currentTime: update.currentTime || 0,
                    state: update.state || 'playing',
                    progress: update.progress || 0
                  }
                }
              };
              
              return updatedScreen;
            }
            return screen;
          });
        });
      } else if (update.type === 'deviceUpdate') {
        // Process device status updates (online/offline)
        console.log(`📱 [AdminAdsControl] Device status update:`, {
          deviceId: update.deviceId,
          isOnline: update.isOnline,
          lastSeen: update.lastSeen
        });
        
        setScreens(prevScreens => {
          return prevScreens.map(screen => {
            // Match by deviceId, materialId, or slot device IDs
            const matchesDevice = screen.deviceId === update.deviceId || 
                                 screen.materialId === update.deviceId ||
                                 screen.displayId === update.deviceId ||
                                 screen.slot1DeviceId === update.deviceId ||
                                 screen.slot2DeviceId === update.deviceId;
            
            if (matchesDevice) {
              console.log(`🔄 [AdminAdsControl] Updating screen ${screen.deviceId} (materialId: ${screen.materialId}) status to:`, update.isOnline ? 'ONLINE' : 'OFFLINE');
              
              // Determine which slot this device belongs to
              const isSlot1Device = screen.slot1DeviceId === update.deviceId;
              const isSlot2Device = screen.slot2DeviceId === update.deviceId;
              
              const updatedScreen: ScreenData = {
                ...screen,
                isOnline: update.isOnline || screen.isOnline, // Keep online if any slot is online
                lastSeen: update.lastSeen ? new Date(update.lastSeen).toISOString() : screen.lastSeen,
                // Update specific slot status
                slot1Status: isSlot1Device ? (update.isOnline ? 'ONLINE' : 'OFFLINE') : screen.slot1Status,
                slot2Status: isSlot2Device ? (update.isOnline ? 'ONLINE' : 'OFFLINE') : screen.slot2Status,
                statusText: screen.slot1Status && screen.slot2Status ? 
                  `• Slot 1: ${isSlot1Device ? (update.isOnline ? 'ONLINE' : 'OFFLINE') : screen.slot1Status} | • Slot 2: ${isSlot2Device ? (update.isOnline ? 'ONLINE' : 'OFFLINE') : screen.slot2Status}` :
                  screen.statusText
              };
              
              return updatedScreen;
            }
            return screen;
          });
        });
      } else if (update.type === 'displayData') {
        // ✨ NEW: Handle real-time display data from ad player
        setScreens(prevScreens => {
          return prevScreens.map(screen => {
            // Match by materialId
            if (screen.displayId === (update as any).materialId || screen.materialId === (update as any).materialId) {
              const displayData = (update as any).data;
              const adDetails = displayData.adDetails;
              
              // If ad details are provided (ad changed), create/update currentAd
              if (adDetails) {
                return {
                  ...screen,
                  screenMetrics: {
                    ...screen.screenMetrics,
                    currentAd: {
                      adId: adDetails.adId,
                      adTitle: adDetails.adTitle,
                      adDuration: adDetails.adDuration,
                      currentTime: displayData.currentTime,
                      progress: displayData.currentTime && adDetails.adDuration
                        ? (displayData.currentTime / adDetails.adDuration) * 100
                        : 0,
                      state: displayData.isPaused ? 'paused' : 'playing',
                      startTime: new Date().toISOString()
                    }
                  }
                };
              }
              
              // If no ad details but we have existing currentAd, just update progress/state
              if (screen.screenMetrics?.currentAd) {
                return {
                  ...screen,
                  screenMetrics: {
                    ...screen.screenMetrics,
                    currentAd: {
                      ...screen.screenMetrics.currentAd,
                      currentTime: displayData.currentTime || screen.screenMetrics.currentAd.currentTime,
                      progress: displayData.currentTime && screen.screenMetrics.currentAd.adDuration
                        ? (displayData.currentTime / screen.screenMetrics.currentAd.adDuration) * 100
                        : screen.screenMetrics.currentAd.progress,
                      state: displayData.isPaused ? 'paused' : 'playing'
                    }
                  }
                };
              }
            }
            return screen;
          });
        });
      } else if (update.type === 'deviceList') {
        // ✨ OPTIMIZATION: Debounce deviceList updates to prevent spam
        // Empty device lists are being sent repeatedly, causing excessive re-renders
        if (!update.devices || !Array.isArray(update.devices) || update.devices.length === 0) {
          console.log(`📋 [AdminAdsControl] Skipping empty deviceList update`);
          return; // Skip empty updates
        }
        
        // Clear previous debounce timer
        if (deviceListDebounceTimer) {
          clearTimeout(deviceListDebounceTimer);
        }
        
        // Debounce: only process after 2 seconds of no new updates
        deviceListDebounceTimer = setTimeout(() => {
          console.log(`📋 [AdminAdsControl] Processing debounced deviceList update:`, update.devices);
          
          setScreens(prevScreens => {
            const updatedScreens = [...prevScreens];

            update.devices?.forEach(device => {
              // Match by deviceId, materialId, or displayId
              const screenIndex = updatedScreens.findIndex(screen => 
                screen.deviceId === device.deviceId || 
                screen.materialId === device.deviceId ||
                screen.displayId === device.deviceId
              );
              
              if (screenIndex >= 0) {
                console.log(`🔄 [AdminAdsControl] Updating screen ${device.deviceId} from device list:`, {
                  isOnline: device.isConnected,
                  materialId: device.materialId
                });

                updatedScreens[screenIndex] = {
                  ...updatedScreens[screenIndex],
                  isOnline: device.isConnected,
                  lastSeen: new Date().toISOString()
                };
              }
            });

            return updatedScreens;
          });
        }, 2000); // 2 second debounce
      }
    });
    
    return () => {
      clearInterval(autoRefreshInterval);
      if (deviceListDebounceTimer) {
        clearTimeout(deviceListDebounceTimer);
      }
      unsubscribe();
    };
  }, [fetchData, autoRefreshData]); // isUserControlling removed - now using ref to prevent recreation

  // Toggle play/pause handler
  const handleTogglePlayPause = async () => {
    try {
      const action = isCurrentlyPlaying ? 'pause' : 'play';
      setActionLoading(action);
      setIsUserControlling(true); // Mark that user is controlling devices
      
      let result;
      if (isCurrentlyPlaying) {
        result = await graphQLService.pauseAllScreens();
      } else {
        result = await graphQLService.playAllScreens();
      }
      
      if (result.success) {
        // Toggle the state
        setIsCurrentlyPlaying(!isCurrentlyPlaying);
        console.log(`✅ ${action} all screens successful:`, result.message);
      } else {
        console.error(`❌ ${action} all screens failed:`, result.message);
        setError(`Failed to ${action} all screens: ${result.message}`);
      }
    } catch (error) {
      console.error(`Error ${isCurrentlyPlaying ? 'pausing' : 'playing'} all screens:`, error);
      setError(`Failed to ${isCurrentlyPlaying ? 'pause' : 'play'} all screens`);
    } finally {
      setActionLoading(null);
      setIsUserControlling(false); // Clear control state
    }
  };

  // Toggle lock/unlock handler
  const handleToggleLock = async () => {
    try {
      const action = isLocked ? 'unlock' : 'lock';
      setActionLoading(action);
      setIsUserControlling(true); // Mark that user is controlling devices
      
      let result;
      if (isLocked) {
        result = await graphQLService.unlockAllScreens();
      } else {
        result = await graphQLService.lockdownAllScreens();
      }
      
      if (result.success) {
        // Toggle the state
        setIsLocked(!isLocked);
        console.log(`✅ ${action} all screens successful:`, result.message);
      } else {
        console.error(`❌ ${action} all screens failed:`, result.message);
        setError(`Failed to ${action} all screens: ${result.message}`);
      }
    } catch (error) {
      console.error(`Error ${isLocked ? 'unlocking' : 'locking'} all screens:`, error);
      setError(`Failed to ${isLocked ? 'unlock' : 'lock'} all screens`);
    } finally {
      setActionLoading(null);
      setIsUserControlling(false); // Clear control state
    }
  };

  // Action handlers
  const handleBulkAction = async (action: string) => {
    try {
      setActionLoading(action);
      setIsUserControlling(true); // Mark that user is controlling devices
      let result;
      
      // Use API service for bulk actions
      switch (action) {
        case 'sync':
          result = await apiService.syncAllScreens();
          break;
        case 'play':
          result = await apiService.playAllScreens();
          break;
        case 'pause':
          result = await apiService.pauseAllScreens();
          break;
        case 'stop':
          result = await apiService.stopAllScreens();
          break;
        case 'restart':
          result = await apiService.restartAllScreens();
          break;
        case 'emergency':
          result = await apiService.emergencyStopAll();
          break;
        case 'lockdown':
          result = await apiService.lockdownAllScreens();
          break;
        case 'lock':
          // Lock all selected devices using individual device lock (same as master control logic)
          let lockedCount = 0;
          for (const deviceId of selectedScreens) {
            try {
              const screen = screens.find(s => s.deviceId === deviceId);
              if (screen) {
                // Get both slot devices
                const slot1DeviceId = screen.slot1DeviceId;
                const slot2DeviceId = screen.slot2DeviceId;
                
                if (slot1DeviceId) {
                  const lockResult = await graphQLService.lockScreen(slot1DeviceId);
                  if (lockResult.success) lockedCount++;
                }
                if (slot2DeviceId) {
                  const lockResult = await graphQLService.lockScreen(slot2DeviceId);
                  if (lockResult.success) lockedCount++;
                }
                
                setDeviceLockStates(prev => ({ ...prev, [deviceId]: true }));
              }
            } catch (error) {
              console.error(`Error locking device ${deviceId}:`, error);
            }
          }
          result = { success: true, message: `Lock commands sent to ${lockedCount} devices` };
          break;
        case 'unlock':
          // Unlock all selected devices using individual device unlock (same as master control logic)
          let unlockedCount = 0;
          for (const deviceId of selectedScreens) {
            try {
              const screen = screens.find(s => s.deviceId === deviceId);
              if (screen) {
                // Get both slot devices
                const slot1DeviceId = screen.slot1DeviceId;
                const slot2DeviceId = screen.slot2DeviceId;
                
                if (slot1DeviceId) {
                  const unlockResult = await graphQLService.unlockScreen(slot1DeviceId);
                  if (unlockResult.success) unlockedCount++;
                }
                if (slot2DeviceId) {
                  const unlockResult = await graphQLService.unlockScreen(slot2DeviceId);
                  if (unlockResult.success) unlockedCount++;
                }
                
                setDeviceLockStates(prev => ({ ...prev, [deviceId]: false }));
              }
            } catch (error) {
              console.error(`Error unlocking device ${deviceId}:`, error);
            }
          }
          result = { success: true, message: `Unlock commands sent to ${unlockedCount} devices` };
          break;
        default:
          throw new Error('Unknown action');
      }
      
      if (result.success) {
        // ✨ OPTIMIZATION: No need to refresh data - WebSocket provides real-time updates
        // This significantly improves response time for control commands
        console.log('✅ Bulk action completed - WebSocket will provide real-time updates');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(null);
      setIsUserControlling(false); // Clear control state
    }
  };

  const handleScreenAction = async (deviceId: string, action: string, value?: any) => {
    try {
      setActionLoading(`${deviceId}-${action}`);
      setIsUserControlling(true); // Mark that user is controlling devices
      
      // Find the screen data to get slot information
      const screen = screens.find(s => s.deviceId === deviceId);
      if (!screen) {
        throw new Error(`Screen ${deviceId} not found`);
      }
      
      // Get actual deviceIds for both slots
      const slot1DeviceId = screen.slot1DeviceId;
      const slot2DeviceId = screen.slot2DeviceId;
      
      console.log(`🎯 [ScreenAction] ${action} for material ${deviceId}:`, {
        slot1DeviceId,
        slot2DeviceId,
        slot1Online: screen.slot1Status === 'ONLINE',
        slot2Online: screen.slot2Status === 'ONLINE'
      });
      
      let results = [];
      
      // Control both slots if they have deviceIds
      const deviceIdsToControl = [];
      if (slot1DeviceId) deviceIdsToControl.push(slot1DeviceId);
      if (slot2DeviceId) deviceIdsToControl.push(slot2DeviceId);
      
      if (deviceIdsToControl.length === 0) {
        throw new Error('No registered devices found for this material');
      }
      
      // Use direct device control for play/pause/stop/lock/unlock actions (same as master control)
      if (['play', 'pause', 'stop', 'lock', 'unlock'].includes(action)) {
        try {
          console.log(`🎯 [ScreenAction] Using direct device control for ${action} on material ${deviceId}`);
          
          // Send control command to each device individually (same logic as master control)
          for (const actualDeviceId of deviceIdsToControl) {
            try {
              let result;
              
              switch (action) {
                case 'play':
                  result = await graphQLService.playScreen(actualDeviceId);
                  break;
                case 'pause':
                  result = await graphQLService.pauseScreen(actualDeviceId);
                  break;
                case 'stop':
                  result = await graphQLService.stopScreen(actualDeviceId);
                  break;
                case 'lock':
                  result = await graphQLService.lockScreen(actualDeviceId);
                  if (result.success) {
                    setDeviceLockStates(prev => ({ ...prev, [deviceId]: true }));
                  }
                  break;
                case 'unlock':
                  result = await graphQLService.unlockScreen(actualDeviceId);
                  if (result.success) {
                    setDeviceLockStates(prev => ({ ...prev, [deviceId]: false }));
                  }
                  break;
                default:
                  throw new Error('Unknown action');
              }
              
              results.push({ deviceId: actualDeviceId, result });
              
              if (result.success) {
                console.log(`✅ [ScreenAction] ${action} successful for device ${actualDeviceId}:`, result.message);
              } else {
                console.error(`❌ [ScreenAction] ${action} failed for device ${actualDeviceId}:`, result.message);
              }
            } catch (err) {
              console.error(`❌ [ScreenAction] Error ${action} device ${actualDeviceId}:`, err);
              results.push({ deviceId: actualDeviceId, error: err instanceof Error ? err.message : 'Unknown error' });
            }
          }
        } catch (err) {
          console.error(`❌ [ScreenAction] Error with direct device control ${action} for material ${deviceId}:`, err);
          results.push({ deviceId: 'all', error: err instanceof Error ? err.message : 'Unknown error' });
        }
      } else {
        // Execute action on all available slots for non-sync actions
        for (const actualDeviceId of deviceIdsToControl) {
          try {
            let result;
            
            switch (action) {
              case 'metrics':
                result = await apiService.updateScreenMetrics(actualDeviceId, value);
                break;
              case 'start-session':
                result = await apiService.startScreenSession(actualDeviceId);
                break;
              case 'end-session':
                result = await apiService.endScreenSession(actualDeviceId);
                break;
              // ❌ REMOVED: 'track-ad' - no UI trigger, handled by AdPlayer directly
              case 'end-ad':
                result = await apiService.endAdPlayback(actualDeviceId);
                break;
              case 'driver-activity':
                result = await apiService.updateDriverActivity(actualDeviceId, value);
                break;
              default:
                throw new Error('Unknown action');
            }
            
            results.push({ deviceId: actualDeviceId, result });
            
            if (result.success) {
              console.log(`✅ [ScreenAction] ${action} successful for device ${actualDeviceId}:`, result.message);
            } else {
              console.error(`❌ [ScreenAction] ${action} failed for device ${actualDeviceId}:`, result.message);
            }
          } catch (err) {
            console.error(`❌ [ScreenAction] Error ${action} device ${actualDeviceId}:`, err);
            results.push({ deviceId: actualDeviceId, error: err instanceof Error ? err.message : 'Unknown error' });
          }
        }
      }
      
      // Check if any action succeeded
      const successCount = results.filter(r => r.result?.success).length;
      const totalCount = results.length;
      
      if (successCount > 0) {
        console.log(`✅ [ScreenAction] ${action} completed: ${successCount}/${totalCount} devices successful`);
        
        // Update device play states for the material (not individual devices)
        if (action === 'play') {
          setDevicePlayStates(prev => {
            const newStates = { ...prev, [deviceId]: true };
            // Update master control state - if any device is playing, master should show "pause"
            const hasAnyPlaying = Object.values(newStates).some(playing => playing === true);
            setIsCurrentlyPlaying(hasAnyPlaying);
            return newStates;
          });
        } else if (action === 'pause' || action === 'stop') {
          setDevicePlayStates(prev => {
            const newStates = { ...prev, [deviceId]: false };
            // Update master control state - if all devices are paused, master should show "play"
            const hasAnyPlaying = Object.values(newStates).some(playing => playing === true);
            setIsCurrentlyPlaying(hasAnyPlaying);
            return newStates;
          });
        }
        
        // ✨ OPTIMIZATION: No need to refresh data - WebSocket provides real-time updates
        // This significantly improves response time for control commands
        console.log('✅ Screen action completed - WebSocket will provide real-time updates');
        
        if (successCount < totalCount) {
          // This is actually a success with some devices offline - show as info, not error
          console.log(`✅ [ScreenAction] Partial success: ${action} worked on ${successCount}/${totalCount} devices (${totalCount - successCount} devices offline)`);
        }
      } else {
        const errorMessages = results.map(r => r.error || r.result?.message).filter(Boolean);
        throw new Error(`Failed to ${action} all devices: ${errorMessages.join(', ')}`);
      }
      
    } catch (err) {
      console.error(`Error ${action} material ${deviceId}:`, err);
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(null);
      setIsUserControlling(false); // Clear control state
    }
  };

  // Real data will be loaded from the API via the fetchData function

  // Real data will be loaded from the API via the fetchData function

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return <div className="w-3 h-3 bg-green-500 rounded-full"></div>;
      case 'offline': return <div className="w-3 h-3 bg-red-500 rounded-full"></div>;
      case 'maintenance': return <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>;
      default: return <div className="w-3 h-3 bg-gray-500 rounded-full"></div>;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online': return 'Online';
      case 'offline': return 'Offline';
      case 'maintenance': return 'Maintenance';
      default: return 'Unknown';
    }
  };


  const formatTime = (seconds: number | undefined) => {
    if (!seconds || isNaN(seconds) || seconds < 0) {
      return '0:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleScreenSelect = (screenId: string) => {
    setSelectedScreens(prev => 
      prev.includes(screenId) 
        ? prev.filter(id => id !== screenId)
        : [...prev, screenId]
    );
  };

  const handleSelectAll = () => {
    setSelectedScreens(screens.map(screen => screen.deviceId));
  };

  const handleDeselectAll = () => {
    setSelectedScreens([]);
  };

  const handleScreenClick = (screen: any) => {
    setSelectedScreen(screen.deviceId);
    setShowScreenDetails(true);
  };

  const handleMaterialClick = (screen: ScreenData) => {
    setSelectedDeviceForModal(screen);
    setShowDeviceModal(true);
    setIsDeviceModalOpen(true);
  };

  const handleCloseDeviceModal = () => {
    setIsDeviceModalOpen(false);
    setTimeout(() => {
      setShowDeviceModal(false);
      setSelectedDeviceForModal(null);
    }, 300);
  };

  if (loading) {
    return <AdminLoader />;
  }

  const contentMargin = isMobile ? "ml-0 pt-16" : sidebarCollapsed ? "ml-16" : "ml-60";

  if (error) {
    return (
      <div className={`p-6 ${contentMargin} bg-[#f9f9fc] min-h-screen flex items-center justify-center transition-all duration-300`}>
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={() => fetchData(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 ${contentMargin} bg-[#f9f9fc] min-h-screen transition-all duration-300`}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center pt-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">LCD Control</h1>
            {/* Show subtle loader during auto-refresh */}
            {isRefreshing && (
              <div className="flex items-center text-xs text-gray-400 mt-1">
                <div className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></div>
                <span>Refreshing data...</span>
              </div>
            )}
            {/* Show when auto-refresh is paused due to user control */}
            {isUserControlling && (
              <div className="flex items-center text-xs text-orange-500 mt-1">
                <div className="w-2 h-2 bg-orange-400 rounded-full mr-2"></div>
                <span>Auto-refresh paused - user controlling devices</span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        {/* ======= Status Overview (Left Side) ======= */}
        <div className="lg:w-1/2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {/* Total Screens */}
            <div className="bg-white p-5 rounded-lg shadow-sm flex flex-col items-center justify-center text-center">
              <div className="flex items-center justify-center gap-2">
                <p className="text-3xl font-semibold text-gray-900">{screens.length}</p>
              </div>
              <p className="text-sm text-gray-600 font-medium mt-1">Total Screens</p>
            </div>

            {/* Online Screens */}
            <div className="bg-white p-5 rounded-lg shadow-sm flex flex-col items-center justify-center text-center">
              <div className="flex items-center justify-center gap-2">
                <p className="text-3xl font-semibold">
                  {screens.filter(s => s.isOnline).length}
                </p>
                <Monitor className="w-6 h-6 pt-1" />
              </div>
              <p className="text-sm text-gray-600 font-medium mt-1">Online Screens</p>
            </div>

            {/* Playing Ads */}
            <div className="bg-white p-5 rounded-lg shadow-sm flex flex-col items-center justify-center text-center">
              <div className="flex items-center justify-center gap-2">
                <p className="text-3xl font-semibold">
                  {screens.filter(s => {
                    const currentAd = s.screenMetrics?.currentAd;
                    return (
                      s.isOnline &&
                      currentAd &&
                      ['playing', 'buffering', 'loading'].includes(currentAd.state)
                    );
                  }).length}
                </p>
                <PlayCircle className="w-6 h-6 pt-1" />
              </div>
              <p className="text-sm text-gray-600 font-medium mt-1">Playing Ads</p>
            </div>
          </div>

        </div>

        {/* ======= Master Controls (Right Side) ======= */}
        <div className="lg:w-2/3">
          <div className=" h-full flex flex-col">
            <h2 className="text-lg font-semibold mb-4 flex items-center">
              Master Controls
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {/* Sync All */}
              <button
                onClick={() => handleBulkAction('sync')}
                disabled={actionLoading === 'sync'}
                className="flex flex-col items-center justify-center p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
              >
                {actionLoading === 'sync' ? (
                  <Loader2 className="w-6 h-6 text-blue-600 mb-2 animate-spin" />
                ) : (
                  <Monitor className="w-6 h-6 text-blue-600 mb-2" />
                )}
                <span className="text-sm font-medium text-blue-600">Sync All</span>
              </button>

              {/* Play / Pause All */}
              <button
                onClick={handleTogglePlayPause}
                disabled={actionLoading === 'play' || actionLoading === 'pause'}
                className={`flex flex-col items-center justify-center p-4 rounded-lg transition-colors disabled:opacity-50 ${
                  isCurrentlyPlaying
                    ? 'bg-yellow-50 hover:bg-yellow-100'
                    : 'bg-green-50 hover:bg-green-100'
                }`}
              >
                {actionLoading === 'play' || actionLoading === 'pause' ? (
                  <Loader2
                    className={`w-6 h-6 mb-2 animate-spin ${
                      isCurrentlyPlaying ? 'text-yellow-600' : 'text-green-600'
                    }`}
                  />
                ) : isCurrentlyPlaying ? (
                  <Pause className="w-6 h-6 text-yellow-600 mb-2" />
                ) : (
                  <Play className="w-6 h-6 text-green-600 mb-2" />
                )}
                <span
                  className={`text-sm font-medium ${
                    isCurrentlyPlaying ? 'text-yellow-600' : 'text-green-600'
                  }`}
                >
                  {isCurrentlyPlaying ? 'Pause All' : 'Play All'}
                </span>
              </button>

              {/* Restart All */}
              <button className="flex flex-col items-center justify-center p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors">
                <RotateCcw className="w-6 h-6 text-purple-600 mb-2" />
                <span className="text-sm font-medium text-purple-600">Restart All</span>
              </button>

              {/* Emergency */}
              <button className="flex flex-col items-center justify-center p-4 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors">
                <AlertTriangle className="w-6 h-6 text-orange-600 mb-2" />
                <span className="text-sm font-medium text-orange-600">Emergency</span>
              </button>

              {/* Lock / Unlock All */}
              <button
                onClick={handleToggleLock}
                disabled={actionLoading === 'lock' || actionLoading === 'unlock'}
                className={`flex flex-col items-center justify-center p-4 bg-gray-200 rounded-lg disabled:opacity-50 ${
                  isLocked
                    ? 'bg-green-50 hover:bg-green-100'
                    : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                {actionLoading === 'lock' || actionLoading === 'unlock' ? (
                  <Loader2
                    className={`w-6 h-6 mb-2 animate-spin ${
                      isLocked ? 'text-green-600' : 'text-gray-600'
                    }`}
                  />
                ) : isLocked ? (
                  <Unlock className="w-6 h-6 text-green-600 mb-2" />
                ) : (
                  <Lock className="w-6 h-6 text-gray-600 mb-2" />
                )}
                <span
                  className={`text-sm font-medium ${
                    isLocked ? 'text-green-600' : 'text-gray-600'
                  }`}
                >
                  {isLocked ? 'Unlock All' : 'Lock All'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>



      {/* Tabs */}
      <div className="mb-8">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
              { id: 'notifications', label: 'Notifications', icon: AlertTriangle }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center py-4 px-1 font-medium text-sm transition-colors group ${
                  activeTab === tab.id ? 'text-[#3674B5]' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.label}
                <span
                  className={`absolute bottom-0 left-0 h-[2px] bg-[#3674B5] transition-all duration-300
                    ${activeTab === tab.id ? 'w-full' : 'w-0 group-hover:w-full'}
                  `}
                />
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'dashboard' && (
            <Dashboard
              screens={screens}
              selectedScreens={selectedScreens}
              lastRefresh={lastRefresh}
              isRefreshing={isRefreshing}
              isCurrentlyPlaying={isCurrentlyPlaying}
              onSelectAll={handleSelectAll}
              onDeselectAll={handleDeselectAll}
              onScreenSelect={handleScreenSelect}
              onScreenClick={handleScreenClick}
              onScreenAction={handleScreenAction}
              onMaterialClick={handleMaterialClick}
              onBulkAction={handleBulkAction}
              getStatusIcon={getStatusIcon}
              getStatusText={getStatusText}
              formatTime={formatTime}
              devicePlayStates={devicePlayStates}
              deviceLockStates={deviceLockStates}
            />
          )}

          {activeTab === 'notifications' && (
            <React.Suspense fallback={<AdminLoader />}>
            <NotificationDashboard />
            </React.Suspense>
          )}
        </div>
      </div>

      {/* Screen Details Modal */}
      {showScreenDetails && selectedScreen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Screen Details - {selectedScreen}</h3>
              <button
                onClick={() => setShowScreenDetails(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            {(() => {
              const screen = screens.find(s => s.deviceId === selectedScreen);
              if (!screen) return null;
              
              return (
                <div className="space-y-6">
                  {/* Basic Info */}
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600">Device ID</label>
                      <p className="text-lg font-medium">{screen.deviceId}</p>
                    </div>
                    
                    {/* Slot Information */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <label className="text-sm font-medium text-gray-600">Slot 1 Material ID</label>
                          {screen.slot1DeviceId === screen.masterDeviceId && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                              <BarChart3 className="w-3 h-3" />
                              <span>Analytics</span>
                            </div>
                          )}
                        </div>
                        <p className="text-lg font-medium mb-2">{screen.slot1DeviceId || 'Not connected'}</p>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${(screen.slot1Status || '').toLowerCase() === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          <p className="text-sm font-medium" style={{ color: (screen.slot1Status || '').toLowerCase() === 'online' ? '#10b981' : '#ef4444' }}>
                            {screen.slot1Status || 'Unknown'}
                          </p>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <label className="text-sm font-medium text-gray-600">Slot 2 Material ID</label>
                          {screen.slot2DeviceId === screen.masterDeviceId && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                              <BarChart3 className="w-3 h-3" />
                              <span>Analytics</span>
                            </div>
                          )}
                        </div>
                        <p className="text-lg font-medium mb-2">{screen.slot2DeviceId || 'Not connected'}</p>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${(screen.slot2Status || '').toLowerCase() === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          <p className="text-sm font-medium" style={{ color: (screen.slot2Status || '').toLowerCase() === 'online' ? '#10b981' : '#ef4444' }}>
                            {screen.slot2Status || 'Unknown'}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Display Hours */}
                    <div>
                      <label className="block text-sm font-medium text-gray-600">Display Hours</label>
                      <p className="text-lg font-medium">{screen.screenMetrics?.displayHours?.toFixed(1) || '0.0'}h</p>
                    </div>
                    
                    {/* Driver Information */}
                    {screen.driverInfo && (
                      <div>
                        <label className="block text-sm font-medium text-gray-600">Driver</label>
                        <p className="text-lg font-medium">{screen.driverInfo.driverName}</p>
                        <p className="text-sm text-gray-500">Vehicle: {screen.driverInfo.vehiclePlateNumber}</p>
                      </div>
                    )}
                  </div>


                  {/* Actions */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => setShowScreenDetails(false)}
                      className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                    >
                      Close
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Device Details Modal */}
      {showDeviceModal && selectedDeviceForModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
          onClick={handleCloseDeviceModal}
        >
          <div
            className={`bg-white rounded-lg shadow-xl max-w-md w-full mx-4 transform transition-transform duration-300 ease-in-out ${
              isDeviceModalOpen ? 'scale-100' : 'scale-95'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Device Details</h3>
                <button
                  onClick={handleCloseDeviceModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Device ID</label>
                <div className="p-3 bg-gray-50 rounded-lg font-mono text-sm text-gray-900 break-all">
                  {selectedDeviceForModal.deviceId}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Material ID</label>
                <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-900">
                  {selectedDeviceForModal.materialId}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Screen Type</label>
                <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-900">
                  {selectedDeviceForModal.screenType}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slot Number</label>
                <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-900">
                  {selectedDeviceForModal.slotNumber}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(selectedDeviceForModal.isOnline ? 'online' : 'offline')}
                  <span className="text-sm font-medium">
                    {getStatusText(selectedDeviceForModal.isOnline ? 'online' : 'offline')}
                  </span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Seen</label>
                <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-900">
                  {new Date(selectedDeviceForModal.lastSeen).toLocaleString()}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-900">
                  {selectedDeviceForModal.currentLocation?.address || 'Location not available'}
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={handleCloseDeviceModal}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAdsControl;