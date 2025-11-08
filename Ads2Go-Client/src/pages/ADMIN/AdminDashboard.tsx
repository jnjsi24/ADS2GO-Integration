import React, { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@apollo/client";
import { GET_OWN_ADMIN_DETAILS } from "../../graphql/admin";
import { GET_ADMIN_DASHBOARD_STATS, GET_PENDING_ADS } from "../../graphql/admin/queries";
import { GET_ALL_USER_REPORTS } from "../../graphql/admin/queries/userReports";
import { GET_ALL_DRIVER_REPORTS } from "../../graphql/admin/queries/driverReports";
import DynamicNotificationList from "./tabs/dashboard/DynamicNotificationList";
import DeviceNotificationList from "./tabs/dashboard/DeviceNotificationList";
import { AdminLoader } from "../../components/ProtectedRoute";
import SubtleLoader from "../../components/SubtleLoader";
import { screenComplianceService } from '../../services/screenComplianceService';
import { Monitor, PlayCircle, Users, Car, FileText, ArrowUpRight } from "lucide-react";
import { motion, Transition } from "framer-motion";

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
// Import ScreenStatus interface from ScreenTracking for consistency
interface ScreenStatus {
  deviceId: string;
  displayId?: string;
  materialId: string;
  screenType: 'HEADDRESS' | 'LCD' | 'BILLBOARD' | 'DIGITAL_DISPLAY';
  carGroupId?: string;
  slotNumber?: number;
  isOnline: boolean;
  currentLocation?: {
    lat: number;
    lng: number;
    timestamp: string;
    speed: number;
    heading: number;
    accuracy: number;
    address: string;
  };
  lastSeen: string;
  currentHours?: number;
  hoursRemaining?: number;
  isCompliant: boolean;
  totalDistanceToday?: number;
  averageDailyHours?: number;
  complianceRate?: number;
  totalHoursOnline?: number;
  totalDistanceTraveled?: number;
  displayStatus: 'ACTIVE' | 'OFFLINE' | 'MAINTENANCE' | 'DISPLAY_OFF';
  statusText?: string;
  slot1Status?: string;
  slot2Status?: string;
  slot1DeviceId?: string;
  slot2DeviceId?: string;
  masterDeviceId?: string;
  slot1LastSeen?: string;
  slot2LastSeen?: string;
  screenMetrics?: {
    displayHours: number;
    adPlayCount: number;
    lastAdPlayed: string;
    brightness: number;
    volume: number;
    isDisplaying: boolean;
    maintenanceMode: boolean;
    currentAd?: {
      adId: string;
      adTitle: string;
      adDuration: number;
      startTime: string;
      currentTime?: number;
      state?: string;
      progress?: number;
    };
  };
  alerts: Array<{
    type: string;
    message: string;
    timestamp: string;
    isResolved: boolean;
    severity: string;
  }>;
  totalDevices?: number;
  onlineDevices?: number;
  totalHours?: number;
  totalDistance?: number;
}

const GET_ADMIN_DETAILS = GET_OWN_ADMIN_DETAILS;

// Animation variants for pending reports (matching notification containers)
const getCardVariants = (i: number) => ({
  collapsed: {
    marginTop: i === 0 ? 0 : -44,
    scaleX: 1 - i * 0.05,
  },
  expanded: {
    marginTop: i === 0 ? 0 : 4,
    scaleX: 1,
  },
});

const transition: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 26,
};

const textSwitchTransition: Transition = {
  duration: 0.22,
  ease: 'easeInOut',
};

const notificationTextVariants = {
  collapsed: { opacity: 1, y: 0, pointerEvents: 'auto' },
  expanded: { opacity: 0, y: -16, pointerEvents: 'none' },
};

const viewAllTextVariants = {
  collapsed: { opacity: 0, y: 16, pointerEvents: 'none' },
  expanded: { opacity: 1, y: 0, pointerEvents: 'auto' },
};


