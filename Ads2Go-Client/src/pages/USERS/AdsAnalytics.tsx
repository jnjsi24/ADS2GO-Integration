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
import { Eye, Clock, Target, Users } from 'lucide-react';

const AdsAnalytics = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<'Monthly' | 'Weekly' | 'Daily'>('Weekly');

  const viewsData = [
    { name: 'Week 1', views: 12500, engagement: 8500, clicks: 2300 },
    { name: 'Week 2', views: 15000, engagement: 10200, clicks: 3100 },
    { name: 'Week 3', views: 11000, engagement: 7800, clicks: 1900 },
    { name: 'Week 4', views: 16500, engagement: 11500, clicks: 3500 },
  ];

  const categoryData = [
    { name: 'Retail', value: 35 },
    { name: 'Food & Beverage', value: 25 },
    { name: 'Entertainment', value: 20 },
    { name: 'Services', value: 15 },
    { name: 'Others', value: 5 },
  ];

  const timeDistribution = [
    { time: '6AM-9AM', views: 2500 },
    { time: '9AM-12PM', views: 3500 },
    { time: '12PM-3PM', views: 4200 },
    { time: '3PM-6PM', views: 3800 },
    { time: '6PM-9PM', views: 4500 },
    { time: '9PM-12AM', views: 2800 },
  ];

  const demographicData = [
    { age: '18-24', percentage: 25 },
    { age: '25-34', percentage: 35 },
    { age: '35-44', percentage: 20 },
    { age: '45-54', percentage: 15 },
    { age: '55+', percentage: 5 },
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
              Advertisement Analytics
            </h1>
            <p className="text-white/70">Comprehensive ad performance metrics</p>
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
            title="Total Views"
            value="55,000"
            icon={<Eye className="text-indigo-600" size={24} />}
            subtitle="Last 30 days"
          />
          <StatCard
            title="Avg. View Time"
            value="2m 15s"
            icon={<Clock className="text-blue-600" size={24} />}
            subtitle="Per session"
          />
          <StatCard
            title="Engagement Rate"
            value="68.5%"
            icon={<Target className="text-purple-600" size={24} />}
            subtitle="Interaction rate"
          />
          <StatCard
            title="Unique Viewers"
            value="32,450"
            icon={<Users className="text-cyan-600" size={24} />}
            subtitle="Distinct users"
          />
        </div>

        {/* Main Chart */}
        <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Performance Overview</h2>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={viewsData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="engagementGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
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
                  dataKey="views"
                  stroke="#3b82f6"
                  fillOpacity={1}
                  fill="url(#viewsGradient)"
                  name="Views"
                />
                <Area
                  type="monotone"
                  dataKey="engagement"
                  stroke="#10b981"
                  fillOpacity={1}
                  fill="url(#engagementGradient)"
                  name="Engagement"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Additional Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Category Distribution */}
          <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-sm p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Ad Categories</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Time Distribution */}
          <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-sm p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Viewing Time Distribution</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timeDistribution}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="views" fill="#3b82f6" name="Views" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Demographic Distribution */}
          <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-sm p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Viewer Demographics</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={demographicData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis type="number" />
                  <YAxis dataKey="age" type="category" />
                  <Tooltip />
                  <Bar dataKey="percentage" fill="#6366f1" name="Percentage" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdsAnalytics;
