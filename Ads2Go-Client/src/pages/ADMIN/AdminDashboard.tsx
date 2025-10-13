import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useQuery } from "@apollo/client";
import { GET_OWN_ADMIN_DETAILS } from "../../graphql/admin";
import { GET_ADMIN_DASHBOARD_STATS, GET_PENDING_ADS } from "../../graphql/admin/queries";
import DeviceStatus from "../../components/DeviceStatus";
import AirtimeAvailability from "../../components/AirtimeAvailability";
import DynamicNotificationList from "./tabs/dashboard/DynamicNotificationList";
import { AdminLoader } from "../../components/ProtectedRoute";

const GET_ADMIN_DETAILS = GET_OWN_ADMIN_DETAILS;

const adPerformanceData = [
  { month: "Jan", impressions: 7000, qrScans: 4000 },
  { month: "Feb", impressions: 8000, qrScans: 5000 },
  { month: "Mar", impressions: 10000, qrScans: 7000 },
  { month: "Apr", impressions: 9000, qrScans: 6000 },
  { month: "May", impressions: 7500, qrScans: 4500 },
  { month: "Jun", impressions: 5000, qrScans: 3000 },
  { month: "Jul", impressions: 6000, qrScans: 3500 },
];

const Dashboard = () => {
  const [adminName, setAdminName] = useState("Admin");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

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
    pollInterval: 5000,
  });

  const { data: pendingAdsData, loading: pendingAdsLoading, error: pendingAdsError } = useQuery(GET_PENDING_ADS, {
    pollInterval: 30000,
  });

  // Handle admin details data
  useEffect(() => {
    if (data?.getOwnAdminDetails) {
      const admin = data.getOwnAdminDetails;
      setAdminName(`${admin.firstName} ${admin.lastName}`);
    }
  }, [data]);

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

  if (loading || statsLoading || pendingAdsLoading) return <AdminLoader />;

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl pt-3 font-semibold text-gray-800">
            Welcome back, {adminName}!
          </h2>
          <p className="text-sm text-gray-500">
            It is the best time to manage your finances
          </p>
        </div>
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
          <AirtimeAvailability />
        </div>
      </div>

      {/* Device Status Section */}
      <div className="bg-white p-6 rounded-md shadow">
        <DeviceStatus />
      </div>

      {/* Chart Section (Optional example) */}
      <div className="bg-white p-6 mt-8 rounded-md shadow">
        <h3 className="text-lg font-semibold mb-4">Ad Impressions & QR Scans</h3>
        <div className="w-full h-64">
          <ResponsiveContainer>
            <BarChart data={adPerformanceData}>
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="impressions" fill="#3674B5" />
              <Bar dataKey="qrScans" fill="#FF9D3D" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;