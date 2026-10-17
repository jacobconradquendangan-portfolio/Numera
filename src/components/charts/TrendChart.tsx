'use client';

import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_COLORS, TREND_SERIES, type TrendPoint } from '@/lib/chartData';
import { formatCompact } from '@/lib/format';

interface TrendChartProps {
  data: TrendPoint[];
}

const TOOLTIP_STYLE = {
  background: CHART_COLORS.surface,
  border: `1px solid ${CHART_COLORS.border}`,
  borderRadius: 10,
  fontFamily: 'var(--font-mono), monospace',
  fontSize: 12,
  padding: '8px 12px',
};

export default function TrendChart({ data }: TrendChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!data.length) {
    return (
      <div className="flex h-80 items-center justify-center rounded-xl border border-dashed border-line text-sm text-faint">
        No income-statement periods available to trend.
      </div>
    );
  }

  if (!mounted) return <div className="h-80 w-full" />;

  return (
    <div className="space-y-3">
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 18, left: 4, bottom: 0 }}>
            <defs>
              {TREND_SERIES.map((series) => (
                <linearGradient key={series.key} id={`trend-${series.key.replace(/\s+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={series.color} stopOpacity={0.32} />
                  <stop offset="95%" stopColor={series.color} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
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
              tickFormatter={(value: number) => formatCompact(value)}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelStyle={{ color: CHART_COLORS.paper, fontWeight: 600, marginBottom: 4 }}
              formatter={(value, name) => [formatCompact(Number(value)), String(name)]}
            />
            {TREND_SERIES.map((series) => (
              <Area
                key={series.key}
                type="monotone"
                dataKey={series.key}
                name={series.key}
                stroke={series.color}
                strokeWidth={2.2}
                fill={`url(#trend-${series.key.replace(/\s+/g, '')})`}
                connectNulls
                dot={{ r: 3, strokeWidth: 0, fill: series.color }}
                activeDot={{ r: 5 }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center gap-5 px-1">
        {TREND_SERIES.map((series) => (
          <span key={series.key} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: series.color }} />
            <span className="rule-label">{series.key}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
