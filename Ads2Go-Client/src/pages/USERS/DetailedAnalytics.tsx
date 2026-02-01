import React, { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useLazyQuery } from '@apollo/client';
import {
  ArrowLeft,
  Play,
  Clock,
  QrCode,
  RefreshCw,
  TrendingUp,
  BarChart3,
  ChevronDown,
  Calendar,
  Loader2,
  LineChart
} from 'lucide-react';
import { GET_USER_ANALYTICS } from '../../graphql/user/queries/getUserAnalytics';
import { useUserAuth } from '../../contexts/UserAuthContext';

// Lazy-load chart modal + Recharts (~200KB) only when user clicks "View Chart"
const ChartModal = lazy(() => import('./DetailedAnalyticsChartModal'));

// Cache key constant for analytics data
const ANALYTICS_CACHE_KEY = 'detailed-analytics-cache';

/**
 * Clears the analytics cache from localStorage
 * Called on user logout to prevent data leakage
 */
export const clearDetailedAnalyticsCache = (): void => {
  try {
    localStorage.removeItem(ANALYTICS_CACHE_KEY);
    console.log('🗑️ [DetailedAnalytics] Cache cleared');
  } catch (error) {
    console.warn('⚠️ [DetailedAnalytics] Failed to clear cache:', error);
  }
};

/**
 * Format seconds to human readable time (e.g., "2h 30m" or "45m 30s")
 */
const formatAirtime = (seconds: number): string => {
  if (!seconds || seconds === 0) return '0s';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
};

/**
 * Format large numbers with commas
 */
const formatNumber = (num: number): string => {
  if (!num) return '0';
  return num.toLocaleString();
};

/**
 * Format date to readable format (full)
 */
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
};

/**
 * Format date to short format (for mobile)
 */
const formatDateShort = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

/**
 * Format date for chart axis
 */
const formatChartDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
};

interface DailyStat {
  date: string;
  adsPlayed: number;
  displayTime: number;
  qrScans: number;
  completionRate: number;
}

interface DeviceStat {
  deviceId: string;
  materialId: string;
  adsPlayed: number;
  displayTime: number;
  lastActivity: string;
  isOnline: boolean;
  qrScans: number;
}

interface AdPerformance {
  adId: string;
  adTitle: string;
  totalDevices: number;
  totalAdPlayTime: number;
  totalAdPlays: number;
  totalQRScans: number;
  averageAdCompletionRate: number;
  lastUpdated: string;
}

interface AnalyticsSummary {
  totalAdsPlayed: number;
  totalDisplayTime: number;
  totalQRScans: number;
  totalAds: number;
  activeAds: number;
  totalDevices: number;
}

// Expandable Ad Row Component (memoized to avoid re-renders when parent updates)
interface AdRowProps {
  ad: AdPerformance;
  isExpanded: boolean;
  onToggle: (adId: string) => void;
  onViewChart: (ad: AdPerformance) => void;
  dailyStats: DailyStat[] | null;
  isLoadingDaily: boolean;
}

