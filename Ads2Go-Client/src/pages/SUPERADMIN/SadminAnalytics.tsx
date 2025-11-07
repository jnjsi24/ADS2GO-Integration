import React, { useState } from "react";
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
  PlayCircle,
  Megaphone,
  Archive
} from 'lucide-react';
import { GET_SUPERADMIN_DASHBOARD_STATS, GET_SUPERADMIN_MONTHLY_GROWTH } from '../../graphql/superadmin/queries/sadminNotificationQueries';
import { AdminLoader } from "../../components/ProtectedRoute";


const SadminAnalytics: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');
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
    pollInterval: 120000, // ✅ OPTIMIZATION: Refresh every 2 minutes (increased from 5s) - reduces queries by 96%
    onError: (error) => {
      console.error("Error fetching super admin dashboard stats:", error);
    }
  });

  // Fetch monthly growth data (last 12 months)
  const { data: growthData, loading: growthLoading, refetch: refetchGrowth } = useQuery(GET_SUPERADMIN_MONTHLY_GROWTH, {
    variables: { months: 12 },
    pollInterval: 120000,
    onError: (error) => {
      console.error("Error fetching monthly growth data:", error);
    }
  });

  const stats = statsData?.getSuperAdminDashboardStats;
  const monthlyGrowth = growthData?.getSuperAdminMonthlyGrowth || [];

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchStats(), refetchGrowth()]);
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
    { id: 'advertisements', label: 'Advertisements', icon: Megaphone },
  ];

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-6 rounded-md shadow-md border flex items-center justify-between">
          {/* Left side: icon */}
          <div>
            <Users className="h-12 w-12 text-white rounded-full bg-blue-400 p-2" />
          </div>

          {/* Right side: label + value */}
          <div className="flex flex-col items-end text-right">
            <p className="text-2xl font-bold">
              {stats?.totalUsers?.toLocaleString() || 0} Users
            </p>
            <h3 className="text-sm font-medium text-gray-600">Total Users</h3>
          </div>
        </div>



        {/* Total Drivers */}
        <div className="bg-white p-6 rounded-md shadow-md border flex items-center justify-between">
          {/* Left side: icon */}
          <div>
            <UserCheck className="h-12 w-12 text-white rounded-full bg-green-500 p-2" />
          </div>

          {/* Right side: label + value */}
          <div className="flex flex-col items-end text-right">
            <p className="text-2xl font-bold">
              {stats?.totalDrivers?.toLocaleString() || 0} Drivers
            </p>
            <h3 className="text-sm font-medium text-gray-600">Total Drivers</h3>
          </div>
        </div>

        {/* Total Ads */}
        <div className="bg-white p-6 rounded-md shadow-md border flex items-center justify-between">
          {/* Left side: icon */}
          <div>
            <TrendingUp className="h-12 w-12 text-white rounded-full bg-purple-500 p-2" />
          </div>

          {/* Right side: label + value */}
          <div className="flex flex-col items-end text-right">
            <p className="text-2xl font-bold">
              {stats?.totalAds?.toLocaleString() || 0} Ads
            </p>
            <h3 className="text-sm font-medium text-gray-600">Total Ads</h3>
          </div>
        </div>

      </div>

      {/* Growth Chart Section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Growth Overview</h3>
        {growthLoading ? (
          <div className="bg-white p-8 rounded-md shadow-md border text-center">
            <p className="text-gray-500">Loading growth data...</p>
          </div>
        ) : monthlyGrowth.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={monthlyGrowth}>
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
                name="Users"
              />
              <Area
                type="monotone"
                dataKey="drivers"
                stackId="1"
                stroke="#10B981"
                fill="#10B981"
                fillOpacity={0.6}
                name="Drivers"
              />
              <Area
                type="monotone"
                dataKey="ads"
                stackId="1"
                stroke="#8B5CF6"
                fill="#8B5CF6"
                fillOpacity={0.6}
                name="Ads"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="bg-white p-8 rounded-md shadow-md border text-center">
            <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No growth data available yet</p>
          </div>
        )}
      </div>

    </div>
  );

  const renderUsersTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT SIDE */}
        <div className="lg:col-span-8">
          {/* User Growth Chart */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              User Growth
            </h3>
            {growthLoading ? (
              <div className="bg-white p-8 rounded-md shadow-md border text-center">
                <p className="text-gray-500">Loading growth data...</p>
              </div>
            ) : monthlyGrowth.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={monthlyGrowth}>
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
                    name="Users"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="bg-white p-8 rounded-md shadow-md border text-center">
                <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No user growth data available yet</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDE - User Stats */}
        <div className="lg:col-span-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Active Users */}
            <div className="bg-white p-4 rounded-md shadow-md border relative">
              <div className="flex justify-between items-start">
                <div className="p-2 bg-green-400 text-white rounded-full">
                  <UserCheck className="w-5 h-5" />
                </div>
                <p className="text-3xl font-bold">
                  {Math.floor((stats?.totalUsers || 0) * 0.85)}
                </p>
              </div>
              <h4 className="text-sm font-medium text-right text-gray-700 mt-4">Active Users</h4>
            </div>

            {/* Archived Users */}
            <div className="bg-white p-4 rounded-md shadow-md border relative">
              <div className="flex justify-between items-start">
                <div className="p-2 bg-orange-400 text-white rounded-full">
                  <Clock className="w-5 h-5" />
                </div>
                <p className="text-3xl font-bold">
                  {stats?.userStatistics?.archived || 0}
                </p>
              </div>
              <h4 className="text-sm font-medium text-right text-gray-700 mt-4">Archived Users</h4>
              <p className="text-xs text-gray-500 mt-1 text-right">
                {stats?.totalUsers ? Math.round(((stats.userStatistics?.archived || 0) / stats.totalUsers) * 100) : 0}% of total
              </p>
            </div>

            {/* Google Auth */}
            <div className="bg-white p-4 rounded-md shadow-md border relative">
              <div className="flex justify-between items-start">
                <div className="p-2 bg-purple-400 text-white rounded-full">
                  <Users className="w-5 h-5" />
                </div>
                <p className="text-3xl font-bold">
                  {stats?.userStatistics?.googleAuth || 0}
                </p>
              </div>
              <h4 className="text-sm font-medium text-right text-gray-700 mt-4">Google Auth</h4>
              <p className="text-xs text-gray-500 mt-1 text-right">
                {stats?.totalUsers ? Math.round(((stats.userStatistics?.googleAuth || 0) / stats.totalUsers) * 100) : 0}% of total
              </p>
            </div>

            {/* Local Auth */}
            <div className="bg-white p-4 rounded-md shadow-md border relative">
              <div className="flex justify-between items-start">
                <div className="p-2 bg-indigo-400 text-white rounded-full">
                  <Users className="w-5 h-5" />
                </div>
                <p className="text-3xl font-bold">
                  {stats?.userStatistics?.localAuth || 0}
                </p>
              </div>
              <h4 className="text-sm font-medium text-right text-gray-700 mt-4">Local Auth</h4>
              <p className="text-xs text-gray-500 mt-1 text-right">
                {stats?.totalUsers ? Math.round(((stats.userStatistics?.localAuth || 0) / stats.totalUsers) * 100) : 0}% of total
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
  
  

  const renderDriversTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Driver Growth (left, wider) */}
        <div className="lg:col-span-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Driver Growth</h3>
          {growthLoading ? (
            <div className="bg-white p-8 rounded-md shadow-md border text-center">
              <p className="text-gray-500">Loading growth data...</p>
            </div>
          ) : monthlyGrowth.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={monthlyGrowth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="drivers" stroke="#10B981" strokeWidth={2} name="Drivers" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="bg-white p-8 rounded-md shadow-md border text-center">
              <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No driver growth data available yet</p>
            </div>
          )}
        </div>
  
        {/* Right side stat cards (2 per row) */}
        <div className="lg:col-span-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Total Drivers */}
            <div className="bg-white p-4 rounded-md shadow-md border relative">
              <div className="flex justify-between items-start">
                <div className="p-2 bg-blue-400 text-white rounded-full">
                  <Users className="w-5 h-5" />
                </div>
                <p className="text-3xl font-bold">
                  {stats?.totalDrivers || 0}
                </p>
              </div>
              <h4 className="text-sm font-medium text-right text-gray-700 mt-4">Total Drivers</h4>
              <p className="text-xs text-gray-500 mt-1 text-right">
                100% of total
              </p>
            </div> 

            {/* Pending Approval */}
            <div className="bg-white p-4 rounded-md shadow-md border relative">
              <div className="flex justify-between items-start">
                <div className="p-2 bg-yellow-400 text-white rounded-full">
                  <Clock className="w-5 h-5" />
                </div>
                <p className="text-3xl font-bold">
                  {stats?.driverStatistics?.pendingApproval || 0}
                </p>
              </div>
              <h4 className="text-sm font-medium text-right text-gray-700 mt-4">Pending Approval</h4>
              <p className="text-xs text-gray-500 mt-1 text-right">
                {stats?.totalDrivers ? Math.round(((stats.driverStatistics?.pendingApproval || 0) / stats.totalDrivers) * 100) : 0}% of total
              </p>
            </div>

            {/* Suspended */}
            <div className="bg-white p-4 rounded-md shadow-md border relative">
              <div className="flex justify-between items-start">
                <div className="p-2 bg-red-400 text-white rounded-full">
                  <UserX className="w-5 h-5" />
                </div>
                <p className="text-3xl font-bold">
                  {stats?.driverStatistics?.suspended || 0}
                </p>
              </div>
              <h4 className="text-sm font-medium text-right text-gray-700 mt-4">Suspended</h4>
              <p className="text-xs text-gray-500 mt-1 text-right">
                {stats?.totalDrivers ? Math.round(((stats.driverStatistics?.suspended || 0) / stats.totalDrivers) * 100) : 0}% of total
              </p>
            </div>

            {/* Archived Drivers */}
            <div className="bg-white p-4 rounded-md shadow-md border relative">
              <div className="flex justify-between items-start">
                <div className="p-2 bg-gray-400 text-white rounded-full">
                  <Archive className="w-5 h-5" />
                </div>
                <p className="text-3xl font-bold">
                  {stats?.driverStatistics?.archived || 0}
                </p>
              </div>
              <h4 className="text-sm font-medium text-right text-gray-700 mt-4">Archived Drivers</h4>
              <p className="text-xs text-gray-500 mt-1 text-right">
                {stats?.totalDrivers ? Math.round(((stats.driverStatistics?.archived || 0) / stats.totalDrivers) * 100) : 0}% of total
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAdvertisementsTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT SIDE - Ad Growth Chart */}
        <div className="lg:col-span-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Advertisement Growth
          </h3>
          {growthLoading ? (
            <div className="bg-white p-8 rounded-md shadow-md border text-center">
              <p className="text-gray-500">Loading growth data...</p>
            </div>
          ) : monthlyGrowth.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={monthlyGrowth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="ads"
                  stroke="#8B5CF6"
                  strokeWidth={2}
                  name="Ads"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="bg-white p-8 rounded-md shadow-md border text-center">
              <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No advertisement growth data available yet</p>
            </div>
          )}
        </div>

        {/* RIGHT SIDE - Ad Statistics Cards */}
        <div className="lg:col-span-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Total Ads */}
            <div className="bg-white p-4 rounded-md shadow-md border relative">
              <div className="flex justify-between items-start">
                <div className="p-2 bg-blue-400 text-white rounded-full">
                  <Megaphone className="w-5 h-5" />
                </div>
                <p className="text-3xl font-bold">
                  {stats?.totalAds || 0}
                </p>
              </div>
              <h4 className="text-sm font-medium text-right text-gray-700 mt-4">Total Ads</h4>
              <p className="text-xs text-gray-500 mt-1 text-right">
                100% of total
              </p>
            </div>

            {/* Pending Ads */}
            <div className="bg-white p-4 rounded-md shadow-md border relative">
              <div className="flex justify-between items-start">
                <div className="p-2 bg-yellow-400 text-white rounded-full">
                  <Clock className="w-5 h-5" />
                </div>
                <p className="text-3xl font-bold">
                  {stats?.adStatistics?.pending || 0}
                </p>
              </div>
              <h4 className="text-sm font-medium text-right text-gray-700 mt-4">Pending Ads</h4>
              <p className="text-xs text-gray-500 mt-1 text-right">
                {stats?.totalAds ? Math.round(((stats.adStatistics?.pending || 0) / stats.totalAds) * 100) : 0}% of total
              </p>
            </div>

            {/* Running Ads */}
            <div className="bg-white p-4 rounded-md shadow-md border relative">
              <div className="flex justify-between items-start">
                <div className="p-2 bg-purple-400 text-white rounded-full">
                  <PlayCircle className="w-5 h-5" />
                </div>
                <p className="text-3xl font-bold">
                  {stats?.adStatistics?.running || 0}
                </p>
              </div>
              <h4 className="text-sm font-medium text-right text-gray-700 mt-4">Running Ads</h4>
              <p className="text-xs text-gray-500 mt-1 text-right">
                {stats?.totalAds ? Math.round(((stats.adStatistics?.running || 0) / stats.totalAds) * 100) : 0}% of total
              </p>
            </div>

            {/* Scheduled Ads */}
            <div className="bg-white p-4 rounded-md shadow-md border relative">
              <div className="flex justify-between items-start">
                <div className="p-2 bg-green-400 text-white rounded-full">
                  <Clock className="w-5 h-5" />
                </div>
                <p className="text-3xl font-bold">
                  {stats?.adStatistics?.scheduled || 0}
                </p>
              </div>
              <h4 className="text-sm font-medium text-right text-gray-700 mt-4">Scheduled Ads</h4>
              <p className="text-xs text-gray-500 mt-1 text-right">
                {stats?.totalAds ? Math.round(((stats.adStatistics?.scheduled || 0) / stats.totalAds) * 100) : 0}% of total
              </p>
            </div>
          </div>
        </div>
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
      case 'advertisements':
        return renderAdvertisementsTab();
      default:
        return renderOverviewTab();
    }
  };

  if (statsLoading || growthLoading) {
    return <AdminLoader />;
  }

  return (
    <div className="p-8 ml-60 bg-gray-50 min-h-screen text-gray-800 font-sans">
      <div className="pt-9 mb-8">
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
          <div className="flex items-center gap-2">
            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="py-3 bg-[#3674B5] text-xs font-semibold text-white rounded-md w-28 hover:shadow-lg transition-colors flex items-center justify-center"
                >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
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
                    isActive ? "text-[#3674B5]" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {tab.label}

                  {/* Animated underline */}
                  <span
                    className={`absolute bottom-0 left-0 h-0.5 w-full bg-[#3674B5] transform origin-left transition-transform duration-300 ease-out ${
                      isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                    }`}
                  />
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