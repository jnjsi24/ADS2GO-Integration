import React, { useState, useEffect, useRef, ChangeEvent, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import { Link } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { GET_USER_ANALYTICS } from '../../graphql/user/queries/getUserAnalytics';
import { motion, Transition, AnimatePresence } from 'framer-motion';
import { RotateCcw, ArrowUpRight, ChevronDown, Monitor, Play, Activity } from 'lucide-react';
import playbackWebSocketService from '../../services/playbackWebSocketService';
import RealtimeMetrics from '../../components/RealtimeMetrics';
import { useNotifications } from '../../contexts/NotificationContext';
import { formatDistanceToNow } from 'date-fns';
import UserMaterialsMap from '../../components/UserMaterialsMap';
import MultiMaterialRouteMap from '../../components/MultiMaterialRouteMap';
import { GET_MY_ADS } from '../../graphql/user/queries/getMyAds';
import AdProgressBar from '../../components/AdProgressBar';

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

  // Map tab states
  const [mapActiveTab, setMapActiveTab] = useState<'today' | 'history'>('today');
  const [selectedAdForRoute, setSelectedAdForRoute] = useState<string | null>(null);
  const [selectedRouteDate, setSelectedRouteDate] = useState(new Date().toISOString().split('T')[0]);
  const [showAdDropdown, setShowAdDropdown] = useState(false);

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

  // Fetch analytics data (for charts - filtered by period)
  // ✅ OPTIMIZATION: Increased poll interval from 30s to 5 minutes (analytics don't change that frequently)
  // Reduces queries by 90% while maintaining fresh data
  const { data: analyticsData, loading: analyticsLoading, error: analyticsError, refetch: refetchAnalytics } = useQuery(GET_USER_ANALYTICS, {
    variables: { period: analyticsPeriod, adId: selectedAdId },
    fetchPolicy: 'cache-first', // Use cache first for instant loads
    nextFetchPolicy: 'cache-first', // Subsequent queries use cache
    pollInterval: 300000, // Auto-refresh every 5 minutes (increased from 30s)
    errorPolicy: 'all', // Allow partial data even with errors
    notifyOnNetworkStatusChange: false, // Don't show loading state during background refresh (silent update)
  });

  // ✅ Fetch overall analytics data for Summary Metrics (always uses 'all' period, no adId filter)
  // This ensures "Total Ad Played" and other summary metrics always show cumulative totals
  const { data: overallAnalyticsData } = useQuery(GET_USER_ANALYTICS, {
    variables: { 
      period: 'all', // Always fetch overall data for Summary Metrics
      adId: null // No adId filter - show all ads cumulative totals
    },
    fetchPolicy: 'cache-first',
    nextFetchPolicy: 'cache-and-network',
    errorPolicy: 'all',
    pollInterval: 300000, // Auto-refresh every 5 minutes
    notifyOnNetworkStatusChange: false, // Don't show loading state during background refresh (silent update)
  });

  // Fetch user's ads for route history
  const { data: myAdsData } = useQuery(GET_MY_ADS, {
    fetchPolicy: 'cache-and-network',
  });

  // Handle analytics errors using useEffect (Apollo v3.14 recommended approach)
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

  // WebSocket subscription for real-time ad playback updates
  useEffect(() => {
    if (!playbackWebSocketService) return;

    const unsubscribe = playbackWebSocketService.subscribe((update) => {
      // Only process adPlaybackUpdate and displayData updates
      if (update.type === 'adPlaybackUpdate' || update.type === 'displayData') {
        // Extract materialId and slotNumber from update
        // For adPlaybackUpdate, materialId and slotNumber are now included in the update
        // For displayData, materialId is in the update data
        const materialId = (update as any).materialId || null;
        const slotNumber = (update as any).slotNumber || (update.type === 'displayData' ? (update as any).sourceSlot : 1); // Default to slot 1 if not specified
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
          setCurrentlyPlayingAds(prev => {
            const newMap = new Map(prev);
            
            if (update.type === 'adPlaybackUpdate') {
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
            } else if (update.type === 'displayData') {
              // Handle displayData (similar to admin client)
              const displayData = (update as any).data;
              const adDetails = displayData.adDetails;
              
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
              } else if (displayData.currentTime !== undefined) {
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

    // Cleanup subscription on unmount
    return () => {
      unsubscribe();
    };
  }, [userAdIds, userMaterialIds]);

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

  // Get real QR scan data from analytics
  const dailyStats = analyticsData?.getUserAnalytics?.dailyStats || [];

  // Generate QR chart data based on period
  const generateQrChartData = () => {
    if (dailyStats.length === 0) {
      // Return empty data if no stats available
      return [];
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (qrSelectedPeriod) {
      case 'Daily': {
        // Show last 7 days
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          last7Days.push(date);
        }

        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return last7Days.map(date => {
          const stat = dailyStats.find(s => {
            const statDate = new Date(s.date);
            return statDate.toDateString() === date.toDateString();
          });
          return {
            name: dayNames[date.getDay()],
            value: stat?.qrScans || 0
          };
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
            .filter(stat => {
              const statDate = new Date(stat.date);
              return statDate >= weekStart && statDate <= weekEnd;
            })
            .reduce((sum, stat) => sum + (stat.qrScans || 0), 0);

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
            .filter(stat => {
              const statDate = new Date(stat.date);
              return statDate >= weekStart && statDate <= weekEnd;
            })
            .reduce((sum, stat) => sum + (stat.qrScans || 0), 0);

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
    // ⚡ No need to manually refetch! Apollo's useQuery automatically refetches when analyticsPeriod changes
  };

  // ✅ Analytics summary - use overallAnalyticsData for summary metrics (all-time totals)
  // Charts use analyticsData (filtered by period)
  const analyticsSummary = overallAnalyticsData?.getUserAnalytics?.summary || {
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
  const currentAds = analyticsData?.getUserAnalytics?.adPerformance || [];
  
  // Update ref when we get new data
  if (currentAds.length > 0) {
    lastValidAds.current = currentAds;
  }
  
  // Always use the last valid ad list (or current if we have it)
  const userAds = currentAds.length > 0 ? currentAds : lastValidAds.current;
  
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

  // Get user's ads for route selector (only RUNNING ads with materials)
  // Only RUNNING ads have route history, APPROVED ads haven't started yet
  const userAdsForRoute = (myAdsData?.getMyAds || []).filter((ad: any) => 
    ad.status === 'RUNNING' && 
    ad.materialId && 
    ad.materialId.length > 0
  );

  // Get ALL material IDs from selected ad (memoized to prevent unnecessary re-renders)
  const selectedMaterialIds = useMemo(() => {
    if (!selectedAdForRoute || !myAdsData?.getMyAds) return [];
    
    const selectedAd = myAdsData.getMyAds.find((ad: any) => ad.id === selectedAdForRoute);
    if (!selectedAd || !selectedAd.materialId || selectedAd.materialId.length === 0) return [];
    
    // Return array of all materialId strings
    return selectedAd.materialId
      .map((material: any) => material?.materialId)
      .filter((id: string) => id); // Remove any null/undefined
  }, [selectedAdForRoute, myAdsData?.getMyAds]);

  // Get selected ad's startTime and id for route filtering
  const selectedAdStartTime = useMemo(() => {
    if (!selectedAdForRoute || !myAdsData?.getMyAds) return undefined;
    
    const selectedAd = myAdsData.getMyAds.find((ad: any) => ad.id === selectedAdForRoute);
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
                      onClick={() => refetchAnalytics()}
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
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={analyticsData?.getUserAnalytics?.dailyStats || []} margin={{ top: 10, right: 0, left: 0, bottom: 20 }}>
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    stroke="white"
                    tick={{ fontSize: 10 }}
                    interval="preserveStartEnd"
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#2D3748', border: 'none', borderRadius: '8px' }}
                    labelStyle={{ color: '#E2E8F0' }}
                    itemStyle={{ color: '#A8FF35' }}
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                    formatter={(value, name) => [
                      name === 'adsPlayed' ? value.toLocaleString() : value,
                      name === 'adsPlayed' ? 'Ads Played' : 'Display Time'
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="adsPlayed"
                    stroke="#4FD1C7"
                    fill="#2876c7"
                    fillOpacity={0.6}
                    name="adsPlayed"
                  />
                </AreaChart>
              </ResponsiveContainer>
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-4 text-center">
                <div className="bg-[#1b5087]/60 p-3">
                  <p className="text-xl sm:text-2xl font-bold">
                    {analyticsLoading ? '...' : Math.floor((analyticsSummary.totalAdsPlayed * 0.5) || 0).toLocaleString()}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-300">Total Airtime (Minutes)</p>
                  <p className="text-xs text-gray-400">{analyticsPeriod === '1d' ? 'Last 24h' : analyticsPeriod === '7d' ? 'Last 7 days' : 'Last 30 days'}</p>
                </div>
                <div className="bg-[#2876c7]/60 p-3">
                  <p className="text-xl sm:text-2xl font-bold">
                    {analyticsLoading ? '...' : analyticsSummary.totalAdsPlayed.toLocaleString()}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-300">Total Ad Plays</p>
                  <p className="text-xs text-gray-400">All-time total</p>
                </div>
                <div className="bg-[#1b5087]/60 p-3">
                  <p className="text-xl sm:text-2xl font-bold">
                    {analyticsLoading ? '...' : analyticsSummary.activeAds.toLocaleString()}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-300">Active Ads</p>
                  <p className="text-xs text-gray-400">All-time total</p>
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
                  {analyticsLoading && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#1b5087]"></div>
                  )}
                </div>

                {/* Content */}
                <div className={analyticsLoading ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
                  <p className="text-3xl font-bold text-[#1b5087]">
                    {analyticsSummary.totalQRScans?.toLocaleString() || 0}
                  </p>
                  <p className="text-xs pt-3 text-gray-500">
                    All-time total (all ads)
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
                  {analyticsLoading && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#1b5087]"></div>
                  )}
                </div>

                {/* Content */}
                <div className={analyticsLoading ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
                  <p className="text-3xl font-bold text-[#1b5087]">
                    {analyticsSummary.totalAdsPlayed.toLocaleString()}
                  </p>
                  <p className="text-xs pt-3 text-gray-500">
                    All-time total (all ads)
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
          <div className="bg-white/70 backdrop-blur-md border border-white/20 border-b-0">
            <div className="flex space-x-1 p-1">
              <button
                onClick={() => setMapActiveTab('today')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  mapActiveTab === 'today'
                    ? 'bg-[#1b5087] text-white shadow-sm'
                    : 'text-gray-600 hover:bg-white/50'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Activity className="w-4 h-4" />
                  <span>Today</span>
                </div>
              </button>
              <button
                onClick={() => setMapActiveTab('history')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  mapActiveTab === 'history'
                    ? 'bg-[#1b5087] text-white shadow-sm'
                    : 'text-gray-600 hover:bg-white/50'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Monitor className="w-4 h-4" />
                  <span>History</span>
                </div>
              </button>
            </div>
          </div>

          {/* Map Container */}
          <div className="relative bg-white shadow-sm overflow-hidden">
            {/* History Tab Controls */}
            {mapActiveTab === 'history' && (
              <div className="p-4 bg-gray-50 flex flex justify-end gap-2 items-center relative z-50">
                {/* Ad Selector */}
                <div className="relative w-40 z-50">
                  <button
                    onClick={() => setShowAdDropdown(!showAdDropdown)}
                    className="flex items-center justify-between w-full text-xs text-black rounded-md pl-4 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2 relative z-50"
                  >
                    <span className="truncate">
                      {selectedAdForRoute 
                        ? userAdsForRoute.find((ad: any) => ad.id === selectedAdForRoute)?.title || 'Select Ad'
                        : 'Select Ad'}
                    </span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${showAdDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {showAdDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="absolute z-[1000] top-full mt-1 w-full bg-white rounded-md shadow-lg max-h-60 overflow-y-auto"
                        style={{ pointerEvents: 'auto' }}
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
                <div className="min-w-[150px]">
                  <input
                    type="date"
                    value={selectedRouteDate}
                    onChange={(e) => setSelectedRouteDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 text-sm bg-white shadow-md rounded-md"
                  />
                </div>
              </div>
            )}

            {/* Map Content */}
            <div style={{ height: mapActiveTab === 'history' ? '500px' : '300px' }} className="relative z-0">
              {mapActiveTab === 'today' ? (
                <UserMaterialsMap height="100%" className="rounded-b-lg" />
              ) : (
                <div className="h-full w-full relative z-0">
                  {!selectedAdForRoute ? (
                    <div className="flex items-center justify-center h-full bg-gray-50">
                      <div className="text-center p-8">
                        <Monitor className="w-14 h-14 mx-auto mb-4" />
                        <h3 className="font-medium mb-2">
                          Select an Advertisement
                        </h3>
                        <p className="text-sm">
                          Choose an ad from the dropdown above to view its historical routes
                        </p>
                      </div>
                    </div>
                  ) : selectedMaterialIds.length === 0 ? (
                    <div className="flex items-center justify-center h-full bg-gray-50">
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
                    <MultiMaterialRouteMap
                      key={`route-${selectedAdForRoute}-${selectedRouteDate}`}
                      materialIds={selectedMaterialIds}
                      date={selectedRouteDate}
                      className="h-full w-full"
                      style={{ height: '100%', position: 'relative', zIndex: 0 }}
                      snapToRoads={true}
                      disableAutoRefresh={true}
                      adStartTime={selectedAdStartTime}
                      adId={selectedAdIdForRoute}
                    />
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