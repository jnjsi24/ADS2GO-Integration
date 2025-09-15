import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieLabelRenderProps,
} from "recharts";
import { useQuery } from '@apollo/client';
import { GET_OWN_ADMIN_DETAILS } from '../../graphql/admin';

// GraphQL query to get admin details
const GET_ADMIN_DETAILS = GET_OWN_ADMIN_DETAILS;

// Dummy data for the Ad Impressions & QR Scans chart
const adPerformanceData = [
  { month: "Jan", impressions: 7000, qrScans: 4000 },
  { month: "Feb", impressions: 8000, qrScans: 5000 },
  { month: "Mar", impressions: 10000, qrScans: 7000 },
  { month: "Apr", impressions: 9000, qrScans: 6000 },
  { month: "May", impressions: 7500, qrScans: 4500 },
  { month: "Jun", impressions: 5000, qrScans: 3000 },
  { month: "Jul", impressions: 6000, qrScans: 3500 },
];

// Dummy data for Vehicle Status Overview
const vehicles = [
  {
    date: "25 Jul 12:30",
    amount: "- $10",
    paymentName: "Youtube",
    method: "VISA ****3254",
    category: "Subscription",
  },
  {
    date: "26 Jul 15:00",
    amount: "- $150",
    paymentName: "Reserved",
    method: "Mastercard ****2154",
    category: "Shopping",
  },
  {
    date: "27 Jul 9:00",
    amount: "- $80",
    paymentName: "Yaposhka",
    method: "Mastercard ****2154",
    category: "Cafe & Restaurants",
  },
];

const Dashboard = () => {
  const [adminName, setAdminName] = useState("Admin");
  
  // Fetch admin details from the backend
  const { loading, error, data } = useQuery(GET_ADMIN_DETAILS, {
    onCompleted: (data) => {
      if (data && data.getOwnAdminDetails) {
        const admin = data.getOwnAdminDetails;
        setAdminName(`${admin.firstName} ${admin.lastName}`);
      }
    },
    onError: (error) => {
      console.error("Error fetching admin details:", error);
    }
  });

  if (loading) return (
    <div className="p-8 pl-72 bg-[#f9f9fc] min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );

  if (error) return (
    <div className="p-8 pl-72 bg-[#f9f9fc] min-h-screen flex items-center justify-center">
      <div className="text-red-500">Error loading admin details: {error.message}</div>
    </div>
  );

  return (
    <div className="p-8 pl-72 bg-[#f9f9fc] min-h-screen text-gray-800 font-sans">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-semibold text-gray-800">
            Welcome back, {adminName}!
          </h2>
          <p className="text-sm text-gray-500">
            It is the best time to manage your finances
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Calendar icon and 'This month' button - Removed profile section */}
          <div className="flex items-center bg-white border border-gray-200 rounded-lg px-4 py-2 shadow-sm text-gray-700 text-sm cursor-pointer">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            This month
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 ml-2 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { label: "Total Advertisements", value: "$15,700.00", change: "12.1%", up: true },
          { label: "Active Advertisements", value: "$8,500.00", change: "6.3%", up: true },
          { label: "Pending Advertisements", value: "$6,222.00", change: "2.4%", up: false },
          { label: "Total Riders", value: "$32,913.00", change: "12.1%", up: true },
        ].map((stat, i) => (
          <div
            key={i}
            className="bg-white p-5 rounded-2xl shadow-sm flex flex-col justify-between"
          >
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm text-gray-500">{stat.label}</p>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
            <p className="text-2xl font-bold text-gray-800 mb-1">
              {stat.value}
            </p>
            <p
              className={`text-sm font-medium ${
                stat.up ? "text-green-600" : "text-red-600"
              }`}
            >
              {stat.up ? "▲" : "▼"} {stat.change} vs last month
            </p>
          </div>
        ))}
      </div>

      {/* Ad Impressions & QR Scans Chart (now spans full width below stat cards) */}
      <div className="bg-white p-6 rounded-2xl shadow-sm mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">
            Ad Impressions & QR Scans
          </h3>
          <div className="flex items-center space-x-4 text-sm">
            <span className="flex items-center text-gray-600">
              <span className="w-2 h-2 rounded-full bg-blue-500 mr-1"></span>
              Impressions
            </span>
            <span className="flex items-center text-gray-600">
              <span className="w-2 h-2 rounded-full bg-green-500 mr-1"></span>
              qrScans
            </span>
            <div className="relative">
              <select className="appearance-none bg-white border border-gray-300 rounded-lg py-1 px-3 pr-8 text-gray-700 leading-tight focus:outline-none focus:border-blue-500">
                <option>All accounts</option>
                <option>Account A</option>
                <option>Account B</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                <svg
                  className="fill-current h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                </svg>
              </div>
            </div>
            <div className="relative">
              <select className="appearance-none bg-white border border-gray-300 rounded-lg py-1 px-3 pr-8 text-gray-700 leading-tight focus:outline-none focus:border-blue-500">
                <option>This year</option>
                <option>Last year</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                <svg
                  className="fill-current h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={adPerformanceData} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
            <XAxis dataKey="month" axisLine={false} tickLine={false} />
            <YAxis axisLine={false} tickLine={false} />
            <Tooltip />
            <Bar dataKey="impressions" fill="#3674B5" barSize={50} radius={[10, 10, 0, 0]} />
            <Bar dataKey="qrScans" fill="#C9E6F0" barSize={50} radius={[10, 10, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Vehicle Status Overview Table */}
      <div className="bg-white p-6 rounded-2xl shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">
            Vehicle Status Overview
          </h3>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <select className="appearance-none bg-white border border-gray-300 rounded-lg py-1 px-3 pr-8 text-gray-700 text-sm leading-tight focus:outline-none focus:border-blue-500">
                <option>All accounts</option>
                <option>Account A</option>
                <option>Account B</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                <svg
                  className="fill-current h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                </svg>
              </div>
            </div>
            <button className="text-blue-600 text-sm flex items-center">
              See all
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 ml-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </div>
        <table className="w-full table-auto text-sm">
          <thead className="text-gray-500">
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-normal">DATE</th>
              <th className="text-left py-3 px-4 font-normal">AMOUNT</th>
              <th className="text-left py-3 px-4 font-normal">PAYMENT NAME</th>
              <th className="text-left py-3 px-4 font-normal">METHOD</th>
              <th className="text-left py-3 px-4 font-normal">CATEGORY</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((row, i) => (
              <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 text-gray-700">{row.date}</td>
                <td className="py-3 px-4 text-gray-700">{row.amount}</td>
                <td className="py-3 px-4 text-gray-700">{row.paymentName}</td>
                <td className="py-3 px-4 text-gray-700">{row.method}</td>
                <td className="py-3 px-4 text-gray-700">{row.category}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Dashboard;