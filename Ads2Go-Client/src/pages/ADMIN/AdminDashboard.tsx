import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieLabelRenderProps,
} from "recharts";
import { useQuery } from '@apollo/client';
import { GET_OWN_ADMIN_DETAILS } from '../../graphql/admin';
import { GET_ADMIN_DASHBOARD_STATS } from '../../graphql/admin/queries';
import DeviceStatus from '../../components/DeviceStatus';
import NotificationDashboard from './tabs/dashboard/NotificationDashboard';

// GraphQL query to get admin details
const GET_ADMIN_DETAILS = GET_OWN_ADMIN_DETAILS;

// Dummy data for the Ad Impressions & QR Scans chart
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
  
  // Fetch admin details from the backend
  const { loading, error, data } = useQuery(GET_ADMIN_DETAILS, {
    onCompleted: (data) => {
      if (data && data.getOwnAdminDetails) {
        const admin = data.getOwnAdminDetails;
        setAdminName(`${admin.firstName} ${admin.lastName}`);
      }
    },
    onError: (error) => {
      console.error("Error fetching admin details:", error);
    }
  });

  // Fetch admin dashboard stats
  const { data: statsData, loading: statsLoading } = useQuery(GET_ADMIN_DASHBOARD_STATS, {
    pollInterval: 30000, // Refresh every 30 seconds
    onCompleted: (data) => {
      console.log('🔔 Frontend: Dashboard stats received:', data);
    },
    onError: (error) => {
      console.error("Error fetching admin dashboard stats:", error);
    }
  });

  if (loading || statsLoading) return (
    <div className="p-8 pl-72 bg-[#f9f9fc] min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );

  if (error) return (
    <div className="p-8 pl-72 bg-[#f9f9fc] min-h-screen flex items-center justify-center">
      <div className="text-red-500">Error loading admin details: {error.message}</div>
    </div>
  );

  const stats = statsData?.getAdminDashboardStats;

  return (
    <div className="p-8 pl-72 bg-[#f9f9fc] min-h-screen text-gray-800 font-sans">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-semibold text-gray-800">
            Welcome back, {adminName}!
          </h2>
          <p className="text-sm text-gray-500">
            It is the best time to manage your finances
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Calendar icon and 'This month' button - Removed profile section */}
          <div className="flex items-center bg-white border border-gray-200 rounded-lg px-4 py-2 shadow-sm text-gray-700 text-sm cursor-pointer">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            This month
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 ml-2 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Driver Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
        {[
          { 
            label: "Total Drivers", 
            value: stats?.totalDrivers || 0, 
            change: `${stats?.newDriversToday || 0} new today`, 
            up: true 
          },
          { 
            label: "Pending Drivers", 
            value: stats?.pendingDrivers || 0, 
            change: "Awaiting review", 
            up: false 
          },
        ].map((stat, i) => (
          <div
            key={i}
            className="bg-white p-5 rounded-2xl shadow-sm flex flex-col justify-between"
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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
            <p className="text-2xl font-bold text-gray-800 mb-1">
              {stat.value}
            </p>
            <p
              className={`text-sm font-medium ${
                stat.up ? "text-green-600" : "text-red-600"
              }`}
            >
              {stat.up ? "▲" : "▼"} {stat.change} vs last month
            </p>
          </div>
        ))}
      </div>

      {/* Notification Dashboard */}
      <div className="mb-8">
        <NotificationDashboard pendingAdsCount={stats?.pendingAds} />
      </div>

      {/* Device Status */}
      <div className="bg-white p-6 rounded-lg shadow">
        <DeviceStatus />
      </div>

    </div>
  );
};

export default Dashboard;