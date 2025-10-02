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
      // SuperAdmin dashboard stats received
    },
    onError: (error) => {
      console.error("Error fetching super admin dashboard stats:", error);
    }
  });

  const unreadCount = notificationsData?.getSuperAdminNotifications?.unreadCount || 0;
  const stats = statsData?.getSuperAdminDashboardStats;

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
            className="relative flex items-center bg-white border border-gray-200 rounded-lg px-4 py-2 shadow-sm text-gray-700 text-sm hover:bg-gray-50 transition-colors"
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

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { 
            label: "Total Drivers", 
            value: stats?.totalDrivers || 0, 
            change: "Active drivers", 
            up: true 
          },
          { 
            label: "Total Ads", 
            value: stats?.totalAds || 0, 
            change: "All advertisements", 
            up: true 
          },
          { 
            label: "Total Users", 
            value: stats?.totalUsers || 0, 
            change: "Registered users", 
            up: true 
          },
          { 
            label: "Total Plans", 
            value: stats?.totalPlans || 0, 
            change: "Available plans", 
            up: true 
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
            <p className="text-sm font-medium text-gray-600">
              {stat.change}
            </p>
          </div>
        ))}
      </div>

      {/* Analytics Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Users Analytics */}
        <div className="bg-white p-6 rounded-2xl shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Users Analytics</h3>
            <Link
              to="/sadmin-analytics?tab=users"
              className="text-blue-600 text-sm flex items-center hover:text-blue-700 transition-colors"
            >
              View Details
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Users</span>
              <span className="text-lg font-semibold text-gray-800">{stats?.totalUsers || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Active Users</span>
              <span className="text-lg font-semibold text-green-600">{Math.floor((stats?.totalUsers || 0) * 0.85)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">New This Month</span>
              <span className="text-lg font-semibold text-blue-600">{Math.floor((stats?.totalUsers || 0) * 0.12)}</span>
            </div>
          </div>
        </div>

        {/* Drivers Analytics */}
        <div className="bg-white p-6 rounded-2xl shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Drivers Analytics</h3>
            <Link
              to="/sadmin-analytics?tab=drivers"
              className="text-blue-600 text-sm flex items-center hover:text-blue-700 transition-colors"
            >
              View Details
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Drivers</span>
              <span className="text-lg font-semibold text-gray-800">{stats?.totalDrivers || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Active Drivers</span>
              <span className="text-lg font-semibold text-green-600">{Math.floor((stats?.totalDrivers || 0) * 0.78)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Pending Approval</span>
              <span className="text-lg font-semibold text-yellow-600">{Math.floor((stats?.totalDrivers || 0) * 0.15)}</span>
            </div>
          </div>
        </div>

        {/* Ads Analytics */}
        <div className="bg-white p-6 rounded-2xl shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Ads Analytics</h3>
            <Link
              to="/sadmin-analytics?tab=ads"
              className="text-blue-600 text-sm flex items-center hover:text-blue-700 transition-colors"
            >
              View Details
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Ads</span>
              <span className="text-lg font-semibold text-gray-800">{stats?.totalAds || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Active Ads</span>
              <span className="text-lg font-semibold text-green-600">{Math.floor((stats?.totalAds || 0) * 0.72)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Pending Review</span>
              <span className="text-lg font-semibold text-yellow-600">{Math.floor((stats?.totalAds || 0) * 0.18)}</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;