import React, { useState, useEffect, ChangeEvent } from 'react';
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

// NotificationList Component
const notifications = [
  {
    id: 1,
    title: 'NPM Install Complete',
    subtitle: '1,227 packages added!',
    time: 'just now',
    count: 2,
  },
  {
    id: 2,
    title: 'Build Succeeded',
    subtitle: 'Build finished in 12.34s',
    time: '1m 11s',
  },
  {
    id: 3,
    title: 'Lint Passed',
    subtitle: 'No problems found',
    time: '5m',
  },
];

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
  return (
    <motion.div
      className="bg-white/70 dark:bg-neutral-900/80 backdrop-blur-md p-3 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-white/20"
      initial="collapsed"
      whileHover="expanded"
    >
      <div>
        {notifications.map((notification, i) => (
          <motion.div
            key={notification.id}
            className="bg-white dark:bg-neutral-800/80 px-4 py-2 shadow-sm rounded-md hover:shadow-md transition-shadow duration-200 relative"
            variants={getCardVariants(i)}
            transition={transition}
            style={{
              zIndex: notifications.length - i,
            }}
          >
            <div className="flex justify-between items-center">
              <h1 className="text-sm font-medium text-gray-800 dark:text-gray-200">{notification.title}</h1>
              {notification.count && (
                <div className="flex items-center text-xs gap-0.5 font-medium text-gray-500 dark:text-gray-300">
                  <RotateCcw className="size-3" />
                  <span>{notification.count}</span>
                </div>
              )}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              <span>{notification.time}</span>
              &nbsp;•&nbsp;
              <span>{notification.subtitle}</span>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-3">
        <div className="size-5 rounded-full bg-gray-400 dark:bg-gray-600 text-white text-xs flex items-center justify-center font-medium">
          {notifications.length}
        </div>
        <span className="grid">
          <motion.span
            className="text-sm font-medium text-gray-600 dark:text-gray-300 row-start-1 col-start-1"
            variants={notificationTextVariants}
            transition={textSwitchTransition}
          >
            Notifications
          </motion.span>
          <motion.span
            className="text-sm font-medium text-gray-600 dark:text-gray-300 flex items-center gap-1 cursor-pointer select-none row-start-1 col-start-1"
            variants={viewAllTextVariants}
            transition={textSwitchTransition}
          >
            View all <ArrowUpRight className="size-4" />
          </motion.span>
        </span>
      </div>
    </motion.div>
  );
}

// Dashboard Component
const Dashboard = () => {
  const [selectedOption, setSelectedOption] = useState('Drivers');
  const [selectedPeriod, setSelectedPeriod] = useState<'Monthly' | 'Weekly' | 'Daily'>('Monthly');
  const [qrSelectedPeriod, setQrSelectedPeriod] = useState<'Weekly' | 'Daily' | 'Today'>('Today');
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'1d' | '7d' | '30d'>('7d');
  const [displayRevenue, setDisplayRevenue] = useState(0);
  const [displayExpenses, setDisplayExpenses] = useState(0);
  const [displayProfit, setDisplayProfit] = useState(0);
  const [displayPeriodLabel, setDisplayPeriodLabel] = useState('');
  const [userFirstName, setUserFirstName] = useState('User');
  const [showQrPeriodDropdown, setShowQrPeriodDropdown] = useState(false);
  const [showAnalyticsPeriodDropdown, setShowAnalyticsPeriodDropdown] = useState(false);

  // Fetch analytics data
  const { data: analyticsData, loading: analyticsLoading, error: analyticsError, refetch: refetchAnalytics } = useQuery(GET_USER_ANALYTICS, {
    variables: { period: analyticsPeriod },
    // pollInterval: 5000, // Temporarily disabled to prevent repeated errors
    errorPolicy: 'all', // Allow partial data even with errors
    onError: (error) => {
      // Don't log "User analytics not found" as an error - it's expected for new users
      if (error.message !== 'Failed to fetch analytics data') {
        console.error('Analytics fetch error:', error);
      }
    },
  });

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

  const qrTodayData = [
    { name: '12am-8am', value: 55 },
    { name: '8am-4pm', value: 25 },
    { name: '4pm-12am', value: 20 },
  ];

  const qrWeeklyData = [
    { name: 'Week 1', value: 20 },
    { name: 'Week 2', value: 25 },
    { name: 'Week 3', value: 15 },
    { name: 'Week 4', value: 30 },
    { name: 'Week 5', value: 10 },
  ];

  const qrDailyData = [
    { name: 'Mon', value: 10 },
    { name: 'Tue', value: 15 },
    { name: 'Wed', value: 20 },
    { name: 'Thu', value: 12 },
    { name: 'Fri', value: 18 },
    { name: 'Sat', value: 15 },
    { name: 'Sun', value: 10 },
  ];

  const qrPeriodOptions = ['Today', 'Daily', 'Weekly'];
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
    switch (qrSelectedPeriod) {
      case 'Weekly':
        return qrWeeklyData;
      case 'Daily':
        return qrDailyData;
      case 'Today':
        return qrTodayData;
      default:
        return qrTodayData;
    }
  };

  const handleQrPeriodChange = (period: 'Weekly' | 'Daily' | 'Today') => {
    setQrSelectedPeriod(period);
    setShowQrPeriodDropdown(false);
  };

  const handleAnalyticsPeriodChange = (period: '1d' | '7d' | '30d') => {
    setAnalyticsPeriod(period);
    setShowAnalyticsPeriodDropdown(false);
    refetchAnalytics({ period });
  };

  const analyticsSummary = analyticsData?.getUserAnalytics?.summary || {
    totalAdImpressions: 0,
    totalAdsPlayed: 0,
    totalDisplayTime: 0,
    averageCompletionRate: 0,
    totalAds: 0,
    activeAds: 0,
  };

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

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-fixed blur-sm brightness-90"
        style={{
          backgroundImage: "url('/image/bg.jpg')",
        }}
      ></div>
      {/* Overlay */}
      <div className="absolute inset-0 bg-white/50 backdrop-blur-lg"></div>
      {/* Content */}
      <div className="relative z-10 min-h-screen bg-transparent lg:pl-72 px-4 sm:px-5 lg:pr-5 py-6 lg:p-10">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 pt-12 lg:pt-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-800">Welcome back, {userFirstName}!</h1>
            <p className="text-gray-500 text-sm">Here's your analytic detail</p>
          </div>
        </div>
        
        {/* Real-Time Metrics */}
        <div className="mb-6">
          <RealtimeMetrics />
        </div>

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
          {/* Column 1: Ad Performance Overview */}
          <div
            className="relative p-4 sm:p-6 shadow-xl md:col-span-2 text-white cursor-pointer
                       bg-[#1b5087]/60 backdrop-blur-md border border-white/20
                       hover:bg-[#1b5087]/70 transition-all duration-300"
            onClick={() => window.location.href = '/detailed-analytics'}
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
            <ResponsiveContainer width="100%" height={150}>
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
                    name === 'impressions' ? value.toLocaleString() :
                    name === 'adsPlayed' ? value.toLocaleString() : value,
                    name === 'impressions' ? 'Impressions' :
                    name === 'adsPlayed' ? 'Ads Played' : 'Display Time'
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="impressions"
                  stroke="#A18FF35"
                  fill="#2876c7"
                  fillOpacity={0.6}
                  name="impressions"
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
            <div className="mt-6 mb-4">
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-white/90">Currently Playing</h4>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                    <span className="text-xs text-white/70">LIVE</span>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-12 bg-white/20 flex items-center justify-center">
                    <svg className="w-8 h-8 text-white/70" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h5 className="text-sm font-medium text-white truncate">Summer Sale Campaign</h5>
                    <p className="text-xs text-white/60">Duration: 30s • Views: 1,234</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/60">Next in</p>
                    <p className="text-sm font-medium text-white">15s</p>
                  </div>
                </div>
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
                <p className="text-xs text-gray-400">{analyticsPeriod === '1d' ? 'Last 24h' : analyticsPeriod === '7d' ? 'Last 7 days' : 'Last 30 days'}</p>
              </div>
              <div className="bg-[#1b5087]/60 p-3">
                <p className="text-xl sm:text-2xl font-bold">
                  {analyticsLoading ? '...' : analyticsSummary.activeAds.toLocaleString()}
                </p>
                <p className="text-xs sm:text-sm text-gray-300">Active Ads</p>
                <p className="text-xs text-gray-400">{analyticsPeriod === '1d' ? 'Last 24h' : analyticsPeriod === '7d' ? 'Last 7 days' : 'Last 30 days'}</p>
              </div>
            </div>
          </div>
          {/* Column 2: QR Impressions */}
          <div
            className="relative p-4 shadow-xl cursor-pointer
                      bg-white backdrop-blur-md border border-white/20
                      hover:bg-white transition-all duration-300
                      flex flex-col"
            onClick={() => (window.location.href = '/detailed-analytics')}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">QR Impressions</h2>
              <div className="relative w-24" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setShowQrPeriodDropdown(!showQrPeriodDropdown)}
                  className="flex items-center justify-between w-full text-xs text-black rounded-md pl-4 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2"
                >
                  {qrSelectedPeriod}
                  <ChevronDown
                    size={16}
                    className={`transform transition-transform duration-200 ${showQrPeriodDropdown ? 'rotate-180' : 'rotate-0'}`}
                  />
                </button>
                <AnimatePresence>
                  {showQrPeriodDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute z-10 top-full mt-2 w-full rounded-md shadow-lg bg-white overflow-hidden"
                    >
                      {qrPeriodOptions.map((period) => (
                        <button
                          key={period}
                          onClick={() => handleQrPeriodChange(period as 'Weekly' | 'Daily' | 'Today')}
                          className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                        >
                          {period}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Chart */}
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={getQrChartData()}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip
                    formatter={(value, name) => [value + '%', 'QR Impressions']}
                    labelFormatter={(label) => `Time: ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#0E2A47"
                    strokeWidth={3}
                    dot={{ fill: '#0E2A47', strokeWidth: 2, r: 6 }}
                    activeDot={{ r: 8, stroke: '#0E2A47', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Today data list */}
            {qrSelectedPeriod === 'Today' && (
              <ul className="text-sm text-gray-600 space-y-1 pl-10 mt-4">
                {qrTodayData.map((item, index) => (
                  <li key={index} className="flex items-center space-x-2">
                    <span
                      className="w-3 h-3"
                      style={{ backgroundColor: colors[index % colors.length] }}
                    ></span>
                    <span>
                      {item.name}: {item.value}%
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* View Analytics at the bottom */}
            <div className="mt-auto pt-6 items-center justify-center">
              <Link
                to="/advertisements"
                className="text-white bg-[#1b5087]/90 text-sm font-medium px-6 py-3 flex items-center justify-center gap-2 hover:bg-[#3674B5] transition-all duration-300"
              >
                View Analytics →
              </Link>
            </div>
          </div>

          {/* Column 3: Average Mileage and Notification List */}
          <div className="flex flex-col space-y-3">
            {/* Average Mileage */}
            <div className="min-h-[268px] bg-white backdrop-blur-md p-4 shadow-lg cursor-pointer hover:shadow-xl transition-shadow border border-white/20 flex flex-col">
              {/* Header */}
              <div className="flex justify-between items-center mb-4">
                <span className="text-gray-800 text-lg font-semibold">Average Mileage</span>
              </div>

              {/* Content */}
              <div>
                <p className="text-3xl font-bold text-[#1b5087] pl-4">
                  {analyticsLoading ? '...' : calculateAverageMileage()}
                  <span className="text-lg text-gray-500 ml-1">km/h</span>
                </p>
                <p className="text-sm pt-2 pl-4">
                  <span className="text-green-600">Per Car</span>
                  <span className="text-gray-800"> {analyticsSummary?.activeCars || 0} active vehicles</span>
                </p>
              </div>

              {/* Divider + Button (sticks to bottom) */}
              <div className="mt-auto pt-6">
                <Link
                  to="/advertisements"
                  className="text-white bg-[#1b5087]/90 text-sm font-medium px-6 py-3 flex items-center justify-center gap-2 hover:bg-[#3674B5] transition-all duration-300"
                >
                  View Performance →
                </Link>
              </div>
            </div>
            {/* Notification List */}
            <div>
              <NotificationList />
            </div>
          </div>
        </div>
        {/* Car Location Heat Map */}
        <div className="pt-6 lg:pt-10" onClick={() => window.location.href = '/detailed-analytics'}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Car Location Heat Map</h2>
            <div className="text-xs sm:text-sm text-gray-500">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
          <div className="relative bg-gray-100 overflow-hidden" style={{ height: '300px', minHeight: '250px' }}>
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-green-50">
              <div className="absolute inset-0 opacity-20">
                <svg width="100%" height="100%" className="w-full h-full">
                  <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e7eb" strokeWidth="1"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
              </div>
              <div className="absolute inset-0 p-4">
                <div className="absolute top-8 left-12 w-16 h-16 bg-red-500 opacity-60 animate-pulse"></div>
                <div className="absolute top-20 right-16 w-12 h-12 bg-orange-500 opacity-50"></div>
                <div className="absolute bottom-16 left-20 w-14 h-14 bg-red-400 opacity-55"></div>
                <div className="absolute top-32 left-1/3 w-10 h-10 bg-yellow-500 opacity-45"></div>
                <div className="absolute bottom-32 right-1/4 w-8 h-8 bg-yellow-400 opacity-40"></div>
                <div className="absolute top-1/2 left-1/4 w-12 h-12 bg-yellow-500 opacity-50"></div>
                <div className="absolute top-16 left-2/3 w-6 h-6 bg-green-500 opacity-35"></div>
                <div className="absolute bottom-20 left-1/2 w-8 h-8 bg-green-400 opacity-30"></div>
                <div className="absolute top-2/3 right-8 w-7 h-7 bg-green-500 opacity-40"></div>
                <div className="absolute top-40 right-1/3 w-5 h-5 bg-blue-500 opacity-25"></div>
                <div className="absolute bottom-40 left-1/5 w-6 h-6 bg-purple-500 opacity-30"></div>
                <div className="absolute top-1/4 right-1/5 w-4 h-4 bg-indigo-500 opacity-35"></div>
              </div>
              <div className="absolute top-4 left-4 bg-white px-2 py-1 text-xs font-medium text-gray-700">
                Downtown Area
              </div>
              <div className="absolute top-4 right-4 bg-white px-2 py-1 text-xs font-medium text-gray-700">
                Mall District
              </div>
              <div className="absolute bottom-4 left-4 bg-white px-2 py-1 text-xs font-medium text-gray-700">
                Residential Zone
              </div>
              <div className="absolute bottom-4 right-4 bg-white px-2 py-1 text-xs font-medium text-gray-700">
                Highway Access
              </div>
            </div>
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white px-4 py-2 shadow-sm">
              <div className="flex items-center space-x-4 text-xs">
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-red-500"></div>
                  <span>High Activity</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-yellow-500"></div>
                  <span>Medium Activity</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-green-500"></div>
                  <span>Low Activity</span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-red-50 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-red-600">High Traffic Zones</p>
                  <p className="text-base sm:text-lg font-bold text-red-700">3</p>
                </div>
                <div className="text-red-500 text-xl sm:text-2xl">🔥</div>
              </div>
            </div>
            <div className="bg-yellow-50 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-yellow-600">Medium Traffic</p>
                  <p className="text-base sm:text-lg font-bold text-yellow-700">3</p>
                </div>
                <div className="text-yellow-500 text-xl sm:text-2xl">⚡</div>
              </div>
            </div>
            <div className="bg-green-50 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-green-600">Low Traffic</p>
                  <p className="text-base sm:text-lg font-bold text-green-700">3</p>
                </div>
                <div className="text-green-500 text-xl sm:text-2xl">📍</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;