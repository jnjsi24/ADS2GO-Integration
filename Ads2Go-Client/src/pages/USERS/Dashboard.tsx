import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext'; // ✅ Import useAuth to access logged-in user

const Dashboard = () => {
  const { user } = useAuth(); // ✅ Get user from auth context
  const [selectedOption, setSelectedOption] = useState('Riders');

  const firstName = user?.firstName || 'User'; // ✅ Extract first name

  const barData = [
    { day: 'JAN', profit: 5000, loss: 2000 },
    { day: 'FEB', profit: 6000, loss: 2500 },
    { day: 'MAR', profit: 7000, loss: 3000 },
    { day: 'APR', profit: 6500, loss: 2800 },
    { day: 'MAY', profit: 8000, loss: 3200 },
    { day: 'JUNE', profit: 8500, loss: 3500 },
  ];

  const pieData = [
    { name: 'Morning', value: 55 },
    { name: 'Afternoon', value: 25 },
    { name: 'Evening', value: 20 },
  ];

  const colors = ['#3674B5', '#F3A26D', '#C9E6F0'];

  const riderData = [
    { name: 'Joseph Arimathea', email: 'josepharimathea@gmail.com', status: 'New', id: 'Customer ID #74598320', time: '5 min ago' },
    { name: 'Clark Kent', email: 'clarkkent@gmail.com', status: 'Departed', id: 'Customer ID #15648399', time: '10 min ago' },
    { name: 'Allie Grater', email: 'alliegrater@gmail.com', status: 'Departed', id: 'Customer ID #16697013', time: '15 min ago' },
  ];

  const adData = [
    { title: 'Ad Campaign 1', status: 'Active', time: '5 min ago' },
    { title: 'Ad Campaign 2', status: 'Decline', time: '10 min ago' },
    { title: 'Ad Campaign 3', status: 'Active', time: '15 min ago' },
  ];

  return (
    <div className="min-h-screen bg-white p-8 ml-60">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-800">
            Welcome back, {firstName}!
          </h1>
          <p className="text-gray-500 text-sm">Here's your analytic detail</p>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {/* Total Advertisements */}
        <div className="bg-gray-100 p-4 rounded-xl shadow hover:scale-105 transition-all duration-300">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-500 text-md">Total Advertisements</span>
          </div>
          <p className="text-5xl font-bold text-gray-800 pt-2">12,832</p>
          <p className="text-sm pt-2">
            <span className="text-green-600">↑ +20.1%</span>
            <span className="text-black"> +2,123 today</span>
          </p>
          <div className="mt-20">
            <div className="pt-4 border-t border-gray-200 mb-2"></div>
            <Link
              to="/advertisements"
              className="text-white text-sm bg-[#3674B5] hover:bg-[#578FCA] rounded-lg px-4 py-2 flex items-center w-full justify-between"
            >
              View Report <span>→</span>
            </Link>
          </div>
        </div>

        {/* Total Riders */}
        <div className="bg-gray-100 p-4 rounded-xl shadow hover:scale-105 transition-all duration-300">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-500 text-md">Total Riders</span>
          </div>
          <p className="text-5xl font-bold text-gray-800 pt-2">1,062</p>
          <p className="text-sm pt-2">
            <span className="text-red-600">↓ -4%</span>
            <span className="text-black"> -426 today</span>
          </p>
          <div className="mt-20">
            <div className="pt-4 border-t border-gray-200 mb-2"></div>
            <Link
              to="/riders"
              className="text-white text-sm bg-[#3674B5] hover:bg-[#578FCA] rounded-lg px-4 py-2 flex items-center w-full justify-between"
            >
              View Report <span>→</span>
            </Link>
          </div>
        </div>

        {/* Impressions */}
        <div className="bg-gray-100 p-4 rounded-xl shadow hover:scale-105 transition-all duration-300 col-span-2">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-500 text-sm">Impressions</span>
            <select className="text-sm text-[#3674B5] bg-transparent border-none focus:outline-none">
              <option>Month</option>
            </select>
          </div>
          <p className="text-2xl font-bold text-gray-800">$86,400.12</p>
          <p className="text-green-600 text-sm">↑ 10% vs last month</p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={barData}>
              <XAxis dataKey="day" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip />
              <Bar dataKey="profit" fill="#3674B5" name="Profit" />
              <Bar dataKey="loss" fill="#C9E6F0" name="Loss" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Activity & QR Impressions */}
      <div className="flex flex-row space-x-6">
        {/* Recent Activity */}
        <div className="bg-gray-100 p-4 rounded-xl shadow hover:scale-105 transition-all duration-300 w-7/10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 pt-3">Recent Activity</h2>
            <select
              className="text-sm text-[#3674B5] font-bold bg-gray-100 focus:outline-none pr-1 mt-6"
              value={selectedOption}
              onChange={(e) => setSelectedOption(e.target.value)}
            >
              <option value="Riders">Riders</option>
              <option value="Advertisements">Advertisements</option>
            </select>
          </div>

          {/* Header Row */}
          <div className="grid grid-cols-[2fr_1fr_1.5fr_1fr] text-sm text-gray-500 font-medium mb-2 mt-6">
            {selectedOption === 'Riders' ? (
              <>
                <span className="text-black">Rider Name</span>
                <span className="ml-2 text-black">Status</span>
                <span className="ml-5 text-black">Customer ID</span>
                <span className="ml-2.5 text-black">Time</span>
              </>
            ) : (
              <>
                <span className="text-black">Ads Title</span>
                <span className="ml-2 text-black">Status</span>
                <span className="ml-5 text-black">Customer ID</span>
                <span className="ml-2.5 text-black">Time</span>
              </>
            )}
          </div>

          <ul className="space-y-3">
            {selectedOption === 'Riders'
              ? riderData.map((rider, index) => (
                  <li key={index} className="grid grid-cols-[2fr_1fr_1.5fr_1fr] items-center">
                    <div className="flex items-center space-x-3">
                      <div>
                        <p className="text-gray-700">{rider.name}</p>
                        <p className="text-gray-500 text-sm">{rider.email}</p>
                      </div>
                    </div>
                    <span
                      className={`mr-16 flex justify-center w-24 text-xs px-2 py-1 rounded ${
                        rider.status === 'New'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-200 text-green-800'
                      }`}
                    >
                      {rider.status}
                    </span>
                    <span className="text-gray-500 text-sm">{rider.id}</span>
                    <span className="text-gray-500 text-sm ml-1.5">{rider.time}</span>
                  </li>
                ))
              : adData.map((ad, index) => (
                  <li key={index} className="grid grid-cols-[2fr_1fr_1.5fr_1fr] items-center">
                    <div>
                      <p className="text-gray-700">{ad.title}</p>
                    </div>
                    <span
                      className={`mr-16 flex justify-center w-24 text-xs px-2 py-1 rounded ${
                        ad.status === 'Active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {ad.status}
                    </span>
                    <span className="text-gray-500 text-sm">N/A</span>
                    <span className="text-gray-500 text-sm ml-1.5">{ad.time}</span>
                  </li>
                ))}
          </ul>
        </div>

        {/* QR Impressions */}
        <div className="bg-gray-100 p-4 rounded-xl shadow hover:scale-105 transition-all duration-300 w-1/2">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold text-gray-800">QR Impressions</h2>
            <select className="text-sm font-bold text-[#3674B5] bg-transparent border-none focus:outline-none">
              <option>All time</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <ul className="mt-4 text-sm text-gray-600 space-y-1">
            {pieData.map((item, index) => (
              <li key={index} className="flex items-center space-x-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: colors[index] }}
                ></span>
                <span>{item.name}: {item.value}%</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
