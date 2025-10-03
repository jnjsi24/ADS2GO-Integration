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
import { motion, AnimatePresence } from "framer-motion";
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
  RefreshCw,
  ChevronDown
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

  // ✅ Add these missing states
  const [selectedDateFilter, setSelectedDateFilter] = useState("Last 30 Days");
  const [showDateDropdown, setShowDateDropdown] = useState(false);

  const dateFilterOptions = [
    "Today",
    "Yesterday",
    "Last 7 Days",
    "Last 30 Days",
    "This Month",
    "Last Month",
  ];

  const handleDateFilterChange = (option: string) => {
    setSelectedDateFilter(option);
    setShowDateDropdown(false);
  };

  // Fetch dashboard stats
  const { data: statsData, loading: statsLoading, refetch: refetchStats } = useQuery(GET_SUPERADMIN_DASHBOARD_STATS, {
    pollInterval: 5000, // Refresh every 5 seconds for faster updates
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

      {/* Growth + Locations Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Growth Chart (takes 8/12 on large screens) */}
        <div className="lg:col-span-8 bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Growth Overview</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={userGrowthData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="users"
                stackId="1"
                stroke="#3B82F6"
                fill="#3B82F6"
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="drivers"
                stackId="1"
                stroke="#10B981"
                fill="#10B981"
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="ads"
                stackId="1"
                stroke="#8B5CF6"
                fill="#8B5CF6"
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top Locations (takes 4/12 on large screens) */}
        <div className="lg:col-span-4">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Top Locations</h3>
          <div className="space-y-3">
            {locationData.map((location, index) => (
              <div
                key={index}
                className="flex justify-between items-center bg-white shadow-md rounded-lg px-4 py-3 mb-3"
              >
                <span className="text-sm font-medium text-gray-700">
                  {location.location}
                </span>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <span>{location.users} users</span>
                  <span>{location.drivers} drivers</span>
                  <span className="font-medium text-green-600">
                    ₱{location.revenue.toLocaleString()}
                  </span>
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
      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-green-100 text-green-800 p-6 rounded-xl shadow-md border">
          <h4 className="text-sm font-medium">Active Users (30 days)</h4>
          <p className="text-2xl font-bold">{Math.floor((stats?.totalUsers || 0) * 0.85)}</p>
        </div>
        <div className="bg-yellow-100 text-yellow-800 p-6 rounded-xl shadow-md border">
          <h4 className="text-sm font-medium">New Users (7 days)</h4>
          <p className="text-2xl font-bold">{Math.floor((stats?.totalUsers || 0) * 0.12)}</p>
        </div>
        <div className="bg-gray-100 text-gray-800 p-6 rounded-xl shadow-md border">
          <h4 className="text-sm font-medium">Inactive Users</h4>
          <p className="text-2xl font-bold">{Math.floor((stats?.totalUsers || 0) * 0.15)}</p>
        </div>
      </div>
  
      {/* Bottom Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* User Growth (wider - left) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-xl shadow-sm border">
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

        {/* User Distribution (narrower - right) */}
        <div className="lg:col-span-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">User Distribution by Location</h3>
          <div className="space-y-3">
            {locationData.map((location, index) => (
              <div
                key={index}
                className="flex justify-between items-center bg-white shadow-md rounded-lg p-3 mb-3"
              >
                <span className="text-sm font-medium text-gray-700">{location.location}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{
                        width: `${(location.users / Math.max(...locationData.map(l => l.users))) * 100}%`,
                      }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600 w-12 text-right">{location.users}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
  

  const renderDriversTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Driver Growth (left, wider) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Driver Growth</h3>
          <ResponsiveContainer width="100%" height={350}>
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
  
        {/* Right side stat cards (2 per row) */}
        <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Avg Ads per Driver */}
          <div className="bg-yellow-100 p-4 rounded-xl shadow-sm border">
            <h4 className="text-sm text-gray-600">Avg. Ads per Driver</h4>
            <p className="text-2xl font-bold text-yellow-700">
              {Math.floor((stats?.totalAds || 0) / (stats?.totalDrivers || 1))}
            </p>
          </div>
  
          {/* Top Performers */}
          <div className="bg-green-100 p-4 rounded-xl shadow-sm border">
            <h4 className="text-sm text-gray-600">Top Performers</h4>
            <p className="text-2xl font-bold text-green-700">
              {Math.floor((stats?.totalDrivers || 0) * 0.2)}
            </p>
          </div>
  
          {/* New This Month */}
          <div className="bg-purple-100 p-4 rounded-xl shadow-sm border">
            <h4 className="text-sm text-gray-600">New This Month</h4>
            <p className="text-2xl font-bold text-purple-700">
              {Math.floor((stats?.totalDrivers || 0) * 0.12)}
            </p>
          </div>
  
          {/* Active Drivers */}
          <div className="bg-green-100 p-4 rounded-xl shadow-sm border">
            <h4 className="text-sm text-gray-600">Active Drivers</h4>
            <p className="text-2xl font-bold text-green-700">
              {Math.floor((stats?.totalDrivers || 0) * 0.78)}
            </p>
          </div>
  
          {/* Pending Approval */}
          <div className="bg-yellow-100 p-4 rounded-xl shadow-sm border">
            <h4 className="text-sm text-gray-600">Pending Approval</h4>
            <p className="text-2xl font-bold text-yellow-700">
              {Math.floor((stats?.totalDrivers || 0) * 0.15)}
            </p>
          </div>
  
          {/* Suspended */}
          <div className="bg-red-100 p-4 rounded-xl shadow-sm border">
            <h4 className="text-sm text-gray-600">Suspended</h4>
            <p className="text-2xl font-bold text-red-700">
              {Math.floor((stats?.totalDrivers || 0) * 0.07)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
  

  const renderAdsTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left - Ad Performance (Chart) */}
      <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border">
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
  
      {/* Right - Status + Metrics in 2 per row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Active Ads</h3>
          <span className="text-xl font-bold text-green-600">
            {Math.floor((stats?.totalAds || 0) * 0.72)}
          </span>
        </div>
  
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Pending Review</h3>
          <span className="text-xl font-bold text-yellow-600">
            {Math.floor((stats?.totalAds || 0) * 0.18)}
          </span>
        </div>
  
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Rejected</h3>
          <span className="text-xl font-bold text-red-600">
            {Math.floor((stats?.totalAds || 0) * 0.10)}
          </span>
        </div>
  
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Avg. CTR</h3>
          <span className="text-xl font-bold text-blue-600">7.2%</span>
        </div>
  
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Avg. Impressions</h3>
          <span className="text-xl font-bold text-green-600">2,450</span>
        </div>
  
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Top Performing Ad</h3>
          <span className="text-lg font-bold text-purple-600">Video Ad #123</span>
        </div>
      </div>
    </div>
  );
  

  const renderRevenueTab = () => (
    <div className="space-y-6">
      {/* --- Top Stat Cards --- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border text-center">
          <h3 className="text-sm font-medium text-gray-600">Monthly Revenue</h3>
          <p className="text-2xl font-bold text-green-600">
            ₱{stats?.totalRevenue?.toLocaleString() || 0}
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border text-center">
          <h3 className="text-sm font-medium text-gray-600">Avg. Revenue per Ad</h3>
          <p className="text-2xl font-bold text-blue-600">
            ₱{Math.floor((stats?.totalRevenue || 0) / (stats?.totalAds || 1)).toLocaleString()}
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border text-center">
          <h3 className="text-sm font-medium text-gray-600">Growth Rate</h3>
          <p className="text-2xl font-bold text-purple-600">+22.1%</p>
        </div>
      </div>
  
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Revenue Growth Chart - 7/12 */}
        <div className="lg:col-span-7 bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Growth</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => [`₱${value.toLocaleString()}`, 'Revenue']} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#10B981"
                fill="#10B981"
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue by Location - 5/12 */}
        <div className="lg:col-span-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Location</h3>
          <div className="space-y-3">
            {locationData.map((location, index) => (
              <div
                key={index}
                className="flex justify-between items-center bg-white shadow-md rounded-lg p-3 mb-3"
              >
                <span className="text-sm font-medium text-gray-700">{location.location}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{
                        width: `${(location.revenue / Math.max(...locationData.map(l => l.revenue))) * 100}%`,
                      }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600 w-20 text-right">
                    ₱{location.revenue.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
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
      <div className="mb-8">
        <Link
          to="/sadmin-dashboard"
          className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Dashboard
        </Link>
      </div>
      {/* Header */}
      {/* Header */}
<div className="mb-6">
  {/* Row 1: Title + Filters */}
  <div className="flex justify-between items-center mb-6">
    <h2 className="text-2xl font-semibold text-gray-800">Analytics Dashboard</h2>

    {/* Filters */}
    <div className="flex items-center gap-4">
      {/* Date Filter */}
      <div className="relative w-36">
        <button
          onClick={() => setShowDateDropdown(!showDateDropdown)}
          className="flex items-center justify-between w-full text-xs text-black rounded-lg px-4 py-3 shadow-md focus:outline-none bg-white gap-2"
        >
          {selectedDateFilter}
          <ChevronDown
            size={16}
            className={`transform transition-transform duration-200 ${
              showDateDropdown ? "rotate-180" : "rotate-0"
            }`}
          />
        </button>
        <AnimatePresence>
          {showDateDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute z-10 top-full mt-2 w-full rounded-lg shadow-lg bg-white overflow-hidden"
            >
              {dateFilterOptions.map((option) => (
                <button
                  key={option}
                  onClick={() => handleDateFilterChange(option)}
                  className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                >
                  {option}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  </div>

        {/* Row 2: Tabs (left) + Refresh button (right) */}
        <div className="flex justify-between items-center">
          {/* Tabs */}
          <nav className="flex space-x-8 px-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative group flex items-center py-3 px-1 font-medium text-sm transition-colors ${
                    isActive ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {tab.label}

                  {/* Animated underline */}
                  <span
                    className={`absolute bottom-0 left-0 h-0.5 w-full bg-blue-500 transform origin-left transition-transform duration-300 ease-out ${
                      isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                    }`}
                  />
                </button>
              );
            })}
          </nav>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="py-3 bg-[#feb011] text-xs font-semibold text-black/70 rounded-lg w-28 hover:bg-[#FF9B45] transition-colors flex items-center justify-center"
              >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>


      {/* Tab Content */}
      {renderTabContent()}
    </div>
  );
};

export default SadminAnalytics;