import React from 'react';
import { 
  Clock,
  TrendingUp,
  Eye,
  DollarSign
} from 'lucide-react';

interface AnalyticsProps {
  analytics?: {
    totalViewTime: string;
    avgCompletionRate: number;
    totalImpressions: number;
    totalRevenue: number;
  };
}

const Analytics: React.FC<AnalyticsProps> = ({ analytics }) => {
  // Show empty state if no analytics data is provided
  if (!analytics) {
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold">Analytics & Performance</h3>
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-gray-900 mb-1">No Analytics Data</h3>
          <p className="text-sm text-gray-500">Analytics data will appear here once ads start playing.</p>
        </div>
      </div>
    );
  }

  const displayAnalytics = analytics;

  const topPerformingAds: any[] = [];

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Analytics & Performance</h3>
      
      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600">Total View Time</p>
              <p className="text-2xl font-bold text-blue-700">{displayAnalytics.totalViewTime}</p>
            </div>
            <Clock className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600">Completion Rate</p>
              <p className="text-2xl font-bold text-green-700">{displayAnalytics.avgCompletionRate}%</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-600">Total Impressions</p>
              <p className="text-2xl font-bold text-purple-700">{displayAnalytics.totalImpressions.toLocaleString()}</p>
            </div>
            <Eye className="w-8 h-8 text-purple-500" />
          </div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-600">Revenue Generated</p>
              <p className="text-2xl font-bold text-yellow-700">₱{displayAnalytics.totalRevenue.toLocaleString()}</p>
            </div>
            <DollarSign className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
      </div>

      {/* Top Performing Ads */}
      {topPerformingAds.length > 0 && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium mb-3">Top Performing Ads</h4>
          <div className="space-y-3">
            {topPerformingAds.map((ad, index) => (
              <div key={index} className="flex items-center justify-between bg-white p-3 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium">{ad.title}</div>
                    <div className="text-sm text-gray-500">{ad.views} views</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-green-600">{ad.completion}%</div>
                  <div className="text-sm text-gray-500">₱{ad.revenue}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Additional Analytics Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Device Performance */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium mb-3">Device Performance</h4>
          <div className="text-center py-8 text-gray-500">
            <div className="text-gray-400 mb-2">
              <svg className="mx-auto h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            </div>
            <p className="text-sm">Device performance data will appear here</p>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium mb-3">Recent Activity</h4>
          <div className="text-center py-8 text-gray-500">
            <div className="text-gray-400 mb-2">
              <svg className="mx-auto h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm">Recent activity will appear here</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
