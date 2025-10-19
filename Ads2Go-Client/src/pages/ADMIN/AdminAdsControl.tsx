import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  Square, 
  RotateCcw, 
  RefreshCw, 
  AlertTriangle, 
  Lock, 
  Unlock,
  BarChart3,
  Eye,
  Volume2,
  SkipForward,
  Monitor,
  TrendingUp,
  AlertCircle,
  XCircle,
  PlayCircle,
  Wifi,
  Sun,
  Upload,
  Loader2,
  FileVideo
} from 'lucide-react';
// Icons are imported individually to avoid unused imports
import { ScreenData, AdAnalytics } from '../../types/screenTypes';
import { adsPanelService } from '../../services/adsPanelService';
import playbackWebSocketService from '../../services/playbackWebSocketService';
import { useApolloClient } from '@apollo/client';
import { createGraphQLService } from '../../services/graphQLService';

// Import tab components
import Dashboard from './tabs/dashboard/Dashboard';
import ScreenControl from './tabs/adminAdsControl/ScreenControl';
import CompanyAdsManagement from './tabs/manageAds/CompanyAdsManagement';
import NotificationDashboard from './tabs/dashboard/NotificationDashboard';
import Alerts from './tabs/adminAdsControl/Alerts';
import { AdminLoader } from "../../components/ProtectedRoute";
import SubtleLoader from "../../components/SubtleLoader";

