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

const DetailedAnalytics: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<'1d' | '7d' | '30d'>('7d');
  const [selectedMetric, setSelectedMetric] = useState<'impressions' | 'plays' | 'completion' | 'revenue'>('impressions');
  const [selectedView, setSelectedView] = useState<'overview' | 'performance' | 'impressions' | 'display' | 'qr'>('overview');
  const [userFirstName, setUserFirstName] = useState('User');

  // Fetch analytics data
  const { data: analyticsData, loading: analyticsLoading, error: analyticsError, refetch: refetchAnalytics } = useQuery(GET_USER_ANALYTICS, {
    variables: { period: selectedPeriod },
    pollInterval: 30000, // Refresh every 30 seconds
    onError: (error) => {
      console.error('Analytics fetch error:', error);
    }
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
      } catch (error) {
        console.error('Error parsing user data from storage:', error);
      }
    };

    fetchUserData();
  }, []);

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
    { name: 'Morning', value: 55, impressions: 1870 },
    { name: 'Afternoon', value: 25, impressions: 850 },
    { name: 'Evening', value: 20, impressions: 680 },
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
      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Impressions</p>
              <p className="text-3xl font-bold text-gray-900">
                {analyticsLoading ? '...' : analyticsSummary.totalAdImpressions.toLocaleString()}
              </p>
              <p className="text-sm text-green-600 flex items-center mt-1">
                <TrendingUp className="w-4 h-4 mr-1" />
                +12% from last period
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
                +8% from last period
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
              <p className="text-sm text-gray-600 mb-1">Completion Rate</p>
              <p className="text-3xl font-bold text-gray-900">
                {analyticsLoading ? '...' : analyticsSummary.averageCompletionRate.toFixed(1)}%
              </p>
              <p className="text-sm text-green-600 flex items-center mt-1">
                <TrendingUp className="w-4 h-4 mr-1" />
                +3% from last period
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
              <p className="text-sm text-gray-600 mb-1">Display Time</p>
              <p className="text-3xl font-bold text-gray-900">
                {analyticsLoading ? '...' : formatDisplayTime(analyticsSummary.totalDisplayTime)}
              </p>
              <p className="text-sm text-green-600 flex items-center mt-1">
                <TrendingUp className="w-4 h-4 mr-1" />
                +15% from last period
              </p>
            </div>
            <div className="p-3 bg-orange-100 rounded-full">
              <Clock className="w-6 h-6 text-orange-600" />
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
            onChange={(e) => setSelectedMetric(e.target.value as 'impressions' | 'plays' | 'completion' | 'revenue')}
          >
            <option value="impressions">Impressions</option>
            <option value="plays">Plays</option>
            <option value="completion">Completion Rate</option>
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
                name === 'revenue' ? `$${value}` :
                `${value}%`,
                name === 'impressions' ? 'Impressions' :
                name === 'adsPlayed' ? 'Plays' : 
                name === 'revenue' ? 'Revenue' : 'Completion Rate'
              ]}
            />
            <Bar dataKey={selectedMetric === 'impressions' ? 'impressions' : selectedMetric === 'plays' ? 'adsPlayed' : selectedMetric === 'revenue' ? 'revenue' : 'completionRate'} fill="#1b5087" />
            <Line type="monotone" dataKey={selectedMetric === 'impressions' ? 'impressions' : selectedMetric === 'plays' ? 'adsPlayed' : selectedMetric === 'revenue' ? 'revenue' : 'completionRate'} stroke="#3674B5" strokeWidth={2} />
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
        <h3 className="text-lg font-semibold text-gray-800 mb-4">QR Impressions Analysis</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 className="text-md font-medium text-gray-700 mb-3">Time Distribution</h4>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={qrImpressionsData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}%`}
                >
                  {qrImpressionsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [value, 'Percentage']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h4 className="text-md font-medium text-gray-700 mb-3">QR Scan Details</h4>
            <div className="space-y-4">
              {qrImpressionsData.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: colors[index % colors.length] }}
                    ></div>
                    <span className="font-medium text-gray-800">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{item.impressions.toLocaleString()}</p>
                    <p className="text-sm text-gray-500">impressions</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
        <div className="flex border-b border-gray-200">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'performance', label: 'Performance', icon: TrendingUp },
            { id: 'impressions', label: 'Impressions', icon: Eye },
            { id: 'display', label: 'Display Time', icon: Clock },
            { id: 'qr', label: 'QR Impressions', icon: Target }
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

      {/* Top Performing Ads */}
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
                    <p className="text-sm text-gray-500">{ad.playCount} plays • {ad.impressions} impressions</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-800">{ad.averageCompletionRate.toFixed(1)}%</p>
                  <p className="text-sm text-gray-500">completion rate</p>
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