const Dashboard = () => {
  const [adminName, setAdminName] = useState("Admin");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  
  // Screen data states
  const [screens, setScreens] = useState<ScreenStatus[]>([]);
  const [screenLoading, setScreenLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [screenError, setScreenError] = useState<string | null>(null);
  
  // Track if initial fetch has been triggered to prevent duplicates
  const hasInitialFetchTriggered = useRef(false);
  const lastFetchTime = useRef(0);

  // Auto detect sidebar collapse based on window width
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      setSidebarCollapsed(width >= 768 && width < 1024);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const { loading, error, data } = useQuery(GET_ADMIN_DETAILS);

  const { data: statsData, loading: statsLoading, error: statsError, refetch: refetchStats } = useQuery(GET_ADMIN_DASHBOARD_STATS, {
    // Removed pollInterval - will use centralized refresh
  });

  const { data: pendingAdsData, loading: pendingAdsLoading, error: pendingAdsError, refetch: refetchPendingAds } = useQuery(GET_PENDING_ADS, {
    // Removed pollInterval - will use centralized refresh
  });

  // Fetch pending user reports
  const { data: userReportsData, loading: userReportsLoading, refetch: refetchUserReports } = useQuery(GET_ALL_USER_REPORTS, {
    variables: {
      filters: { status: 'PENDING' },
      limit: 5,
      offset: 0
    },
    // Removed pollInterval - will use centralized refresh
  });

  // Fetch pending driver reports
  const { data: driverReportsData, loading: driverReportsLoading, refetch: refetchDriverReports } = useQuery(GET_ALL_DRIVER_REPORTS, {
    variables: {
      filters: { status: 'PENDING' },
      limit: 5,
      offset: 0
    },
    // Removed pollInterval - will use centralized refresh
  });

  // Handle admin details data
  useEffect(() => {
    if (data?.getOwnAdminDetails) {
      const admin = data.getOwnAdminDetails;
      setAdminName(`${admin.firstName} ${admin.lastName}`);
    }
  }, [data]);

  // Fetch screen data with useCallback to prevent unnecessary re-renders
  const fetchScreenData = useCallback(async (isInitialLoad: boolean = false) => {
    try {
      // ✅ DEBOUNCE: Prevent rapid consecutive fetches (minimum 2 seconds between requests)
      const now = Date.now();
      const timeSinceLastFetch = now - lastFetchTime.current;
      if (timeSinceLastFetch < 2000 && !isInitialLoad) {
        console.log(`⏭️ [AdminDashboard] Skipping fetch - too soon (${timeSinceLastFetch}ms since last fetch)`);
        return;
      }
      lastFetchTime.current = now;
      
      setScreenLoading(true);
      setScreenError(null);
      
      // ✅ PHASE 2 OPTIMIZATION: Use shared compliance service with caching
      // Skip geocoding on initial load for faster response
      const skipGeocoding = isInitialLoad || !hasInitiallyLoaded;
      console.log(`📍 [AdminDashboard] Skip geocoding: ${skipGeocoding ? 'YES' : 'NO'} (isInitialLoad: ${isInitialLoad}, hasInitiallyLoaded: ${hasInitiallyLoaded})`);
      
      const startTime = Date.now();
      const complianceData = await screenComplianceService.getCompliance(null, skipGeocoding);
      const fetchDuration = Date.now() - startTime;
      
      console.log(`⏱️ [AdminDashboard] Compliance response received after ${fetchDuration}ms (${(fetchDuration / 1000).toFixed(2)}s)`);
      console.log('✅ [AdminDashboard] Compliance data received:', complianceData);
      
      if (complianceData.success && complianceData.data?.screens) {
        // ✨ Geocode addresses on client-side if missing OR is just coordinates
        const screensWithAddresses = await Promise.all(
          complianceData.data.screens.map(async (screen: ScreenStatus) => {
            // If address is missing OR is just coordinates (starts with "Location:"), geocode on client
            const needsGeocoding = screen.currentLocation?.lat && screen.currentLocation?.lng && 
              (!screen.currentLocation?.address || screen.currentLocation.address.startsWith('Location:'));
            
            if (needsGeocoding) {
              try {
                const address = await reverseGeocodeClient(screen.currentLocation.lat, screen.currentLocation.lng);
                return {
                  ...screen,
                  currentLocation: {
                    ...screen.currentLocation,
                    address: address
                  }
                };
              } catch (error) {
                console.warn(`Failed to geocode ${screen.currentLocation.lat}, ${screen.currentLocation.lng}:`, error);
                return screen; // Return original if geocoding fails
              }
            }
            return screen;
          })
        );
        
        setScreens(screensWithAddresses);
        console.log('📊 [AdminDashboard] Screens loaded:', screensWithAddresses.length);
        
        // If this was initial load and we skipped geocoding, trigger a refresh with geocoding after a delay
        if (skipGeocoding && !hasInitiallyLoaded) {
          setTimeout(() => {
            console.log('🔄 [AdminDashboard] Triggering geocoded refresh after initial load...');
            fetchScreenData(false); // Fetch again with geocoding enabled
          }, 3000); // Wait 3 seconds after initial load
        }
      } else {
        console.error('❌ [AdminDashboard] Invalid compliance data format:', complianceData);
        setScreenError("Invalid data format received");
      }
    } catch (error) {
      console.error("❌ [AdminDashboard] Error fetching screen data:", error);
      setScreenError("Failed to load screen data");
    } finally {
      setScreenLoading(false);
    }
  }, [hasInitiallyLoaded]);

  // Centralized refresh system - refreshes all data every 15 seconds
  const refreshAllData = useCallback(async (isInitialLoad: boolean = false) => {
    console.log(`🔄 [AdminDashboard] Centralized refresh triggered (isInitialLoad: ${isInitialLoad})`);
    
    // Refresh all GraphQL queries
    try {
      await Promise.all([
        refetchStats(),
        refetchPendingAds(),
        refetchUserReports(),
        refetchDriverReports(),
        fetchScreenData(isInitialLoad)
      ]);
      console.log('✅ [AdminDashboard] All data refreshed successfully');
    } catch (error) {
      console.error('❌ [AdminDashboard] Error during centralized refresh:', error);
    }
  }, [refetchStats, refetchPendingAds, refetchUserReports, refetchDriverReports, fetchScreenData]);

  // Initial data fetch and setup centralized refresh
  useEffect(() => {
    // ✅ OPTIMIZATION: Prevent duplicate initial fetches
    if (hasInitialFetchTriggered.current) {
      console.log('⏭️ [AdminDashboard] Skipping duplicate initial fetch');
      return;
    }
    
    hasInitialFetchTriggered.current = true;
    
    // Initial fetch with skipGeocoding enabled
    console.log('🚀 [AdminDashboard] Initial data fetch started (ONCE)');
    refreshAllData(true);
    
    // Set up centralized auto-refresh every 15 seconds (without skipGeocoding)
    const refreshInterval = setInterval(() => {
      console.log('🔄 [AdminDashboard] Auto-refresh interval triggered');
      refreshAllData(false);
    }, 15000);
    
    return () => {
      console.log('🧹 [AdminDashboard] Cleaning up refresh interval');
      clearInterval(refreshInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track initial load completion
  useEffect(() => {
    if (!loading && !statsLoading && !pendingAdsLoading && !screenLoading && !userReportsLoading && !driverReportsLoading && !hasInitiallyLoaded) {
      setHasInitiallyLoaded(true);
    }
  }, [loading, statsLoading, pendingAdsLoading, screenLoading, userReportsLoading, driverReportsLoading, hasInitiallyLoaded]);

  // Handle errors
  useEffect(() => {
    if (error) {
      console.error("Error fetching admin details:", error);
    }
  }, [error]);

  useEffect(() => {
    if (statsError) {
      console.error("Error fetching admin dashboard stats:", statsError);
    }
  }, [statsError]);

  useEffect(() => {
    if (pendingAdsError) {
      console.error("Error fetching pending ads:", pendingAdsError);
    }
  }, [pendingAdsError]);

  // Only show AdminLoader on initial load, not during auto-refresh
  if (!hasInitiallyLoaded && (loading || statsLoading || pendingAdsLoading || screenLoading || userReportsLoading || driverReportsLoading)) {
    return <AdminLoader />;
  }

  if (error)
    return (
      <div className="p-8 bg-[#f9f9fc] min-h-screen flex items-center justify-center">
        <div className="text-red-500">Error loading admin details: {error.message}</div>
      </div>
    );

  const stats = statsData?.getAdminDashboardStats;
  const pendingAdsCount = pendingAdsData?.getPendingAds?.length || 0;
  const pendingUserReports = userReportsData?.getAllUserReports?.reports || [];
  const pendingDriverReports = driverReportsData?.getAllDriverReports?.reports || [];

  // Adjust margin/padding depending on sidebar width and screen size
  const contentMargin = isMobile ? "ml-0" : sidebarCollapsed ? "ml-16" : "ml-60";

  return (
    <div
      className={`p-6 ${contentMargin} bg-[#f9f9fc] min-h-screen text-gray-800 font-sans transition-all duration-300`}
    >
      {/* Header */}
      <div className="flex flex-col pt-2 sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl pt-3 font-semibold text-gray-800">
            Welcome back, {adminName}!
          </h2>
          <p className="text-sm text-gray-500">
            Monitor and control your advertising campaigns across all devices
          </p>
        </div>
        {/* Subtle refresh indicator */}
        <div className="flex items-center text-xs text-gray-400">
          <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
          <span>Auto-refreshing every 15s</span>
        </div>
        {/* Show subtle loader during auto-refresh */}
        {hasInitiallyLoaded && (statsLoading || pendingAdsLoading) && (
          <div className="mt-2">
            <SubtleLoader message="Updating data..." />
          </div>
        )}
      </div>

      {/* Stats & Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        {/* Left column */}
        <div className="lg:col-span-4 space-y-6 ">
          {[
            {
              label: "Total Drivers",
              value: stats?.totalDrivers || 0,
              change: `${stats?.newDriversToday || 0} new today`,
              up: true,
            },
            {
              label: "Pending Drivers",
              value: stats?.pendingDrivers || 0,
              change: "Awaiting review",
              up: false,
            },
            {
              label: "Total Ads",
              value: stats?.totalAds || 0,
              change: `${stats?.activeAds || 0} active`,
              up: true,
            },
            {
              label: "Pending Ads",
              value: stats?.pendingAds || 0,
              change: "Awaiting approval",
              up: false,
            },
          ].map((stat, i) => {
            const shouldShowArrow = stat.label === "Pending Drivers" || stat.label === "Pending Ads";
            const navigationPath = stat.label === "Pending Drivers" ? "/admin/drivers?status=pending" : 
                                 stat.label === "Pending Ads" ? "/admin/manage-ads?status=pending" : "";
            
            return (
              <div
                key={i}
                className={`bg-white p-5 rounded-md shadow-md flex flex-col justify-between transition-all duration-200 hover:shadow-md ${
                  shouldShowArrow ? 'cursor-pointer' : ''
                }`}
                onClick={shouldShowArrow ? () => window.location.href = navigationPath : undefined}
              >
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  {shouldShowArrow && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
                <p className="text-2xl font-bold text-gray-800 mb-1">{stat.value}</p>
                <p
                  className={`text-sm font-medium ${
                    stat.up ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {stat.up ? "▲" : "▼"} {stat.change}
                </p>
              </div>
            );
          })}

        </div>

        {/* Right column - Screen Status Cards and Notifications */}
        <div className="lg:col-span-8 space-y-6">
          {/* Screen Status Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                <Monitor className="w-8 h-8 text-green-500" />
              </div>
            </div>

            {/* Playing Ads */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="flex items-center justify-center gap-3">
                <div className="flex flex-col items-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {screens.filter(s => {
                      const currentAd = s.screenMetrics?.currentAd;
                      return s.isOnline && currentAd && currentAd.state && ['playing', 'buffering', 'loading'].includes(currentAd.state);
                    }).length}
                  </p>
                  <p className="text-sm text-gray-600">Playing Ads</p>
                </div>
                <PlayCircle className="w-8 h-8 text-blue-500" />
              </div>
            </div>
          </div>

          {/* Notifications (split into 2 parts) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left part - Admin Main Notifications */}
            <div className="min-h-0">
              <DynamicNotificationList pendingAdsCount={pendingAdsCount} />
            </div>

            {/* Right part - Device Notifications */}
            <div className="min-h-0">
              <DeviceNotificationList />
            </div>
          </div>

          {/* Pending Reports (split into 2 parts) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left part - Pending User Reports */}
            <div className="min-h-0">
              <motion.div
                className="bg-white dark:bg-neutral-900 p-3 rounded-xl
w-full h-auto space-y-3 shadow-md flex flex-col"
                initial="collapsed"
                whileHover="expanded"
              >
                <div className="flex-1 overflow-hidden min-h-0">
                  {pendingUserReports.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <FileText className="w-12 h-12 mx-auto mb-4
text-gray-300" />
                      <p>No pending reports found</p>
                    </div>
                  ) : (
                    pendingUserReports.slice(0, 3).map((report: any,
i: number) => (
                      <motion.div
                        key={report.id}
                        className="bg-gray-100 dark:bg-neutral-800
rounded-xl px-4 py-2 shadow-sm hover:shadow-lg transition-shadow
duration-200 relative h-16"
                        variants={getCardVariants(i)}
                        transition={transition}
                        style={{ zIndex: Math.min(3,
pendingUserReports.length) - i }}
                      >
                        <div className="flex items-center
justify-between h-full">
                          <div className="flex items-start gap-3
min-w-0 flex-1">
                          {!report.read && (
                          <div className="w-2 h-2 bg-yellow-500
rounded-full flex-shrink-0"></div>
                          )}
                            <Users className="w-5 h-5 text-blue-500
flex-shrink-0" />
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <div className="flex items-center gap-2 min-w-0">
                                <h1 className="text-sm font-medium
truncate flex-1 min-w-0">{report.title}</h1>
                              </div>
                              <div className="text-xs text-neutral-500
font-medium truncate">
                                <span>{new
Date(report.createdAt).toLocaleDateString()}</span>
                                &nbsp;•&nbsp;
                                <span>
                                  {report.user ?
`${report.user.firstName} ${report.user.lastName}` : 'Unknown User'}
                                </span>
                                &nbsp;|&nbsp;
                                <span className="bg-yellow-100
text-yellow-800 text-xs px-2 py-1 rounded-full">
                                  {report.reportType.replace('_', ' ')}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
                {pendingUserReports.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="size-5 rounded-full bg-neutral-400
text-white text-xs flex items-center justify-center font-medium">
                      {pendingUserReports.length}
                    </div>
                    <span className="grid">
                      <motion.span
                        className="text-sm font-medium
text-neutral-600 dark:text-neutral-300 row-start-1 col-start-1"
                        variants={notificationTextVariants}
                        transition={textSwitchTransition}
                      >
                        Advertiser Reports
                      </motion.span>
                      <motion.a
                        href="/admin/reports?tab=user&status=pending"
                        className="text-sm font-medium
text-neutral-600 dark:text-neutral-300 flex items-center gap-1
cursor-pointer select-none row-start-1 col-start-1"
                        variants={viewAllTextVariants}
                        transition={textSwitchTransition}
                      >
                        View all <ArrowUpRight className="size-4" />
                      </motion.a>
                    </span>
                  </div>
                )}
              </motion.div>
            </div>

            {/* Right part - Pending Driver Reports */}
            <div className="min-h-0">
              <motion.div
                className="bg-white dark:bg-neutral-900 p-1.5
rounded-xl w-full h-auto space-y-1.5 shadow-md flex flex-col"
                initial="collapsed"
                whileHover="expanded"
              >
                <div className="flex-1 overflow-hidden min-h-0">
                  {pendingDriverReports.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <FileText className="w-8 h-8 mx-auto text-gray-300" />
                      <p>No pending reports found</p>
                    </div>
                  ) : (
                    pendingDriverReports.slice(0, 3).map((report: any,
i: number) => (
                      <motion.div
                        key={report.id}
                        className="bg-gray-100 dark:bg-neutral-800
rounded-xl px-3 py-1.5 shadow-sm hover:shadow-lg transition-shadow
duration-200 relative h-14"
                        variants={getCardVariants(i)}
                        transition={transition}
                        style={{ zIndex: Math.min(3,
pendingDriverReports.length) - i }}
                      >
                        <div className="flex items-center
justify-between h-full">
                          <div className="flex items-start gap-3">
                            <Car className="w-5 h-5 text-green-500" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h1 className="text-sm font-medium
truncate">{report.title}</h1>
                                <div className="w-2 h-2 bg-yellow-500
rounded-full flex-shrink-0"></div>
                              </div>
                              <div className="text-xs text-neutral-500
font-medium truncate">
                                <span>{new
Date(report.createdAt).toLocaleDateString()}</span>
                                &nbsp;•&nbsp;
                                <span>
                                  {report.driver ?
`${report.driver.firstName} ${report.driver.lastName}` : 'Unknown Driver'}
                                </span>
                                &nbsp;|&nbsp;
                                <span className="bg-yellow-100
text-yellow-800 text-xs px-2 py-1 rounded-full">
                                  {report.reportType.replace('_', ' ')}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
                {pendingDriverReports.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="size-5 rounded-full bg-neutral-400
text-white text-xs flex items-center justify-center font-medium">
                      {pendingDriverReports.length}
                    </div>
                    <span className="grid">
                      <motion.span
                        className="text-sm font-medium
text-neutral-600 dark:text-neutral-300 row-start-1 col-start-1"
                        variants={notificationTextVariants}
                        transition={textSwitchTransition}
                      >
                        Driver Reports
                      </motion.span>
                      <motion.a
                        href="/admin/reports?tab=driver&status=pending"
                        className="text-sm font-medium
text-neutral-600 dark:text-neutral-300 flex items-center gap-1
cursor-pointer select-none row-start-1 col-start-1"
                        variants={viewAllTextVariants}
                        transition={textSwitchTransition}
                      >
                        View all <ArrowUpRight className="size-4" />
                      </motion.a>
                    </span>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;