import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
  BarChart,
  Bar
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Target, 
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Filter
} from 'lucide-react';

const Analytics = () => {
  const location = useLocation();
  const [selectedPeriod, setSelectedPeriod] = useState<'Monthly' | 'Weekly' | 'Daily'>('Monthly');
  const [analyticsType, setAnalyticsType] = useState<'revenue' | 'expenses' | 'advertisements' | 'riders'>(
    (location.state?.type as any) || 'revenue'
  );
  const [displayValue, setDisplayValue] = useState(0);
  const [displayChange, setDisplayChange] = useState('0%');
  const [changeType, setChangeType] = useState<'positive' | 'negative'>('positive');

  const monthlyData = [
    { period: 'JAN', value: 5000 },
    { period: 'FEB', value: 3200 },
    { period: 'MAR', value: 7000 },
    { period: 'APR', value: 6500 },
    { period: 'MAY', value: 3500 },
    { period: 'JUNE', value: 8500 },
    { period: 'JULY', value: 7800 },
    { period: 'AUG', value: 9000 },
    { period: 'SEP', value: 2000 },
    { period: 'OCT', value: 1000 },
    { period: 'NOV', value: 600 },
    { period: 'DEC', value: 700 },
  ];

  const weeklyData = [
    { period: 'Week 1', value: 800 },
    { period: 'Week 2', value: 1500 },
    { period: 'Week 3', value: 600 },
    { period: 'Week 4', value: 900 },
  ];

  const dailyData = [
    { period: 'Mon', value: 300 },
    { period: 'Tue', value: 400 },
    { period: 'Wed', value: 250 },
    { period: 'Thu', value: 350 },
    { period: 'Fri', value: 500 },
    { period: 'Sat', value: 600 },
    { period: 'Sun', value: 200 },
  ];

  const getAnalyticsTitle = () => {
    switch (analyticsType) {
      case 'revenue':
        return 'Revenue Analytics';
      case 'expenses':
        return 'Expenses Analytics';
      case 'advertisements':
        return 'Advertisement Analytics';
      case 'riders':
        return 'Riders Analytics';
      default:
        return 'Analytics';
    }
  };

  const getChartData = () => {
    switch (selectedPeriod) {
      case 'Monthly':
        return monthlyData;
      case 'Weekly':
        return weeklyData;
      case 'Daily':
        return dailyData;
      default:
        return monthlyData;
    }
  };

  // Additional analytics data
  const hourlyDistribution = [
    { name: 'Morning', value: 400 },
    { name: 'Afternoon', value: 300 },
    { name: 'Evening', value: 300 },
    { name: 'Night', value: 200 },
  ];

  const colors = ['#1e40af', '#3b82f6', '#ff7849', '#fb923c'];

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
              {getAnalyticsTitle()}
            </h1>
            <p className="text-white/70">Detailed analysis and insights</p>
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

        {/* Main Chart */}
        <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-sm p-6">
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={getChartData()} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="period" stroke="#6b7280" />
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
                  fill="url(#colorValue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Additional Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Distribution by Time */}
          <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-sm p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Distribution by Time</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={hourlyDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {hourlyDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Trend Analysis */}
          <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-sm p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Trend Analysis</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getChartData()}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
