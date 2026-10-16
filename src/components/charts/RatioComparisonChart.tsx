'use client';

import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_COLORS, type RatioDatum } from '@/lib/chartData';

interface RatioComparisonChartProps {
  data: RatioDatum[];
}

interface RatioTooltipProps {
  active?: boolean;
  payload?: { payload: RatioDatum }[];
}

function RatioTooltip({ active, payload }: RatioTooltipProps) {
  if (!active || !payload?.length) return null;
  const datum = payload[0].payload;
  return (
    <div
      style={{
        background: CHART_COLORS.surface,
        border: `1px solid ${CHART_COLORS.border}`,
        borderRadius: 10,
        padding: '8px 12px',
        fontFamily: 'var(--font-mono), monospace',
        fontSize: 12,
      }}
    >
      <p style={{ margin: 0, color: CHART_COLORS.paper, fontWeight: 600 }}>{datum.name}</p>
      <p style={{ margin: '4px 0 0', color: datum.category === 'liquidity' ? CHART_COLORS.liquidity : CHART_COLORS.leverage }}>
        {datum.display}
        <span style={{ color: CHART_COLORS.tick, marginLeft: 6 }}>
          {datum.category === 'liquidity' ? 'liquidity' : 'leverage'}
        </span>
      </p>
    </div>
  );
}

export default function RatioComparisonChart({ data }: RatioComparisonChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!data.length) {
    return (
      <div className="flex h-80 items-center justify-center rounded-xl border border-dashed border-line text-sm text-faint">
        Liquidity and leverage ratios are unavailable for this period.
      </div>
    );
  }

  if (!mounted) return <div className="h-80 w-full" />;

  return (
    <div className="space-y-3">
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 18, left: 4, bottom: 0 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="shortName"
              stroke={CHART_COLORS.axis}
              tick={{ fill: CHART_COLORS.tick, fontSize: 11 }}
              tickLine={false}
              interval={0}
              angle={-12}
              textAnchor="end"
              height={48}
            />
            <YAxis
              stroke={CHART_COLORS.axis}
              tick={{ fill: CHART_COLORS.tick, fontSize: 12 }}
              tickLine={false}
              width={54}
              tickFormatter={(value: number) => `${value}x`}
            />
            <ReferenceLine y={1} stroke={CHART_COLORS.reference} strokeDasharray="4 4" />
            <Tooltip cursor={{ fill: 'rgba(35,33,26,0.04)' }} content={<RatioTooltip />} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={64}>
              {data.map((datum) => (
                <Cell
                  key={datum.id}
                  fill={datum.category === 'liquidity' ? CHART_COLORS.liquidity : CHART_COLORS.leverage}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center gap-5 px-1">
        {(['liquidity', 'leverage'] as const).map((category) => (
          <span key={category} className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: category === 'liquidity' ? CHART_COLORS.liquidity : CHART_COLORS.leverage }}
            />
            <span className="rule-label">{category} ratios</span>
          </span>
        ))}
        <span className="rule-label ml-auto">dashed line = 1.0× parity</span>
      </div>
    </div>
  );
}
