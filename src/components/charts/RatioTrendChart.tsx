'use client';

import { useEffect, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_COLORS, type RatioTrendPoint, type RatioTrendSeries } from '@/lib/chartData';
import { formatCompact } from '@/lib/format';

interface RatioTrendChartProps {
  data: RatioTrendPoint[];
  series: RatioTrendSeries[];
  emptyMessage?: string;
}

const TOOLTIP_STYLE = {
  background: CHART_COLORS.surface,
  border: `1px solid ${CHART_COLORS.border}`,
  borderRadius: 10,
  fontFamily: 'var(--font-mono), monospace',
  fontSize: 12,
  padding: '8px 12px',
};

export default function RatioTrendChart({ data, series, emptyMessage }: RatioTrendChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!data.length) {
    return (
      <div className="flex h-80 items-center justify-center rounded-xl border border-dashed border-line text-sm text-faint">
        {emptyMessage ?? 'No ratio history available to trend.'}
      </div>
    );
  }

  if (!mounted) return <div className="h-80 w-full" />;

  return (
    <div className="space-y-3">
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 18, left: 4, bottom: 0 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="period"
              stroke={CHART_COLORS.axis}
              tick={{ fill: CHART_COLORS.tick, fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              stroke={CHART_COLORS.axis}
              tick={{ fill: CHART_COLORS.tick, fontSize: 12 }}
              tickLine={false}
              width={62}
              tickFormatter={(value: number) => `${formatCompact(value)}%`}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelStyle={{ color: CHART_COLORS.paper, fontWeight: 600, marginBottom: 4 }}
              formatter={(value, name) => [
                value === null || value === undefined ? 'n/a' : `${formatCompact(Number(value))}%`,
                String(name),
              ]}
            />
            {series.map((entry) => (
              <Line
                key={entry.key}
                type="monotone"
                dataKey={entry.key}
                name={entry.label}
                stroke={entry.color}
                strokeWidth={2.2}
                connectNulls
                dot={{ r: 3, strokeWidth: 0, fill: entry.color }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center gap-5 px-1">
        {series.map((entry) => (
          <span key={entry.key} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: entry.color }} />
            <span className="rule-label">{entry.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
