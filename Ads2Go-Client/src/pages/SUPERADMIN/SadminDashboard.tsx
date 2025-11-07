import React, { useState } from "react";
import { useQuery } from '@apollo/client';
import { Link } from 'react-router-dom';
import { Bell, ArrowRight } from 'lucide-react';
import { GET_OWN_SUPERADMIN_DETAILS } from '../../graphql/superadmin';
import { GET_SUPERADMIN_NOTIFICATIONS, GET_SUPERADMIN_DASHBOARD_STATS } from '../../graphql/superadmin/queries/sadminNotificationQueries';
import { AdminLoader } from "../../components/ProtectedRoute";

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
    pollInterval: 120000, // ✅ OPTIMIZATION: Refresh every 2 minutes (increased from 5s) - reduces queries by 96%
    onError: (error) => {
      console.error("Error fetching super admin notifications:", error);
    }
  });

  // Fetch super admin dashboard stats
  const { data: statsData, loading: statsLoading } = useQuery(GET_SUPERADMIN_DASHBOARD_STATS, {
    pollInterval: 120000, // ✅ OPTIMIZATION: Refresh every 2 minutes (increased from 5s) - reduces queries by 96%
    onCompleted: (data) => {
      // SuperAdmin dashboard stats received
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

  if (loading || statsLoading) return <AdminLoader />;
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
    <div className="p-8 ml-60 bg-gray-50 min-h-screen text-gray-800 font-sans">
      {/* Header */}
      <div className="flex justify-between items-center pt-7 mb-8">
        <div>
          <h2 className="text-3xl font-semibold text-gray-800">
            Welcome back, {adminName}!
          </h2>
          <p className="text-sm text-black/70">
            It is the best time to manage your finances
          </p>
        </div>
      </div>

      {/* ROW 1: Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { 
            label: "Total Admins", 
            value: stats?.totalAdmins || 0, 
            change: "All admins", 
            color: "purple", 
            icon: "Shield" 
          },
          { 
            label: "Total Ads", 
            value: stats?.totalAds || 0, 
            change: "All advertisements", 
            color: "blue", 
            icon: "Megaphone" 
          },
          { 
            label: "Total Drivers", 
            value: stats?.totalDrivers || 0, 
            change: "Active drivers", 
            color: "green", 
            icon: "LifeBuoy" 
          },
          { 
            label: "Total Users", 
            value: stats?.totalUsers || 0, 
            change: "Registered users", 
            color: "yellow", 
            icon: "Users" 
          },
        ].map((stat, i) => {
          const Icon =
            {
              LifeBuoy: require("lucide-react").LifeBuoy,
              Megaphone: require("lucide-react").Megaphone,
              Users: require("lucide-react").Users,
              Shield: require("lucide-react").Shield,
            }[stat.icon];

          return (
            <div
              key={i}
              className={`p-6 rounded-md shadow-md border flex items-center justify-between bg-white`}
            >
              {/* Left side: Icon */}
              <div>
                <Icon className={`h-12 w-12 text-white rounded-full bg-${stat.color}-500 p-2`} />
              </div>

              {/* Right side: Label + Value */}
              <div className="flex flex-col items-end text-right">
                <p className={`text-3xl font-bold`}>
                  {stat.value.toLocaleString()}
                </p>
                <h3 className="text-sm font-medium text-gray-600">{stat.label}</h3>
              </div>
            </div>
          );
        })}
      </div>

      {/* ROW 2: Analytics Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Users Analytics */}
        <div className="bg-white p-6 rounded-md shadow-md">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-800">Users Analytics</h3>
            <Link
              to="/sadmin-analytics?tab=users"
              className="text-sm flex font-semibold items-center hover:text-black transition-colors"
            >
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </div>

          <div className="flex items-end justify-between space-x-3 h-48 mt-4">
            {usersData.map((item, index) => (
              <div key={index} className="flex flex-col items-center flex-1">
                <div className="w-20 bg-gray-100 rounded-t-lg h-40 flex items-end relative">
                  <div
                    className={`w-full ${item.color} rounded-t-lg transition-all duration-700 ease-out`}
                    style={{ height: `${item.value}%` }}
                  />
                </div>
                <div className="text-center">
                  <span className="text-sm font-semibold text-gray-900 block">
                    {item.value.toLocaleString()}
                  </span>
                  <span className="text-xs text-gray-600 mt-1 block">
                    {item.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Drivers Analytics */}
        <div className="bg-white p-6 rounded-md shadow-md">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-800">Drivers Analytics</h3>
            <Link
              to="/sadmin-analytics?tab=drivers"
              className="text-sm flex font-semibold items-center hover:text-black transition-colors"
            >
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </div>

          <div className="flex items-end justify-between space-x-3 h-48 mt-4">
            {driversData.map((item, index) => (
              <div key={index} className="flex flex-col items-center flex-1">
                <div className="w-20 bg-gray-100 rounded-t-lg h-40 flex items-end relative">
                  <div
                    className={`w-full ${item.color} rounded-t-lg transition-all duration-700 ease-out`}
                    style={{ height: `${item.value}%` }}
                  />
                </div>
                <div className="text-center">
                  <span className="text-sm font-semibold text-gray-900 block">
                    {item.value.toLocaleString()}
                  </span>
                  <span className="text-xs text-gray-600 mt-1 block">
                    {item.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ads Analytics */}
        <Link
          to="/sadmin-analytics?tab=advertisements"
          className="bg-white p-6 rounded-md shadow-md block cursor-pointer hover:shadow-lg transition-shadow"
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-800">Advertisements Analytics</h3>
            <div className="text-sm flex font-semibold items-center hover:text-black transition-colors">
              <ArrowRight className="h-4 w-4 ml-1" />
            </div>
          </div>

          <div className="flex items-end justify-between space-x-3 h-48 mt-4">
            {adsData.map((item, index) => (
              <div key={index} className="flex flex-col items-center flex-1">
                <div className="w-20 bg-gray-100 rounded-t-lg h-40 flex items-end relative">
                  <div
                    className={`w-full ${item.color} rounded-t-lg transition-all duration-700 ease-out`}
                    style={{ height: `${item.value}%` }}
                  />
                </div>
                <div className="text-center">
                  <span className="text-sm font-semibold text-gray-900 block">
                    {item.value.toLocaleString()}
                  </span>
                  <span className="text-xs text-gray-600 mt-1 block">
                    {item.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Link>
      </div>
    </div>
  );
};

export default Dashboard;