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
  // Mock data for demonstration
  const mockAnalytics = {
    totalViewTime: '2h 45m',
    avgCompletionRate: 87,
    totalImpressions: 1250,
    totalRevenue: 3125
  };

  const displayAnalytics = analytics || mockAnalytics;

  const topPerformingAds = [
    { title: 'Sample Ad #1', views: 450, completion: 95, revenue: 1125 },
    { title: 'Product Demo', views: 380, completion: 89, revenue: 950 },
    { title: 'Brand Story', views: 320, completion: 82, revenue: 800 },
    { title: 'Company Intro', views: 280, completion: 78, revenue: 700 },
    { title: 'Call to Action', views: 250, completion: 75, revenue: 625 }
  ];

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

      {/* Additional Analytics Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Device Performance */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium mb-3">Device Performance</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Online Devices</span>
              <span className="font-medium">12/15</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full" style={{ width: '80%' }}></div>
            </div>
            <div className="flex justify-between text-sm">
              <span>Active Displays</span>
              <span className="font-medium">8/12</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full" style={{ width: '67%' }}></div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium mb-3">Recent Activity</h4>
          <div className="space-y-2">
            <div className="text-sm text-gray-600">
              <div className="font-medium">Ad deployed to 5 screens</div>
              <div className="text-xs text-gray-500">2 minutes ago</div>
            </div>
            <div className="text-sm text-gray-600">
              <div className="font-medium">Device ABC123 came online</div>
              <div className="text-xs text-gray-500">5 minutes ago</div>
            </div>
            <div className="text-sm text-gray-600">
              <div className="font-medium">Maintenance completed on XYZ789</div>
              <div className="text-xs text-gray-500">1 hour ago</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
