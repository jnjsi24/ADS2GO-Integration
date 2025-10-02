import React, { useState, useEffect, useCallback } from 'react';
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

// Import tab components
import Dashboard from './tabs/dashboard/Dashboard';
import ScreenControl from './tabs/adminAdsControl/ScreenControl';
import ContentManagement from './tabs/manageAds/ContentManagement';
import CompanyAdsManagement from './tabs/manageAds/CompanyAdsManagement';
import NotificationDashboard from './tabs/dashboard/NotificationDashboard';
import Alerts from './tabs/adminAdsControl/Alerts';

const AdminAdsControl: React.FC = () => {
  // Cache busting - force component reload
  console.log('🔄 AdminAdsControl NEW VERSION loaded - Cache busted at:', new Date().toISOString());
  
  const [selectedScreens, setSelectedScreens] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedScreen, setSelectedScreen] = useState<string | null>(null);
  
  // Real data states
  const [screens, setScreens] = useState<ScreenData[]>([]);
  const [adAnalytics, setAdAnalytics] = useState<AdAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Debug loading state changes
  useEffect(() => {
    console.log('🔄 Loading state changed to:', loading);
  }, [loading]);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showScreenDetails, setShowScreenDetails] = useState(false);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [selectedDeviceForModal, setSelectedDeviceForModal] = useState<ScreenData | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);

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
      
      // Fetch screens data using REST API (compliance endpoint)
      try {
        console.log('🔍 Fetching screens data via REST API...');
        const screensResponse = await apiService.getScreens();
        console.log('📊 Screens data received:', screensResponse);
        
        if (screensResponse && Array.isArray(screensResponse.screens)) {
          console.log(`✅ Found ${screensResponse.screens.length} screens`);
          setScreens(screensResponse.screens);
          
          // Log all device IDs for debugging
          console.log('📋 Device IDs:', screensResponse.screens.map((s: any) => ({
            deviceId: s.deviceId,
            materialId: s.materialId,
            isOnline: s.isOnline,
            lastSeen: s.lastSeen,
            screenMetrics: s.screenMetrics,
            currentAd: s.screenMetrics?.currentAd
          })));
          
          // Log current ad information for debugging
          screensResponse.screens.forEach((screen: any) => {
            if (screen.screenMetrics?.currentAd) {
              console.log(`🎬 Initial load - Screen ${screen.deviceId} current ad:`, screen.screenMetrics.currentAd.adTitle);
            }
          });
        } else {
          console.warn('⚠️ Unexpected screens data format:', screensResponse);
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
      console.log('🔄 Auto-refresh - fetching data silently...');
      
      // Fetch screens data using REST API
      try {
        const screensResponse = await apiService.getScreens();
        if (screensResponse && Array.isArray(screensResponse.screens)) {
          setScreens(prevScreens => {
            const hasChanged = JSON.stringify(prevScreens) !== JSON.stringify(screensResponse.screens);
            if (hasChanged) {
              console.log('📊 Screen data updated via auto-refresh');
              // Log current ad information for debugging
              screensResponse.screens.forEach((screen: any) => {
                if (screen.screenMetrics?.currentAd) {
                  console.log(`🎬 Screen ${screen.deviceId} current ad:`, screen.screenMetrics.currentAd.adTitle);
                }
              });
            } else {
              console.log('📊 No changes detected in screen data');
            }
            return screensResponse.screens;
          });
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
      }
      
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error during auto-refresh:', err);
    }
  }, [apiService]);

  // Load data on component mount
  useEffect(() => {
    fetchData();
    
    // Set up auto-refresh every 5 seconds (reduced to not override WebSocket updates)
    const interval = setInterval(autoRefreshData, 5000);
    
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
            
            const updatedScreen = {
              ...screen,
              screenMetrics: {
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
      clearInterval(interval);
      unsubscribe();
    };
  }, [fetchData, autoRefreshData]);

  // Action handlers
  const handleBulkAction = async (action: string) => {
    try {
      setActionLoading(action);
      let result;
      
      // Use GraphQL mutations for bulk actions
      switch (action) {
        case 'sync':
          result = await graphQLService.syncAllScreens();
          break;
        case 'play':
          result = await graphQLService.playAllScreens();
          break;
        case 'pause':
          result = await graphQLService.pauseAllScreens();
          break;
        case 'stop':
          result = await graphQLService.stopAllScreens();
          break;
        case 'restart':
          result = await graphQLService.restartAllScreens();
          break;
        case 'emergency':
          result = await graphQLService.emergencyStopAll();
          break;
        case 'lockdown':
          result = await graphQLService.lockdownAllScreens();
          break;
        case 'unlock':
          result = await graphQLService.unlockAllScreens();
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
          result = await graphQLService.updateScreenMetrics(deviceId, value);
          break;
        case 'start-session':
          result = await graphQLService.startScreenSession(deviceId);
          break;
        case 'end-session':
          result = await graphQLService.endScreenSession(deviceId);
          break;
        case 'track-ad':
          result = await graphQLService.trackAdPlayback(deviceId, value.adId, value.adTitle, value.adDuration);
          break;
        case 'end-ad':
          result = await graphQLService.endAdPlayback(deviceId);
          break;
        case 'driver-activity':
          result = await graphQLService.updateDriverActivity(deviceId, value);
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

  // Mock data for analytics and alerts (fallback)
  const mockAnalytics = {
    totalViewTime: '2h 45m',
    avgCompletionRate: 87,
    totalImpressions: 1250,
    totalRevenue: 3125
  };

  const mockAlerts = [
    { id: 1, type: 'critical' as const, message: 'Device ABC123 offline for 2+ hours', timestamp: '2 minutes ago' },
    { id: 2, type: 'high' as const, message: 'Low battery on device XYZ789', timestamp: '15 minutes ago' },
    { id: 3, type: 'medium' as const, message: 'Ad playback error on device DEF456', timestamp: '1 hour ago' },
    { id: 4, type: 'low' as const, message: 'Scheduled maintenance completed', timestamp: '2 hours ago' }
  ];

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
    return (
      <div className="pt-10 pb-10 pl-72 p-8 bg-[#f9f9fc] min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading AdsPanel...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pt-10 pb-10 pl-72 p-8 bg-[#f9f9fc] min-h-screen flex items-center justify-center">
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
    <div className="pt-10 pb-10 pl-72 p-8 bg-[#f9f9fc] min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">AdsPanel - LCD Control Center</h1>
          </div>
          <button 
            onClick={() => fetchData(true)}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>
 
      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-2">
        {/* Total Screens */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center justify-center gap-16">
            <Monitor className="w-8 h-8 text-blue-500" />
            <div className="flex flex-col items-center">
              <p className="text-3xl font-bold text-gray-900">{screens.length}</p>
              <p className="text-sm text-gray-600">Total Screens</p>
            </div>
          </div>
        </div>
        {/* Online Screens */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center justify-center gap-3">
            <div className="flex flex-col items-center">
              <p className="text-2xl font-bold text-green-600">
                {screens.filter(s => s.isOnline).length}
              </p>
              <p className="text-sm text-gray-600">Online Screens</p>
            </div>
            <Wifi className="w-8 h-8 text-green-500" />
          </div>
        </div>

        {/* Playing Ads */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center justify-center gap-3">
            <div className="flex flex-col items-center">
              <p className="text-2xl font-bold text-blue-600">
                {screens.filter(s => s.screenMetrics?.isDisplaying).length}
              </p>
              <p className="text-sm text-gray-600">Playing Ads</p>
            </div>
            <PlayCircle className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        {/* Total Impressions */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center justify-center gap-3">
            <div className="flex flex-col items-center">
              <p className="text-2xl font-bold text-purple-600">
                {adAnalytics?.summary.totalAdsPlayed || 0}
              </p>
              <p className="text-sm text-gray-600">Total Impressions</p>
            </div>
            <Eye className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      
      {/* Master Controls */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-3">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Monitor className="w-5 h-5 mr-2" />
          Master Controls
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <button 
            onClick={() => handleBulkAction('sync')}
            disabled={actionLoading === 'sync'}
            className="flex flex-col items-center p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
          >
            {actionLoading === 'sync' ? <Loader2 className="w-6 h-6 text-blue-600 mb-2 animate-spin" /> : <RefreshCw className="w-6 h-6 text-blue-600 mb-2" />}
            <span className="text-sm font-medium text-blue-600">Sync All</span>
          </button>
          <button 
            onClick={() => handleBulkAction('play')}
            disabled={actionLoading === 'play'}
            className="flex flex-col items-center p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
          >
            {actionLoading === 'play' ? <Loader2 className="w-6 h-6 text-green-600 mb-2 animate-spin" /> : <Play className="w-6 h-6 text-green-600 mb-2" />}
            <span className="text-sm font-medium text-green-600">Play All</span>
          </button>
          <button 
            onClick={() => handleBulkAction('pause')}
            disabled={actionLoading === 'pause'}
            className="flex flex-col items-center p-4 bg-yellow-50 hover:bg-yellow-100 rounded-lg transition-colors disabled:opacity-50"
          >
            {actionLoading === 'pause' ? <Loader2 className="w-6 h-6 text-yellow-600 mb-2 animate-spin" /> : <Pause className="w-6 h-6 text-yellow-600 mb-2" />}
            <span className="text-sm font-medium text-yellow-600">Pause All</span>
          </button>
          <button 
            onClick={() => handleBulkAction('stop')}
            disabled={actionLoading === 'stop'}
            className="flex flex-col items-center p-4 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
          >
            {actionLoading === 'stop' ? <Loader2 className="w-6 h-6 text-red-600 mb-2 animate-spin" /> : <Square className="w-6 h-6 text-red-600 mb-2" />}
            <span className="text-sm font-medium text-red-600">Stop All</span>
          </button>
          <button className="flex flex-col items-center p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors">
            <RotateCcw className="w-6 h-6 text-purple-600 mb-2" />
            <span className="text-sm font-medium text-purple-600">Restart All</span>
          </button>
          <button className="flex flex-col items-center p-4 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors">
            <AlertTriangle className="w-6 h-6 text-orange-600 mb-2" />
            <span className="text-sm font-medium text-orange-600">Emergency</span>
          </button>
          <button className="flex flex-col items-center p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
            <Lock className="w-6 h-6 text-gray-600 mb-2" />
            <span className="text-sm font-medium text-gray-600">Lockdown</span>
          </button>
          <button className="flex flex-col items-center p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
            <Unlock className="w-6 h-6 text-green-600 mb-2" />
            <span className="text-sm font-medium text-green-600">Unlock</span>
          </button>
        </div>
      </div>


      {/* Tabs */}
      <div className="mb-8">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
              { id: 'screens', label: 'Screen Control', icon: Monitor },
              { id: 'content', label: 'Content Management', icon: Upload },
              { id: 'company-ads', label: 'Company Ads', icon: FileVideo },
              { id: 'notifications', label: 'Notifications', icon: AlertTriangle },
              { id: 'alerts', label: 'Alerts', icon: AlertTriangle }
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

          {activeTab === 'content' && (
            <ContentManagement
              onDeployAd={(adId, targetScreens, schedule) => {
                console.log('Deploying ad:', { adId, targetScreens, schedule });
                // Handle ad deployment logic here
              }}
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
              alerts={mockAlerts}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600">Device ID</label>
                      <p className="text-lg font-medium">{screen.deviceId}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600">Material ID</label>
                      <p className="text-lg font-medium">{screen.materialId}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600">Slot</label>
                      <p className="text-lg font-medium">{screen.slotNumber}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600">Location</label>
                      <p className="text-lg font-medium">
                        {screen.currentLocation?.address || 'Unknown Location'}
                      </p>
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
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-3">Screen Controls</h4>
                    <div className="grid grid-cols-2 gap-4">
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
                    
                    <div className="flex items-center justify-center space-x-4 mt-4">
                      <button className="flex items-center space-x-2 px-4 py-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200">
                        <Play className="w-4 h-4" />
                        <span>Play</span>
                      </button>
                      <button className="flex items-center space-x-2 px-4 py-2 bg-yellow-100 text-yellow-600 rounded-lg hover:bg-yellow-200">
                        <Pause className="w-4 h-4" />
                        <span>Pause</span>
                      </button>
                      <button className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200">
                        <Square className="w-4 h-4" />
                        <span>Stop</span>
                      </button>
                      <button className="flex items-center space-x-2 px-4 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200">
                        <SkipForward className="w-4 h-4" />
                        <span>Next</span>
                      </button>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => setShowScreenDetails(false)}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                    >
                      Close
                    </button>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
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
                  {selectedDeviceForModal.currentLocation?.address || 'Unknown Location'}
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