const AdRow: React.FC<AdRowProps> = React.memo(({ ad, isExpanded, onToggle, onViewChart, dailyStats, isLoadingDaily }) => {
  // When expanded and we have daily stats, show totals from daily sum so row and daily table match
  const displayTotals = React.useMemo(() => {
    if (!isExpanded || !dailyStats || dailyStats.length === 0) {
      return { plays: ad.totalAdPlays, time: ad.totalAdPlayTime, qr: ad.totalQRScans };
    }
    return {
      plays: dailyStats.reduce((s, d) => s + (d.adsPlayed || 0), 0),
      time: dailyStats.reduce((s, d) => s + (d.displayTime || 0), 0),
      qr: dailyStats.reduce((s, d) => s + (d.qrScans || 0), 0)
    };
  }, [isExpanded, dailyStats, ad.totalAdPlays, ad.totalAdPlayTime, ad.totalQRScans]);

  return (
    <>
      {/* Main Row */}
      <tr
        onClick={() => onToggle(ad.adId)}
        className="hover:bg-gray-100 transition-colors cursor-pointer group"
      >
        <td className="px-4 sm:px-8 lg:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className={`p-1 rounded transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
              <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-[#3674B5]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm sm:text-base text-gray-900 group-hover:text-[#3674B5] truncate">
                {ad.adTitle || 'Untitled Ad'}
              </div>
              <div className="text-xs sm:text-sm text-gray-500">
                {ad.totalDevices} {ad.totalDevices === 1 ? 'device' : 'devices'} • View daily stats
              </div>
            </div>
          </div>
        </td>
        <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
          <span className="inline-flex items-center px-2 sm:px-3 py-1 text-xs sm:text-sm font-semibold">
            {formatNumber(displayTotals.plays)}
          </span>
        </td>
        <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
          <span className="inline-flex items-center px-2 sm:px-3 py-1 text-xs sm:text-sm font-semibold">
            {formatAirtime(displayTotals.time)}
          </span>
        </td>
        <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
          <span className="inline-flex items-center px-2 sm:px-3 py-1 text-xs sm:text-sm font-semibold">
            {formatNumber(displayTotals.qr)}
          </span>
        </td>
      </tr>

      {/* Expanded Daily Stats Row */}
      {isExpanded && (
        <tr>
          <td colSpan={4} className="px-0 py-0">
            <div className="bg-gray-50 border-t border-b border-gray-200">
              <div className="px-6 sm:px-6 py-4 sm:py-4">
                <div className="flex justify-between gap-2 sm:gap-4 mb-4 flex-wrap">
                  <h3 className="text-sm sm:text-base font-semibold text-gray-700">Daily Performance</h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewChart(ad);
                    }}
                    className="flex justify-end px-3 sm:px-4 py-1 text-xs sm:text-sm bg-[#3674B5] text-white rounded-md hover:bg-[#2a5a94] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg flex-shrink-0"
                  >
                    View Chart
                  </button>
                </div>

                {isLoadingDaily ? (
                  <div className="flex items-center justify-center py-6 sm:py-8">
                    <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 animate-spin" />
                    <span className="ml-2 text-xs sm:text-sm text-gray-500">Loading daily stats...</span>
                  </div>
                ) : !dailyStats || dailyStats.length === 0 ? (
                  <div className="text-center py-6 sm:py-8 text-gray-500">
                    <Calendar className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-xs sm:text-sm">No daily data available for this ad</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <table className="w-full min-w-[500px]">
                      <thead>
                        <tr className="text-xs text-gray-500 uppercase">
                          <th className="px-4 sm:px-8 lg:px-10 py-2 text-left font-medium">Date</th>
                          <th className="px-3 sm:px-5.5 py-2 text-center font-medium">Ads Played</th>
                          <th className="px-3 sm:px-5.5 py-2 text-center font-medium">Airtime</th>
                          <th className="px-3 sm:px-5.5 py-2 text-center font-medium">QR Scans</th>
                        </tr>
                      </thead>
                      <tbody className="">
                        {dailyStats.map((day, idx) => (
                          <tr key={day.date || idx} className="mb-2 hover:bg-gray-100 group cursor-pointer">
                            <td className="px-4 sm:px-8 lg:px-6 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 group-hover:text-[#3674B5] font-medium">
                              <span className="sm:hidden">{formatDateShort(day.date)}</span>
                              <span className="hidden sm:inline">{formatDate(day.date)}</span>
                            </td>
                            <td className="px-3 sm:px-6 py-2 sm:py-3 text-center">
                              <span className="text-xs sm:text-sm font-medium text-gray-900 group-hover:text-[#3674B5]">
                                {formatNumber(day.adsPlayed)}
                              </span>
                            </td>
                            <td className="px-3 sm:px-6 py-2 sm:py-3 text-center">
                              <span className="text-xs sm:text-sm font-medium text-gray-900 group-hover:text-[#3674B5]">
                                {formatAirtime(day.displayTime)}
                              </span>
                            </td>
                            <td className="px-3 sm:px-6 py-2 sm:py-3 text-center">
                              <span className="text-xs sm:text-sm font-medium text-gray-900 group-hover:text-[#3674B5]">
                                {formatNumber(day.qrScans)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
});

AdRow.displayName = 'AdRow';

const DetailedAnalytics: React.FC = () => {
  const { user } = useUserAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedAdId, setExpandedAdId] = useState<string | null>(null);
  const [dailyStatsCache, setDailyStatsCache] = useState<Record<string, DailyStat[]>>({});
  const [chartModalAd, setChartModalAd] = useState<AdPerformance | null>(null);

  // Fetch overall analytics: cache-first for fast repeat loads, then revalidate
  // Auto-refresh every 20s in background (invisible to user; no loading state)
  const { data, loading, error, refetch } = useQuery(GET_USER_ANALYTICS, {
    variables: { period: 'all-time' },
    fetchPolicy: 'cache-first',
    nextFetchPolicy: 'cache-and-network',
    skip: !user,
    pollInterval: 2_000, // 2 seconds (near realtime)
    notifyOnNetworkStatusChange: false // keep refetch invisible: no loading flash
  });

  // Lazy query for daily stats: use cache when available so expand is instant on re-open
  const [fetchAdDailyStats, { loading: loadingDailyStats }] = useLazyQuery(GET_USER_ANALYTICS, {
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
    onCompleted: (data) => {
      if (data?.getUserAnalytics?.dailyStats && expandedAdId) {
        setDailyStatsCache(prev => ({
          ...prev,
          [expandedAdId]: data.getUserAnalytics.dailyStats
        }));
      }
    }
  });

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setDailyStatsCache({});
    try {
      await refetch();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  }, [refetch]);

  const handleToggleAd = useCallback(
    (adId: string) => {
      if (expandedAdId === adId) {
        setExpandedAdId(null);
      } else {
        setExpandedAdId(adId);
        if (!dailyStatsCache[adId]) {
          fetchAdDailyStats({
            variables: { period: 'all-time', adId }
          });
        }
      }
    },
    [expandedAdId, dailyStatsCache, fetchAdDailyStats]
  );

  const handleViewChart = useCallback((ad: AdPerformance) => {
    setChartModalAd(ad);
  }, []);

  // Keep expanded daily stats in sync with main query: when main data updates (e.g. from
  // 2s poll), refetch the expanded ad’s daily stats so top cards and daily table match
  const mainDataUpdated = data?.getUserAnalytics?.lastUpdated ?? data?.getUserAnalytics?.summary?.totalAdsPlayed;
  useEffect(() => {
    if (!expandedAdId) return;
    fetchAdDailyStats({
      variables: { period: 'all-time', adId: expandedAdId }
    });
    // Only run when main query data changes (poll), not when user expands (avoids double-fetch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainDataUpdated, fetchAdDailyStats]);

  const analytics = data?.getUserAnalytics;
  const summary: AnalyticsSummary = analytics?.summary || {
    totalAdsPlayed: 0,
    totalDisplayTime: 0,
    totalQRScans: 0,
    totalAds: 0,
    activeAds: 0,
    totalDevices: 0,
  };
  const adPerformance: AdPerformance[] = analytics?.adPerformance || [];

  return (
    <div className="relative min-h-screen overflow-hidden pl-0 lg:pl-64">
      {/* Background Image */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat blur-sm brightness-90"
        style={{ backgroundImage: "url('/image/bg.jpg')" }}
      />
      <div className="fixed inset-0 bg-white/40 backdrop-blur-xl" />
      {/* Content */}
      <div className="relative z-10 min-h-screen bg-transparent px-4 sm:px-5 lg:px-6 py-4 sm:py-6 lg:py-10">
        {/* Header */}
        <div className="max-w-7xl mx-auto mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4">
          <Link
            to="/dashboard"
            className="inline-flex items-center text-black text-sm sm:text-base pt-10 sm:pt-3"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>          
        </div>
        
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Detailed Analytics
        </h1>
        <p className="text-sm sm:text-base text-gray-600 mt-2">
          View comprehensive analytics for your ad campaigns
        </p>
      </div>

      {/* Summary Cards */}
      <div className="max-w-7xl mx-auto mb-6 sm:mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {/* Total Ads Played */}
          <div className="bg-white shadow-sm border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-500">Total Ads Played</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">
                  {loading ? '...' : formatNumber(summary.totalAdsPlayed)} <span className='text-base sm:text-lg font-medium text-black'>Plays</span>
                </p>
              </div>
              <div
                className="p-2 sm:p-2 ml-2 flex-shrink-0 rounded-full bg-gradient-to-br from-blue-300/60 via-blue-300/40 to-white/40 
                border border-white/30 backdrop-blur-md shadow-md flex items-center justify-center"
              >
                <Play className="w-5 h-5 sm:w-7 sm:h-7 text-blue-700 drop-shadow-sm" />
              </div>
            </div>
          </div>

          {/* Total Airtime */}
          <div className="bg-white shadow-sm border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-500">Total Airtime</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">
                  {loading ? '...' : formatAirtime(summary.totalDisplayTime)} 
                </p>
              </div>
              <div
                className="p-2 sm:p-2 ml-2 flex-shrink-0 rounded-full bg-gradient-to-br from-green-300/60 via-green-300/40 to-white/40 
                border border-white/30 backdrop-blur-md shadow-md flex items-center justify-center"
              >
                <Clock className="w-5 h-5 sm:w-7 sm:h-7 text-green-700 drop-shadow-sm" />
              </div>
            </div>
          </div>

          {/* Total QR Scans */}
          <div className="bg-white shadow-sm border border-gray-200 p-4 sm:p-6 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-500">Total QR Scans</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">
                  {loading ? '...' : formatNumber(summary.totalQRScans)} <span className='text-base sm:text-lg font-medium text-black'>Scans</span>
                </p>
              </div>
              <div
                className="p-2 sm:p-2 ml-2 flex-shrink-0 rounded-full bg-gradient-to-br from-purple-300/60 via-purple-300/40 to-white/40 
                border border-white/30 backdrop-blur-md shadow-md flex items-center justify-center"
              >
                <QrCode className="w-5 h-5 sm:w-7 sm:h-7 text-purple-700 drop-shadow-sm" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ads Performance Table */}
      <div className="max-w-7xl mx-auto">
        <div className="overflow-hidden">
          <div className="py-3 sm:py-4">
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">Ad Performance</h2>
              <span className="text-xs sm:text-sm text-gray-900">
                {adPerformance.length} {adPerformance.length === 1 ? 'advertiserment' : 'advertiserments'}
              </span>
              <button
                onClick={handleRefresh}
                disabled={loading || isRefreshing}
                className="flex items-center px-3 sm:px-4 py-1 text-xs sm:text-sm bg-[#3674B5] text-white rounded-md hover:bg-[#2a5a94] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg ml-auto"
                >
                <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {loading && adPerformance.length === 0 ? (
            <div className="p-6 sm:p-12 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-sm sm:text-base text-gray-500">Loading analytics...</p>
            </div>
          ) : error ? (
            <div className="p-6 sm:p-12 text-center">
              <div className="text-sm sm:text-base text-red-500 mb-2">Failed to load analytics</div>
              <button
                onClick={handleRefresh}
                className="text-sm sm:text-base text-blue-600 hover:text-blue-700"
              >
                Try again
              </button>
            </div>
          ) : adPerformance.length === 0 ? (
            <div className="p-6 sm:p-12 text-center">
              <TrendingUp className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-sm sm:text-base text-gray-500">No ad performance data yet</p>
              <p className="text-xs sm:text-sm text-gray-400 mt-1">
                Your ads analytics will appear here once they start playing
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="px-4 sm:px-8 lg:px-16 py-2 sm:py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">
                        Ad Title
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-gray-800 uppercase tracking-wider">
                        <div className="flex items-center justify-center gap-1">
                          Ads Played
                        </div>
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-gray-800 uppercase tracking-wider">
                        <div className="flex items-center justify-center gap-1">
                          Airtime
                        </div>
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-gray-800 uppercase tracking-wider">
                        <div className="flex items-center justify-center gap-1">
                          QR Scans
                        </div>
                      </th>
                    </tr>
                  </thead>
                <tbody className="bg-white/80 divide-y divide-gray-200">
                  {adPerformance.map((ad) => (
                    <AdRow
                      key={ad.adId}
                      ad={ad}
                      isExpanded={expandedAdId === ad.adId}
                      onToggle={handleToggleAd}
                      onViewChart={handleViewChart}
                      dailyStats={dailyStatsCache[ad.adId] || null}
                      isLoadingDaily={loadingDailyStats && expandedAdId === ad.adId}
                    />
                  ))}
                </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chart Modal (lazy-loaded; Recharts loads only when opened) */}
      {chartModalAd && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
              <div className="bg-white rounded-md shadow-xl px-6 py-4 flex items-center gap-3">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                <span className="text-gray-700">Loading chart...</span>
              </div>
            </div>
          }
        >
          <ChartModal
            isOpen={!!chartModalAd}
            onClose={() => setChartModalAd(null)}
            ad={chartModalAd}
          />
        </Suspense>
      )}
      </div>
    </div>
  );
};

export default DetailedAnalytics;
