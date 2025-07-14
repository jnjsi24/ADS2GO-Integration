import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { CircleUser } from 'lucide-react';

const Dashboard = () => {
  const barData = [
    { day: '01', thisWeek: 400, lastWeek: 300 },
    { day: '02', thisWeek: 430, lastWeek: 350 },
    { day: '03', thisWeek: 500, lastWeek: 380 },
    { day: '04', thisWeek: 480, lastWeek: 400 },
    { day: '05', thisWeek: 600, lastWeek: 420 },
    { day: '06', thisWeek: 580, lastWeek: 440 },
    { day: '07', thisWeek: 500, lastWeek: 410 },
    { day: '08', thisWeek: 480, lastWeek: 390 },
    { day: '09', thisWeek: 470, lastWeek: 360 },
    { day: '10', thisWeek: 450, lastWeek: 340 },
    { day: '11', thisWeek: 480, lastWeek: 370 },
    { day: '12', thisWeek: 440, lastWeek: 350 },
  ];

  const pieData = [
    { name: 'Afternoon', value: 40 },
    { name: 'Evening', value: 32 },
    { name: 'Morning', value: 28 }
  ];

  const colors = ['#6F7BF7', '#C6CCFB', '#E5E8FD'];

  return (
    <div className="min-h-screen bg-gray-50 p-8 ml-64">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center space-x-2 text-gray-600">
          <CircleUser />
          <span>Company Name</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Impressions Chart */}
        <div className="col-span-2 bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold">Impressions</h2>
          <p className="text-gray-500 mb-2">IDR 7.852.000</p>
          <p className="text-green-600 text-sm">▲ 2.1% vs last week</p>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={barData}>
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="lastWeek" fill="#E5E8FD" />
              <Bar dataKey="thisWeek" fill="#6F7BF7" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Right: QR Impressions Pie Chart */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">QR Impressions</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                fill="#8884d8"
                paddingAngle={5}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <ul className="mt-4 text-sm text-gray-600 space-y-1">
            {pieData.map((item, index) => (
              <li key={index} className="flex items-center space-x-2">
                <span className={`w-3 h-3 rounded-full`} style={{ backgroundColor: colors[index] }}></span>
                <span>{item.name}: {item.value}%</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Bottom: Top Ads and Active Advertisements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* Your Top Ads */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Your Top Ads</h2>
          <div className="flex items-center justify-around">
            <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center text-blue-800 text-lg font-bold">
              92%<br />Bam
            </div>
            <div className="w-24 h-24 rounded-full bg-orange-100 flex items-center justify-center text-orange-800 text-lg font-bold">
              85%<br />Kiko
            </div>
            <div className="w-24 h-24 rounded-full bg-purple-100 flex items-center justify-center text-purple-800 text-lg font-bold">
              85%<br />Akbayan
            </div>
          </div>
        </div>

        {/* Active Advertisements */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Active Advertisements</h2>
          <ul className="space-y-3 text-gray-700">
            <li>📢 Akbayan Campaign — UID: 001</li>
            <li>📢 Kiko Campaign — UID: 002</li>
            <li>📢 Bam Campaign — UID: 003</li>
            <li>📢 Kulangot Campaign — UID: 004</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
