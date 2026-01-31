import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useLazyQuery } from '@apollo/client';
import { X, Play, QrCode, Loader2, Clock } from 'lucide-react';
import { GET_USER_ANALYTICS } from '../../graphql/user/queries/getUserAnalytics';

export interface AdPerformanceForChart {
  adId: string;
  adTitle: string;
  totalDevices: number;
  totalAdPlayTime: number;
  totalAdPlays: number;
  totalQRScans: number;
  averageAdCompletionRate: number;
  lastUpdated: string;
}

interface DailyStat {
  date: string;
  adsPlayed: number;
  displayTime: number;
  qrScans: number;
  completionRate: number;
}

interface DeviceStat {
  deviceId: string;
  materialId: string;
  adsPlayed: number;
  displayTime: number;
  lastActivity: string;
  isOnline: boolean;
  qrScans: number;
}

type PeriodFilter = '1d' | '7d' | 'all-time';

const PERIOD_LABELS: Record<PeriodFilter, string> = {
  '1d': 'Today',
  '7d': 'Last 7 Days',
  'all-time': 'All Time',
};

const formatChartDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatNumber = (n: number) => (n ?? 0).toLocaleString();

const formatAirtime = (seconds: number): string => {
  if (!seconds || seconds === 0) return '0s';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
};

interface DetailedAnalyticsChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  ad: AdPerformanceForChart | null;
}

const DetailedAnalyticsChartModal: React.FC<DetailedAnalyticsChartModalProps> = ({
  isOpen,
  onClose,
  ad,
}) => {
  const [period, setPeriod] = useState<PeriodFilter>('7d');
  const [deviceId, setDeviceId] = useState<string | null>(null);

  const [fetchChartData, { data, loading: loadingChart }] = useLazyQuery(GET_USER_ANALYTICS, {
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
  });

  const chartData = data?.getUserAnalytics?.dailyStats || [];
  const deviceList: DeviceStat[] = data?.getUserAnalytics?.deviceStats || [];

  useEffect(() => {
    if (!isOpen || !ad?.adId) return;
    setPeriod('7d');
    setDeviceId(null);
  }, [isOpen, ad?.adId]);

  useEffect(() => {
    if (!isOpen || !ad?.adId) return;
    fetchChartData({
      variables: { period, adId: ad.adId },
    });
  }, [isOpen, ad?.adId, period, fetchChartData]);

  const chartDataSorted = [...chartData].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // When a device is selected, cards show that device's totals (from deviceStats). Otherwise cards show chart data (dailyStats). Chart always shows all-device totals.
  const selectedDevice = deviceId ? deviceList.find((d) => d.deviceId === deviceId) : null;
  const summaryPlays = selectedDevice
    ? selectedDevice.adsPlayed ?? 0
    : chartDataSorted.reduce((sum, d) => sum + (d.adsPlayed ?? 0), 0);
  const summaryQR = selectedDevice
    ? selectedDevice.qrScans ?? 0
    : chartDataSorted.reduce((sum, d) => sum + (d.qrScans ?? 0), 0);
  const summaryAirtime = selectedDevice
    ? selectedDevice.displayTime ?? 0
    : chartDataSorted.reduce((sum, d) => sum + (d.displayTime ?? 0), 0);

  const deviceLabel = selectedDevice ? (selectedDevice.materialId || selectedDevice.deviceId) : null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {ad?.adTitle || 'Ad'} – Chart
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Period:</span>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {(Object.keys(PERIOD_LABELS) as PeriodFilter[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    period === p
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
          {deviceList.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">Device:</span>
              <select
                value={deviceId ?? ''}
                onChange={(e) => setDeviceId(e.target.value || null)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Devices</option>
                {deviceList.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.materialId || d.deviceId}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="px-6 py-4 flex-1 overflow-auto">
          {loadingChart ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
              <p className="text-gray-500">Loading chart...</p>
            </div>
          ) : chartDataSorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <p>No daily data for this period</p>
            </div>
          ) : (
            <>
              {deviceId && deviceLabel && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  <strong>Note:</strong> You have selected a specific device ({deviceLabel}). The summary cards below show data for this device only. The chart shows <strong>totals across all devices</strong> (per-device daily breakdown is not available for the chart).
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Play className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-blue-600">Ads Played</p>
                    <p className="text-xl font-bold text-gray-900">{formatNumber(summaryPlays)}</p>
                  </div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-green-600">Total Airtime</p>
                    <p className="text-xl font-bold text-gray-900">{formatAirtime(summaryAirtime)}</p>
                  </div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <QrCode className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-purple-600">QR Scans</p>
                    <p className="text-xl font-bold text-gray-900">{formatNumber(summaryQR)}</p>
                  </div>
                </div>
              </div>
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartDataSorted.map((d) => ({
                      ...d,
                      dateLabel: formatChartDate(d.date),
                    }))}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="dateLabel"
                      tick={{ fontSize: 12 }}
                      stroke="#9ca3af"
                    />
                    <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <Tooltip
                      labelFormatter={(_, payload) =>
                        payload?.[0]?.payload?.date
                          ? formatChartDate(payload[0].payload.date)
                          : ''
                      }
                      formatter={(value: number) => [formatNumber(value)]}
                      contentStyle={{ borderRadius: '8px' }}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="adsPlayed"
                      name="Ads Played"
                      stroke="#2563eb"
                      fill="#2563eb"
                      fillOpacity={0.4}
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="qrScans"
                      name="QR Scans"
                      stroke="#7c3aed"
                      fill="#7c3aed"
                      fillOpacity={0.4}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DetailedAnalyticsChartModal;
