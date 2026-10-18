'use client';

import type { DuPontPoint } from '@/lib/chartData';
import { formatUnitValue } from '@/lib/format';
import { cx } from '@/lib/format';

interface DuPontPanelsProps {
  data: DuPontPoint[];
  selectedPeriod: string;
}

interface Factor {
  label: string;
  symbol: string;
  value: number | null;
  unit: string;
}

const FACTORS: { label: string; symbol: string; unit: string; pick: (row: DuPontPoint) => number | null }[] = [
  { label: 'Net profit margin', symbol: '×', unit: 'percent', pick: (row) => row.netMargin },
  { label: 'Asset turnover', symbol: '×', unit: 'times', pick: (row) => row.assetTurnover },
  { label: 'Equity multiplier', symbol: '=', unit: 'times', pick: (row) => row.equityMultiplier },
];

export default function DuPontPanels({ data, selectedPeriod }: DuPontPanelsProps) {
  if (!data.length) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-line text-sm text-faint">
        No ratio periods available to decompose.
      </div>
    );
  }

  const focused = data.find((row) => row.period === selectedPeriod) ?? data[data.length - 1];
  const factors: Factor[] = FACTORS.map((factor) => ({
    label: factor.label,
    symbol: factor.symbol,
    value: factor.pick(focused),
    unit: factor.unit,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        {factors.map((factor) => (
          <div key={factor.label} className="flex items-center gap-3">
            <div className="min-w-[7.5rem] rounded-xl border border-line bg-panel2 px-3 py-2.5">
              <p className="rule-label whitespace-nowrap">{factor.label}</p>
              <p className="tabular mt-1 text-lg text-paper">
                {factor.value === null ? '—' : formatUnitValue(factor.value, factor.unit)}
              </p>
            </div>
            <span className="font-display text-xl text-accent">{factor.symbol}</span>
          </div>
        ))}
        <div className="min-w-[7.5rem] rounded-xl border border-accent/30 bg-accent/[0.06] px-3 py-2.5">
          <p className="rule-label whitespace-nowrap">Return on equity</p>
          <p className="tabular mt-1 text-lg text-accent">
            {focused.roe === null ? '—' : formatUnitValue(focused.roe, 'percent')}
          </p>
        </div>
      </div>

      <p className="tabular text-sm text-muted">
        {focused.period} · equity multiplier derived as 1 + Debt-to-Equity · missing inputs show as dashes
      </p>

      {data.length > 1 ? (
        <div>
          <p className="rule-label mb-2">Across periods</p>
          <table className="w-full min-w-[28rem] border-collapse text-sm">
            <thead>
              <tr>
                <th className="rule-label border-b border-line pb-2 text-left font-normal">Period</th>
                {FACTORS.map((factor) => (
                  <th key={factor.label} className="rule-label border-b border-line pb-2 px-3 text-right font-normal">
                    {factor.label}
                  </th>
                ))}
                <th className="rule-label border-b border-line pb-2 px-3 text-right font-normal">ROE</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr
                  key={row.period}
                  className={cx(row.period === focused.period && 'font-medium')}
                >
                  <td className="tabular border-b border-line/60 py-2 text-paper">{row.period}</td>
                  {FACTORS.map((factor) => (
                    <td
                      key={factor.label}
                      className="tabular border-b border-line/60 py-2 px-3 text-right text-muted"
                    >
                      {factor.pick(row) === null ? '—' : formatUnitValue(factor.pick(row)!, factor.unit)}
                    </td>
                  ))}
                  <td className="tabular border-b border-line/60 py-2 px-3 text-right text-accent">
                    {row.roe === null ? '—' : formatUnitValue(row.roe, 'percent')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
