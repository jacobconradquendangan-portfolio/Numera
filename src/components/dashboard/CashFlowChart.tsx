'use client';

import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CASHFLOW_SERIES, CHART_COLORS, type CashFlowPoint } from '@/lib/chartData';
import { formatCompact } from '@/lib/format';

interface CashFlowChartProps {
  data: CashFlowPoint[];
}

const TOOLTIP_STYLE = {
  background: CHART_COLORS.surface,
  border: `1px solid ${CHART_COLORS.border}`,
  borderRadius: 10,
  fontFamily: 'var(--font-mono), monospace',
  fontSize: 12,
  padding: '8px 12px',
};

export default function CashFlowChart({ data }: CashFlowChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!data.length) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-line text-sm text-faint">
        No cash flow statement to chart.
      </div>
    );
  }

  if (!mounted) return <div className="h-72 w-full" />;

  return (
    <div className="space-y-3">
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 18, left: 4, bottom: 0 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="period" stroke={CHART_COLORS.axis} tick={{ fill: CHART_COLORS.tick, fontSize: 12 }} tickLine={false} />
            <YAxis
              stroke={CHART_COLORS.axis}
              tick={{ fill: CHART_COLORS.tick, fontSize: 12 }}
              tickLine={false}
              width={62}
              tickFormatter={(value: number) => formatCompact(value)}
            />
            <ReferenceLine y={0} stroke={CHART_COLORS.axis} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelStyle={{ color: CHART_COLORS.paper, fontWeight: 600, marginBottom: 4 }}
              formatter={(value, name) => [
                value === null || value === undefined ? 'n/a' : formatCompact(Number(value)),
                String(name),
              ]}
            />
            {CASHFLOW_SERIES.map((series) => (
              <Bar key={series.key} dataKey={series.key} name={series.label} fill={series.color} maxBarSize={22} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center gap-5 px-1">
        {CASHFLOW_SERIES.map((series) => (
          <span key={series.key} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5" style={{ background: series.color }} />
            <span className="rule-label">{series.label}</span>
          </span>
        ))}
        <span className="rule-label ml-auto">bars below the line are net outflows</span>
      </div>
    </div>
  );
}
