import React, { useState, useEffect } from 'react';
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
import { ArrowLeft, Download, RefreshCw, TrendingUp, Eye, Play, Clock, Target, Users, MapPin, Calendar, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUserAuth } from '../../contexts/UserAuthContext';

const DetailedAnalytics: React.FC = () => {
  const { user } = useUserAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<'1d' | '7d' | '30d'>('7d');
  const [selectedMetric, setSelectedMetric] = useState<'impressions' | 'plays' | 'completion' | 'qr' | 'revenue'>('impressions');
  const [selectedView, setSelectedView] = useState<'overview' | 'performance' | 'impressions' | 'display' | 'qr' | 'tablets' | 'ads'>('overview');
  const [userFirstName, setUserFirstName] = useState('User');

  // Fetch analytics data
  const { data: analyticsData, loading: analyticsLoading, error: analyticsError, refetch: refetchAnalytics } = useQuery(GET_USER_ANALYTICS, {
    variables: { period: selectedPeriod },
    pollInterval: 5000, // Refresh every 5 seconds for faster updates
    onError: (error) => {
      console.error('Analytics fetch error:', error);
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

  // Get analytics summary data - Updated for UserAnalytics system
  const analyticsSummary = analyticsData?.getUserAnalytics?.summary || {
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

  // Format display time
  const formatDisplayTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

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

  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPeriod = e.target.value as '1d' | '7d' | '30d';
    setSelectedPeriod(newPeriod);
    refetchAnalytics({ period: newPeriod });
  };

  const handleRefresh = () => {
    refetchAnalytics();
  };

  const exportData = () => {
    // Implement data export functionality
    console.log('Exporting analytics data...');
  };

  const renderOverviewSection = () => (
    <div className="space-y-6">
      {/* Key Metrics Overview - Updated for UserAnalytics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Impressions</p>
              <p className="text-3xl font-bold text-gray-900">
                {analyticsLoading ? '...' : analyticsSummary.totalAdImpressions.toLocaleString()}
              </p>
              <p className="text-sm text-green-600 flex items-center mt-1">
                <TrendingUp className="w-4 h-4 mr-1" />
                Real-time data
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Eye className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

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
          <ComposedChart data={analyticsData?.getUserAnalytics?.dailyStats || weeklyData}>
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
                <Tooltip formatter={(value) => [formatDisplayTime(value), 'Display Time']} />
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600">Total Impressions</p>
                <p className="text-2xl font-bold text-purple-700">
                  {analyticsLoading ? '...' : analyticsSummary.totalAdImpressions.toLocaleString()}
                </p>
              </div>
              <div className="text-purple-500">👁️</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 className="text-md font-medium text-gray-700 mb-3">QR Scans Over Time</h4>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analyticsData?.getUserAnalytics?.dailyStats || []}>
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
              {analyticsData?.getUserAnalytics?.adPerformance?.slice(0, 5).map((ad, index) => (
                <div key={ad.adId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: colors[index % colors.length] }}
                    ></div>
                    <span className="font-medium text-gray-800">{ad.adTitle}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{ad.totalQRScans.toLocaleString()}</p>
                    <p className="text-sm text-gray-500">{ad.qrScanConversionRate.toFixed(1)}% conversion</p>
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600">Total Impressions</p>
                <p className="text-2xl font-bold text-purple-700">
                  {analyticsLoading ? '...' : analyticsSummary.totalAdImpressions.toLocaleString()}
                </p>
              </div>
              <div className="text-purple-500">👁️</div>
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
              {analyticsData?.getUserAnalytics?.deviceStats?.map((device, index) => (
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
              )) || (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    <p>No device data available</p>
                    <p className="text-sm mt-1">Data will appear here once devices start reporting</p>
                  </td>
                </tr>
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600">Total Impressions</p>
                <p className="text-2xl font-bold text-purple-700">
                  {analyticsLoading ? '...' : analyticsSummary.totalAdImpressions.toLocaleString()}
                </p>
              </div>
              <div className="text-purple-500">👁️</div>
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
              {analyticsData?.getUserAnalytics?.adPerformance?.map((ad) => (
                <tr key={ad.adId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{ad.adTitle}</div>
                      <div className="text-sm text-gray-500">ID: {ad.adId}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{ad.totalMaterials}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{ad.totalAdImpressions.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDisplayTime(ad.totalAdPlayTime)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{ad.totalQRScans.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{ad.averageAdCompletionRate.toFixed(1)}%</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{ad.qrScanConversionRate.toFixed(1)}%</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {ad.lastUpdated ? new Date(ad.lastUpdated).toLocaleDateString() : 'N/A'}
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
            <BarChart data={analyticsData?.getUserAnalytics?.adPerformance || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="adTitle" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={100} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                formatter={(value, name) => [
                  name === 'totalAdImpressions' ? value.toLocaleString() : 
                  name === 'totalAdPlayTime' ? formatDisplayTime(value) :
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
      {analyticsData?.getUserAnalytics?.adPerformance && analyticsData.getUserAnalytics.adPerformance.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mt-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Top Performing Ads</h3>
          <div className="space-y-4">
            {analyticsData.getUserAnalytics.adPerformance.slice(0, 5).map((ad, index) => (
              <div key={ad.adId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-[#1b5087] text-white rounded-full flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{ad.adTitle}</p>
                    <p className="text-sm text-gray-500">
                      {ad.totalAdImpressions.toLocaleString()} impressions • {ad.totalQRScans} QR scans • {ad.totalMaterials} materials
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-800">{ad.averageAdCompletionRate.toFixed(1)}%</p>
                  <p className="text-sm text-gray-500">completion rate</p>
                  <p className="text-xs text-gray-400">{ad.qrScanConversionRate.toFixed(1)}% QR conversion</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading State */}
      {analyticsLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg flex items-center space-x-3">
            <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-gray-700">Loading analytics data...</span>
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

