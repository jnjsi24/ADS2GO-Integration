import React from 'react';
import {
  BarChart3,
  Eye,
  TrendingUp,
  DollarSign,
} from 'lucide-react';

interface AnalyticsTabProps {}

const AnalyticsTab: React.FC<AnalyticsTabProps> = () => {
  // Example dynamic engagement value (can be fetched from API)
  const engagementRate = 92; // %

  return (
    <div className="p-8 bg-gray-100 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-gray-800">📊 Analytics Overview</h2>
        <span className="text-sm text-gray-500">
          Updated: <strong>Today</strong>
        </span>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {/* Total Views */}
        <div className="bg-white rounded-xl shadow hover:shadow-lg transition p-6 flex flex-col items-center">
          <Eye className="w-10 h-10 text-blue-500 mb-3" />
          <p className="text-3xl font-extrabold text-gray-800">12,340</p>
          <p className="text-sm text-gray-500">Total Views</p>
        </div>

        {/* Engagement Rate with Bar */}
        <div className="bg-white rounded-xl shadow hover:shadow-lg transition p-6 w-full">
          <div className="flex flex-col items-center">
            <TrendingUp className="w-10 h-10 text-green-500 mb-3" />
            <p className="text-3xl font-extrabold text-gray-800 mb-1">
              {engagementRate}%
            </p>
            <p className="text-sm text-gray-500 mb-4">Engagement Rate</p>

            {/* Horizontal Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-green-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${engagementRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* Revenue */}
        <div className="bg-white rounded-xl shadow hover:shadow-lg transition p-6 flex flex-col items-center">
          <DollarSign className="w-10 h-10 text-yellow-500 mb-3" />
          <p className="text-3xl font-extrabold text-gray-800">$8,540</p>
          <p className="text-sm text-gray-500">Revenue</p>
        </div>

        {/* Active Campaigns */}
        <div className="bg-white rounded-xl shadow hover:shadow-lg transition p-6 flex flex-col items-center">
          <BarChart3 className="w-10 h-10 text-purple-500 mb-3" />
          <p className="text-3xl font-extrabold text-gray-800">24</p>
          <p className="text-sm text-gray-500">Active Campaigns</p>
        </div>
      </div>

      {/* Chart Placeholder */}
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Performance Chart</h3>
        <div className="flex items-center justify-center h-60 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
          <p className="text-gray-500">Charts will be displayed here</p>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsTab;
