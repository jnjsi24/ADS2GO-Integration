import React, { useState, useEffect, ChangeEvent } from 'react';
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
} from 'recharts';
import { Link } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { GET_USER_ANALYTICS } from '../../graphql/user/queries/getUserAnalytics';

const Dashboard = () => {
  const [selectedOption, setSelectedOption] = useState('Drivers');
  // Explicitly type selectedPeriod to the union of its possible values
  const [selectedPeriod, setSelectedPeriod] = useState<'Monthly' | 'Weekly' | 'Daily'>('Monthly');
  // Changed initial state from 'All time' to 'Today'
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
    pollInterval: 30000, // Refresh every 30 seconds
    onError: (error) => {
      console.error('Analytics fetch error:', error);
    }
  });

  // Get user's first name from localStorage on component mount
  useEffect(() => {
    const fetchUserData = () => {
      try {
        // First, try to get user data from localStorage
        const userData = localStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          console.log('User data from localStorage:', user);
          
          // Check various possible property names for first name
          const firstName = user.firstName || user.first_name || user.name?.split(' ')[0] || user.displayName?.split(' ')[0];
          
          if (firstName) {
            setUserFirstName(firstName);
            console.log('First name found:', firstName);
            return;
          }
        }

        // Alternative: Try to get from sessionStorage
        const sessionUserData = sessionStorage.getItem('user');
        if (sessionUserData) {
          const user = JSON.parse(sessionUserData);
          console.log('User data from sessionStorage:', user);
          
          const firstName = user.firstName || user.first_name || user.name?.split(' ')[0] || user.displayName?.split(' ')[0];
          
          if (firstName) {
            setUserFirstName(firstName);
            console.log('First name found in session:', firstName);
            return;
          }
        }

        // Alternative: Try to get from other common storage keys
        const authData = localStorage.getItem('authData') || localStorage.getItem('currentUser') || localStorage.getItem('userInfo');
        if (authData) {
          const user = JSON.parse(authData);
          console.log('User data from alternative storage:', user);
          
          const firstName = user.firstName || user.first_name || user.name?.split(' ')[0] || user.displayName?.split(' ')[0];
          
          if (firstName) {
            setUserFirstName(firstName);
            console.log('First name found in alternative storage:', firstName);
            return;
          }
        }

        console.log('No user data found in any storage, keeping default "User"');
        
      } catch (error) {
        console.error('Error parsing user data from storage:', error);
        // Keep default 'User' if there's an error
      }
    };

    // Call immediately
    fetchUserData();

    // Set up an interval to check periodically in case data is loaded after component mount
    const interval = setInterval(fetchUserData, 1000);

    // Clean up interval after 5 seconds (5 checks)
    setTimeout(() => {
      clearInterval(interval);
    }, 5000);

    // Cleanup function
    return () => {
      clearInterval(interval);
    };
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

  // Dummy data for weekly and daily, you would replace this with actual data
  const weeklyBarData = [
    { day: 'Week 1', profit: 800, loss: 1500 },
    { day: 'Week 2', profit: 1500, loss: 700 },
    { day: 'Week 3', profit: 600, loss: 7000 },
    { day: 'Week 4', profit: 900, loss: 900 },
    { day: 'Week 5', profit: 1200, loss: 700 },
  ];

  const dailyBarData = [
    { day: 'Monday', profit: 300, loss: 100 },
    { day: 'Tueday', profit: 400, loss: 150 },
    { day: 'Wednesday', profit: 250, loss: 80 },
    { day: 'Thursday', profit: 350, loss: 120 },
    { day: 'Friday', profit: 500, loss: 200 },
    { day: 'Saturday', profit: 600, loss: 250 },
    { day: 'Sunday', profit: 200, loss: 70 },
  ];

  // QR Impressions data
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

  const colors = ['#0E2A47', '#1b5087', '#3674B5', '#E78B48', '#FFAB5B', '#D4C9BE', '#EFEEEA']; // Colors for the pie chart


  const calculateFinancials = (period: 'Monthly' | 'Weekly' | 'Daily') => {
    let totalProfit = 0;
    let totalLoss = 0;
    let currentData = [];
    let label = '';

    switch (period) {
      case 'Monthly':
        currentData = barData;
        label = 'Annual'; // Since barData represents a full year
        break;
      case 'Weekly':
        currentData = weeklyBarData; // Use weekly data
        label = 'This Week';
        break;
      case 'Daily':
        currentData = dailyBarData; // Use daily data
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
  }, [selectedPeriod]); // Recalculate when selectedPeriod changes

  const handlePeriodChange = (e: ChangeEvent<HTMLSelectElement>) => {
    // Cast e.target.value to the specific union type
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

  // Function to get data for QR Impressions pie chart based on selected period
  const getQrChartData = () => {
    // Define a type for the QR data items
    type QrDataItem = { name: string; value: number; };

    switch (qrSelectedPeriod) {
      case 'Weekly':
        return qrWeeklyData;
      case 'Daily':
        return qrDailyData;
      case 'Today':
        return qrTodayData;
      default:
        // This default case ensures a fallback, though it shouldn't be reached
        // if qrSelectedPeriod is always one of the specified types.
        return qrTodayData;
    }
  };

  const handleQrPeriodChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setQrSelectedPeriod(e.target.value as 'Weekly' | 'Daily' | 'Today'); // Removed 'All time' from type
  };

  const handleAnalyticsPeriodChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const newPeriod = e.target.value as '1d' | '7d' | '30d';
    setAnalyticsPeriod(newPeriod);
    refetchAnalytics({ period: newPeriod });
  };

  // Get analytics summary data
  const analyticsSummary = analyticsData?.getUserAnalytics?.summary || {
    totalAdImpressions: 0,
    totalAdsPlayed: 0,
    totalDisplayTime: 0,
    averageCompletionRate: 0,
    totalAds: 0,
    activeAds: 0
  };

  // Format display time
  const formatDisplayTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };


  return (
    <div className="min-h-screen bg-white pl-72 pr-5 p-10">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-800">Welcome back, {userFirstName}!</h1>
          <p className="text-gray-500 text-sm">Here's your analytic detail</p>
        </div>
      </div>

      {/* Metrics Section - Adjusted Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {/* Profit & Loss Overview - Now spans 2 columns */}
        <div className="bg-[#1b5087] p-6 rounded-lg shadow-lg col-span-2 text-white cursor-pointer hover:bg-[#0E2A47] transition-colors" onClick={() => window.location.href = '/detailed-analytics'}>
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

          {/* Playing Ad Section - Aesthetic Enhancement */}
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
                {analyticsLoading ? '...' : analyticsSummary.totalAdImpressions.toLocaleString()}
              </p>
              <p className="text-sm text-gray-300">Total Ad Impressions</p>
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

        {/* Ad Impressions */}
        <div className="bg-white p-4 rounded-lg shadow-lg cursor-pointer hover:shadow-xl transition-shadow" onClick={() => window.location.href = '/detailed-analytics'}>
          <div className="flex justify-between items-center mt-8 pl-4">
            <span className="text-gray-500 text-lg">Ad Impressions</span>
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <select
                className="text-xs text-gray-600 bg-white rounded-md pl-3 pr-8 py-1 border border-gray-200 focus:outline-none appearance-none"
                value={analyticsPeriod}
                onChange={handleAnalyticsPeriodChange}
              >
                <option value="1d">Last 24h</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </select>
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
          <p className="text-5xl font-bold text-[#1b5087] pl-4">
            {analyticsLoading ? '...' : analyticsSummary.totalAdImpressions.toLocaleString()}
          </p>
          <p className="text-sm pt-2 pl-4">
            <span className="text-green-600">↑ Active</span>
            <span className="text-black"> {analyticsSummary.activeAds} ads</span>
          </p>
          <div className="mt-32">
            <div className="pt-6 border-t border-gray-300 mb-2"></div>
            <Link
              to="/advertisements"
              className="text-white text-sm bg-[#1b5087] hover:bg-[#0E2A47] rounded-lg px-4 py-2 flex items-center justify-between hover:scale-105 transition-all duration-300"
            >
              View Analytics <span>→</span>
            </Link>
          </div>
        </div>

        {/* Total Display Time */}
        <div className="bg-white p-4 rounded-lg shadow-lg cursor-pointer hover:shadow-xl transition-shadow" onClick={() => window.location.href = '/detailed-analytics'}>
          <div className="flex justify-between items-center mt-8 pl-4">
            <span className="text-gray-500 text-lg">Display Time</span>
          </div>
          <p className="text-3xl font-bold text-[#1b5087] pl-4">
            {analyticsLoading ? '...' : formatDisplayTime(analyticsSummary.totalDisplayTime)}
          </p>
          <p className="text-sm pt-2 pl-4">
            <span className="text-blue-600">📺 Playing</span>
            <span className="text-black"> {analyticsSummary.totalAdsPlayed} ads</span>
          </p>
          <div className="mt-32">
            <div className="pt-6 border-t border-gray-300 mb-2"></div>
            <Link
              to="/advertisements"
              className="text-white text-sm bg-[#1b5087] hover:bg-[#0E2A47] rounded-lg px-4 py-2 flex items-center justify-between hover:scale-105 transition-all duration-300"
            >
              View Performance <span>→</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Analytics Section */}
      {analyticsData?.getUserAnalytics && (
        <div className="bg-white p-6 rounded-lg shadow-lg mb-6 cursor-pointer hover:shadow-xl transition-shadow" onClick={() => window.location.href = '/detailed-analytics'}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Ad Performance Analytics</h2>
            <div className="text-sm text-gray-500">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600">Completion Rate</p>
                  <p className="text-2xl font-bold text-blue-700">
                    {analyticsSummary.averageCompletionRate.toFixed(1)}%
                  </p>
                </div>
                <div className="text-blue-500">📊</div>
              </div>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600">Completion Rate</p>
                  <p className="text-2xl font-bold text-green-700">
                    {analyticsSummary.averageCompletionRate.toFixed(1)}%
                  </p>
                </div>
                <div className="text-green-500">📊</div>
              </div>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600">Total Ads</p>
                  <p className="text-2xl font-bold text-purple-700">
                    {analyticsSummary.totalAds}
                  </p>
                </div>
                <div className="text-purple-500">📺</div>
              </div>
            </div>
            
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-600">Active Ads</p>
                  <p className="text-2xl font-bold text-orange-700">
                    {analyticsSummary.activeAds}
                  </p>
                </div>
                <div className="text-orange-500">🎬</div>
              </div>
            </div>
          </div>

          {/* Daily Stats Chart */}
          {analyticsData.getUserAnalytics.dailyStats && analyticsData.getUserAnalytics.dailyStats.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-800 mb-4">Daily Performance</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={analyticsData.getUserAnalytics.dailyStats}>
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                    formatter={(value, name) => [
                      name === 'impressions' ? value.toLocaleString() : 
                      name === 'displayTime' ? formatDisplayTime(value) : value,
                      name === 'impressions' ? 'Impressions' :
                      name === 'displayTime' ? 'Display Time' : 'Ads Played'
                    ]}
                  />
                  <Bar dataKey="impressions" fill="#1b5087" name="impressions" />
                  <Bar dataKey="adsPlayed" fill="#3674B5" name="adsPlayed" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top Performing Ads */}
          {analyticsData.getUserAnalytics.adPerformance && analyticsData.getUserAnalytics.adPerformance.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-4">Top Performing Ads</h3>
              <div className="space-y-3">
                {analyticsData.getUserAnalytics.adPerformance.slice(0, 5).map((ad, index) => (
                  <div key={ad.adId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-[#1b5087] text-white rounded-full flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{ad.adTitle}</p>
                        <p className="text-sm text-gray-500">{ad.playCount} plays • {ad.impressions} impressions</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-800">{ad.averageCompletionRate.toFixed(1)}%</p>
                      <p className="text-sm text-gray-500">completion</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* QR Impressions Section */}
      <div className="grid grid-cols-1 gap-6">
        {/* QR Impressions - Now spans full width */}
        <div className="bg-white p-4 rounded-lg shadow-lg cursor-pointer hover:shadow-xl transition-shadow" onClick={() => window.location.href = '/detailed-analytics'}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800 pt-3">QR Impressions</h2>
            <div className="relative pt-3" onClick={(e) => e.stopPropagation()}>
              <select
                className="appearance-none w-full text-xs text-black border border-gray-200 rounded-md pl-5 pr-10 py-3 focus:outline-none bg-white"
                value={qrSelectedPeriod}
                onChange={handleQrPeriodChange}
              >
                {/* Removed 'All time' option */}
                <option value="Weekly">Weekly</option>
                <option value="Daily">Daily</option>
                <option value="Today">Today</option>
              </select>
              <div className="absolute right-3 top-1/2 pt-3 transform -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
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

          {qrSelectedPeriod === 'Daily' && (
            <div className="flex justify-around text-sm text-gray-600">
              <ul className="space-y-1">
                {qrDailyData.slice(0, 4).map((item, index) => (
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
              <ul className="space-y-1">
                {qrDailyData.slice(4).map((item, index) => (
                  <li key={index + 4} className="flex items-center space-x-2 pl-10"> {/* Use a unique key */}
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: colors[(index + 4) % colors.length] }}
                    ></span>
                    <span>
                      {item.name}: {item.value}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {qrSelectedPeriod === 'Weekly' && (
            <div className="flex justify-around text-sm text-gray-600">
              <ul className="space-y-1">
                {qrWeeklyData.slice(0, 3).map((item, index) => (
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
              <ul className="space-y-1">
                {qrWeeklyData.slice(3).map((item, index) => (
                  <li key={index + 3} className="flex items-center space-x-2"> {/* Use a unique key */}
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: colors[(index + 3) % colors.length] }}
                    ></span>
                    <span>
                      {item.name}: {item.value}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

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
        </div>
      </div>
    </div>
  );
};

export default Dashboard;