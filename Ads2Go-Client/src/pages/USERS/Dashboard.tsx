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
import { motion, Transition } from 'framer-motion';
import { RotateCcw, ArrowUpRight } from 'lucide-react';

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
      className="bg-white/30 dark:bg-neutral-900/80 backdrop-blur-md p-3 rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300 border border-white/20"
      initial="collapsed"
      whileHover="expanded"
    >
      <div>
        {notifications.map((notification, i) => (
          <motion.div
            key={notification.id}
            className="bg-white dark:bg-neutral-800/80 rounded-xl px-4 py-2 shadow-sm hover:shadow-md transition-shadow duration-200 relative"
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

  // Fetch analytics data
  const { data: analyticsData, loading: analyticsLoading, error: analyticsError, refetch: refetchAnalytics } = useQuery(GET_USER_ANALYTICS, {
    variables: { period: analyticsPeriod },
    pollInterval: 5000,
    onError: (error) => {
      console.error('Analytics fetch error:', error);
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

  const handleQrPeriodChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setQrSelectedPeriod(e.target.value as 'Weekly' | 'Daily' | 'Today');
  };

  const handleAnalyticsPeriodChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const newPeriod = e.target.value as '1d' | '7d' | '30d';
    setAnalyticsPeriod(newPeriod);
    refetchAnalytics({ period: newPeriod });
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
      <div className="absolute inset-0 bg-white/40 backdrop-blur-xl"></div>
      {/* Content */}
      <div className="relative z-10 min-h-screen bg-transparent pl-72 pr-5 p-10">
        {/* Header Section */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-semibold text-gray-800">Welcome back, {userFirstName}!</h1>
            <p className="text-gray-500 text-sm">Here's your analytic detail</p>
          </div>
        </div>
        {/* Metrics Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-6">
          {/* Column 1: Ad Performance Overview */}
          <div
            className="relative p-6 rounded-2xl shadow-xl col-span-2 text-white cursor-pointer
                       bg-[#1b5087]/60 backdrop-blur-md border border-white/20
                       hover:bg-[#1b5087]/70 transition-all duration-300"
            onClick={() => window.location.href = '/detailed-analytics'}
          >
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-semibold">Ad Performance Overview</span>
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <select
                  className="text-xs text-white bg-[#1b5087] rounded-md pl-5 pr-10 py-3 border border-white focus:outline-none appearance-none"
                  value={analyticsPeriod}
                  onChange={handleAnalyticsPeriodChange}
                >
                  <option className="rounded-lg" value="1d">Daily</option>
                  <option className="rounded-lg" value="7d">Weekly</option>
                  <option className="rounded-lg" value="30d">Monthly</option>
                </select>
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
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
                  stroke="#A8FF35"
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
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-white/90">Currently Playing</h4>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-xs text-white/70">LIVE</span>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-12 bg-white/20 rounded-lg flex items-center justify-center">
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
            <div className="grid grid-cols-3 gap-4 mt-4 text-center">
              <div className="bg-[#1b5087] p-3 rounded-lg">
                <p className="text-2xl font-bold">
                  {analyticsLoading ? '...' : Math.floor((analyticsSummary.totalAdsPlayed * 0.5) || 0).toLocaleString()}
                </p>
                <p className="text-sm text-gray-300">Total Airtime (Minutes)</p>
                <p className="text-xs text-gray-400">{analyticsPeriod === '1d' ? 'Last 24h' : analyticsPeriod === '7d' ? 'Last 7 days' : 'Last 30 days'}</p>
              </div>
              <div className="bg-[#2876c7] p-3 rounded-lg">
                <p className="text-2xl font-bold">
                  {analyticsLoading ? '...' : analyticsSummary.totalAdsPlayed.toLocaleString()}
                </p>
                <p className="text-sm text-gray-300">Total Ad Plays</p>
                <p className="text-xs text-gray-400">{analyticsPeriod === '1d' ? 'Last 24h' : analyticsPeriod === '7d' ? 'Last 7 days' : 'Last 30 days'}</p>
              </div>
              <div className="bg-[#1b5087] p-3 rounded-lg">
                <p className="text-2xl font-bold">
                  {analyticsLoading ? '...' : analyticsSummary.activeAds.toLocaleString()}
                </p>
                <p className="text-sm text-gray-300">Active Ads</p>
                <p className="text-xs text-gray-400">{analyticsPeriod === '1d' ? 'Last 24h' : analyticsPeriod === '7d' ? 'Last 7 days' : 'Last 30 days'}</p>
              </div>
            </div>
          </div>
          {/* Column 2: QR Impressions */}
          <div
            className="relative p-4 rounded-2xl shadow-xl cursor-pointer
                       bg-white/30 backdrop-blur-md border border-white/20
                       hover:bg-white/40 transition-all duration-300"
            onClick={() => window.location.href = '/detailed-analytics'}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">QR Impressions</h2>
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <select
                  className="appearance-none w-full text-xs text-black border border-gray-200 rounded-md pl-5 pr-10 py-3 focus:outline-none bg-white"
                  value={qrSelectedPeriod}
                  onChange={handleQrPeriodChange}
                >
                  <option value="Today">Today</option>
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                </select>
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
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
            {qrSelectedPeriod === 'Today' && (
              <ul className="text-sm text-gray-600 space-y-1 pl-10">
                {qrTodayData.map((item, index) => (
                  <li key={index} className="flex items-center space-x-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: colors[index % colors.length] }}
                    ></span>
                    <span>
                      {item.name}: {item.value}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-6">
              <div className="pt-6 border-t border-gray-300 mb-2"></div>
              <Link
                to="/advertisements"
                className="text-white text-sm font-medium bg-[#1b5087] hover:bg-[#0E2A47] rounded-lg px-6 py-3 flex items-center justify-between hover:scale-105 transition-all duration-300 shadow-md hover:shadow-lg"
              >
                View Analytics <span className="ml-2">›</span>
              </Link>
            </div>
          </div>
          {/* Column 3: Average Mileage and Notification List */}
          <div className="flex flex-col space-y-6">
            {/* Average Mileage */}
            <div className="min-h-[268px] bg-white/30 backdrop-blur-md p-4 rounded-2xl shadow-lg cursor-pointer hover:shadow-xl transition-shadow border border-white/20 flex flex-col">
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
                  <span className="text-green-600">🚗 Per Car</span>
                  <span className="text-gray-800"> {analyticsSummary?.activeCars || 0} active vehicles</span>
                </p>
              </div>

              {/* Divider + Button (sticks to bottom) */}
              <div className="mt-auto pt-6 border-t border-gray-300">
                <Link
                  to="/advertisements"
                  className="text-white text-sm font-medium bg-[#1b5087] hover:bg-[#0E2A47] rounded-lg px-6 py-3 flex items-center justify-between hover:scale-105 transition-all duration-300 shadow-md hover:shadow-lg mt-2"
                >
                  View Performance <span className="ml-2">›</span>
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
        <div className="bg-white p-6 rounded-lg shadow-lg mb-6 cursor-pointer hover:shadow-xl transition-shadow" onClick={() => window.location.href = '/detailed-analytics'}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Car Location Heat Map</h2>
            <div className="text-sm text-gray-500">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
          <div className="relative bg-gray-100 rounded-lg overflow-hidden" style={{ height: '400px' }}>
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
                <div className="absolute top-8 left-12 w-16 h-16 bg-red-500 rounded-full opacity-60 animate-pulse"></div>
                <div className="absolute top-20 right-16 w-12 h-12 bg-orange-500 rounded-full opacity-50"></div>
                <div className="absolute bottom-16 left-20 w-14 h-14 bg-red-400 rounded-full opacity-55"></div>
                <div className="absolute top-32 left-1/3 w-10 h-10 bg-yellow-500 rounded-full opacity-45"></div>
                <div className="absolute bottom-32 right-1/4 w-8 h-8 bg-yellow-400 rounded-full opacity-40"></div>
                <div className="absolute top-1/2 left-1/4 w-12 h-12 bg-yellow-500 rounded-full opacity-50"></div>
                <div className="absolute top-16 left-2/3 w-6 h-6 bg-green-500 rounded-full opacity-35"></div>
                <div className="absolute bottom-20 left-1/2 w-8 h-8 bg-green-400 rounded-full opacity-30"></div>
                <div className="absolute top-2/3 right-8 w-7 h-7 bg-green-500 rounded-full opacity-40"></div>
                <div className="absolute top-40 right-1/3 w-5 h-5 bg-blue-500 rounded-full opacity-25"></div>
                <div className="absolute bottom-40 left-1/5 w-6 h-6 bg-purple-500 rounded-full opacity-30"></div>
                <div className="absolute top-1/4 right-1/5 w-4 h-4 bg-indigo-500 rounded-full opacity-35"></div>
              </div>
              <div className="absolute top-4 left-4 bg-white/80 px-2 py-1 rounded text-xs font-medium text-gray-700">
                Downtown Area
              </div>
              <div className="absolute top-4 right-4 bg-white/80 px-2 py-1 rounded text-xs font-medium text-gray-700">
                Mall District
              </div>
              <div className="absolute bottom-4 left-4 bg-white/80 px-2 py-1 rounded text-xs font-medium text-gray-700">
                Residential Zone
              </div>
              <div className="absolute bottom-4 right-4 bg-white/80 px-2 py-1 rounded text-xs font-medium text-gray-700">
                Highway Access
              </div>
            </div>
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white/90 px-4 py-2 rounded-lg shadow-sm">
              <div className="flex items-center space-x-4 text-xs">
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span>High Activity</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span>Medium Activity</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span>Low Activity</span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-red-50 p-3 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600">High Traffic Zones</p>
                  <p className="text-lg font-bold text-red-700">3</p>
                </div>
                <div className="text-red-500">🔥</div>
              </div>
            </div>
            <div className="bg-yellow-50 p-3 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-yellow-600">Medium Traffic</p>
                  <p className="text-lg font-bold text-yellow-700">3</p>
                </div>
                <div className="text-yellow-500">⚡</div>
              </div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600">Low Traffic</p>
                  <p className="text-lg font-bold text-green-700">3</p>
                </div>
                <div className="text-green-500">📍</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;