const AdminAdsControl: React.FC = () => {
  // Component loaded
  
  // Initialize GraphQL service
  const apolloClient = useApolloClient();
  const graphQLService = createGraphQLService(apolloClient);
  
  const [selectedScreens, setSelectedScreens] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedScreen, setSelectedScreen] = useState<string | null>(null);
  
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
  const [showScreenDetails, setShowScreenDetails] = useState(false);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [selectedDeviceForModal, setSelectedDeviceForModal] = useState<ScreenData | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);

  const [screen, setScreen] = useState<ScreenData | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);

  // Responsive state
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setScreen(null);
      }
    }

    if (screen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [screen]);

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
      
      // Fetch screens data using compliance endpoint for real-time status
      try {
        console.log('🔍 Fetching screens data via compliance API for real-time status...');
        const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace('/graphql', '').replace(/\/$/, '');
        const complianceUrl = `${baseUrl}/screenTracking/compliance?date=${new Date().toISOString().split('T')[0]}`;
        
        const response = await fetch(complianceUrl, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const complianceData = await response.json();
          console.log('📊 Compliance data received:', complianceData);
          
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
                  slotStatus: screen.slotStatus // Keep original slot status for reference
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
            
            // Log current ad information for debugging
            processedScreens.forEach((screen: any) => {
              if (screen.screenMetrics?.currentAd) {
                console.log(`🎬 Initial load - Screen ${screen.deviceId} current ad:`, screen.screenMetrics.currentAd.adTitle);
              }
            });
          } else {
            console.warn('⚠️ Unexpected compliance data format:', complianceData);
            setScreens([]);
          }
        } else {
          console.error('❌ Error fetching compliance data:', response.status, response.statusText);
          setScreens([]);
        }
      } catch (screensError) {
        console.error('❌ Error fetching screens:', screensError);
        setScreens([]);
      }
      
      // Fetch other data in parallel using REST API
      try {
        console.log('🔄 Fetching additional data via REST API...');
        const analyticsData = await apiService.getAdAnalytics();
        setAdAnalytics(analyticsData);
      } catch (otherError) {
        console.error('❌ Error fetching additional data:', otherError);
        // Handle timeout errors specifically
        if (otherError instanceof Error && otherError.name === 'TimeoutError') {
          console.warn('⚠️ Request timed out - this is usually due to slow server response');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      console.error('Error fetching data:', err);
    } finally {
      // Only set loading to false on initial load or manual refresh
      if (isInitialLoad || isManualRefresh) {
        console.log('🔄 Setting loading to false - isInitialLoad:', isInitialLoad, 'isManualRefresh:', isManualRefresh);
        setLoading(false);
      }
      // Mark as initially loaded after first successful load
      if (isInitialLoad) {
        setHasInitiallyLoaded(true);
      }
      // Always reset refreshing state
      setIsRefreshing(false);
      setLastRefresh(new Date());
    }
  }, [hasInitiallyLoaded, apiService]);

  // Auto-refresh function that never shows loading
  const autoRefreshData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      console.log('🔄 Auto-refresh - fetching data silently...');
      
      // Fetch screens data using compliance endpoint for real-time status
      try {
        const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace('/graphql', '').replace(/\/$/, '');
        const complianceUrl = `${baseUrl}/screenTracking/compliance?date=${new Date().toISOString().split('T')[0]}`;
        
        const response = await fetch(complianceUrl, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const complianceData = await response.json();
          
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
                  slotStatus: screen.slotStatus // Keep original slot status for reference
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
                // Log current ad information for debugging
                processedScreens.forEach((screen: any) => {
                  if (screen.screenMetrics?.currentAd) {
                    console.log(`🎬 Screen ${screen.deviceId} current ad:`, screen.screenMetrics.currentAd.adTitle);
                  }
                });
              } else {
                console.log('📊 No changes detected in screen data');
              }
              return processedScreens;
            });
          }
        }
      } catch (screensError) {
        console.error('❌ Error fetching screens during auto-refresh:', screensError);
      }
      
      // Fetch other data in parallel using REST API
      try {
        const analyticsData = await apiService.getAdAnalytics();
        setAdAnalytics(analyticsData);
      } catch (otherError) {
        console.error('❌ Error fetching additional data during auto-refresh:', otherError);
        // Handle timeout errors specifically
        if (otherError instanceof Error && otherError.name === 'TimeoutError') {
          console.warn('⚠️ Auto-refresh request timed out - this is usually due to slow server response');
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
    
    // Removed aggressive auto-refresh - rely on WebSocket updates for real-time data
    // Users can manually refresh using the refresh button if needed
    
    // Subscribe to real-time WebSocket updates for immediate processing
    const unsubscribe = playbackWebSocketService.subscribe((update) => {
      console.log('🎬 [AdminAdsControl] Received real-time playback update:', {
        deviceId: update.deviceId,
        adTitle: update.adTitle,
        state: update.state,
        currentTime: update.currentTime,
        progress: update.progress,
        timestamp: update.timestamp
      });
      
      // Process updates immediately for perfect real-time sync
      // Update the screens state with real-time data immediately
      setScreens(prevScreens => {
        return prevScreens.map(screen => {
          if (screen.deviceId === update.deviceId) {
            console.log(`🔄 [AdminAdsControl] Updating screen ${screen.deviceId} with real-time data:`, {
              currentTime: update.currentTime,
              progress: update.progress,
              state: update.state,
              timestamp: update.timestamp
            });
            
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
                  adId: update.adId,
                  adTitle: update.adTitle,
                  adDuration: update.duration,
                  startTime: update.timestamp,
                  currentTime: update.currentTime,
                  state: update.state,
                  progress: update.progress
                }
              }
            };
            
            // Force immediate re-render by creating new object reference
            return updatedScreen;
          }
          return screen;
        });
      });
    });
    
    return () => {
      // clearInterval(interval); // No longer needed
      unsubscribe();
    };
  }, [fetchData, autoRefreshData]);

  // Toggle play/pause handler
  const handleTogglePlayPause = async () => {
    try {
      const action = isCurrentlyPlaying ? 'pause' : 'play';
      setActionLoading(action);
      
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
    }
  };

  // Toggle lock/unlock handler
  const handleToggleLock = async () => {
    try {
      const action = isLocked ? 'unlock' : 'lock';
      setActionLoading(action);
      
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
    }
  };

  // Listen for WebSocket messages to detect play/pause state changes
  useEffect(() => {
    const handleWebSocketMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        
        // Listen for pause/resume messages from ad players
        if (message.type === 'pauseAll' || message.type === 'resumeAll') {
          console.log(`🔄 [AdminAdsControl] Received ${message.type} message, updating state`);
          setIsCurrentlyPlaying(message.type === 'resumeAll');
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    // Add WebSocket listener if available
    if (playbackWebSocketService && playbackWebSocketService.ws) {
      playbackWebSocketService.ws.addEventListener('message', handleWebSocketMessage);
      
      return () => {
        if (playbackWebSocketService.ws) {
          playbackWebSocketService.ws.removeEventListener('message', handleWebSocketMessage);
        }
      };
    }
  }, []);

  // Action handlers
  const handleBulkAction = async (action: string) => {
    try {
      setActionLoading(action);
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
        case 'unlock':
          result = await apiService.unlockAllScreens();
          break;
        default:
          throw new Error('Unknown action');
      }
      
      if (result.success) {
        // Refresh data after successful action
        await fetchData();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleScreenAction = async (deviceId: string, action: string, value?: any) => {
    try {
      setActionLoading(`${deviceId}-${action}`);
      let result;
      
      switch (action) {
        case 'metrics':
          result = await apiService.updateScreenMetrics(deviceId, value);
          break;
        case 'start-session':
          result = await apiService.startScreenSession(deviceId);
          break;
        case 'end-session':
          result = await apiService.endScreenSession(deviceId);
          break;
        case 'track-ad':
          result = await apiService.trackAdPlayback(deviceId, value.adId, value.adTitle, value.adDuration);
          break;
        case 'end-ad':
          result = await apiService.endAdPlayback(deviceId);
          break;
        case 'driver-activity':
          result = await apiService.updateDriverActivity(deviceId, value);
          break;
        default:
          throw new Error('Unknown action');
      }
      
      if (result.success) {
        // Refresh data after successful action
        await fetchData();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(null);
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
        <div className="flex justify-between mt-4 items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">AdsPanel - LCD Control Center</h1>
            {/* Show subtle loader during auto-refresh */}
            {isRefreshing && (
              <div className="flex items-center text-xs text-gray-400 mt-1">
                <div className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></div>
                <span>Refreshing data...</span>
              </div>
            )}
          </div>
        </div>
      </div>
 
      {/* Wrapper for Status Overview + Master Controls */}
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
  
  {/* Status Overview (Left Side) */}
  <div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {/* Total Screens */}
      <div className="bg-white p-4 rounded-md shadow-md">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-100 rounded-full">
            <Monitor className="h-5 w-5 text-blue-600" />
          </div>
          <p className="text-sm font-medium text-gray-600">Total Screens</p>
        </div>
        <div className="pl-10 mt-1">
          <p className="text-2xl font-semibold text-gray-900">{screens.length}</p>
        </div>
      </div>

      {/* Online Screens */}
      <div className="bg-white p-4 rounded-md shadow-md">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-green-100 rounded-full">
            <Wifi className="h-5 w-5 text-green-600" />
          </div>
          <p className="text-sm font-medium text-gray-600">Online Screens</p>
        </div>
        <div className="pl-10 mt-1">
          <p className="text-2xl font-semibold text-green-600">
            {screens.filter(s => s.isOnline).length}
          </p>
        </div>
      </div>

      {/* Playing Ads */}
      <div className="bg-white p-4 rounded-md shadow-md">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-100 rounded-full">
            <PlayCircle className="h-5 w-5 text-blue-600" />
          </div>
          <p className="text-sm font-medium text-gray-600">Playing Ads</p>
        </div>
        <div className="pl-10 mt-1">
          <p className="text-2xl font-semibold text-blue-600">
            {screens.filter(s => s.screenMetrics?.isDisplaying).length}
          </p>
        </div>
      </div>
    </div>
  </div>

  {/* Master Controls (Right Side) */}
  <div>
    <h2 className="text-xl font-semibold mb-3 flex items-center">
      Master Controls 
      <span className="text-sm text-gray-600 ml-2 font-medium">for AdsPlayer</span>
    </h2>
    <div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <button 
          onClick={() => handleBulkAction('sync')}
          disabled={actionLoading === 'sync'}
          className="flex flex-col items-center p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
        >
          {actionLoading === 'sync' ? <Loader2 className="w-6 h-6 text-blue-600 mb-2 animate-spin" /> : <RefreshCw className="w-6 h-6 text-blue-600 mb-2" />}
          <span className="text-sm font-medium text-blue-600">Sync All</span>
        </button>

        <button 
          onClick={handleTogglePlayPause}
          disabled={actionLoading === 'play' || actionLoading === 'pause'}
          className={`flex flex-col items-center p-4 rounded-lg transition-colors disabled:opacity-50 ${
            isCurrentlyPlaying 
              ? 'bg-yellow-50 hover:bg-yellow-100' 
              : 'bg-green-50 hover:bg-green-100'
          }`}
        >
          {actionLoading === 'play' || actionLoading === 'pause' ? (
            <Loader2 className={`w-6 h-6 mb-2 animate-spin ${
              isCurrentlyPlaying ? 'text-yellow-600' : 'text-green-600'
            }`} />
          ) : isCurrentlyPlaying ? (
            <Pause className="w-6 h-6 text-yellow-600 mb-2" />
          ) : (
            <Play className="w-6 h-6 text-green-600 mb-2" />
          )}
          <span className={`text-sm font-medium ${
            isCurrentlyPlaying ? 'text-yellow-600' : 'text-green-600'
          }`}>
            {isCurrentlyPlaying ? 'Pause All' : 'Play All'}
          </span>
        </button>

        <button className="flex flex-col items-center p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors">
          <RotateCcw className="w-6 h-6 text-purple-600 mb-2" />
          <span className="text-sm font-medium text-purple-600">Restart All</span>
        </button>

        <button className="flex flex-col items-center p-4 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors">
          <AlertTriangle className="w-6 h-6 text-orange-600 mb-2" />
          <span className="text-sm font-medium text-orange-600">Emergency</span>
        </button>

        <button 
          onClick={handleToggleLock}
          disabled={actionLoading === 'lock' || actionLoading === 'unlock'}
          className={`flex flex-col items-center p-4 rounded-lg transition-colors disabled:opacity-50 ${
            isLocked 
              ? 'bg-green-50 hover:bg-green-100' 
              : 'bg-gray-50 hover:bg-gray-100'
          }`}
        >
          {actionLoading === 'lock' || actionLoading === 'unlock' ? (
            <Loader2 className={`w-6 h-6 mb-2 animate-spin ${
              isLocked ? 'text-green-600' : 'text-gray-600'
            }`} />
          ) : isLocked ? (
            <Unlock className="w-6 h-6 text-green-600 mb-2" />
          ) : (
            <Lock className="w-6 h-6 text-gray-600 mb-2" />
          )}
          <span className={`text-sm font-medium ${
            isLocked ? 'text-green-600' : 'text-gray-600'
          }`}>
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
              { id: 'company-ads', label: 'Company Ads', icon: FileVideo },
              { id: 'notifications', label: 'Notifications', icon: AlertTriangle },
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
              onRefresh={() => fetchData(true)}
              onSelectAll={handleSelectAll}
              onDeselectAll={handleDeselectAll}
              onScreenSelect={handleScreenSelect}
              onScreenClick={handleScreenClick}
              onMaterialClick={handleMaterialClick}
              onBulkAction={handleBulkAction}
              getStatusIcon={getStatusIcon}
              getStatusText={getStatusText}
              formatTime={formatTime}
            />
          )}

          {activeTab === 'screens' && (
            <ScreenControl
              screens={screens}
              onScreenAction={handleScreenAction}
              getStatusIcon={getStatusIcon}
              getStatusText={getStatusText}
              formatTime={formatTime}
            />
          )}


          {activeTab === 'company-ads' && (
            <CompanyAdsManagement />
          )}

          {activeTab === 'notifications' && (
            <NotificationDashboard />
          )}

          {activeTab === 'alerts' && (
            <Alerts
              alerts={[]}
              onResolveAlert={(alertId) => {
                console.log('Resolving alert:', alertId);
                // Handle alert resolution logic here
              }}
              onViewAlert={(alertId) => {
                console.log('Viewing alert:', alertId);
                // Handle alert viewing logic here
              }}
            />
          )}
        </div>
      </div>

      {/* Screen Details Modal */}
      {showScreenDetails && selectedScreen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowScreenDetails(false)} // Add this click handler
        >
          <div 
            className="bg-white rounded-md p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()} // Prevent click inside from closing
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">{selectedScreen}</h3>
            </div>
            
            {(() => {
              const screen = screens.find(s => s.deviceId === selectedScreen);
              if (!screen) return null;
              
              return (
                <div className="space-y-6">
                  {/* Basic Info */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center border-b border-gray-100 py-2">
                      <span className="text-sm font-medium text-gray-600">Device ID</span>
                      <span className="text-sm font-semibold text-gray-900">{screen.deviceId}</span>
                    </div>

                    <div className="flex justify-between items-center border-b border-gray-100 py-2">
                      <span className="text-sm font-medium text-gray-600">Material ID</span>
                      <span className="text-sm font-semibold text-gray-900">{screen.materialId}</span>
                    </div>

                    <div className="flex justify-between items-center border-b border-gray-100 py-2">
                      <span className="text-sm font-medium text-gray-600">Slot</span>
                      <span className="text-sm font-semibold text-gray-900">{screen.slotNumber}</span>
                    </div>

                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm font-medium text-gray-600">Location</span>
                      <span className="text-sm font-semibold text-gray-900 text-right">
                        {screen.currentLocation?.address || 'Location not available'}
                      </span>
                    </div>
                  </div>
                  {/* Current Ad */}
                  {screen.screenMetrics?.currentAd && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium mb-3">Current Ad</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-600">Ad Title</label>
                          <p className="text-lg font-medium">{screen.screenMetrics.currentAd.adTitle}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-600">Ad ID</label>
                          <p className="text-lg font-medium">{screen.screenMetrics.currentAd.adId}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-600">Duration</label>
                          <p className="text-lg font-medium">{screen.screenMetrics.currentAd.adDuration}s</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-600">Started</label>
                          <p className="text-lg font-medium">{new Date(screen.screenMetrics.currentAd.startTime).toLocaleTimeString()}</p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="flex justify-between text-sm text-gray-600 mb-1">
                          <span>Total Ads Played: {screen.screenMetrics.adPlayCount}</span>
                          <span>Display Hours: {screen.screenMetrics.displayHours.toFixed(1)}h</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: '0%' }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Controls */}
                  <div>
                    <h4 className="font-medium mb-3 mt-9">Screen Controls</h4>
                    <div className="flex flex-col gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-2">Brightness</label>
                        <div className="flex items-center space-x-2">
                          <Sun className="w-4 h-4 text-yellow-500" />
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={screen.screenMetrics?.brightness || 0}
                            className="flex-1"
                          />
                          <span className="text-sm font-medium">{screen.screenMetrics?.brightness || 0}%</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-2">Volume</label>
                        <div className="flex items-center space-x-2">
                          <Volume2 className="w-4 h-4 text-green-500" />
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={screen.screenMetrics?.volume || 0}
                            className="flex-1"
                          />
                          <span className="text-sm font-medium">{screen.screenMetrics?.volume || 0}%</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-center space-x-2 mt-4">
                      <button className="flex items-center space-x-2 px-4 py-2 bg-green-100 text-green-600 rounded-md hover:bg-green-200">
                        <Play className="w-4 h-4" />
                        <span>Play</span>
                      </button>
                      <button className="flex items-center space-x-2 px-4 py-2 bg-yellow-100 text-yellow-600 rounded-md hover:bg-yellow-200">
                        <Pause className="w-4 h-4" />
                        <span>Pause</span>
                      </button>
                      <button className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-600 rounded-md hover:bg-red-200">
                        <Square className="w-4 h-4" />
                        <span>Stop</span>
                      </button>
                      <button className="flex items-center space-x-2 px-4 py-2 bg-blue-100 text-blue-600 rounded-md hover:bg-blue-200">
                        <SkipForward className="w-4 h-4" />
                        <span>Next</span>
                      </button>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-between space-x-2">
                    <button
                      onClick={() => setShowScreenDetails(false)}
                      className="px-4 py-2 border text-gray-700 rounded-md hover:bg-gray-100"
                    >
                      Close
                    </button>
                    <button className="px-4 py-2 bg-[#3674B5] text-white rounded-md hover:bg-[#3674B5]/80">
                      Save Changes
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
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
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