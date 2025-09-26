import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid,
  Legend
} from "recharts";
import { useQuery } from '@apollo/client';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  Users, 
  UserCheck, 
  TrendingUp, 
  DollarSign, 
  BarChart3, 
  PieChart as PieChartIcon,
  Calendar,
  Download,
  RefreshCw
} from 'lucide-react';
import { GET_SUPERADMIN_DASHBOARD_STATS, GET_USER_COUNTS_BY_PLAN } from '../../graphql/superadmin/queries/sadminNotificationQueries';

// Mock data for comprehensive analytics
const userGrowthData = [
  { month: "Jan", users: 120, drivers: 45, ads: 89 },
  { month: "Feb", users: 180, drivers: 62, ads: 134 },
  { month: "Mar", users: 250, drivers: 78, ads: 189 },
  { month: "Apr", users: 320, drivers: 95, ads: 245 },
  { month: "May", users: 380, drivers: 112, ads: 298 },
  { month: "Jun", users: 450, drivers: 128, ads: 356 },
  { month: "Jul", users: 520, drivers: 145, ads: 412 },
];

const revenueData = [
  { month: "Jan", revenue: 12000, ads: 89 },
  { month: "Feb", revenue: 18500, ads: 134 },
  { month: "Mar", revenue: 25200, ads: 189 },
  { month: "Apr", revenue: 31800, ads: 245 },
  { month: "May", revenue: 38400, ads: 298 },
  { month: "Jun", revenue: 45600, ads: 356 },
  { month: "Jul", revenue: 52800, ads: 412 },
];

const deviceStatusData = [
  { name: "Online", value: 78, color: "#10B981" },
  { name: "Offline", value: 15, color: "#EF4444" },
  { name: "Maintenance", value: 7, color: "#F59E0B" },
];

const adPerformanceData = [
  { name: "Video Ads", value: 45, impressions: 12500, clicks: 890 },
  { name: "Image Ads", value: 35, impressions: 9800, clicks: 650 },
  { name: "Text Ads", value: 20, impressions: 5600, clicks: 320 },
];

const locationData = [
  { location: "Metro Manila", users: 320, drivers: 95, revenue: 25000 },
  { location: "Cebu", users: 180, drivers: 45, revenue: 15000 },
  { location: "Davao", users: 120, drivers: 28, revenue: 9800 },
  { location: "Iloilo", users: 85, drivers: 22, revenue: 7200 },
  { location: "Others", users: 95, drivers: 18, revenue: 6800 },
];

