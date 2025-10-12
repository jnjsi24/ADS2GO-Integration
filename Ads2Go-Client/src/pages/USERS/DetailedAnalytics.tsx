import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
  ComposedChart
} from 'recharts';
import { useQuery } from '@apollo/client';
import { GET_USER_ANALYTICS } from '../../graphql/user/queries/getUserAnalytics';
import { ArrowLeft, Download, RefreshCw, TrendingUp, Eye, Play, Clock, Target, Users, MapPin, Calendar, BarChart3, Monitor, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUserAuth } from '../../contexts/UserAuthContext';

const DetailedAnalytics: React.FC = () => {
  const { user } = useUserAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<'1d' | '7d' | '30d'>('7d');
  const [selectedMetric, setSelectedMetric] = useState<'impressions' | 'plays' | 'completion' | 'qr' | 'revenue'>('impressions');
  const [selectedView, setSelectedView] = useState<'overview' | 'performance' | 'impressions' | 'display' | 'qr' | 'tablets' | 'ads'>('overview');
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

  // Fetch analytics data with optimized cache policy
  const { data: analyticsData, loading: analyticsLoading, error: analyticsError, refetch: refetchAnalytics } = useQuery(GET_USER_ANALYTICS, {
    variables: { 
      period: selectedDevice === 'all' ? 'all' : selectedPeriod 
    },
    // pollInterval: 5000, // Temporarily disabled to prevent repeated errors
    fetchPolicy: 'cache-first', // Use cache first for better performance
    nextFetchPolicy: 'cache-and-network', // Then update from network
    errorPolicy: 'all', // Allow partial data even with errors
    onError: (error) => {
      // Don't log "User analytics not found" as an error - it's expected for new users
      if (error.message !== 'Failed to fetch analytics data') {
        console.error('Unexpected analytics error:', error);
      }
    }
  });

  // Get user's first name from UserAuthContext
  useEffect(() => {
    if (user?.firstName) {
      setUserFirstName(user.firstName);
      console.log('✅ DetailedAnalytics: User first name from context:', user.firstName);
    } else {
      console.log('⚠️ DetailedAnalytics: No user firstName found in context');
    }
  }, [user]);

  // Memoized device extraction from analytics data
  const extractedDevices = useMemo(() => {
    // First try to get devices from direct API data (for "All Devices" view)
    if (directAnalyticsData?.deviceStats && directAnalyticsData.deviceStats.length > 0) {
      const devices = directAnalyticsData.deviceStats.map((device: any, index: number) => ({
        id: device.deviceId || `device-${index}`,
        name: device.materialId || `Device ${index + 1}`,
        materialId: device.materialId || `device-${index}`
      }));
      console.log('📱 Devices loaded from direct API data:', devices);
      return devices;
    }
    // Then try GraphQL data as fallback
    else if (analyticsData?.getUserAnalytics?.deviceStats && analyticsData.getUserAnalytics.deviceStats.length > 0) {
      const devices = analyticsData.getUserAnalytics.deviceStats.map((device: any, index: number) => ({
        id: device.deviceId || `device-${index}`,
        name: device.materialId || `Device ${index + 1}`,
        materialId: device.materialId || `device-${index}`
      }));
      console.log('📱 Devices loaded from GraphQL data:', devices);
      return devices;
    } else {
      // Try to get devices from adPerformance materials as fallback
      if (analyticsData?.getUserAnalytics?.adPerformance) {
        const materials = new Set();
        analyticsData.getUserAnalytics.adPerformance.forEach((ad: any) => {
          if (ad.materials && ad.materials.length > 0) {
            ad.materials.forEach((material: any) => {
              if (material.materialId) {
                materials.add(material.materialId);
              }
            });
          }
        });
        
        if (materials.size > 0) {
          const devices = Array.from(materials).map((materialId: any, index: number) => ({
            id: materialId,
            name: materialId,
            materialId: materialId
          }));
          console.log('📱 Devices loaded from adPerformance materials:', devices);
          return devices;
        }
      }
    }
    return [];
  }, [analyticsData, directAnalyticsData]);

  // Update available devices when extraction changes
  useEffect(() => {
    if (extractedDevices.length > 0) {
      setAvailableDevices(extractedDevices);
    }
  }, [extractedDevices]);

  // Fetch device-specific analytics with debouncing and useCallback
  const fetchDeviceAnalytics = useCallback(async (deviceId: string) => {
    console.log('🔍 fetchDeviceAnalytics called with deviceId:', deviceId);
    
    // Clear any pending fetch
    if (deviceFetchTimeoutRef.current) {
      clearTimeout(deviceFetchTimeoutRef.current);
    }
    
    if (deviceId === 'all' || !user?.userId) {
      console.log('❌ Skipping fetch - deviceId is "all" or no user ID');
      setDeviceAnalytics(null);
      setDeviceLoading(false);
      return;
    }

    // Debounce the fetch
    deviceFetchTimeoutRef.current = setTimeout(async () => {
      try {
        setDeviceLoading(true);
        const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace('/graphql', '').replace(/\/$/, '');
        const url = `${baseUrl}/analytics/user/${user.userId}/device/${deviceId}`;
        console.log('🌐 Fetching from URL:', url);
        
        const response = await fetch(url);
        const data = await response.json();
        
        console.log('📊 API Response:', data);
        
        if (data.success) {
          console.log('✅ Device analytics fetched successfully:', data.data.deviceAnalytics);
          setDeviceAnalytics(data.data.deviceAnalytics);
        } else {
          console.error('❌ Failed to fetch device analytics:', data.message);
          setDeviceAnalytics(null);
        }
      } catch (error) {
        console.error('❌ Error fetching device analytics:', error);
        setDeviceAnalytics(null);
      } finally {
        setDeviceLoading(false);
      }
    }, 300); // 300ms debounce
  }, [user?.userId]);

  // Handle device selection change
  const handleDeviceChange = (deviceId: string) => {
    console.log('🔄 handleDeviceChange called with deviceId:', deviceId);
    setSelectedDevice(deviceId);
    fetchDeviceAnalytics(deviceId);
  };

  // Fetch direct analytics data when "All Devices" is selected with debouncing and useCallback
  const fetchDirectAnalytics = useCallback(async () => {
    if (selectedDevice !== 'all' || !user?.userId) return;
    
    // Clear any pending fetch
    if (directFetchTimeoutRef.current) {
      clearTimeout(directFetchTimeoutRef.current);
    }
    
    // Debounce the fetch
    directFetchTimeoutRef.current = setTimeout(async () => {
      try {
        setDirectAnalyticsLoading(true);
        const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace('/graphql', '').replace(/\/$/, '');
        const currentPeriod = selectedDevice === 'all' ? 'all' : selectedPeriod;
        const url = `${baseUrl}/analytics/user/${user.userId}/direct?period=${currentPeriod}`;
        
        console.log('🔍 Fetching direct analytics from:', url);
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
          console.log('✅ Direct analytics fetched successfully:', data.data.summary);
          setDirectAnalyticsData(data.data);
        } else {
          console.error('❌ Failed to fetch direct analytics:', data.message);
          setDirectAnalyticsData(null);
        }
      } catch (error) {
        console.error('❌ Error fetching direct analytics:', error);
        setDirectAnalyticsData(null);
      } finally {
        setDirectAnalyticsLoading(false);
      }
    }, 300); // 300ms debounce
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

  // Get analytics summary data - Updated for UserAnalytics system with memoization
  // For "All Devices": Use ONLY direct API data from UserAnalytics collection
  // For individual device: Use device-specific analytics data
  const analyticsSummary = useMemo(() => {
    if (selectedDevice === 'all') {
      // For "All Devices" - use ONLY UserAnalytics data from direct API call
      return directAnalyticsData?.summary || {
        totalAdImpressions: 0,
        totalAdsPlayed: 0,
        totalDisplayTime: 0,
        averageCompletionRate: 0,
        totalAds: 0,
        activeAds: 0,
        totalMaterials: 0,
        totalDevices: 0,
        totalQRScans: 0,
        qrScanConversionRate: 0
      };
    } else if (selectedDevice !== 'all' && deviceAnalytics) {
      // For individual device - use device-specific data
      return {
        totalAdImpressions: deviceAnalytics.totals?.totalAdImpressions || 0,
        totalAdsPlayed: deviceAnalytics.totals?.totalAdPlays || 0,
        totalDisplayTime: deviceAnalytics.totals?.totalAdPlayTime || 0,
        averageCompletionRate: deviceAnalytics.averages?.averageCompletionRate || 0,
        totalAds: deviceAnalytics.adPerformance?.length || 0,
        activeAds: deviceAnalytics.adPerformance?.length || 0,
        totalMaterials: 1, // Single device
        totalDevices: 1, // Single device
        totalQRScans: deviceAnalytics.totals?.totalQRScans || 0,
        qrScanConversionRate: deviceAnalytics.performance?.qrScanConversionRate || 0
      };
    } else {
      // Fallback for loading states
      return {
        totalAdImpressions: 0,
        totalAdsPlayed: 0,
        totalDisplayTime: 0,
        averageCompletionRate: 0,
        totalAds: 0,
        activeAds: 0,
        totalMaterials: 0,
        totalDevices: 0,
        totalQRScans: 0,
        qrScanConversionRate: 0
      };
    }
  }, [selectedDevice, directAnalyticsData, deviceAnalytics]);

  console.log('📊 Current analyticsSummary:', analyticsSummary);
  console.log('📱 Selected device:', selectedDevice);
  console.log('📊 Device analytics:', deviceAnalytics);
  console.log('🔍 Raw analyticsData from GraphQL:', analyticsData);
  console.log('🔍 getUserAnalytics summary:', analyticsData?.getUserAnalytics?.summary);
  console.log('🔍 Direct analytics data:', directAnalyticsData);
  console.log('🔍 Direct analytics summary:', directAnalyticsData?.summary);
  
  // Clear data source logging
  if (selectedDevice === 'all') {
    console.log('🔍 Data source: ALL DEVICES - UserAnalytics collection ONLY (no device tracking queries)');
    console.log('🔍 Metrics from: UserAnalytics.totalAdImpressions, UserAnalytics.totalAdPlays, etc.');
  } else {
    console.log('🔍 Data source: DEVICE SPECIFIC - DeviceDataHistoryV2 (device tracking database)');
    console.log('🔍 Metrics from: DeviceDataHistoryV2.dailyData aggregation for selected device');
  }

  // Format display time with useCallback
  const formatDisplayTime = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }, []);

  // Mock data for demonstration (replace with real data)
  const devicePerformanceData = [
    { name: 'Device 1', impressions: 1200, plays: 800, completion: 85, revenue: 240 },
    { name: 'Device 2', impressions: 950, plays: 650, completion: 78, revenue: 195 },
    { name: 'Device 3', impressions: 1100, plays: 720, completion: 82, revenue: 216 },
    { name: 'Device 4', impressions: 800, plays: 550, completion: 75, revenue: 165 },
    { name: 'Device 5', impressions: 1300, plays: 900, completion: 88, revenue: 270 },
  ];

  const hourlyData = [
    { hour: '00:00', impressions: 45, plays: 30, completion: 67 },
    { hour: '01:00', impressions: 32, plays: 22, completion: 69 },
    { hour: '02:00', impressions: 28, plays: 18, completion: 64 },
    { hour: '03:00', impressions: 25, plays: 15, completion: 60 },
    { hour: '04:00', impressions: 35, plays: 25, completion: 71 },
    { hour: '05:00', impressions: 55, plays: 40, completion: 73 },
    { hour: '06:00', impressions: 120, plays: 85, completion: 71 },
    { hour: '07:00', impressions: 180, plays: 130, completion: 72 },
    { hour: '08:00', impressions: 220, plays: 160, completion: 73 },
    { hour: '09:00', impressions: 250, plays: 180, completion: 72 },
    { hour: '10:00', impressions: 280, plays: 200, completion: 71 },
    { hour: '11:00', impressions: 300, plays: 220, completion: 73 },
    { hour: '12:00', impressions: 320, plays: 240, completion: 75 },
    { hour: '13:00', impressions: 310, plays: 230, completion: 74 },
    { hour: '14:00', impressions: 290, plays: 210, completion: 72 },
    { hour: '15:00', impressions: 270, plays: 190, completion: 70 },
    { hour: '16:00', impressions: 260, plays: 180, completion: 69 },
    { hour: '17:00', impressions: 240, plays: 170, completion: 71 },
    { hour: '18:00', impressions: 200, plays: 140, completion: 70 },
    { hour: '19:00', impressions: 180, plays: 125, completion: 69 },
    { hour: '20:00', impressions: 160, plays: 110, completion: 69 },
    { hour: '21:00', impressions: 140, plays: 95, completion: 68 },
    { hour: '22:00', impressions: 120, plays: 80, completion: 67 },
    { hour: '23:00', impressions: 90, plays: 60, completion: 67 },
  ];

  const locationData = [
    { name: 'Downtown', impressions: 1200, percentage: 35, revenue: 360 },
    { name: 'Mall Area', impressions: 950, percentage: 28, revenue: 285 },
    { name: 'Highway', impressions: 800, percentage: 23, revenue: 240 },
    { name: 'Residential', impressions: 450, percentage: 14, revenue: 135 },
  ];

  const qrImpressionsData = [
    { name: '12am-8am', value: 55, impressions: 1870 },
    { name: '8am-4pm', value: 25, impressions: 850 },
    { name: '4pm-12am', value: 20, impressions: 680 },
  ];

  const weeklyData = [
    { day: 'Mon', impressions: 1200, plays: 800, completion: 67, revenue: 240 },
    { day: 'Tue', impressions: 1350, plays: 900, completion: 67, revenue: 270 },
    { day: 'Wed', impressions: 1100, plays: 750, completion: 68, revenue: 225 },
    { day: 'Thu', impressions: 1400, plays: 950, completion: 68, revenue: 285 },
    { day: 'Fri', impressions: 1600, plays: 1100, completion: 69, revenue: 330 },
    { day: 'Sat', impressions: 1800, plays: 1250, completion: 69, revenue: 375 },
    { day: 'Sun', impressions: 1500, plays: 1000, completion: 67, revenue: 300 },
  ];

  // Tablet Activity Data
  const tabletActivityData = [
    { 
      id: 'TAB001', 
      name: 'Tablet Downtown Mall', 
      location: 'Downtown Mall, Floor 1', 
      status: 'Online', 
      lastSeen: '2 minutes ago',
      impressions: 1250, 
      plays: 890, 
      completion: 85,
      uptime: '99.2%',
      battery: 87,
      temperature: 'Normal'
    },
    { 
      id: 'TAB002', 
      name: 'Tablet Highway Station', 
      location: 'Highway Bus Station', 
      status: 'Online', 
      lastSeen: '5 minutes ago',
      impressions: 980, 
      plays: 720, 
      completion: 78,
      uptime: '98.7%',
      battery: 92,
      temperature: 'Normal'
    },
    { 
      id: 'TAB003', 
      name: 'Tablet Shopping Center', 
      location: 'City Shopping Center', 
      status: 'Offline', 
      lastSeen: '2 hours ago',
      impressions: 0, 
      plays: 0, 
      completion: 0,
      uptime: '95.1%',
      battery: 15,
      temperature: 'High'
    },
    { 
      id: 'TAB004', 
      name: 'Tablet Airport Terminal', 
      location: 'International Airport, Terminal 2', 
      status: 'Online', 
      lastSeen: '1 minute ago',
      impressions: 2100, 
      plays: 1500, 
      completion: 88,
      uptime: '99.8%',
      battery: 95,
      temperature: 'Normal'
    },
    { 
      id: 'TAB005', 
      name: 'Tablet University Campus', 
      location: 'State University, Main Hall', 
      status: 'Online', 
      lastSeen: '3 minutes ago',
      impressions: 1650, 
      plays: 1200, 
      completion: 82,
      uptime: '97.3%',
      battery: 78,
      temperature: 'Normal'
    },
  ];

  // Detailed Ads Analytics Data
  const detailedAdsData = [
    {
      id: 'AD001',
      title: 'Summer Sale - Electronics Store',
      status: 'Running',
      impressions: 5420,
      plays: 3890,
      completionRate: 78.5,
      clickThroughRate: 12.3,
      revenue: 1250,
      startDate: '2024-01-15',
      endDate: '2024-02-15',
      duration: '30 days',
      targetAudience: '18-45 years',
      locations: ['Downtown Mall', 'Shopping Center'],
      devices: ['TAB001', 'TAB004'],
      performance: 'Excellent'
    },
    {
      id: 'AD002',
      title: 'New Restaurant Opening',
      status: 'Running',
      impressions: 3200,
      plays: 2400,
      completionRate: 65.2,
      clickThroughRate: 8.7,
      revenue: 890,
      startDate: '2024-01-20',
      endDate: '2024-02-20',
      duration: '30 days',
      targetAudience: '25-55 years',
      locations: ['Highway Station', 'Airport Terminal'],
      devices: ['TAB002', 'TAB004'],
      performance: 'Good'
    },
    {
      id: 'AD003',
      title: 'Fitness Center Membership',
      status: 'Paused',
      impressions: 1800,
      plays: 1200,
      completionRate: 58.9,
      clickThroughRate: 6.2,
      revenue: 450,
      startDate: '2024-01-10',
      endDate: '2024-01-25',
      duration: '15 days',
      targetAudience: '20-40 years',
      locations: ['University Campus'],
      devices: ['TAB005'],
      performance: 'Average'
    },
    {
      id: 'AD004',
      title: 'Car Dealership Promotion',
      status: 'Completed',
      impressions: 4500,
      plays: 3200,
      completionRate: 82.1,
      clickThroughRate: 15.8,
      revenue: 2100,
      startDate: '2023-12-01',
      endDate: '2023-12-31',
      duration: '30 days',
      targetAudience: '30-60 years',
      locations: ['Downtown Mall', 'Highway Station'],
      devices: ['TAB001', 'TAB002'],
      performance: 'Excellent'
    },
    {
      id: 'AD005',
      title: 'Tech Startup Launch',
      status: 'Running',
      impressions: 2800,
      plays: 1900,
      completionRate: 71.3,
      clickThroughRate: 9.5,
      revenue: 680,
      startDate: '2024-01-25',
      endDate: '2024-02-25',
      duration: '30 days',
      targetAudience: '22-35 years',
      locations: ['University Campus', 'Shopping Center'],
      devices: ['TAB005'],
      performance: 'Good'
    }
  ];

  const colors = ['#1b5087', '#3674B5', '#E78B48', '#FFAB5B', '#D4C9BE', '#EFEEEA'];

  const handlePeriodChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPeriod = e.target.value as '1d' | '7d' | '30d';
    setSelectedPeriod(newPeriod);
  }, []);

  // Refetch analytics when period or device selection changes with debouncing
  useEffect(() => {
    // Clear any pending refetch
    if (refetchTimeoutRef.current) {
      clearTimeout(refetchTimeoutRef.current);
    }

    const currentPeriod = selectedDevice === 'all' ? 'all' : selectedPeriod;
    if (currentPeriod) {
      console.log('🔄 Period changed to:', currentPeriod, '- Scheduling refetch...');
      
      // Debounce the refetch
      refetchTimeoutRef.current = setTimeout(() => {
        console.log('🔄 Executing refetch for period:', currentPeriod);
        refetchAnalytics({ period: currentPeriod });
      }, 500); // 500ms debounce for refetch
    }

    // Cleanup on unmount
    return () => {
      if (refetchTimeoutRef.current) {
        clearTimeout(refetchTimeoutRef.current);
      }
    };
  }, [selectedPeriod, selectedDevice, refetchAnalytics]);

  const handleRefresh = useCallback(() => {
    refetchAnalytics();
  }, [refetchAnalytics]);

  const exportData = useCallback(() => {
    // Implement data export functionality
    console.log('Exporting analytics data...');
  }, []);

  // Memoized chart data transformations for performance
  const performanceChartData = useMemo(() => {
    if (selectedDevice === 'all') {
      // For "All Devices" - use only UserAnalytics data, no daily breakdown available
      return [];
    } else if (selectedDevice !== 'all' && deviceAnalytics?.dailyBreakdown) {
      return deviceAnalytics.dailyBreakdown.map((day: any) => ({
        date: day.date,
        impressions: day.totalAdImpressions,
        adsPlayed: day.totalAdPlays,
        qrScans: day.totalQRScans,
        completionRate: day.adCompletionRate,
        revenue: 0 // Device-specific data doesn't include revenue
      }));
    } else {
      return analyticsData?.getUserAnalytics?.dailyStats || weeklyData;
    }
  }, [selectedDevice, deviceAnalytics, analyticsData]);

  const qrScansChartData = useMemo(() => {
    if (selectedDevice === 'all') {
      // For "All Devices" - use only UserAnalytics data, no daily breakdown available
      return [];
    } else if (selectedDevice !== 'all' && deviceAnalytics?.dailyBreakdown) {
      return deviceAnalytics.dailyBreakdown.map((day: any) => ({
        date: day.date,
        qrScans: day.totalQRScans
      }));
    } else {
      return analyticsData?.getUserAnalytics?.dailyStats || [];
    }
  }, [selectedDevice, deviceAnalytics, analyticsData]);

  const qrPerformanceByAd = useMemo(() => {
    if (selectedDevice === 'all') {
      // For "All Devices" - use only UserAnalytics data from direct API
      return directAnalyticsData?.adPerformance?.slice(0, 5) || [];
    } else if (selectedDevice !== 'all' && deviceAnalytics?.qrScanBreakdown) {
      return deviceAnalytics.qrScanBreakdown.slice(0, 5);
    } else {
      return analyticsData?.getUserAnalytics?.adPerformance?.slice(0, 5) || [];
    }
  }, [selectedDevice, directAnalyticsData, deviceAnalytics, analyticsData]);

  const adPerformanceChartData = useMemo(() => {
    if (selectedDevice === 'all') {
      // For "All Devices" - use only UserAnalytics data from direct API
      return (directAnalyticsData?.adPerformance || []).map((ad: any) => ({
        adTitle: ad.adTitle,
        totalAdImpressions: ad.totalAdImpressions,
        totalAdPlayTime: ad.totalAdPlayTime,
        totalQRScans: ad.totalQRScans
      }));
    } else if (selectedDevice !== 'all' && deviceAnalytics?.adPerformance) {
      return deviceAnalytics.adPerformance.map((ad: any) => ({
        adTitle: ad.adTitle,
        totalAdImpressions: ad.totalImpressions,
        totalAdPlayTime: ad.totalViewTime,
        totalQRScans: deviceAnalytics.qrScanBreakdown?.find((qr: any) => qr.adId === ad.adId)?.totalScans || 0
      }));
    } else {
      return analyticsData?.getUserAnalytics?.adPerformance || [];
    }
  }, [selectedDevice, directAnalyticsData, deviceAnalytics, analyticsData]);

  const topPerformingAds = useMemo(() => {
    if (selectedDevice === 'all') {
      return (directAnalyticsData?.adPerformance || analyticsData?.getUserAnalytics?.adPerformance || []).slice(0, 5);
    } else if (deviceAnalytics?.adPerformance) {
      return deviceAnalytics.adPerformance.slice(0, 5);
    }
    return [];
  }, [selectedDevice, directAnalyticsData, analyticsData, deviceAnalytics]);

  const renderOverviewSection = () => (
    <div className="space-y-6">
      {/* Key Metrics Overview - Updated for UserAnalytics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Plays</p>
              <p className="text-3xl font-bold text-gray-900">
                {analyticsLoading ? '...' : analyticsSummary.totalAdsPlayed.toLocaleString()}
              </p>
              <p className="text-sm text-green-600 flex items-center mt-1">
                <TrendingUp className="w-4 h-4 mr-1" />
                From history
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <Play className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">QR Scans</p>
              <p className="text-3xl font-bold text-gray-900">
                {analyticsLoading ? '...' : analyticsSummary.totalQRScans.toLocaleString()}
              </p>
              <p className="text-sm text-green-600 flex items-center mt-1">
                <TrendingUp className="w-4 h-4 mr-1" />
                {analyticsSummary.qrScanConversionRate.toFixed(1)}% conversion
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <Target className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Materials</p>
              <p className="text-3xl font-bold text-gray-900">
                {analyticsLoading ? '...' : analyticsSummary.totalMaterials.toLocaleString()}
              </p>
              <p className="text-sm text-green-600 flex items-center mt-1">
                <TrendingUp className="w-4 h-4 mr-1" />
                Active devices
              </p>
            </div>
            <div className="p-3 bg-orange-100 rounded-full">
              <Users className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Completion Rate</p>
              <p className="text-3xl font-bold text-gray-900">
                {analyticsLoading ? '...' : analyticsSummary.averageCompletionRate.toFixed(1)}%
              </p>
              <p className="text-sm text-green-600 flex items-center mt-1">
                <TrendingUp className="w-4 h-4 mr-1" />
                Average
              </p>
            </div>
            <div className="p-3 bg-indigo-100 rounded-full">
              <Target className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Display Time</p>
              <p className="text-3xl font-bold text-gray-900">
                {analyticsLoading ? '...' : formatDisplayTime(analyticsSummary.totalDisplayTime)}
              </p>
              <p className="text-sm text-green-600 flex items-center mt-1">
                <TrendingUp className="w-4 h-4 mr-1" />
                Total hours
              </p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Performance Over Time */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Performance Over Time</h3>
          <select
            className="text-sm text-gray-600 bg-white rounded-lg px-3 py-1 border border-gray-200 focus:outline-none"
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value as 'impressions' | 'plays' | 'completion' | 'qr' | 'revenue')}
          >
            <option value="impressions">Impressions</option>
            <option value="plays">Plays</option>
            <option value="completion">Completion Rate</option>
            <option value="qr">QR Scans</option>
            <option value="revenue">Revenue</option>
          </select>
        </div>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={performanceChartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip 
              labelFormatter={(value) => new Date(value).toLocaleDateString()}
              formatter={(value, name) => [
                name === 'impressions' ? value.toLocaleString() : 
                name === 'adsPlayed' ? value.toLocaleString() : 
                name === 'qrScans' ? value.toLocaleString() :
                name === 'revenue' ? `$${value}` :
                `${value}%`,
                name === 'impressions' ? 'Impressions' :
                name === 'adsPlayed' ? 'Plays' : 
                name === 'qrScans' ? 'QR Scans' :
                name === 'revenue' ? 'Revenue' : 'Completion Rate'
              ]}
            />
            <Bar dataKey={selectedMetric === 'impressions' ? 'impressions' : selectedMetric === 'plays' ? 'adsPlayed' : selectedMetric === 'qr' ? 'qrScans' : selectedMetric === 'revenue' ? 'revenue' : 'completionRate'} fill="#1b5087" />
            <Line type="monotone" dataKey={selectedMetric === 'impressions' ? 'impressions' : selectedMetric === 'plays' ? 'adsPlayed' : selectedMetric === 'qr' ? 'qrScans' : selectedMetric === 'revenue' ? 'revenue' : 'completionRate'} stroke="#3674B5" strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderImpressionsSection = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Impressions Analysis</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 className="text-md font-medium text-gray-700 mb-3">Hourly Impressions (Today)</h4>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="impressions" stroke="#1b5087" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h4 className="text-md font-medium text-gray-700 mb-3">Location Distribution</h4>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={locationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="impressions"
                  label={({ name, percentage }) => `${name}: ${percentage}%`}
                >
                  {locationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [value.toLocaleString(), 'Impressions']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDisplayTimeSection = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Display Time Analysis</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 className="text-md font-medium text-gray-700 mb-3">Daily Display Time</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => [formatDisplayTime(Number(value)), 'Display Time']} />
                <Bar dataKey="completion" fill="#1b5087" name="Display Time (hours)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h4 className="text-md font-medium text-gray-700 mb-3">Device Performance</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={devicePerformanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="completion" fill="#3674B5" name="Completion Rate %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );

  const renderQRSection = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">QR Scans Analysis - Real Data from UserAnalytics</h3>
        
        {/* QR Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600">Total QR Scans</p>
                <p className="text-2xl font-bold text-blue-700">
                  {analyticsLoading ? '...' : analyticsSummary.totalQRScans.toLocaleString()}
                </p>
              </div>
              <div className="text-blue-500">📱</div>
            </div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600">Conversion Rate</p>
                <p className="text-2xl font-bold text-green-700">
                  {analyticsLoading ? '...' : analyticsSummary.qrScanConversionRate.toFixed(1)}%
                </p>
              </div>
              <div className="text-green-500">🎯</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 className="text-md font-medium text-gray-700 mb-3">QR Scans Over Time</h4>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={qrScansChartData}>
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(value, name) => [value.toLocaleString(), 'QR Scans']}
                  labelFormatter={(label) => new Date(label).toLocaleDateString()}
                />
                <Line 
                  type="monotone"
                  dataKey="qrScans" 
                  stroke="#0E2A47"
                  strokeWidth={3}
                  dot={{ fill: '#0E2A47', strokeWidth: 2, r: 6 }}
                  activeDot={{ r: 8, stroke: '#0E2A47', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h4 className="text-md font-medium text-gray-700 mb-3">QR Performance by Ad</h4>
            <div className="space-y-4">
              {qrPerformanceByAd.map((ad: any, index: number) => (
                <div key={ad.adId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: colors[index % colors.length] }}
                    ></div>
                    <span className="font-medium text-gray-800">{ad.adTitle}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      {selectedDevice !== 'all' ? ad.totalScans.toLocaleString() : ad.totalQRScans.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-500">
                      {selectedDevice !== 'all' ? 
                        (ad.totalScans > 0 ? 'Device-specific' : '0%') : 
                        ad.qrScanConversionRate.toFixed(1)}% conversion
                    </p>
                  </div>
                </div>
              )) || (
                <div className="text-center text-gray-500 py-8">
                  <p>No QR scan data available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTabletActivitySection = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Device Activity Overview - Real Data from UserAnalytics</h3>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600">Total Materials</p>
                <p className="text-2xl font-bold text-green-700">
                  {analyticsLoading ? '...' : analyticsSummary.totalMaterials.toLocaleString()}
                </p>
              </div>
              <div className="text-green-500">📱</div>
            </div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600">Total Devices</p>
                <p className="text-2xl font-bold text-blue-700">
                  {analyticsLoading ? '...' : analyticsSummary.totalDevices.toLocaleString()}
                </p>
              </div>
              <div className="text-blue-500">💻</div>
            </div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600">Avg. Completion</p>
                <p className="text-2xl font-bold text-orange-700">
                  {analyticsLoading ? '...' : analyticsSummary.averageCompletionRate.toFixed(1)}%
                </p>
              </div>
              <div className="text-orange-500">🎯</div>
            </div>
          </div>
        </div>

        {/* Device Activity Table - Real Data from UserAnalytics */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Material ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Activity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Impressions</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plays</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">QR Scans</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Display Time</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {selectedDevice === 'all' ? (
                // For "All Devices" - use only UserAnalytics data from direct API
                directAnalyticsData?.deviceStats?.length > 0 ? 
                directAnalyticsData.deviceStats.map((device: any, index: number) => (
                  <tr key={device.deviceId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-700">📱</span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{device.materialId}</div>
                          <div className="text-sm text-gray-500">Device {index + 1}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        device.isOnline 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {device.isOnline ? 'Online' : 'Offline'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {device.lastActivity ? new Date(device.lastActivity).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{device.impressions.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{device.adsPlayed.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{device.qrScans.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDisplayTime(device.displayTime)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      <p>No device data available from UserAnalytics</p>
                      <p className="text-sm mt-1">Data will appear here once devices start reporting</p>
                    </td>
                  </tr>
                )
              ) : (
                // For individual device - use GraphQL data
                analyticsData?.getUserAnalytics?.deviceStats?.length > 0 ? 
                analyticsData.getUserAnalytics.deviceStats.map((device: any, index: number) => (
                  <tr key={device.deviceId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-700">📱</span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{device.materialId}</div>
                          <div className="text-sm text-gray-500">Device {index + 1}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        device.isOnline 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {device.isOnline ? 'Online' : 'Offline'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {device.lastActivity ? new Date(device.lastActivity).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{device.impressions.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{device.adsPlayed.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{device.qrScans.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDisplayTime(device.displayTime)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      <p>No device data available</p>
                      <p className="text-sm mt-1">Data will appear here once devices start reporting</p>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderDetailedAdsSection = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Detailed Ads Analytics - Real Data from UserAnalytics</h3>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600">Total Ads</p>
                <p className="text-2xl font-bold text-blue-700">
                  {analyticsLoading ? '...' : analyticsSummary.totalAds}
                </p>
              </div>
              <div className="text-blue-500">📺</div>
            </div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600">Active Ads</p>
                <p className="text-2xl font-bold text-green-700">
                  {analyticsLoading ? '...' : analyticsSummary.activeAds}
                </p>
              </div>
              <div className="text-green-500">▶️</div>
            </div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600">QR Conversion</p>
                <p className="text-2xl font-bold text-orange-700">
                  {analyticsLoading ? '...' : analyticsSummary.qrScanConversionRate.toFixed(1)}%
                </p>
              </div>
              <div className="text-orange-500">🎯</div>
            </div>
          </div>
        </div>

        {/* Detailed Ads Table - Real Data from UserAnalytics */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ad Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Materials</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Impressions</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Play Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">QR Scans</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completion</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">QR Conversion</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Updated</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(selectedDevice === 'all' ? 
                // For "All Devices" - use only UserAnalytics data from direct API
                directAnalyticsData?.adPerformance :
                selectedDevice !== 'all' && deviceAnalytics?.adPerformance ? 
                deviceAnalytics.adPerformance : 
                analyticsData?.getUserAnalytics?.adPerformance
              )?.map((ad: any) => (
                <tr key={ad.adId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{ad.adTitle}</div>
                      <div className="text-sm text-gray-500">ID: {ad.adId}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {selectedDevice !== 'all' ? '1' : ad.totalMaterials}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {selectedDevice !== 'all' ? ad.totalImpressions.toLocaleString() : ad.totalAdImpressions.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {selectedDevice !== 'all' ? formatDisplayTime(ad.totalViewTime) : formatDisplayTime(ad.totalAdPlayTime)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {selectedDevice !== 'all' ? 
                      (deviceAnalytics?.qrScanBreakdown?.find((qr: any) => qr.adId === ad.adId)?.totalScans || 0).toLocaleString() : 
                      ad.totalQRScans.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {selectedDevice !== 'all' ? ad.averageCompletionRate.toFixed(1) : ad.averageAdCompletionRate.toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {selectedDevice !== 'all' ? 
                      (deviceAnalytics?.qrScanBreakdown?.find((qr: any) => qr.adId === ad.adId)?.totalScans > 0 ? 'Device-specific' : '0.0') : 
                      ad.qrScanConversionRate.toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {selectedDevice !== 'all' ? 
                      (ad.lastPlayed ? new Date(ad.lastPlayed).toLocaleDateString() : 'N/A') : 
                      (ad.lastUpdated ? new Date(ad.lastUpdated).toLocaleDateString() : 'N/A')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button className="text-blue-600 hover:text-blue-900 mr-3">View</button>
                    <button className="text-green-600 hover:text-green-900">Edit</button>
                  </td>
                </tr>
              )) || (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                    <p>No ad performance data available</p>
                    <p className="text-sm mt-1">Data will appear here once ads start running</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Ad Performance Chart - Real Data from UserAnalytics */}
        <div className="mt-8">
          <h4 className="text-md font-medium text-gray-700 mb-4">Ad Performance Comparison</h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={adPerformanceChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="adTitle" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={100} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                formatter={(value, name) => [
                  name === 'totalAdImpressions' ? value.toLocaleString() : 
                  name === 'totalAdPlayTime' ? formatDisplayTime(Number(value)) :
                  value.toLocaleString(),
                  name === 'totalAdImpressions' ? 'Impressions' :
                  name === 'totalAdPlayTime' ? 'Play Time' : 'QR Scans'
                ]}
              />
              <Legend />
              <Bar dataKey="totalAdImpressions" fill="#1b5087" name="Impressions" />
              <Bar dataKey="totalAdPlayTime" fill="#3674B5" name="Play Time (hours)" />
              <Bar dataKey="totalQRScans" fill="#E78B48" name="QR Scans" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pl-72 pr-5 p-10">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Link 
            to="/dashboard" 
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-3xl font-semibold text-gray-800">Detailed Analytics</h1>
            <p className="text-gray-500 text-sm">Comprehensive insights for {userFirstName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Device Selection Dropdown */}
          <div className="relative">
            <select
              className="text-sm text-gray-600 bg-white rounded-lg px-4 py-2 pr-8 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
              value={selectedDevice}
              onChange={(e) => handleDeviceChange(e.target.value)}
            >
              <option value="all">All Devices</option>
              {availableDevices.map((device) => (
                <option key={device.id} value={device.materialId}>
                  {device.name}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>
          </div>
          
          <select
            className="text-sm text-gray-600 bg-white rounded-lg px-4 py-2 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedPeriod}
            onChange={handlePeriodChange}
          >
            <option value="1d">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
          <button
            onClick={handleRefresh}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            title="Refresh data"
          >
            <RefreshCw className="w-5 h-5 text-gray-600" />
          </button>
          <button
            onClick={exportData}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
      </div>
    </div>

      {/* Device Information Banner */}
      {selectedDevice !== 'all' && deviceAnalytics && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Monitor className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-blue-900">
                  {deviceAnalytics.deviceInfo?.deviceName || 'Selected Device'}
                </h3>
                <p className="text-sm text-blue-700">
                  Material ID: {deviceAnalytics.deviceInfo?.materialId} • 
                  Car Group: {deviceAnalytics.deviceInfo?.carGroupId} • 
                  Platform: {deviceAnalytics.deviceInfo?.platform} • 
                  OS: {deviceAnalytics.deviceInfo?.osName} {deviceAnalytics.deviceInfo?.osVersion}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-blue-600">Showing device-specific analytics</p>
              <p className="text-xs text-blue-500">
                {deviceAnalytics.dateRange?.totalDays || 0} days of data
              </p>
            </div>
          </div>
        </div>
      )}

      {/* No Analytics Data Message */}
      {analyticsError && analyticsError.message === 'Failed to fetch analytics data' && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                No Analytics Data Yet
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>You don't have any analytics data yet. This is normal for new users or users without deployed ads.</p>
                <p className="mt-1">Once you create and deploy ads, your detailed analytics will appear here.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'performance', label: 'Performance', icon: TrendingUp },
            { id: 'impressions', label: 'Impressions', icon: Eye },
            { id: 'display', label: 'Display Time', icon: Clock },
            { id: 'qr', label: 'QR Impressions', icon: Target },
            { id: 'tablets', label: 'Tablet Activity', icon: Users },
            { id: 'ads', label: 'Detailed Ads', icon: BarChart3 }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSelectedView(id as any)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                selectedView === id
                  ? 'border-blue-500 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content based on selected view */}
      {selectedView === 'overview' && renderOverviewSection()}
      {selectedView === 'performance' && renderOverviewSection()}
      {selectedView === 'impressions' && renderImpressionsSection()}
      {selectedView === 'display' && renderDisplayTimeSection()}
      {selectedView === 'qr' && renderQRSection()}
      {selectedView === 'tablets' && renderTabletActivitySection()}
      {selectedView === 'ads' && renderDetailedAdsSection()}

      {/* Top Performing Ads - Updated for UserAnalytics */}
      {topPerformingAds.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mt-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Top Performing Ads {selectedDevice !== 'all' ? `on ${deviceAnalytics?.deviceInfo?.deviceName || 'Selected Device'}` : ''}
          </h3>
          <div className="space-y-4">
            {topPerformingAds.map((ad: any, index: number) => (
              <div key={ad.adId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-[#1b5087] text-white rounded-full flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{ad.adTitle}</p>
                    <p className="text-sm text-gray-500">
                      {selectedDevice !== 'all' ? 
                        `${deviceAnalytics?.qrScanBreakdown?.find((qr: any) => qr.adId === ad.adId)?.totalScans || 0} QR scans • 1 material` :
                        `${ad.totalQRScans} QR scans • ${ad.totalMaterials} materials`
                      }
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-800">
                    {selectedDevice !== 'all' ? ad.averageCompletionRate.toFixed(1) : ad.averageAdCompletionRate.toFixed(1)}%
                  </p>
                  <p className="text-sm text-gray-500">completion rate</p>
                  <p className="text-xs text-gray-400">
                    {selectedDevice !== 'all' ? 
                      (deviceAnalytics?.qrScanBreakdown?.find((qr: any) => qr.adId === ad.adId)?.totalScans > 0 ? 'Device-specific' : '0.0') : 
                      ad.qrScanConversionRate.toFixed(1)}% QR conversion
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading State */}
      {(analyticsLoading || deviceLoading || directAnalyticsLoading) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg flex items-center space-x-3">
            <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-gray-700">
              {deviceLoading ? 'Loading device-specific analytics...' : 
               directAnalyticsLoading ? 'Loading direct analytics data...' : 
               'Loading analytics data...'}
            </span>
          </div>
        </div>
      )}

      {/* Error State */}
      {analyticsError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">Error loading analytics data: {analyticsError.message}</p>
        </div>
      )}
    </div>
  );
};

export default DetailedAnalytics;

