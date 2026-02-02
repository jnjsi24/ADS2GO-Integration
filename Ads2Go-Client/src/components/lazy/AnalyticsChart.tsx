import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export interface DailyStat {
  date: string;
  adsPlayed?: number;
  displayTime?: number;
  qrScans?: number;
  completionRate?: number;
}

export interface PeriodSummary {
  totalAdsPlayed?: number;
  totalQRScans?: number;
}

interface AnalyticsChartProps {
  /** Same dailyStats used for the period; chart will show QR Scans and Total Ad Played over time */
  data: DailyStat[];
  /** When provided, period totals and (for single-day) chart values match the cards (summary is source of truth) */
  summary?: PeriodSummary | null;
}

const formatChartDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatNumber = (n: number) => (n ?? 0).toLocaleString();

const CHART_COLORS = {
  totalAdPlayed: { stroke: '#3674B5', fill: 'rgba(54, 116, 181, 0.35)' },
  qrScans: { stroke: '#a78bfa', fill: 'rgba(167, 139, 250, 0.35)' },
  axis: 'rgba(255, 255, 255, 0.7)',
  grid: 'rgba(255, 255, 255, 0.12)',
};

const AnalyticsChart: React.FC<AnalyticsChartProps> = ({ data, summary }) => {
  const { chartData, periodTotalAdPlayed, periodTotalQRScans } = React.useMemo(() => {
    if (!data?.length) {
      return {
        chartData: [],
        periodTotalAdPlayed: summary?.totalAdsPlayed ?? 0,
        periodTotalQRScans: summary?.totalQRScans ?? 0,
      };
    }
    const sorted = [...data].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const summedAdPlayed = sorted.reduce((sum, d) => sum + (d.adsPlayed ?? 0), 0);
    const summedQRScans = sorted.reduce((sum, d) => sum + (d.qrScans ?? 0), 0);
    // Use summary when provided so chart totals match the cards (e.g. daily 5 vs dailyStats sum 4)
    const totalAdPlayed = summary?.totalAdsPlayed ?? summedAdPlayed;
    const totalQRScans = summary?.totalQRScans ?? summedQRScans;
    // For single-day (e.g. Daily), show summary total on the chart so the bar matches the card
    const isSingleDay = sorted.length === 1;
    const withLabels = sorted.map((d, i) => ({
      ...d,
      dateLabel: formatChartDate(d.date),
      ...(isSingleDay && summary && {
        adsPlayed: summary.totalAdsPlayed ?? d.adsPlayed,
        qrScans: summary.totalQRScans ?? d.qrScans,
      }),
    }));
    return {
      chartData: withLabels,
      periodTotalAdPlayed: totalAdPlayed,
      periodTotalQRScans: totalQRScans,
    };
  }, [data, summary]);

  if (!chartData.length) {
    const hasSummary = (summary?.totalAdsPlayed ?? 0) > 0 || (summary?.totalQRScans ?? 0) > 0;
    return (
      <div className="w-full flex flex-col gap-2">
        {hasSummary && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/80">
            <span>
              <strong className="text-white/90">Total Ad Played:</strong>{' '}
              {formatNumber(summary?.totalAdsPlayed ?? 0)}
            </span>
            <span>
              <strong className="text-white/90">QR Scans:</strong>{' '}
              {formatNumber(summary?.totalQRScans ?? 0)}
            </span>
          </div>
        )}
        <div className="w-full h-[210px] flex items-center justify-center rounded-lg border border-white/20 bg-white/5">
          <p className="text-white/70 text-sm">No chart data for this period</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-2">
      {/* Period totals - same metrics as the QR Scans and Total Ad Played cards */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/80">
        <span>
          <strong className="text-white/90">Total Ad Played:</strong>{' '}
          {formatNumber(periodTotalAdPlayed)}
        </span>
        <span>
          <strong className="text-white/90">QR Scans:</strong>{' '}
          {formatNumber(periodTotalQRScans)}
        </span>
      </div>
      <div className="w-full h-[210px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 10, fill: CHART_COLORS.axis }}
              stroke={CHART_COLORS.axis}
            />
            <YAxis
              tick={{ fontSize: 10, fill: CHART_COLORS.axis }}
              stroke={CHART_COLORS.axis}
              width={32}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.2)',
                backgroundColor: 'rgba(27, 80, 135, 0.95)',
              }}
              labelStyle={{ color: 'rgba(255,255,255,0.9)' }}
              labelFormatter={(_, payload) =>
                payload?.[0]?.payload?.date
                  ? formatChartDate(payload[0].payload.date)
                  : ''
              }
              formatter={(value: number, name: string) => [
                formatNumber(value),
                name,
              ]}
            />
            <Area
              type="monotone"
              dataKey="adsPlayed"
              name="Total Ad Played"
              stroke={CHART_COLORS.totalAdPlayed.stroke}
              fill={CHART_COLORS.totalAdPlayed.fill}
              fillOpacity={1}
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="qrScans"
              name="QR Scans"
              stroke={CHART_COLORS.qrScans.stroke}
              fill={CHART_COLORS.qrScans.fill}
              fillOpacity={1}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AnalyticsChart;
