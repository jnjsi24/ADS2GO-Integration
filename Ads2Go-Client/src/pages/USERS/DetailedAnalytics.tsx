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
import { ImagePlay, ScanQrCode, Images, MonitorSmartphone, Smartphone, QrCode, Megaphone } from 'lucide-react';
import { useQuery } from '@apollo/client';
import { GET_USER_ANALYTICS } from '../../graphql/user/queries/getUserAnalytics';
import { ArrowLeft, Download, RefreshCw, TrendingUp, Eye, Play, Clock, Target, Users, MapPin, Calendar, BarChart3, Monitor, ChevronDown, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { motion, AnimatePresence } from 'framer-motion';

const DetailedAnalytics: React.FC = () => {
  const { user } = useUserAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<'1d' | '7d' | '30d'>('7d');
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
  // Device Dropdown States
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);
  const [selectedDeviceLabel, setSelectedDeviceLabel] = useState("All Devices");
  const [pos, setPos] = useState({ x: 50, y: 50 });


  // Period Dropdown States
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [selectedPeriodLabel, setSelectedPeriodLabel] = useState("Last 7 days");

  const [showMetricDropdown, setShowMetricDropdown] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<'impressions' | 'plays' | 'completion' | 'qr' | 'revenue'>('impressions');




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

    const selected = availableDevices.find((d) => d.materialId === deviceId);

    setSelectedDevice(deviceId);
    setSelectedDeviceLabel(selected ? selected.name : "All Devices");
    setShowDeviceDropdown(false);

    // Fetch analytics data for the selected device
    fetchDeviceAnalytics(deviceId);
  };

  const handlePeriodChange = useCallback((value: string) => {
    const newPeriod = value as '1d' | '7d' | '30d';
    setSelectedPeriod(newPeriod);
    setShowPeriodDropdown(false);

    if (newPeriod === '1d') setSelectedPeriodLabel('Last 24 hours');
    else if (newPeriod === '7d') setSelectedPeriodLabel('Last 7 days');
    else if (newPeriod === '30d') setSelectedPeriodLabel('Last 30 days');

    // ✅ Re-fetch analytics when the period changes
    fetchDeviceAnalytics(selectedDevice);
  }, [selectedDevice, fetchDeviceAnalytics]);


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
      // For "All Devices" - use UserAnalytics dailyStats data
      const dailyStats = analyticsData?.getUserAnalytics?.dailyStats || [];
      return dailyStats.map((day: any) => ({
        date: day.date,
        impressions: day.impressions || 0,
        adsPlayed: day.adsPlayed || 0,
        qrScans: day.qrScans || 0,
        completionRate: day.completionRate || 0,
        revenue: 0
      }));
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
  }, [selectedDevice, deviceAnalytics, analyticsData, weeklyData]);

  const qrScansChartData = useMemo(() => {
    if (selectedDevice === 'all') {
      // For "All Devices" - use UserAnalytics dailyStats data
      const dailyStats = analyticsData?.getUserAnalytics?.dailyStats || [];
      return dailyStats.map((day: any) => ({
        date: day.date,
        qrScans: day.qrScans || 0
      }));
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
        <div className="bg-white/50 p-6 shadow-md">
          <div className="flex flex-col">
            {/* Row 1: Icon + Label */}
            <div className="flex items-center">
             <div
              className="p-2 mr-2 rounded-full bg-gradient-to-br from-yellow-300/60 via-yellow-300/40 to-white/40 border 
              border-white/30 backdrop-blur-md shadow-md flex items-center justify-center">
              <Play className="w-5 h-5 text-yellow-700 drop-shadow-sm" />
              </div>
                <p className="text-sm text-black/70 font-medium ml-1">Total Plays</p>
            </div>
            {/* Row 2: Value */}
            <p className="text-3xl font-semibold text-gray-900 mt-1 ml-12">
              {analyticsLoading ? '...' : analyticsSummary.totalAdsPlayed.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-white/50 p-6 shadow-md">
          <div className="flex flex-col">
            {/* Row 1: Icon + Label */}
            <div className="flex items-center">
              <div
                className="p-2 mr-2 rounded-full 
                          bg-gradient-to-br from-purple-300/60 via-purple-300/40 to-white/40 
                          border border-white/30 
                          backdrop-blur-md shadow-md 
                          flex items-center justify-center"
              >
                <ScanQrCode className="w-5 h-5 text-purple-700 drop-shadow-sm" />
              </div>

              <p className="text-sm text-black/70 font-medium ml-1">QR Scans</p>
            </div>
            {/* Row 2: Value */}
            <p className="text-3xl font-semibold text-gray-900 mt-1 ml-12">
              {analyticsLoading ? '...' : analyticsSummary.totalQRScans.toLocaleString()}
            </p>
          </div>

        </div>

        <div className="bg-white/50 p-6 shadow-md">
          <div className="flex flex-col">
            {/* Row 1: Icon + Label */}
            <div className="flex items-center">
              <div
                className="p-2 mr-2 rounded-full 
                           bg-gradient-to-br from-blue-300/60 via-blue-300/40 to-white/40 
                           border border-white/30 
                           backdrop-blur-md shadow-md 
                           flex items-center justify-center"
              >
                <MonitorSmartphone className="w-5 h-5 text-blue-700 drop-shadow-sm" />
              </div>
              <p className="text-sm text-black/70 font-medium ml-1">Devices</p>
            </div>

            {/* Row 2: Value */}
            <p className="text-3xl font-semibold text-gray-900 mt-1 ml-12">
              {analyticsLoading ? '...' : analyticsSummary.totalMaterials.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-white/50 p-6 shadow-md">
          <div className="flex flex-col">
            {/* Row 1: Icon + Label */}
            <div className="flex items-center">
              <div
                className="p-2 mr-2 rounded-full 
                          bg-gradient-to-br from-green-300/60 via-green-300/40 to-white/40 
                          border border-white/30 
                          backdrop-blur-md shadow-md 
                          flex items-center justify-center"
              >
                <Target className="w-5 h-5 text-green-700 drop-shadow-sm" />
              </div>
              <p className="text-sm text-black/70 font-medium ml-1">Completion Rate</p>
            </div>
            {/* Row 2: Value */}
            <p className="text-3xl font-semibold text-gray-900 mt-1 ml-12">
              {analyticsLoading ? '...' : analyticsSummary.averageCompletionRate.toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="bg-white/50 p-6 shadow-md">
          <div className="flex flex-col">
            {/* Row 1: Icon + Label */}
            <div className="flex items-center">
              <div
                className="p-2 mr-2 rounded-full 
                          bg-gradient-to-br from-orange-300/60 via-orange-300/40 to-white/40 
                          border border-white/30 
                          backdrop-blur-md shadow-md 
                          flex items-center justify-center"
              >
                <Clock className="w-5 h-5 text-orange-700 drop-shadow-sm" />
              </div>
              <p className="text-sm text-black/70 font-medium ml-1">Display Time</p>
            </div>
            {/* Row 2: Value */}
            <p className="text-3xl font-semibold text-gray-900 mt-1 ml-12">
              {analyticsLoading ? '...' : formatDisplayTime(analyticsSummary.totalDisplayTime)}
            </p>
          </div>
        </div>
      </div>

      {/* Performance Over Time */}
      <div className="bg-white/20 p-6 shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Performance Over Time</h3>
          <div className="relative w-40">
            {/* Button that toggles the dropdown */}
            <button
              onClick={() => setShowMetricDropdown(!showMetricDropdown)}
              className="flex items-center justify-between w-full text-sm text-gray-700 rounded-md px-3 py-2 bg-white/60 border border-gray-200 shadow-sm transition-colors"
            >
              {(() => {
                switch (selectedMetric) {
                  case 'impressions': return 'Impressions';
                  case 'plays': return 'Plays';
                  case 'completion': return 'Completion Rate';
                  case 'qr': return 'QR Scans';
                  case 'revenue': return 'Revenue';
                  default: return 'Select Metric';
                }
              })()}
              <ChevronDown
                size={16}
                className={`transform transition-transform duration-200 ${showMetricDropdown ? 'rotate-180' : 'rotate-0'}`}
              />
            </button>

            {/* AnimatePresence dropdown */}
            <AnimatePresence>
              {showMetricDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute z-10 top-full mt-2 w-full bg-white rounded-md shadow-lg border border-gray-200 overflow-hidden"
                >
                  {[
                    { value: 'impressions', label: 'Impressions' },
                    { value: 'plays', label: 'Plays' },
                    { value: 'completion', label: 'Completion Rate' },
                    { value: 'qr', label: 'QR Scans' },
                    { value: 'revenue', label: 'Revenue' },
                  ].map((metric) => (
                    <button
                      key={metric.value}
                      onClick={() => {
                        setSelectedMetric(metric.value as any);
                        setShowMetricDropdown(false);
                      }}
                      className={`block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors ${
                        selectedMetric === metric.value ? 'bg-blue-50 text-[#3674B5]' : ''
                      }`}
                    >
                      {metric.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={performanceChartData}>
            <defs>
              <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1b5087" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#1b5087" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12, fill: '#666' }}
              tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            />
            <YAxis tick={{ fontSize: 12, fill: '#666' }} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
              labelFormatter={(value) => new Date(value).toLocaleDateString()}
              formatter={(value, name) => [
                name === 'adsPlayed' ? value.toLocaleString() : 
                name === 'qrScans' ? value.toLocaleString() :
                `${value}%`,
                name === 'adsPlayed' ? 'Plays' : 
                name === 'qrScans' ? 'QR Scans' : 'Completion Rate'
              ]}
            />
            <Area 
              type="monotone" 
              dataKey={selectedMetric === 'plays' ? 'adsPlayed' : selectedMetric === 'qr' ? 'qrScans' : 'completionRate'} 
              fill="url(#colorMetric)" 
              stroke="#1b5087" 
              strokeWidth={3}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderImpressionsSection = () => (
    <div className="space-y-6">
      <div className="bg-white/20 p-6 shadow-md">
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
      <div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white/20 shadow-md p-4">
            <h4 className="text-md font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#1b5087]" />
              Daily Display Time
            </h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(value) => [formatDisplayTime(Number(value)), 'Display Time']}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                />
                <Bar dataKey="completion" fill="rgba(27, 80, 135, 0.8)" radius={[8, 8, 0, 0]} name="Display Time (hours)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white/20 shadow-md p-4">
            <h4 className="text-md font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Device Completion Rate
            </h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={devicePerformanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                />
                <Bar dataKey="completion" fill="rgba(16, 185, 129, 0.7)" radius={[8, 8, 0, 0]} name="Completion Rate %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );

  const renderQRSection = () => (
    <div className="space-y-6">
      {/* QR Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white/50 p-6 shadow-md backdrop-blur-md">
          <div className="flex flex-col">
            {/* Row 1: Icon + Label */}
            <div className="flex items-center">
              <div
                className="p-2 mr-2 rounded-full 
                          bg-gradient-to-br from-blue-300/60 via-blue-200/40 to-white/40 
                          border border-white/30 backdrop-blur-md shadow-md 
                          flex items-center justify-center"
              >
                <QrCode className="w-5 h-5 text-blue-700 drop-shadow-sm" />
              </div>
              <p className="text-sm text-black/70 font-medium ml-1">Total QR Scans</p>
            </div>

            {/* Row 2: Value */}
            <p className="text-3xl font-semibold text-gray-900 mt-1 ml-11">
              {analyticsLoading ? '...' : analyticsSummary.totalQRScans.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white/20 p-6 shadow-md">
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
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Total Materials */}
        <div className="bg-white/50 p-6 shadow-md backdrop-blur-md">
          <div className="flex flex-col">
            {/* Row 1: Icon + Label */}
            <div className="flex items-center">
              <div
                className="p-2 mr-2 rounded-full 
                          bg-gradient-to-br from-yellow-400/60 via-yellow-300/40 to-white/40 
                          border border-white/30 backdrop-blur-md shadow-md 
                          flex items-center justify-center"
              >
                <Smartphone className="w-5 h-5 text-yellow-700 drop-shadow-sm" />
              </div>
              <p className="text-sm text-black/70 font-medium ml-1">Total LCD</p>
            </div>
            {/* Row 2: Value */}
            <p className="text-3xl font-semibold text-gray-900 mt-1 ml-12">
              1
            </p>
          </div>
        </div>

        <div className="bg-white/50 p-6 shadow-md backdrop-blur-md">
          <div className="flex flex-col">
            {/* Row 1: Icon + Label */}
            <div className="flex items-center">
              <div
                className="p-2 mr-2 rounded-full 
                          bg-gradient-to-br from-orange-400/60 via-orange-300/40 to-white/40 
                          border border-white/30 backdrop-blur-md shadow-md 
                          flex items-center justify-center"
              >
                <Monitor className="w-5 h-5 text-orange-700 drop-shadow-sm" />
              </div>
              <p className="text-sm text-black/70 font-medium ml-1">Total Headdress</p>
            </div>
            {/* Row 2: Value */}
            <p className="text-3xl font-semibold text-gray-900 mt-1 ml-12">
              1
            </p>
          </div>
        </div>

        {/* Total Devices */}
        <div className="bg-white/50 p-6 shadow-md backdrop-blur-md">
          <div className="flex flex-col">
            {/* Row 1: Icon + Label */}
            <div className="flex items-center">
              <div
                className="p-2 mr-2 rounded-full 
                          bg-gradient-to-br from-blue-400/60 via-blue-300/40 to-white/40 
                          border border-white/30 backdrop-blur-md shadow-md 
                          flex items-center justify-center"
              >
              <MonitorSmartphone className="w-5 h-5 text-blue-700 drop-shadow-sm" />
              </div>
              <p className="text-sm text-black/70 font-medium ml-1">Total Devices</p>
            </div>

            {/* Row 2: Value */}
            <p className="text-3xl font-semibold text-gray-900 mt-1 ml-12">
              {analyticsLoading ? '...' : analyticsSummary.totalDevices.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Avg. Completion */}
        <div className="bg-white/50 p-6 shadow-md backdrop-blur-md">
          <div className="flex flex-col">
            {/* Row 1: Icon + Label */}
            <div className="flex items-center">
              <div
                className="p-2 mr-2 rounded-full 
                          bg-gradient-to-br from-red-400/60 via-red-300/40 to-white/40 
                          border border-white/30 backdrop-blur-md shadow-md 
                          flex items-center justify-center"
              >
              <Target className="w-5 h-5 text-red-700 drop-shadow-sm" />
              </div>
              <p className="text-sm text-black/70 font-medium ml-1">Avgerage Completion</p>
            </div>

            {/* Row 2: Value */}
            <p className="text-3xl font-semibold text-gray-900 mt-1 ml-12">
              {analyticsLoading ? '...' : analyticsSummary.averageCompletionRate.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white/20 shadow-md">
        {/* Device Activity Table - Real Data from UserAnalytics */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white/20">
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
            <tbody className="bg-white/20 divide-y divide-gray-200">
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
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Total Ads */}
        <div className="bg-white/50 p-6 shadow-md backdrop-blur-md">
          <div className="flex flex-col">
            {/* Row 1: Icon + Label */}
            <div className="flex items-center">
              <div
                className="p-2 mr-2 rounded-full 
                          bg-gradient-to-br from-yellow-300/60 via-yellow-300/40 to-white/40 
                          border border-white/30 backdrop-blur-md shadow-md 
                          flex items-center justify-center"
              >
              <Images className="w-5 h-5 text-yellow-700 drop-shadow-sm" />
              </div>
              <p className="text-sm text-black/70 font-medium ml-1">Total Ads</p>
            </div>
            {/* Row 2: Value */}
            <p className="text-3xl font-semibold text-gray-900 mt-1 ml-11">
              {analyticsLoading ? '...' : analyticsSummary.totalAds.toLocaleString()}
            </p>
          </div>
        </div>
        {/* Active Ads */}
        <div className="bg-white/50 p-6 shadow-md backdrop-blur-md">
          <div className="flex flex-col">
            {/* Row 1: Icon + Label */}
            <div className="flex items-center">
              <div
                className="p-2 mr-2 rounded-full 
                          bg-gradient-to-br from-green-300/60 via-green-300/40 to-white/40 
                          border border-white/30 backdrop-blur-md shadow-md 
                          flex items-center justify-center"
              >
                <ImagePlay className="w-5 h-5 text-green-700 drop-shadow-sm" />
              </div>
              <p className="text-sm text-black/70 font-medium ml-1">Active Ads</p>
            </div>

            {/* Row 2: Value */}
            <p className="text-3xl font-semibold text-gray-900 mt-1 ml-11">
              {analyticsLoading ? '...' : analyticsSummary.activeAds.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white/20 p-6 shadow-md">
        {/* Detailed Ads Table - Real Data from UserAnalytics */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-gray-200">
            <thead className="">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-black/80 uppercase tracking-wider">Ad Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-black/80 uppercase tracking-wider">Materials</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-black/80 uppercase tracking-wider">Impressions</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-black/80 uppercase tracking-wider">Play Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-black/80 uppercase tracking-wider">QR Scans</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-black/80 uppercase tracking-wider">Completion</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-black/80 uppercase tracking-wider">QR Conversion</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-black/80 uppercase tracking-wider">Last Updated</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-black/80 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white/60 divide-y divide-gray-200">
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
   <div className="relative min-h-screen overflow-hidden">
    {/* Background layer */}
    <div
      className="absolute inset-0 bg-cover bg-center bg-fixed blur-sm brightness-90"
      style={{
        backgroundImage: "url('/image/bg.jpg')",
      }}
    ></div>

    {/* Translucent overlay */}
    <div className="absolute inset-0 bg-white/40 backdrop-blur-xl"></div>

    {/* Foreground content */}
    <div className="relative min-h-screen bg-transparent pl-72 pr-5 p-10 flex flex-col">
      {/* Header Section */}
      <div className="flex flex-col mt-4 gap-4 mb-6">
        {/* Row 1: Back to Dashboard */}
        <div className="flex justify-between items-center">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors w-fit"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Back to Dashboard</span>
          </Link>
        </div>

        {/* Row 2: Detailed Analytics + Filters */}
        <div className="flex justify-between items-center">
          {/* Left: Title */}
          <div>
            <h1 className="text-3xl font-semibold text-gray-800">Detailed Analytics</h1>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex items-center gap-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleRefresh}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = ((e.clientX - rect.left) / rect.width) * 100;
                    const y = ((e.clientY - rect.top) / rect.height) * 100;
                    setPos({ x, y });
                  }}
                  className={`relative group inline-flex items-center justify-center overflow-hidden
                              px-4 py-2 text-sm font-semibold text-white
                              transition-all duration-300 hover:scale-105`}
                  style={{
                    backgroundImage: `linear-gradient(to right, #1B5087 0%, #3674B5 100%),
                                      radial-gradient(circle at ${pos.x}% ${pos.y}%, rgba(173,216,230,0), rgba(173,216,230,0))`,
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                  </span>

                  {/* Light-blue shine effect following mouse */}
                  <span
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                    style={{
                      background: `radial-gradient(circle at ${pos.x}% ${pos.y}%, rgba(255,255,255,0.25), transparent 60%)`,
                    }}
                  />
                </button>
                <button
                  onClick={exportData}
                  className="flex items-center gap-2 px-4 py-2 text-sm border border-green-500 text-green-600 hover:text-green-600 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Row 3: Refresh + Export Buttons */}
        
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
      <div className="">
        <div className="flex overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'display', label: 'Display Time', icon: Clock },
            { id: 'qr', label: 'QR Impressions', icon: QrCode },
            { id: 'tablets', label: 'Tablet Activity', icon: MonitorSmartphone },
            { id: 'ads', label: 'Detailed Ads', icon: Megaphone },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSelectedView(id as any)}
              className={`relative flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors group
                ${selectedView === id ? 'text-[#3674B5]' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Icon className={`w-5 h-5 transition-transform duration-200 ${selectedView === id ? 'scale-110' : 'group-hover:scale-105'}`} />
              {label}
              {/* Animated underline */}
              <span
                className={`absolute bottom-0 left-0 h-[2px] bg-[#3674B5] transition-all duration-300
                  ${selectedView === id ? 'w-full' : 'w-0 group-hover:w-full'}`}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end mb-10 gap-3">
            {/* Device Selection Dropdown */}
            <div className="relative w-32">
              <button
                onClick={() => setShowDeviceDropdown(!showDeviceDropdown)}
                className="flex items-center justify-between w-full text-sm text-gray-700 rounded-md px-4 py-2 shadow-md focus:outline-none bg-white/60 gap-2"
              >
                {selectedDeviceLabel || "All Devices"}
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
                    className="absolute z-10 top-full mt-2 w-full rounded-md shadow-md bg-white overflow-hidden"
                  >
                    <button
                      onClick={() => handleDeviceChange("all")}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                    >
                      All Devices
                    </button>
                    {availableDevices.map((device) => (
                      <button
                        key={device.id}
                        onClick={() => handleDeviceChange(device.materialId)}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                      >
                        {device.name}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Period Filter */}
            <div className="relative w-36">
              <button
                onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
                className="flex items-center justify-between w-full text-sm text-gray-700 rounded-md px-4 py-2 shadow-md focus:outline-none bg-white/60 gap-2"
              >
                {selectedPeriodLabel}
                <ChevronDown
                  size={16}
                  className={`transform transition-transform duration-200 ${
                    showPeriodDropdown ? "rotate-180" : "rotate-0"
                  }`}
                />
              </button>

              <AnimatePresence>
                {showPeriodDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute z-10 top-full mt-2 w-full rounded-md shadow-md bg-white overflow-hidden"
                  >
                    {[
                      { value: "1d", label: "Last 24 hours" },
                      { value: "7d", label: "Last 7 days" },
                      { value: "30d", label: "Last 30 days" },
                    ].map((period) => (
                      <button
                        key={period.value}
                        onClick={() => handlePeriodChange(period.value)}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                      >
                        {period.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>


      {/* Content based on selected view */}
      {selectedView === 'overview' && renderOverviewSection()}
      {selectedView === 'display' && renderDisplayTimeSection()}
      {selectedView === 'qr' && renderQRSection()}
      {selectedView === 'tablets' && renderTabletActivitySection()}
      {selectedView === 'ads' && renderDetailedAdsSection()}

      {/* Top Performing Ads - Updated for UserAnalytics */}
      {topPerformingAds.length > 0 && (
        <div className="bg-white/60 p-6 rounded-lg shadow-md mt-6">
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

      {/* Error State */}
      {analyticsError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">Error loading analytics data: {analyticsError.message}</p>
        </div>
      )}
    </div>
    </div>
  );
};

export default DetailedAnalytics;

