// ✅ PERFORMANCE OPTIMIZATION: Lazy-loaded chart component
// Recharts is ~200KB - only load when charts are actually rendered
import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface AnalyticsChartProps {
  data: any[];
}

const AnalyticsChart: React.FC<AnalyticsChartProps> = ({ data }) => {
  return (
    <ResponsiveContainer width="100%" height={210}>
      <AreaChart data={data || []} margin={{ top: 10, right: 0, left: 0, bottom: 20 }}>
        <XAxis
          dataKey="date"
          axisLine={false}
          tickLine={false}
          stroke="white"
          tick={{ fontSize: 10 }}
          interval="preserveStartEnd"
          tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        />
        <Tooltip
          contentStyle={{ backgroundColor: '#2D3748', border: 'none', borderRadius: '8px' }}
          labelStyle={{ color: '#E2E8F0' }}
          itemStyle={{ color: '#A8FF35' }}
          labelFormatter={(value) => new Date(value).toLocaleDateString()}
          formatter={(value, name) => [
            name === 'adsPlayed' ? value.toLocaleString() : value,
            name === 'adsPlayed' ? 'Ads Played' : 'Display Time'
          ]}
        />
        <Area
          type="monotone"
          dataKey="adsPlayed"
          stroke="#4FD1C7"
          fill="#2876c7"
          fillOpacity={0.6}
          name="adsPlayed"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default AnalyticsChart;

