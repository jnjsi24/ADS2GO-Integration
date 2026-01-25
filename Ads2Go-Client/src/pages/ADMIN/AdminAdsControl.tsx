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

// ✨ Client-side reverse geocoding helper with caching
const geocodingCache = new Map<string, string>();
const reverseGeocodeClient = async (lat: number, lng: number): Promise<string> => {
  // Round coordinates to 4 decimal places for caching (about 11m accuracy)
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  
  // Check cache first
  if (geocodingCache.has(cacheKey)) {
    return geocodingCache.get(cacheKey)!;
  }
  
  try {
    // Use OpenStreetMap Nominatim API (free, no API key required)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'Ads2Go-AdminClient/1.0' // Required by Nominatim
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data && data.address) {
      const addr = data.address;
      const addressParts = [];
      
      // Build address from most specific to least specific
      if (addr.house_number) addressParts.push(addr.house_number);
      if (addr.road) addressParts.push(addr.road);
      if (addr.neighbourhood || addr.suburb) addressParts.push(addr.neighbourhood || addr.suburb);
      if (addr.city || addr.town || addr.village) addressParts.push(addr.city || addr.town || addr.village);
      if (addr.state) addressParts.push(addr.state);
      if (addr.country) addressParts.push(addr.country);
      
      const address = addressParts.join(', ') || `Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      geocodingCache.set(cacheKey, address); // Cache the result
      return address;
    }
    
    const fallback = `Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    geocodingCache.set(cacheKey, fallback); // Cache fallback too
    return fallback;
  } catch (error) {
    console.warn('Client-side geocoding failed:', error);
    const fallback = `Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    geocodingCache.set(cacheKey, fallback); // Cache fallback too
    return fallback;
  }
};

// ✅ FIXED: Module-level subscription tracking to persist across React StrictMode cycles
let globalSubscriptionActive = false;
let globalUnsubscribe: (() => void) | null = null;

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
  const [isLocked, setIsLocked] = useState(true); // Track lock/unlock state - default to locked since adsplayer starts locked
  const [devicePlayStates, setDevicePlayStates] = useState<Record<string, boolean>>({}); // Track individual device play states - default to true (playing) since ads auto-play
  const [deviceLockStates, setDeviceLockStates] = useState<Record<string, boolean>>({}); // Track individual device lock states
  const [isUserControlling, setIsUserControlling] = useState(false); // Track if user is actively controlling devices
  const [showScreenDetails, setShowScreenDetails] = useState(false);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
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
        // ✅ OPTIMIZED: Reduced logging
        if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_SCREEN_TRACKING === 'true') {
          console.log('🔄 Manual refresh - setting refreshing state');
        }
        setIsRefreshing(true);
        setError(null);
      } else if (isInitialLoad) {
        // ✅ OPTIMIZED: Reduced logging
        if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_SCREEN_TRACKING === 'true') {
          console.log('🔄 Initial load - setting loading state');
        }
        setLoading(true);
      }
      
      // ✅ OPTIMIZED: Reduced logging - only log in verbose mode
      if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_SCREEN_TRACKING === 'true') {
        console.log('🔄 Fetching data from server...');
        console.log('🔍 isInitialLoad:', isInitialLoad, 'hasInitiallyLoaded:', hasInitiallyLoaded);
      }
      
        const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace('/graphql', '').replace(/\/$/, '');
      // ✨ OPTIMIZATION: Skip geocoding on initial load to speed up response (addresses can load later)
      const skipGeocoding = isInitialLoad ? '&skipGeocoding=true' : '';
      const complianceUrl = `${baseUrl}/screenTracking/compliance?date=${new Date().toISOString().split('T')[0]}${skipGeocoding}`;
      
      // ✅ OPTIMIZED: Reduced logging
      if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_SCREEN_TRACKING === 'true') {
        console.log('🌐 Compliance URL:', complianceUrl);
        console.log('📍 Skip geocoding:', isInitialLoad ? 'YES (initial load)' : 'NO (refresh)');
      }
      
      const fetchStartTime = Date.now();
      
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
            // ✅ OPTIMIZED: Only log slow responses or in verbose mode
            if (fetchDuration > 2000 || (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_SCREEN_TRACKING === 'true')) {
              console.log(`📡 Compliance response received after ${fetchDuration}ms (${(fetchDuration/1000).toFixed(2)}s)!`);
            }
            
            // ✅ OPTIMIZED: Reduced logging
            if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_SCREEN_TRACKING === 'true') {
              console.log('📡 Response status:', res.status);
              console.log('📡 Response ok:', res.ok);
              console.log('📡 Response headers:', {
                contentType: res.headers.get('content-type'),
                contentLength: res.headers.get('content-length')
              });
            }
            
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
            // ✅ OPTIMIZED: Reduced logging
            if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_SCREEN_TRACKING === 'true') {
              console.log('✅ Compliance JSON parsed successfully');
            }
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
            // ✅ OPTIMIZED: Reduced logging
            if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_SCREEN_TRACKING === 'true') {
              console.log('🔄 Fetching analytics in parallel...');
            }
            return await apiService.getAdAnalytics();
          } finally {
            setAnalyticsLoading(false);
          }
        })()
      ]);
      
      // Process compliance data (priority - show UI immediately)
      if (complianceResult.status === 'fulfilled') {
        const complianceData = complianceResult.value;
        // ✅ OPTIMIZED: Reduced logging - only log in verbose mode
        if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_SCREEN_TRACKING === 'true') {
          console.log('📊 Compliance data received:', complianceData);
          console.log('📊 Compliance data structure:', {
            hasData: !!complianceData,
            hasDataProperty: !!complianceData?.data,
            hasScreens: !!complianceData?.data?.screens,
            screensIsArray: Array.isArray(complianceData?.data?.screens),
            screensLength: complianceData?.data?.screens?.length
          });
        }
          
          if (complianceData && complianceData.data && Array.isArray(complianceData.data.screens)) {
            // ✅ OPTIMIZED: Reduced logging
            if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_SCREEN_TRACKING === 'true') {
              console.log(`✅ Found ${complianceData.data.screens.length} screens with real-time status`);
            }
            
            // ✅ OPTIMIZED: Skip geocoding on initial load to prevent blocking (addresses can load async later)
            // Only geocode if NOT initial load (manual refresh)
            const shouldGeocode = !isInitialLoad;
            
            let screensWithAddresses = complianceData.data.screens;
            
            if (shouldGeocode) {
              // ✨ Geocode addresses on client-side if missing OR is just coordinates (non-blocking)
              // Use Promise.allSettled to prevent one failure from blocking all
              const geocodePromises = complianceData.data.screens.map(async (screen: any) => {
                // If address is missing OR is just coordinates (starts with "Location:"), geocode on client
                const needsGeocoding = screen.currentLocation?.lat && screen.currentLocation?.lng && 
                  (!screen.currentLocation?.address || screen.currentLocation.address.startsWith('Location:'));
                
                if (needsGeocoding) {
                  try {
                    // Add timeout to prevent hanging on slow geocoding
                    const address = await Promise.race([
                      reverseGeocodeClient(screen.currentLocation.lat, screen.currentLocation.lng),
                      new Promise<string>((_, reject) => 
                        setTimeout(() => reject(new Error('Geocoding timeout')), 3000)
                      )
                    ]);
                    screen.currentLocation = {
                      ...screen.currentLocation,
                      address: address
                    };
                  } catch (error) {
                    // Silently fail - don't block UI, address will remain as coordinates
                    if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_SCREEN_TRACKING === 'true') {
                      console.warn(`Failed to geocode ${screen.currentLocation.lat}, ${screen.currentLocation.lng}:`, error);
                    }
                  }
                }
                return screen;
              });
              
              screensWithAddresses = await Promise.allSettled(geocodePromises).then(results =>
                results.map(result => result.status === 'fulfilled' ? result.value : result.reason)
              );
            } else {
              // On initial load, skip geocoding entirely - UI loads faster
              // Geocoding can happen async later if needed
            }
            
            // Process the screens data to create consolidated entries (one per device)
            const processedScreens = screensWithAddresses.map((screen: any) => {
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
            
            // ✅ OPTIMIZED: Only log in verbose mode
            if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_SCREEN_TRACKING === 'true') {
              console.log('✅ [AdminAdsControl] Screens loaded! Count:', processedScreens.length);
              console.log('📋 [AdminAdsControl] Screen IDs:', processedScreens.map((s: any) => ({
                deviceId: s.deviceId,
                materialId: s.materialId,
                displayId: s.displayId,
                slot1DeviceId: s.slot1DeviceId,
                slot2DeviceId: s.slot2DeviceId
              })));
            }
            
            // ✅ OPTIMIZED: Reduced logging - only log in verbose mode
            if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_SCREEN_TRACKING === 'true') {
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
            }
            
            // Initial load complete - current ad info available in screenMetrics
            // ✅ FIXED: Now that screens are loaded, WebSocket updates can match them
            // The subscription is already active, so future updates will be processed
          } else {
            if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_SCREEN_TRACKING === 'true') {
              console.warn('⚠️ Unexpected compliance data format:', complianceData);
            }
            setScreens([]);
          }
        } else {
          // Check if it's a timeout error - these are expected and non-critical
          if (complianceResult.reason?.message?.includes('timeout')) {
            // ✅ OPTIMIZED: Only log in verbose mode
            if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_SCREEN_TRACKING === 'true') {
              console.log('⏱️ Compliance request timed out (non-critical, will retry on next refresh)');
            }
          } else {
            console.error('❌ Error fetching compliance data:', complianceResult.reason);
            // ✅ OPTIMIZED: Reduced error logging detail
            if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_SCREEN_TRACKING === 'true') {
              console.error('❌ Compliance result status:', complianceResult.status);
              console.error('❌ Full compliance result:', complianceResult);
            }
          }
          setScreens([]);
        }
      
      // ✨ OPTIMIZATION: Show UI now, analytics loads in background
      if (isInitialLoad) {
        // ✅ OPTIMIZED: Reduced logging
        if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_SCREEN_TRACKING === 'true') {
          console.log('⚡ Setting loading to false - UI ready with compliance data');
        }
        setLoading(false);
        setHasInitiallyLoaded(true);
      }
      
      // Process analytics data (non-blocking)
      if (analyticsResult.status === 'fulfilled') {
        // ✅ OPTIMIZED: Reduced logging
        if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_SCREEN_TRACKING === 'true') {
          console.log('📊 Analytics data received');
        }
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

  // ✅ OPTIMIZED: Prevent duplicate initial fetches
  const hasInitialFetchTriggered = useRef(false);
  
  // Load data on component mount
  useEffect(() => {
    // ✅ OPTIMIZED: Prevent duplicate initial fetches
    if (hasInitialFetchTriggered.current) {
      if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_SCREEN_TRACKING === 'true') {
        console.log('⏭️ [AdminAdsControl] Skipping duplicate initial fetch');
      }
      return;
    }
    
    hasInitialFetchTriggered.current = true;
    fetchData();
    
    // ✅ OPTIMIZED: Reduced logging
    if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_SCREEN_TRACKING === 'true') {
      console.log('🔌 [AdminAdsControl] WebSocket connected:', playbackWebSocketService.isWebSocketConnected());
    }
    
    // ✨ OPTIMIZATION: Reduced auto-refresh from 10s to 30s to reduce server load
    // WebSocket handles real-time updates, so aggressive polling is unnecessary
    const autoRefreshInterval = setInterval(() => {
      // Don't auto-refresh until initial data has loaded (use ref to avoid recreating interval)
      if (!hasInitiallyLoadedRef.current) {
        // ✅ OPTIMIZED: Reduced logging
        if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_SCREEN_TRACKING === 'true') {
          console.log('🔄 [AdminAdsControl] Auto-refresh skipped - waiting for initial load');
        }
        return;
      }
      
      if (!isUserControllingRef.current) {
        // ✅ OPTIMIZED: Reduced logging
        if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_SCREEN_TRACKING === 'true') {
          console.log('🔄 [AdminAdsControl] Auto-refresh triggered');
        }
        autoRefreshData();
      } else {
        // ✅ OPTIMIZED: Reduced logging
        if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_SCREEN_TRACKING === 'true') {
          console.log('🔄 [AdminAdsControl] Auto-refresh skipped - user is controlling devices');
        }
      }
    }, 30000); // 30 seconds (reduced from 10s)
    
    // ✨ OPTIMIZATION: Debounce timer for deviceList updates
    let deviceListDebounceTimer: NodeJS.Timeout | null = null;
    
    // ✅ FIXED: Only subscribe if not already subscribed (prevent React StrictMode double-subscription)
    // Use module-level variable to persist across StrictMode cycles
    // This ensures subscription persists even if component re-renders
    if (!globalSubscriptionActive) {
      // ✅ OPTIMIZED: Only log in verbose mode
      if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_WEBSOCKET === 'true') {
        console.log('🔌 [AdminAdsControl] Setting up WebSocket subscription...');
      }
      globalSubscriptionActive = true;
      globalUnsubscribe = playbackWebSocketService.subscribe((update) => {
      // ✅ OPTIMIZED: Only log in verbose debug mode to reduce console noise
      if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_WEBSOCKET === 'true') {
        console.log('🔔 [AdminAdsControl] WebSocket callback triggered!', {
          type: update.type,
          deviceId: update.deviceId,
          materialId: (update as any).materialId,
          hasData: !!(update as any).data,
          timestamp: new Date().toISOString()
        });
      }
      
      // ✅ OPTIMIZED: Only log meaningful updates - filter out frequent displayData with undefined values
      // Skip logging for displayData updates (too frequent and often have undefined values)
      // BUT STILL PROCESS THEM - logging is separate from processing
      const updateAny = update as any;
      const shouldLog = !(updateAny.type === 'displayData' && !update.deviceId && !update.adTitle && !updateAny.materialId);
      if (shouldLog && process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_WEBSOCKET === 'true') {
        // Only log in verbose debug mode
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
          devices: (update as any).devices,
          materialId: (update as any).materialId
        });
      }
      
      // Handle different types of WebSocket updates
      if (update.type === 'adPlaybackUpdate') {
        // Process ad playback updates
        setScreens(prevScreens => {
          // ✅ FIXED: If screens array is empty, skip processing (data not loaded yet)
          if (!prevScreens || prevScreens.length === 0) {
            // Silently skip - screens will load soon
            return prevScreens; // Return unchanged, updates will be processed once screens are loaded
          }
          
          const updatedScreens = prevScreens.map(screen => {
            // ✅ FIXED: Check multiple matching criteria - deviceId can match slot devices, materialId, or displayId
            const isMatchingDevice = screen.slot1DeviceId === update.deviceId || 
                                    screen.slot2DeviceId === update.deviceId ||
                                    screen.deviceId === update.deviceId ||
                                    screen.materialId === update.deviceId ||
                                    screen.displayId === update.deviceId;
            
            if (isMatchingDevice) {
              // ✅ OPTIMIZED: Only log in verbose mode
              if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_WEBSOCKET === 'true') {
                console.log('✅ [AdminAdsControl] Matched adPlaybackUpdate to screen:', {
                  screenMaterialId: screen.materialId,
                  updateDeviceId: update.deviceId
                });
              }
              // ✅ FIXED: Check if this is a new ad or an update to the current ad
              const existingCurrentAd = screen.screenMetrics?.currentAd;
              const isNewAd = !existingCurrentAd || existingCurrentAd.adId !== update.adId;
              
              const newCurrentAd = {
                adId: update.adId || '',
                adTitle: update.adTitle || '',
                adDuration: update.duration || 0,
                // ✅ OPTIMIZED: Store startTime for local calculation
                // Client will calculate progress locally, reducing WebSocket dependency
                startTime: isNewAd 
                  ? (update.startTime || update.timestamp || new Date().toISOString())
                  : (existingCurrentAd.startTime || update.startTime || update.timestamp || new Date().toISOString()),
                // ✅ OPTIMIZED: Only store currentTime/progress for initial sync
                // Client calculates locally using startTime + duration
                // Periodic sync updates (every 5s) will correct any drift
                currentTime: isNewAd ? (update.currentTime || 0) : (existingCurrentAd.currentTime || 0),
                state: update.state || 'playing',
                progress: isNewAd ? (update.progress || 0) : (existingCurrentAd.progress || 0)
              };
              
              // ✅ OPTIMIZED: Only log in verbose mode
              if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_WEBSOCKET === 'true') {
                console.log('🔄 [AdminAdsControl] Updating currentAd from adPlaybackUpdate');
              }
              
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
                  currentAd: newCurrentAd
                }
              };
              
              return updatedScreen;
            }
            return screen;
          });
          
          // ✅ OPTIMIZED: Only log in verbose mode
          if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_WEBSOCKET === 'true') {
            console.log('📋 [AdminAdsControl] Updated screens after adPlaybackUpdate');
          }
          
          return updatedScreens;
        });
      } else if (update.type === 'deviceUpdate') {
        // ✅ OPTIMIZED: Reduced logging - only log in verbose mode
        if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_SCREEN_TRACKING === 'true') {
          console.log(`📱 [AdminAdsControl] Device status update:`, {
            deviceId: update.deviceId,
            isOnline: update.isOnline,
            lastSeen: update.lastSeen
          });
        }
        
        setScreens(prevScreens => {
          return prevScreens.map(screen => {
            // Match by deviceId, materialId, or slot device IDs
            const matchesDevice = screen.deviceId === update.deviceId || 
                                 screen.materialId === update.deviceId ||
                                 screen.displayId === update.deviceId ||
                                 screen.slot1DeviceId === update.deviceId ||
                                 screen.slot2DeviceId === update.deviceId;
            
            if (matchesDevice) {
              // ✅ OPTIMIZED: Reduced logging - only log in verbose mode
              if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_SCREEN_TRACKING === 'true') {
                console.log(`🔄 [AdminAdsControl] Updating screen ${screen.deviceId} (materialId: ${screen.materialId}) status to:`, update.isOnline ? 'ONLINE' : 'OFFLINE');
              }
              
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
      } else if ((update as any).type === 'displayData') {
        // ✨ NEW: Handle real-time display data from ad player
        // ✅ FIXED: Ensure displayData updates are processed even if they don't have deviceId/adTitle at top level
        const updateMaterialId = (update as any).materialId;
        const displayData = (update as any).data;
        
        // ✅ OPTIMIZED: Only log in verbose mode
        if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_WEBSOCKET === 'true') {
          console.log('📺 [AdminAdsControl] Processing displayData update:', {
            materialId: updateMaterialId,
            hasData: !!displayData,
            currentTime: displayData?.currentTime,
            isPaused: displayData?.isPaused
          });
        }
        
        setScreens(prevScreens => {
          // ✅ FIXED: If screens array is empty, skip processing (data not loaded yet)
          if (!prevScreens || prevScreens.length === 0) {
            // Silently skip - screens will load soon
            return prevScreens; // Return unchanged, updates will be processed once screens are loaded
          }
          
          const updatedScreens = prevScreens.map(screen => {
            // Match by materialId (displayData uses materialId, not deviceId)
            const isMatchingScreen = screen.displayId === updateMaterialId || 
                                    screen.materialId === updateMaterialId ||
                                    screen.deviceId === updateMaterialId;
            
            if (isMatchingScreen && displayData) {
              // ✅ OPTIMIZED: Only log in verbose mode
              if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_WEBSOCKET === 'true') {
                console.log('✅ [AdminAdsControl] Matched displayData to screen:', {
                  screenMaterialId: screen.materialId,
                  updateMaterialId: updateMaterialId
                });
              }
              const adDetails = displayData.adDetails;
              
              // If ad details are provided (ad changed), create/update currentAd
              if (adDetails) {
                const newCurrentAd = {
                  adId: adDetails.adId,
                  adTitle: adDetails.adTitle,
                  adDuration: adDetails.adDuration,
                  currentTime: displayData.currentTime || 0,
                  progress: displayData.currentTime && adDetails.adDuration
                    ? (displayData.currentTime / adDetails.adDuration) * 100
                    : 0,
                  state: displayData.isPaused ? 'paused' : 'playing',
                  startTime: screen.screenMetrics?.currentAd?.startTime || new Date().toISOString()
                };
                
                // ✅ OPTIMIZED: Only log in verbose mode
                if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_WEBSOCKET === 'true') {
                  console.log('🔄 [AdminAdsControl] Creating/updating currentAd with adDetails');
                }
                
                return {
                  ...screen,
                  screenMetrics: {
                    ...screen.screenMetrics,
                    currentAd: newCurrentAd,
                    isDisplaying: screen.screenMetrics?.isDisplaying ?? true
                  }
                } as ScreenData;
              }
              
              // If no ad details but we have existing currentAd, just update state
              // ✅ OPTIMIZED: Don't update currentTime/progress from displayData - let client calculate locally
              // Only update state (playing/paused) to reduce WebSocket dependency
              if (screen.screenMetrics?.currentAd) {
                const updatedCurrentAd = {
                  ...screen.screenMetrics.currentAd,
                  // Keep existing currentTime and progress - client calculates locally using startTime
                  // Only update state when it changes
                  state: displayData.isPaused !== undefined ? (displayData.isPaused ? 'paused' : 'playing') : screen.screenMetrics.currentAd.state
                };
                
                // ✅ OPTIMIZED: Only log in verbose mode
                if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_WEBSOCKET === 'true') {
                  console.log('🔄 [AdminAdsControl] Updating currentAd progress');
                }
                
                return {
                  ...screen,
                  screenMetrics: {
                    ...screen.screenMetrics,
                    currentAd: updatedCurrentAd,
                    isDisplaying: screen.screenMetrics?.isDisplaying ?? true
                  }
                } as ScreenData;
              }
            }
            return screen;
          });
          
          // ✅ OPTIMIZED: Only log in verbose mode
          if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_WEBSOCKET === 'true') {
            console.log('📋 [AdminAdsControl] Updated screens after displayData');
          }
          
          return updatedScreens;
        });
      } else if (update.type === 'deviceList') {
        // ✨ OPTIMIZATION: Debounce deviceList updates to prevent spam
        // Empty device lists are being sent repeatedly, causing excessive re-renders
        if (!update.devices || !Array.isArray(update.devices) || update.devices.length === 0) {
          // ✅ OPTIMIZED: Reduced logging
          if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_SCREEN_TRACKING === 'true') {
            console.log(`📋 [AdminAdsControl] Skipping empty deviceList update`);
          }
          return; // Skip empty updates
        }
        
        // Clear previous debounce timer
        if (deviceListDebounceTimer) {
          clearTimeout(deviceListDebounceTimer);
        }
        
        // Debounce: only process after 2 seconds of no new updates
        deviceListDebounceTimer = setTimeout(() => {
          // ✅ OPTIMIZED: Reduced logging - only log in verbose mode
          if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_SCREEN_TRACKING === 'true') {
            console.log(`📋 [AdminAdsControl] Processing debounced deviceList update:`, update.devices);
          }
          
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
      
      // ✅ OPTIMIZED: Only log in verbose mode
      if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_WEBSOCKET === 'true') {
        console.log('✅ [AdminAdsControl] WebSocket subscription registered!');
      }
    }
    
    return () => {
      // ✅ FIXED: Only cleanup intervals/timers immediately, but delay WebSocket cleanup
      // This prevents StrictMode from unsubscribing, but still cleans up on real unmount
      clearInterval(autoRefreshInterval);
      if (deviceListDebounceTimer) {
        clearTimeout(deviceListDebounceTimer);
      }
      
      // ✅ FIXED: Don't cleanup WebSocket subscription on unmount - let it persist
      // React StrictMode causes premature cleanup. Instead, only cleanup when component
      // is actually being destroyed (not just re-rendered). We'll rely on the module-level
      // variable to prevent double subscriptions.
      // The subscription will persist across re-renders and only cleanup on actual page navigation
      // ✅ OPTIMIZED: Only log in verbose mode
      if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_WEBSOCKET === 'true') {
        console.log('⚠️ [AdminAdsControl] Component unmounting, but keeping WebSocket subscription active');
      }
    };
  }, []); // ✅ FIXED: Empty dependency array - subscribe once on mount, cleanup on unmount

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
    // Close Device Details modal if open
    if (showDeviceModal) {
      setShowDeviceModal(false);
      setSelectedDeviceForModal(null);
    }
    setSelectedScreen(screen.deviceId);
    setShowScreenDetails(true);
  };

  const handleMaterialClick = (screen: ScreenData) => {
    // Immediately close Screen Details modal to prevent overlap
    setShowScreenDetails(false);
    setSelectedScreen(null);
    // Open Device Details modal
    setSelectedDeviceForModal(screen);
    setShowDeviceModal(true);
  };

  const handleCloseDeviceModal = () => {
    setShowDeviceModal(false);
    setSelectedDeviceForModal(null);
  };

  const handleCloseScreenDetails = () => {
    // Ensure Device Details modal is also closed
    if (showDeviceModal) {
      setShowDeviceModal(false);
      setSelectedDeviceForModal(null);
    }
    setShowScreenDetails(false);
    setSelectedScreen(null);
  };

  if (loading) {
    return <AdminLoader />;
  }

  const contentMargin = isMobile ? "ml-0 pt-16" : sidebarCollapsed ? "ml-16" : "pl-72";

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
            <h1 className="text-2xl font-bold text-gray-900 mb-2">LCD Control</h1>
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
        {/* LEFT – stretch to fill the row height */}
        <div className="lg:w-1/2 flex flex-col">
          <div className="grid grid-cols-3 sm:grid-cols-2 lg:grid-cols-3 gap-2 flex-1">
            {/* Total Screens */}
            <div className="bg-white p-5 rounded-lg shadow-sm flex flex-col items-center justify-center text-center">
              <div className="flex items-center justify-center gap-2">
                <p className="text-3xl font-semibold text-gray-900">{screens.length}</p>
              </div>
              <p className="text-xs text-gray-600 font-medium mt-1">Total Screens</p>
            </div>

            {/* Online Screens */}
            <div className="bg-white p-5 rounded-lg shadow-sm flex flex-col items-center justify-center text-center">
              <div className="flex items-center justify-center gap-2">
                <p className="text-3xl font-semibold">
                  {screens.filter(s => s.isOnline).length}
                </p>
              </div>
              <p className="text-xs text-gray-600 font-medium mt-1">Online Screens</p>
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
              </div>
              <p className="text-xs text-gray-600 font-medium mt-1">Playing Ads</p>
            </div>
          </div>
        </div>

        {/* RIGHT – also stretch */}
        <div className="lg:w-2/3 flex flex-col">
          <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 gap-4 flex-1 items-center justify-center">
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

            {/* Restart All button removed */}
            {/* <button className="flex flex-col items-center justify-center p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
              <RotateCcw className="w-6 h-6 text-blue-600 mb-2" />
              <span className="text-sm font-medium text-blue-600">Restart All</span>
            </button> */}

            {/* Lock / Unlock All */}
            <button
              onClick={handleToggleLock}
              disabled={actionLoading === 'lock' || actionLoading === 'unlock'}
              className={`flex flex-col items-center justify-center p-4 rounded-lg disabled:opacity-50 ${
                isLocked
                  ? 'bg-green-50 hover:bg-green-100'
                  : 'bg-red-50 hover:bg-red-100'
              }`}
            >
              {actionLoading === 'lock' || actionLoading === 'unlock' ? (
                <Loader2
                  className={`w-6 h-6 mb-2 animate-spin ${
                    isLocked ? 'text-green-600' : 'text-red-600'
                  }`}
                />
              ) : isLocked ? (
                <Unlock className="w-6 h-6 text-green-600 mb-2" />
              ) : (
                <Lock className="w-6 h-6 text-red-600 mb-2" />
              )}
              <span
                className={`text-sm font-medium ${
                  isLocked ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {isLocked ? 'Unlock All' : 'Lock All'}
              </span>
            </button>
          </div>
        </div>
      </div>



      {/* Tabs */}
      <div className="mb-8">
        <nav className="flex space-x-2 px-6">
          {[
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'notifications', label: 'Notifications' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center py-4 px-2 font-medium text-sm transition-colors group ${
                activeTab === tab.id ? 'text-[#3674B5]' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              <span
                className={`absolute bottom-0 left-0 h-[2px] bg-[#3674B5] transition-all duration-300
                  ${activeTab === tab.id ? 'w-full' : 'w-0 group-hover:w-full'}
                `}
              />
            </button>
          ))}
        </nav>

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
      {showScreenDetails && selectedScreen && !showDeviceModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
          onClick={handleCloseScreenDetails}
        >
          <div 
            className="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Screen Details - {selectedScreen}</h3>
              <button
                onClick={handleCloseScreenDetails}
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
                      onClick={handleCloseScreenDetails}
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
      {showDeviceModal && selectedDeviceForModal && !showScreenDetails && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
          onClick={handleCloseDeviceModal}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Device Details - {selectedDeviceForModal.deviceId}</h3>
              <button
                onClick={handleCloseDeviceModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600">Device ID</label>
                  <p className="text-lg font-medium">{selectedDeviceForModal.deviceId}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-600">Material ID</label>
                  <p className="text-lg font-medium">{selectedDeviceForModal.materialId}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Screen Type</label>
                    <p className="text-lg font-medium">{selectedDeviceForModal.screenType || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Slot Number</label>
                    <p className="text-lg font-medium">{selectedDeviceForModal.slotNumber || 'N/A'}</p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Status</label>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(selectedDeviceForModal.isOnline ? 'online' : 'offline')}
                    <span className="text-sm font-medium">
                      {getStatusText(selectedDeviceForModal.isOnline ? 'online' : 'offline')}
                    </span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-600">Last Seen</label>
                  <p className="text-lg font-medium">{new Date(selectedDeviceForModal.lastSeen).toLocaleString()}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-600">Location</label>
                  <p className="text-lg font-medium">
                    {selectedDeviceForModal.currentLocation?.address || 'Location not available'}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end">
                <button
                  onClick={handleCloseDeviceModal}
                  className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAdsControl;