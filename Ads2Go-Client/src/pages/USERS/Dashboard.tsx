import React, { useState, useEffect, useRef, ChangeEvent, useMemo, useCallback, Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { GET_USER_ANALYTICS } from '../../graphql/user/queries/getUserAnalytics';
import { motion, Transition, AnimatePresence } from 'framer-motion';
import { RotateCcw, ArrowUpRight, ChevronDown, Monitor, Play, Activity, Calendar as CalendarIcon } from 'lucide-react';
import playbackWebSocketService from '../../services/playbackWebSocketService';
import RealtimeMetrics from '../../components/RealtimeMetrics';
import { useNotifications } from '../../contexts/NotificationContext';
import { formatDistanceToNow } from 'date-fns';
import { GET_MY_ADS } from '../../graphql/user/queries/getMyAds';
import AdProgressBar from '../../components/AdProgressBar';
import CalendarWidget from '../../components/CalendarWidget';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { getPhilippinesDateString } from '../../utils/dateUtils';

// ✅ PERFORMANCE OPTIMIZATION: Persistent cache for Dashboard analytics (same as Detailed Analytics)
const DASHBOARD_CACHE_KEY = 'dashboard-analytics-cache-v2'; // 🔥 FIX: Changed key to invalidate old 5-minute cache entries
const CACHE_TTL = 30 * 1000; // ⚡ REAL-TIME FIX: Reduced from 5 minutes to 30 seconds for faster updates (matches DetailedAnalytics)
const MAX_CACHE_SIZE = 20; // Limit cache to 20 entries

interface CacheEntry {
  data: any;
  timestamp: number;
  lastAccessed: number;
}

interface CacheStore {
  [key: string]: CacheEntry;
}

// ✅ PERSISTENT CACHE: Load cache from localStorage on module load
const loadPersistentCache = (): Map<string, CacheEntry> => {
  try {
    const cached = localStorage.getItem(DASHBOARD_CACHE_KEY);
    if (!cached) return new Map();
    
    const parsed: CacheStore = JSON.parse(cached);
    const now = Date.now();
    const cache = new Map<string, CacheEntry>();
    
    // Only load non-expired entries
    for (const [key, entry] of Object.entries(parsed)) {
      if (now - entry.timestamp < CACHE_TTL) {
        cache.set(key, entry);
      }
    }
    
    if (cache.size > 0) {
      console.log(`📦 [Dashboard] Loaded ${cache.size} cached entries from localStorage`);
    }
    
    return cache;
  } catch (error) {
    console.warn('⚠️ [Dashboard] Failed to load persistent cache:', error);
    return new Map();
  }
};

// ✅ PERSISTENT CACHE: Save cache to localStorage
const savePersistentCache = (cache: Map<string, CacheEntry>) => {
  try {
    const now = Date.now();
    const store: CacheStore = {};
    
    // Only save non-expired entries
    const entries = Array.from(cache.entries());
    for (const [key, entry] of entries) {
      if (now - entry.timestamp < CACHE_TTL) {
        store[key] = entry;
      }
    }
    
    localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(store));
  } catch (error) {
    // Handle quota exceeded error gracefully
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      console.warn('⚠️ [Dashboard] localStorage quota exceeded, clearing old cache entries');
      try {
        localStorage.removeItem(DASHBOARD_CACHE_KEY);
        const entries = Array.from(cache.entries());
        entries.sort((a, b) => b[1].lastAccessed - a[1].lastAccessed);
        const limitedStore: CacheStore = {};
        for (let i = 0; i < Math.min(10, entries.length); i++) {
          limitedStore[entries[i][0]] = entries[i][1];
        }
        localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(limitedStore));
      } catch (retryError) {
        console.warn('⚠️ [Dashboard] Failed to save cache even after clearing:', retryError);
      }
    } else {
      console.warn('⚠️ [Dashboard] Failed to save persistent cache:', error);
    }
  }
};

// ✅ PERSISTENT CACHE: Clear cache function (can be called on logout or manual refresh)
export const clearDashboardCache = () => {
  try {
    localStorage.removeItem(DASHBOARD_CACHE_KEY);
    console.log('🗑️ [Dashboard] Cleared persistent cache');
  } catch (error) {
    console.warn('⚠️ [Dashboard] Failed to clear persistent cache:', error);
  }
};

// ✅ PERFORMANCE OPTIMIZATION: Lazy load heavy components
// Recharts is ~200KB - only load when charts are actually rendered
const AnalyticsChart = lazy(() => import('../../components/lazy/AnalyticsChart'));

// Map components are heavy (~300KB) - only load when map tab is active
const UserMaterialsMap = lazy(() => import('../../components/UserMaterialsMap'));
const MultiMaterialRouteMap = lazy(() => import('../../components/MultiMaterialRouteMap'));

// Loading component for lazy-loaded components
const ChartLoader = () => (
  <div className="flex items-center justify-center h-[210px]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3674B5]"></div>
  </div>
);

const MapLoader = () => (
  <div className="flex items-center justify-center h-full bg-gray-100 rounded-lg">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3674B5] mx-auto mb-4"></div>
      <p className="text-gray-600">Loading map...</p>
    </div>
  </div>
);

// NotificationList Component
const transition: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 26,
};

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

const textSwitchTransition: Transition = {
  duration: 0.22,
  ease: 'easeInOut',
};

const notificationTextVariants = {
  collapsed: { opacity: 1, y: 0, pointerEvents: 'auto' as const },
  expanded: { opacity: 0, y: -16, pointerEvents: 'none' as const },
};

const viewAllTextVariants = {
  collapsed: { opacity: 0, y: 16, pointerEvents: 'none' as const },
  expanded: { opacity: 1, y: 0, pointerEvents: 'auto' as const },
};

