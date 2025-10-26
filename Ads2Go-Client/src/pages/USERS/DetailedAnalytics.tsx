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
import { ArrowLeft, RefreshCw, TrendingUp, Play, Target, Users, Calendar, Monitor, ChevronDown, BarChart3, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { useMyAdsStatic } from '../../hooks/useMyAds';

const DetailedAnalytics: React.FC = () => {
  const { user } = useUserAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<'1d' | '7d' | '30d' | 'all'>('7d');
  const [userFirstName, setUserFirstName] = useState('User');
  
  // Device selection state
  const [selectedDevice, setSelectedDevice] = useState<string>('all');
  const [availableDevices, setAvailableDevices] = useState<Array<{id: string, name: string, materialId: string}>>([]);
  const [deviceAnalytics, setDeviceAnalytics] = useState<any>(null);
  const [deviceLoading, setDeviceLoading] = useState(false);

  // State for direct API data (bypassing GraphQL)
  const [directAnalyticsData, setDirectAnalyticsData] = useState<any>(null);
  const [directAnalyticsLoading, setDirectAnalyticsLoading] = useState(false);

  // Date Picker States
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedPeriodLabel, setSelectedPeriodLabel] = useState("Last 7 days");
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [isCustomDateRange, setIsCustomDateRange] = useState(false);

  // Device Dropdown States
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);
  const [selectedDeviceLabel, setSelectedDeviceLabel] = useState("All Devices");

  // Ad Selection States
  const [selectedAd, setSelectedAd] = useState<string>('all');
  const [showAdDropdown, setShowAdDropdown] = useState(false);
  const [selectedAdLabel, setSelectedAdLabel] = useState("All Ads");
  const [availableAds, setAvailableAds] = useState<Array<{id: string, title: string}>>([]);

  // Refs for debouncing
  const refetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const deviceFetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const directFetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper functions for date handling
  const formatDateForAPI = (date: string) => {
    return new Date(date).toISOString();
  };

  const getDefaultEndDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const getDefaultStartDate = () => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split('T')[0];
  };

  // Initialize default custom dates
  useEffect(() => {
    if (!customStartDate) {
      setCustomStartDate(getDefaultStartDate());
    }
    if (!customEndDate) {
      setCustomEndDate(getDefaultEndDate());
    }
  }, [customStartDate, customEndDate]);

  const handleCustomDateApply = () => {
    if (customStartDate && customEndDate) {
      setIsCustomDateRange(true);
      const startDate = new Date(customStartDate).toLocaleDateString();
      const endDate = new Date(customEndDate).toLocaleDateString();
      setSelectedPeriodLabel(`${startDate} - ${endDate}`);
      setShowDatePicker(false);
    }
  };

  const handlePresetPeriodSelect = (period: '1d' | '7d' | '30d' | 'all', label: string) => {
    setIsCustomDateRange(false);
    setSelectedPeriod(period);
    setSelectedPeriodLabel(label);
    setShowDatePicker(false);
  };

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

  // ✅ PERFORMANCE FIX: Reuse analyticsData for Top Performing Ads instead of separate query
  // This eliminates a duplicate query with period='all' that was causing slow loading
  const overallAnalyticsData = analyticsData;

  // ✅ OPTIMIZATION: Use shared hook (static variant - no polling needed here)
  // Now shares cache with Dashboard and other components
  const { data: myAdsData } = useMyAdsStatic();

  // Get user's first name from UserAuthContext
  useEffect(() => {
    if (user?.firstName) {
      setUserFirstName(user.firstName);
    }
  }, [user]);

  // Memoized device extraction - combines deployed devices with analytics data
  const extractedDevices = useMemo(() => {
    // Step 1: Get all deployed devices from user's ads (RUNNING or APPROVED status)
    const deployedDevices = new Map<string, any>();
    
    if (myAdsData?.getMyAds) {
      const runningAds = myAdsData.getMyAds.filter((ad: any) => 
        ad.status === 'RUNNING' || ad.status === 'APPROVED'
      );
      
      runningAds.forEach((ad: any) => {
        if (ad.materialId && Array.isArray(ad.materialId)) {
          ad.materialId.forEach((material: any) => {
            if (material.materialId && !deployedDevices.has(material.materialId)) {
              deployedDevices.set(material.materialId, {
                id: material.materialId,
                name: material.materialId,
                materialId: material.materialId,
                isOnline: false, // Default to offline, will be updated if we have analytics data
                deviceStatus: null,
                hasAnalyticsData: false // Flag to track if device has data
              });
            }
          });
        }
      });
    }
    
    // Step 2: Merge with analytics data (deviceStats) to get online status and data flag
    if (directAnalyticsData?.deviceStats && directAnalyticsData.deviceStats.length > 0) {
      directAnalyticsData.deviceStats.forEach((device: any) => {
        if (device.materialId) {
          if (deployedDevices.has(device.materialId)) {
            // Update existing deployed device with analytics data
            const existingDevice = deployedDevices.get(device.materialId);
            deployedDevices.set(device.materialId, {
              ...existingDevice,
              isOnline: device.isOnline || false,
              deviceStatus: device.deviceStatus || null,
              hasAnalyticsData: true
            });
          } else {
            // Add device that has analytics data but might not be in current deployment
            // (could be from previous deployments)
            deployedDevices.set(device.materialId, {
              id: device.materialId,
              name: device.materialId,
              materialId: device.materialId,
              isOnline: device.isOnline || false,
              deviceStatus: device.deviceStatus || null,
              hasAnalyticsData: true
            });
          }
        }
      });
    }
    
    // Convert Map to Array and sort (deployed devices first, then by name)
    const devicesArray = Array.from(deployedDevices.values());
    return devicesArray.sort((a, b) => a.name.localeCompare(b.name));
  }, [analyticsData, directAnalyticsData, myAdsData]);

  // Memoized ad extraction from analytics data
  const extractedAds = useMemo(() => {
    const adPerformance = overallAnalyticsData?.getUserAnalytics?.adPerformance || directAnalyticsData?.adPerformance || analyticsData?.getUserAnalytics?.adPerformance || [];
    
    if (adPerformance.length > 0) {
      const ads = adPerformance.map((ad: any) => ({
        id: ad.adId || `ad-${ad.adTitle}`,
        title: ad.adTitle || 'Unknown Ad'
      }));
      return ads;
    }
    return [];
  }, [overallAnalyticsData, directAnalyticsData, analyticsData]);

  // Update available devices when extraction changes
  useEffect(() => {
    setAvailableDevices(extractedDevices);
  }, [extractedDevices]);

  // Update available ads when extraction changes
  useEffect(() => {
    setAvailableAds(extractedAds);
  }, [extractedAds]);

  // Fetch analytics data (both all devices and specific device) with debouncing and useCallback
  const fetchDirectAnalytics = useCallback(async () => {
    if (!user?.userId) return;
    
    if (directFetchTimeoutRef.current) {
      clearTimeout(directFetchTimeoutRef.current);
    }
    
    directFetchTimeoutRef.current = setTimeout(async () => {
      try {
        setDirectAnalyticsLoading(true);
        const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace('/graphql', '').replace(/\/$/, '');
        
        let url;
        if (selectedDevice === 'all') {
          // For "All Devices", use the direct endpoint
          let currentPeriod = selectedPeriod;
          
          // If using custom date range, pass the dates as query parameters
          if (isCustomDateRange && customStartDate && customEndDate) {
            const startDateISO = formatDateForAPI(customStartDate);
            const endDateISO = formatDateForAPI(customEndDate);
            url = `${baseUrl}/analytics/user/${user.userId}/direct?startDate=${startDateISO}&endDate=${endDateISO}`;
          } else {
            url = `${baseUrl}/analytics/user/${user.userId}/direct?period=${currentPeriod}`;
          }
        } else {
          // For specific device, use the device-specific endpoint
          if (isCustomDateRange && customStartDate && customEndDate) {
            const startDateISO = formatDateForAPI(customStartDate);
            const endDateISO = formatDateForAPI(customEndDate);
            url = `${baseUrl}/analytics/user/${user.userId}/device/${selectedDevice}?startDate=${startDateISO}&endDate=${endDateISO}`;
          } else {
            url = `${baseUrl}/analytics/user/${user.userId}/device/${selectedDevice}`;
          }
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
          if (selectedDevice === 'all') {
            // For "All Devices", store in directAnalyticsData
            setDirectAnalyticsData(data.data);
            setDeviceAnalytics(null);
          } else {
            // For specific device, store in deviceAnalytics
            setDeviceAnalytics(data.data.deviceAnalytics);
            setDirectAnalyticsData(null);
          }
        } else {
          setDirectAnalyticsData(null);
          setDeviceAnalytics(null);
        }
      } catch (error) {
        console.error('Error fetching direct analytics:', error);
        setDirectAnalyticsData(null);
        setDeviceAnalytics(null);
      } finally {
        setDirectAnalyticsLoading(false);
      }
    }, 300);
  }, [selectedDevice, selectedPeriod, user?.userId, isCustomDateRange, customStartDate, customEndDate]);

  // Fetch analytics data when device selection changes
  useEffect(() => {
    fetchDirectAnalytics();
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

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.date-picker-container') && !target.closest('.device-dropdown-container') && !target.closest('.ad-dropdown-container')) {
        setShowDatePicker(false);
        setShowDeviceDropdown(false);
        setShowAdDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Analytics summary calculation
  const analyticsSummary = useMemo(() => {
    if (selectedDevice === 'all' && selectedAd === 'all') {
      // All devices and all ads - use full summary
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
    } else if (selectedDevice === 'all' && selectedAd !== 'all') {
      // All devices but specific ad - filter by ad
      const adPerformance = directAnalyticsData?.adPerformance || [];
      const selectedAdData = adPerformance.find((ad: any) => ad.adId === selectedAd);
      
      if (selectedAdData) {
        return {
          totalAdImpressions: selectedAdData.totalAdImpressions || 0,
          totalAdsPlayed: selectedAdData.totalMaterials || 0,
          totalDisplayTime: selectedAdData.totalAdPlayTime || 0,
          averageCompletionRate: selectedAdData.averageAdCompletionRate || 0,
          totalAds: 1,
          activeAds: 1,
          totalMaterials: selectedAdData.totalMaterials || 0,
          totalDevices: selectedAdData.totalDevices || 0,
          totalQRScans: selectedAdData.totalQRScans || 0
        };
      }
      
      // Fallback: If ad performance array is empty but we have summary data, use summary data for single ad
      // This handles the case where backend sync isn't populating adPerformance correctly
      const summary = directAnalyticsData?.summary;
      if (summary && availableAds.length === 1) {
        // If user has only one ad, use the summary data for that ad
        return {
          totalAdImpressions: summary.totalAdImpressions || 0,
          totalAdsPlayed: summary.totalAdsPlayed || 0,
          totalDisplayTime: summary.totalDisplayTime || 0,
          averageCompletionRate: summary.averageCompletionRate || 0,
          totalAds: 1,
          activeAds: 1,
          totalMaterials: summary.totalMaterials || 0,
          totalDevices: summary.totalDevices || 0,
          totalQRScans: summary.totalQRScans || 0
        };
      }
      
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
    } else if (selectedDevice !== 'all' && selectedAd === 'all' && deviceAnalytics) {
      // Specific device and all ads - use device analytics
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
    } else if (selectedDevice !== 'all' && selectedAd !== 'all' && deviceAnalytics) {
      // Specific device and specific ad - filter device analytics by ad
      const selectedAdData = deviceAnalytics.adPerformance?.find((ad: any) => ad.adId === selectedAd);
      if (selectedAdData) {
        return {
          totalAdImpressions: selectedAdData.totalImpressions || 0,
          totalAdsPlayed: selectedAdData.totalPlays || 0,
          totalDisplayTime: selectedAdData.totalViewTime || 0,
          averageCompletionRate: selectedAdData.averageCompletionRate || 0,
          totalAds: 1,
          activeAds: 1,
          totalMaterials: 1,
          totalDevices: 1,
          totalQRScans: selectedAdData.totalQRScans || 0
        };
      }
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
  }, [selectedDevice, selectedAd, directAnalyticsData, deviceAnalytics]);

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

  // Top performing ads with proper QR scan calculation - ALWAYS use overall data regardless of device/date selection
  const topPerformingAds = useMemo(() => {
    // Always use the overall ad performance data (not filtered by device or date)
    // Use overallAnalyticsData.getUserAnalytics.adPerformance which always contains overall data
    const ads = (overallAnalyticsData?.getUserAnalytics?.adPerformance || []);
    
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
  }, [overallAnalyticsData]);

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
        <div className="bg-white/30 backdrop-blur-md border-b border-white/30 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-20">
              <div className="flex items-center space-x-4">
                <Link 
                  to="/dashboard" 
                  className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 transition-all duration-200 bg-white/40 hover:bg-white/60 px-4 py-2 rounded-lg shadow-sm"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span className="font-medium">Back to Dashboard</span>
                </Link>
              </div>
              <div className="text-center">
                <h1 className="text-2xl font-bold text-gray-800 mb-1">
                  📊 Detailed Analytics
                </h1>
                <p className="text-gray-600 text-sm">
                  Welcome back, {userFirstName}
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => window.location.reload()}
                  className="flex items-center space-x-2 px-4 py-2 bg-white/60 hover:bg-white/80 text-gray-700 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span className="font-medium">Refresh Data</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Device and Period Selection */}
          <div className="mb-8">
            <div className="bg-white/40 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-white/20 relative z-10">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <Filter className="w-5 h-5 mr-2" />
                Filter Your Analytics
              </h2>
              <div className="flex flex-wrap items-center gap-4">
                {/* Device Selection */}
                <div className="relative device-dropdown-container">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📱 Select Device
                  </label>
                  <button
                    onClick={() => setShowDeviceDropdown(!showDeviceDropdown)}
                    className="flex items-center space-x-2 px-4 py-3 bg-white/70 hover:bg-white/90 text-gray-700 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md border border-white/30 min-w-[200px]"
                  >
                    <Monitor className="w-4 h-4" />
                    <span className="font-medium">{selectedDeviceLabel}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${showDeviceDropdown ? 'rotate-180' : ''}`} />
                  </button>
              
                  {showDeviceDropdown && (
                    <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-[9999] backdrop-blur-sm">
                      <div className="p-3">
                        <div className="text-xs font-medium text-gray-500 mb-2 px-2">Choose a device to analyze</div>
                        <button
                          onClick={() => {
                            setSelectedDevice('all');
                            setSelectedDeviceLabel('All Devices');
                            setShowDeviceDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-3 rounded-lg transition-all duration-200 ${
                            selectedDevice === 'all' 
                              ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                              : 'hover:bg-gray-50 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <Monitor className="w-4 h-4" />
                            <div>
                              <div className="font-medium">All Devices</div>
                              <div className="text-xs text-gray-500">View combined analytics</div>
                            </div>
                          </div>
                        </button>
                        {availableDevices.map((device) => (
                          <button
                            key={device.id}
                            onClick={() => {
                              setSelectedDevice(device.materialId);
                              setSelectedDeviceLabel(device.name);
                              setShowDeviceDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-3 rounded-lg transition-all duration-200 mt-1 ${
                              selectedDevice === device.materialId 
                                ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                                : 'hover:bg-gray-50 border border-transparent'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <Monitor className="w-4 h-4" />
                                <div>
                                  <div className="font-medium">{device.name}</div>
                                  <div className="text-xs text-gray-500">
                                    {device.hasAnalyticsData ? 'Individual device analytics' : 'No data yet'}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <div className={`w-2 h-2 rounded-full ${device.isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                <span className={`text-xs font-medium ${device.isOnline ? 'text-green-600' : 'text-red-600'}`}>
                                  {device.isOnline ? 'ONLINE' : 'OFFLINE'}
                                </span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
            </div>

                {/* Ad Selection */}
                <div className="relative ad-dropdown-container">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🎯 Select Ad
                  </label>
                  <button
                    onClick={() => setShowAdDropdown(!showAdDropdown)}
                    className="flex items-center space-x-2 px-4 py-3 bg-white/70 hover:bg-white/90 text-gray-700 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md border border-white/30 min-w-[200px]"
                  >
                    <Target className="w-4 h-4" />
                    <span className="font-medium">{selectedAdLabel}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${showAdDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showAdDropdown && (
                    <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-[9999] backdrop-blur-sm">
                      <div className="p-4">
                        <div className="text-xs font-medium text-gray-500 mb-2 px-2">Choose an ad to analyze</div>
                        <button
                          onClick={() => {
                            setSelectedAd('all');
                            setSelectedAdLabel('All Ads');
                            setShowAdDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-3 rounded-lg transition-all duration-200 ${
                            selectedAd === 'all' 
                              ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                              : 'hover:bg-gray-50 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center">
                            <Target className="w-4 h-4 mr-3" />
                            <div>
                              <div className="font-medium">All Ads</div>
                              <div className="text-xs text-gray-500">Combined performance of all ads</div>
                            </div>
                          </div>
                        </button>

                        {availableAds.map((ad) => (
                          <button
                            key={ad.id}
                            onClick={() => {
                              setSelectedAd(ad.id);
                              setSelectedAdLabel(ad.title);
                              setShowAdDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-3 rounded-lg transition-all duration-200 mt-1 ${
                              selectedAd === ad.id 
                                ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                                : 'hover:bg-gray-50 border border-transparent'
                            }`}
                          >
                            <div className="flex items-center">
                              <Target className="w-4 h-4 mr-3" />
                              <div>
                                <div className="font-medium">{ad.title}</div>
                                <div className="text-xs text-gray-500">Individual ad analytics</div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Date Picker */}
                <div className="relative date-picker-container">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📅 Select Time Period
                  </label>
                  <button
                    onClick={() => setShowDatePicker(!showDatePicker)}
                    className="flex items-center space-x-2 px-4 py-3 bg-white/70 hover:bg-white/90 text-gray-700 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md border border-white/30 min-w-[200px]"
                  >
                    <Calendar className="w-4 h-4" />
                    <span className="font-medium">{selectedPeriodLabel}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${showDatePicker ? 'rotate-180' : ''}`} />
                  </button>
              
                  {showDatePicker && (
                    <div className="absolute top-full left-0 mt-2 w-96 bg-white rounded-xl shadow-xl border border-gray-200 z-[9999] backdrop-blur-sm">
                      <div className="p-4">
                        {/* Preset Periods */}
                        <div className="mb-6">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                            <TrendingUp className="w-4 h-4 mr-2" />
                            Quick Select
                          </h4>
                          <div className="grid grid-cols-1 gap-2">
                            <button
                              onClick={() => handlePresetPeriodSelect('1d', 'Last 24 hours')}
                              className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 text-sm ${
                                !isCustomDateRange && selectedPeriod === '1d' 
                                  ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                                  : 'hover:bg-gray-50 border border-transparent'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">Last 24 hours</span>
                                <span className="text-xs text-gray-500">Today</span>
                              </div>
                            </button>
                            <button
                              onClick={() => handlePresetPeriodSelect('7d', 'Last 7 days')}
                              className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 text-sm ${
                                !isCustomDateRange && selectedPeriod === '7d' 
                                  ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                                  : 'hover:bg-gray-50 border border-transparent'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">Last 7 days</span>
                                <span className="text-xs text-gray-500">This week</span>
                              </div>
                            </button>
                            <button
                              onClick={() => handlePresetPeriodSelect('30d', 'Last 30 days')}
                              className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 text-sm ${
                                !isCustomDateRange && selectedPeriod === '30d' 
                                  ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                                  : 'hover:bg-gray-50 border border-transparent'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">Last 30 days</span>
                                <span className="text-xs text-gray-500">This month</span>
                              </div>
                            </button>
                            <button
                              onClick={() => handlePresetPeriodSelect('all', 'All Time')}
                              className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 text-sm ${
                                !isCustomDateRange && selectedPeriod === 'all' 
                                  ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                                  : 'hover:bg-gray-50 border border-transparent'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">All Time</span>
                                <span className="text-xs text-gray-500">Complete history</span>
                              </div>
                            </button>
                          </div>
                        </div>

                        {/* Custom Date Range */}
                        <div className="border-t pt-4">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                            <Calendar className="w-4 h-4 mr-2" />
                            Custom Range
                          </h4>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-2">Start Date</label>
                              <input
                                type="date"
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-2">End Date</label>
                              <input
                                type="date"
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                              />
                            </div>
                            <button
                              onClick={handleCustomDateApply}
                              disabled={!customStartDate || !customEndDate || new Date(customStartDate) > new Date(customEndDate)}
                              className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
                            >
                              Apply Custom Range
                            </button>
                          </div>
                        </div>

                        {/* Close button */}
                        <div className="mt-4 pt-4 border-t">
                          <button
                            onClick={() => setShowDatePicker(false)}
                            className="w-full px-4 py-2 text-gray-600 hover:text-gray-800 text-sm transition-all duration-200 hover:bg-gray-50 rounded-lg"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {analyticsLoading && (
            <div className="flex items-center justify-center py-16">
              <div className="bg-white/60 backdrop-blur-sm rounded-xl p-8 shadow-lg border border-white/20">
                <div className="flex items-center space-x-4">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                  <div>
                    <span className="text-lg font-medium text-gray-700">Loading Analytics...</span>
                    <p className="text-sm text-gray-500 mt-1">Please wait while we fetch your data</p>
                  </div>
                </div>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-0">
              <div className="bg-white/90 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1 font-medium">Total Ad Plays</p>
                    <div className="text-3xl font-bold text-gray-900">
                      {analyticsLoading ? (
                        <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
                      ) : (
                        (analyticsSummary.totalAdsPlayed || 0).toLocaleString()
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Times your ads were displayed</p>
                  </div>
                  <div className="p-4 bg-blue-100 rounded-full shadow-sm">
                    <Play className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white/90 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1 font-medium">QR Scans</p>
                    <div className="text-3xl font-bold text-gray-900">
                      {analyticsLoading ? (
                        <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
                      ) : (
                        (analyticsSummary.totalQRScans || 0).toLocaleString()
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">QR codes scanned by users</p>
                  </div>
                  <div className="p-4 bg-green-100 rounded-full shadow-sm">
                    <Target className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white/90 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1 font-medium">Active Devices</p>
                    <div className="text-3xl font-bold text-gray-900">
                      {analyticsLoading ? (
                        <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
                      ) : (
                        (analyticsSummary.totalMaterials || 0).toLocaleString()
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Devices showing your ads</p>
                  </div>
                  <div className="p-4 bg-orange-100 rounded-full shadow-sm">
                    <Users className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white/90 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1 font-medium">Online Devices</p>
                    <div className="text-3xl font-bold text-gray-900">
                      {analyticsLoading ? (
                        <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
                      ) : (
                        availableDevices.filter(device => device.isOnline).length
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Currently connected devices</p>
                  </div>
                  <div className="p-4 bg-green-100 rounded-full shadow-sm">
                    <Monitor className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white/90 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1 font-medium">Completion Rate</p>
                    <div className="text-3xl font-bold text-gray-900">
                      {analyticsLoading ? (
                        <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
                      ) : (
                        `${analyticsSummary.averageCompletionRate.toFixed(1)}%`
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Average ad completion</p>
                  </div>
                  <div className="p-4 bg-purple-100 rounded-full shadow-sm">
                    <TrendingUp className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Chart */}
            <div className="bg-white/90 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-white/20">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-1">📈 Performance Over Time</h3>
                  <p className="text-sm text-gray-600">Track your ad performance trends</p>
                </div>
                <div className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                  {selectedPeriodLabel}
                </div>
              </div>
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
                      formatter={(value, name) => [(value || 0).toLocaleString(), name === 'adPlays' ? 'Ad Plays' : 'QR Scans']}
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
              <div className="bg-white/90 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-white/20">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-1">🏆 Top Performing Ads</h3>
                    <p className="text-sm text-gray-600">Your best performing advertisements</p>
                  </div>
                  <div className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                    Overall Performance
                  </div>
                </div>
                <div className="space-y-4">
                  {topPerformingAds.slice(0, 5).map((ad: any, index: number) => (
                    <div key={ad.adId} className="flex items-center justify-between p-5 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200 hover:shadow-md transition-all duration-200">
                      <div className="flex items-center space-x-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm ${
                          index === 0 ? 'bg-yellow-100 text-yellow-600' : 
                          index === 1 ? 'bg-gray-100 text-gray-600' : 
                          index === 2 ? 'bg-orange-100 text-orange-600' : 
                          'bg-blue-100 text-blue-600'
                        }`}>
                          <span className="text-sm font-bold">
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-lg">{ad.adTitle}</p>
                          <div className="flex items-center space-x-4 mt-1">
                            <p className="text-sm text-gray-600">
                              📱 {selectedDevice !== 'all' ? (ad.totalPlays || 0).toLocaleString() : (ad.totalMaterials || 0).toLocaleString()} {selectedDevice !== 'all' ? 'plays' : 'devices'}
                            </p>
                            <p className="text-sm text-gray-600">
                              👁️ {(ad.totalAdImpressions || 0).toLocaleString()} views
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-600">
                          {selectedDevice !== 'all' ? 
                            (deviceAnalytics?.qrScanBreakdown?.find((qr: any) => qr.adId === ad.adId)?.totalScans || 0).toLocaleString() : 
                            (ad.totalQRScans || 0).toLocaleString()
                          }
                        </p>
                        <p className="text-sm text-gray-500 font-medium">QR Scans</p>
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