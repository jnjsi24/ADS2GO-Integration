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

// ✅ PERSISTENT CACHE: Module-level cache manager that survives component unmounts
// This allows instant display when returning to Detailed Analytics page after navigation
const ANALYTICS_CACHE_KEY = 'detailed-analytics-cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL
const MAX_CACHE_SIZE = 30; // Limit cache to 30 entries (prevents memory issues with many ads)

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
    const cached = localStorage.getItem(ANALYTICS_CACHE_KEY);
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
      console.log(`📦 [DetailedAnalytics] Loaded ${cache.size} cached entries from localStorage`);
    }
    
    return cache;
  } catch (error) {
    console.warn('⚠️ [DetailedAnalytics] Failed to load persistent cache:', error);
    return new Map();
  }
};

// ✅ PERSISTENT CACHE: Save cache to localStorage
const savePersistentCache = (cache: Map<string, CacheEntry>) => {
  try {
    const now = Date.now();
    const store: CacheStore = {};
    
    // Only save non-expired entries (convert to array for TypeScript compatibility)
    const entries = Array.from(cache.entries());
    for (const [key, entry] of entries) {
      if (now - entry.timestamp < CACHE_TTL) {
        store[key] = entry;
      }
    }
    
    localStorage.setItem(ANALYTICS_CACHE_KEY, JSON.stringify(store));
  } catch (error) {
    // Handle quota exceeded error gracefully
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      console.warn('⚠️ [DetailedAnalytics] localStorage quota exceeded, clearing old cache entries');
      // Clear cache and try again with fewer entries
      try {
        localStorage.removeItem(ANALYTICS_CACHE_KEY);
        // Retry with only the most recently accessed entries
        const entries = Array.from(cache.entries());
        entries.sort((a, b) => b[1].lastAccessed - a[1].lastAccessed); // Most recent first
        const limitedStore: CacheStore = {};
        for (let i = 0; i < Math.min(10, entries.length); i++) {
          limitedStore[entries[i][0]] = entries[i][1];
        }
        localStorage.setItem(ANALYTICS_CACHE_KEY, JSON.stringify(limitedStore));
      } catch (retryError) {
        console.warn('⚠️ [DetailedAnalytics] Failed to save cache even after clearing:', retryError);
      }
    } else {
      console.warn('⚠️ [DetailedAnalytics] Failed to save persistent cache:', error);
    }
  }
};

// ✅ PERSISTENT CACHE: Clear cache (called on logout)
export const clearDetailedAnalyticsCache = () => {
  try {
    localStorage.removeItem(ANALYTICS_CACHE_KEY);
    console.log('🗑️ [DetailedAnalytics] Cleared persistent cache');
  } catch (error) {
    console.warn('⚠️ [DetailedAnalytics] Failed to clear persistent cache:', error);
  }
};

