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
  ChevronDown,
  UserPlus,
  UserX,
  Wallet,
  Clock,
  Trophy,
  Star,
  Eye,
  Percent,
  XCircle,
  PlayCircle
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
        <div className="bg-blue-100 p-6 rounded-xl shadow-md border flex items-center justify-between">
          {/* Left side: Stats */}
          <div className="flex flex-col items-start">
            <Users className="h-10 w-10 text-white bg-blue-400 p-2 rounded-full mb-1" />
            <p className="text-sm font-medium text-gray-600">Total Users</p>
          </div>
          {/* Right side: Icon + Label */}
          <div className="flex flex-col text-right">
            <p className="text-2xl font-bold text-gray-900">{stats?.totalUsers || 0} Users</p>
            <div className="mt-1 text-right">
              <span className="text-sm text-green-600 font-medium">+12.5%</span>
            </div>
          </div>
        </div>


        <div className="bg-green-100 p-6 rounded-xl shadow-md border flex items-center justify-between">
          {/* Left side: Icon + Label */}
          <div className="flex flex-col items-start">
            <UserCheck className="h-10 w-10 text-white bg-green-400 p-2 rounded-full mb-1" />
            <p className="text-sm font-medium text-gray-600">Total Drivers</p>
          </div>

          {/* Right side: Stats */}
          <div className="flex flex-col text-right">
            <p className="text-2xl font-bold text-gray-900">{stats?.totalDrivers || 0} Drivers</p>
            <div className="mt-1 text-right">
              <span className="text-sm text-green-600 font-medium">+8.3%</span>
            </div>
          </div>
        </div>

        <div className="bg-purple-100 p-6 rounded-xl shadow-md border flex items-center justify-between">
          {/* Left side: Icon + Label */}
          <div className="flex flex-col items-start">
            <TrendingUp className="h-10 w-10 text-white bg-purple-400 p-2 rounded-full mb-1" />
            <p className="text-sm font-medium text-gray-600">Total Ads</p>
          </div>

          {/* Right side: Stats */}
          <div className="flex flex-col text-right">
            <p className="text-2xl font-bold text-gray-900">{stats?.totalAds || 0} Ads</p>
            <div className="mt-1 text-right">
              <span className="text-sm text-green-600 font-medium">+15.2%</span>
            </div>
          </div>
        </div>

        <div className="bg-yellow-100 p-6 rounded-xl shadow-md border flex items-center justify-between">
          {/* Left side: Icon + Label */}
          <div className="flex flex-col items-start">
            <DollarSign className="h-10 w-10 text-white bg-yellow-400 p-2 rounded-full mb-1" />
            <p className="text-sm font-medium text-gray-600">Total Revenue</p>
          </div>

          {/* Right side: Stats */}
          <div className="flex flex-col text-right">
            <p className="text-2xl font-bold text-gray-900">₱{stats?.totalRevenue?.toLocaleString() || 0}</p>
            <div className="mt-1 text-right">
              <span className="text-sm text-green-600 font-medium">+22.1%</span>
            </div>
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT SIDE */}
        <div className="lg:col-span-8 space-y-6">
          {/* Top Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Active Users */}
            <div className="bg-green-100 text-green-800 p-6 rounded-xl shadow-md border flex items-center justify-between">
              {/* Left side: icon */}
              <div>
                <UserCheck className="h-12 w-12 text-white rounded-full bg-green-400 p-2" />
              </div>

              {/* Right side: label + value */}
              <div className="flex flex-col items-end text-right">
                <p className="text-3xl font-bold text-green-700">
                  {Math.floor((stats?.totalUsers || 0) * 0.85)}
                </p>
                <h4 className="text-sm font-medium">Active Users</h4>
              </div>
            </div>

            {/* New Users */}
            <div className="bg-yellow-100 text-yellow-800 p-6 rounded-xl shadow-md border flex items-center justify-between">
              {/* Left side: icon */}
              <div>
                <UserPlus className="h-12 w-12 text-white rounded-full bg-yellow-400 p-2" />
              </div>

              {/* Right side: label + value */}
              <div className="flex flex-col items-end text-right">
                <p className="text-3xl font-bold text-yellow-700">
                  {Math.floor((stats?.totalUsers || 0) * 0.12)}
                </p>
                <h4 className="text-sm font-medium">New Users</h4>
              </div>
            </div>

            {/* Inactive Users */}
            <div className="bg-gray-100 text-gray-800 p-6 rounded-xl shadow-md border flex items-center justify-between">
              {/* Left side: icon */}
              <div>
                <UserX className="h-12 w-12 text-white rounded-full bg-gray-400 p-2" />
              </div>

              {/* Right side: label + value */}
              <div className="flex flex-col items-end text-right">
                <p className="text-3xl font-bold text-gray-700">
                  {Math.floor((stats?.totalUsers || 0) * 0.15)}
                </p>
                <h4 className="text-sm font-medium">Inactive Users</h4>
              </div>
            </div>
          </div>


  
          {/* User Growth Chart */}
          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              User Growth
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={userGrowthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="users"
                  stroke="#3B82F6"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
  
        {/* RIGHT SIDE */}
        <div className="lg:col-span-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            User Distribution by Location
          </h3>
          <div className="space-y-3">
            {locationData.map((location, index) => (
              <div
                key={index}
                className="flex justify-between items-center bg-white shadow-md rounded-lg p-3 mb-3"
              >
                <span className="text-sm font-medium text-gray-700">
                  {location.location}
                </span>
                <div className="flex items-center space-x-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{
                        width: `${
                          (location.users /
                            Math.max(...locationData.map((l) => l.users))) *
                          100
                        }%`,
                      }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600 w-12 text-right">
                    {location.users}
                  </span>
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
        <div className="lg:col-span-8 bg-white p-6 rounded-xl shadow-sm border">
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
        <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Avg Ads per Driver */}
          <div className="bg-blue-100 p-4 rounded-xl shadow-md border relative">
            <div className="flex justify-between items-start">
              <div className="p-2 bg-blue-400 text-white rounded-full">
                <BarChart className="w-5 h-5" />
              </div>
              <p className="text-3xl font-bold text-blue-700">
                {Math.floor((stats?.totalAds || 0) / (stats?.totalDrivers || 1))}
              </p>
            </div>
            <h4 className="text-sm font-medium text-right text-gray-700 mt-4">Avg. Ads/Driver</h4>
          </div> 

          {/* Pending Approval */}
          <div className="bg-yellow-100 p-4 rounded-xl shadow-md border relative">
            <div className="flex justify-between items-start">
              <div className="p-2 bg-yellow-400 text-white rounded-full">
                <Clock className="w-5 h-5" />
              </div>
              <p className="text-3xl font-bold text-yellow-700">
                {Math.floor((stats?.totalDrivers || 0) * 0.15)}
              </p>
            </div>
            <h4 className="text-sm font-medium text-right text-gray-700 mt-4">Pending Approval</h4>
          </div>

          {/* Top Performers */}
          <div className="bg-purple-100 p-4 rounded-xl shadow-md border relative">
            <div className="flex justify-between items-start">
              <div className="p-2 bg-purple-400 text-white rounded-full">
                <Trophy className="w-5 h-5" />
              </div>
              <p className="text-3xl font-bold text-purple-700">
                {Math.floor((stats?.totalDrivers || 0) * 0.2)}
              </p>
            </div>
            <h4 className="text-sm font-medium text-right text-gray-700 mt-4">Top Performers</h4>
          </div>

          {/* Active Drivers */}
          <div className="bg-green-100 p-4 rounded-xl shadow-md border relative">
            <div className="flex justify-between items-start">
              <div className="p-2 bg-green-400 text-white rounded-full">
                <UserCheck className="w-5 h-5" />
              </div>
              <p className="text-3xl font-bold text-green-700">
                {Math.floor((stats?.totalDrivers || 0) * 0.78)}
              </p>
            </div>
            <h4 className="text-sm font-medium text-right text-gray-700 mt-4">Active Drivers</h4>
          </div>

          {/* New This Month */}
          <div className="bg-orange-100 p-4 rounded-xl shadow-md border relative">
            <div className="flex justify-between items-start">
              <div className="p-2 bg-orange-400 text-white rounded-full">
                <UserPlus className="w-5 h-5" />
              </div>
              <p className="text-3xl font-bold text-orange-700">
                {Math.floor((stats?.totalDrivers || 0) * 0.12)}
              </p>
            </div>
            <h4 className="text-sm font-medium text-right text-gray-700 mt-4">New This Month</h4>
          </div>

          {/* Suspended */}
          <div className="bg-red-100 p-4 rounded-xl shadow-md border relative">
            <div className="flex justify-between items-start">
              <div className="p-2 bg-red-400 text-white rounded-full">
                <UserX className="w-5 h-5" />
              </div>
              <p className="text-3xl font-bold text-red-700">
                {Math.floor((stats?.totalDrivers || 0) * 0.07)}
              </p>
            </div>
            <h4 className="text-sm font-medium text-right text-gray-700 mt-4">Suspended</h4>
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
  {/* Active Ads */}
  <div className="bg-green-100 p-4 rounded-xl shadow-md border relative">
    <div className="flex justify-between items-start">
      <div className="p-2 bg-green-400 text-white rounded-full">
        <PlayCircle className="w-5 h-5" />
      </div>
      <span className="text-3xl font-bold text-green-700">
        {Math.floor((stats?.totalAds || 0) * 0.72)}
      </span>
    </div>
    <h4 className="text-sm font-medium text-right text-gray-700 mt-4">
      Active Ads
    </h4>
  </div>

  {/* Pending Review */}
  <div className="bg-yellow-100 p-4 rounded-xl shadow-md border relative">
    <div className="flex justify-between items-start">
      <div className="p-2 bg-yellow-400 text-white rounded-full">
        <Clock className="w-5 h-5" />
      </div>
      <span className="text-3xl font-bold text-yellow-700">
        {Math.floor((stats?.totalAds || 0) * 0.18)}
      </span>
    </div>
    <h4 className="text-sm font-medium text-right text-gray-700 mt-4">
      Pending Ads
    </h4>
  </div>

  {/* Rejected */}
  <div className="bg-red-100 p-4 rounded-xl shadow-md border relative">
    <div className="flex justify-between items-start">
      <div className="p-2 bg-red-400 text-white rounded-full">
        <XCircle className="w-5 h-5" />
      </div>
      <span className="text-3xl font-bold text-red-700">
        {Math.floor((stats?.totalAds || 0) * 0.1)}
      </span>
    </div>
    <h4 className="text-sm font-medium text-right text-gray-700 mt-4">
      Rejected Ads
    </h4>
  </div>

  {/* Avg. CTR */}
  <div className="bg-blue-100 p-4 rounded-xl shadow-md border relative">
    <div className="flex justify-between items-start">
      <div className="p-2 bg-blue-400 text-white rounded-full">
        <Percent className="w-5 h-5" />
      </div>
      <span className="text-2xl font-bold text-blue-700">7.2%</span>
    </div>
    <h4 className="text-sm font-medium text-right text-gray-700 mt-4">
      Average CTR
    </h4>
  </div>

  {/* Avg. Impressions */}
  <div className="bg-orange-100 p-4 rounded-xl shadow-md border relative">
    <div className="flex justify-between items-start">
      <div className="p-2 bg-orange-400 text-white rounded-full">
        <Eye className="w-5 h-5" />
      </div>
      <span className="text-2xl font-bold text-orange-700">2,450</span>
    </div>
    <h4 className="text-sm font-medium text-right text-gray-700 mt-4">
      Avg. Impressions
    </h4>
  </div>

  {/* Top Performing Ad */}
  <div className="bg-purple-100 p-4 rounded-xl shadow-md border relative">
    <div className="flex justify-between items-start">
      <div className="p-2 bg-purple-400 text-white rounded-full">
        <Star className="w-5 h-5" />
      </div>
      <span className="text-md text-right truncate font-bold text-purple-700">Video Ad #123</span>
    </div>
    <h4 className="text-sm font-medium text-right text-gray-700 mt-4">
      Top Performing Ad
    </h4>
  </div>
</div>

    </div>
  );
  

  const renderRevenueTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT SIDE (wider) */}
        <div className="lg:col-span-8 space-y-6">
          {/* --- Top Stat Cards --- */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Monthly Revenue */}
            <div className="bg-green-100 p-6 rounded-xl shadow-md border flex items-center justify-between">
              {/* Left side: icon */}
              <div>
                <Wallet className="h-12 w-12 text-white rounded-full bg-green-500 p-2" />
              </div>

              {/* Right side: label + value */}
              <div className="flex flex-col items-end text-right">
                <p className="text-2xl font-bold text-green-600">
                  ₱{stats?.totalRevenue?.toLocaleString() || 0}
                </p>
                <h3 className="text-sm font-medium text-gray-600">Monthly Revenue</h3>
              </div>
            </div>

            {/* Avg. Revenue per Ad */}
            <div className="bg-blue-100 p-6 rounded-xl shadow-md border flex items-center justify-between">
              {/* Left side: icon */}
              <div>
                <BarChart3 className="h-12 w-12 text-white rounded-full bg-blue-500 p-2" />
              </div>

              {/* Right side: label + value */}
              <div className="flex flex-col items-end text-right">
                <p className="text-2xl font-bold text-blue-600">
                  ₱
                  {Math.floor(
                    (stats?.totalRevenue || 0) / (stats?.totalAds || 1)
                  ).toLocaleString()}
                </p>
                <h3 className="text-sm font-medium text-gray-600">Avg. Revenue/Ad</h3>
              </div>
            </div>

            {/* Growth Rate */}
            <div className="bg-purple-100 p-6 rounded-xl shadow-md border flex items-center justify-between">
              {/* Left side: icon */}
              <div>
                <TrendingUp className="h-12 w-12 text-white rounded-full bg-purple-500 p-2" />
              </div>

              {/* Right side: label + value */}
              <div className="flex flex-col items-end text-right">
                <p className="text-2xl font-bold text-purple-600">+22.1%</p>
                <h3 className="text-sm font-medium text-gray-600">Growth Rate</h3>
              </div>
            </div>
          </div>

  
          {/* --- Revenue Growth Chart --- */}
          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Revenue Growth
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip
                  formatter={(value) => [
                    `₱${value.toLocaleString()}`,
                    'Revenue',
                  ]}
                />
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
        </div>
  
        {/* RIGHT SIDE (narrower) */}
        <div className="lg:col-span-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Revenue by Location
          </h3>
          <div className="space-y-3">
            {locationData.map((location, index) => (
              <div
                key={index}
                className="flex justify-between items-center bg-white shadow-md rounded-lg p-3 mb-3"
              >
                <span className="text-sm font-medium text-gray-700">
                  {location.location}
                </span>
                <div className="flex items-center space-x-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{
                        width: `${
                          (location.revenue /
                            Math.max(...locationData.map((l) => l.revenue))) *
                          100
                        }%`,
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