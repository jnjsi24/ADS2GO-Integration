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
import { ArrowLeft, RefreshCw, TrendingUp, Play, Target, Users, Calendar, Monitor, ChevronDown, BarChart3, Filter, LoaderCircle, Youtube, MonitorSmartphone, QrCode } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { AnimatePresence, motion } from 'framer-motion';

const DetailedAnalytics: React.FC = () => {
  const { user } = useUserAuth();
  const [searchParams] = useSearchParams();
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
  const [dateRange, setDateRange] = useState<{ start?: string; end?: string }>({});
  const [isSelectingStart, setIsSelectingStart] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedPeriodLabel, setSelectedPeriodLabel] = useState("Last 7 days");
  const [isCustomDateRange, setIsCustomDateRange] = useState(false);
  const [tempStartDate, setTempStartDate] = useState<string>('');


  // Device Dropdown States
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);
  const [selectedDeviceLabel, setSelectedDeviceLabel] = useState("All Devices");

  // Ad Selection States
  const [selectedAd, setSelectedAd] = useState<string>('all');
  const [showAdDropdown, setShowAdDropdown] = useState(false);
  const [selectedAdLabel, setSelectedAdLabel] = useState("All Advertisement");
  const [availableAds, setAvailableAds] = useState<Array<{id: string, title: string}>>([]);

  // Refs for debouncing
  const refetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const deviceFetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const directFetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [pos, setPos] = useState({ x: 50, y: 50 });

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

  // Fetch overall analytics data for Top Performing Ads (always uses 'all' period)
  const { data: overallAnalyticsData } = useQuery(GET_USER_ANALYTICS, {
    variables: { 
      period: 'all' // Always fetch overall data for Top Performing Ads
    },
    fetchPolicy: 'cache-first',
    errorPolicy: 'all'
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
        id: device.materialId || `device-${index}`,
        name: device.materialId || `Vehicle ${index + 1}`,
        materialId: device.materialId || `device-${index}`,
        isOnline: device.isOnline || false,
        deviceStatus: device.deviceStatus || null
      }));
      return devices;
    }
    return [];
  }, [analyticsData, directAnalyticsData]);

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

  // Handle URL query parameter for pre-selecting an ad
  useEffect(() => {
    const adIdFromUrl = searchParams.get('adId');
    if (adIdFromUrl && availableAds.length > 0) {
      const matchingAd = availableAds.find(ad => ad.id === adIdFromUrl);
      if (matchingAd) {
        setSelectedAd(adIdFromUrl);
        setSelectedAdLabel(matchingAd.title);
      }
    }
  }, [searchParams, availableAds]);

  const formatDisplayDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Get display text for the date input placeholder
  const getDatePlaceholder = () => {
    if (!dateRange.start && !dateRange.end) {
      return "Select a date";
    } else if (dateRange.start && !dateRange.end) {
      return `${formatDisplayDate(dateRange.start)} - Select end date`;
    } else if (dateRange.start && dateRange.end) {
      return `${formatDisplayDate(dateRange.start)} - ${formatDisplayDate(dateRange.end)}`;
    }
    return "Select a date";
  };

  // Handle date selection
  const handleDateSelect = (date: string) => {
    if (isSelectingStart) {
      setTempStartDate(date);
      setDateRange({ start: date });
      setIsSelectingStart(false);
      // Keep the date picker open after selecting the first date
    } else {
      let finalStartDate = tempStartDate;
      let finalEndDate = date;

      // If second date is before start date, swap them
      if (new Date(date) < new Date(tempStartDate)) {
        finalStartDate = date;
        finalEndDate = tempStartDate;
      }

      setDateRange({ 
        start: finalStartDate, 
        end: finalEndDate 
      });
      setIsCustomDateRange(true);
      setSelectedPeriodLabel(`${formatDisplayDate(finalStartDate)} - ${formatDisplayDate(finalEndDate)}`);
      setShowDatePicker(false); // Close picker only after selecting the second date
      setIsSelectingStart(true); // Reset for next selection
      setTempStartDate(''); // Clear temporary date
    }
  };

  // Reset to selecting start date when clearing range
  const handleClearRange = () => {
    setDateRange({});
    setIsSelectingStart(true);
    setIsCustomDateRange(false);
    setTempStartDate('');
    setSelectedPeriodLabel("Last 7 days");
    setSelectedPeriod("7d");
  };

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
          if (isCustomDateRange && dateRange.start && dateRange.end) {
            const startDateISO = formatDateForAPI(dateRange.start);
            const endDateISO = formatDateForAPI(dateRange.end);
            url = `${baseUrl}/analytics/user/${user.userId}/direct?startDate=${startDateISO}&endDate=${endDateISO}`;
          } else {
            url = `${baseUrl}/analytics/user/${user.userId}/direct?period=${selectedPeriod}`;
          }
        } else {
          if (isCustomDateRange && dateRange.start && dateRange.end) {
            const startDateISO = formatDateForAPI(dateRange.start);
            const endDateISO = formatDateForAPI(dateRange.end);
            url = `${baseUrl}/analytics/user/${user.userId}/device/${selectedDevice}?startDate=${startDateISO}&endDate=${endDateISO}`;
          } else {
            url = `${baseUrl}/analytics/user/${user.userId}/device/${selectedDevice}`;
          }
        }

        const response = await fetch(url);
        const data = await response.json();

        if (data.success) {
          if (selectedDevice === 'all') {
            setDirectAnalyticsData(data.data);
            setDeviceAnalytics(null);
          } else {
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
  }, [selectedDevice, selectedPeriod, user?.userId, isCustomDateRange, dateRange]);

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
      className="fixed inset-0 bg-cover bg-center bg-no-repeat blur-sm brightness-90"
      style={{ backgroundImage: "url('/image/bg.jpg')" }}/>
      <div className="fixed inset-0 bg-white/40 backdrop-blur-xl" />
      
      {/* Content layer */}
      <div className="relative z-10 min-h-screen pl-64 mb-10">
        {/* Header */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-4 mt-12">
            <Link 
              to="/dashboard" 
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-all duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Back to Dashboard</span>
            </Link>
          </div>
          {/* Header Section */}
          <div className="mb-8">
            {/* Header Row */}
            <div className="flex items-center justify-between h-20">
              {/* Left: Title */}
              <div>
                <h1 className="text-3xl font-bold text-gray-800 mt-5">Detailed Analytics</h1>
              </div>

              {/* Right: Filters */}
              <div className="flex flex-wrap items-center gap-1">
                {/* Date Picker */}
                <div className="relative w-full sm:w-64 date-picker-container">
                  <button
                    onClick={() => setShowDatePicker(!showDatePicker)}
                    className="flex items-center justify-between w-full text-xs text-black rounded-md pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white/70 gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <motion.span
                        key={getDatePlaceholder()}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        {getDatePlaceholder()}
                      </motion.span>
                    </div>
                    <ChevronDown
                      size={16}
                      className={`transform transition-transform duration-200 ${
                        showDatePicker ? "rotate-180" : "rotate-0"
                      }`}
                    />
                  </button>

                  <AnimatePresence>
                    {showDatePicker && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="absolute z-10 right-0 top-full mt-2 w-[24rem] rounded-md shadow-lg bg-white overflow-hidden border border-gray-200"
                      >
                        <div className="p-4 grid grid-cols-[1.1fr_2fr] gap-6">
                          {/* LEFT SIDE — Quick Ranges */}
                          <div className="border-r pr-4">
                            <div className="grid grid-cols-1 gap-2">
                              {[
                                { period: "1d", label: "Last 24 hours" },
                                { period: "7d", label: "Last 7 days" },
                                { period: "30d", label: "Last 30 days" },
                                { period: "all", label: "All Time" },
                              ].map(({ period, label }) => (
                                <button
                                  key={period}
                                  onClick={() => handlePresetPeriodSelect(period as any, label)}
                                  className={`block w-full text-left px-3 py-2 text-xs rounded transition-colors duration-150 ${
                                    !isCustomDateRange && selectedPeriod === period
                                      ? "bg-gray-100"
                                      : "text-gray-700 hover:bg-gray-100 border border-transparent"
                                  }`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* RIGHT SIDE — Custom Range */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                              Custom Range
                            </h4>

                            <div className="mb-3">
                              <div className="flex items-center gap-2 mb-2">
                                <div
                                  className={`w-3 h-3 rounded-full ${
                                    isSelectingStart ? "bg-[#3674B5]" : "bg-gray-300"
                                  }`}
                                ></div>
                                <label className="block text-xs font-medium text-gray-600">
                                  {isSelectingStart ? "Select Start Date" : "Start Date Selected"}
                                </label>
                              </div>
                              {dateRange.start && (
                                <div className="text-xs text-gray-500 mb-2 pl-5">
                                  Start: {formatDisplayDate(dateRange.start)}
                                </div>
                              )}
                            </div>

                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <div
                                  className={`w-3 h-3 rounded-full ${
                                    !isSelectingStart ? "bg-[#3674B5]" : "bg-gray-300"
                                  }`}
                                ></div>
                                <label className="block text-xs font-medium text-gray-600">
                                  {!isSelectingStart ? "Select End Date" : "End Date"}
                                </label>
                              </div>
                              <input
                                type="date"
                                onChange={(e) => handleDateSelect(e.target.value)}
                                className="w-full px-4 py-1 border-b border-gray-300 text-sm focus:outline-none"
                              />
                            </div>
                            <div className='flex justify-between'>
                              <button
                                onClick={() => setShowDatePicker(false)}
                                className="w-10 mt-3 text-gray-600 hover:text-gray-800 text-sm transition-all duration-200 hover:bg-gray-50 rounded"
                              >
                                Close
                              </button>
                              {(dateRange.start || dateRange.end) && (
                                <button
                                  onClick={handleClearRange}
                                  onMouseMove={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const x = ((e.clientX - rect.left) / rect.width) * 100;
                                    const y = ((e.clientY - rect.top) / rect.height) * 100;
                                    setPos({ x, y });
                                  }}
                                  className="relative group inline-flex items-center justify-center overflow-hidden
                                            w-32 px-4 py-2 mt-4 text-white text-sm border border-gray-300
                                            bg-white font-medium transition-all duration-300 hover:scale-[1.03]"
                                  style={{
                                    backgroundImage: `linear-gradient(to right, #1B5087, #3674B5),
                                                      radial-gradient(circle at ${pos.x}% ${pos.y}%, rgba(255,255,255,0), rgba(255,255,255,0))`,
                                  }}
                                >
                                  <span className="inline-flex items-center gap-2 px-2 z-10">Clear Range</span>

                                  {/* Shining hover effect */}
                                  <span
                                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                                    style={{
                                      background: `radial-gradient(circle at ${pos.x}% ${pos.y}%, rgba(255,255,255,0.45), transparent 60%)`,
                                    }}
                                  />
                                </button>
                              )}

                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Device Selection */}
                <div className="relative w-full sm:w-40 device-dropdown-container">
                  <button
                    onClick={() => setShowDeviceDropdown(!showDeviceDropdown)}
                    className="flex items-center justify-between w-full text-xs text-black rounded-md pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white/70 gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="">{selectedDeviceLabel}</span>
                    </div>
                    <ChevronDown
                      size={16}
                      className={`transform transition-transform duration-200 ${
                        showDeviceDropdown ? "rotate-180" : "rotate-0"
                      }`}
                    />
                  </button>

                  <AnimatePresence>
                    {showDeviceDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="absolute z-10 top-full mt-2 w-full rounded-md shadow-lg bg-white overflow-hidden border border-gray-200"
                      >
                        <div className="p-3">
                          {/* All Devices Option */}
                          <button
                            onClick={() => {
                              setSelectedDevice("all");
                              setSelectedDeviceLabel("All Devices");
                              setShowDeviceDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs transition-all duration-200 rounded-md${
                              selectedDevice === "all"
                                ? ""
                                : "hover:bg-gray-50 text-gray-700"
                            }`}
                          >
                            <div>
                              <div>All Devices</div>
                            </div>
                          </button>

                          {/* Individual Devices */}
                          {availableDevices.map((device) => (
                            <button
                              key={device.id}
                              onClick={() => {
                                setSelectedDevice(device.materialId);
                                setSelectedDeviceLabel(device.name);
                                setShowDeviceDropdown(false);
                              }}
                              className={`block w-full text-left px-4 py-2 text-xs ml-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150 ${
                                selectedDevice === device.materialId
                                  ? ""
                                  : "hover:bg-gray-50 text-gray-700"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <div>
                                    <div className="font-medium">{device.name}</div>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <div
                                    className={`w-2 h-2 rounded-full ${
                                      device.isOnline ? "bg-green-500" : "bg-red-500"
                                    }`}
                                  ></div>
                                  <span
                                    className={`text-[10px] font-medium ${
                                      device.isOnline ? "text-green-600" : "text-red-600"
                                    }`}
                                  >
                                    {device.isOnline ? "ONLINE" : "OFFLINE"}
                                  </span>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Ad Selection */}
                <div className="relative w-full sm:w-44 ad-dropdown-container">
                  <button
                    onClick={() => setShowAdDropdown(!showAdDropdown)}
                    className="flex items-center justify-between w-full text-xs text-black rounded-md pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white/70 gap-2"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="">{selectedAdLabel}</span>
                    </div>
                    <ChevronDown
                      size={16}
                      className={`transform transition-transform duration-200 ${
                        showAdDropdown ? "rotate-180" : "rotate-0"
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
                        className="absolute z-10 top-full mt-2 w-full rounded-md shadow-lg bg-white overflow-hidden border border-gray-200"
                      >
                        <div className="p-3">
                          {/* All Ads Option */}
                          <button
                            onClick={() => {
                              setSelectedAd("all");
                              setSelectedAdLabel("All Advertisement");
                              setShowAdDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs transition-all duration-200 rounded-md ${
                              selectedAd === "all"
                                ? ""
                                : "hover:bg-gray-50 text-gray-700"
                            }`}
                          >
                            <div>All Advertisement</div>
                          </button>

                          {/* Individual Ads */}
                          {availableAds.map((ad) => (
                            <button
                              key={ad.id}
                              onClick={() => {
                                setSelectedAd(ad.id);
                                setSelectedAdLabel(ad.title);
                                setShowAdDropdown(false);
                              }}
                              className={`w-full text-left px-3 py-2 text-xs transition-all duration-200 rounded-md mt-1 ${
                                selectedAd === ad.id
                                  ? ""
                                  : "hover:bg-gray-50 text-gray-700"
                              }`}
                            >
                              <div>{ad.title}</div>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Row 2: Refresh Button */}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => window.location.reload()}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width) * 100;
                  const y = ((e.clientY - rect.top) / rect.height) * 100;
                  setPos({ x, y });
                }}
                className="relative group flex items-center justify-center px-4 py-2 
                          font-medium text-white shadow-md overflow-hidden
                          transition-all duration-300 hover:scale-[1.05]"
                style={{
                  backgroundImage: `linear-gradient(to right, #1B5087 0%, #3674B5 100%)`,
                }}
              >
                {/* Shining hover layer (always behind text/icons) */}
                <span
                  className="absolute inset-0 transition-opacity duration-300 opacity-0 group-hover:opacity-100 pointer-events-none z-0"
                  style={{
                    background: `radial-gradient(circle at ${pos.x}% ${pos.y}%, rgba(255,255,255,0.35), transparent 60%)`,
                  }}
                />

                {/* Content layer stays on top */}
                <div className="relative z-10 flex items-center space-x-2">
                  <RefreshCw className="w-4 h-4" />
                  <span>Refresh</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ">
          {/* Loading State */}
          {analyticsLoading && (
            <div className="flex items-center justify-center mb-16">
              <div className="text-center">
                <div className="flex items-center justify-center space-x-3">
                  <LoaderCircle className="w-6 h-6 animate-spin text-blue-500" />
                  <span className="text-lg font-medium text-black/90">Loading Analytics...</span>
                </div>
                <p className="text-sm text-black/80 mt-2">Please wait while we fetch your data</p>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!analyticsLoading && (!analyticsData?.getUserAnalytics && !directAnalyticsData) && (
            <div className="text-center mb-16">
              <div>
                <div className="flex items-center justify-center space-x-3 mb-2">
                  <BarChart3 className="w-6 h-6 text-black/90" />
                  <h3 className="text-lg font-semibold text-black/90">No Analytics Data</h3>
                </div>
                <div className="text-black/80">
                  <p>You don't have any analytics data yet. This is normal for new users or users without deployed ads.</p>
                  <p className="mt-1">Once you create and deploy ads, your detailed analytics will appear here.</p>
                </div>
              </div>
            </div>
          )}

          {/* Simplified Analytics Dashboard */}
          <div className="space-y-6">
            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2 relative z-0">
              <div className="bg-white/50 backdrop-blur-sm p-6  shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300">
                <div className="flex flex-col">
                  {/* Row 1: Icon + Label */}
                  <div className="flex items-center">
                    <div
                      className="p-2 mr-2 rounded-full bg-gradient-to-br from-yellow-300/60 via-yellow-300/40 to-white/40 
                      border border-white/30 backdrop-blur-md shadow-md flex items-center justify-center"
                    >
                      <Youtube className="w-5 h-5 text-yellow-700 drop-shadow-sm" />
                    </div>
                    <p className="text-sm text-black/70 font-medium ml-1">Total Ad Plays</p>
                  </div>

                  {/* Row 2: Value */}
                  <p className="text-3xl font-semibold text-gray-900 mt-1 ml-12">
                    {analyticsLoading ? (
                      <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
                    ) : (
                      (analyticsSummary.totalAdsPlayed || 0).toLocaleString()
                    )}
                  </p>
                </div>
              </div>

              {/* QR Scans */}
              <div className="bg-white/50 backdrop-blur-sm p-6 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300">
                <div className="flex flex-col">
                  {/* Row 1: Icon + Label */}
                  <div className="flex items-center">
                    <div
                      className="p-2 mr-2 rounded-full bg-gradient-to-br from-blue-300/60 via-blue-300/40 to-white/40 
                      border border-white/30 backdrop-blur-md shadow-md flex items-center justify-center"
                    >
                      <QrCode className="w-5 h-5 text-blue-700 drop-shadow-sm" />
                    </div>
                    <p className="text-sm text-black/70 font-medium ml-1">QR Scans</p>
                  </div>

                  {/* Row 2: Value */}
                  <p className="text-3xl font-semibold text-gray-900 mt-1 ml-12">
                    {analyticsLoading ? (
                      <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
                    ) : (
                      (analyticsSummary.totalQRScans || 0).toLocaleString()
                    )}
                  </p>
                </div>
              </div>

              {/* Active Devices */}
              <div className="bg-white/50 backdrop-blur-sm p-6 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300">
                <div className="flex flex-col">
                  <div className="flex items-center">
                    <div
                      className="p-2 mr-2 rounded-full bg-gradient-to-br from-orange-300/60 via-orange-300/40 to-white/40 
                      border border-white/30 backdrop-blur-md shadow-md flex items-center justify-center"
                    >
                      <MonitorSmartphone className="w-5 h-5 text-orange-700 drop-shadow-sm" />
                    </div>
                    <p className="text-sm text-black/70 font-medium ml-1">Active Devices</p>
                  </div>
                  <p className="text-3xl font-semibold text-gray-900 mt-1 ml-12">
                    {analyticsLoading ? (
                      <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
                    ) : (
                      (analyticsSummary.totalMaterials || 0).toLocaleString()
                    )}
                  </p>
                </div>
              </div>

              {/* Online Devices */}
              <div className="bg-white/50 backdrop-blur-sm p-6 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300">
                <div className="flex flex-col">
                  <div className="flex items-center">
                    <div
                      className="p-2 mr-2 rounded-full bg-gradient-to-br from-green-300/60 via-green-300/40 to-white/40 
                      border border-white/30 backdrop-blur-md shadow-md flex items-center justify-center"
                    >
                      <MonitorSmartphone className="w-5 h-5 text-green-700 drop-shadow-sm" />
                    </div>
                    <p className="text-sm text-black/70 font-medium ml-1">Online Devices</p>
                  </div>
                  <p className="text-3xl font-semibold text-gray-900 mt-1 ml-12">
                    {analyticsLoading ? (
                      <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
                    ) : (
                      availableDevices.filter((device) => device.isOnline).length
                    )}
                  </p>
                </div>
              </div>

              {/* Completion Rate */}
              <div className="bg-white/50 backdrop-blur-sm p-6 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300">
                <div className="flex flex-col">
                  <div className="flex items-center">
                    <div
                      className="p-2 mr-2 rounded-full bg-gradient-to-br from-purple-300/60 via-purple-300/40 to-white/40 
                      border border-white/30 backdrop-blur-md shadow-md flex items-center justify-center"
                    >
                      <TrendingUp className="w-5 h-5 text-purple-700 drop-shadow-sm" />
                    </div>
                    <p className="text-sm text-black/70 font-medium ml-1">Completion Rate</p>
                  </div>
                  <p className="text-3xl font-semibold text-gray-900 mt-1 ml-12">
                    {analyticsLoading ? (
                      <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
                    ) : (
                      `${analyticsSummary.averageCompletionRate.toFixed(1)}%`
                    )}
                  </p>
                </div>
              </div>

            </div>

            {/* Performance Chart */}
            <div className="bg-white/20 backdrop-blur-sm p-6  shadow-lg border border-white/20">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-black/80 mb-1">Performance Over Time</h3>
                  <p className="text-sm text-black/60">Track your ad performance trends</p>
                </div>
                <div className="text-xs text-white bg-[#3674B5] px-3 py-2 rounded-full">
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
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-black/80 mb-1">Top Performing Ads</h3>
                    <p className="text-sm text-black/60">Your best performing advertisements</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {topPerformingAds.slice(0, 5).map((ad: any, index: number) => (
                    <div 
                      key={ad.adId} 
                      className="flex items-center justify-between p-4 bg-white/70 rounded-md shadow-sm hover:shadow-md transition-all duration-200"
                    >
                      
                      {/* LEFT SECTION: Position and Ad Title */}
                      <div className="flex items-center space-x-4"> {/* <-- CHANGED: items-start to items-center */}
                        {/* Position/Medal Icon */}
                        <div className={`
                          w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center font-bold shadow-md
                          ${index === 0 ? 'bg-yellow-100 text-yellow-700' : 
                            index === 1 ? 'bg-gray-100 text-gray-600' : 
                            index === 2 ? 'bg-orange-100 text-orange-600' : 
                            'bg-blue-50 text-black/60'}
                        `}>
                          <span className="text-sm">
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                          </span>
                        </div>
                        
                        {/* Ad Title */}
                        {/* <-- WRAPPER DIV IS OPTIONAL HERE BUT GOOD PRACTICE --> */}
                        <div> 
                            <p className="font-semibold text-black/90 text-lg">{ad.adTitle}</p>
                        </div>
                      </div>
                      
                      {/* RIGHT SECTION: Performance Metrics */}
                      <div className="flex items-center space-x-6 text-right">
                        
                        {/* Plays / Devices */}
                        <div className="w-20"> 
                          <p className="text-base font-bold text-black/70">
                            {selectedDevice !== 'all' ? (ad.totalPlays || 0).toLocaleString() : (ad.totalMaterials || 0).toLocaleString()}
                          </p>
                          <p className="text-xs text-black/50 font-medium leading-none mt-0.5">
                            {selectedDevice !== 'all' ? 'Plays' : 'Devices'}
                          </p>
                        </div>
                        
                        {/* Views */}
                        <div className="w-20">
                          <p className="text-base font-bold text-black/70">
                            {(ad.totalAdImpressions || 0).toLocaleString()}
                          </p>
                          <p className="text-xs text-black/50 font-medium leading-none mt-0.5">
                            Views
                          </p>
                        </div>

                        {/* QR Scans (Highlighted) */}
                        <div className="w-20 ml-6 pl-4 border-l border-gray-200">
                          <p className="text-xl font-extrabold text-green-600">
                            {selectedDevice !== 'all' ? 
                              (deviceAnalytics?.qrScanBreakdown?.find((qr: any) => qr.adId === ad.adId)?.totalScans || 0).toLocaleString() : 
                              (ad.totalQRScans || 0).toLocaleString()
                            }
                          </p>
                          <p className="text-xs text-green-700 font-bold leading-none mt-0.5">
                            QR Scans
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Error State */}
          {analyticsError && (
            <div className="p-4 mb-6">
              <p className="text-red-600">Error loading analytics data: {analyticsError.message}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DetailedAnalytics;