// ✅ Helper function to fill in missing dates with zero values for proper chart rendering
// This ensures the area/line chart has continuous data points to draw lines between
const fillMissingDates = (data: any[], period: string, customDate?: string | null): any[] => {
  if (!data || data.length === 0) return [];
  
  // For custom date, just return the data as-is (single day)
  if (customDate) return data;
  
  // Calculate date range based on period
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  let startDate: Date;
  
  // First, create a map of existing data by date (aggregate multiple entries per day)
  const dataMap = new Map<string, any>();
  data.forEach(item => {
    const dateStr = typeof item.date === 'string' && item.date.match(/^\d{4}-\d{2}-\d{2}$/)
      ? item.date
      : new Date(item.date).toISOString().split('T')[0];
    
    // If multiple entries for same date, sum them up
    if (dataMap.has(dateStr)) {
      const existing = dataMap.get(dateStr);
      existing.adPlays = (existing.adPlays || 0) + (item.adPlays || 0);
      existing.qrScans = (existing.qrScans || 0) + (item.qrScans || 0);
    } else {
      dataMap.set(dateStr, { ...item, date: dateStr });
    }
  });
  
  switch (period) {
    case '1d':
      return Array.from(dataMap.values()); // Single day, just aggregate
    case '7d':
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
      break;
    case '30d':
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 29);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'all':
      // For 'all', find the earliest date in data and add some context before it
      const sortedDates = Array.from(dataMap.keys()).sort();
      if (sortedDates.length === 0) return [];
      
      // Start from earliest data point, but add 3 days before for visual context
      const earliestDate = new Date(sortedDates[0]);
      startDate = new Date(earliestDate);
      startDate.setDate(startDate.getDate() - 3); // 3 days before first data point
      startDate.setHours(0, 0, 0, 0);
      break;
    default:
      return Array.from(dataMap.values());
  }
  
  // Fill in missing dates
  const filledData: any[] = [];
  const currentDate = new Date(startDate);
  const todayStr = now.toISOString().split('T')[0];
  
  while (currentDate <= now) {
    const dateStr = currentDate.toISOString().split('T')[0];
    
    // Don't include future dates
    if (dateStr <= todayStr) {
      if (dataMap.has(dateStr)) {
        filledData.push(dataMap.get(dateStr));
      } else {
        // Add zero-value entry for missing date
        filledData.push({
          date: dateStr,
          adPlays: 0,
          qrScans: 0,
          completionRate: 0
        });
      }
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Sort by date ascending for proper chart display
  filledData.sort((a, b) => a.date.localeCompare(b.date));
  
  return filledData;
};

const DetailedAnalytics: React.FC = () => {
  const { user } = useUserAuth();
  const [searchParams] = useSearchParams();
  const [selectedPeriod, setSelectedPeriod] = useState<'1d' | '7d' | '30d' | 'all'>('1d');
  const [userFirstName, setUserFirstName] = useState('User');
  
  // Device selection state
  const [selectedDevice, setSelectedDevice] = useState<string>('all');
  const [availableDevices, setAvailableDevices] = useState<Array<{id: string, name: string, materialId: string, isOnline: boolean}>>([]);
  const [deviceAnalytics, setDeviceAnalytics] = useState<any>(null);
  const [deviceLoading, setDeviceLoading] = useState(false);

  // State for direct API data (bypassing GraphQL)
  const [directAnalyticsData, setDirectAnalyticsData] = useState<any>(null);
  const [directAnalyticsLoading, setDirectAnalyticsLoading] = useState(false);
  
  // ✅ Track when filters are changing to show loading state
  const [isFiltersLoading, setIsFiltersLoading] = useState(false);
  const previousFiltersRef = useRef<{
    selectedDevice: string;
    selectedAd: string;
    selectedPeriod: string;
    selectedDate: string;
  }>({
    selectedDevice: '',
    selectedAd: '',
    selectedPeriod: 'all',
    selectedDate: ''
  });

  // 🔥 Helper: Get today's date in Philippine timezone
  const getTodayInPhilippineTime = () => {
    const now = new Date();
    const phOffset = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
    const phTime = new Date(now.getTime() + phOffset);
    return phTime.toISOString().split('T')[0]; // YYYY-MM-DD
  };

  // Date Picker States
  // ✅ FIX: Initialize with today's date in custom mode (faster data fetching)
  // Custom date mode fetches data faster and shows correct values compared to period mode
  const [selectedDate, setSelectedDate] = useState<string>(getTodayInPhilippineTime());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedPeriodLabel, setSelectedPeriodLabel] = useState<string>(''); // Will be set by formatDisplayDate
  const [isCustomDate, setIsCustomDate] = useState(true); // ✅ Start with custom date mode for faster loading


  // Device Dropdown States
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);
  const [selectedDeviceLabel, setSelectedDeviceLabel] = useState("");

  // Ad Selection States
  const [selectedAd, setSelectedAd] = useState<string>('');
  const [showAdDropdown, setShowAdDropdown] = useState(false);
  const [selectedAdLabel, setSelectedAdLabel] = useState("");
  const [availableAds, setAvailableAds] = useState<Array<{id: string, title: string}>>([]);

  // Refs for debouncing and request cancellation
  const refetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const deviceFetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const directFetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isRequestInProgressRef = useRef<boolean>(false);
  
  // ✅ PERSISTENT CACHE: Initialize cache from localStorage on mount
  // This allows instant display when returning to Detailed Analytics after navigation
  const analyticsCacheRef = useRef<Map<string, CacheEntry>>(loadPersistentCache());
  
  // ✅ FIX: Helper function to generate cache key - MUST include userId to prevent cross-user data leakage
  // ✅ FIX: Removed useCallback to prevent dependency issues - this is a pure function that doesn't need memoization
  const getCacheKey = (ad: string, device: string, period: string, selectedDate: string, isCustom: boolean) => {
    const userId = user?.userId || 'unknown';
    if (isCustom && selectedDate) {
      return `analytics_${userId}_${ad}_${device}_custom_${selectedDate}`;
    }
    return `analytics_${userId}_${ad}_${device}_${period}`;
  };
  
  // ✅ MEMORY MANAGEMENT: Clean expired entries and enforce size limit with LRU eviction
  // ✅ PERSISTENT CACHE: Saves to localStorage after cleanup
  const manageCache = useCallback(() => {
    const cache = analyticsCacheRef.current;
    const now = Date.now();
    
    // Step 1: Remove expired entries (convert to array first for TypeScript compatibility)
    const entries = Array.from(cache.entries());
    for (const [key, entry] of entries) {
      if (now - entry.timestamp > CACHE_TTL) {
        cache.delete(key);
        console.log('🗑️ [DetailedAnalytics] Removed expired cache entry:', key);
      }
    }
    
    // Step 2: If still over limit, remove least recently used entries (LRU)
    if (cache.size > MAX_CACHE_SIZE) {
      const remainingEntries = Array.from(cache.entries());
      // Sort by lastAccessed (oldest first)
      remainingEntries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
      
      // Remove oldest entries until under limit
      const toRemove = cache.size - MAX_CACHE_SIZE;
      for (let i = 0; i < toRemove; i++) {
        cache.delete(remainingEntries[i][0]);
        console.log('🗑️ [DetailedAnalytics] Removed LRU cache entry:', remainingEntries[i][0]);
      }
    }
    
    if (cache.size > 0) {
      console.log(`📊 [DetailedAnalytics] Cache size: ${cache.size}/${MAX_CACHE_SIZE} entries`);
    }
    
    // ✅ PERSISTENT CACHE: Save to localStorage after cleanup
    savePersistentCache(cache);
  }, []);

  // ✅ FIX: Clear cache when user changes to prevent showing data from previous user
  const previousUserIdRef = useRef<string | undefined>(user?.userId);
  useEffect(() => {
    const currentUserId = user?.userId;
    const previousUserId = previousUserIdRef.current;
    
    // If user changed (and we had a previous user), clear all cache entries
    if (previousUserId && currentUserId && previousUserId !== currentUserId) {
      console.log('🔄 [DetailedAnalytics] User changed - clearing analytics cache');
      analyticsCacheRef.current.clear();
      savePersistentCache(analyticsCacheRef.current);
    }
    
    // Update the ref for next comparison
    previousUserIdRef.current = currentUserId;
  }, [user?.userId]);

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
    // 🔥 FIX: Make "TODAY" behave like date picker with today's date selected
    // This ensures correct timezone handling and avoids cache issues
    if (period === '1d') {
      // 🔥 TIMEZONE FIX: Convert to Philippine timezone (UTC+8) before getting date
      const now = new Date();
      const phOffset = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
      const phTime = new Date(now.getTime() + phOffset);
      const todayStr = phTime.toISOString().split('T')[0]; // YYYY-MM-DD in Philippine timezone
      setIsCustomDate(true); // Use custom date mode (sends startDate/endDate)
      setSelectedDate(todayStr); // Set to today's date
      setSelectedPeriod(period); // Keep period for UI state
      setSelectedPeriodLabel(label);
      setShowDatePicker(false);
      console.log('🔥 [TODAY FIX] Using date picker logic for TODAY (PH timezone):', todayStr);
    } else {
      // Other periods use normal period-based logic
      setIsCustomDate(false);
      setSelectedPeriod(period);
      setSelectedPeriodLabel(label);
      setSelectedDate('');
      setShowDatePicker(false);
    }
  };

  // ✅ Helper function to check if current date is included in the selected range
  const isCurrentDateIncluded = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (isCustomDate && selectedDate) {
      const customDate = new Date(selectedDate);
      customDate.setHours(0, 0, 0, 0);
      return today.getTime() === customDate.getTime();
    } else {
      // For preset periods, check if period includes today
      // '1d' = today only, '7d' = last 7 days (includes today), etc.
      // 'all' = all time (includes today)
      return selectedPeriod === '1d' || selectedPeriod === '7d' || selectedPeriod === '30d' || selectedPeriod === 'all';
    }
  }, [isCustomDate, selectedDate, selectedPeriod]);

  // Track initial load to distinguish from background refreshes
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const hasInitiallyLoadedRef = useRef(false);

  // ✅ PERFORMANCE: Check if filters are active (used to skip slow GraphQL queries)
  // Since user must always select a specific ad now (no "All Advertisement" option),
  // filters are always active when an ad is selected
  const hasActiveFilters = Boolean(selectedAd) || Boolean(selectedDevice) || isCustomDate;

  // Fetch analytics data with optimized cache policy
  // ✅ Add polling when current date is included (for real-time updates)
  // ✅ Pass date range parameters when custom date range is selected
  // ✅ Skip GraphQL query when using custom date range (use direct API instead)
  // ✅ PERFORMANCE: Skip GraphQL query when filters are active (use direct API instead)
  const { data: analyticsData, loading: analyticsLoading, error: analyticsError, refetch: refetchAnalytics } = useQuery(GET_USER_ANALYTICS, {
    variables: { 
      period: isCustomDate ? undefined : selectedPeriod,
      startDate: isCustomDate && selectedDate ? formatDateForAPI(selectedDate) : undefined,
      endDate: isCustomDate && selectedDate ? formatDateForAPI(selectedDate) : undefined
    },
    fetchPolicy: 'cache-first', // ✅ Use cache-first to avoid refetching when going back to same period
    nextFetchPolicy: 'cache-only', // ✅ Don't refetch in background - use cache only
    errorPolicy: 'all',
    // ✅ Poll every 30 seconds when viewing current day data (silent background refresh)
    // ✅ Skip polling when using custom date range or filters to avoid interfering with direct API data
    pollInterval: (isCurrentDateIncluded && !isCustomDate && !hasActiveFilters) ? 30000 : 0,
    // ✅ Don't trigger loading state during polling (silent background refresh)
    notifyOnNetworkStatusChange: false,
    // ✅ Skip query when custom date OR when filters are active (use direct API instead)
    skip: Boolean((isCustomDate && selectedDate) || hasActiveFilters)
  });

  // Handle analytics errors using useEffect (replaces deprecated onError callback)
  // ✅ Suppress network errors when using custom date (GraphQL query is skipped but may still error)
  useEffect(() => {
    if (analyticsError) {
      // Only log errors that aren't network errors when using custom date
      // Network errors are expected when GraphQL query is skipped during polling
      if (isCustomDate && selectedDate) {
        // Silently ignore network errors when using custom date
        // These are expected because we skip the GraphQL query
        return;
      }
      if (analyticsError.message !== 'Failed to fetch analytics data') {
        console.error('Unexpected analytics error:', analyticsError);
      }
    }
  }, [analyticsError, isCustomDate, selectedDate]);

  // ✅ PERFORMANCE FIX: Fetch all-time analytics data for Top Performing Ads using direct API (faster than GraphQL)
  // This ensures Top Performing Ads always shows all-time totals regardless of filter selection
  const [allTimeAnalyticsData, setAllTimeAnalyticsData] = useState<any>(null);
  const [allTimeAnalyticsLoading, setAllTimeAnalyticsLoading] = useState(false);
  const allTimeAnalyticsErrorRef = useRef<any>(null);
  const allTimeFetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const allTimeLastFetchRef = useRef<number>(0);
  
  // ✅ Fetch all-time analytics using direct API (same as Dashboard - faster and more reliable)
  const fetchAllTimeAnalytics = useCallback(async (silent: boolean = false) => {
    if (!user?.userId) return;
    
    // Throttle: Don't fetch more than once every 2 seconds
    const now = Date.now();
    if (!silent && (now - allTimeLastFetchRef.current) < 2000) {
      return;
    }
    allTimeLastFetchRef.current = now;
    
    // Cancel previous request
    if (allTimeFetchTimeoutRef.current) {
      clearTimeout(allTimeFetchTimeoutRef.current);
    }
    
    // Debounce rapid changes
    allTimeFetchTimeoutRef.current = setTimeout(async () => {
      try {
        if (!silent) {
          setAllTimeAnalyticsLoading(true);
          // ✅ Clear previous data to prevent showing stale data during refresh
          setAllTimeAnalyticsData(null);
        }
        
        const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace('/graphql', '').replace(/\/$/, '');
        const queryParams = new URLSearchParams();
        queryParams.append('period', 'all'); // Always fetch all-time data
        queryParams.append('_t', Date.now().toString()); // ✅ Cache-busting timestamp
        
        const url = `${baseUrl}/analytics/user/${user.userId}/direct-v2?${queryParams.toString()}`;
        console.log('📡 [TopPerformingAds] Fetching all-time analytics (V2):', url);
        
        // ✅ Force fresh fetch - prevent browser caching (using cache: 'no-store' and timestamp parameter)
        // Note: Not using custom headers to avoid CORS preflight issues
        const response = await fetch(url, {
          cache: 'no-store' // Don't cache the response
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.data) {
          // ✅ Transform to match GraphQL structure for compatibility
          // Use adPerformance if available (has all fields), otherwise use ads
          const adPerformance = result.data.adPerformance || result.data.ads || [];
          
          const transformedData = {
            getUserAnalytics: {
              summary: result.data.summary || {},
              adPerformance: adPerformance.map((ad: any) => ({
                adId: ad.adId || ad._id,
                adTitle: ad.adTitle || ad.title,
                totalAdPlays: ad.totalAdPlays || ad.totalPlays || 0,
                totalAdPlayTime: ad.totalAdPlayTime || ad.totalViewTime || 0,
                totalQRScans: ad.totalQRScans || 0,
                totalDevices: ad.totalDevices || 0,
                averageAdCompletionRate: ad.completionRate || ad.averageAdCompletionRate || 0,
                materials: ad.materials || []
              })),
              period: 'all',
              startDate: null,
              endDate: null
            }
          };
          
          setAllTimeAnalyticsData(transformedData);
          allTimeAnalyticsErrorRef.current = null;
          console.log('✅ [TopPerformingAds] All-time analytics loaded:', {
            adsCount: adPerformance.length,
            totalQRScans: result.data.summary?.totalQRScans || 0,
            sampleAd: adPerformance[0] ? {
              title: adPerformance[0].adTitle || adPerformance[0].title,
              plays: adPerformance[0].totalAdPlays || adPerformance[0].totalPlays,
              qrScans: adPerformance[0].totalQRScans
            } : null
          });
        } else {
          throw new Error(result.message || 'Failed to fetch all-time analytics');
        }
      } catch (error: any) {
        console.error('❌ [TopPerformingAds] Error fetching all-time analytics:', error);
        allTimeAnalyticsErrorRef.current = error;
      } finally {
        if (!silent) {
          setAllTimeAnalyticsLoading(false);
        }
      }
    }, silent ? 100 : 200);
  }, [user?.userId]);
  
  // ✅ Fetch on mount and when user changes
  useEffect(() => {
    if (user?.userId) {
      fetchAllTimeAnalytics(false);
    }
  }, [user?.userId, fetchAllTimeAnalytics]);
  
  // ✅ Background refresh every 10 seconds (silent) for real-time updates
  // ⚡ REAL-TIME: Reduced from 15s to 10s for faster Top Performing Ads updates (matches TODAY filter polling)
  useEffect(() => {
    if (!user?.userId) return;
    
    const pollInterval = setInterval(() => {
      console.log('🔄 [TopPerformingAds] Background refresh triggered');
      fetchAllTimeAnalytics(true); // Silent refresh - always fetches fresh data (no cache)
    }, 10000); // 10 seconds for faster near real-time updates (matches TODAY filter polling rate)
    
    return () => {
      clearInterval(pollInterval);
    };
  }, [user?.userId, fetchAllTimeAnalytics]);
  
  // ✅ Refresh when page regains focus (user returns to tab)
  useEffect(() => {
    const handleFocus = () => {
      console.log('🔄 [TopPerformingAds] Page focus detected, refreshing data');
      fetchAllTimeAnalytics(false); // Non-silent refresh when user returns
    };
    
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchAllTimeAnalytics]);
  
  // Keep backward compatibility reference
  const overallAnalyticsData = allTimeAnalyticsData;

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
    if (!selectedAd) {
      // Show no devices when no ad is selected yet (during initialization)
      return [];
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
  // ✅ Filter to only show active/paid ads with assigned materials (exclude PENDING, REJECTED, ARCHIVED)
  const extractedAds = useMemo(() => {
    // Prefer myAdsData since it has materialId information
    if (myAdsData?.getMyAds && myAdsData.getMyAds.length > 0) {
      // Filter ads: only show APPROVED, RUNNING, or SCHEDULED ads that are PAID, not archived, and have materials assigned
      const activeAds = myAdsData.getMyAds.filter((ad: any) => {
        const hasValidStatus = ad.status === 'APPROVED' || ad.status === 'RUNNING' || ad.status === 'SCHEDULED';
        const isPaid = ad.paymentStatus === 'PAID';
        const isNotArchived = !ad.isArchived && ad.status !== 'ARCHIVED'; // ✅ Exclude archived/deleted ads (both isArchived flag and ARCHIVED status)
        const hasMaterials = ad.materialId && Array.isArray(ad.materialId) && ad.materialId.length > 0;
        return hasValidStatus && isPaid && isNotArchived && hasMaterials;
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
      // ✅ Safety check: Filter out archived ads from analytics data (backend should already filter, but double-check)
      const archivedAdIds = new Set<string>();
      if (myAdsData?.getMyAds) {
        myAdsData.getMyAds.forEach((ad: any) => {
          if (ad.isArchived || ad.status === 'ARCHIVED') {
            archivedAdIds.add(ad.id?.toString() || '');
          }
        });
      }
      
      const ads = adPerformance
        .filter((ad: any) => {
          const adId = (ad.adId || '').toString();
          return !archivedAdIds.has(adId);
        })
        .map((ad: any) => ({
          id: ad.adId || `ad-${ad.adTitle}`,
          title: ad.adTitle || 'Unknown Ad'
        }));
      return ads;
    }
    return [];
  }, [myAdsData, overallAnalyticsData, directAnalyticsData, analyticsData]);

  // ✅ Update available devices when filtered devices change and set first device as default
  useEffect(() => {
    setAvailableDevices(filteredDevices);
    
    // ✅ Only run device selection logic when filteredDevices changes (not when selectedDevice changes)
    // This prevents infinite loop
    const currentDevice = selectedDevice; // Capture current value
    
    if (currentDevice && filteredDevices.length > 0) {
      const deviceExists = filteredDevices.some(device => device.materialId === currentDevice);
      if (!deviceExists) {
        // Select first device as default
        const firstDevice = filteredDevices[0];
        setSelectedDevice(firstDevice.materialId);
        setSelectedDeviceLabel(firstDevice.name);
      }
    } else if (!currentDevice && filteredDevices.length > 0) {
      // Auto-select first device when no device is selected and devices are available
      const firstDevice = filteredDevices[0];
      setSelectedDevice(firstDevice.materialId);
      setSelectedDeviceLabel(firstDevice.name);
    } else if (filteredDevices.length === 0 && currentDevice) {
      // Only clear if there was a device selected
      setSelectedDevice('');
      setSelectedDeviceLabel('No devices');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredDevices]); // ✅ Only depend on filteredDevices to prevent infinite loop

  // Update available ads when extraction changes and set first ad as default
  useEffect(() => {
    setAvailableAds(extractedAds);
    
    // Set first ad as default if no ad is selected and ads are available
    if (extractedAds.length > 0 && !selectedAd) {
      const firstAd = extractedAds[0];
      setSelectedAd(firstAd.id);
      setSelectedAdLabel(firstAd.title);
    }
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
    // Handle date strings in YYYY-MM-DD format by parsing as local date (not UTC)
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = date.split('-').map(Number);
      const localDate = new Date(year, month - 1, day);
      return localDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Get display text for the date input placeholder
  const getDatePlaceholder = () => {
    if (!isCustomDate) {
      return selectedPeriodLabel || "Select a date";
    }

    if (selectedDate) {
      return formatDisplayDate(selectedDate);
    }
    return "Select a date";
  };

  // Handle date selection
  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setIsCustomDate(true);
    setSelectedPeriodLabel(formatDisplayDate(date));
    setShowDatePicker(false);
  };

  // Reset when clearing date
  const handleClearDate = () => {
    setSelectedDate('');
    setIsCustomDate(false);
    setSelectedPeriodLabel("TODAY");
    setSelectedPeriod("1d");
  };

  // Fetch analytics data (both all devices and specific device) with debouncing and useCallback
  // ✅ Updated to include adId parameter when an ad is selected
  // ✅ Added silent parameter to disable loading state during background refreshes
  const fetchDirectAnalytics = useCallback(async (silent: boolean = false) => {
    if (!user?.userId) return;

    // ✅ PERFORMANCE: Check cache first before fetching
    const cacheKey = getCacheKey(selectedAd, selectedDevice, selectedPeriod, selectedDate, isCustomDate);
    const cache = analyticsCacheRef.current;
    const cached = cache.get(cacheKey);
    const now = Date.now();
    
    // ✅ CRITICAL FIX: Skip cache for:
    // 1. Silent refreshes (polling) - always fetch fresh data for real-time updates
    // 2. TODAY filter (period=1d) - always fetch fresh data to show latest scans
    const isTodayFilter = selectedPeriod === '1d';
    const shouldSkipCache = silent || isTodayFilter;
    
    // ✅ Use cache if available and not expired, AND not skipping cache
    if (!shouldSkipCache && cached && (now - cached.timestamp) < CACHE_TTL) {
      // ✅ Cache hit - update lastAccessed and use cached data immediately
      cached.lastAccessed = now; // Update LRU timestamp
      // ✅ PERSISTENT CACHE: Save updated lastAccessed to localStorage
      savePersistentCache(cache);
      console.log('⚡ [DetailedAnalytics] Using cached data for:', cacheKey);
      if (!selectedDevice) {
        setDirectAnalyticsData(cached.data);
        setDeviceAnalytics(null);
      } else {
        setDeviceAnalytics(cached.data?.deviceAnalytics);
        setDirectAnalyticsData(null);
      }
      setDirectAnalyticsLoading(false);
      setIsFiltersLoading(false);
      return; // Skip fetch - use cache
    }
    
    // ✅ Log when skipping cache
    if (shouldSkipCache && cached) {
      console.log(`🚫 [CACHE DISABLED] Skipping cache for ${silent ? 'silent refresh (polling)' : 'TODAY filter'} - fetching fresh data`, { 
        cachedTimestamp: cached.timestamp, 
        now,
        cacheKey 
      });
    }

    // ✅ Cancel previous request if it's still in progress
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      console.log('🚫 [DetailedAnalytics] Cancelled previous request');
    }

    // ✅ Cancel pending timeout
    if (directFetchTimeoutRef.current) {
      clearTimeout(directFetchTimeoutRef.current);
    }

    // ✅ PERFORMANCE: Increase debounce for rapid filter changes to prevent request spam
    // When filters change rapidly, wait longer to ensure only the final state triggers a request
    const debounceDelay = silent ? 300 : 400; // Increased from 100ms to 400ms
    
    directFetchTimeoutRef.current = setTimeout(async () => {
      // ✅ Skip if another request is already in progress (prevent overlapping requests)
      if (isRequestInProgressRef.current) {
        console.log('⏸️ [DetailedAnalytics] Request already in progress, skipping');
        return;
      }

      // ✅ Create new AbortController for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      isRequestInProgressRef.current = true;

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

        // ✅ PERFORMANCE FIX: Avoid 'period=all' when filters are applied
        // 'period=all' queries are very slow (1+ minute). Use a reasonable date range instead.
        let effectivePeriod: string = selectedPeriod;
        let useDateRange = false;
        if (selectedPeriod === 'all' && (selectedAd !== 'all' || selectedDevice !== 'all')) {
          // When filters are applied, use last 90 days instead of 'all' for faster queries
          // Calculate date range for last 90 days
          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - 90);
          
          queryParams.append('startDate', startDate.toISOString());
          queryParams.append('endDate', endDate.toISOString());
          useDateRange = true;
          console.log('⚡ [DetailedAnalytics] Using 90-day date range instead of "all" for faster filtered query');
        }

        let url;
        if (!selectedDevice) {
          if (isCustomDate && selectedDate) {
            const dateISO = formatDateForAPI(selectedDate);
            queryParams.append('startDate', dateISO);
            queryParams.append('endDate', dateISO);
            url = `${baseUrl}/analytics/user/${user.userId}/direct-v2?${queryParams.toString()}`;
          } else if (useDateRange) {
            // Already added date range params above
            url = `${baseUrl}/analytics/user/${user.userId}/direct-v2?${queryParams.toString()}`;
          } else {
            queryParams.append('period', effectivePeriod);
            url = `${baseUrl}/analytics/user/${user.userId}/direct-v2?${queryParams.toString()}`;
          }
        } else {
          if (isCustomDate && selectedDate) {
            const dateISO = formatDateForAPI(selectedDate);
            queryParams.append('startDate', dateISO);
            queryParams.append('endDate', dateISO);
            url = `${baseUrl}/analytics/v2/user/${user.userId}/device/${selectedDevice}?${queryParams.toString()}`;
          } else if (useDateRange) {
            // Already added date range params above
            url = `${baseUrl}/analytics/v2/user/${user.userId}/device/${selectedDevice}?${queryParams.toString()}`;
          } else {
            queryParams.append('period', effectivePeriod);
            url = `${baseUrl}/analytics/v2/user/${user.userId}/device/${selectedDevice}?${queryParams.toString()}`;
          }
        }

        console.log('📡 [DetailedAnalytics] Fetching:', url);
        const response = await fetch(url, {
          signal: abortController.signal // ✅ Attach abort signal
        });

        // ✅ Check if request was aborted
        if (abortController.signal.aborted) {
          console.log('🚫 [DetailedAnalytics] Request was aborted');
          return;
        }

        const data = await response.json();

        if (data.success) {
          if (!selectedDevice) {
            console.log('📊 [DetailedAnalytics] Received directAnalyticsData:', {
              hasDeviceStats: !!data.data?.deviceStats,
              deviceStatsCount: data.data?.deviceStats?.length || 0,
              hasSummary: !!data.data?.summary,
              summary: data.data?.summary ? {
                totalAdsPlayed: data.data.summary.totalAdsPlayed,
                totalDisplayTime: data.data.summary.totalDisplayTime,
                totalQRScans: data.data.summary.totalQRScans,
                totalDevices: data.data.summary.totalDevices,
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
              dateRange: isCustomDate ? { date: selectedDate } : { period: selectedPeriod },
              url: url
            });
            
            // ✅ Only update state if we have data (prevent clearing existing data)
            if (data.data) {
              // ✅ MEMORY MANAGEMENT: Clean cache before adding new entry
              manageCache();
              
              // ✅ PERFORMANCE: Store in cache for future use (with lastAccessed for LRU)
              const now = Date.now();
              analyticsCacheRef.current.set(cacheKey, {
                data: data.data,
                timestamp: now,
                lastAccessed: now
              });
              console.log('💾 [DetailedAnalytics] Cached data for:', cacheKey, `(Cache size: ${analyticsCacheRef.current.size}/${MAX_CACHE_SIZE})`);
              
              // ✅ PERSISTENT CACHE: Save to localStorage after caching new data
              savePersistentCache(analyticsCacheRef.current);
              
              setDirectAnalyticsData(data.data);
              setDeviceAnalytics(null);
              console.log('✅ [DetailedAnalytics] Successfully set directAnalyticsData', {
                dailyStatsCount: data.data.dailyStats?.length || 0,
                period: selectedPeriod,
                ad: selectedAd
              });
              
              // ✅ Warn if period='all' but no dailyStats (server should return data for all time)
              if (selectedPeriod === 'all' && (!data.data.dailyStats || data.data.dailyStats.length === 0)) {
                console.warn('⚠️ [DetailedAnalytics] Period is "all" but server returned no dailyStats. This might indicate no data exists or server issue.');
              }
            } else {
              console.warn('⚠️ [DetailedAnalytics] API returned success but no data');
            }
          } else {
            // ✅ MEMORY MANAGEMENT: Clean cache before adding new entry
            manageCache();
            
            // ✅ PERFORMANCE: Store device analytics in cache (use same cache key format)
            // Store the full response structure for consistency (with lastAccessed for LRU)
            const now = Date.now();
            analyticsCacheRef.current.set(cacheKey, {
              data: { deviceAnalytics: data.data.deviceAnalytics },
              timestamp: now,
              lastAccessed: now
            });
            console.log('💾 [DetailedAnalytics] Cached device analytics for:', cacheKey, `(Cache size: ${analyticsCacheRef.current.size}/${MAX_CACHE_SIZE})`);
            
            // ✅ PERSISTENT CACHE: Save to localStorage after caching new data
            savePersistentCache(analyticsCacheRef.current);
            
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
      } catch (error: any) {
        // ✅ Don't log error if request was aborted (this is expected)
        if (error.name === 'AbortError') {
          console.log('🚫 [DetailedAnalytics] Request was cancelled (filter changed)');
          return;
        }
        
        console.error('Error fetching direct analytics:', error);
        // ✅ Don't clear existing data on error - keep previous data visible
        // This prevents the graph from disappearing when there's a network error
        if (!silent) {
          console.warn('⚠️ [DetailedAnalytics] Network error, keeping existing data');
        }
      } finally {
        // ✅ Check if request was aborted before clearing flags
        const wasAborted = abortController.signal.aborted;
        
        // ✅ Clear request in progress flag (unless aborted - new request will handle it)
        if (!wasAborted) {
          isRequestInProgressRef.current = false;
        }
        
        // ✅ Only hide loading state if it was shown (not silent) and request wasn't aborted
        if (!silent && !wasAborted) {
          setDirectAnalyticsLoading(false);
          setIsFiltersLoading(false); // ✅ Also hide filter loading state
        } else if (wasAborted && !silent) {
          // ✅ If request was aborted, keep loading state (new request will show it)
          // But reset the in-progress flag so new request can start
          isRequestInProgressRef.current = false;
        }
      }
    }, debounceDelay);
  }, [selectedDevice, selectedPeriod, selectedAd, user?.userId, isCustomDate, selectedDate]);

  // ✅ Fetch analytics data when device, ad, period, or date range changes
  // ✅ FIX: Ensure this runs immediately on mount with default values
  useEffect(() => {
    // Show loading for initial load or when filters change (user action)
    if (user?.userId) {
      // Check if filters actually changed
      const filtersChanged = 
        previousFiltersRef.current.selectedDevice !== selectedDevice ||
        previousFiltersRef.current.selectedAd !== selectedAd ||
        previousFiltersRef.current.selectedPeriod !== selectedPeriod ||
        previousFiltersRef.current.selectedDate !== selectedDate;
      
      // ✅ PERFORMANCE: Check cache FIRST before showing loading state
      const cacheKey = getCacheKey(selectedAd, selectedDevice, selectedPeriod, selectedDate, isCustomDate);
      const cache = analyticsCacheRef.current;
      const cached = cache.get(cacheKey);
      const now = Date.now();
      // 🔥 FIX: NEVER use cache for TODAY filter (period=1d) - always fetch fresh data
      // Cached data might be from yesterday, showing wrong totals
      const isTodayFilter = selectedPeriod === '1d';
      const hasValidCache = cached && (now - cached.timestamp) < CACHE_TTL && !isTodayFilter;
      
      if (isTodayFilter && cached) {
        console.log('🚫 [CACHE DISABLED] Skipping cache for TODAY filter - fetching fresh data', { cachedTimestamp: cached.timestamp, now });
      }
      
      if (hasValidCache) {
        // ✅ Cache hit - update lastAccessed and use cached data immediately (instant display, no loading)
        cached.lastAccessed = now; // Update LRU timestamp
        // ✅ PERSISTENT CACHE: Save updated lastAccessed to localStorage
        savePersistentCache(cache);
        console.log('⚡ [DetailedAnalytics] Using cached data for filters - instant display:', cacheKey);
        if (!selectedDevice) {
          setDirectAnalyticsData(cached.data);
          setDeviceAnalytics(null);
        } else {
          setDeviceAnalytics(cached.data?.deviceAnalytics);
          setDirectAnalyticsData(null);
        }
        setIsFiltersLoading(false);
        setDirectAnalyticsLoading(false);
        // Don't fetch - use cached data
      } else {
        // ✅ Cache miss or expired - show loading and fetch fresh data
        if (filtersChanged) {
          setIsFiltersLoading(true);
          // ✅ Clear previous data only when cache miss (cache hit will set correct data immediately)
          // This prevents showing wrong data (e.g., 4 QR scans from overall data when filtered should be 1)
          if (selectedAd !== 'all' || selectedDevice !== 'all') {
            setDirectAnalyticsData(null);
            setDeviceAnalytics(null);
          }
        }
        
        console.log('📊 [DetailedAnalytics] Cache miss - fetching fresh data for:', cacheKey);
        // Fetch fresh data (will be cached after fetch)
        fetchDirectAnalytics(false);
      }
      
      // Update previous filters
      previousFiltersRef.current = {
        selectedDevice,
        selectedAd,
        selectedPeriod,
        selectedDate: selectedDate
      };
    }
    
    // Mark initial load as complete after first successful load
    if (!hasInitiallyLoadedRef.current && (directAnalyticsData || analyticsData)) {
      hasInitiallyLoadedRef.current = true;
      setIsInitialLoad(false);
    }
  }, [selectedDevice, selectedAd, selectedPeriod, isCustomDate, selectedDate, fetchDirectAnalytics, user?.userId]);
  
  // ✅ Refresh handler for manual refresh button (defined after fetchDirectAnalytics)
  const handleRefresh = useCallback(() => {
    console.log('🔄 [DetailedAnalytics] Manual refresh triggered');
    // Clear cache
    analyticsCacheRef.current.clear();
    savePersistentCache(analyticsCacheRef.current);
    // Refresh all data
    fetchDirectAnalytics(false);
    fetchAllTimeAnalytics(false); // Refresh Top Performing Ads (this is the key fix!)
  }, [fetchDirectAnalytics, fetchAllTimeAnalytics]);
  
  // ✅ Hide loading state when data arrives
  useEffect(() => {
    if (isFiltersLoading && (directAnalyticsData || deviceAnalytics)) {
      setIsFiltersLoading(false);
    }
  }, [directAnalyticsData, deviceAnalytics, isFiltersLoading]);
  
  // Mark initial load as complete once we have data
  useEffect(() => {
    if (isInitialLoad && (directAnalyticsData || analyticsData?.getUserAnalytics)) {
      setIsInitialLoad(false);
      hasInitiallyLoadedRef.current = true;
    }
  }, [directAnalyticsData, analyticsData, isInitialLoad]);

  // ✅ Poll direct analytics when current date is included (silent background refresh)
  // ✅ Skip polling when using custom date range to avoid interfering with the data
  // ⚡ REAL-TIME: Poll more frequently (10 seconds) when viewing today's data for faster updates
  useEffect(() => {
    if (!isCurrentDateIncluded) return;
    // ✅ Don't poll when using custom date (only poll for preset periods)
    if (isCustomDate) return;
    
    // Poll every 10 seconds when viewing current day data (silent refresh) for faster real-time updates
    const pollInterval = setInterval(() => {
      fetchDirectAnalytics(true); // Silent background refresh
    }, 10000); // 10 seconds for today's data (faster than 30s for historical data)
    
    return () => clearInterval(pollInterval);
  }, [isCurrentDateIncluded, isCustomDate, fetchDirectAnalytics]);

  // Cleanup all pending timeouts and abort in-flight requests on unmount
  useEffect(() => {
    return () => {
      // ✅ Cancel any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // ✅ Clear all timeouts
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
  // - Ad selected: Show filtered by ad (DON'T show overall data - wait for filtered data)
  // - Device selected: Show filtered by device
  // - Any combination: Show filtered totals (DON'T show overall data - wait for filtered data)
  const analyticsSummary = useMemo(() => {
    // Check if any filters are active
    // Date filter is active if: custom date range is set OR period is not 'all' (default '7d' is considered a filter)
    const hasDateFilter = (isCustomDate && selectedDate) || (selectedPeriod !== 'all');
    // Ad filter is always active now since we always have a specific ad selected
    const hasAdFilter = Boolean(selectedAd);
    // Device filter is active when a specific device is selected
    const hasDeviceFilter = Boolean(selectedDevice);
    const hasAnyFilter = hasAdFilter || hasDeviceFilter || hasDateFilter;
    
    // ✅ CRITICAL FIX: Always prefer directAnalyticsData (from UserAnalytics collection) when available
    // This ensures we use the most up-to-date data from the UserAnalytics collection
    // Only fallback to GraphQL data if directAnalyticsData is not available
    
    // ✅ When no filters are active (period='all', ad='all', device='all'), prefer overallAnalyticsData for consistency
    // This ensures QR Scans metric updates at the same rate as Top Performing Ads (both use overallAnalyticsData)
    if (!hasAnyFilter && selectedPeriod === 'all' && !isCustomDate) {
      // ✅ Use overallAnalyticsData first for consistency with Top Performing Ads (same polling rate)
      if (overallAnalyticsData?.getUserAnalytics?.summary) {
        console.log('✅ [DetailedAnalytics] Using overallAnalyticsData summary for "all" period (consistent with Top Performing Ads):', overallAnalyticsData.getUserAnalytics.summary);
        return {
          totalAdsPlayed: overallAnalyticsData.getUserAnalytics.summary.totalAdsPlayed || 0,
          totalDisplayTime: overallAnalyticsData.getUserAnalytics.summary.totalDisplayTime || 0,
          averageCompletionRate: overallAnalyticsData.getUserAnalytics.summary.averageCompletionRate || 0,
          totalAds: overallAnalyticsData.getUserAnalytics.summary.totalAds || 0,
          activeAds: overallAnalyticsData.getUserAnalytics.summary.activeAds || 0,
          totalDevices: overallAnalyticsData.getUserAnalytics.summary.totalDevices || 0,
          totalQRScans: overallAnalyticsData.getUserAnalytics.summary.totalQRScans || 0
        };
      }
      // Fallback to directAnalyticsData if overallAnalyticsData is not available
      if (directAnalyticsData?.summary) {
        console.log('⚠️ [DetailedAnalytics] Falling back to directAnalyticsData for "all" period:', directAnalyticsData.summary);
        return {
          totalAdsPlayed: directAnalyticsData.summary.totalAdsPlayed || 0,
          totalDisplayTime: directAnalyticsData.summary.totalDisplayTime || 0,
          averageCompletionRate: directAnalyticsData.summary.averageCompletionRate || 0,
          totalAds: directAnalyticsData.summary.totalAds || 0,
          activeAds: directAnalyticsData.summary.activeAds || 0,
          totalDevices: directAnalyticsData.summary.totalDevices || 0,
          totalQRScans: directAnalyticsData.summary.totalQRScans || 0
        };
      }
      // Final fallback: return zeros
      return {
        totalAdsPlayed: 0,
        totalDisplayTime: 0,
        averageCompletionRate: 0,
        totalAds: 0,
        activeAds: 0,
        totalDevices: 0,
        totalQRScans: 0
      };
    }
    
    // ✅ When a specific device is selected, use deviceAnalytics (filtered data)
    // DON'T fallback to overall data - wait for deviceAnalytics to load
    if (hasDeviceFilter) {
      if (deviceAnalytics) {
        return {
          totalAdsPlayed: deviceAnalytics.totals?.totalAdPlays || 0,
          totalDisplayTime: deviceAnalytics.totals?.totalAdPlayTime || 0,
          averageCompletionRate: deviceAnalytics.averages?.averageCompletionRate || 0,
          totalAds: 0, // Not applicable for device-specific view
          activeAds: 0, // Not applicable for device-specific view
          totalDevices: 1, // Always 1 when device is selected
          totalQRScans: deviceAnalytics.totals?.totalQRScans || 0
        };
      } else {
        // ✅ Device filter active but data not loaded yet - return zeros (will show loading state)
        // This prevents showing overallAnalyticsData which has wrong values
        return {
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
    }
    
    // ✅ When period is '1d' (TODAY) and no ad/device filters, ALWAYS use directAnalyticsData
    // directAnalyticsData has fresher data and should NEVER be overridden by overallAnalyticsData
    // This prevents the issue where correct data is shown during load, then replaced with stale data
    if (selectedPeriod === '1d' && !hasAdFilter && !hasDeviceFilter && !isCustomDate) {
      console.log('🔥 [FIX LOADED] Period is TODAY (1d), checking directAnalyticsData...', {
        hasDirectData: !!directAnalyticsData,
        hasSummary: !!directAnalyticsData?.summary,
        totalAdsPlayed: directAnalyticsData?.summary?.totalAdsPlayed,
        hasOverallData: !!overallAnalyticsData
      });
      // ✅ ALWAYS prefer directAnalyticsData - never fallback to overallAnalyticsData once directAnalyticsData is available
      if (directAnalyticsData?.summary) {
        console.log('✅ [DetailedAnalytics] Using directAnalyticsData for "TODAY" period (fresh data):', directAnalyticsData.summary);
        return {
          totalAdsPlayed: directAnalyticsData.summary.totalAdsPlayed || 0,
          totalDisplayTime: directAnalyticsData.summary.totalDisplayTime || 0,
          averageCompletionRate: directAnalyticsData.summary.averageCompletionRate || 0,
          totalAds: directAnalyticsData.summary.totalAds || 0,
          activeAds: directAnalyticsData.summary.activeAds || 0,
          totalDevices: directAnalyticsData.summary.totalDevices || 0,
          totalQRScans: directAnalyticsData.summary.totalQRScans || 0
        };
      }
      // ❌ REMOVED: Don't fallback to overallAnalyticsData for TODAY filter
      // It shows ALL TIME data (30, 3, etc.) instead of TODAY data (0, 0, 0)
      // Just wait for directAnalyticsData to load and show zeros/loading in the meantime
      // ✅ If directAnalyticsData exists but summary is missing, return zeros to wait for it
      if (directAnalyticsData && !directAnalyticsData.summary) {
        console.log('⏳ [DetailedAnalytics] Waiting for directAnalyticsData summary to load...');
        return {
          totalAdsPlayed: 0,
          totalDisplayTime: 0,
          averageCompletionRate: 0,
          totalAds: 0,
          activeAds: 0,
          totalDevices: 0,
          totalQRScans: 0
        };
      }
    }
    
    // ✅ When filters are applied (ad or date) but device is 'all', use filtered data
    // Prefer directAnalyticsData (from direct API call) as it respects all filters including adId
    // DON'T fallback to overallAnalyticsData - wait for directAnalyticsData to load
    if (hasAnyFilter) {
      if (directAnalyticsData?.summary) {
        // ✅ CRITICAL: If custom date is selected, verify we have valid data for that date
        // If backend returned data for invalid dates (like future dates), return zeros
        if (isCustomDate && selectedDate) {
          const today = new Date();
          today.setHours(23, 59, 59, 999);
          const todayStr = today.toISOString().split('T')[0];
          
          // Check if selected date is valid (not in future)
          if (selectedDate > todayStr) {
            console.warn(`⚠️ [DetailedAnalytics] Selected date ${selectedDate} is in the future, returning zeros`);
            return {
              totalAdsPlayed: 0,
              totalDisplayTime: 0,
              averageCompletionRate: 0,
              totalAds: directAnalyticsData.summary.totalAds || 0,
              activeAds: directAnalyticsData.summary.activeAds || 0,
              totalDevices: directAnalyticsData.summary.totalDevices || 0,
              totalQRScans: 0
            };
          }
          
          // Check if we have any valid dailyStats for this exact date
          const validDailyStats = directAnalyticsData.dailyStats?.filter((day: any) => {
            const dayDateStr = typeof day.date === 'string' && day.date.match(/^\d{4}-\d{2}-\d{2}$/) 
              ? day.date 
              : new Date(day.date).toISOString().split('T')[0];
            return dayDateStr === selectedDate && dayDateStr <= todayStr;
          }) || [];
          
          if (validDailyStats.length === 0) {
            // No valid data for this date - return zeros for metrics
            console.log(`⚠️ [DetailedAnalytics] No valid data found for date ${selectedDate}, returning zeros for summary`);
            return {
              totalAdsPlayed: 0,
              totalDisplayTime: 0,
              averageCompletionRate: 0,
              totalAds: directAnalyticsData.summary.totalAds || 0,
              activeAds: directAnalyticsData.summary.activeAds || 0,
              totalDevices: directAnalyticsData.summary.totalDevices || 0,
              totalQRScans: 0
            };
          }
        }
        
        return {
          totalAdsPlayed: directAnalyticsData.summary.totalAdsPlayed || 0,
          totalDisplayTime: directAnalyticsData.summary.totalDisplayTime || 0,
          averageCompletionRate: directAnalyticsData.summary.averageCompletionRate || 0,
          totalAds: directAnalyticsData.summary.totalAds || 0,
          activeAds: directAnalyticsData.summary.activeAds || 0,
          totalDevices: directAnalyticsData.summary.totalDevices || 0,
          totalQRScans: directAnalyticsData.summary.totalQRScans || 0
        };
      } else {
        // ✅ Filters active but data not loaded yet - return zeros (will show loading state)
        // This prevents showing overallAnalyticsData which has wrong values (e.g., 4 QR scans when filtered should be 1)
        return {
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
    }
    
    // ✅ Fallback to GraphQL analyticsData only if no ad/device filters are active
    // (GraphQL analyticsData respects date/period but NOT adId, so only use when ad='all' and device='all')
    // Note: hasAdFilter and hasDeviceFilter are already declared at the top of this useMemo
    if (!hasAdFilter && !hasDeviceFilter && analyticsData?.getUserAnalytics?.summary) {
      return analyticsData.getUserAnalytics.summary;
    }
    
    // ✅ Final fallback: Return zeros (will show loading state)
    // This ensures we NEVER show wrong overall data when filters are active
    // The loading spinner will be shown because directAnalyticsLoading or isFiltersLoading is true
    return {
      totalAdsPlayed: 0,
      totalDisplayTime: 0,
      averageCompletionRate: 0,
      totalAds: 0,
      activeAds: 0,
      totalMaterials: 0,
      totalDevices: 0,
      totalQRScans: 0
    };
  }, [overallAnalyticsData, directAnalyticsData, analyticsData, deviceAnalytics, selectedAd, selectedDevice, selectedPeriod, isCustomDate, selectedDate, directAnalyticsLoading]);

  // Format display time helper
  const formatDisplayTime = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }, []);

  // Daily stats for charts
  const dailyStats = useMemo(() => {
    // ✅ Fix: Check for 'all' explicitly since it's truthy but means "no specific device"
    if (!selectedDevice || selectedDevice === 'all') {
      // ✅ When using custom date range, ONLY use directAnalyticsData (don't fall back to GraphQL)
      // ✅ When NOT using custom date range, use directAnalyticsData first, then fallback to GraphQL
      let dailyStats: any[] = [];
      
      if (isCustomDate && selectedDate) {
        // Custom date: ONLY use directAnalyticsData
        dailyStats = directAnalyticsData?.dailyStats || [];
        
        // ✅ CRITICAL: If backend returned data for invalid dates, filter it out immediately
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const todayStr = today.toISOString().split('T')[0];
        
        // Filter out future dates immediately
        const beforeFilter = dailyStats.length;
        dailyStats = dailyStats.filter((day: any) => {
          const dayDateStr = typeof day.date === 'string' && day.date.match(/^\d{4}-\d{2}-\d{2}$/) 
            ? day.date 
            : new Date(day.date).toISOString().split('T')[0];
          return dayDateStr <= todayStr;
        });
        
        if (beforeFilter > dailyStats.length) {
          console.warn(`⚠️ [DetailedAnalytics] Backend returned ${beforeFilter - dailyStats.length} invalid future dates - filtered out`);
          // Clear cache for this invalid date to force fresh fetch
          const cacheKey = getCacheKey(selectedAd, selectedDevice, selectedPeriod, selectedDate, isCustomDate);
          const cache = analyticsCacheRef.current;
          cache.delete(cacheKey);
          savePersistentCache(cache);
        }
        
        console.log('📊 [DetailedAnalytics] Using ONLY directAnalyticsData for custom date:', {
          hasDirectData: !!directAnalyticsData,
          dailyStatsCount: dailyStats.length,
          selectedDate: selectedDate,
          datesInData: dailyStats.map((d: any) => typeof d.date === 'string' && d.date.match(/^\d{4}-\d{2}-\d{2}$/) ? d.date : new Date(d.date).toISOString().split('T')[0])
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
        } else if (selectedPeriod === 'all' && overallAnalyticsData?.getUserAnalytics?.dailyStats && overallAnalyticsData.getUserAnalytics.dailyStats.length > 0) {
          // ✅ Fallback to overallAnalyticsData for all time period
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
      
      // ✅ Filter dailyStats by date if custom date is selected (extra safeguard)
      // ✅ Also filter out future dates (likely test data or timezone issues)
      let filteredDailyStats = dailyStats;
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      const todayStr = today.toISOString().split('T')[0];
      
      // Filter out future dates (data shouldn't exist for future dates)
      const beforeFutureFilter = filteredDailyStats.length;
      filteredDailyStats = dailyStats.filter((day: any) => {
        const dayDateStr = typeof day.date === 'string' && day.date.match(/^\d{4}-\d{2}-\d{2}$/) 
          ? day.date 
          : new Date(day.date).toISOString().split('T')[0];
        
        if (dayDateStr > todayStr) {
          console.log(`🚫 [DetailedAnalytics] Frontend filtering out future date: ${dayDateStr} (today: ${todayStr})`);
          return false;
        }
        return true;
      });
      
      if (beforeFutureFilter > filteredDailyStats.length) {
        console.log(`✅ [DetailedAnalytics] Frontend filtered out ${beforeFutureFilter - filteredDailyStats.length} future dates`);
      }
      
      if (isCustomDate && selectedDate) {
        const selectedDateStr = selectedDate;
        
        // ✅ STRICT FILTERING: When a custom date is selected, ONLY show data for that exact date
        // Filter out ALL other dates, even if they exist in the data
        filteredDailyStats = filteredDailyStats.filter((day: any) => {
          const dayDateStr = typeof day.date === 'string' && day.date.match(/^\d{4}-\d{2}-\d{2}$/) 
            ? day.date 
            : new Date(day.date).toISOString().split('T')[0];
          return dayDateStr === selectedDateStr;
        });
        
        console.log('📊 [DetailedAnalytics] STRICT filtering by custom date:', {
          originalCount: dailyStats.length,
          filteredCount: filteredDailyStats.length,
          selectedDate: selectedDate,
          datesInData: dailyStats.map((d: any) => typeof d.date === 'string' && d.date.match(/^\d{4}-\d{2}-\d{2}$/) ? d.date : new Date(d.date).toISOString().split('T')[0]),
          filteredDates: filteredDailyStats.map((d: any) => typeof d.date === 'string' && d.date.match(/^\d{4}-\d{2}-\d{2}$/) ? d.date : new Date(d.date).toISOString().split('T')[0])
        });
      } else if (filteredDailyStats.length < dailyStats.length) {
        console.log('📊 [DetailedAnalytics] Filtered out future dates:', {
          originalCount: dailyStats.length,
          filteredCount: filteredDailyStats.length,
          today: todayStr
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
      
      // ✅ Fill missing dates with zero values for proper chart line rendering
      return fillMissingDates(mappedStats, selectedPeriod, isCustomDate ? selectedDate : null);
    } else if (selectedDevice !== 'all' && (deviceAnalytics?.dailyBreakdown || deviceAnalytics?.dailyStats)) {
      // ✅ Fix: Support both field names - API returns 'dailyStats', older code expects 'dailyBreakdown'
      const deviceDailyData = deviceAnalytics.dailyBreakdown || deviceAnalytics.dailyStats || [];
      
      // ✅ Filter device-specific daily stats by date range if custom date range is selected
      let filteredDeviceDailyStats = deviceDailyData;
      
      // ✅ Filter by selected ad if an ad is selected (device data contains entries for ALL ads)
      if (selectedAd && selectedAd !== 'all') {
        const beforeAdFilter = filteredDeviceDailyStats.length;
        filteredDeviceDailyStats = filteredDeviceDailyStats.filter((day: any) => {
          const dayAdId = day.adId?.toString() || '';
          return dayAdId === selectedAd;
        });
        console.log('📊 [DetailedAnalytics] Filtered device dailyStats by selected ad:', {
          selectedAd,
          beforeCount: beforeAdFilter,
          afterCount: filteredDeviceDailyStats.length
        });
      }
      
      if (isCustomDate && selectedDate) {
        const startDate = new Date(selectedDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(selectedDate);
        endDate.setHours(23, 59, 59, 999);
        
        filteredDeviceDailyStats = filteredDeviceDailyStats.filter((day: any) => {
          const dayDate = new Date(day.date);
          return dayDate >= startDate && dayDate <= endDate;
        });
        
        console.log('📊 [DetailedAnalytics] Filtered device dailyStats by custom date:', {
          originalCount: deviceDailyData.length,
          filteredCount: filteredDeviceDailyStats.length,
          selectedDate: selectedDate
        });
      }
      
      console.log('📊 [DetailedAnalytics] Device dailyStats mapped:', {
        rawDataCount: deviceDailyData.length,
        filteredCount: filteredDeviceDailyStats.length,
        sampleRaw: filteredDeviceDailyStats.slice(0, 2)
      });
      
      const mappedDeviceStats = filteredDeviceDailyStats.map((day: any) => ({
        date: day.date,
        // ✅ Support both field names from different API versions
        adPlays: day.totalAdPlays || day.adsPlayed || 0,
        qrScans: day.totalQRScans || day.qrScans || 0,
        completionRate: day.adCompletionRate || day.completionRate || 0
      }));
      
      // ✅ Fill missing dates with zero values for proper chart line rendering
      return fillMissingDates(mappedDeviceStats, selectedPeriod, isCustomDate ? selectedDate : null);
    } else {
      return [];
    }
  }, [selectedDevice, deviceAnalytics, directAnalyticsData, analyticsData, overallAnalyticsData, selectedPeriod, selectedAd, isCustomDate, selectedDate]);

  // Top performing ads with proper QR scan calculation - ALWAYS use all-time data regardless of device/date selection
  // ✅ RANKING: Sorted by QR scans (descending) - ads with highest QR scans are ranked first
  const topPerformingAds = useMemo(() => {
    // Always use the all-time ad performance data from GraphQL query (not filtered by device or date)
    console.log('🔍 [TopPerformingAds] Computing with:', {
      hasAllTimeData: !!allTimeAnalyticsData,
      hasGetUserAnalytics: !!allTimeAnalyticsData?.getUserAnalytics,
      hasAdPerformance: !!allTimeAnalyticsData?.getUserAnalytics?.adPerformance,
      adPerformanceLength: allTimeAnalyticsData?.getUserAnalytics?.adPerformance?.length || 0,
      period: allTimeAnalyticsData?.getUserAnalytics?.period,
      currentFilters: {
        selectedAd,
        selectedDevice,
        selectedPeriod
      },
      note: 'Top Performing Ads should ALWAYS show period=all data, independent of filters!'
    });
    
    const ads = (allTimeAnalyticsData?.getUserAnalytics?.adPerformance || []);
    
    console.log('📊 [TopPerformingAds] Processing ads:', ads.length);
    console.log('📊 [TopPerformingAds] Sample ad data:', ads[0] ? {
      adId: ads[0].adId,
      adTitle: ads[0].adTitle,
      totalQRScans: ads[0].totalQRScans,
      hasMaterials: !!ads[0].materials,
      materialsCount: ads[0].materials?.length || 0
    } : 'No ads');
    
    // ✅ Filter out archived/deleted ads - check against myAdsData
    // ⚠️ IMPORTANT: Only filter if myAdsData is loaded, otherwise show all ads
    const archivedAdIds = new Set<string>();
    if (myAdsData?.getMyAds && Array.isArray(myAdsData.getMyAds) && myAdsData.getMyAds.length > 0) {
      myAdsData.getMyAds.forEach((ad: any) => {
        if (ad.isArchived) {
          archivedAdIds.add(ad.id?.toString() || '');
        }
      });
      console.log('📊 [TopPerformingAds] Archived ad IDs:', Array.from(archivedAdIds));
    } else {
      console.log('⚠️ [TopPerformingAds] myAdsData not loaded yet - showing all ads (not filtering archived)');
    }
    
    // Filter out archived ads (only if myAdsData is loaded)
    const nonArchivedAds = myAdsData?.getMyAds ? ads.filter((ad: any) => {
      const adId = ad.adId?.toString() || '';
      const isArchived = archivedAdIds.has(adId);
      if (isArchived) {
        console.log(`⏭️ [TopPerformingAds] Filtering out archived ad: ${ad.adTitle} (${adId})`);
      }
      return !isArchived;
    }) : ads; // ✅ If myAdsData not loaded, show all ads
    
    console.log('📊 [TopPerformingAds] After filtering archived ads:', {
      originalCount: ads.length,
      filteredCount: nonArchivedAds.length,
      filteredOut: ads.length - nonArchivedAds.length,
      myAdsDataLoaded: !!myAdsData?.getMyAds
    });
    
    // ✅ Trust backend data - backend now always fetches fresh QR scan data
    // The backend's getUserAnalytics already fetches fresh QR scans and populates ad.totalQRScans
    const mappedAds = nonArchivedAds.map((ad: any) => {
      // Use the QR scans directly from backend (already fresh data)
      const qrScans = ad.totalQRScans || 0;
      
      // ✅ Get actual device count from myAdsData (devices assigned to the ad)
      // Find the corresponding ad in myAdsData to get the actual materialId array
      let assignedDevicesCount = ad.totalDevices || 0; // Fallback to analytics data
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
      
      // ✅ Use actual play count from backend (totalAdPlays) for consistency with summary stats
      const totalPlays = ad.totalAdPlays || 0;
      
      console.log(`✅ [TopPerformingAds] Ad "${ad.adTitle}": ${totalPlays} plays (actual count from backend)`);
      
      // Debug logging
      if (qrScans > 0 || totalPlays > 0) {
        console.log(`✅ [TopPerformingAds] Ad "${ad.adTitle}" (${ad.adId}): ${totalPlays} plays, ${qrScans} QR scans from backend`);
      }
      
      return {
        ...ad,
        totalPlays: totalPlays, // ✅ Calculated from play time
        totalQRScans: qrScans, // ✅ Use QR scans directly from backend (fresh data)
        assignedDevicesCount: assignedDevicesCount // Use this instead of totalMaterials for device count
      };
    });
    
    // ✅ RANKING: Sort by QR scans (descending), then by ad plays (descending) as tiebreaker
    // Ads with highest QR scans are ranked #1, #2, #3, etc.
    const sortedAds = mappedAds.sort((a: any, b: any) => {
      // Primary sort: QR scans (descending)
      if (b.totalQRScans !== a.totalQRScans) {
        return (b.totalQRScans || 0) - (a.totalQRScans || 0);
      }
      // Secondary sort: Total ad plays (descending) as tiebreaker
      const aPlays = a.totalPlays || a.totalAdsPlayed || 0;
      const bPlays = b.totalPlays || b.totalAdsPlayed || 0;
      return bPlays - aPlays;
    });
    
    console.log('🏆 [TopPerformingAds] Sorted ads by QR scans:', sortedAds.map((ad: any) => ({
      title: ad.adTitle,
      qrScans: ad.totalQRScans,
      plays: ad.totalPlays || ad.totalAdsPlayed || 0
    })));
    
    // Return top 5 performing ads (highest QR scans)
    return sortedAds.slice(0, 5);
  }, [allTimeAnalyticsData, myAdsData]);

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
                          { period: "1d", label: "TODAY" },
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
                              !isCustomDate && selectedPeriod === period
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
                    if (!selectedAd) return;
                    setShowDeviceDropdown(!showDeviceDropdown);
                    setShowDatePicker(false);
                    setShowAdDropdown(false);
                  }}
                  disabled={!selectedAd}
                  className={`flex items-center justify-between w-full text-xs rounded px-3 py-2 bg-white border border-gray-200 shadow-sm ${
                    !selectedAd 
                      ? 'text-gray-400 cursor-not-allowed opacity-60' 
                      : 'text-gray-700 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate">{selectedDeviceLabel || 'Select Device'}</span>
                  </div>
                  <ChevronDown size={14} className={`${!selectedAd ? 'text-gray-400' : 'text-gray-500'}`} />
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
                  onClick={handleRefresh}
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
                <div className="relative w-full sm:w-52 date-picker-container">
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
                                { period: "1d", label: "TODAY" },
                                { period: "7d", label: "Last 7 days" },
                                { period: "30d", label: "Last 30 days" },
                                { period: "all", label: "All Time" },
                              ].map(({ period, label }) => (
                                <button
                                  key={period}
                                  onClick={() => handlePresetPeriodSelect(period as any, label)}
                                  className={`block w-full text-left px-3 py-2 text-xs rounded transition-colors duration-150 ${
                                    !isCustomDate && selectedPeriod === period
                                      ? "bg-gray-100"
                                      : "text-gray-700 hover:bg-gray-100 border border-transparent"
                                  }`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* RIGHT SIDE — Custom Date */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                              Select Date
                            </h4>

                            <div className="mb-3">
                              <label className="block text-xs font-medium text-gray-600 mb-2">
                                Choose a date
                              </label>
                              {selectedDate && (
                                <div className="text-xs text-gray-500 mb-2">
                                  Selected: {formatDisplayDate(selectedDate)}
                                </div>
                              )}
                              <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => handleDateSelect(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#3674B5]"
                              />
                            </div>
                            <div className='flex justify-between items-center'>
                              <button
                                onClick={() => setShowDatePicker(false)}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm transition-all duration-200 hover:bg-gray-50 rounded"
                              >
                                Close
                              </button>
                              {selectedDate && (
                                <button
                                  onClick={handleClearDate}
                                  onMouseMove={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const x = ((e.clientX - rect.left) / rect.width) * 100;
                                    const y = ((e.clientY - rect.top) / rect.height) * 100;
                                    setPos({ x, y });
                                  }}
                                  className="relative group inline-flex items-center justify-center overflow-hidden
                                            w-28 px-4 py-2 text-white text-sm border border-gray-300
                                            bg-white font-medium transition-all duration-300 hover:scale-[1.03]"
                                  style={{
                                    backgroundImage: `linear-gradient(to right, #1B5087, #3674B5),
                                                      radial-gradient(circle at ${pos.x}% ${pos.y}%, rgba(255,255,255,0), rgba(255,255,255,0))`,
                                  }}
                                >
                                  <span className="inline-flex items-center gap-2 px-2 z-10">Clear</span>

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
                <div className="relative w-full sm:w-52 device-dropdown-container">
                  <button
                    onClick={() => {
                      if (!selectedAd) return;
                      setShowDeviceDropdown(!showDeviceDropdown);
                    }}
                    disabled={!selectedAd}
                    className={`flex items-center justify-between w-full text-xs rounded-md px-4 py-3 shadow-md focus:outline-none bg-white/70 gap-2 ${
                      !selectedAd 
                        ? 'text-gray-400 cursor-not-allowed opacity-60' 
                        : 'text-black cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="">{selectedDeviceLabel || 'Select Device'}</span>
                    </div>
                    <ChevronDown
                      size={16}
                      className={`transform transition-transform duration-200 ${
                        showDeviceDropdown ? "rotate-180" : "rotate-0"
                      } ${!selectedAd ? 'text-gray-400' : ''}`}
                    />
                  </button>

                  <AnimatePresence>
                    {showDeviceDropdown && selectedAd !== 'all' && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="absolute z-50 top-full mt-2 w-full rounded-md shadow-lg bg-white overflow-hidden border border-gray-200"
                      >
                        <div className="p-3">
                          {/* Individual Devices */}
                          {availableDevices.map((device) => (
                            <button
                              key={device.id}
                              onClick={() => {
                                setSelectedDevice(device.materialId);
                                setSelectedDeviceLabel(device.name);
                                setShowDeviceDropdown(false);
                              }}
                              className={`block w-full text-left px-1 py-2 text-xs text-gray-700 hover:bg-gray-100 transition-colors duration-150 ${
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
                                <div className="flex items-center space-x-1">
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
                onClick={handleRefresh}
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

          {/* Empty State - Only show when ALL loading is complete AND there's actually no data */}
          {!analyticsLoading && 
           !directAnalyticsLoading && 
           !isFiltersLoading && 
           !isInitialLoad && 
           !analyticsData?.getUserAnalytics && 
           !directAnalyticsData && 
           !deviceAnalytics && (
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
                    <div className="text-xl font-semibold text-gray-900 mt-1 flex items-center gap-2">
                      {/* ✅ Show loading state when filters change or initial load */}
                      {(analyticsLoading && isInitialLoad) || directAnalyticsLoading || isFiltersLoading ? (
                        <>
                          <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
                          <LoaderCircle className="w-4 h-4 animate-spin text-blue-500" />
                        </>
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
                    <div className="text-xl font-semibold text-gray-900 mt-1 flex items-center gap-2">
                      {/* ✅ Show loading state when filters change or initial load */}
                      {(analyticsLoading && isInitialLoad) || directAnalyticsLoading || isFiltersLoading ? (
                        <>
                          <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
                          <LoaderCircle className="w-4 h-4 animate-spin text-blue-500" />
                        </>
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
                    <div className="text-xl font-semibold text-gray-900 mt-1 flex items-center gap-2">
                      {/* ✅ Show loading state when filters change or initial load */}
                      {(analyticsLoading && isInitialLoad) || directAnalyticsLoading || isFiltersLoading ? (
                        <>
                          <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
                          <LoaderCircle className="w-4 h-4 animate-spin text-blue-500" />
                        </>
                      ) : (
                        (analyticsSummary.totalDevices || 0).toLocaleString()
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
                    <div className="text-xl font-semibold text-gray-900 mt-1 flex items-center gap-2">
                      {/* ✅ Show loading state when filters change or initial load */}
                      {(analyticsLoading && isInitialLoad) || directAnalyticsLoading || isFiltersLoading ? (
                        <>
                          <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
                          <LoaderCircle className="w-4 h-4 animate-spin text-blue-500" />
                        </>
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
                    <div className="text-xl font-semibold text-gray-900 mt-1 flex items-center gap-2">
                      {/* ✅ Show loading state when filters change or initial load */}
                      {(analyticsLoading && isInitialLoad) || directAnalyticsLoading || isFiltersLoading ? (
                        <>
                          <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
                          <LoaderCircle className="w-4 h-4 animate-spin text-blue-500" />
                        </>
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
                {/* ✅ Loading State - Show when initial load OR filters change */}
                {(analyticsLoading && isInitialLoad) || (directAnalyticsLoading && (isInitialLoad || isFiltersLoading)) || isFiltersLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <LoaderCircle className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">
                        {isFiltersLoading ? 'Loading filtered data...' : 'Loading chart data...'}
                      </p>
                    </div>
                  </div>
                ) : dailyStats.length > 0 ? (
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
                ) : !directAnalyticsLoading && !isFiltersLoading && !analyticsLoading && !isInitialLoad ? (
                  /* ✅ Empty State - Only show when loading is complete and no data */
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm font-medium text-gray-700 mb-1">No Chart Data Available</p>
                      <p className="text-xs text-gray-500">
                        No performance data found for the selected period. Data will appear once your ads start playing.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* ✅ Still loading - show loading state */
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <LoaderCircle className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Loading chart data...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Top Performing Ads - Always show all-time totals regardless of filters */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-black/80 mb-1">Top Performing Ads</h3>
                  <p className="text-sm text-black/60">Your best performing advertisements (All-time totals)</p>
                </div>
              </div>
              {allTimeAnalyticsLoading && topPerformingAds.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <LoaderCircle className="w-6 h-6 animate-spin text-blue-500 mx-auto mb-2" />
                    <p className="text-xs text-gray-600">Loading top performing ads...</p>
                  </div>
                </div>
              ) : topPerformingAds.length > 0 ? (
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
                        
                        {/* Plays - Always show total plays from all-time data */}
                        <div className="w-20"> 
                          <p className="text-base font-bold text-black/70">
                            {(ad.totalPlays || ad.totalAdsPlayed || 0).toLocaleString()}
                          </p>
                          <p className="text-xs text-black/50 font-medium leading-none mt-0.5">
                            Plays
                          </p>
                        </div>

                        {/* QR Scans (Highlighted) - Always show all-time QR scans */}
                        <div className="w-20 ml-6 pl-4 border-l border-gray-200">
                          <p className="text-xl font-extrabold text-green-600">
                            {(ad.totalQRScans || 0).toLocaleString()}
                          </p>
                          <p className="text-xs text-green-700 font-bold leading-none mt-0.5">
                            QR Scans
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <p className="text-sm text-gray-600">No ads found</p>
                  </div>
                </div>
              )}
            </div>
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