import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Square, 
  RotateCcw, 
  RefreshCw, 
  AlertTriangle, 
  Lock, 
  Unlock,
  Settings,
  BarChart3,
  Eye,
  Volume2,
  VolumeX,
  SkipForward,
  SkipBack,
  Monitor,
  Smartphone,
  MapPin,
  Clock,
  TrendingUp,
  Users,
  DollarSign,
  Activity,
  AlertCircle,
  CheckCircle,
  XCircle,
  PauseCircle,
  PlayCircle,
  Zap,
  Wifi,
  WifiOff,
  Battery,
  BatteryLow,
  Sun,
  Moon,
  Volume1,
  Volume2 as Volume2Icon,
  VolumeX as VolumeXIcon,
  ChevronDown,
  ChevronUp,
  Filter,
  Search,
  Download,
  Upload,
  MoreHorizontal,
  Info,
  ExternalLink,
  Loader2
} from 'lucide-react';
// Icons are imported individually to avoid unused imports
import { adsPanelService, ScreenData, ComplianceReport, AdAnalytics } from '../../services/adsPanelServiceNew';
import '../../services/testEndpoints';

const AdminAdsControl: React.FC = () => {
  // Cache busting - force component reload
  console.log('🔄 AdminAdsControl NEW VERSION loaded - Cache busted at:', new Date().toISOString());
  
  const [selectedScreens, setSelectedScreens] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedScreen, setSelectedScreen] = useState<string | null>(null);
  
  // Real data states
  const [screens, setScreens] = useState<ScreenData[]>([]);
  const [complianceReport, setComplianceReport] = useState<ComplianceReport | null>(null);
  const [adAnalytics, setAdAnalytics] = useState<AdAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showScreenDetails, setShowScreenDetails] = useState(false);

  // Inline API service to bypass any caching issues
  const inlineApiService = {
    async makeRequest(endpoint: string, options: RequestInit = {}) {
      const url = `http://localhost:5000${endpoint}`;
      console.log('🚀 INLINE SERVICE - Making API request to:', url);
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        console.error('❌ INLINE SERVICE - API request failed:', url, response.status, response.statusText);
        throw new Error(`API request failed: ${response.statusText}`);
      }

      console.log('✅ INLINE SERVICE - API request successful:', url);
      return response.json();
    },

    async getScreens() {
      const response = await this.makeRequest('/screenTracking/screens');
      return response.data;
    },

    async getComplianceReport() {
      const response = await this.makeRequest('/screenTracking/compliance');
      return response.data;
    },

    async getAdAnalytics() {
      const response = await this.makeRequest('/screenTracking/adAnalytics');
      return response.data;
    }
  };

  // Data fetching functions
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 Fetching data from server...');
      
      // First, try to fetch screens data separately to debug
      try {
        console.log('🔍 Fetching screens data...');
        const screensResponse = await inlineApiService.getScreens();
        console.log('📊 Screens data received:', screensResponse);
        
        if (screensResponse && Array.isArray(screensResponse.screens)) {
          console.log(`✅ Found ${screensResponse.screens.length} screens`);
          setScreens(screensResponse.screens);
          
          // Log all device IDs for debugging
          console.log('📋 Device IDs:', screensResponse.screens.map((s: any) => ({
            deviceId: s.deviceId,
            materialId: s.materialId,
            isOnline: s.isOnline,
            lastSeen: s.lastSeen
          })));
        } else {
          console.warn('⚠️ Unexpected screens data format:', screensResponse);
          setScreens([]);
        }
      } catch (screensError) {
        console.error('❌ Error fetching screens:', screensError);
        setScreens([]);
      }
      
      // Then fetch other data in parallel
      try {
        console.log('🔄 Fetching additional data...');
        const [complianceData, analyticsData] = await Promise.all([
          inlineApiService.getComplianceReport(),
          inlineApiService.getAdAnalytics()
        ]);
        
        setComplianceReport(complianceData);
        setAdAnalytics(analyticsData);
      } catch (otherError) {
        console.error('❌ Error fetching additional data:', otherError);
        // We can continue with partial data
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    fetchData();
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Action handlers
  const handleBulkAction = async (action: string) => {
    try {
      setActionLoading(action);
      let result;
      
      // For now, simulate the actions since we're focusing on the data fetching issue
      switch (action) {
        case 'sync':
          result = { success: true, message: 'All screens synced successfully' };
          break;
        case 'play':
          result = { success: true, message: 'All screens started playing' };
          break;
        case 'pause':
          result = { success: true, message: 'All screens paused' };
          break;
        case 'stop':
          result = { success: true, message: 'All screens stopped' };
          break;
        case 'restart':
          result = { success: true, message: 'All screens restarted' };
          break;
        case 'emergency':
          result = { success: true, message: 'Emergency stop activated for all screens' };
          break;
        case 'lockdown':
          result = { success: true, message: 'All screens locked down' };
          break;
        case 'unlock':
          result = { success: true, message: 'All screens unlocked' };
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
          result = await adsPanelService.updateScreenMetrics(deviceId, value);
          break;
        case 'start-session':
          result = await adsPanelService.startScreenSession(deviceId);
          break;
        case 'end-session':
          result = await adsPanelService.endScreenSession(deviceId);
          break;
        case 'track-ad':
          result = await adsPanelService.trackAdPlayback(deviceId, value.adId, value.adTitle, value.adDuration);
          break;
        case 'end-ad':
          result = await adsPanelService.endAdPlayback(deviceId);
          break;
        case 'driver-activity':
          result = await adsPanelService.updateDriverActivity(deviceId, value);
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
  const [alerts, setAlerts] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>({});

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

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'high': return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case 'medium': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'low': return <CheckCircle className="w-4 h-4 text-green-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
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
            onClick={fetchData}
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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">🎛️ AdsPanel - LCD Control Center</h1>
            <p className="text-gray-600">Master control panel for all LCD screens and ad playback</p>
          </div>
          <button 
            onClick={fetchData}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Master Controls */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-8">
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

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Screens</p>
              <p className="text-2xl font-bold text-gray-900">{screens.length}</p>
            </div>
            <Monitor className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Online Screens</p>
              <p className="text-2xl font-bold text-green-600">{screens.filter(s => s.isOnline).length}</p>
            </div>
            <Wifi className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Playing Ads</p>
              <p className="text-2xl font-bold text-blue-600">{screens.filter(s => s.screenMetrics?.isDisplaying).length}</p>
            </div>
            <PlayCircle className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Impressions</p>
              <p className="text-2xl font-bold text-purple-600">{adAnalytics?.summary.totalAdsPlayed || 0}</p>
            </div>
            <Eye className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm mb-8">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
              { id: 'screens', label: 'Screen Control', icon: Monitor },
              { id: 'content', label: 'Content Management', icon: Upload },
              { id: 'analytics', label: 'Analytics', icon: TrendingUp },
              { id: 'alerts', label: 'Alerts', icon: AlertTriangle }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Screen Status Grid */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Live Screen Status</h3>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleSelectAll}
                      className="px-3 py-1 text-sm bg-blue-100 text-blue-600 rounded-md hover:bg-blue-200"
                    >
                      Select All
                    </button>
                    <button
                      onClick={handleDeselectAll}
                      className="px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  {screens.filter(screen => screen.isOnline).length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <WifiOff className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No active devices</h3>
                      <p className="mt-1 text-sm text-gray-500">No devices are currently online and playing ads.</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4">
                            <input type="checkbox" className="rounded" />
                          </th>
                          <th className="text-left py-3 px-4">Device ID</th>
                          <th className="text-left py-3 px-4">Material</th>
                          <th className="text-left py-3 px-4">Slot</th>
                          <th className="text-left py-3 px-4">Status</th>
                          <th className="text-left py-3 px-4">Current Ad</th>
                          <th className="text-left py-3 px-4">Progress</th>
                          <th className="text-left py-3 px-4">Location</th>
                          <th className="text-left py-3 px-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {screens.filter(screen => screen.isOnline).map((screen) => (
                        <tr key={screen.deviceId} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <input
                              type="checkbox"
                              checked={selectedScreens.includes(screen.deviceId)}
                              onChange={() => handleScreenSelect(screen.deviceId)}
                              className="rounded"
                            />
                          </td>
                          <td className="py-3 px-4 font-medium">{screen.deviceId}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">{screen.materialId}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">{screen.slotNumber}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              {getStatusIcon(screen.isOnline ? 'online' : 'offline')}
                              <span className="text-sm">{getStatusText(screen.isOnline ? 'online' : 'offline')}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {screen.screenMetrics?.currentAd ? (
                              <div>
                                <div className="font-medium text-sm">{screen.screenMetrics.currentAd.adTitle}</div>
                                <div className="text-xs text-gray-500">Duration: {screen.screenMetrics.currentAd.adDuration}s</div>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">No ads</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {screen.screenMetrics?.currentAd ? (
                              <div className="w-32">
                                <div className="flex justify-between text-xs text-gray-600 mb-1">
                                  <span>{formatTime(0)}</span>
                                  <span>{formatTime(screen.screenMetrics.currentAd.adDuration)}</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div 
                                    className="bg-blue-600 h-2 rounded-full" 
                                    style={{ width: '0%' }}
                                  ></div>
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {typeof screen.currentLocation === 'string' 
                              ? screen.currentLocation 
                              : (screen.currentLocation as any)?.address || 'Unknown Location'
                            }
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleScreenClick(screen)}
                                className="p-1 text-gray-400 hover:text-gray-600"
                                title="View Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                className="p-1 text-gray-400 hover:text-gray-600"
                                title="Settings"
                              >
                                <Settings className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  )}
                </div>
              </div>

              {/* Bulk Operations */}
              {selectedScreens.length > 0 && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-3">Bulk Operations ({selectedScreens.length} selected)</h4>
                  <div className="flex flex-wrap gap-2">
                    <button className="px-3 py-1 bg-green-100 text-green-600 rounded-md text-sm hover:bg-green-200">
                      <Play className="w-4 h-4 inline mr-1" />
                      Play Selected
                    </button>
                    <button className="px-3 py-1 bg-yellow-100 text-yellow-600 rounded-md text-sm hover:bg-yellow-200">
                      <Pause className="w-4 h-4 inline mr-1" />
                      Pause Selected
                    </button>
                    <button className="px-3 py-1 bg-red-100 text-red-600 rounded-md text-sm hover:bg-red-200">
                      <Square className="w-4 h-4 inline mr-1" />
                      Stop Selected
                    </button>
                    <button className="px-3 py-1 bg-blue-100 text-blue-600 rounded-md text-sm hover:bg-blue-200">
                      <RefreshCw className="w-4 h-4 inline mr-1" />
                      Sync Selected
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'screens' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Individual Screen Controls</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {screens.map((screen) => (
                  <div key={screen.deviceId} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">{screen.deviceId}</h4>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(screen.isOnline ? 'online' : 'offline')}
                        <span className="text-sm">{getStatusText(screen.isOnline ? 'online' : 'offline')}</span>
                      </div>
                    </div>
                    
                    {screen.screenMetrics?.currentAd && (
                      <div className="mb-3">
                        <div className="text-sm font-medium">{screen.screenMetrics.currentAd.adTitle}</div>
                        <div className="text-xs text-gray-500">Duration: {screen.screenMetrics.currentAd.adDuration}s</div>
                        <div className="mt-1">
                          <div className="flex justify-between text-xs text-gray-600 mb-1">
                            <span>{formatTime(0)}</span>
                            <span>{formatTime(screen.screenMetrics.currentAd.adDuration)}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1">
                            <div 
                              className="bg-blue-600 h-1 rounded-full" 
                              style={{ width: '0%' }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Brightness</span>
                        <span>{screen.screenMetrics?.brightness || 0}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-yellow-500 h-2 rounded-full" 
                          style={{ width: `${screen.screenMetrics?.brightness || 0}%` }}
                        ></div>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span>Volume</span>
                        <span>{screen.screenMetrics?.volume || 0}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full" 
                          style={{ width: `${screen.screenMetrics?.volume || 0}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <div className="flex space-x-1">
                        <button className="p-2 bg-green-100 text-green-600 rounded hover:bg-green-200">
                          <Play className="w-4 h-4" />
                        </button>
                        <button className="p-2 bg-yellow-100 text-yellow-600 rounded hover:bg-yellow-200">
                          <Pause className="w-4 h-4" />
                        </button>
                        <button className="p-2 bg-red-100 text-red-600 rounded hover:bg-red-200">
                          <Square className="w-4 h-4" />
                        </button>
                      </div>
                      <button className="p-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200">
                        <Settings className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'content' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Content Management</h3>
              

              
              {/* Content Library */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-3">Content Library</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { id: 1, title: 'Sample Ad #1', duration: '3:00', size: '15.2 MB', advertiser: 'ABC Company' },
                    { id: 2, title: 'Product Demo', duration: '2:30', size: '12.8 MB', advertiser: 'XYZ Corp' },
                    { id: 3, title: 'Brand Story', duration: '4:00', size: '20.1 MB', advertiser: 'Brand Co' },
                    { id: 4, title: 'Company Intro', duration: '1:30', size: '8.5 MB', advertiser: 'Intro Inc' },
                    { id: 5, title: 'Call to Action', duration: '2:00', size: '10.3 MB', advertiser: 'Action Ltd' }
                  ].map((ad) => (
                    <div key={ad.id} className="bg-white p-4 rounded-lg border">
                      <h5 className="font-medium mb-2">{ad.title}</h5>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>Duration: {ad.duration}</div>
                        <div>Size: {ad.size}</div>
                        <div>Advertiser: {ad.advertiser}</div>
                      </div>
                      <div className="flex space-x-2 mt-3">
                        <button className="px-3 py-1 bg-blue-100 text-blue-600 rounded text-sm hover:bg-blue-200">
                          Preview
                        </button>
                        <button className="px-3 py-1 bg-green-100 text-green-600 rounded text-sm hover:bg-green-200">
                          Deploy
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Content Deployment */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-3">Content Deployment</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Select Content</label>
                    <select className="w-full p-2 border border-gray-300 rounded-md">
                      <option>Sample Ad #1</option>
                      <option>Product Demo</option>
                      <option>Brand Story</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Target Screens</label>
                    <select className="w-full p-2 border border-gray-300 rounded-md">
                      <option>All Screens</option>
                      <option>Selected Screens</option>
                      <option>By Location</option>
                      <option>By Material</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Schedule</label>
                    <select className="w-full p-2 border border-gray-300 rounded-md">
                      <option>Immediate</option>
                      <option>Scheduled</option>
                      <option>Recurring</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Priority</label>
                    <select className="w-full p-2 border border-gray-300 rounded-md">
                      <option>Normal</option>
                      <option>High</option>
                      <option>Emergency</option>
                    </select>
                  </div>
                </div>
                <div className="flex space-x-2 mt-4">
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                    Deploy Now
                  </button>
                  <button className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700">
                    Schedule
                  </button>
                  <button className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400">
                    Save Draft
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Analytics & Performance</h3>
              
              {/* Performance Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-600">Total View Time</p>
                      <p className="text-2xl font-bold text-blue-700">{mockAnalytics.totalViewTime}</p>
                    </div>
                    <Clock className="w-8 h-8 text-blue-500" />
                  </div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-600">Completion Rate</p>
                      <p className="text-2xl font-bold text-green-700">{mockAnalytics.avgCompletionRate}%</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-green-500" />
                  </div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-purple-600">Total Impressions</p>
                      <p className="text-2xl font-bold text-purple-700">{mockAnalytics.totalImpressions.toLocaleString()}</p>
                    </div>
                    <Eye className="w-8 h-8 text-purple-500" />
                  </div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-yellow-600">Revenue Generated</p>
                      <p className="text-2xl font-bold text-yellow-700">₱{mockAnalytics.totalRevenue.toLocaleString()}</p>
                    </div>
                    <DollarSign className="w-8 h-8 text-yellow-500" />
                  </div>
                </div>
              </div>

              {/* Top Performing Ads */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-3">Top Performing Ads</h4>
                <div className="space-y-3">
                  {[
                    { title: 'Sample Ad #1', views: 450, completion: 95, revenue: 1125 },
                    { title: 'Product Demo', views: 380, completion: 89, revenue: 950 },
                    { title: 'Brand Story', views: 320, completion: 82, revenue: 800 },
                    { title: 'Company Intro', views: 280, completion: 78, revenue: 700 },
                    { title: 'Call to Action', views: 250, completion: 75, revenue: 625 }
                  ].map((ad, index) => (
                    <div key={index} className="flex items-center justify-between bg-white p-3 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{ad.title}</div>
                          <div className="text-sm text-gray-500">{ad.views} views</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-green-600">{ad.completion}%</div>
                        <div className="text-sm text-gray-500">₱{ad.revenue}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'alerts' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Alert Center</h3>
              
              {/* Alert Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-red-600">Critical</p>
                      <p className="text-2xl font-bold text-red-700">1</p>
                    </div>
                    <AlertTriangle className="w-8 h-8 text-red-500" />
                  </div>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-orange-600">High</p>
                      <p className="text-2xl font-bold text-orange-700">1</p>
                    </div>
                    <AlertCircle className="w-8 h-8 text-orange-500" />
                  </div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-yellow-600">Medium</p>
                      <p className="text-2xl font-bold text-yellow-700">1</p>
                    </div>
                    <AlertCircle className="w-8 h-8 text-yellow-500" />
                  </div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-600">Low</p>
                      <p className="text-2xl font-bold text-green-700">1</p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  </div>
                </div>
              </div>

              {/* Alert List */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-3">Active Alerts</h4>
                <div className="space-y-3">
                  {mockAlerts.map((alert) => (
                    <div key={alert.id} className="flex items-center justify-between bg-white p-3 rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getAlertIcon(alert.type)}
                        <div>
                          <div className="font-medium">{alert.message}</div>
                          <div className="text-sm text-gray-500">{alert.timestamp}</div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button className="px-3 py-1 bg-blue-100 text-blue-600 rounded text-sm hover:bg-blue-200">
                          View
                        </button>
                        <button className="px-3 py-1 bg-green-100 text-green-600 rounded text-sm hover:bg-green-200">
                          Resolve
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
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
                        {typeof screen.currentLocation === 'string' 
                          ? screen.currentLocation 
                          : (screen.currentLocation as any)?.address || 'Unknown Location'
                        }
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
    </div>
  );
};

export default AdminAdsControl;