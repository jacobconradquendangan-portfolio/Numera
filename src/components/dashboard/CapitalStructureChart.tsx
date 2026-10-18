'use client';

import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART_COLORS, type CapitalStructurePoint } from '@/lib/chartData';
import { formatCompact } from '@/lib/format';

interface CapitalStructureChartProps {
  data: CapitalStructurePoint[];
}

const SERIES = [
  { key: 'Liabilities' as const, label: 'Liabilities', color: CHART_COLORS.leverage },
  { key: 'Equity' as const, label: 'Equity', color: CHART_COLORS.grossProfit },
];

const TOOLTIP_STYLE = {
  background: CHART_COLORS.surface,
  border: `1px solid ${CHART_COLORS.border}`,
  borderRadius: 10,
  fontFamily: 'var(--font-mono), monospace',
  fontSize: 12,
  padding: '8px 12px',
};

export default function CapitalStructureChart({ data }: CapitalStructureChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!data.length) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-line text-sm text-faint">
        No balance-sheet periods available to chart.
      </div>
    );
  }

  if (!mounted) return <div className="h-64 w-full" />;

  return (
    <div className="space-y-3">
      <div className="h-64 w-full">
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
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelStyle={{ color: CHART_COLORS.paper, fontWeight: 600, marginBottom: 4 }}
              formatter={(value, name) => [formatCompact(Number(value)), String(name)]}
            />
            {SERIES.map((series, index) => (
              <Bar
                key={series.key}
                dataKey={series.key}
                name={series.label}
                stackId="structure"
                fill={series.color}
                maxBarSize={64}
                radius={index === SERIES.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center gap-5 px-1">
        {SERIES.map((series) => (
          <span key={series.key} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5" style={{ background: series.color }} />
            <span className="rule-label">{series.label}</span>
          </span>
        ))}
        <span className="rule-label ml-auto">each column spans total assets</span>
      </div>
    </div>
  );
}
