import React, { useState, useEffect, ChangeEvent } from 'react';
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
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Target, 
  Eye, 
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Filter,
  MoreHorizontal,
  Bell,
  Search,
  Settings
} from 'lucide-react';

const Dashboard = () => {
  const [selectedOption, setSelectedOption] = useState('Riders');
  const [selectedPeriod, setSelectedPeriod] = useState<'Monthly' | 'Weekly' | 'Daily'>('Monthly');
  const [qrSelectedPeriod, setQrSelectedPeriod] = useState<'Weekly' | 'Daily' | 'Today'>('Today');
  const [displayRevenue, setDisplayRevenue] = useState(0);
  const [displayExpenses, setDisplayExpenses] = useState(0);
  const [displayProfit, setDisplayProfit] = useState(0);
  const [displayPeriodLabel, setDisplayPeriodLabel] = useState('');
  const [userFirstName, setUserFirstName] = useState('Alex');

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

  const weeklyBarData = [
    { day: 'Week 1', profit: 800, loss: 1500 },
    { day: 'Week 2', profit: 1500, loss: 700 },
    { day: 'Week 3', profit: 600, loss: 7000 },
    { day: 'Week 4', profit: 900, loss: 900 },
    { day: 'Week 5', profit: 1200, loss: 700 },
  ];

  const dailyBarData = [
    { day: 'Mon', profit: 300, loss: 100 },
    { day: 'Tue', profit: 400, loss: 150 },
    { day: 'Wed', profit: 250, loss: 80 },
    { day: 'Thu', profit: 350, loss: 120 },
    { day: 'Fri', profit: 500, loss: 200 },
    { day: 'Sat', profit: 600, loss: 250 },
    { day: 'Sun', profit: 200, loss: 70 },
  ];

  const qrTodayData = [
    { name: 'Morning', value: 400 },
    { name: 'Afternoon', value: 300 },
    { name: 'Evening', value: 300 },
    { name: 'Night', value: 200 },
    { name: 'Late Night', value: 150 },
  ];

  const qrWeeklyData = [
    { name: 'Week 1', value: 400 },
    { name: 'Week 2', value: 300 },
    { name: 'Week 3', value: 300 },
    { name: 'Week 4', value: 200 },
    { name: 'Week 5', value: 150 },
  ];

  const qrDailyData = [
    { name: 'Mon', value: 400 },
    { name: 'Tue', value: 300 },
    { name: 'Wed', value: 300 },
    { name: 'Thu', value: 200 },
    { name: 'Fri', value: 150 },
    { name: 'Sat', value: 100 },
    { name: 'Sun', value: 80 },
  ];

  const colors = ['#1e40af', '#3b82f6', '#ff7849', '#fb923c', '#fbbf24'];

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
        label = 'Annual';
        break;
      case 'Weekly':
        currentData = weeklyBarData;
        label = 'This Week';
        break;
      case 'Daily':
        currentData = dailyBarData;
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
  }, [selectedPeriod]);

  const handlePeriodChange = (e: ChangeEvent<HTMLSelectElement>) => {
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

  const getQrChartData = () => {
    switch (qrSelectedPeriod) {
      case 'Weekly':
        return qrWeeklyData;
      case 'Daily':
        return qrDailyData;
      case 'Today':
        return qrTodayData;
      default:
        return qrTodayData;
    }
  };

  const handleQrPeriodChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setQrSelectedPeriod(e.target.value as 'Weekly' | 'Daily' | 'Today');
  };

  const StatCard = ({ title, value, change, changeType, icon, subtitle }: any) => (
    <div className="bg-white  shadow-sm border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 group">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2  bg-gradient-to-br from-indigo-50 to-blue-50 group-hover:from-indigo-100 group-hover:to-blue-100 transition-colors duration-300">
          {icon}
        </div>
        <button className="text-gray-400 hover:text-gray-600 transition-colors duration-200">
          <MoreHorizontal size={20} />
        </button>
      </div>
      
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-gray-900">{value}</span>
          {change && (
            <div className={`flex items-center space-x-1 ${changeType === 'positive' ? 'text-emerald-600' : 'text-red-500'}`}>
              {changeType === 'positive' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
              <span className="text-sm font-medium">{change}</span>
            </div>
          )}
        </div>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
    </div>
  );

  return (
<div
    className="min-h-screen pl-72 pr-5 p-10 bg-cover bg-center bg-no-repeat"
    style={{
      backgroundImage: "linear-gradient(135deg, #3674B5 0%, black 100%)"
    }}
  > 
      <div className="max-w-full space-y-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-3xl font-bold text-white/90 mb-2">
              Welcome back, {userFirstName}! 
            </h1>
            <p className="text-white/70">Here's what's happening with your business today.</p>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input 
                type="text" 
                placeholder="Search..."
                className="pl-10 pr-4 py-2 border border-gray-200  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
              />
            </div>
            <button className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors duration-200">
              <Bell size={20} />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 "></span>
            </button>
            <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors duration-200">
              <Settings size={20} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  <StatCard
    title="Total Revenue"
    value={`$${displayRevenue.toLocaleString()}`}
    change="+12.5%"
    changeType="positive"
    subtitle={displayPeriodLabel}
    className="bg-white/80 backdrop-blur-md rounded-md p-6"
    icon={<TrendingUp size={24} className="text-indigo-600" />}
  />
  <StatCard
    title="Total Expenses"
    value={`$${displayExpenses.toLocaleString()}`}
    change="-3.2%"
    changeType="positive"
    subtitle={displayPeriodLabel}
    className="bg-white/80 backdrop-blur-md rounded-md p-6"
    icon={<TrendingDown size={24} className="text-blue-600" />}
  />
  <StatCard
    title="Total Advertisements"
    value="12,832"
    change="+20.1%"
    changeType="positive"
    subtitle="+2,123 today"
    className="bg-white/80 backdrop-blur-md rounded-md p-6"
    icon={<Target size={24} className="text-purple-600" />}
  />
  <StatCard
    title="Total Riders"
    value="1,062"
    change="-4%"
    changeType="negative"
    subtitle="-426 today"
    className="bg-white/80 backdrop-blur-md rounded-md p-6"
    icon={<Users size={24} className="text-cyan-600" />}
  />
</div>


        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profit & Loss Chart */}
          <div className="lg:col-span-2 shadow-sm border border-white/10 p-6 bg-white/80 backdrop-blur-md rounded-md">

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-1">Profit & Loss Overview</h2>
                <p className="text-sm text-gray-600">Track your financial performance</p>
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 text-sm">
                  <div className="w-3 h-3  bg-emerald-500"></div>
                  <span className="text-gray-600">Profit</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <div className="w-3 h-3  bg-red-500"></div>
                  <span className="text-gray-600">Loss</span>
                </div>
                <select
                  className="text-sm border border-gray-200  px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                  value={selectedPeriod}
                  onChange={handlePeriodChange}
                >
                  <option value="Monthly">Monthly</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Daily">Daily</option>
                </select>
              </div>
            </div>

            <div className="h-80 mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={getChartData()} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
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
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#profitGradient)"
                    name="Profit"
                  />
                  <Area
                    type="monotone"
                    dataKey="loss"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fill="url(#lossGradient)"
                    name="Loss"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gradient-to-br from-emerald-50 to-green-50 ">
                <p className="text-2xl font-bold text-emerald-600">${displayRevenue.toLocaleString()}</p>
                <p className="text-sm text-gray-600 font-medium">Total Revenue</p>
                <p className="text-xs text-gray-500">{displayPeriodLabel}</p>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-red-50 to-rose-50 ">
                <p className="text-2xl font-bold text-red-500">${displayExpenses.toLocaleString()}</p>
                <p className="text-sm text-gray-600 font-medium">Total Expenses</p>
                <p className="text-xs text-gray-500">{displayPeriodLabel}</p>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-indigo-50 to-blue-50 ">
                <p className="text-2xl font-bold text-indigo-600">${displayProfit.toLocaleString()}</p>
                <p className="text-sm text-gray-600 font-medium">Net Profit</p>
                <p className="text-xs text-gray-500">{displayPeriodLabel}</p>
              </div>
            </div>
          </div>

          {/* QR Impressions */}
          <div className="  backdrop-blur-md rounded-xl">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-3xl font-semibold text-white/90 mb-1">QR Impressions</h2>
              </div>
              <select
                className="text-sm border border-gray-200  px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                value={qrSelectedPeriod}
                onChange={handleQrPeriodChange}
              >
                <option value="Weekly">Weekly</option>
                <option value="Daily">Daily</option>
                <option value="Today">Today</option>
              </select>
            </div>

            <div className="h-64 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={getQrChartData()}
                    cx="50%"
                    cy="50%"
                    innerRadius={0}
                    outerRadius={100}
                    dataKey="value"
                    stroke=""
                    strokeWidth={2}
                  >
                    {getQrChartData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => [value, 'Value']}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2">
              {getQrChartData().map((item, index) => (
                <div key={index} className="flex items-center justify-between p-2">
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-3 h-3 "
                      style={{ backgroundColor: colors[index % colors.length] }}
                    ></div>
                    <span className="text-sm font-medium text-white/90">{item.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-white/70">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white/80 backdrop-blur-md rounded-md shadow-sm border border-gray-100 p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Recent Activity</h2>
              <p className="text-sm text-gray-600">Latest transactions and orders</p>
            </div>
            <div className="flex items-center space-x-3">
              <button className="flex items-center space-x-2 px-3 py-2 text-sm border border-gray-200  hover:bg-gray-50 transition-colors duration-200">
                <Filter size={16} />
                <span>Filter</span>
              </button>
              <select className="text-sm border border-gray-200  px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white">
                <option value="This Week">This Week</option>
                <option value="This Month">This Month</option>
                <option value="Last Month">Last Month</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">Order ID</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">Product</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">Time</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">Qty</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">Total</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">Customer</th>
                </tr>
              </thead>
              <tbody>
                {recentOrderData.map((order, index) => (
                  <tr key={index} className="border-b border-gray-50 hover:bg-gray-50 transition-colors duration-200">
                    <td className="py-4 px-4">
                      <span className="text-sm font-medium text-gray-900">#{order.orderId}</span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gray-100  flex items-center justify-center">
                          <Activity size={16} className="text-gray-500" />
                        </div>
                        <span className="text-sm font-medium text-gray-900">{order.product}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-gray-600">{order.orderTime}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium  ${
                          order.status === 'Pending'
                            ? 'bg-amber-100 text-amber-700'
                            : order.status === 'Active'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-gray-600">×{order.qty}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm font-semibold text-gray-900">${order.totalPrice.toLocaleString()}</span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 bg-indigo-100  flex items-center justify-center">
                          <span className="text-xs font-medium text-indigo-600">{order.customer.charAt(0)}</span>
                        </div>
                        <span className="text-sm text-gray-700">{order.customer}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;