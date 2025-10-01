import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Play, Pause, Eye, Clock, TrendingUp } from 'lucide-react';

interface AdPerformance {
  adId: string;
  adTitle: string;
  playCount: number;
  totalViewTime: number;
  averageViewTime: number;
  completionRate: number;
  firstPlayed: string;
  lastPlayed: string;
  impressions: number;
}

interface DailyStats {
  date: string;
  totalAdsPlayed: number;
  totalDisplayTime: number;
  uniqueAdsPlayed: number;
  averageAdDuration: number;
  adCompletionRate: number;
}

interface CurrentAd {
  adId: string;
  adTitle: string;
  adDuration: number;
  startTime: string;
  endTime?: string;
  impressions: number;
  totalViewTime: number;
  completionRate: number;
}

interface DeviceAnalytics {
  deviceId: string;
  materialId: string;
  screenType: string;
  currentAd?: CurrentAd;
  dailyStats?: DailyStats;
  totalAdsPlayed: number;
  displayHours: number;
  adPerformance: AdPerformance[];
  lastAdPlayed?: string;
  isOnline: boolean;
  lastSeen: string;
}

interface AnalyticsSummary {
  totalDevices: number;
  onlineDevices: number;
  totalAdsPlayed: number;
  totalDisplayHours: number;
  averageAdsPerDevice: number;
  averageDisplayHours: number;
}

interface AdAnalyticsData {
  summary: AnalyticsSummary;
  devices: DeviceAnalytics[];
}

const AdAnalytics: React.FC = () => {
  const [analytics, setAnalytics] = useState<AdAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const baseUrl = (process.env.REACT_APP_API_URL || 'http://192.168.100.22:5000').replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/screenTracking/adAnalytics`);
      const data = await response.json();
      
      if (data.success) {
        setAnalytics(data.data);
      } else {
        setError(data.message || 'Failed to fetch analytics');
      }
    } catch (err) {
      setError('Network error: Unable to fetch analytics');
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchAnalytics, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const formatHours = (hours: number): string => {
    const wholeHours = Math.floor(hours);
    const minutes = Math.floor((hours - wholeHours) * 60);
    return `${wholeHours}h ${minutes}m`;
  };

  const getCompletionRateColor = (rate: number): string => {
    if (rate >= 80) return 'bg-green-500';
    if (rate >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStatusColor = (isOnline: boolean): string => {
    return isOnline ? 'bg-green-500' : 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={fetchAnalytics} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-64">
        <p>No analytics data available</p>
      </div>
    );
  }

  const selectedDeviceData = selectedDevice 
    ? analytics.devices.find(d => d.deviceId === selectedDevice)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Ad Analytics Dashboard</h1>
        <Button onClick={fetchAnalytics} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.summary.totalDevices}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.summary.onlineDevices} online
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ads Played</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.summary.totalAdsPlayed}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.summary.averageAdsPerDevice.toFixed(1)} avg per device
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Display Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatHours(analytics.summary.totalDisplayHours)}</div>
            <p className="text-xs text-muted-foreground">
              {formatHours(analytics.summary.averageDisplayHours)} avg per device
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Online Rate</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((analytics.summary.onlineDevices / analytics.summary.totalDevices) * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics.summary.onlineDevices} of {analytics.summary.totalDevices} devices
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Device List */}
      <Card>
        <CardHeader>
          <CardTitle>Device Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics.devices.map((device) => (
              <div
                key={device.deviceId}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedDevice === device.deviceId ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                }`}
                onClick={() => setSelectedDevice(device.deviceId)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(device.isOnline)}`} />
                    <div>
                      <h3 className="font-semibold">{device.deviceId}</h3>
                      <p className="text-sm text-gray-600">
                        {device.screenType} • Material: {device.materialId}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-6 text-sm">
                    <div className="text-center">
                      <div className="font-semibold">{device.totalAdsPlayed}</div>
                      <div className="text-gray-500">Ads</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold">{formatHours(device.displayHours)}</div>
                      <div className="text-gray-500">Hours</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold">{device.adPerformance.length}</div>
                      <div className="text-gray-500">Unique Ads</div>
                    </div>
                    {device.currentAd && (
                      <div className="text-center">
                        <div className="font-semibold text-blue-600">Playing</div>
                        <div className="text-gray-500 text-xs">{device.currentAd.adTitle}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Selected Device Details */}
      {selectedDeviceData && (
        <Card>
          <CardHeader>
            <CardTitle>Device Details: {selectedDeviceData.deviceId}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Current Ad */}
              {selectedDeviceData.currentAd && (
                <div>
                  <h3 className="font-semibold mb-3">Currently Playing</h3>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-semibold">{selectedDeviceData.currentAd.adTitle}</h4>
                    <p className="text-sm text-gray-600">Duration: {selectedDeviceData.currentAd.adDuration}s</p>
                    <p className="text-sm text-gray-600">
                      Started: {new Date(selectedDeviceData.currentAd.startTime).toLocaleTimeString()}
                    </p>
                    <div className="mt-2">
                      <div className="flex justify-between text-sm">
                        <span>Completion Rate</span>
                        <span>{selectedDeviceData.currentAd.completionRate.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                        <div
                          className={`h-2 rounded-full ${getCompletionRateColor(selectedDeviceData.currentAd.completionRate)}`}
                          style={{ width: `${selectedDeviceData.currentAd.completionRate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Daily Stats */}
              {selectedDeviceData.dailyStats && (
                <div>
                  <h3 className="font-semibold mb-3">Today's Performance</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Total Ads Played:</span>
                      <span className="font-semibold">{selectedDeviceData.dailyStats.totalAdsPlayed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Display Time:</span>
                      <span className="font-semibold">{formatTime(selectedDeviceData.dailyStats.totalDisplayTime)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Unique Ads:</span>
                      <span className="font-semibold">{selectedDeviceData.dailyStats.uniqueAdsPlayed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg Ad Duration:</span>
                      <span className="font-semibold">{formatTime(selectedDeviceData.dailyStats.averageAdDuration)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Completion Rate:</span>
                      <span className="font-semibold">{selectedDeviceData.dailyStats.adCompletionRate.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Ad Performance Table */}
            {selectedDeviceData.adPerformance.length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold mb-3">Ad Performance</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Ad Title</th>
                        <th className="text-left p-2">Plays</th>
                        <th className="text-left p-2">Total View Time</th>
                        <th className="text-left p-2">Avg View Time</th>
                        <th className="text-left p-2">Completion Rate</th>
                        <th className="text-left p-2">Last Played</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDeviceData.adPerformance.map((ad) => (
                        <tr key={ad.adId} className="border-b">
                          <td className="p-2 font-medium">{ad.adTitle}</td>
                          <td className="p-2">{ad.playCount}</td>
                          <td className="p-2">{formatTime(ad.totalViewTime)}</td>
                          <td className="p-2">{formatTime(ad.averageViewTime)}</td>
                          <td className="p-2">
                            <div className="flex items-center space-x-2">
                              <span>{ad.completionRate.toFixed(1)}%</span>
                              <div className="w-16 bg-gray-200 rounded-full h-1">
                                <div
                                  className={`h-1 rounded-full ${getCompletionRateColor(ad.completionRate)}`}
                                  style={{ width: `${ad.completionRate}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="p-2">{new Date(ad.lastPlayed).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdAnalytics;
