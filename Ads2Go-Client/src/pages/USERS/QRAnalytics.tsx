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

const QRAnalytics = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<'Weekly' | 'Daily' | 'Today'>('Today');

  const todayData = [
    { name: 'Morning', value: 400, hour: '6AM-12PM' },
    { name: 'Afternoon', value: 300, hour: '12PM-6PM' },
    { name: 'Evening', value: 300, hour: '6PM-12AM' },
    { name: 'Night', value: 200, hour: '12AM-6AM' },
  ];

  const weeklyData = [
    { name: 'Week 1', value: 400, locations: 25 },
    { name: 'Week 2', value: 300, locations: 20 },
    { name: 'Week 3', value: 300, locations: 22 },
    { name: 'Week 4', value: 200, locations: 18 },
  ];

  const dailyData = [
    { name: 'Mon', value: 400, locations: 15 },
    { name: 'Tue', value: 300, locations: 12 },
    { name: 'Wed', value: 300, locations: 14 },
    { name: 'Thu', value: 200, locations: 10 },
    { name: 'Fri', value: 150, locations: 8 },
    { name: 'Sat', value: 100, locations: 6 },
    { name: 'Sun', value: 80, locations: 5 },
  ];

  const locationData = [
    { name: 'Shopping Malls', value: 35 },
    { name: 'Transit Stations', value: 25 },
    { name: 'Office Buildings', value: 20 },
    { name: 'Restaurants', value: 15 },
    { name: 'Others', value: 5 },
  ];

  const colors = ['#1e40af', '#3b82f6', '#ff7849', '#fb923c', '#fbbf24'];

  const getChartData = () => {
    switch (selectedPeriod) {
      case 'Weekly':
        return weeklyData;
      case 'Daily':
        return dailyData;
      case 'Today':
        return todayData;
      default:
        return todayData;
    }
  };

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
              QR Impressions Analytics
            </h1>
            <p className="text-white/70">Detailed QR code scan analysis</p>
          </div>
          <div className="flex items-center space-x-4">
            <select
              className="text-sm border border-gray-200 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as any)}
            >
              <option value="Today">Today</option>
              <option value="Daily">Daily</option>
              <option value="Weekly">Weekly</option>
            </select>
          </div>
        </div>

        {/* Main Chart */}
        <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">QR Scan Trend</h2>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={getChartData()} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="scanGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
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
                  dataKey="value"
                  stroke="#3b82f6"
                  fillOpacity={1}
                  fill="url(#scanGradient)"
                  name="Scans"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Additional Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Location Distribution */}
          <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-sm p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Location Distribution</h3>
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

          {/* Scans by Location Count */}
          <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-sm p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Scans by Location Count</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getChartData()}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#3b82f6" name="Scans" />
                  {selectedPeriod !== 'Today' && (
                    <Bar dataKey="locations" fill="#10b981" name="Active Locations" />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRAnalytics;
