import React, { useState, useEffect, ChangeEvent } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const [selectedOption, setSelectedOption] = useState('Riders');
  // Explicitly type selectedPeriod to the union of its possible values
  const [selectedPeriod, setSelectedPeriod] = useState<'Monthly' | 'Weekly' | 'Daily'>('Monthly');
  // Changed initial state from 'All time' to 'Today'
  const [qrSelectedPeriod, setQrSelectedPeriod] = useState<'Weekly' | 'Daily' | 'Today'>('Today');
  const [displayRevenue, setDisplayRevenue] = useState(0);
  const [displayExpenses, setDisplayExpenses] = useState(0);
  const [displayProfit, setDisplayProfit] = useState(0);
  const [displayPeriodLabel, setDisplayPeriodLabel] = useState('');
  const [userFirstName, setUserFirstName] = useState('User');

  // Get user's first name from localStorage on component mount
  useEffect(() => {
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        if (user && user.firstName) {
          setUserFirstName(user.firstName);
        }
      }
    } catch (error) {
      console.error('Error parsing user data from localStorage:', error);
      // Keep default 'User' if there's an error
    }
  }, []);

  const barData = [
    { day: 'JAN', profit: 5000, loss: 8000 },
    { day: 'FEB', profit: 3200, loss: 2500 },
    { day: 'MAR', profit: 7000, loss: 6500 },
    { day: 'APR', profit: 6500, loss: 2800 },
    { day: 'MAY', profit: 3500, loss: 3200 },
    { day: 'JUNE', profit: 8500, loss: 3500 },
    { day: 'JULY', profit: 7800, loss: 3000 },
    { day: 'AUG', profit: 9000, loss: 3800 },
    { day: 'SEP', profit: 2000, loss: 4000 },
    { day: 'OCT', profit: 1000, loss: 3600 },
    { day: 'NOV', profit: 600, loss: 8000 },
    { day: 'DEC', profit: 700, loss: 9000 },
  ];

  // Dummy data for weekly and daily, you would replace this with actual data
  const weeklyBarData = [
    { day: 'Week 1', profit: 800, loss: 1500 },
    { day: 'Week 2', profit: 1500, loss: 700 },
    { day: 'Week 3', profit: 600, loss: 7000 },
    { day: 'Week 4', profit: 900, loss: 900 },
    { day: 'Week 5', profit: 1200, loss: 700 },
  ];

  const dailyBarData = [
    { day: 'Monday', profit: 300, loss: 100 },
    { day: 'Tueday', profit: 400, loss: 150 },
    { day: 'Wednesday', profit: 250, loss: 80 },
    { day: 'Thursday', profit: 350, loss: 120 },
    { day: 'Friday', profit: 500, loss: 200 },
    { day: 'Saturday', profit: 600, loss: 250 },
    { day: 'Sunday', profit: 200, loss: 70 },
  ];

  // QR Impressions data
  const qrTodayData = [
    { name: 'Morning', value: 55 },
    { name: 'Afternoon', value: 25 },
    { name: 'Evening', value: 20 },
  ];

  const qrWeeklyData = [
    { name: 'Week 1', value: 20 },
    { name: 'Week 2', value: 25 },
    { name: 'Week 3', value: 15 },
    { name: 'Week 4', value: 30 },
    { name: 'Week 5', value: 10 },
  ];

  const qrDailyData = [
    { name: 'Mon', value: 10 },
    { name: 'Tue', value: 15 },
    { name: 'Wed', value: 20 },
    { name: 'Thu', value: 12 },
    { name: 'Fri', value: 18 },
    { name: 'Sat', value: 15 },
    { name: 'Sun', value: 10 },
  ];

  const colors = ['#0E2A47', '#1b5087', '#3674B5', '#E78B48', '#FFAB5B', '#D4C9BE', '#EFEEEA']; // Colors for the pie chart

  const recentOrderData = [
    {
      orderId: '97174',
      product: 'Apple MacBook Pro',
      image: 'https://via.placeholder.com/40',
      orderTime: '01/12/2023, 12:33',
      status: 'Pending',
      qty: 1,
      totalPrice: 2092,
      customer: 'Luca Rijal',
    },
    {
      orderId: '97173',
      product: 'iBox iPhone 14 Pro',
      image: 'https://via.placeholder.com/40',
      orderTime: '01/12/2023, 07:41',
      status: 'Active',
      qty: 1,
      totalPrice: 1852,
      customer: 'Lina Punk Oy Oy',
    },
    {
      orderId: '97172',
      product: 'Apple AirPods Pro',
      image: 'https://via.placeholder.com/40',
      orderTime: '01/10/2023, 23:01',
      status: 'Rejected',
      qty: 2,
      totalPrice: 522,
      customer: 'Cristiano Edgar',
    },
    {
      orderId: '97171',
      product: 'iBox iPhone 14 Pro',
      image: 'https://via.placeholder.com/40',
      orderTime: '01/10/2023, 21:42',
      status: 'Rejected',
      qty: 1,
      totalPrice: 1852,
      customer: 'Angkara Toldo',
    },
  ];

  const calculateFinancials = (period: 'Monthly' | 'Weekly' | 'Daily') => {
    let totalProfit = 0;
    let totalLoss = 0;
    let currentData = [];
    let label = '';

    switch (period) {
      case 'Monthly':
        currentData = barData;
        label = 'Annual'; // Since barData represents a full year
        break;
      case 'Weekly':
        currentData = weeklyBarData; // Use weekly data
        label = 'This Week';
        break;
      case 'Daily':
        currentData = dailyBarData; // Use daily data
        label = 'Today';
        break;
      default:
        currentData = barData;
        label = 'Annual';
    }

    currentData.forEach(item => {
      totalProfit += item.profit;
      totalLoss += item.loss;
    });

    setDisplayRevenue(totalProfit);
    setDisplayExpenses(totalLoss);
    setDisplayProfit(totalProfit - totalLoss);
    setDisplayPeriodLabel(label);
  };

  useEffect(() => {
    calculateFinancials(selectedPeriod);
  }, [selectedPeriod]); // Recalculate when selectedPeriod changes

  const handlePeriodChange = (e: ChangeEvent<HTMLSelectElement>) => {
    // Cast e.target.value to the specific union type
    setSelectedPeriod(e.target.value as 'Monthly' | 'Weekly' | 'Daily');
  };

  const getChartData = () => {
    switch (selectedPeriod) {
      case 'Monthly':
        return barData;
      case 'Weekly':
        return weeklyBarData;
      case 'Daily':
        return dailyBarData;
      default:
        return barData;
    }
  };

  // Function to get data for QR Impressions pie chart based on selected period
  const getQrChartData = () => {
    // Define a type for the QR data items
    type QrDataItem = { name: string; value: number; };

    switch (qrSelectedPeriod) {
      case 'Weekly':
        return qrWeeklyData;
      case 'Daily':
        return qrDailyData;
      case 'Today':
        return qrTodayData;
      default:
        // This default case ensures a fallback, though it shouldn't be reached
        // if qrSelectedPeriod is always one of the specified types.
        return qrTodayData;
    }
  };

  const handleQrPeriodChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setQrSelectedPeriod(e.target.value as 'Weekly' | 'Daily' | 'Today'); // Removed 'All time' from type
  };


  return (
    <div className="min-h-screen bg-white pl-72 pr-5 p-10">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-800">Welcome back, {userFirstName}!</h1>
          <p className="text-gray-500 text-sm">Here's your analytic detail</p>
        </div>
      </div>

      {/* Metrics Section - Adjusted Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {/* Profit & Loss Overview - Now spans 2 columns */}
        <div className="bg-[#1b5087] p-6 rounded-lg shadow-lg col-span-2 text-white">
          <div className="flex justify-between items-center mb-4">
            <span className="text-lg font-semibold">Profit & Loss Overview</span>
            <div className="relative">
              <select
                className="text-xs text-white bg-[#1b5087] rounded-md pl-5 pr-10 py-3 border border-white focus:outline-none appearance-none"
                value={selectedPeriod}
                onChange={handlePeriodChange}
              >
                <option className="rounded-lg" value="Monthly">Monthly</option>
                <option className="rounded-lg" value="Weekly">Weekly</option>
                <option className="rounded-lg" value="Daily">Daily</option>
              </select>
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={getChartData()} margin={{ top: 10, right: 0, left: 0, bottom: 20 }}>
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                stroke="white"
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#2D3748', border: 'none', borderRadius: '8px' }}
                labelStyle={{ color: '#E2E8F0' }}
                itemStyle={{ color: '#A8FF35' }}
              />
              <Area
                type="monotone"
                dataKey="profit"
                stroke="#A8FF35"
                fill="#2876c7"
                fillOpacity={0.6}
                name="Profit"
              />
              <Area
                type="monotone"
                dataKey="loss"
                stroke="#FF4D4D"
                fill="#2876c7"
                fillOpacity={0.6}
                name="Loss"
              />
            </AreaChart>
          </ResponsiveContainer>

          <div className="grid grid-cols-3 gap-4 mt-4 text-center">
            <div className="bg-[#1b5087] p-3 rounded-lg">
              <p className="text-2xl font-bold">${displayRevenue.toLocaleString()}</p>
              <p className="text-sm text-gray-300">Total Revenue</p>
              <p className="text-xs text-gray-400">{displayPeriodLabel}</p>
            </div>
            <div className="bg-[#2876c7] p-3 rounded-lg">
              <p className="text-2xl font-bold">${displayExpenses.toLocaleString()}</p>
              <p className="text-sm text-gray-300">Total Expenses</p>
              <p className="text-xs text-gray-400">{displayPeriodLabel}</p>
            </div>
            <div className="bg-[#1b5087] p-3 rounded-lg">
              <p className="text-2xl font-bold">${displayProfit.toLocaleString()}</p>
              <p className="text-sm text-gray-300">Net Profit</p>
              <p className="text-xs text-gray-400">{displayPeriodLabel}</p>
            </div>
          </div>
        </div>

        {/* Total Advertisements */}
        <div className="bg-white p-4 rounded-lg shadow-lg">
          <div className="flex justify-between items-center mt-8 pl-4">
            <span className="text-gray-500 text-lg">Total Advertisements</span>
          </div>
          <p className="text-5xl font-bold text-[#1b5087] pl-4">12,832</p>
          <p className="text-sm pt-2 pl-4">
            <span className="text-green-600">â†' +20.1%</span>
            <span className="text-black"> +2,123 today</span>
          </p>
          <div className="mt-32"> {/* Adjusted margin for consistent height */}
            <div className="pt-6 border-t border-gray-300 mb-2"></div>
            <Link
              to="/advertisements"
              className="text-white text-sm bg-[#1b5087] hover:bg-[#0E2A47] rounded-lg px-4 py-2 flex items-center justify-between hover:scale-105 transition-all duration-300"
            >
              View Report <span>→</span>
            </Link>
          </div>
        </div>

        {/* Total Riders */}
        <div className="bg-white p-4 rounded-lg shadow-lg">
          <div className="flex justify-between items-center mt-8 pl-4">
            <span className="text-gray-500 text-lg">Total Riders</span>
          </div>
          <p className="text-5xl font-bold text-[#1b5087] pl-4">1,062</p>
          <p className="text-sm pt-2 pl-4">
            <span className="text-red-600">â†" -4%</span>
            <span className="text-black"> -426 today</span>
          </p>
          <div className="mt-32"> {/* Adjusted margin for consistent height */}
            <div className="pt-6 border-t border-gray-300 mb-2"></div>
            <Link
              to="/advertisements"
              className="text-white text-sm bg-[#1b5087] hover:bg-[#0E2A47] rounded-lg px-4 py-2 flex items-center justify-between hover:scale-105 transition-all duration-300"
            >
              View Report <span>→</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Activity and QR Impressions Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Order - Now spans 2 columns */}
        <div className="bg-white p-4 rounded-lg shadow-lg lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold pt-3 text-gray-800">Recent Activity</h2>
            <div className="relative pt-3"> {/* Wrap select and icon for relative positioning */}
              <select
              className="appearance-none w-full text-xs text-black border border-gray-200 rounded-md pl-5 pr-10 py-3 focus:outline-none bg-white"
        >
          <option value="This Week">This Week</option>
          {/* Add other options if desired */}
        </select>
        {/* SVG icon positioned absolutely within the relative container */}
        <div className="absolute right-3 top-1/2 pt-3 transform -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
      </div>
    </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th scope="col" className="pt-8 px-3 py-2 text-center text-sm font-medium text-gray-500 uppercase tracking-wider">Ads ID</th>
                  <th scope="col" className="pt-8 px-3 py-2 text-center text-sm font-medium text-gray-500 uppercase tracking-wider">Product</th>
                  <th scope="col" className="pt-8 px-3 py-2 text-center text-sm font-medium text-gray-500 uppercase tracking-wider">Time</th>
                  <th scope="col" className="pt-8 px-3 py-2 text-center text-sm font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="pt-8 px-3 py-2 text-center text-sm font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                  <th scope="col" className="pt-8 px-3 py-2 text-center text-sm font-medium text-gray-500 uppercase tracking-wider">Total Price</th>
                  <th scope="col" className="pt-8 px-3 py-2 text-center text-sm font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentOrderData.map((order, index) => (
                  <tr key={index}>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{order.orderId}</td>
                    <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">{order.product}</td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">{order.orderTime}</td>
                    <td className="px-3 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 text-center font-semibold rounded-full ${
                          order.status === 'Pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : order.status === 'Active'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800' // 'Rejected' status
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">x{order.qty}</td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-center text-gray-900">${order.totalPrice.toLocaleString()}</td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {order.customer}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* QR Impressions - Now spans 1 column */}
        <div className="bg-white p-4 rounded-lg shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800 pt-3">QR Impressions</h2>
            <div className="relative pt-3">
              <select
                className="appearance-none w-full text-xs text-black border border-gray-200 rounded-md pl-5 pr-10 py-3 focus:outline-none bg-white"
                value={qrSelectedPeriod}
                onChange={handleQrPeriodChange}
              >
                {/* Removed 'All time' option */}
                <option value="Weekly">Weekly</option>
                <option value="Daily">Daily</option>
                <option value="Today">Today</option>
              </select>
              <div className="absolute right-3 top-1/2 pt-3 transform -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={getQrChartData()} // Use the dynamic data
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  dataKey="value"
                >
                  {getQrChartData().map((entry, index) => ( // Use dynamic data for cells too
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {qrSelectedPeriod === 'Daily' && (
            <div className="flex justify-around text-sm text-gray-600">
              <ul className="space-y-1">
                {qrDailyData.slice(0, 4).map((item, index) => (
                  <li key={index} className="flex items-center space-x-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: colors[index % colors.length] }}
                    ></span>
                    <span>
                      {item.name}: {item.value}%
                    </span>
                  </li>
                ))}
              </ul>
              <ul className="space-y-1">
                {qrDailyData.slice(4).map((item, index) => (
                  <li key={index + 4} className="flex items-center space-x-2 pl-10"> {/* Use a unique key */}
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: colors[(index + 4) % colors.length] }}
                    ></span>
                    <span>
                      {item.name}: {item.value}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {qrSelectedPeriod === 'Weekly' && (
            <div className="flex justify-around text-sm text-gray-600">
              <ul className="space-y-1">
                {qrWeeklyData.slice(0, 3).map((item, index) => (
                  <li key={index} className="flex items-center space-x-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: colors[index % colors.length] }}
                    ></span>
                    <span>
                      {item.name}: {item.value}%
                    </span>
                  </li>
                ))}
              </ul>
              <ul className="space-y-1">
                {qrWeeklyData.slice(3).map((item, index) => (
                  <li key={index + 3} className="flex items-center space-x-2"> {/* Use a unique key */}
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: colors[(index + 3) % colors.length] }}
                    ></span>
                    <span>
                      {item.name}: {item.value}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {qrSelectedPeriod === 'Today' && (
            <ul className="text-sm text-gray-600 space-y-1 pl-10">
              {qrTodayData.map((item, index) => (
                <li key={index} className="flex items-center space-x-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: colors[index % colors.length] }}
                  ></span>
                  <span>
                    {item.name}: {item.value}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;