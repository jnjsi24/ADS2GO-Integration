import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';
import { useQuery } from '@apollo/client';
import { GET_USER_ANALYTICS } from '../../graphql/user/queries/getUserAnalytics';
import { ArrowLeft, RefreshCw, TrendingUp, Play, Target, Users, Calendar, Monitor, ChevronDown, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUserAuth } from '../../contexts/UserAuthContext';

const DetailedAnalytics: React.FC = () => {
  const { user } = useUserAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<'1d' | '7d' | '30d'>('7d');
  const [userFirstName, setUserFirstName] = useState('User');
  
  // Device selection state
  const [selectedDevice, setSelectedDevice] = useState<string>('all');
  const [availableDevices, setAvailableDevices] = useState<Array<{id: string, name: string, materialId: string}>>([]);
  const [deviceAnalytics, setDeviceAnalytics] = useState<any>(null);
  const [deviceLoading, setDeviceLoading] = useState(false);

  // State for direct API data (bypassing GraphQL)
  const [directAnalyticsData, setDirectAnalyticsData] = useState<any>(null);
  const [directAnalyticsLoading, setDirectAnalyticsLoading] = useState(false);

  // Refs for debouncing
  const refetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const deviceFetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const directFetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Device Dropdown States
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);
  const [selectedDeviceLabel, setSelectedDeviceLabel] = useState("All Devices");

  // Period Dropdown States
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [selectedPeriodLabel, setSelectedPeriodLabel] = useState("Last 7 days");

  // Fetch analytics data with optimized cache policy
  const { data: analyticsData, loading: analyticsLoading, error: analyticsError, refetch: refetchAnalytics } = useQuery(GET_USER_ANALYTICS, {
    variables: { 
      period: selectedDevice === 'all' ? 'all' : selectedPeriod 
    },
    fetchPolicy: 'cache-first',
    nextFetchPolicy: 'cache-and-network',
    errorPolicy: 'all',
    onError: (error) => {
      if (error.message !== 'Failed to fetch analytics data') {
        console.error('Unexpected analytics error:', error);
      }
    }
  });

  // Get user's first name from UserAuthContext
  useEffect(() => {
    if (user?.firstName) {
      setUserFirstName(user.firstName);
    }
  }, [user]);

  // Memoized device extraction from analytics data
  const extractedDevices = useMemo(() => {
    if (directAnalyticsData?.deviceStats && directAnalyticsData.deviceStats.length > 0) {
      const devices = directAnalyticsData.deviceStats.map((device: any, index: number) => ({
        id: device.deviceId || `device-${index}`,
        name: device.materialId || `Device ${index + 1}`,
        materialId: device.materialId || `device-${index}`
      }));
      return devices;
    }
    return [];
  }, [analyticsData, directAnalyticsData]);

  // Update available devices when extraction changes
  useEffect(() => {
    if (extractedDevices.length > 0) {
      setAvailableDevices(extractedDevices);
    }
  }, [extractedDevices]);

  // Fetch direct analytics data when "All Devices" is selected with debouncing and useCallback
  const fetchDirectAnalytics = useCallback(async () => {
    if (selectedDevice !== 'all' || !user?.userId) return;
    
    if (directFetchTimeoutRef.current) {
      clearTimeout(directFetchTimeoutRef.current);
    }
    
    directFetchTimeoutRef.current = setTimeout(async () => {
      try {
        setDirectAnalyticsLoading(true);
        const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace('/graphql', '').replace(/\/$/, '');
        const currentPeriod = selectedDevice === 'all' ? 'all' : selectedPeriod;
        const url = `${baseUrl}/analytics/user/${user.userId}/direct?period=${currentPeriod}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
          setDirectAnalyticsData(data.data);
        } else {
          setDirectAnalyticsData(null);
        }
      } catch (error) {
        console.error('Error fetching direct analytics:', error);
        setDirectAnalyticsData(null);
      } finally {
        setDirectAnalyticsLoading(false);
      }
    }, 300);
  }, [selectedDevice, selectedPeriod, user?.userId]);

  // Fetch direct analytics when "All Devices" is selected
  useEffect(() => {
    if (selectedDevice === 'all') {
      fetchDirectAnalytics();
    }
  }, [selectedDevice, fetchDirectAnalytics]);

  // Cleanup all pending timeouts on unmount
  useEffect(() => {
    return () => {
      if (refetchTimeoutRef.current) {
        clearTimeout(refetchTimeoutRef.current);
      }
      if (deviceFetchTimeoutRef.current) {
        clearTimeout(deviceFetchTimeoutRef.current);
      }
      if (directFetchTimeoutRef.current) {
        clearTimeout(directFetchTimeoutRef.current);
      }
    };
  }, []);

  // Analytics summary calculation
  const analyticsSummary = useMemo(() => {
    if (selectedDevice === 'all') {
      const summary = directAnalyticsData?.summary || {
        totalAdImpressions: 0,
        totalAdsPlayed: 0,
        totalDisplayTime: 0,
        averageCompletionRate: 0,
        totalAds: 0,
        activeAds: 0,
        totalMaterials: 0,
        totalDevices: 0,
        totalQRScans: 0
      };
      
      
      return summary;
    } else if (selectedDevice !== 'all' && deviceAnalytics) {
      return {
        totalAdImpressions: deviceAnalytics.totals?.totalAdImpressions || 0,
        totalAdsPlayed: deviceAnalytics.totals?.totalAdPlays || 0,
        totalDisplayTime: deviceAnalytics.totals?.totalAdPlayTime || 0,
        averageCompletionRate: deviceAnalytics.averages?.averageCompletionRate || 0,
        totalAds: deviceAnalytics.adPerformance?.length || 0,
        activeAds: deviceAnalytics.adPerformance?.length || 0,
        totalMaterials: 1,
        totalDevices: 1,
        totalQRScans: deviceAnalytics.totals?.totalQRScans || 0
      };
    } else {
      return {
        totalAdImpressions: 0,
        totalAdsPlayed: 0,
        totalDisplayTime: 0,
        averageCompletionRate: 0,
        totalAds: 0,
        activeAds: 0,
        totalMaterials: 0,
        totalDevices: 0,
        totalQRScans: 0
      };
    }
  }, [selectedDevice, directAnalyticsData, deviceAnalytics]);

  // Format display time helper
  const formatDisplayTime = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }, []);

  // Daily stats for charts
  const dailyStats = useMemo(() => {
    if (selectedDevice === 'all') {
      const dailyStats = analyticsData?.getUserAnalytics?.dailyStats || [];
      return dailyStats.map((day: any) => ({
        date: day.date,
        impressions: day.impressions || 0,
        adPlays: day.adsPlayed || 0,
        qrScans: day.qrScans || 0,
        completionRate: day.completionRate || 0
      }));
    } else if (selectedDevice !== 'all' && deviceAnalytics?.dailyBreakdown) {
      return deviceAnalytics.dailyBreakdown.map((day: any) => ({
        date: day.date,
        impressions: day.totalAdImpressions,
        adPlays: day.totalAdPlays,
        qrScans: day.totalQRScans,
        completionRate: day.adCompletionRate
      }));
    } else {
      return [];
    }
  }, [selectedDevice, deviceAnalytics, analyticsData]);

  // Top performing ads with proper QR scan calculation
  const topPerformingAds = useMemo(() => {
    let ads = [];
    
    if (selectedDevice === 'all') {
      ads = (directAnalyticsData?.adPerformance || analyticsData?.getUserAnalytics?.adPerformance || []);
    } else if (deviceAnalytics?.adPerformance) {
      ads = deviceAnalytics.adPerformance;
    }
    
    // Calculate QR scans for each ad by summing from materials
    return ads.map((ad: any) => {
      let calculatedQRScans = ad.totalQRScans || 0;
      
      // Try multiple approaches to get QR scan data
      // 1. First try from materials array
      if (ad.materials && ad.materials.length > 0) {
        const materialQRScans = ad.materials.reduce((total: number, material: any) => {
          return total + (material.totalQRScans || 0);
        }, 0);
        if (materialQRScans > 0) {
          calculatedQRScans = materialQRScans;
        }
      }
      
      // 2. Try from materialPerformance array
      if (ad.materialPerformance && ad.materialPerformance.length > 0) {
        const materialPerformanceQRScans = ad.materialPerformance.reduce((total: number, material: any) => {
          return total + (material.totalQRScans || 0);
        }, 0);
        if (materialPerformanceQRScans > 0) {
          calculatedQRScans = materialPerformanceQRScans;
        }
      }
      
      // 3. If still 0, try to get from qrScansByAd
      if (calculatedQRScans === 0 && ad.qrScansByAd && ad.qrScansByAd.length > 0) {
        calculatedQRScans = ad.qrScansByAd.reduce((total: number, qrScan: any) => {
          return total + (qrScan.scanCount || 0);
        }, 0);
      }
      
      // 4. If still 0, try to get from qrScans array
      if (calculatedQRScans === 0 && ad.qrScans && ad.qrScans.length > 0) {
        calculatedQRScans = ad.qrScans.length;
      }
      
      
      return {
        ...ad,
        totalQRScans: calculatedQRScans
      };
    }).slice(0, 5);
  }, [selectedDevice, directAnalyticsData, analyticsData, deviceAnalytics]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background layer */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-fixed blur-sm brightness-90"
        style={{
          backgroundImage: "url('/image/bg.jpg')",
        }}
      />
      
      {/* Content layer */}
      <div className="relative z-10 min-h-screen">
        {/* Header */}
        <div className="bg-white/20 backdrop-blur-sm border-b border-white/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <Link 
                  to="/dashboard" 
                  className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span className="font-medium">Back to Dashboard</span>
                </Link>
              </div>
              <div className="flex items-center space-x-4">
                <h1 className="text-xl font-semibold text-gray-800">
                  Detailed Analytics - {userFirstName}
                </h1>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => window.location.reload()}
                  className="flex items-center space-x-2 px-4 py-2 bg-white/60 hover:bg-white/80 text-gray-700 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Refresh</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Device and Period Selection */}
          <div className="mb-6 flex flex-wrap items-center gap-4">
            {/* Device Selection */}
            <div className="relative">
              <button
                onClick={() => setShowDeviceDropdown(!showDeviceDropdown)}
                className="flex items-center space-x-2 px-4 py-2 bg-white/60 hover:bg-white/80 text-gray-700 rounded-lg transition-colors"
              >
                <Monitor className="w-4 h-4" />
                <span>{selectedDeviceLabel}</span>
                <ChevronDown className="w-4 h-4" />
              </button>
              
              {showDeviceDropdown && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <div className="p-2">
                    <button
                      onClick={() => {
                        setSelectedDevice('all');
                        setSelectedDeviceLabel('All Devices');
                        setShowDeviceDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                        selectedDevice === 'all' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
                      }`}
                    >
                      All Devices
                    </button>
                    {availableDevices.map((device) => (
                      <button
                        key={device.id}
                        onClick={() => {
                          setSelectedDevice(device.materialId);
                          setSelectedDeviceLabel(device.name);
                          setShowDeviceDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                          selectedDevice === device.materialId ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
                        }`}
                      >
                        {device.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Period Selection */}
            <div className="relative">
              <button
                onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
                className="flex items-center space-x-2 px-4 py-2 bg-white/60 hover:bg-white/80 text-gray-700 rounded-lg transition-colors"
              >
                <Calendar className="w-4 h-4" />
                <span>{selectedPeriodLabel}</span>
                <ChevronDown className="w-4 h-4" />
              </button>
              
              {showPeriodDropdown && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <div className="p-2">
                    <button
                      onClick={() => {
                        setSelectedPeriod('1d');
                        setSelectedPeriodLabel('Last 24 hours');
                        setShowPeriodDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                        selectedPeriod === '1d' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
                      }`}
                    >
                      Last 24 hours
                    </button>
                    <button
                      onClick={() => {
                        setSelectedPeriod('7d');
                        setSelectedPeriodLabel('Last 7 days');
                        setShowPeriodDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                        selectedPeriod === '7d' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
                      }`}
                    >
                      Last 7 days
                    </button>
                    <button
                      onClick={() => {
                        setSelectedPeriod('30d');
                        setSelectedPeriodLabel('Last 30 days');
                        setShowPeriodDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                        selectedPeriod === '30d' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
                      }`}
                    >
                      Last 30 days
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Loading State */}
          {analyticsLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center space-x-3">
                <RefreshCw className="w-6 h-6 animate-spin text-[#3674B5]" />
                <span className="text-gray-600">Loading analytics data...</span>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!analyticsLoading && (!analyticsData?.getUserAnalytics && !directAnalyticsData) && (
            <div className="text-center py-12">
              <div className="bg-white/60 p-8 rounded-lg shadow-md max-w-md mx-auto">
                <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-800 mb-2">No Analytics Data</h3>
                <div className="text-gray-600">
                  <p>You don't have any analytics data yet. This is normal for new users or users without deployed ads.</p>
                  <p className="mt-1">Once you create and deploy ads, your detailed analytics will appear here.</p>
                </div>
              </div>
            </div>
          )}

          {/* Simplified Analytics Dashboard */}
          <div className="space-y-6">
            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white/80 p-6 rounded-xl shadow-lg border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Ad Plays</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {analyticsLoading ? '...' : analyticsSummary.totalAdsPlayed.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-full">
                    <Play className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white/80 p-6 rounded-xl shadow-lg border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">QR Scans</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {analyticsLoading ? '...' : analyticsSummary.totalQRScans.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-full">
                    <Target className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white/80 p-6 rounded-xl shadow-lg border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Active Devices</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {analyticsLoading ? '...' : analyticsSummary.totalMaterials.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-orange-100 rounded-full">
                    <Users className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white/80 p-6 rounded-xl shadow-lg border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Completion Rate</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {analyticsLoading ? '...' : analyticsSummary.averageCompletionRate.toFixed(1)}%
                    </p>
                  </div>
                  <div className="p-3 bg-purple-100 rounded-full">
                    <TrendingUp className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Chart */}
            <div className="bg-white/80 p-6 rounded-xl shadow-lg border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Performance Over Time</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyStats}>
                    <defs>
                      <linearGradient id="colorPlays" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
                      </linearGradient>
                      <linearGradient id="colorScans" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <Tooltip 
                      formatter={(value, name) => [value.toLocaleString(), name === 'adPlays' ? 'Ad Plays' : 'QR Scans']}
                      labelFormatter={(label) => new Date(label).toLocaleDateString()}
                    />
                    <Area
                      type="monotone"
                      dataKey="adPlays"
                      stroke="#3B82F6"
                      fillOpacity={1}
                      fill="url(#colorPlays)"
                      name="adPlays"
                    />
                    <Area
                      type="monotone"
                      dataKey="qrScans"
                      stroke="#10B981"
                      fillOpacity={1}
                      fill="url(#colorScans)"
                      name="qrScans"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Performing Ads */}
            {topPerformingAds.length > 0 && (
              <div className="bg-white/80 p-6 rounded-xl shadow-lg border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Top Performing Ads</h3>
                <div className="space-y-4">
                  {topPerformingAds.slice(0, 5).map((ad: any, index: number) => (
                    <div key={ad.adId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-semibold text-blue-600">#{index + 1}</span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{ad.adTitle}</p>
                          <p className="text-sm text-gray-500">
                            {selectedDevice !== 'all' ? ad.totalMaterials.toLocaleString() : ad.totalMaterials.toLocaleString()} materials
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          {selectedDevice !== 'all' ? ad.totalQRScans.toLocaleString() : ad.totalQRScans.toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-500">QR Scans</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Error State */}
          {analyticsError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800">Error loading analytics data: {analyticsError.message}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DetailedAnalytics;