import React, { useState, useEffect } from "react";
import { useQuery } from "@apollo/client";
import { GET_OWN_ADMIN_DETAILS } from "../../graphql/admin";
import { GET_ADMIN_DASHBOARD_STATS, GET_PENDING_ADS } from "../../graphql/admin/queries";
import DeviceStatus from "../../components/DeviceStatus";
import DynamicNotificationList from "./tabs/dashboard/DynamicNotificationList";
import { AdminLoader } from "../../components/ProtectedRoute";
import SubtleLoader from "../../components/SubtleLoader";

const GET_ADMIN_DETAILS = GET_OWN_ADMIN_DETAILS;


const Dashboard = () => {
  const [adminName, setAdminName] = useState("Admin");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);

  // Auto detect sidebar collapse based on window width
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      setSidebarCollapsed(width >= 768 && width < 1024);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const { loading, error, data } = useQuery(GET_ADMIN_DETAILS);

  const { data: statsData, loading: statsLoading, error: statsError } = useQuery(GET_ADMIN_DASHBOARD_STATS, {
    pollInterval: 30000, // Increased from 5s to 30s for more discreet refresh
  });

  const { data: pendingAdsData, loading: pendingAdsLoading, error: pendingAdsError } = useQuery(GET_PENDING_ADS, {
    pollInterval: 60000, // Increased from 30s to 60s for more discreet refresh
  });

  // Handle admin details data
  useEffect(() => {
    if (data?.getOwnAdminDetails) {
      const admin = data.getOwnAdminDetails;
      setAdminName(`${admin.firstName} ${admin.lastName}`);
    }
  }, [data]);

  // Track initial load completion
  useEffect(() => {
    if (!loading && !statsLoading && !pendingAdsLoading && !hasInitiallyLoaded) {
      setHasInitiallyLoaded(true);
    }
  }, [loading, statsLoading, pendingAdsLoading, hasInitiallyLoaded]);

  // Handle errors
  useEffect(() => {
    if (error) {
      console.error("Error fetching admin details:", error);
    }
  }, [error]);

  useEffect(() => {
    if (statsError) {
      console.error("Error fetching admin dashboard stats:", statsError);
    }
  }, [statsError]);

  useEffect(() => {
    if (pendingAdsError) {
      console.error("Error fetching pending ads:", pendingAdsError);
    }
  }, [pendingAdsError]);

  // Only show AdminLoader on initial load, not during auto-refresh
  if (!hasInitiallyLoaded && (loading || statsLoading || pendingAdsLoading)) {
    return <AdminLoader />;
  }

  if (error)
    return (
      <div className="p-8 bg-[#f9f9fc] min-h-screen flex items-center justify-center">
        <div className="text-red-500">Error loading admin details: {error.message}</div>
      </div>
    );

  const stats = statsData?.getAdminDashboardStats;
  const pendingAdsCount = pendingAdsData?.getPendingAds?.length || 0;

  // Adjust margin/padding depending on sidebar width and screen size
  const contentMargin = isMobile ? "ml-0" : sidebarCollapsed ? "ml-16" : "ml-60";

  return (
    <div
      className={`p-6 ${contentMargin} bg-[#f9f9fc] min-h-screen text-gray-800 font-sans transition-all duration-300`}
    >
      {/* Header */}
      <div className="flex flex-col pt-2 sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl pt-3 font-semibold text-gray-800">
            Welcome back, {adminName}!
          </h2>
          <p className="text-sm text-gray-500">
            It is the best time to manage your finances
          </p>
        </div>
        {/* Subtle refresh indicator */}
        <div className="flex items-center text-xs text-gray-400">
          <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
          <span>Auto-refreshing every 30s</span>
        </div>
        {/* Show subtle loader during auto-refresh */}
        {hasInitiallyLoaded && (statsLoading || pendingAdsLoading) && (
          <div className="mt-2">
            <SubtleLoader message="Updating data..." />
          </div>
        )}
      </div>

      {/* Stats & Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        {/* Left column */}
        <div className="lg:col-span-4 space-y-6 ">
          {[
            {
              label: "Total Drivers",
              value: stats?.totalDrivers || 0,
              change: `${stats?.newDriversToday || 0} new today`,
              up: true,
            },
            {
              label: "Pending Drivers",
              value: stats?.pendingDrivers || 0,
              change: "Awaiting review",
              up: false,
            },
          ].map((stat, i) => (
            <div
              key={i}
              className="bg-white p-5 rounded-md shadow-md flex flex-col justify-between transition-all duration-200 hover:shadow-md"
            >
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm text-gray-500">{stat.label}</p>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-gray-800 mb-1">{stat.value}</p>
              <p
                className={`text-sm font-medium ${
                  stat.up ? "text-green-600" : "text-red-600"
                }`}
              >
                {stat.up ? "▲" : "▼"} {stat.change}
              </p>
            </div>
          ))}

          {/* Dynamic Notification List */}
          <div>
            <DynamicNotificationList pendingAdsCount={pendingAdsCount} />
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-8">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Vehicle Airtime Availability</h3>
            <div className="text-center py-12 text-gray-500">
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-gray-900 mb-1">No Vehicle Data Available</h3>
              <p className="text-sm text-gray-500">Vehicle airtime data will appear here once vehicles are registered and active.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Device Status Section */}
      <div className="bg-white p-6 rounded-md shadow">
        <DeviceStatus />
      </div>

      {/* Analytics Section */}
      <div className="bg-white p-6 mt-8 rounded-md shadow">
        <h3 className="text-lg font-semibold mb-4">Ad Performance Analytics</h3>
        <div className="text-center py-12 text-gray-500">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-gray-900 mb-1">No Analytics Data Available</h3>
          <p className="text-sm text-gray-500">Performance analytics will appear here once ads start running and generating data.</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;