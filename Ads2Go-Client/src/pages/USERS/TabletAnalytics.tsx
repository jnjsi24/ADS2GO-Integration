import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';
import { Tablet, Battery, Signal, Activity, AlertCircle } from 'lucide-react';

const TabletAnalytics = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<'Monthly' | 'Weekly' | 'Daily'>('Weekly');

  const activityData = [
    { name: 'Week 1', active: 85, offline: 15, errors: 5 },
    { name: 'Week 2', active: 90, offline: 10, errors: 3 },
    { name: 'Week 3', active: 88, offline: 12, errors: 4 },
    { name: 'Week 4', active: 92, offline: 8, errors: 2 },
  ];

  const locationData = [
    { name: 'Shopping Centers', value: 40 },
    { name: 'Transit Stations', value: 25 },
    { name: 'Business Districts', value: 20 },
    { name: 'Residential Areas', value: 10 },
    { name: 'Others', value: 5 },
  ];

  const batteryData = [
    { level: '90-100%', tablets: 45 },
    { level: '70-90%', tablets: 30 },
    { level: '50-70%', tablets: 15 },
    { level: '30-50%', tablets: 7 },
    { level: '0-30%', tablets: 3 },
  ];

  const errorData = [
    { type: 'Connection Lost', count: 25 },
    { type: 'App Crash', count: 15 },
    { type: 'Low Battery', count: 12 },
    { type: 'Display Error', count: 8 },
    { type: 'Other', count: 5 },
  ];

  const colors = ['#1e40af', '#3b82f6', '#ff7849', '#fb923c', '#fbbf24'];

  const StatCard = ({ title, value, icon, subtitle }: any) => (
    <div className="bg-white/80 backdrop-blur-md rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-indigo-50 rounded-lg">
          {icon}
        </div>
      </div>
      <h3 className="text-sm font-medium text-gray-600">{title}</h3>
      <div className="mt-2">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
      </div>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );

  return (
    <div className="min-h-screen pl-72 pr-5 p-10 bg-cover bg-center bg-no-repeat"
         style={{
           backgroundImage: "linear-gradient(135deg, #3674B5 0%, black 100%)"
         }}>
      <div className="max-w-full space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white/90 mb-2">
              Tablet Activity Analytics
            </h1>
            <p className="text-white/70">Monitor tablet performance and status</p>
          </div>
          <div className="flex items-center space-x-4">
            <select
              className="text-sm border border-gray-200 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as any)}
            >
              <option value="Monthly">Monthly</option>
              <option value="Weekly">Weekly</option>
              <option value="Daily">Daily</option>
            </select>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Active Tablets"
            value="92%"
            icon={<Tablet className="text-indigo-600" size={24} />}
            subtitle="Currently online"
          />
          <StatCard
            title="Battery Health"
            value="85%"
            icon={<Battery className="text-green-600" size={24} />}
            subtitle="Average level"
          />
          <StatCard
            title="Connection Status"
            value="95%"
            icon={<Signal className="text-blue-600" size={24} />}
            subtitle="Network stability"
          />
          <StatCard
            title="Error Rate"
            value="0.5%"
            icon={<AlertCircle className="text-red-600" size={24} />}
            subtitle="Last 24 hours"
          />
        </div>

        {/* Main Chart */}
        <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Activity Overview</h2>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="activeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="offlineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="active"
                  stroke="#10b981"
                  fillOpacity={1}
                  fill="url(#activeGradient)"
                  name="Active"
                />
                <Area
                  type="monotone"
                  dataKey="offline"
                  stroke="#ef4444"
                  fillOpacity={1}
                  fill="url(#offlineGradient)"
                  name="Offline"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Additional Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Location Distribution */}
          <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-sm p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Tablet Locations</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={locationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label
                  >
                    {locationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Battery Distribution */}
          <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-sm p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Battery Distribution</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={batteryData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="level" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="tablets" fill="#10b981" name="Tablets" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Error Distribution */}
          <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-sm p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Error Distribution</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={errorData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis type="number" />
                  <YAxis dataKey="type" type="category" />
                  <Tooltip />
                  <Bar dataKey="count" fill="#ef4444" name="Occurrences" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TabletAnalytics;
