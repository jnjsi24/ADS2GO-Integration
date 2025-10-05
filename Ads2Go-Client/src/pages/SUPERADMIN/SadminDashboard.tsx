import React, { useState } from "react";
import { useQuery } from '@apollo/client';
import { Link } from 'react-router-dom';
import { Bell, ArrowRight } from 'lucide-react';
import { GET_OWN_SUPERADMIN_DETAILS } from '../../graphql/superadmin';
import { GET_SUPERADMIN_NOTIFICATIONS, GET_SUPERADMIN_DASHBOARD_STATS } from '../../graphql/superadmin/queries/sadminNotificationQueries';

// GraphQL query to get superadmin details
const GET_SUPERADMIN_DETAILS = GET_OWN_SUPERADMIN_DETAILS;

const Dashboard = () => {
  const [adminName, setAdminName] = useState("SuperAdmin");
  
  // Fetch superadmin details from the backend
  const { loading, error, data } = useQuery(GET_SUPERADMIN_DETAILS, {
    onCompleted: (data) => {
      if (data && data.getOwnSuperAdminDetails) {
        const superadmin = data.getOwnSuperAdminDetails;
        setAdminName(`${superadmin.firstName} ${superadmin.lastName}`);
      }
    },
    onError: (error) => {
      console.error("Error fetching superadmin details:", error);
    }
  });

  // Fetch super admin notifications for unread count
  const { data: notificationsData } = useQuery(GET_SUPERADMIN_NOTIFICATIONS, {
    pollInterval: 5000, // Refresh every 5 seconds for faster updates
    onError: (error) => {
      console.error("Error fetching super admin notifications:", error);
    }
  });

  // Fetch super admin dashboard stats
  const { data: statsData, loading: statsLoading } = useQuery(GET_SUPERADMIN_DASHBOARD_STATS, {
    pollInterval: 5000, // Refresh every 5 seconds for faster updates
    onCompleted: (data) => {
      console.log('🔔 Frontend: SuperAdmin dashboard stats received:', data);
    },
    onError: (error) => {
      console.error("Error fetching super admin dashboard stats:", error);
    }
  });

  const unreadCount = notificationsData?.getSuperAdminNotifications?.unreadCount || 0;
  const stats = statsData?.getSuperAdminDashboardStats;

  // Sample data for bar charts (adapt based on your stats; use derived values)
  const usersData = [
    { label: 'Total Users', value: stats?.totalUsers || 0, color: 'bg-blue-500' },
    { label: 'Active Users', value: Math.floor((stats?.totalUsers || 0) * 0.85), color: 'bg-green-500' },
    { label: 'New This Month', value: Math.floor((stats?.totalUsers || 0) * 0.12), color: 'bg-purple-500' },
  ];

  const driversData = [
    { label: 'Total Drivers', value: stats?.totalDrivers || 0, color: 'bg-blue-500' },
    { label: 'Active Drivers', value: Math.floor((stats?.totalDrivers || 0) * 0.78), color: 'bg-green-500' },
    { label: 'Pending Approval', value: Math.floor((stats?.totalDrivers || 0) * 0.15), color: 'bg-yellow-500' },
  ];

  const adsData = [
    { label: 'Total Ads', value: stats?.totalAds || 0, color: 'bg-blue-500' },
    { label: 'Active Ads', value: Math.floor((stats?.totalAds || 0) * 0.72), color: 'bg-green-500' },
    { label: 'Pending Review', value: Math.floor((stats?.totalAds || 0) * 0.18), color: 'bg-yellow-500' },
  ];

  if (loading || statsLoading) return (
    <div className="p-8 pl-72 bg-[#f9f9fc] min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );

  if (error) return (
    <div className="p-8 pl-72 bg-[#f9f9fc] min-h-screen flex items-center justify-center">
      <div className="text-red-500">Error loading superadmin details: {error.message}</div>
    </div>
  );

  const maxValue = Math.max(
    ...usersData.map(d => d.value),
    ...driversData.map(d => d.value),
    ...adsData.map(d => d.value)
  ) || 1; // Avoid division by zero

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
          {/* Notifications Button */}
          <Link
            to="/sadmin-notifications"
            className="relative flex items-center bg-white border border-gray-200 rounded-lg px-4 py-2 shadow-md text-gray-700 text-sm hover:bg-gray-50 transition-colors"
          >
            <Bell className="h-5 w-5 mr-2 text-gray-500" />
            <span>Notifications</span>
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
          
          {/* Calendar icon and 'This month' button */}
          <div className="flex items-center bg-white border border-gray-200 rounded-lg px-4 py-2 shadow-md text-gray-700 text-sm cursor-pointer">
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

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* LEFT SIDE: Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
  {[
    { 
      label: "Total Drivers", 
      value: stats?.totalDrivers || 0, 
      change: "Active drivers", 
      color: "green", 
      icon: "LifeBuoy" 
    },
    { 
      label: "Total Ads", 
      value: stats?.totalAds || 0, 
      change: "All advertisements", 
      color: "blue", 
      icon: "Megaphone" 
    },
    { 
      label: "Total Users", 
      value: stats?.totalUsers || 0, 
      change: "Registered users", 
      color: "yellow", 
      icon: "Users" 
    },
    { 
      label: "Total Plans", 
      value: stats?.totalPlans || 0, 
      change: "Available plans", 
      color: "purple", 
      icon: "ClipboardList" 
    },
  ].map((stat, i) => {
    const Icon =
      {
        LifeBuoy: require("lucide-react").LifeBuoy,
        Megaphone: require("lucide-react").Megaphone,
        Users: require("lucide-react").Users,
        ClipboardList: require("lucide-react").ClipboardList,
      }[stat.icon];

    return (
      <div
        key={i}
        className={`bg-${stat.color}-100 p-6 rounded-xl shadow-md border flex items-center justify-between`}
      >
        {/* Left side: Icon */}
        <div>
          <Icon className={`h-12 w-12 text-white rounded-full bg-${stat.color}-500 p-2`} />
        </div>

        {/* Right side: Label + Value */}
        <div className="flex flex-col items-end text-right">
          <p className={`text-3xl font-bold text-${stat.color}-600`}>
            {stat.value.toLocaleString()}
          </p>
          <h3 className="text-sm font-medium text-gray-600">{stat.label}</h3>
        </div>
      </div>
    );
  })}
</div>


        {/* RIGHT SIDE: Analytics Panels */}
        <div className="space-y-6">
          {/* Users Analytics */}
          <div className="bg-white p-6 rounded-2xl shadow-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Users Analytics</h3>
              <Link
                to="/sadmin-analytics?tab=users"
                className="text-black/70 text-sm flex font-semibold items-center hover:text-black transition-colors"
              >
                View Details
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </div>

            <div className="space-y-4">
              {usersData.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between w-full space-x-3"
                >
                  <p className="text-sm font-medium text-gray-900 w-32 truncate">
                    {item.label}
                  </p>
                  <div className="flex-1">
                    <div
                      className={`h-3 ${item.color} rounded-full transition-all duration-300`}
                      style={{ width: `${(item.value / maxValue) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-900 min-w-[50px] text-right">
                    {item.value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Drivers Analytics */}
          <div className="bg-white p-6 rounded-2xl shadow-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Drivers Analytics</h3>
              <Link
                to="/sadmin-analytics?tab=drivers"
                className="text-black/70 text-sm flex font-semibold items-center hover:text-black transition-colors"
              >
                View Details
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </div>

            <div className="space-y-4">
              {driversData.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between w-full space-x-3"
                >
                  <p className="text-sm font-medium text-gray-900 w-32 truncate">
                    {item.label}
                  </p>
                  <div className="flex-1">
                    <div
                      className={`h-3 ${item.color} rounded-full transition-all duration-300`}
                      style={{ width: `${(item.value / maxValue) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-900 min-w-[50px] text-right">
                    {item.value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Ads Analytics */}
          <div className="bg-white p-6 rounded-2xl shadow-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Ads Analytics</h3>
              <Link
                to="/sadmin-analytics?tab=ads"
                className="text-black/70 text-sm flex font-semibold items-center hover:text-black transition-colors"
              >
                View Details
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </div>

            <div className="space-y-4">
              {adsData.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between w-full space-x-3"
                >
                  <p className="text-sm font-medium text-gray-900 w-32 truncate">
                    {item.label}
                  </p>
                  <div className="flex-1">
                    <div
                      className={`h-3 ${item.color} rounded-full transition-all duration-300`}
                      style={{ width: `${(item.value / maxValue) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-900 min-w-[50px] text-right">
                    {item.value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;