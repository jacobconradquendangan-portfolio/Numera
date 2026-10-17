'use client';

import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_COLORS, COMMON_SIZE_SERIES, type CommonSizePoint } from '@/lib/chartData';

interface CommonSizeChartProps {
  data: CommonSizePoint[];
}

interface SegmentLabelProps {
  x?: unknown;
  y?: unknown;
  width?: unknown;
  height?: unknown;
  value?: unknown;
}

const TOOLTIP_STYLE = {
  background: CHART_COLORS.surface,
  border: `1px solid ${CHART_COLORS.border}`,
  borderRadius: 10,
  fontFamily: 'var(--font-mono), monospace',
  fontSize: 12,
  padding: '8px 12px',
};

function SegmentLabel({ x, y, width, height, value }: SegmentLabelProps) {
  const numX = Number(x ?? 0);
  const numY = Number(y ?? 0);
  const numWidth = Number(width ?? 0);
  const numHeight = Number(height ?? 0);
  const numValue = Number(value ?? 0);
  if (!numValue || numValue < 5 || numHeight < 16) return null;
  return (
    <text
      x={numX + numWidth / 2}
      y={numY + numHeight / 2}
      fill={CHART_COLORS.surface}
      fontSize={11}
      fontWeight={600}
      textAnchor="middle"
      dominantBaseline="central"
    >
      {`${numValue}%`}
    </text>
  );
}

export default function CommonSizeChart({ data }: CommonSizeChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!data.length) {
    return (
      <div className="flex h-80 items-center justify-center rounded-xl border border-dashed border-line text-sm text-faint">
        No revenue data available to build a common-size statement.
      </div>
    );
  }

  if (!mounted) return <div className="h-80 w-full" />;

  return (
    <div className="space-y-3">
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 18, left: 4, bottom: 0 }} barCategoryGap="28%">
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
              width={54}
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickFormatter={(value: number) => `${value}%`}
            />
            <Tooltip
              cursor={{ fill: 'rgba(35,33,26,0.04)' }}
              contentStyle={TOOLTIP_STYLE}
              labelStyle={{ color: CHART_COLORS.paper, fontWeight: 600, marginBottom: 4 }}
              formatter={(value, name) => [`${Number(value).toFixed(1)}% of revenue`, String(name)]}
            />
            {COMMON_SIZE_SERIES.map((series, index) => (
              <Bar
                key={series.key}
                dataKey={series.key}
                name={series.label}
                stackId="a"
                fill={series.color}
                maxBarSize={96}
                radius={index === COMMON_SIZE_SERIES.length - 1 ? [6, 6, 0, 0] : undefined}
              >
                <LabelList dataKey={series.key} content={SegmentLabel} />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center gap-5 px-1">
        {COMMON_SIZE_SERIES.map((series) => (
          <span key={series.key} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: series.color }} />
            <span className="rule-label">{series.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
