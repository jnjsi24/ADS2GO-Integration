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
  BarChart,
  Bar,
  LineChart,
  Line
} from 'recharts';

const ProfitLossAnalytics = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<'Monthly' | 'Weekly' | 'Daily'>('Monthly');
  const [displayRevenue, setDisplayRevenue] = useState(0);
  const [displayExpenses, setDisplayExpenses] = useState(0);
  const [displayProfit, setDisplayProfit] = useState(0);

  const monthlyData = [
    { period: 'JAN', profit: 5000, loss: 8000, netProfit: -3000 },
    { period: 'FEB', profit: 3200, loss: 2500, netProfit: 700 },
    { period: 'MAR', profit: 7000, loss: 6500, netProfit: 500 },
    { period: 'APR', profit: 6500, loss: 2800, netProfit: 3700 },
    { period: 'MAY', profit: 3500, loss: 3200, netProfit: 300 },
    { period: 'JUNE', profit: 8500, loss: 3500, netProfit: 5000 },
    { period: 'JULY', profit: 7800, loss: 3000, netProfit: 4800 },
    { period: 'AUG', profit: 9000, loss: 3800, netProfit: 5200 },
    { period: 'SEP', profit: 2000, loss: 4000, netProfit: -2000 },
    { period: 'OCT', profit: 1000, loss: 3600, netProfit: -2600 },
    { period: 'NOV', profit: 600, loss: 8000, netProfit: -7400 },
    { period: 'DEC', profit: 700, loss: 9000, netProfit: -8300 },
  ];

  const weeklyData = [
    { period: 'Week 1', profit: 800, loss: 1500, netProfit: -700 },
    { period: 'Week 2', profit: 1500, loss: 700, netProfit: 800 },
    { period: 'Week 3', profit: 600, loss: 7000, netProfit: -6400 },
    { period: 'Week 4', profit: 900, loss: 900, netProfit: 0 },
  ];

  const dailyData = [
    { period: 'Mon', profit: 300, loss: 100, netProfit: 200 },
    { period: 'Tue', profit: 400, loss: 150, netProfit: 250 },
    { period: 'Wed', profit: 250, loss: 80, netProfit: 170 },
    { period: 'Thu', profit: 350, loss: 120, netProfit: 230 },
    { period: 'Fri', profit: 500, loss: 200, netProfit: 300 },
    { period: 'Sat', profit: 600, loss: 250, netProfit: 350 },
    { period: 'Sun', profit: 200, loss: 70, netProfit: 130 },
  ];

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
              Profit & Loss Analytics
            </h1>
            <p className="text-white/70">Detailed financial performance analysis</p>
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
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Profit vs Loss Trend</h2>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={getChartData()} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="lossGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
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
                  dataKey="profit"
                  stroke="#10b981"
                  fillOpacity={1}
                  fill="url(#profitGradient)"
                  name="Profit"
                />
                <Area
                  type="monotone"
                  dataKey="loss"
                  stroke="#ef4444"
                  fillOpacity={1}
                  fill="url(#lossGradient)"
                  name="Loss"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Additional Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Net Profit Trend */}
          <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-sm p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Net Profit Trend</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={getChartData()}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="netProfit" 
                    stroke="#6366f1" 
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Net Profit"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Profit vs Loss Comparison */}
          <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-sm p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Profit vs Loss Comparison</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getChartData()}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="profit" fill="#10b981" name="Profit" />
                  <Bar dataKey="loss" fill="#ef4444" name="Loss" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfitLossAnalytics;