const SadminAnalytics: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');
  const [dateRange, setDateRange] = useState('30d');
  const [refreshing, setRefreshing] = useState(false);

  // Fetch dashboard stats
  const { data: statsData, loading: statsLoading, refetch: refetchStats } = useQuery(GET_SUPERADMIN_DASHBOARD_STATS, {
    pollInterval: 60000, // Refresh every minute
    onError: (error) => {
      console.error("Error fetching super admin dashboard stats:", error);
    }
  });

  // Fetch plan data
  const { data: planData, loading: planLoading, refetch: refetchPlans } = useQuery(GET_USER_COUNTS_BY_PLAN, {
    onError: (error) => {
      console.error("Error fetching plan data:", error);
    }
  });

  const stats = statsData?.getSuperAdminDashboardStats;
  const plans = planData?.getUserCountsByPlan || [];

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchStats(), refetchPlans()]);
    } finally {
      setRefreshing(false);
    }
  };

  const exportData = () => {
    // Implement data export functionality
    console.log('Exporting analytics data...');
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'drivers', label: 'Drivers', icon: UserCheck },
    { id: 'ads', label: 'Ads', icon: TrendingUp },
    { id: 'revenue', label: 'Revenue', icon: DollarSign },
    { id: 'plans', label: 'Plans', icon: PieChartIcon },
  ];

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalUsers || 0}</p>
            </div>
            <Users className="h-8 w-8 text-blue-500" />
          </div>
          <div className="mt-2">
            <span className="text-sm text-green-600">+12.5%</span>
            <span className="text-sm text-gray-500 ml-1">vs last month</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Drivers</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalDrivers || 0}</p>
            </div>
            <UserCheck className="h-8 w-8 text-green-500" />
          </div>
          <div className="mt-2">
            <span className="text-sm text-green-600">+8.3%</span>
            <span className="text-sm text-gray-500 ml-1">vs last month</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Ads</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalAds || 0}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-purple-500" />
          </div>
          <div className="mt-2">
            <span className="text-sm text-green-600">+15.2%</span>
            <span className="text-sm text-gray-500 ml-1">vs last month</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">₱{stats?.totalRevenue?.toLocaleString() || 0}</p>
            </div>
            <DollarSign className="h-8 w-8 text-yellow-500" />
          </div>
          <div className="mt-2">
            <span className="text-sm text-green-600">+22.1%</span>
            <span className="text-sm text-gray-500 ml-1">vs last month</span>
          </div>
        </div>
      </div>

      {/* Growth Chart */}
      <div className="bg-white p-6 rounded-xl shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Growth Overview</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={userGrowthData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey="users" stackId="1" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} />
            <Area type="monotone" dataKey="drivers" stackId="1" stroke="#10B981" fill="#10B981" fillOpacity={0.6} />
            <Area type="monotone" dataKey="ads" stackId="1" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.6} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Device Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Device Status</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={deviceStatusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {deviceStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Locations</h3>
          <div className="space-y-3">
            {locationData.map((location, index) => (
              <div key={index} className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">{location.location}</span>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <span>{location.users} users</span>
                  <span>{location.drivers} drivers</span>
                  <span className="font-medium text-green-600">₱{location.revenue.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderUsersTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">User Growth</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={userGrowthData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="users" stroke="#3B82F6" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">User Distribution by Location</h3>
          <div className="space-y-3">
            {locationData.map((location, index) => (
              <div key={index} className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">{location.location}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{ width: `${(location.users / Math.max(...locationData.map(l => l.users))) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600 w-12 text-right">{location.users}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">User Activity</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Active Users (30 days)</span>
              <span className="text-lg font-semibold text-green-600">{Math.floor((stats?.totalUsers || 0) * 0.85)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">New Users (7 days)</span>
              <span className="text-lg font-semibold text-blue-600">{Math.floor((stats?.totalUsers || 0) * 0.12)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Inactive Users</span>
              <span className="text-lg font-semibold text-gray-600">{Math.floor((stats?.totalUsers || 0) * 0.15)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDriversTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Driver Growth</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={userGrowthData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="drivers" stroke="#10B981" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Driver Status Distribution</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Active Drivers</span>
              <span className="text-lg font-semibold text-green-600">{Math.floor((stats?.totalDrivers || 0) * 0.78)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Pending Approval</span>
              <span className="text-lg font-semibold text-yellow-600">{Math.floor((stats?.totalDrivers || 0) * 0.15)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Suspended</span>
              <span className="text-lg font-semibold text-red-600">{Math.floor((stats?.totalDrivers || 0) * 0.07)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Driver Performance</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Avg. Ads per Driver</span>
              <span className="text-lg font-semibold text-blue-600">{Math.floor((stats?.totalAds || 0) / (stats?.totalDrivers || 1))}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Top Performers</span>
              <span className="text-lg font-semibold text-green-600">{Math.floor((stats?.totalDrivers || 0) * 0.2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">New This Month</span>
              <span className="text-lg font-semibold text-purple-600">{Math.floor((stats?.totalDrivers || 0) * 0.12)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAdsTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Ad Performance</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={adPerformanceData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="impressions" fill="#3B82F6" name="Impressions" />
            <Bar dataKey="clicks" fill="#10B981" name="Clicks" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Ad Status Distribution</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Active Ads</span>
              <span className="text-lg font-semibold text-green-600">{Math.floor((stats?.totalAds || 0) * 0.72)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Pending Review</span>
              <span className="text-lg font-semibold text-yellow-600">{Math.floor((stats?.totalAds || 0) * 0.18)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Rejected</span>
              <span className="text-lg font-semibold text-red-600">{Math.floor((stats?.totalAds || 0) * 0.10)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Ad Performance Metrics</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Avg. CTR</span>
              <span className="text-lg font-semibold text-blue-600">7.2%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Avg. Impressions</span>
              <span className="text-lg font-semibold text-green-600">2,450</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Top Performing Ad</span>
              <span className="text-lg font-semibold text-purple-600">Video Ad #123</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderRevenueTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Growth</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(value) => [`₱${value.toLocaleString()}`, 'Revenue']} />
            <Area type="monotone" dataKey="revenue" stroke="#10B981" fill="#10B981" fillOpacity={0.6} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Location</h3>
          <div className="space-y-3">
            {locationData.map((location, index) => (
              <div key={index} className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">{location.location}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{ width: `${(location.revenue / Math.max(...locationData.map(l => l.revenue))) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600 w-20 text-right">₱{location.revenue.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Metrics</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Monthly Revenue</span>
              <span className="text-lg font-semibold text-green-600">₱{stats?.totalRevenue?.toLocaleString() || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Avg. Revenue per Ad</span>
              <span className="text-lg font-semibold text-blue-600">₱{Math.floor((stats?.totalRevenue || 0) / (stats?.totalAds || 1))}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Growth Rate</span>
              <span className="text-lg font-semibold text-purple-600">+22.1%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPlansTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan, index) => (
          <div key={plan.planId || index} className="bg-white p-6 rounded-xl shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{plan.planName}</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Users</span>
                <span className="text-lg font-semibold text-blue-600">{plan.userCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Active Ads</span>
                <span className="text-lg font-semibold text-green-600">{plan.activeAdsCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Revenue</span>
                <span className="text-lg font-semibold text-yellow-600">₱{plan.totalRevenue?.toLocaleString() || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Price</span>
                <span className="text-lg font-semibold text-gray-900">₱{plan.planDetails?.totalPrice?.toLocaleString() || 0}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Plan Performance</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={plans}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="planName" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="userCount" fill="#3B82F6" name="Users" />
            <Bar dataKey="activeAdsCount" fill="#10B981" name="Active Ads" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverviewTab();
      case 'users':
        return renderUsersTab();
      case 'drivers':
        return renderDriversTab();
      case 'ads':
        return renderAdsTab();
      case 'revenue':
        return renderRevenueTab();
      case 'plans':
        return renderPlansTab();
      default:
        return renderOverviewTab();
    }
  };

  if (statsLoading || planLoading) {
    return (
      <div className="p-8 pl-72 bg-[#f9f9fc] min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-8 pl-72 bg-[#f9f9fc] min-h-screen text-gray-800 font-sans">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center space-x-4">
          <Link
            to="/sadmin-dashboard"
            className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Dashboard
          </Link>
          <div>
            <h2 className="text-2xl font-semibold text-gray-800">
              Analytics Dashboard
            </h2>
            <p className="text-sm text-gray-500">
              Comprehensive insights and performance metrics
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={exportData}
            className="flex items-center bg-blue-600 text-white rounded-lg px-4 py-2 text-sm hover:bg-blue-700 transition-colors"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {renderTabContent()}
    </div>
  );
};

export default SadminAnalytics;
