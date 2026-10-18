'use client';

import { useEffect, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_COLORS, type DuPontPoint } from '@/lib/chartData';

interface DuPontTrendChartProps {
  data: DuPontPoint[];
  highlightPeriod?: string;
}

interface Series {
  key: keyof Omit<DuPontPoint, 'period'>;
  label: string;
  color: string;
  axis: 'pct' | 'x';
  role: 'area' | 'line';
  dashed?: boolean;
}

const SERIES: Series[] = [
  { key: 'roe', label: 'Return on equity', color: CHART_COLORS.leverage, axis: 'pct', role: 'area' },
  { key: 'netMargin', label: 'Net margin', color: CHART_COLORS.netProfit, axis: 'pct', role: 'line' },
  { key: 'assetTurnover', label: 'Asset turnover', color: CHART_COLORS.netIncome, axis: 'x', role: 'line', dashed: true },
  { key: 'financialLeverage', label: 'Financial leverage', color: CHART_COLORS.roe, axis: 'x', role: 'line', dashed: true },
];

const UNIT: Record<Series['key'], 'pct' | 'x'> = SERIES.reduce(
  (acc, series) => ({ ...acc, [series.key]: series.axis }),
  {} as Record<Series['key'], 'pct' | 'x'>
);

function format(kind: 'pct' | 'x', value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'n/a';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'n/a';
  return kind === 'pct' ? `${numeric.toFixed(2)}%` : `${numeric.toFixed(2)}x`;
}

interface TooltipEntry {
  dataKey?: string | number;
  name?: string;
  value?: number | string | null;
  color?: string;
}

function DuPontTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: CHART_COLORS.surface,
        border: `1px solid ${CHART_COLORS.border}`,
        borderRadius: 10,
        fontFamily: 'var(--font-mono), monospace',
        fontSize: 12,
        padding: '8px 12px',
        minWidth: 190,
      }}
    >
      <p style={{ color: CHART_COLORS.paper, fontWeight: 600, marginBottom: 6 }}>{label}</p>
      {payload.map((entry) => {
        const key = (entry.dataKey ?? '') as Series['key'];
        const kind = UNIT[key] ?? 'x';
        return (
          <div key={String(entry.dataKey)} className="flex items-center justify-between gap-4">
            <span style={{ color: CHART_COLORS.tick, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, background: entry.color }} />
              {entry.name}
            </span>
            <span style={{ color: CHART_COLORS.paper }}>{format(kind, entry.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function DuPontTrendChart({ data, highlightPeriod }: DuPontTrendChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (data.length < 2) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-line text-sm text-faint">
        Two or more periods are needed to chart the trend.
      </div>
    );
  }

  if (!mounted) return <div className="h-72 w-full" />;

  return (
    <div className="space-y-3">
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="dupontRoeFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.leverage} stopOpacity={0.22} />
                <stop offset="100%" stopColor={CHART_COLORS.leverage} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="period" stroke={CHART_COLORS.axis} tick={{ fill: CHART_COLORS.tick, fontSize: 12 }} tickLine={false} />
            <YAxis
              yAxisId="pct"
              stroke={CHART_COLORS.axis}
              tick={{ fill: CHART_COLORS.tick, fontSize: 12 }}
              tickLine={false}
              width={48}
              tickFormatter={(value: number) => `${value}%`}
            />
            <YAxis
              yAxisId="x"
              orientation="right"
              stroke={CHART_COLORS.axis}
              tick={{ fill: CHART_COLORS.tick, fontSize: 12 }}
              tickLine={false}
              width={40}
              tickFormatter={(value: number) => `${value}x`}
            />
            {highlightPeriod ? (
              <ReferenceLine yAxisId="pct" x={highlightPeriod} stroke={CHART_COLORS.axis} strokeDasharray="2 4" />
            ) : null}
            <Tooltip content={<DuPontTooltip />} cursor={{ stroke: CHART_COLORS.axis, strokeDasharray: '2 4' }} />
            {SERIES.map((series) =>
              series.role === 'area' ? (
                <Area
                  key={series.key}
                  yAxisId={series.axis}
                  type="monotone"
                  dataKey={series.key}
                  name={series.label}
                  stroke={series.color}
                  strokeWidth={2.6}
                  fill="url(#dupontRoeFill)"
                  connectNulls
                  dot={{ r: 3.5, strokeWidth: 0, fill: series.color }}
                  activeDot={{ r: 5 }}
                />
              ) : (
                <Line
                  key={series.key}
                  yAxisId={series.axis}
                  type="monotone"
                  dataKey={series.key}
                  name={series.label}
                  stroke={series.color}
                  strokeWidth={series.dashed ? 1.8 : 2.2}
                  strokeDasharray={series.dashed ? '5 4' : undefined}
                  connectNulls
                  dot={{ r: 3, strokeWidth: 0, fill: series.color }}
                  activeDot={{ r: 5 }}
                />
              )
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1">
        {SERIES.map((series) => (
          <span key={series.key} className="flex items-center gap-2">
            <span
              className="inline-block h-0.5 w-4 rounded-full"
              style={
                series.dashed
                  ? { backgroundImage: `repeating-linear-gradient(90deg, ${series.color} 0 4px, transparent 4px 7px)` }
                  : { background: series.color }
              }
            />
            <span className="rule-label">
              {series.label} · {series.axis === 'pct' ? '%' : 'x'}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
