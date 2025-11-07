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
import { GET_MY_ADS } from '../../graphql/user/queries/getMyAds';
import { ArrowLeft, RefreshCw, TrendingUp, Play, Target, Users, Calendar, Monitor, ChevronDown, BarChart3, Filter, LoaderCircle, Youtube, MonitorSmartphone, QrCode } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { AnimatePresence, motion } from 'framer-motion';

const DetailedAnalytics: React.FC = () => {
  const { user } = useUserAuth();
  const [searchParams] = useSearchParams();
  const [selectedPeriod, setSelectedPeriod] = useState<'1d' | '7d' | '30d' | 'all'>('all');
  const [userFirstName, setUserFirstName] = useState('User');
  
  // Device selection state
  const [selectedDevice, setSelectedDevice] = useState<string>('all');
  const [availableDevices, setAvailableDevices] = useState<Array<{id: string, name: string, materialId: string, isOnline: boolean}>>([]);
  const [deviceAnalytics, setDeviceAnalytics] = useState<any>(null);
  const [deviceLoading, setDeviceLoading] = useState(false);

  // State for direct API data (bypassing GraphQL)
  const [directAnalyticsData, setDirectAnalyticsData] = useState<any>(null);
  const [directAnalyticsLoading, setDirectAnalyticsLoading] = useState(false);

  // Date Picker States
  const [dateRange, setDateRange] = useState<{ start?: string; end?: string }>({});
  const [isSelectingStart, setIsSelectingStart] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedPeriodLabel, setSelectedPeriodLabel] = useState("All Time");
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

  // ✅ Helper function to check if current date is included in the selected range
  const isCurrentDateIncluded = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (isCustomDateRange && dateRange.start && dateRange.end) {
      const startDate = new Date(dateRange.start);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(dateRange.end);
      endDate.setHours(0, 0, 0, 0);
      return today >= startDate && today <= endDate;
    } else {
      // For preset periods, check if period includes today
      // '1d' = last 1 day (includes today), '7d' = last 7 days (includes today), etc.
      // 'all' = all time (includes today)
      return selectedPeriod === '1d' || selectedPeriod === '7d' || selectedPeriod === '30d' || selectedPeriod === 'all';
    }
  }, [isCustomDateRange, dateRange, selectedPeriod]);

  // Track initial load to distinguish from background refreshes
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const hasInitiallyLoadedRef = useRef(false);

  // Fetch analytics data with optimized cache policy
  // ✅ Add polling when current date is included (for real-time updates)
  // ✅ Pass date range parameters when custom date range is selected
  // ✅ Skip GraphQL query when using custom date range (use direct API instead)
  const { data: analyticsData, loading: analyticsLoading, error: analyticsError, refetch: refetchAnalytics } = useQuery(GET_USER_ANALYTICS, {
    variables: { 
      period: isCustomDateRange ? undefined : selectedPeriod,
      startDate: isCustomDateRange && dateRange.start ? formatDateForAPI(dateRange.start) : undefined,
      endDate: isCustomDateRange && dateRange.end ? formatDateForAPI(dateRange.end) : undefined
    },
    fetchPolicy: 'cache-first',
    nextFetchPolicy: 'cache-and-network',
    errorPolicy: 'all',
    // ✅ Poll every 30 seconds when viewing current day data (silent background refresh)
    // ✅ Skip polling when using custom date range to avoid interfering with direct API data
    pollInterval: (isCurrentDateIncluded && !isCustomDateRange) ? 30000 : 0,
    // ✅ Don't trigger loading state during polling (silent background refresh)
    notifyOnNetworkStatusChange: false,
    // ✅ Skip query when using custom date range to avoid conflicts with direct API
    skip: isCustomDateRange && dateRange.start && dateRange.end
  });

  // Handle analytics errors using useEffect (replaces deprecated onError callback)
  // ✅ Suppress network errors when using custom date range (GraphQL query is skipped but may still error)
  useEffect(() => {
    if (analyticsError) {
      // Only log errors that aren't network errors when using custom date range
      // Network errors are expected when GraphQL query is skipped during polling
      if (isCustomDateRange && dateRange.start && dateRange.end) {
        // Silently ignore network errors when using custom date range
        // These are expected because we skip the GraphQL query
        return;
      }
      if (analyticsError.message !== 'Failed to fetch analytics data') {
        console.error('Unexpected analytics error:', analyticsError);
      }
    }
  }, [analyticsError, isCustomDateRange, dateRange]);

  // ✅ Fetch overall analytics data for Summary Metrics (always uses 'all' period, no adId filter)
  // This ensures summary metrics (Total Ad Plays, QR Scans, etc.) always show cumulative totals
  // Performance Over Time chart uses directAnalyticsData which respects filters
  const { data: overallAnalyticsData } = useQuery(GET_USER_ANALYTICS, {
    variables: { 
      period: 'all', // Always fetch overall data for Summary Metrics
      adId: null // No adId filter - show all ads cumulative totals
    },
    fetchPolicy: 'cache-first',
    nextFetchPolicy: 'cache-and-network',
    errorPolicy: 'all',
    // ✅ Poll every 30 seconds when viewing current day data (silent background refresh)
    // ✅ Skip polling when using custom date range to avoid connection errors
    pollInterval: (isCurrentDateIncluded && !isCustomDateRange) ? 30000 : 0,
    // ✅ Don't trigger loading state during polling (silent background refresh)
    notifyOnNetworkStatusChange: false,
    // ✅ Skip query entirely when using custom date range to avoid unnecessary requests
    skip: isCustomDateRange && dateRange.start && dateRange.end
  });

  // ✅ Fetch user's ads with materialId to filter devices
  const { data: myAdsData } = useQuery(GET_MY_ADS, {
    fetchPolicy: 'cache-first',
    errorPolicy: 'all'
  });

  // Get user's first name from UserAuthContext
  useEffect(() => {
    if (user?.firstName) {
      setUserFirstName(user.firstName);
    }
  }, [user]);

  // ✅ Memoized mapping of adId to materialIds
  // Maps ad.id (from GET_MY_ADS) to materialIds array
  // ✅ Only includes active/paid ads with materials (same filter as extractedAds)
  const adToMaterialIdsMap = useMemo(() => {
    const map = new Map<string, string[]>();
    const filteredOutAds: any[] = [];
    
    if (myAdsData?.getMyAds) {
      myAdsData.getMyAds.forEach((ad: any) => {
        // Only include active/paid ads with materials (same filter as extractedAds)
        const hasValidStatus = ad.status === 'APPROVED' || ad.status === 'RUNNING' || ad.status === 'SCHEDULED';
        const isPaid = ad.paymentStatus === 'PAID';
        const hasMaterials = ad.materialId && Array.isArray(ad.materialId) && ad.materialId.length > 0;
        
        if (hasValidStatus && isPaid && hasMaterials && ad.id) {
          // Extract materialId strings from the materialId array
          const materialIds = ad.materialId
            .map((m: any) => m?.materialId)
            .filter((id: string | undefined) => id); // Filter out undefined/null
          if (materialIds.length > 0) {
            // Map using ad.id (as string to ensure consistent lookups)
            const adIdKey = ad.id.toString();
            map.set(adIdKey, materialIds);
            // Also set with original id format in case it's different
            if (ad.id !== adIdKey) {
              map.set(ad.id, materialIds);
            }
          } else {
            filteredOutAds.push({ id: ad.id, title: ad.title, reason: 'No valid materialIds extracted' });
          }
        } else {
          filteredOutAds.push({ 
            id: ad.id, 
            title: ad.title, 
            status: ad.status, 
            paymentStatus: ad.paymentStatus,
            hasMaterials: hasMaterials,
            reason: !hasValidStatus ? 'Invalid status' : !isPaid ? 'Not paid' : !hasMaterials ? 'No materials' : 'Unknown'
          });
        }
      });
    }
    const mapEntries = Array.from(map.entries()).map(([id, materials]) => ({ adId: id, materialCount: materials.length, materials }));
    console.log('📊 [DetailedAnalytics] Built adToMaterialIdsMap:', mapEntries);
    console.log('📊 [DetailedAnalytics] Total ads in myAdsData:', myAdsData?.getMyAds?.length || 0);
    console.log('📊 [DetailedAnalytics] Ads included in map:', mapEntries.length);
    console.log('📊 [DetailedAnalytics] Ads filtered out:', filteredOutAds.length, filteredOutAds);
    if (myAdsData?.getMyAds?.[0]) {
      console.log('📊 [DetailedAnalytics] Sample ad structure:', {
        id: myAdsData.getMyAds[0].id,
        title: myAdsData.getMyAds[0].title,
        status: myAdsData.getMyAds[0].status,
        paymentStatus: myAdsData.getMyAds[0].paymentStatus,
        materialIdCount: myAdsData.getMyAds[0].materialId?.length || 0,
        materialIdStructure: myAdsData.getMyAds[0].materialId?.[0]
      });
    }
    return map;
  }, [myAdsData]);

  // ✅ All-time devices extraction (for summary metrics - always shows all devices)
  // This is NOT affected by date/ad/device filters
  const allTimeDevices = useMemo(() => {
    // Always use overallAnalyticsData (all-time, all ads) for summary metrics
    if (overallAnalyticsData?.getUserAnalytics?.deviceStats && overallAnalyticsData.getUserAnalytics.deviceStats.length > 0) {
      const devices = overallAnalyticsData.getUserAnalytics.deviceStats.map((device: any, index: number) => ({
        id: device.materialId || device.deviceId || `device-${index}`,
        name: device.materialId || device.deviceId || `Vehicle ${index + 1}`,
        materialId: device.materialId || device.deviceId || `device-${index}`,
        isOnline: device.isOnline || false,
        deviceStatus: device.deviceStatus || null
      }));
      console.log('📊 [DetailedAnalytics] All-time devices from overallAnalyticsData:', devices.length);
      return devices;
    }
    
    console.log('⚠️ [DetailedAnalytics] No all-time devices found in overallAnalyticsData');
    return [];
  }, [overallAnalyticsData]);

  // ✅ Online devices count - respects filters
  // When device is selected: returns 1 if online, 0 if offline
  // Otherwise: counts online devices from filtered data
  const onlineDevicesCount = useMemo(() => {
    // When a specific device is selected
    if (selectedDevice !== 'all') {
      // Check if the selected device is online
      // First check deviceAnalytics (most accurate for selected device)
      if (deviceAnalytics?.deviceInfo) {
        // Check if device is online from deviceAnalytics
        // We need to check the device status - try to get from availableDevices or deviceAnalytics
        const device = availableDevices.find(d => d.materialId === selectedDevice);
        if (device) {
          return device.isOnline ? 1 : 0;
        }
        // If not found in availableDevices, check if we can determine from deviceAnalytics
        // For now, assume we need to check from filtered devices or overall data
        // Fallback: check from allTimeDevices
        const allTimeDevice = allTimeDevices.find(d => d.materialId === selectedDevice);
        return allTimeDevice?.isOnline ? 1 : 0;
      }
      // Fallback: check from allTimeDevices
      const allTimeDevice = allTimeDevices.find(d => d.materialId === selectedDevice);
      return allTimeDevice?.isOnline ? 1 : 0;
    }
    
    // When device is 'all', count online devices from filtered data
    // Prefer directAnalyticsData (filtered by date/ad)
    if (directAnalyticsData?.deviceStats && directAnalyticsData.deviceStats.length > 0) {
      return directAnalyticsData.deviceStats.filter((device: any) => device.isOnline).length;
    }
    
    // Fallback to GraphQL analyticsData (filtered by date/period)
    if (analyticsData?.getUserAnalytics?.deviceStats && analyticsData.getUserAnalytics.deviceStats.length > 0) {
      return analyticsData.getUserAnalytics.deviceStats.filter((device: any) => device.isOnline).length;
    }
    
    // Final fallback: count from all-time devices (when no filters)
    return allTimeDevices.filter((device) => device.isOnline).length;
  }, [selectedDevice, deviceAnalytics, availableDevices, allTimeDevices, directAnalyticsData, analyticsData]);

  // Memoized device extraction from analytics data (for dropdown - filtered by date/ad)
  const extractedDevices = useMemo(() => {
    // Try to get devices from directAnalyticsData first (most up-to-date, filtered data)
    if (directAnalyticsData?.deviceStats && directAnalyticsData.deviceStats.length > 0) {
      const devices = directAnalyticsData.deviceStats.map((device: any, index: number) => ({
        id: device.materialId || `device-${index}`,
        name: device.materialId || `Vehicle ${index + 1}`,
        materialId: device.materialId || `device-${index}`,
        isOnline: device.isOnline || false,
        deviceStatus: device.deviceStatus || null
      }));
      console.log('📊 [DetailedAnalytics] Extracted devices from directAnalyticsData (filtered):', devices.length);
      return devices;
    }
    
    // Fallback: Try to get devices from GraphQL analytics data (filtered)
    if (analyticsData?.getUserAnalytics?.deviceStats && analyticsData.getUserAnalytics.deviceStats.length > 0) {
      const devices = analyticsData.getUserAnalytics.deviceStats.map((device: any, index: number) => ({
        id: device.materialId || device.deviceId || `device-${index}`,
        name: device.materialId || device.deviceId || `Vehicle ${index + 1}`,
        materialId: device.materialId || device.deviceId || `device-${index}`,
        isOnline: device.isOnline || false,
        deviceStatus: device.deviceStatus || null
      }));
      console.log('📊 [DetailedAnalytics] Extracted devices from analyticsData (GraphQL, filtered):', devices.length);
      return devices;
    }
    
    console.log('⚠️ [DetailedAnalytics] No devices found in filtered analytics data');
    return [];
  }, [analyticsData, directAnalyticsData]);

  // ✅ Filter devices based on selected ad
  // If devices aren't in analytics yet, create device entries from ad's materialIds
  const filteredDevices = useMemo(() => {
    if (selectedAd === 'all' || !selectedAd) {
      // Show all devices when no ad is selected
      return extractedDevices;
    }

    // Try to get materialIds for the selected ad (try both string and original format)
    const selectedAdStr = selectedAd.toString();
    let materialIdsForAd = adToMaterialIdsMap.get(selectedAdStr) || adToMaterialIdsMap.get(selectedAd);
    
    if (!materialIdsForAd || materialIdsForAd.length === 0) {
      // Debug: Log what we're looking for
      console.log('🔍 [DetailedAnalytics] No materialIds found for ad:', selectedAd, '(string:', selectedAdStr, ')');
      console.log('🔍 [DetailedAnalytics] Available ad IDs in map:', Array.from(adToMaterialIdsMap.keys()));
      // If no materialIds found for this ad, show all devices (fallback)
      return extractedDevices;
    }

    console.log('✅ [DetailedAnalytics] Found materialIds for ad:', selectedAd, 'Materials:', materialIdsForAd);
    console.log('🔍 [DetailedAnalytics] Available devices from analytics (materialIds):', extractedDevices.map(d => d.materialId));
    
    // Filter devices that match the ad's materialIds
    const filteredFromAnalytics = extractedDevices.filter(device => materialIdsForAd.includes(device.materialId));
    
    // ✅ If no devices found in analytics but ad has materialIds, create device entries from materialIds
    if (filteredFromAnalytics.length === 0 && materialIdsForAd.length > 0) {
      console.log('⚠️ [DetailedAnalytics] No devices in analytics yet, creating device entries from ad materialIds');
      const devicesFromMaterialIds = materialIdsForAd.map((materialId: string) => ({
        id: materialId,
        name: materialId,
        materialId: materialId,
        isOnline: false, // Default to offline since we don't have status yet
        deviceStatus: null
      }));
      console.log('✅ [DetailedAnalytics] Created devices from materialIds:', devicesFromMaterialIds.length);
      return devicesFromMaterialIds;
    }

    console.log('🔍 [DetailedAnalytics] Filtering devices. Total devices:', extractedDevices.length, 'Filtered:', filteredFromAnalytics.length);
    console.log('🔍 [DetailedAnalytics] Filtered device materialIds:', filteredFromAnalytics.map(d => d.materialId));

    return filteredFromAnalytics;
  }, [extractedDevices, selectedAd, adToMaterialIdsMap, myAdsData]);

  // ✅ Memoized ad extraction - use myAdsData for consistency (same source as mapping)
  // This ensures ad IDs match between selection and materialId mapping
  // ✅ Filter to only show active/paid ads with assigned materials (exclude PENDING, REJECTED)
  const extractedAds = useMemo(() => {
    // Prefer myAdsData since it has materialId information
    if (myAdsData?.getMyAds && myAdsData.getMyAds.length > 0) {
      // Filter ads: only show APPROVED, RUNNING, or SCHEDULED ads that are PAID and have materials assigned
      const activeAds = myAdsData.getMyAds.filter((ad: any) => {
        const hasValidStatus = ad.status === 'APPROVED' || ad.status === 'RUNNING' || ad.status === 'SCHEDULED';
        const isPaid = ad.paymentStatus === 'PAID';
        const hasMaterials = ad.materialId && Array.isArray(ad.materialId) && ad.materialId.length > 0;
        return hasValidStatus && isPaid && hasMaterials;
      });
      
      return activeAds.map((ad: any) => ({
        id: ad.id,
        title: ad.title || 'Unknown Ad'
      }));
    }
    
    // Fallback to analytics data if myAdsData not available
    // Analytics data typically only contains ads that have analytics (active/paid ads)
    const adPerformance = overallAnalyticsData?.getUserAnalytics?.adPerformance || directAnalyticsData?.adPerformance || analyticsData?.getUserAnalytics?.adPerformance || [];
    
    if (adPerformance.length > 0) {
      const ads = adPerformance.map((ad: any) => ({
        id: ad.adId || `ad-${ad.adTitle}`,
        title: ad.adTitle || 'Unknown Ad'
      }));
      return ads;
    }
    return [];
  }, [myAdsData, overallAnalyticsData, directAnalyticsData, analyticsData]);

  // ✅ Update available devices when filtered devices change
  useEffect(() => {
    setAvailableDevices(filteredDevices);
    
    // ✅ If selected device is not in filtered devices, reset to 'all'
    if (selectedDevice !== 'all' && filteredDevices.length > 0) {
      const deviceExists = filteredDevices.some(device => device.materialId === selectedDevice);
      if (!deviceExists) {
        setSelectedDevice('all');
        setSelectedDeviceLabel('All Devices');
      }
    }
  }, [filteredDevices, selectedDevice]);

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
    setSelectedPeriodLabel("All Time");
    setSelectedPeriod("all");
  };

  // Fetch analytics data (both all devices and specific device) with debouncing and useCallback
  // ✅ Updated to include adId parameter when an ad is selected
  // ✅ Added silent parameter to disable loading state during background refreshes
  const fetchDirectAnalytics = useCallback(async (silent: boolean = false) => {
    if (!user?.userId) return;

    if (directFetchTimeoutRef.current) {
      clearTimeout(directFetchTimeoutRef.current);
    }

    directFetchTimeoutRef.current = setTimeout(async () => {
      try {
        // Only show loading state if not silent (initial load or manual refresh)
        if (!silent) {
          setDirectAnalyticsLoading(true);
        }
        const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace('/graphql', '').replace(/\/$/, '');

        // ✅ Build query parameters including adId if selected
        const queryParams = new URLSearchParams();
        
        // ✅ Add adId if an ad is selected (not 'all')
        if (selectedAd && selectedAd !== 'all') {
          queryParams.append('adId', selectedAd);
        }

        let url;
        if (selectedDevice === 'all') {
          if (isCustomDateRange && dateRange.start && dateRange.end) {
            const startDateISO = formatDateForAPI(dateRange.start);
            const endDateISO = formatDateForAPI(dateRange.end);
            queryParams.append('startDate', startDateISO);
            queryParams.append('endDate', endDateISO);
            url = `${baseUrl}/analytics/user/${user.userId}/direct?${queryParams.toString()}`;
          } else {
            queryParams.append('period', selectedPeriod);
            url = `${baseUrl}/analytics/user/${user.userId}/direct?${queryParams.toString()}`;
          }
        } else {
          if (isCustomDateRange && dateRange.start && dateRange.end) {
            const startDateISO = formatDateForAPI(dateRange.start);
            const endDateISO = formatDateForAPI(dateRange.end);
            queryParams.append('startDate', startDateISO);
            queryParams.append('endDate', endDateISO);
            url = `${baseUrl}/analytics/user/${user.userId}/device/${selectedDevice}?${queryParams.toString()}`;
          } else {
            url = `${baseUrl}/analytics/user/${user.userId}/device/${selectedDevice}?${queryParams.toString()}`;
          }
        }

        const response = await fetch(url);
        const data = await response.json();

        if (data.success) {
          if (selectedDevice === 'all') {
            console.log('📊 [DetailedAnalytics] Received directAnalyticsData:', {
              hasDeviceStats: !!data.data?.deviceStats,
              deviceStatsCount: data.data?.deviceStats?.length || 0,
              hasSummary: !!data.data?.summary,
              summary: data.data?.summary ? {
                totalAdsPlayed: data.data.summary.totalAdsPlayed,
                totalDisplayTime: data.data.summary.totalDisplayTime,
                totalQRScans: data.data.summary.totalQRScans,
                totalDevices: data.data.summary.totalDevices,
                totalMaterials: data.data.summary.totalMaterials
              } : null,
              hasAdPerformance: !!data.data?.adPerformance,
              adPerformanceCount: data.data?.adPerformance?.length || 0,
              hasDailyStats: !!data.data?.dailyStats,
              dailyStatsCount: data.data?.dailyStats?.length || 0,
              dailyStatsDateRange: data.data?.dailyStats?.length > 0 ? {
                first: data.data.dailyStats[0]?.date,
                last: data.data.dailyStats[data.data.dailyStats.length - 1]?.date
              } : null,
              selectedAd: selectedAd,
              selectedPeriod: selectedPeriod,
              dateRange: isCustomDateRange ? { start: dateRange.start, end: dateRange.end } : { period: selectedPeriod },
              url: url
            });
            
            // ✅ Only update state if we have data (prevent clearing existing data)
            if (data.data) {
              setDirectAnalyticsData(data.data);
              setDeviceAnalytics(null);
              console.log('✅ [DetailedAnalytics] Successfully set directAnalyticsData', {
                dailyStatsCount: data.data.dailyStats?.length || 0,
                period: selectedPeriod,
                ad: selectedAd
              });
              
              // ✅ Warn if period='all' but no dailyStats (server should return data for all time)
              if (selectedPeriod === 'all' && selectedAd === 'all' && (!data.data.dailyStats || data.data.dailyStats.length === 0)) {
                console.warn('⚠️ [DetailedAnalytics] Period is "all" but server returned no dailyStats. This might indicate no data exists or server issue.');
              }
            } else {
              console.warn('⚠️ [DetailedAnalytics] API returned success but no data');
            }
          } else {
            setDeviceAnalytics(data.data.deviceAnalytics);
            setDirectAnalyticsData(null);
          }
        } else {
          console.log('⚠️ [DetailedAnalytics] API returned success: false', data);
          // ✅ Don't clear existing data on error - keep previous data visible
          // Only clear if this is an initial load (not a background refresh)
          if (!silent) {
            // Only clear on explicit user action, not on background errors
            console.warn('⚠️ [DetailedAnalytics] API error, keeping existing data');
          }
        }
      } catch (error) {
        console.error('Error fetching direct analytics:', error);
        // ✅ Don't clear existing data on error - keep previous data visible
        // This prevents the graph from disappearing when there's a network error
        if (!silent) {
          console.warn('⚠️ [DetailedAnalytics] Network error, keeping existing data');
        }
      } finally {
        // Only hide loading state if it was shown (not silent)
        if (!silent) {
          setDirectAnalyticsLoading(false);
        }
      }
    }, 300);
  }, [selectedDevice, selectedPeriod, selectedAd, user?.userId, isCustomDateRange, dateRange]);

  // ✅ Fetch analytics data when device, ad, period, or date range changes
  // ✅ FIX: Ensure this runs immediately on mount with default values
  useEffect(() => {
    // Show loading for initial load or when filters change (user action)
    if (user?.userId) {
      console.log('📊 [DetailedAnalytics] Fetching direct analytics with filters:', {
        selectedPeriod,
        selectedAd,
        selectedDevice,
        isCustomDateRange,
        dateRange
      });
      fetchDirectAnalytics(false);
    }
    
    // Mark initial load as complete after first successful load
    if (!hasInitiallyLoadedRef.current && (directAnalyticsData || analyticsData)) {
      hasInitiallyLoadedRef.current = true;
      setIsInitialLoad(false);
    }
  }, [selectedDevice, selectedAd, selectedPeriod, isCustomDateRange, dateRange.start, dateRange.end, fetchDirectAnalytics, user?.userId]);
  
  // Mark initial load as complete once we have data
  useEffect(() => {
    if (isInitialLoad && (directAnalyticsData || analyticsData?.getUserAnalytics)) {
      setIsInitialLoad(false);
      hasInitiallyLoadedRef.current = true;
    }
  }, [directAnalyticsData, analyticsData, isInitialLoad]);

  // ✅ Poll direct analytics when current date is included (silent background refresh)
  // ✅ Skip polling when using custom date range to avoid interfering with the data
  useEffect(() => {
    if (!isCurrentDateIncluded) return;
    // ✅ Don't poll when using custom date range (only poll for preset periods)
    if (isCustomDateRange) return;
    
    // Poll every 30 seconds when viewing current day data (silent refresh)
    const pollInterval = setInterval(() => {
      fetchDirectAnalytics(true); // Silent background refresh
    }, 30000); // 30 seconds
    
    return () => clearInterval(pollInterval);
  }, [isCurrentDateIncluded, isCustomDateRange, fetchDirectAnalytics]);

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

  // ✅ Analytics summary calculation - Respects filters but defaults to cumulative totals
  // Logic:
  // - Default (no date, ad="all", device="all"): Show cumulative totals
  // - Date selected: Show filtered by date
  // - Ad selected: Show filtered by ad
  // - Device selected: Show filtered by device
  // - Any combination: Show filtered totals
  const analyticsSummary = useMemo(() => {
    // Check if any filters are active
    // Date filter is active if: custom date range is set OR period is not 'all' (default '7d' is considered a filter)
    const hasDateFilter = (isCustomDateRange && (dateRange.start || dateRange.end)) || (selectedPeriod !== 'all');
    const hasAdFilter = selectedAd !== 'all';
    const hasDeviceFilter = selectedDevice !== 'all';
    
    // Default state: no filters applied - use cumulative totals
    // Only show cumulative when: period='all', no custom date range, ad='all', device='all'
    if (selectedPeriod === 'all' && !isCustomDateRange && !hasAdFilter && !hasDeviceFilter) {
      const overallSummary = overallAnalyticsData?.getUserAnalytics?.summary || {
        totalAdsPlayed: 0,
        totalDisplayTime: 0,
        averageCompletionRate: 0,
        totalAds: 0,
        activeAds: 0,
        totalMaterials: 0,
        totalDevices: 0,
        totalQRScans: 0
      };
      return overallSummary;
    }
    
    // When a specific device is selected, use deviceAnalytics
    if (hasDeviceFilter && deviceAnalytics) {
      return {
        totalAdsPlayed: deviceAnalytics.totals?.totalAdPlays || 0,
        totalDisplayTime: deviceAnalytics.totals?.totalAdPlayTime || 0,
        averageCompletionRate: deviceAnalytics.averages?.averageCompletionRate || 0,
        totalAds: 0, // Not applicable for device-specific view
        activeAds: 0, // Not applicable for device-specific view
        totalMaterials: 1, // Always 1 when device is selected
        totalDevices: 1, // Always 1 when device is selected
        totalQRScans: deviceAnalytics.totals?.totalQRScans || 0
      };
    }
    
    // When filters are applied but device is 'all', use filtered data
    // Prefer directAnalyticsData (from direct API call) as it respects all filters including adId
    if (directAnalyticsData?.summary) {
      return {
        totalAdsPlayed: directAnalyticsData.summary.totalAdsPlayed || 0,
        totalDisplayTime: directAnalyticsData.summary.totalDisplayTime || 0,
        averageCompletionRate: directAnalyticsData.summary.averageCompletionRate || 0,
        totalAds: directAnalyticsData.summary.totalAds || 0,
        activeAds: directAnalyticsData.summary.activeAds || 0,
        totalMaterials: directAnalyticsData.summary.totalMaterials || 0,
        totalDevices: directAnalyticsData.summary.totalDevices || 0,
        totalQRScans: directAnalyticsData.summary.totalQRScans || 0
      };
    }
    
    // Fallback to GraphQL analyticsData (respects date/period but not adId)
    if (analyticsData?.getUserAnalytics?.summary) {
      return analyticsData.getUserAnalytics.summary;
    }
    
    // Final fallback: cumulative totals
    return overallAnalyticsData?.getUserAnalytics?.summary || {
      totalAdsPlayed: 0,
      totalDisplayTime: 0,
      averageCompletionRate: 0,
      totalAds: 0,
      activeAds: 0,
      totalMaterials: 0,
      totalDevices: 0,
      totalQRScans: 0
    };
  }, [overallAnalyticsData, directAnalyticsData, analyticsData, deviceAnalytics, selectedAd, selectedDevice, selectedPeriod, isCustomDateRange, dateRange]);

  // Format display time helper
  const formatDisplayTime = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }, []);

  // Daily stats for charts
  // ✅ FIX: Default state (period='all', ad='all', device='all') should show all data
  const dailyStats = useMemo(() => {
    if (selectedDevice === 'all') {
      // ✅ When using custom date range, ONLY use directAnalyticsData (don't fall back to GraphQL)
      // ✅ When NOT using custom date range, use directAnalyticsData first, then fallback to GraphQL
      let dailyStats: any[] = [];
      
      if (isCustomDateRange && dateRange.start && dateRange.end) {
        // Custom date range: ONLY use directAnalyticsData
        dailyStats = directAnalyticsData?.dailyStats || [];
        console.log('📊 [DetailedAnalytics] Using ONLY directAnalyticsData for custom date range:', {
          hasDirectData: !!directAnalyticsData,
          dailyStatsCount: dailyStats.length,
          dateRange: { start: dateRange.start, end: dateRange.end }
        });
      } else {
        // Preset period: Use directAnalyticsData first, fallback to GraphQL analyticsData, then overallAnalyticsData
        // ✅ For default state (period='all'), try multiple sources to ensure we get data
        if (directAnalyticsData?.dailyStats && directAnalyticsData.dailyStats.length > 0) {
          dailyStats = directAnalyticsData.dailyStats;
          console.log('📊 [DetailedAnalytics] Using directAnalyticsData dailyStats:', dailyStats.length, 'days', {
            sample: dailyStats.slice(0, 3),
            totalAdsPlayed: dailyStats.reduce((sum: number, day: any) => sum + (day.adsPlayed || day.adPlays || 0), 0),
            totalQrScans: dailyStats.reduce((sum: number, day: any) => sum + (day.qrScans || 0), 0)
          });
        } else if (analyticsData?.getUserAnalytics?.dailyStats && analyticsData.getUserAnalytics.dailyStats.length > 0) {
          dailyStats = analyticsData.getUserAnalytics.dailyStats;
          console.log('📊 [DetailedAnalytics] Using analyticsData dailyStats:', dailyStats.length, 'days', {
            sample: dailyStats.slice(0, 3),
            totalAdsPlayed: dailyStats.reduce((sum: number, day: any) => sum + (day.adsPlayed || day.adPlays || 0), 0),
            totalQrScans: dailyStats.reduce((sum: number, day: any) => sum + (day.qrScans || 0), 0)
          });
        } else if (selectedPeriod === 'all' && selectedAd === 'all' && overallAnalyticsData?.getUserAnalytics?.dailyStats && overallAnalyticsData.getUserAnalytics.dailyStats.length > 0) {
          // ✅ Fallback to overallAnalyticsData for default state (all time, all ads)
          dailyStats = overallAnalyticsData.getUserAnalytics.dailyStats;
          console.log('📊 [DetailedAnalytics] Using overallAnalyticsData dailyStats (default state fallback):', dailyStats.length, 'days', {
            sample: dailyStats.slice(0, 3),
            totalAdsPlayed: dailyStats.reduce((sum: number, day: any) => sum + (day.adsPlayed || day.adPlays || 0), 0),
            totalQrScans: dailyStats.reduce((sum: number, day: any) => sum + (day.qrScans || 0), 0)
          });
        } else {
          dailyStats = [];
          console.log('📊 [DetailedAnalytics] No dailyStats found in any data source', {
            hasDirectData: !!directAnalyticsData,
            hasAnalyticsData: !!analyticsData?.getUserAnalytics,
            hasOverallData: !!overallAnalyticsData?.getUserAnalytics,
            directStatsCount: directAnalyticsData?.dailyStats?.length || 0,
            analyticsStatsCount: analyticsData?.getUserAnalytics?.dailyStats?.length || 0,
            overallStatsCount: overallAnalyticsData?.getUserAnalytics?.dailyStats?.length || 0,
            // ✅ Debug: Check if dailyStats exists but is empty
            directStatsSample: directAnalyticsData?.dailyStats?.slice(0, 2),
            analyticsStatsSample: analyticsData?.getUserAnalytics?.dailyStats?.slice(0, 2),
            overallStatsSample: overallAnalyticsData?.getUserAnalytics?.dailyStats?.slice(0, 2)
          });
        }
      }
      
      // ✅ Filter dailyStats by date range if custom date range is selected (extra safeguard)
      let filteredDailyStats = dailyStats;
      if (isCustomDateRange && dateRange.start && dateRange.end && dailyStats.length > 0) {
        const startDate = new Date(dateRange.start);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);
        
        filteredDailyStats = dailyStats.filter((day: any) => {
          const dayDate = new Date(day.date);
          return dayDate >= startDate && dayDate <= endDate;
        });
        
        console.log('📊 [DetailedAnalytics] Filtered dailyStats by custom date range:', {
          originalCount: dailyStats.length,
          filteredCount: filteredDailyStats.length,
          dateRange: { start: dateRange.start, end: dateRange.end },
          firstDate: filteredDailyStats[0]?.date,
          lastDate: filteredDailyStats[filteredDailyStats.length - 1]?.date
        });
      }
      
      const mappedStats = filteredDailyStats.map((day: any) => {
        // ✅ Ensure date is in correct format for the graph
        // Server returns date as string "YYYY-MM-DD", convert to ISO string for graph
        let dateValue = day.date;
        if (typeof day.date === 'string' && day.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Date is in YYYY-MM-DD format, convert to Date object then ISO string
          dateValue = new Date(day.date + 'T00:00:00').toISOString();
        }
        
        return {
          date: dateValue,
          adPlays: day.adsPlayed || day.adPlays || 0, // Support both field names
          qrScans: day.qrScans || 0,
          completionRate: day.completionRate || 0
        };
      });
      
      // ✅ Debug: Log the mapped stats to see what we're sending to the graph
      if (mappedStats.length > 0) {
        const totalAdPlays = mappedStats.reduce((sum, day) => sum + day.adPlays, 0);
        const totalQrScans = mappedStats.reduce((sum, day) => sum + day.qrScans, 0);
        
        console.log('📊 [DetailedAnalytics] Mapped dailyStats for graph:', {
          count: mappedStats.length,
          sample: mappedStats.slice(0, 3),
          totalAdPlays: totalAdPlays,
          totalQrScans: totalQrScans,
          dateRange: {
            first: mappedStats[0]?.date,
            last: mappedStats[mappedStats.length - 1]?.date
          }
        });
        
        // ✅ Warn if we have dailyStats but all values are 0, yet summary shows data
        if (totalAdPlays === 0 && totalQrScans === 0 && mappedStats.length > 0) {
          const summaryTotalAds = analyticsSummary.totalAdsPlayed || 0;
          if (summaryTotalAds > 0) {
            console.warn('⚠️ [DetailedAnalytics] DailyStats has dates but all values are 0, yet summary shows', summaryTotalAds, 'ad plays. This suggests a server-side aggregation issue.');
            console.warn('⚠️ [DetailedAnalytics] Raw dailyStats sample:', filteredDailyStats.slice(0, 5));
          }
        }
      }
      
      return mappedStats;
    } else if (selectedDevice !== 'all' && deviceAnalytics?.dailyBreakdown) {
      // ✅ Filter device-specific daily stats by date range if custom date range is selected
      let filteredDeviceDailyStats = deviceAnalytics.dailyBreakdown;
      if (isCustomDateRange && dateRange.start && dateRange.end) {
        const startDate = new Date(dateRange.start);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);
        
        filteredDeviceDailyStats = deviceAnalytics.dailyBreakdown.filter((day: any) => {
          const dayDate = new Date(day.date);
          return dayDate >= startDate && dayDate <= endDate;
        });
        
        console.log('📊 [DetailedAnalytics] Filtered device dailyStats by custom date range:', {
          originalCount: deviceAnalytics.dailyBreakdown.length,
          filteredCount: filteredDeviceDailyStats.length,
          dateRange: { start: dateRange.start, end: dateRange.end }
        });
      }
      
      return filteredDeviceDailyStats.map((day: any) => ({
        date: day.date,
        adPlays: day.totalAdPlays,
        qrScans: day.totalQRScans,
        completionRate: day.adCompletionRate
      }));
    } else {
      return [];
    }
  }, [selectedDevice, deviceAnalytics, directAnalyticsData, analyticsData, overallAnalyticsData, selectedPeriod, selectedAd, isCustomDateRange, dateRange.start, dateRange.end]);

  // Top performing ads with proper QR scan calculation - ALWAYS use overall data regardless of device/date selection
  const topPerformingAds = useMemo(() => {
    // Always use the overall ad performance data (not filtered by device or date)
    // Use overallAnalyticsData.getUserAnalytics.adPerformance which always contains overall data
    const ads = (overallAnalyticsData?.getUserAnalytics?.adPerformance || []);
    
    console.log('📊 [TopPerformingAds] Processing ads:', ads.length);
    console.log('📊 [TopPerformingAds] Sample ad data:', ads[0] ? {
      adId: ads[0].adId,
      adTitle: ads[0].adTitle,
      totalQRScans: ads[0].totalQRScans,
      hasMaterials: !!ads[0].materials,
      materialsCount: ads[0].materials?.length || 0
    } : 'No ads');
    
    // ✅ Trust backend data - backend now always fetches fresh QR scan data
    // The backend's getUserAnalytics already fetches fresh QR scans and populates ad.totalQRScans
    return ads.map((ad: any) => {
      // Use the QR scans directly from backend (already fresh data)
      const qrScans = ad.totalQRScans || 0;
      
      // ✅ Get actual device count from myAdsData (devices assigned to the ad)
      // Find the corresponding ad in myAdsData to get the actual materialId array
      let assignedDevicesCount = ad.totalMaterials || 0; // Fallback to analytics data
      if (myAdsData?.getMyAds && myAdsData.getMyAds.length > 0) {
        const adFromMyAds = myAdsData.getMyAds.find((myAd: any) => {
          // Match by adId (could be string or ObjectId)
          return myAd.id === ad.adId || myAd.id?.toString() === ad.adId?.toString();
        });
        
        if (adFromMyAds && adFromMyAds.materialId && Array.isArray(adFromMyAds.materialId)) {
          // Count actual assigned devices from materialId array
          assignedDevicesCount = adFromMyAds.materialId.length;
          console.log(`📊 [TopPerformingAds] Ad "${ad.adTitle}" has ${assignedDevicesCount} assigned devices (from materialId array)`);
        }
      }
      
      // Debug logging
      if (qrScans > 0) {
        console.log(`✅ [TopPerformingAds] Ad "${ad.adTitle}" (${ad.adId}): ${qrScans} QR scans from backend`);
      }
      
      return {
        ...ad,
        totalQRScans: qrScans, // ✅ Use QR scans directly from backend (fresh data)
        assignedDevicesCount: assignedDevicesCount // Use this instead of totalMaterials for device count
      };
    }).slice(0, 5);
  }, [overallAnalyticsData, myAdsData]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background layer */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat blur-sm brightness-90"
        style={{ backgroundImage: "url('/image/bg.jpg')" }}
      />
      <div className="fixed inset-0 bg-white/40 backdrop-blur-xl" />
      
      {/* Content layer */}
      <div className="relative z-10 min-h-screen pt-14 lg:pl-64 mb-6">
        {/* Mobile Header - Now part of scrollable content */}
        <div className="block lg:hidden pb-4">
          <div className="px-4 py-3 flex items-center gap-2">
            <Link to="/dashboard" className="p-1 rounded-full hover:bg-gray-100 flex items-center justify-center">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-800">Detailed Analytics</h1>
          </div>


          {/* Mobile Filters */}
          <div className="px-4">
            <div className="flex flex-wrap gap-1">
              {/* Date Picker */}
              <div className="relative flex-1 min-w-auto date-picker-container">
                <button
                  onClick={() => {
                    setShowDatePicker(!showDatePicker);
                    setShowDeviceDropdown(false);
                    setShowAdDropdown(false);
                  }}
                  className="flex items-center justify-between w-full text-xs text-gray-700 rounded px-3 py-2 bg-white border border-gray-200 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate">{getDatePlaceholder()}</span>
                  </div>
                  <ChevronDown size={14} className="text-gray-500" />
                </button>

                {/* Mobile Date Picker Dropdown */}
                <AnimatePresence>
                  {showDatePicker && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute z-30 mt-1 w-full rounded shadow-lg bg-white border border-gray-200"
                    >
                      <div className="p-2">
                        {[
                          { period: "1d", label: "Last 24 hours" },
                          { period: "7d", label: "Last 7 days" },
                          { period: "30d", label: "Last 30 days" },
                          { period: "all", label: "All Time" },
                        ].map(({ period, label }) => (
                          <button
                            key={period}
                            onClick={() => {
                              handlePresetPeriodSelect(period as any, label);
                              setShowDatePicker(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm rounded ${
                              !isCustomDateRange && selectedPeriod === period
                                ? "bg-blue-50 text-blue-700"
                                : "text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Ad Dropdown */}
              <div className="relative flex-1 min-w-auto ad-dropdown-container">
                <button
                  onClick={() => {
                    setShowAdDropdown(!showAdDropdown);
                    setShowDatePicker(false);
                    setShowDeviceDropdown(false);
                  }}
                  className="flex items-center justify-between w-full text-xs text-gray-700 rounded px-3 py-2 bg-white border border-gray-200 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate">{selectedAdLabel}</span>
                  </div>
                  <ChevronDown size={14} className="text-gray-500" />
                </button>

                {/* Mobile Ad Dropdown */}
                <AnimatePresence>
                  {showAdDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute z-30 mt-1 w-full rounded shadow-lg bg-white border border-gray-200"
                    >
                      <div className="p-2 max-h-60 overflow-y-auto">
                        <button
                          onClick={() => {
                            setSelectedAd("all");
                            setSelectedAdLabel("All Ads");
                            setShowAdDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm rounded ${
                            selectedAd === "all"
                              ? "bg-blue-50 text-blue-700"
                              : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          All Ads
                        </button>
                        {availableAds.map((ad) => (
                          <button
                            key={ad.id}
                            onClick={() => {
                              setSelectedAd(ad.id);
                              setSelectedAdLabel(ad.title);
                              setShowAdDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm rounded ${
                              selectedAd === ad.id
                                ? "bg-blue-50 text-blue-700"
                                : "text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            {ad.title}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Device Dropdown */}
              <div className="relative flex-1 min-w-auto device-dropdown-container">
                <button
                  onClick={() => {
                    if (selectedAd === 'all') return;
                    setShowDeviceDropdown(!showDeviceDropdown);
                    setShowDatePicker(false);
                    setShowAdDropdown(false);
                  }}
                  disabled={selectedAd === 'all'}
                  className={`flex items-center justify-between w-full text-xs rounded px-3 py-2 bg-white border border-gray-200 shadow-sm ${
                    selectedAd === 'all' 
                      ? 'text-gray-400 cursor-not-allowed opacity-60' 
                      : 'text-gray-700 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate">{selectedDeviceLabel}</span>
                  </div>
                  <ChevronDown size={14} className={`${selectedAd === 'all' ? 'text-gray-400' : 'text-gray-500'}`} />
                </button>

                {/* Mobile Device Dropdown */}
                <AnimatePresence>
                  {showDeviceDropdown && selectedAd !== 'all' && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute z-30 mt-1 w-full rounded shadow-lg bg-white border border-gray-200"
                    >
                      <div className="p-2 max-h-60 overflow-y-auto">
                        <button
                          onClick={() => {
                            setSelectedDevice("all");
                            setSelectedDeviceLabel("All Devices");
                            setShowDeviceDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm rounded ${
                            selectedDevice === "all"
                              ? "bg-blue-50 text-blue-700"
                              : "text-gray-700 hover:bg-gray-50"
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
                            className={`w-full text-left px-3 py-2 text-sm rounded flex items-center justify-between ${
                              selectedDevice === device.materialId
                                ? "bg-blue-50 text-blue-700"
                                : "text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            <span className="truncate">{device.name}</span>
                            <span className={`w-2 h-2 rounded-full ml-2 flex-shrink-0 ${
                              device.isOnline ? "bg-green-500" : "bg-gray-300"
                            }`} />
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              {/* Mobile Refresh Button */}
              <div className="w-full flex justify-end mt-2">
                <button
                  onClick={() => window.location.reload()}
                  className="flex items-center justify-center px-4 py-2 bg-[#3674B5] hover:bg-[#2c5d94] 
                              font-medium text-white text-xs shadow-md rounded transition-colors duration-300"
                >
                  <div className="flex items-center space-x-2">
                    <RefreshCw className="w-4 h-4" />
                    <span>Refresh</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Desktop Header */}
          <div className="hidden lg:block">
            <div className="flex items-center space-x-4 mb-8">
              <Link 
                to="/dashboard" 
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-all duration-200"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="font-medium">Back to Dashboard</span>
              </Link>
            </div>
            
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Detailed Analytics</h1>
                <p className="text-gray-500 mt-1">Track and analyze your ad performance</p>
              </div>

              {/* Desktop Filters */}
              <div className="flex items-center gap-3">
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

                {/* Device Selection */}
                <div className="relative w-full sm:w-40 device-dropdown-container">
                  <button
                    onClick={() => {
                      if (selectedAd === 'all') return;
                      setShowDeviceDropdown(!showDeviceDropdown);
                    }}
                    disabled={selectedAd === 'all'}
                    className={`flex items-center justify-between w-full text-xs rounded-md pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white/70 gap-2 ${
                      selectedAd === 'all' 
                        ? 'text-gray-400 cursor-not-allowed opacity-60' 
                        : 'text-black cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="">{selectedDeviceLabel}</span>
                    </div>
                    <ChevronDown
                      size={16}
                      className={`transform transition-transform duration-200 ${
                        showDeviceDropdown ? "rotate-180" : "rotate-0"
                      } ${selectedAd === 'all' ? 'text-gray-400' : ''}`}
                    />
                  </button>

                  <AnimatePresence>
                    {showDeviceDropdown && selectedAd !== 'all' && (
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
              </div>
            </div>

            {/* Row 2: Refresh Button */}
            <div className="mt-4 flex justify-end mb-4">
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
          {/* Loading State - Only show on initial load */}
          {analyticsLoading && isInitialLoad && (
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
          {!analyticsLoading && !isInitialLoad && (!analyticsData?.getUserAnalytics && !directAnalyticsData) && (
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
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-2 relative z-0">
              {/* Total Ad Plays */}
              <div className="bg-white/50 backdrop-blur-sm p-6 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300">
                <div className="flex justify-between items-start">
                  {/* Left side: Label and Value */}
                  <div>
                    <p className="text-sm text-black/70">Total Ad Plays</p>
                    <div className="text-xl font-semibold text-gray-900 mt-1">
                      {analyticsLoading && isInitialLoad ? (
                        <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
                      ) : (
                        (analyticsSummary.totalAdsPlayed || 0).toLocaleString()
                      )}
                    </div>
                  </div>
                  {/* Right side: Icon */}
                  <div className="p-2 rounded-full bg-gradient-to-br from-yellow-300/60 via-yellow-300/40 to-white/40 border border-white/30 backdrop-blur-md shadow-md">
                    <Youtube className="w-5 h-5 text-yellow-700 drop-shadow-sm" />
                  </div>
                </div>
              </div>

              {/* QR Scans */}
              <div className="bg-white/50 backdrop-blur-sm p-6 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-black/70">QR Scans</p>
                    <div className="text-xl font-semibold text-gray-900 mt-1">
                      {analyticsLoading && isInitialLoad ? (
                        <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
                      ) : (
                        (analyticsSummary.totalQRScans || 0).toLocaleString()
                      )}
                    </div>
                  </div>
                  <div className="p-2 rounded-full bg-gradient-to-br from-blue-300/60 via-blue-300/40 to-white/40 border border-white/30 backdrop-blur-md shadow-md">
                    <QrCode className="w-5 h-5 text-blue-700 drop-shadow-sm" />
                  </div>
                </div>
              </div>

              {/* Active Devices */}
              <div className="bg-white/50 backdrop-blur-sm p-6 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-black/70">Active Devices</p>
                    <div className="text-xl font-semibold text-gray-900 mt-1">
                      {analyticsLoading && isInitialLoad ? (
                        <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
                      ) : (
                        (analyticsSummary.totalMaterials || 0).toLocaleString()
                      )}
                    </div>
                  </div>
                  <div className="p-2 rounded-full bg-gradient-to-br from-orange-300/60 via-orange-300/40 to-white/40 border border-white/30 backdrop-blur-md shadow-md">
                    <MonitorSmartphone className="w-5 h-5 text-orange-700 drop-shadow-sm" />
                  </div>
                </div>
              </div>

              {/* Online Devices */}
              <div className="bg-white/50 backdrop-blur-sm p-6 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-black/70">Online Devices</p>
                    <div className="text-xl font-semibold text-gray-900 mt-1">
                      {analyticsLoading && isInitialLoad ? (
                        <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
                      ) : (
                        // ✅ Use onlineDevicesCount which respects filters
                        // When device is selected: shows 1 if online, 0 if offline
                        // Otherwise: shows count of online devices from filtered data
                        onlineDevicesCount
                      )}
                    </div>
                  </div>
                  <div className="p-2 rounded-full bg-gradient-to-br from-green-300/60 via-green-300/40 to-white/40 border border-white/30 backdrop-blur-md shadow-md">
                    <MonitorSmartphone className="w-5 h-5 text-green-700 drop-shadow-sm" />
                  </div>
                </div>
              </div>

              {/* Completion Rate */}
              <div className="bg-white/50 backdrop-blur-sm p-6 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-black/70">Completion Rate</p>
                    <div className="text-xl font-semibold text-gray-900 mt-1">
                      {analyticsLoading && isInitialLoad ? (
                        <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
                      ) : (
                        `${analyticsSummary.averageCompletionRate.toFixed(1)}%`
                      )}
                    </div>
                  </div>
                  <div className="p-2 rounded-full bg-gradient-to-br from-purple-300/60 via-purple-300/40 to-white/40 border border-white/30 backdrop-blur-md shadow-md">
                    <TrendingUp className="w-5 h-5 text-purple-700 drop-shadow-sm" />
                  </div>
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
                {/* ✅ Loading State */}
                {(analyticsLoading && isInitialLoad) || (directAnalyticsLoading && isInitialLoad) ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <LoaderCircle className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Loading chart data...</p>
                    </div>
                  </div>
                ) : dailyStats.length === 0 ? (
                  /* ✅ Empty State */
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm font-medium text-gray-700 mb-1">No Chart Data Available</p>
                      <p className="text-xs text-gray-500">
                        {isInitialLoad 
                          ? "Loading your analytics data..." 
                          : "No performance data found for the selected period. Data will appear once your ads start playing."}
                      </p>
                    </div>
                  </div>
                ) : (
                  /* ✅ Chart with Data */
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
                        formatter={(value, name) => {
                          // ⚠️ TEMPORARY FIX: Subtract 1 from adPlays to match database values
                          // TODO: Fix root cause in backend aggregation
                          const adjustedValue = name === 'adPlays' ? Math.max(0, (value || 0) - 1) : (value || 0);
                          return [adjustedValue.toLocaleString(), name === 'adPlays' ? 'Ad Plays' : 'QR Scans'];
                        }}
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
                )}
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
                            {selectedDevice !== 'all' ? (ad.totalPlays || 0).toLocaleString() : (ad.assignedDevicesCount || ad.totalMaterials || 0).toLocaleString()}
                          </p>
                          <p className="text-xs text-black/50 font-medium leading-none mt-0.5">
                            {selectedDevice !== 'all' ? 'Plays' : 'Devices'}
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