function NotificationList() {
  const { notifications: allNotifications } = useNotifications();
  
  // Get the last 3 recent notifications
  const recentNotifications = allNotifications.slice(0, 3);

  const formatTime = (createdAt: string) => {
    try {
      const date = new Date(createdAt);
      return isNaN(date.getTime()) ? 'Unknown time' : formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      return 'Unknown time';
    }
  };

  return (
    <motion.div
      className="bg-white/70 dark:bg-neutral-900/80 backdrop-blur-md p-3 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-white/20"
      initial="collapsed"
      whileHover="expanded"
    >
      <div>
        {recentNotifications.length === 0 ? (
          <div className="bg-white dark:bg-neutral-800/80 px-4 py-3 shadow-sm rounded-md text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">No notifications yet</p>
          </div>
        ) : (
          recentNotifications.map((notification, i) => (
            <motion.div
              key={notification.id}
              className="bg-white dark:bg-neutral-800/80 px-4 py-2 shadow-sm rounded-md hover:shadow-md transition-shadow duration-200 relative"
              variants={getCardVariants(i)}
              transition={transition}
              style={{
                zIndex: recentNotifications.length - i,
              }}
            >
              <div className="flex justify-between items-center">
                <h1 className="text-sm font-medium text-gray-800 dark:text-gray-200">{notification.title}</h1>
                {!notification.read && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                )}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                <span>{formatTime(notification.createdAt)}</span>
                &nbsp;•&nbsp;
                <span>{notification.message}</span>
              </div>
            </motion.div>
          ))
        )}
      </div>
      <div className="flex items-center gap-2 mt-3">
        <div className="size-5 rounded-full bg-gray-400 dark:bg-gray-600 text-white text-xs flex items-center justify-center font-medium">
          {allNotifications.length}
        </div>

        {/* Animated label */}
        <div className="relative h-5 flex items-center">
          {/* 'Notifications' text */}
          <motion.span
            className="absolute inset-0 flex items-center text-sm font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap"
            variants={notificationTextVariants}
            transition={textSwitchTransition}
          >
            Notifications
          </motion.span>

          {/* 'View all' link */}
          <Link to="/notifications" className="absolute inset-0 flex items-center whitespace-nowrap">
            <motion.span
              className="text-sm font-medium text-gray-600 hover:text-black/80 dark:text-gray-300 flex items-center gap-1 cursor-pointer select-none"
              variants={viewAllTextVariants}
              transition={textSwitchTransition}
            >
              View all <ArrowUpRight className="size-4 flex-shrink-0" />
            </motion.span>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

// Dashboard Component
const Dashboard = () => {
  const { user } = useUserAuth();
  const [selectedOption, setSelectedOption] = useState('Drivers');
  const [selectedPeriod, setSelectedPeriod] = useState<'Monthly' | 'Weekly' | 'Daily'>('Monthly');
  const [qrSelectedPeriod, setQrSelectedPeriod] = useState<'Weekly' | 'Daily' | 'Monthly'>('Daily');
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'1d' | '7d' | '30d'>('7d');
  const [selectedAdId, setSelectedAdId] = useState<string | null>(null);
  const [displayRevenue, setDisplayRevenue] = useState(0);
  const [displayExpenses, setDisplayExpenses] = useState(0);
  const [displayProfit, setDisplayProfit] = useState(0);
  const [displayPeriodLabel, setDisplayPeriodLabel] = useState('');
  const [userFirstName, setUserFirstName] = useState('User');
  const [showQrPeriodDropdown, setShowQrPeriodDropdown] = useState(false);
  const [showQrAdDropdown, setShowQrAdDropdown] = useState(false);
  const [showAnalyticsPeriodDropdown, setShowAnalyticsPeriodDropdown] = useState(false);

  // ✅ PERFORMANCE OPTIMIZATION: Direct API data state (replaces GraphQL)
  const [periodAnalyticsData, setPeriodAnalyticsData] = useState<any>(null);
  const [overallAnalyticsData, setOverallAnalyticsData] = useState<any>(null);
  const [periodAnalyticsLoading, setPeriodAnalyticsLoading] = useState(false);
  const [overallAnalyticsLoading, setOverallAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<any>(null);
  
  // ✅ PERSISTENT CACHE: Initialize cache from localStorage on mount
  const analyticsCacheRef = useRef<Map<string, CacheEntry>>(loadPersistentCache());
  
  // Refs for request management
  const periodFetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const overallFetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isRequestInProgressRef = useRef<boolean>(false);

  // Map tab states
  const [mapActiveTab, setMapActiveTab] = useState<'today' | 'history'>('today');
  const [selectedAdForRoute, setSelectedAdForRoute] = useState<string | null>(null);
  // ✅ FIX: Use Philippines timezone for date formatting to match backend
  const [selectedRouteDate, setSelectedRouteDate] = useState(getPhilippinesDateString());
  const [selectedRouteDateObj, setSelectedRouteDateObj] = useState<Date | null>(new Date());
  const [showAdDropdown, setShowAdDropdown] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  
  // ✅ REAL-TIME UPDATE: Track last analytics refresh to prevent too many rapid refreshes
  const lastAnalyticsRefreshRef = useRef<number>(0);
  const analyticsRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // ✅ FIX: Helper function to generate cache key - MUST include userId to prevent cross-user data leakage
  const getCacheKey = useCallback((period: string, adId: string | null, type: 'period' | 'overall') => {
    const userId = user?.userId || 'unknown';
    return `dashboard_${userId}_${type}_${period}_${adId || 'all'}`;
  }, [user?.userId]);
  
  // ✅ PERFORMANCE OPTIMIZATION: Manage cache (clean expired entries, enforce size limit)
  const manageCache = useCallback(() => {
    const cache = analyticsCacheRef.current;
    const now = Date.now();
    
    // Remove expired entries
    const entries = Array.from(cache.entries());
    for (const [key, entry] of entries) {
      if (now - entry.timestamp > CACHE_TTL) {
        cache.delete(key);
      }
    }
    
    // If still over limit, remove least recently used entries (LRU)
    if (cache.size > MAX_CACHE_SIZE) {
      const remainingEntries = Array.from(cache.entries());
      remainingEntries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
      
      const toRemove = cache.size - MAX_CACHE_SIZE;
      for (let i = 0; i < toRemove; i++) {
        cache.delete(remainingEntries[i][0]);
      }
    }
    
    // Save to localStorage
    savePersistentCache(cache);
  }, []);

  // ✅ FIX: Clear cache when user changes to prevent showing data from previous user
  const previousUserIdRef = useRef<string | undefined>(user?.userId);
  useEffect(() => {
    const currentUserId = user?.userId;
    const previousUserId = previousUserIdRef.current;
    
    // If user changed (and we had a previous user), clear all cache entries
    if (previousUserId && currentUserId && previousUserId !== currentUserId) {
      console.log('🔄 [Dashboard] User changed - clearing analytics cache');
      analyticsCacheRef.current.clear();
      savePersistentCache(analyticsCacheRef.current);
      
      // Reset analytics data to prevent stale data display
      setPeriodAnalyticsData(null);
      setOverallAnalyticsData(null);
    }
    
    // Update the ref for next comparison
    previousUserIdRef.current = currentUserId;
  }, [user?.userId]);
  
  // ✅ PERFORMANCE OPTIMIZATION: Fetch period-filtered analytics via direct API
  const fetchPeriodAnalytics = useCallback(async (silent: boolean = false) => {
    if (!user?.userId) return;
    
    const cacheKey = getCacheKey(analyticsPeriod, selectedAdId, 'period');
    const cache = analyticsCacheRef.current;
    const cached = cache.get(cacheKey);
    const now = Date.now();
    
    // Check cache first
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      cached.lastAccessed = now;
      savePersistentCache(cache);
      console.log('⚡ [Dashboard] Using cached period analytics:', cacheKey);
      setPeriodAnalyticsData(cached.data);
      setPeriodAnalyticsLoading(false);
      return;
    }
    
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (periodFetchTimeoutRef.current) {
      clearTimeout(periodFetchTimeoutRef.current);
    }
    
    // Debounce rapid changes
    periodFetchTimeoutRef.current = setTimeout(async () => {
      if (isRequestInProgressRef.current) {
        console.log('⏸️ [Dashboard] Request already in progress, skipping');
        return;
      }
      
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      isRequestInProgressRef.current = true;
      
      try {
        if (!silent) {
          setPeriodAnalyticsLoading(true);
        }
        
        const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace('/graphql', '').replace(/\/$/, '');
        const queryParams = new URLSearchParams();
        
        // 🔥 FIX: For "TODAY" (1d), use specific date instead of period for correct timezone handling
        if (analyticsPeriod === '1d') {
          // Use Philippines "today" (aligned with backend)
          const today = getPhilippinesDateString();
          queryParams.append('startDate', today);
          queryParams.append('endDate', today);
          console.log('🔥 [Dashboard TODAY FIX] Using date range for TODAY (PH timezone):', today);
        } else {
          queryParams.append('period', analyticsPeriod);
        }
        
        if (selectedAdId) {
          queryParams.append('adId', selectedAdId);
        }
        
        const url = `${baseUrl}/analytics/user/${user.userId}/direct-v2?${queryParams.toString()}`;
        console.log('📡 [Dashboard] Fetching period analytics (V2):', url);
        
        const response = await fetch(url, {
          signal: abortController.signal
        });
        
        if (abortController.signal.aborted) {
          console.log('🚫 [Dashboard] Period analytics request aborted');
          return;
        }
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.data) {
          // Format data to match GraphQL structure for compatibility
          const formattedData = {
            getUserAnalytics: result.data
          };
          
          setPeriodAnalyticsData(formattedData);
          setAnalyticsError(null);
          
          // Cache the result
          cache.set(cacheKey, {
            data: formattedData,
            timestamp: now,
            lastAccessed: now
          });
          manageCache();
          
          console.log('✅ [Dashboard] Period analytics fetched successfully');
        } else {
          throw new Error(result.message || 'Failed to fetch analytics');
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log('🚫 [Dashboard] Period analytics request aborted');
          return;
        }
        console.error('❌ [Dashboard] Error fetching period analytics:', error);
        setAnalyticsError(error);
      } finally {
        setPeriodAnalyticsLoading(false);
        isRequestInProgressRef.current = false;
        abortControllerRef.current = null;
      }
    }, silent ? 300 : 400);
  }, [user?.userId, analyticsPeriod, selectedAdId, getCacheKey, manageCache]);
  
  // ✅ PERFORMANCE OPTIMIZATION: Fetch overall analytics via direct API
  const fetchOverallAnalytics = useCallback(async (silent: boolean = false) => {
    if (!user?.userId) return;
    
    const cacheKey = getCacheKey('all', null, 'overall');
    const cache = analyticsCacheRef.current;
    const cached = cache.get(cacheKey);
    const now = Date.now();
    
    // Check cache first
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      cached.lastAccessed = now;
      savePersistentCache(cache);
      console.log('⚡ [Dashboard] Using cached overall analytics:', cacheKey);
      setOverallAnalyticsData(cached.data);
      setOverallAnalyticsLoading(false);
      return;
    }
    
    // Cancel previous request
    if (overallFetchTimeoutRef.current) {
      clearTimeout(overallFetchTimeoutRef.current);
    }
    
    // Debounce rapid changes
    overallFetchTimeoutRef.current = setTimeout(async () => {
      try {
        if (!silent) {
          setOverallAnalyticsLoading(true);
        }
        
        const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace('/graphql', '').replace(/\/$/, '');
        const queryParams = new URLSearchParams();
        queryParams.append('period', 'all');
        
        const url = `${baseUrl}/analytics/user/${user.userId}/direct-v2?${queryParams.toString()}`;
        console.log('📡 [Dashboard] Fetching overall analytics (V2):', url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.data) {
          // Format data to match GraphQL structure for compatibility
          const formattedData = {
            getUserAnalytics: result.data
          };
          
          setOverallAnalyticsData(formattedData);
          
          // Cache the result
          cache.set(cacheKey, {
            data: formattedData,
            timestamp: now,
            lastAccessed: now
          });
          manageCache();
          
          console.log('✅ [Dashboard] Overall analytics fetched successfully');
        } else {
          throw new Error(result.message || 'Failed to fetch analytics');
        }
      } catch (error: any) {
        console.error('❌ [Dashboard] Error fetching overall analytics:', error);
      } finally {
        setOverallAnalyticsLoading(false);
      }
    }, silent ? 300 : 400);
  }, [user?.userId, getCacheKey, manageCache]);
  
  // ✅ Use Philippines "today" so route date comparison matches backend
  const shouldDisableAutoRefresh = useMemo(() => {
    const today = getPhilippinesDateString();
    const isToday = selectedRouteDate === today;
    return !isToday; // Disable auto-refresh only for past dates
  }, [selectedRouteDate]);

  // Currently playing ads state
  interface CurrentlyPlayingAd {
    adId: string;
    adTitle: string;
    materialId: string;
    deviceId: string;
    slotNumber: 1 | 2;
    duration: number;
    currentTime: number;
    progress: number;
    state: 'playing' | 'paused' | 'buffering' | 'loading' | 'ended';
    startTime: string;
    isUserAd: boolean; // true if this is the user's ad, false if other user's ad
    lastUpdate: number; // timestamp of last update
  }
  
  const [currentlyPlayingAds, setCurrentlyPlayingAds] = useState<Map<string, CurrentlyPlayingAd>>(new Map());

  // ✅ PERFORMANCE OPTIMIZATION: Stagger query loading to reduce initial blocking
  // Priority 1: Load user ads first (needed for route selection, lightweight)
  const { data: myAdsData } = useQuery(GET_MY_ADS, {
    fetchPolicy: 'cache-first',
    nextFetchPolicy: 'cache-first',
    errorPolicy: 'all',
  });

  // ✅ PERFORMANCE OPTIMIZATION: Initial fetch on mount and when dependencies change
  useEffect(() => {
    if (user?.userId && myAdsData) {
      // Fetch both analytics on mount
      fetchPeriodAnalytics(false);
      fetchOverallAnalytics(false);
    }
  }, [user?.userId, myAdsData]); // Only fetch once on mount or when user changes

  // ✅ PERFORMANCE OPTIMIZATION: Refetch period analytics when period or adId changes
  useEffect(() => {
    if (user?.userId && myAdsData) {
      fetchPeriodAnalytics(false);
    }
  }, [analyticsPeriod, selectedAdId, user?.userId, myAdsData]);

  // ✅ PERFORMANCE OPTIMIZATION: Polling for background refresh (every 2 minutes)
  useEffect(() => {
    if (!user?.userId || !myAdsData) return;
    
    const pollInterval = setInterval(() => {
      console.log('🔄 [Dashboard] Background refresh triggered');
      fetchPeriodAnalytics(true); // Silent refresh
      fetchOverallAnalytics(true); // Silent refresh
    }, 120000); // 2 minutes
    
    return () => {
      clearInterval(pollInterval);
      // Cleanup timeouts on unmount
      if (periodFetchTimeoutRef.current) {
        clearTimeout(periodFetchTimeoutRef.current);
      }
      if (overallFetchTimeoutRef.current) {
        clearTimeout(overallFetchTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [user?.userId, myAdsData, fetchPeriodAnalytics, fetchOverallAnalytics]);

  // Handle analytics errors
  useEffect(() => {
    if (analyticsError && 
        analyticsError.message !== 'Failed to fetch analytics data' &&
        analyticsError.message !== 'signal timed out') {
      console.error('Analytics fetch error:', analyticsError);
    }
  }, [analyticsError]);

  // Get user's first name from localStorage on component mount
  useEffect(() => {
    const fetchUserData = () => {
      try {
        const userData = localStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          const firstName = user.firstName || user.first_name || user.name?.split(' ')[0] || user.displayName?.split(' ')[0];
          if (firstName) {
            setUserFirstName(firstName);
            return;
          }
        }
        const sessionUserData = sessionStorage.getItem('user');
        if (sessionUserData) {
          const user = JSON.parse(sessionUserData);
          const firstName = user.firstName || user.first_name || user.name?.split(' ')[0] || user.displayName?.split(' ')[0];
          if (firstName) {
            setUserFirstName(firstName);
            return;
          }
        }
        const authData = localStorage.getItem('authData') || localStorage.getItem('currentUser') || localStorage.getItem('userInfo');
        if (authData) {
          const user = JSON.parse(authData);
          const firstName = user.firstName || user.first_name || user.name?.split(' ')[0] || user.displayName?.split(' ')[0];
          if (firstName) {
            setUserFirstName(firstName);
            return;
          }
        }
      } catch (error) {
        console.error('Error parsing user data from storage:', error);
      }
    };

    fetchUserData();
    const interval = setInterval(fetchUserData, 1000);
    setTimeout(() => clearInterval(interval), 5000);
    return () => clearInterval(interval);
  }, []);

  // Build user's ad IDs and material IDs for filtering WebSocket updates
  const userAdIds = React.useMemo(() => {
    if (!myAdsData?.getMyAds) return new Set<string>();
    const adIds = new Set<string>();
    myAdsData.getMyAds.forEach((ad: any) => {
      if (ad.id) {
        adIds.add(ad.id);
      }
    });
    return adIds;
  }, [myAdsData]);

  const userMaterialIds = React.useMemo(() => {
    if (!myAdsData?.getMyAds) return new Set<string>();
    const materialIds = new Set<string>();
    myAdsData.getMyAds.forEach((ad: any) => {
      if (ad.materialId && Array.isArray(ad.materialId)) {
        ad.materialId.forEach((material: any) => {
          if (material?.materialId) {
            materialIds.add(material.materialId);
          }
        });
      }
    });
    return materialIds;
  }, [myAdsData]);

  // ✅ REAL-TIME UPDATE: Debounced function to refresh analytics when ad plays occur
  // This ensures QR scans and ad play counts update quickly when new data arrives
  const triggerAnalyticsRefresh = useCallback(() => {
    const now = Date.now();
    const timeSinceLastRefresh = now - lastAnalyticsRefreshRef.current;
    const MIN_REFRESH_INTERVAL = 30000; // 30 seconds minimum between refreshes
    
    // Clear any pending refresh
    if (analyticsRefreshTimeoutRef.current) {
      clearTimeout(analyticsRefreshTimeoutRef.current);
    }
    
    // If enough time has passed, refresh immediately
    if (timeSinceLastRefresh >= MIN_REFRESH_INTERVAL) {
      lastAnalyticsRefreshRef.current = now;
      // Refresh both analytics queries silently (background update)
      fetchOverallAnalytics(true).catch(err => {
        console.warn('Failed to refresh overall analytics:', err);
      });
      fetchPeriodAnalytics(true).catch(err => {
        console.warn('Failed to refresh period analytics:', err);
      });
    } else {
      // Schedule refresh after minimum interval
      const delay = MIN_REFRESH_INTERVAL - timeSinceLastRefresh;
      analyticsRefreshTimeoutRef.current = setTimeout(() => {
        lastAnalyticsRefreshRef.current = Date.now();
        fetchOverallAnalytics(true).catch(err => {
          console.warn('Failed to refresh overall analytics:', err);
        });
        fetchPeriodAnalytics(true).catch(err => {
          console.warn('Failed to refresh period analytics:', err);
        });
      }, delay);
    }
  }, [fetchOverallAnalytics, fetchPeriodAnalytics]);

  // WebSocket subscription for real-time ad playback updates
  useEffect(() => {
    if (!playbackWebSocketService) return;

    const unsubscribe = playbackWebSocketService.subscribe((update: any) => {
      // Only process adPlaybackUpdate and displayData updates
      const updateType = update.type;
      if (updateType === 'adPlaybackUpdate' || updateType === 'displayData') {
        // Extract materialId and slotNumber from update
        // For adPlaybackUpdate, materialId and slotNumber are now included in the update
        // For displayData, materialId is in the update data
        const materialId = update.materialId || null;
        const slotNumber = update.slotNumber || (updateType === 'displayData' ? update.sourceSlot : 1); // Default to slot 1 if not specified
        const deviceId = update.deviceId;
        
        // Skip if we don't have materialId (can't properly track)
        if (!materialId) {
          return;
        }
        
        // Create unique key for this device+slot combination
        const key = `${materialId}-slot${slotNumber}`;
        
        // Check if this is the user's ad
        const isUserAd = update.adId ? userAdIds.has(update.adId) : false;
        
        // Check if this device/material belongs to the user
        const isUserDevice = materialId ? userMaterialIds.has(materialId) : false;
        
        // Only process if it's the user's ad OR if it's on the user's device (but not user's ad)
        if (isUserAd || isUserDevice) {
          // ✅ REAL-TIME UPDATE: Trigger analytics refresh when ad plays end or start
          // This ensures QR scans and ad play counts update quickly when new data arrives
          if (updateType === 'adPlaybackUpdate') {
            const adState = update.state || 'playing';
            // Refresh analytics when ad ends (when play count increments) or starts (new play)
            if (adState === 'ended' || adState === 'playing') {
              triggerAnalyticsRefresh();
            }
          } else if (updateType === 'displayData' && update.data?.adDetails) {
            // New ad started via displayData
            triggerAnalyticsRefresh();
          }
          
          setCurrentlyPlayingAds(prev => {
            const newMap = new Map(prev);
            
            if (updateType === 'adPlaybackUpdate') {
              // Handle adPlaybackUpdate
              const adData: CurrentlyPlayingAd = {
                adId: update.adId || '',
                adTitle: update.adTitle || 'Unknown Ad',
                materialId: materialId || '',
                deviceId: deviceId || '',
                slotNumber: slotNumber as 1 | 2,
                duration: update.duration || 0,
                currentTime: update.currentTime || 0,
                progress: update.progress || 0,
                state: (update.state || 'playing') as 'playing' | 'paused' | 'buffering' | 'loading' | 'ended',
                startTime: update.startTime || update.timestamp || new Date().toISOString(),
                isUserAd: isUserAd,
                lastUpdate: Date.now()
              };
              
              newMap.set(key, adData);
            } else if (updateType === 'displayData') {
              // Handle displayData (similar to admin client)
              const displayData = update.data;
              const adDetails = displayData?.adDetails;
              
              if (adDetails) {
                // New ad started
                const adData: CurrentlyPlayingAd = {
                  adId: adDetails.adId || '',
                  adTitle: adDetails.adTitle || 'Unknown Ad',
                  materialId: materialId || '',
                  deviceId: deviceId || '',
                  slotNumber: slotNumber as 1 | 2,
                  duration: adDetails.adDuration || 0,
                  currentTime: displayData.currentTime || 0,
                  progress: displayData.currentTime && adDetails.adDuration
                    ? (displayData.currentTime / adDetails.adDuration) * 100
                    : 0,
                  state: displayData.isPaused ? 'paused' : 'playing',
                  startTime: new Date().toISOString(),
                  isUserAd: adDetails.adId ? userAdIds.has(adDetails.adId) : false,
                  lastUpdate: Date.now()
                };
                
                newMap.set(key, adData);
              } else if (displayData?.currentTime !== undefined) {
                // Just update progress/time for existing ad
                const existing = prev.get(key);
                if (existing) {
                  const updated: CurrentlyPlayingAd = {
                    ...existing,
                    currentTime: displayData.currentTime || existing.currentTime,
                    progress: displayData.currentTime && existing.duration
                      ? (displayData.currentTime / existing.duration) * 100
                      : existing.progress,
                    state: displayData.isPaused ? 'paused' : 'playing',
                    lastUpdate: Date.now()
                  };
                  newMap.set(key, updated);
                }
              }
            }
            
            return newMap;
          });
        }
      }
    });

    // Cleanup subscription and timeout on unmount
    return () => {
      unsubscribe();
      if (analyticsRefreshTimeoutRef.current) {
        clearTimeout(analyticsRefreshTimeoutRef.current);
      }
    };
  }, [userAdIds, userMaterialIds, triggerAnalyticsRefresh]);

  // Clean up stale entries (no update in last 10 seconds)
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      setCurrentlyPlayingAds(prev => {
        const newMap = new Map(prev);
        const now = Date.now();
        const staleThreshold = 10000; // 10 seconds
        
        prev.forEach((ad, key) => {
          if (now - ad.lastUpdate > staleThreshold) {
            newMap.delete(key);
          }
        });
        
        return newMap;
      });
    }, 5000); // Check every 5 seconds

    return () => clearInterval(cleanupInterval);
  }, []);

  const barData = [
    { day: 'JAN', profit: 5000, loss: 8000 },
    { day: 'FEB', profit: 3200, loss: 2500 },
    { day: 'MAR', profit: 7000, loss: 6500 },
    { day: 'APR', profit: 6500, loss: 2800 },
    { day: 'MAY', profit: 3500, loss: 3200 },
    { day: 'JUNE', profit: 8500, loss: 3500 },
    { day: 'JULY', profit: 7800, loss: 3000 },
    { day: 'AUG', profit: 9000, loss: 3800 },
    { day: 'SEP', profit: 2000, loss: 4000 },
    { day: 'OCT', profit: 1000, loss: 3600 },
    { day: 'NOV', profit: 600, loss: 8000 },
    { day: 'DEC', profit: 700, loss: 9000 },
  ];

  const weeklyBarData = [
    { day: 'Week 1', profit: 800, loss: 1500 },
    { day: 'Week 2', profit: 1500, loss: 700 },
    { day: 'Week 3', profit: 600, loss: 7000 },
    { day: 'Week 4', profit: 900, loss: 900 },
    { day: 'Week 5', profit: 1200, loss: 700 },
  ];

  const dailyBarData = [
    { day: 'Monday', profit: 300, loss: 100 },
    { day: 'Tuesday', profit: 400, loss: 150 },
    { day: 'Wednesday', profit: 250, loss: 80 },
    { day: 'Thursday', profit: 350, loss: 120 },
    { day: 'Friday', profit: 500, loss: 200 },
    { day: 'Saturday', profit: 600, loss: 250 },
    { day: 'Sunday', profit: 200, loss: 70 },
  ];

  // Get real QR scan data from analytics (use period data, fallback to overall)
  const dailyStats = periodAnalyticsData?.getUserAnalytics?.dailyStats || overallAnalyticsData?.getUserAnalytics?.dailyStats || [];

  // Generate QR chart data based on period
  const generateQrChartData = () => {
    if (dailyStats.length === 0) {
      // Return empty data if no stats available
      return [];
    }

    const now = new Date();
    // Use Philippines "today" so chart dates align with backend dailyStats (PH)
    const todayStr = getPhilippinesDateString(now);
    const today = new Date(todayStr + 'T12:00:00Z');

    switch (qrSelectedPeriod) {
      case 'Daily': {
        // Last 7 days in PH; match backend dailyStats by date string (PH)
        const last7Days: { dateStr: string; label: string }[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          last7Days.push({
            dateStr: getPhilippinesDateString(d),
            label: d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Manila' })
          });
        }
        return last7Days.map(({ dateStr, label }) => {
          const stat = dailyStats.find((s: any) => s.date === dateStr);
          return { name: label, value: stat?.qrScans || 0 };
        });
      }

      case 'Weekly': {
        // Group by weeks (last 4 weeks)
        const weeklyData: { name: string; value: number }[] = [];
        for (let i = 3; i >= 0; i--) {
          const weekStart = new Date(today);
          weekStart.setDate(weekStart.getDate() - (i * 7) - today.getDay());
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);

          const weekScans = dailyStats
            .filter((stat: any) => {
              const statDate = new Date(stat.date);
              return statDate >= weekStart && statDate <= weekEnd;
            })
            .reduce((sum: number, stat: any) => sum + (stat.qrScans || 0), 0);

          weeklyData.push({
            name: `Week ${4 - i}`,
            value: weekScans
          });
        }
        return weeklyData;
      }

      case 'Monthly': {
        // Show previous month's data by weeks
        const monthlyData: { name: string; value: number }[] = [];
        const firstDayOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDayOfPreviousMonth = new Date(firstDayOfCurrentMonth);
        lastDayOfPreviousMonth.setDate(0); // Last day of previous month
        const firstDayOfPreviousMonth = new Date(lastDayOfPreviousMonth.getFullYear(), lastDayOfPreviousMonth.getMonth(), 1);
        
        // Get month name
        const monthName = lastDayOfPreviousMonth.toLocaleString('default', { month: 'short' });
        
        // Split previous month into 4 weeks
        const daysInMonth = lastDayOfPreviousMonth.getDate();
        const weeksInMonth = Math.ceil(daysInMonth / 7);
        
        for (let week = 0; week < weeksInMonth; week++) {
          const weekStart = new Date(firstDayOfPreviousMonth);
          weekStart.setDate(weekStart.getDate() + (week * 7));
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          
          // Don't go past the last day of the month
          if (weekEnd > lastDayOfPreviousMonth) {
            weekEnd.setTime(lastDayOfPreviousMonth.getTime());
          }

          const weekScans = dailyStats
            .filter((stat: any) => {
              const statDate = new Date(stat.date);
              return statDate >= weekStart && statDate <= weekEnd;
            })
            .reduce((sum: number, stat: any) => sum + (stat.qrScans || 0), 0);

          monthlyData.push({
            name: `${monthName} W${week + 1}`,
            value: weekScans
          });
        }
        return monthlyData;
      }

      default:
        return [];
    }
  };

  const qrPeriodOptions = ['Daily', 'Weekly', 'Monthly'];
  const analyticsPeriodOptions = ['Daily', 'Weekly', 'Monthly'];

  const colors = ['#0E2A47', '#1b5087', '#3674B5', '#E78B48', '#FFAB5B', '#D4C9BE', '#EFEEEA'];

  const calculateFinancials = (period: 'Monthly' | 'Weekly' | 'Daily') => {
    let totalProfit = 0;
    let totalLoss = 0;
    let currentData = [];
    let label = '';
    switch (period) {
      case 'Monthly':
        currentData = barData;
        label = 'Annual';
        break;
      case 'Weekly':
        currentData = weeklyBarData;
        label = 'This Week';
        break;
      case 'Daily':
        currentData = dailyBarData;
        label = 'Today';
        break;
      default:
        currentData = barData;
        label = 'Annual';
    }
    currentData.forEach(item => {
      totalProfit += item.profit;
      totalLoss += item.loss;
    });
    setDisplayRevenue(totalProfit);
    setDisplayExpenses(totalLoss);
    setDisplayProfit(totalProfit - totalLoss);
    setDisplayPeriodLabel(label);
  };

  useEffect(() => {
    calculateFinancials(selectedPeriod);
  }, [selectedPeriod]);

  const handlePeriodChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSelectedPeriod(e.target.value as 'Monthly' | 'Weekly' | 'Daily');
  };

  const getChartData = () => {
    switch (selectedPeriod) {
      case 'Monthly':
        return barData;
      case 'Weekly':
        return weeklyBarData;
      case 'Daily':
        return dailyBarData;
      default:
        return barData;
    }
  };

  const getQrChartData = () => {
    return generateQrChartData();
  };

  const handleQrPeriodChange = (period: 'Weekly' | 'Daily' | 'Monthly') => {
    setQrSelectedPeriod(period);
    setShowQrPeriodDropdown(false);
  };

  const handleQrAdChange = (adId: string | null) => {
    setSelectedAdId(adId);
    setShowQrAdDropdown(false);
    // ⚡ No need to manually refetch! Apollo's useQuery automatically refetches when selectedAdId changes
    // This prevents race conditions from duplicate queries
  };

  const handleAnalyticsPeriodChange = (period: '1d' | '7d' | '30d') => {
    setAnalyticsPeriod(period);
    setShowAnalyticsPeriodDropdown(false);
    // Period change will trigger useEffect to refetch data
  };

  // ✅ FIX: Use periodAnalyticsData for summary metrics instead of overallAnalyticsData
  // The period=all endpoint seems to return stale data (21 plays vs 135 plays)
  // Using the period-specific endpoint data ensures we get fresh, accurate data
  const isOverallAnalyticsLoading = periodAnalyticsLoading && !periodAnalyticsData;
  const analyticsSummary = periodAnalyticsData?.getUserAnalytics?.summary || {
    totalAdsPlayed: 0,
    totalDisplayTime: 0,
    averageCompletionRate: 0,
    totalAds: 0,
    activeAds: 0,
    totalQRScans: 0,
  };

  // Get list of user's ads from analytics data
  // Use a ref to keep the last valid ad list (so dropdown doesn't disappear during loading)
  const lastValidAds = useRef<any[]>([]);
  const currentAds = periodAnalyticsData?.getUserAnalytics?.adPerformance || overallAnalyticsData?.getUserAnalytics?.adPerformance || [];
  
  // ✅ Filter out archived/deleted ads - create a set of archived ad IDs from myAdsData
  const archivedAdIds = useMemo(() => {
    const archivedIds = new Set<string>();
    if (myAdsData?.getMyAds) {
      myAdsData.getMyAds.forEach((ad: any) => {
        if (ad.isArchived) {
          archivedIds.add(ad.id?.toString() || '');
        }
      });
    }
    return archivedIds;
  }, [myAdsData]);
  
  // Filter out archived ads from current ads
  const filteredCurrentAds = currentAds.filter((ad: any) => {
    const adId = ad.adId?.toString() || '';
    return !archivedAdIds.has(adId);
  });
  
  // Update ref when we get new data
  if (filteredCurrentAds.length > 0) {
    lastValidAds.current = filteredCurrentAds;
  }
  
  // Always use the last valid ad list (or current if we have it)
  const userAds = filteredCurrentAds.length > 0 ? filteredCurrentAds : lastValidAds.current;
  
  const adOptions = [
    { id: null, title: 'All Ads', qrScans: analyticsSummary?.totalQRScans || 0 },
    ...userAds.map((ad: any) => ({
      id: ad.adId,
      title: ad.adTitle,
      qrScans: ad.totalQRScans || 0
    }))
  ];

  const formatDisplayTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const calculateAverageMileage = () => {
    const totalDistance = analyticsSummary?.totalDistance || 0;
    const totalHours = analyticsSummary?.totalHours || 1;
    const activeCars = analyticsSummary?.activeCars || 1;
    const averageMileage = totalDistance / (totalHours * activeCars);
    return Math.round(averageMileage * 10) / 10;
  };

  // Get user's ads for route selector (only RUNNING ads)
  // Only RUNNING ads have route history, APPROVED ads haven't started yet
  // ✅ Exclude archived/deleted ads
  // ✅ FIX: Don't require materialId since actual devices come from AdsDeployment
  const userAdsForRoute = (myAdsData?.getMyAds || []).filter((ad: any) => 
    ad.status === 'RUNNING' && 
    !ad.isArchived // ✅ Exclude archived/deleted ads
  );

  // ✅ FIX: Fetch CURRENT device assignments from AdsDeployment API (not stale Ad.materialId)
  // This ensures the map shows the actual devices where the ad is currently deployed
  const [currentDeviceIds, setCurrentDeviceIds] = useState<string[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  
  // Fetch current devices when ad selection changes
  useEffect(() => {
    const fetchCurrentDevices = async () => {
      if (!selectedAdForRoute) {
        setCurrentDeviceIds([]);
        return;
      }
      
      setLoadingDevices(true);
      const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace('/graphql', '');
      
      try {
        console.log(`📱 [Dashboard] Fetching current devices for ad ${selectedAdForRoute}`);
        const response = await fetch(`${baseUrl}/analytics/ad/${selectedAdForRoute}/current-devices`);
        const result = await response.json();
        
        if (result.success && result.data?.materialIds) {
          console.log(`📱 [Dashboard] Found ${result.data.materialIds.length} current devices:`, result.data.materialIds);
          setCurrentDeviceIds(result.data.materialIds);
        } else {
          console.log(`⚠️ [Dashboard] No current devices found for ad, falling back to Ad.materialId`);
          // Fallback to Ad.materialId if API returns no results
          const selectedAd = myAdsData?.getMyAds?.find((ad: any) => ad.id === selectedAdForRoute);
          if (selectedAd?.materialId) {
            const fallbackIds = selectedAd.materialId
              .map((material: any) => material?.materialId)
              .filter((id: string) => id);
            setCurrentDeviceIds(fallbackIds);
          } else {
            setCurrentDeviceIds([]);
          }
        }
      } catch (error) {
        console.error(`❌ [Dashboard] Error fetching current devices:`, error);
        // Fallback to Ad.materialId on error
        const selectedAd = myAdsData?.getMyAds?.find((ad: any) => ad.id === selectedAdForRoute);
        if (selectedAd?.materialId) {
          const fallbackIds = selectedAd.materialId
            .map((material: any) => material?.materialId)
            .filter((id: string) => id);
          setCurrentDeviceIds(fallbackIds);
        } else {
          setCurrentDeviceIds([]);
        }
      } finally {
        setLoadingDevices(false);
      }
    };
    
    fetchCurrentDevices();
  }, [selectedAdForRoute, myAdsData?.getMyAds]);
  
  // Use currentDeviceIds (from API) instead of stale ad.materialId
  const selectedMaterialIds = useMemo(() => {
    return currentDeviceIds;
  }, [currentDeviceIds]);

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      if (showCalendar) {
        const target = event.target as Element;
        if (!target.closest('.calendar-container')) {
          setShowCalendar(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCalendar]);

  // Get selected ad's startTime and id for route filtering
  const selectedAdStartTime = useMemo(() => {
    if (!selectedAdForRoute || !myAdsData?.getMyAds) return undefined;
    
    const selectedAd = myAdsData.getMyAds.find((ad: any) => ad.id === selectedAdForRoute);
    // ✅ Exclude archived/deleted ads
    if (!selectedAd || selectedAd.isArchived) return undefined;
    return selectedAd?.startTime || undefined;
  }, [selectedAdForRoute, myAdsData?.getMyAds]);

  // Get selected ad's id to look up actual deployment time (for route filtering)
  const selectedAdIdForRoute = useMemo(() => {
    return selectedAdForRoute || undefined;
  }, [selectedAdForRoute]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background Image */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat blur-sm brightness-90"
        style={{ backgroundImage: "url('/image/bg.jpg')" }}/>
      <div className="fixed inset-0 bg-white/40 backdrop-blur-xl" />
      {/* Content */}
      <div className="relative z-10 min-h-screen bg-transparent lg:pl-72 px-4 sm:px-5 lg:pr-5 py-6 lg:p-10">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 pt-12 lg:pt-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-800">Welcome back, {userFirstName}!</h1>
            <p className="text-gray-500 text-sm">Here's your analytic detail</p>
          </div>
          {/* Refresh Button */}
          <button
            onClick={() => {
              // Clear cache and force refresh
              analyticsCacheRef.current.clear();
              savePersistentCache(analyticsCacheRef.current);
              console.log('🔄 [Dashboard] Manual refresh - cache cleared');
              fetchPeriodAnalytics(false);
              fetchOverallAnalytics(false);
            }}
            disabled={periodAnalyticsLoading || overallAnalyticsLoading}
            className="flex items-center gap-2 px-4 py-2 bg-[#3674B5] text-white rounded-lg hover:bg-[#2a5a94] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
          >
            <RotateCcw className={`w-4 h-4 ${(periodAnalyticsLoading || overallAnalyticsLoading) ? 'animate-spin' : ''}`} />
            <span className="text-sm font-medium">Refresh Data</span>
          </button>
        </div>
        
        {/* No Analytics Data Message */}
        {analyticsError && analyticsError.message === 'Failed to fetch analytics data' && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
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
                  <p className="mt-1">Once you create and deploy ads, your analytics will appear here.</p>
                  <div className="mt-3">
                    <button
                      onClick={() => {
                        // Clear cache before refreshing
                        analyticsCacheRef.current.clear();
                        savePersistentCache(analyticsCacheRef.current);
                        console.log('🗑️ [Dashboard] Manual cache clear triggered');
                        fetchPeriodAnalytics(false);
                        fetchOverallAnalytics(false);
                      }}
                      className="inline-flex items-center px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors"
                    >
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh Data
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Metrics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-3 mb-6">
          {/* Column 1: Ad Performance Overview */}
          <div className="lg:col-span-2">
            <div
              className="relative p-4 sm:p-6 shadow-xl md:col-span-2 text-white
                        bg-[#1b5087]/60 backdrop-blur-md border border-white/20
                        transition-all duration-300"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                <span className="text-base sm:text-lg font-semibold">Ad Performance Overview</span>
                <div className="relative w-28 sm:w-32" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setShowAnalyticsPeriodDropdown(!showAnalyticsPeriodDropdown)}
                    className="flex items-center justify-between w-full text-xs text-black rounded-md pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2"
                  >
                    {analyticsPeriod === '1d' ? 'Daily' : analyticsPeriod === '7d' ? 'Weekly' : 'Monthly'}
                    <ChevronDown
                      size={16}
                      className={`transform transition-transform duration-200 ${showAnalyticsPeriodDropdown ? 'rotate-180' : 'rotate-0'}`}
                    />
                  </button>
                  <AnimatePresence>
                    {showAnalyticsPeriodDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="absolute z-10 top-full mt-2 w-full rounded-md shadow-lg bg-white overflow-hidden"
                      >
                        {analyticsPeriodOptions.map((period) => (
                          <button
                            key={period}
                            onClick={() => handleAnalyticsPeriodChange(period === 'Daily' ? '1d' : period === 'Weekly' ? '7d' : '30d')}
                            className="block w-full text-left px-4 py-2 text-xs ml-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                          >
                            {period}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              <Suspense fallback={<ChartLoader />}>
                <AnalyticsChart data={periodAnalyticsData?.getUserAnalytics?.dailyStats || []} />
              </Suspense>
              {/* Currently Playing Ads - Real-time from WebSocket */}
              <div className="mt-6 mb-4">
                <div className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-white/90">Currently Playing</h4>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                      <span className="text-xs text-white/70">LIVE</span>
                    </div>
                  </div>
                  
                  {Array.from(currentlyPlayingAds.values()).length > 0 ? (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {Array.from(currentlyPlayingAds.values()).map((ad, index) => {
                        const timeRemaining = Math.max(0, ad.duration - ad.currentTime);
                        const formatTime = (seconds: number) => {
                          const mins = Math.floor(seconds / 60);
                          const secs = Math.floor(seconds % 60);
                          return `${mins}:${secs.toString().padStart(2, '0')}`;
                        };
                        
                        return (
                          <div key={`${ad.materialId}-slot${ad.slotNumber}-${index}`} className="bg-white/10 rounded-lg p-3">
                            {ad.isUserAd ? (
                              // User's ad - show full details
                              <>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                                    <div className="w-12 h-8 bg-white/20 flex items-center justify-center rounded flex-shrink-0">
                                      <svg className="w-5 h-5 text-white/70" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M8 5v14l11-7z"/>
                                      </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h5 className="text-sm font-medium text-white truncate">{ad.adTitle}</h5>
                                      <p className="text-xs text-white/60 truncate">
                                        {ad.materialId} • Slot {ad.slotNumber}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right flex-shrink-0 ml-2">
                                    <p className="text-xs text-white/60">Next in</p>
                                    <p className="text-sm font-medium text-white">{Math.floor(timeRemaining)}s</p>
                                  </div>
                                </div>
                                <div className="mt-2">
                                  <AdProgressBar
                                    adDuration={ad.duration}
                                    isPlaying={ad.state === 'playing'}
                                    className="w-full"
                                    startTime={ad.startTime}
                                    realTimeData={{
                                      currentTime: ad.currentTime,
                                      progress: ad.progress,
                                      state: ad.state
                                    }}
                                  />
                                </div>
                              </>
                            ) : (
                              // Other user's ad - show slot status only
                              <>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2 flex-1">
                                    <div className="w-12 h-8 bg-white/10 flex items-center justify-center rounded flex-shrink-0">
                                      <Monitor className="w-4 h-4 text-white/50" />
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-white/70">
                                        {ad.materialId} • Slot {ad.slotNumber}
                                      </p>
                                      <p className="text-xs text-white/50">Playing other ad</p>
                                    </div>
                                  </div>
                                  <div className="text-right flex-shrink-0 ml-2">
                                    <p className="text-xs text-white/60">Next in</p>
                                    <p className="text-sm font-medium text-white/70">{Math.floor(timeRemaining)}s</p>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-white/60">No ads currently playing</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="lg:col-span-2 flex flex-col gap-4 sm:gap-3">
          {/* RealtimeMetrics at the top */}
            <div>
              <RealtimeMetrics />
            </div>
            
            {/* Top Row: QR Scans and Total Ad Played side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-3">
              {/* QR Scans */}
              <div className="bg-white backdrop-blur-md p-4 shadow-lg hover:shadow-xl transition-shadow border border-white/20 flex flex-col">
                {/* Header */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-black text-lg font-semibold">QR Scans</span>
                  {/* ✅ Show loading spinner for period analytics query (now using periodAnalyticsData) */}
                  {isOverallAnalyticsLoading && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#1b5087]"></div>
                  )}
                </div>

                {/* Content */}
                <div className={isOverallAnalyticsLoading ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
                  <p className="text-3xl font-bold text-[#1b5087]">
                    {isOverallAnalyticsLoading ? (
                      <span className="text-gray-400 animate-pulse">...</span>
                    ) : (
                      analyticsSummary.totalQRScans?.toLocaleString() || 0
                    )}
                  </p>
                  <p className="text-xs pt-3 text-gray-500">
                    {analyticsPeriod === '1d' ? 'Last 24h' : analyticsPeriod === '7d' ? 'Last 7 days' : 'Last 30 days'} (all ads)
                  </p>
                </div>

                {/* View Analytics Button */}
                <div className="mt-auto pt-6 flex justify-center items-center">
                  <Link
                    to="/detailed-analytics"
                    className="w-full text-center text-white px-4 py-2 bg-[#3674B5] rounded hover:bg-[#2a5a94] text-xs font-medium transition-all duration-300"
                  >
                    View Analytics →
                  </Link>
                </div>
              </div>

              {/* Total Ad Played */}
              <div className="bg-white backdrop-blur-md p-4 shadow-lg hover:shadow-xl transition-shadow border border-white/20 flex flex-col">
                {/* Header */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-black text-lg font-semibold">Total Ad Played</span>
                  {/* ✅ Show loading spinner for period analytics query (now using periodAnalyticsData) */}
                  {isOverallAnalyticsLoading && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#1b5087]"></div>
                  )}
                </div>

                {/* Content */}
                <div className={isOverallAnalyticsLoading ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
                  <p className="text-3xl font-bold text-[#1b5087]">
                    {isOverallAnalyticsLoading ? (
                      <span className="text-gray-400 animate-pulse">...</span>
                    ) : (
                      analyticsSummary.totalAdsPlayed.toLocaleString()
                    )}
                  </p>
                  <p className="text-xs pt-3 text-gray-500">
                    {analyticsPeriod === '1d' ? 'Last 24h' : analyticsPeriod === '7d' ? 'Last 7 days' : 'Last 30 days'} (all ads)
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Row: Notifications spanning full width */}
            <div>
              <NotificationList />
            </div>
          </div>
        </div>
        {/* Real-Time Material Location Map */}
        <div className="pt-6 lg:pt-10">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Advertisement Locations</h2>
          </div>

          {/* Tab Navigation */}
          <div className="relative z-[9999] backdrop-blur-md flex justify-between items-center mb-1">
            <div className="flex space-x-1 p-1">
              <button
                onClick={() => setMapActiveTab('today')}
                className={`relative flex-1 py-2 px-4 text-sm font-medium transition-all duration-300 group overflow-hidden ${
                  mapActiveTab === 'today'
                    ? 'text-[#3674B5]'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Activity className="w-4 h-4" />
                  <span className="text-md font-medium">Today</span>
                </div>
                
                {/* Animated underline - Left to Right */}
                <div className={`absolute bottom-0 left-0 w-full h-0.5 bg-[#3674B5] transition-all duration-300 ${
                  mapActiveTab === 'today' 
                    ? 'translate-x-0' 
                    : 'translate-x-[-100%] group-hover:translate-x-0'
                }`} />
              </button>
              
              <button
                onClick={() => setMapActiveTab('history')}
                className={`relative flex-1 py-2 px-4 text-sm font-medium transition-all duration-300 group overflow-hidden ${
                  mapActiveTab === 'history'
                    ? 'text-[#3674B5]'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Monitor className="w-4 h-4" />
                  <span className="text-md font-medium">History</span>
                </div>
                
                {/* Animated underline - Left to Right */}
                <div className={`absolute bottom-0 left-0 w-full h-0.5 bg-[#3674B5] transition-all duration-300 ${
                  mapActiveTab === 'history' 
                    ? 'translate-x-0' 
                    : 'translate-x-[-100%] group-hover:translate-x-0'
                }`} />
              </button>
            </div>

            {/* History Tab Controls - On the right side of navigation */}
            {mapActiveTab === 'history' && (
              <div className="relative flex flex-col sm:flex-row gap-2 items-end pr-2 sm:pr-4 z-[10000]">
                {/* Ad Selector */}
                <div className="relative w-40 z-50">
                  <button
                    onClick={() => setShowAdDropdown(!showAdDropdown)}
                    className="relative z-[10001] flex items-center justify-between w-full text-xs text-black rounded-md pl-4 pr-4 py-2.5 shadow-md focus:outline-none bg-white gap-2"
                  >
                    <span className="truncate">
                      {selectedAdForRoute 
                        ? userAdsForRoute.find((ad: any) => ad.id === selectedAdForRoute)?.title || 'Select Ad'
                        : 'Select Ad'}
                    </span>
                    <ChevronDown className={`w-4 h-4 transition-transform flex-shrink-0 ${showAdDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {showAdDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="absolute z-[10002] top-full mt-1 w-full bg-white rounded-md shadow-lg max-h-60 overflow-y-auto border border-gray-200"
                      >
                        {userAdsForRoute.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-gray-500 text-center">
                            No active ads with materials
                          </div>
                        ) : (
                          userAdsForRoute.map((ad: any) => (
                            <button
                              key={ad.id}
                              onClick={() => {
                                setSelectedAdForRoute(ad.id);
                                setShowAdDropdown(false);
                              }}
                              className={`block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 transition-colors duration-150 ${
                                ad.id === selectedAdForRoute ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                              }`}
                            >

                              <div className="font-medium truncate">{ad.title}</div>
                              <div className="text-xs text-gray-500">
                                {ad.materialId?.length || 0} material(s) assigned
                              </div>
                            </button>
                          ))
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Date Picker */}
                <div className="relative min-w-[150px] calendar-container">
                  <button
                    type="button"
                    onClick={() => setShowCalendar(!showCalendar)}
                    className="relative z-[10001] flex items-center justify-between w-full px-3 py-2.5 text-xs bg-white shadow-md rounded-md focus:outline-none gap-2"
                  >
                    <span className={selectedRouteDateObj ? 'text-gray-900' : 'text-gray-400'}>
                      {selectedRouteDateObj 
                        ? selectedRouteDateObj.toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })
                        : 'Select date'}
                    </span>
                    <CalendarIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  </button>
                  {showCalendar && (
                    <div className="absolute z-[10002] mt-2 right-0">
                      <div className="w-[calc(100vw-2rem)] sm:w-72 max-w-xs">
                        <CalendarWidget
                          selectedDate={selectedRouteDateObj}
                          onDateSelect={(date) => {
                            if (date) {
                              setSelectedRouteDateObj(date);
                              // ✅ FIX: Use Philippines timezone to match backend
                              setSelectedRouteDate(getPhilippinesDateString(date));
                            }
                            setShowCalendar(false);
                          }}
                          minDate={new Date(0)} // Allow all past dates
                          showActionButtons={false}
                          className="w-full"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Map Container */}
          <div className="relative overflow-hidden">
            {/* Map Content */}
            <div style={{ height: mapActiveTab === 'history' ? '500px' : '500px' }} className="relative z-0">
              {mapActiveTab === 'today' ? (
                <Suspense fallback={<MapLoader />}>
                  <UserMaterialsMap height="100%" className="rounded-b-lg" />
                </Suspense>
              ) : (
                <div className="h-full w-full relative z-0">
                  {!selectedAdForRoute ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center text-black/70 p-8">
                        <Monitor className="w-14 h-14 mx-auto mb-4" />
                        <h3 className="font-medium text-black/90 mb-2">
                          Select an Advertisement
                        </h3>
                        <p className="text-sm text-black/70">
                          Choose an ad from the dropdown above to view its historical routes
                        </p>
                      </div>
                    </div>
                  ) : loadingDevices ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center p-8">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                        <p className="text-sm text-gray-500">Loading device assignments...</p>
                      </div>
                    </div>
                  ) : selectedMaterialIds.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center p-8">
                        <svg className="w-16 h-16 text-yellow-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <h3 className="text-lg font-medium text-gray-700 mb-2">
                          No Materials Assigned
                        </h3>
                        <p className="text-sm text-gray-500">
                          This ad doesn't have any materials assigned yet
                        </p>
                      </div>
                    </div>
                  ) : (
                    <Suspense fallback={<MapLoader />}>
                      <MultiMaterialRouteMap
                        key={`route-${selectedAdForRoute}-${selectedRouteDate}`}
                        materialIds={selectedMaterialIds}
                        date={selectedRouteDate}
                        className="h-full w-full"
                        style={{ height: '100%', position: 'relative', zIndex: 0 }}
                        snapToRoads={false}
                        disableAutoRefresh={shouldDisableAutoRefresh}
                        adStartTime={selectedAdStartTime}
                        adId={selectedAdIdForRoute}
                      />
                    </Suspense>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;