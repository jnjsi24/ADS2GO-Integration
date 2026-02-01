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
import { X, Play, QrCode, Loader2, Clock, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);
  const [showDeviceNotification, setShowDeviceNotification] = useState(false);

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
    setShowDeviceNotification(false);
  }, [isOpen, ad?.adId]);

  useEffect(() => {
    if (deviceId) {
      setShowDeviceNotification(true);
    }
  }, [deviceId]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-md shadow-sm max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 relative">
          <h2 className="text-base sm:text-xl font-bold text-gray-900 truncate pr-2">
            {ad?.adTitle || 'Ad'} – Chart
          </h2>
          <div className="flex items-center gap-2">
            <AnimatePresence>
              {deviceId && deviceLabel && showDeviceNotification && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-4 right-4 sm:right-6 bg-amber-50 border border-amber-200 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs text-amber-800 shadow-lg z-10 max-w-[calc(100vw-2rem)] sm:max-w-sm"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <strong>Note:</strong> Summary cards reflect only on the selected device ({deviceLabel}). The chart shows totals across all devices, as per-device daily data isn't available.
                    </div>
                    <button
                      onClick={() => setShowDeviceNotification(false)}
                      className="flex-shrink-0 text-amber-600 hover:text-amber-800 transition-colors"
                      aria-label="Dismiss"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors flex-shrink-0"
              aria-label="Close"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        <div className="px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-end justify-end gap-3 sm:gap-2">
          <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto justify-end sm:justify-start">
            <div className="gap-1 sm:gap-2 flex overflow-hidden">
              {(Object.keys(PERIOD_LABELS) as PeriodFilter[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`group relative px-2 sm:px-2 py-1 sm:py-1.5 text-xs sm:text-sm font-medium overflow-hidden ${
                    period === p
                      ? 'text-[#3674B5]'
                      : 'bg-white text-gray-600'
                  }`}
                >
                  <span className={`relative z-10 transition-colors duration-300 ${
                    period === p
                      ? 'group-hover:text-[#3674B5]'
                      : 'group-hover:text-[#3674B5]'
                  }`}>
                    {PERIOD_LABELS[p]}
                  </span>
                  <>
                    <span className={`absolute bottom-0 left-0 h-0.5 bg-[#3674B5] transition-all duration-500 ease-in-out ${
                      period === p ? 'w-full' : 'w-0 group-hover:w-full'
                    }`}></span>
                    <span className="absolute inset-0 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-in-out"></span>
                  </>
                </button>
              ))}
            </div>
          </div>
          {deviceList.length > 1 && (
            <div className={`flex items-center gap-2 relative w-auto sm:w-auto self-end sm:self-auto ${deviceId ? 'sm:w-52' : 'sm:w-44'}`}>
              <button
                onClick={() => setShowDeviceDropdown(!showDeviceDropdown)}
                className="flex items-center justify-between w-full text-xs text-black rounded-md pl-3 sm:pl-6 pr-2 sm:pr-4 py-2 sm:py-3 shadow-md focus:outline-none bg-white/70 gap-1 sm:gap-2"
              >
                {deviceId ? (deviceList.find((d) => d.deviceId === deviceId)?.materialId || deviceList.find((d) => d.deviceId === deviceId)?.deviceId || 'All Devices') : 'All Devices'}
                <ChevronDown
                  size={14}
                  className={`transform transition-transform duration-200 flex-shrink-0 ${
                    showDeviceDropdown ? 'rotate-180' : 'rotate-0'
                  }`}
                />
              </button>

              <AnimatePresence>
                {showDeviceDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute z-10 top-full mt-2 w-full rounded-md shadow-lg bg-white overflow-hidden"
                  >
                    <button
                      onClick={() => {
                        setDeviceId(null);
                        setShowDeviceDropdown(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-xs ml-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                    >
                      All Devices
                    </button>
                    {deviceList.map((d) => (
                      <button
                        key={d.deviceId}
                        onClick={() => {
                          setDeviceId(d.deviceId);
                          setShowDeviceDropdown(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-xs ml-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                      >
                        {d.materialId || d.deviceId}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        <div className="px-4 sm:px-6 py-3 sm:py-4 flex-1 overflow-auto">
          {loadingChart ? (
            <div className="flex flex-col items-center justify-center py-8 sm:py-16">
              <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 text-[#3674B5]/90 animate-spin mb-3 sm:mb-4" />
              <p className="text-sm sm:text-base text-black">Loading chart...</p>
            </div>
          ) : chartDataSorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 sm:py-16 text-black font-medium">
              <p className="text-sm sm:text-base">No daily data for this period</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="shadow-md rounded-md p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 mr-1 sm:mr-2 rounded-full bg-gradient-to-br from-blue-300/60 via-blue-300/40 to-white/40 
                    border border-white/30 backdrop-blur-md shadow-md flex items-center justify-center flex-shrink-0"
                  >
                    <Play className="w-4 h-4 sm:w-5 sm:h-5 text-blue-700 drop-shadow-sm" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-black">Ads Played</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-900 truncate">{formatNumber(summaryPlays)}</p>
                  </div>
                </div>
                <div className="shadow-md rounded-md p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 mr-1 sm:mr-2 rounded-full bg-gradient-to-br from-green-300/60 via-green-300/40 to-white/40 
                    border border-white/30 backdrop-blur-md shadow-md flex items-center justify-center flex-shrink-0"
                  >
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-green-700 drop-shadow-sm" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-black">Total Airtime</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-900 truncate">{formatAirtime(summaryAirtime)}</p>
                  </div>
                </div>
                <div className="shadow-md rounded-md p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 mr-1 sm:mr-2 rounded-full bg-gradient-to-br from-purple-300/60 via-purple-300/40 to-white/40 
                    border border-white/30 backdrop-blur-md shadow-md flex items-center justify-center flex-shrink-0"
                  >
                    <QrCode className="w-4 h-4 sm:w-5 sm:h-5 text-purple-700 drop-shadow-sm" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-black">QR Scans</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-900 truncate">{formatNumber(summaryQR)}</p>
                  </div>
                </div>
              </div>
              <div className="h-[250px] sm:h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartDataSorted.map((d) => ({
                      ...d,
                      dateLabel: formatChartDate(d.date),
                    }))}
                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="dateLabel"
                      tick={{ fontSize: 10 }}
                      stroke="#9ca3af"
                    />
                    <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" width={40} />
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
