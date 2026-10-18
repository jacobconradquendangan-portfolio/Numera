'use client';

import type { WorkingCapitalPoint } from '@/lib/chartData';
import { cx, formatUnitValue } from '@/lib/format';

interface WorkingCapitalStripProps {
  data: WorkingCapitalPoint[];
  selectedPeriod: string;
}

const CARDS: {
  label: string;
  descriptor: string;
  source: string;
  pick: (row: WorkingCapitalPoint) => number | null;
  longerIsBetter: boolean;
}[] = [
  {
    label: 'Receivable days',
    descriptor: 'Average collection window',
    source: 'ar-days · efficiency',
    pick: (row) => row.arDays,
    longerIsBetter: false,
  },
  {
    label: 'Inventory days',
    descriptor: 'Holding period before sale',
    source: 'inventory-days · efficiency',
    pick: (row) => row.inventoryDays,
    longerIsBetter: false,
  },
  {
    label: 'Defensive interval',
    descriptor: 'Days liquid assets cover operating costs',
    source: 'defensive-interval-ratio · liquidity',
    pick: (row) => row.dirDays,
    longerIsBetter: true,
  },
];

export default function WorkingCapitalStrip({ data, selectedPeriod }: WorkingCapitalStripProps) {
  if (!data.length) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        {CARDS.map((card) => (
          <div
            key={card.label}
            className="flex h-40 items-center justify-center rounded-xl border border-dashed border-line text-sm text-faint"
          >
            Unavailable
          </div>
        ))}
      </div>
    );
  }

  const focusedIndex = Math.max(
    data.findIndex((row) => row.period === selectedPeriod),
    0
  );
  const focused = data[focusedIndex];
  const previous = focusedIndex > 0 ? data[focusedIndex - 1] : null;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {CARDS.map((card) => {
        const value = card.pick(focused) ?? null;
        const previousValue = previous === null ? null : card.pick(previous);
        let delta: { text: string; tone: 'pos' | 'neg' | 'flat' } | null = null;
        if (value !== null && previousValue !== null) {
          const change = Math.round((value - previousValue) * 10) / 10;
          const tone = change === 0 ? 'flat' : change > 0 === card.longerIsBetter ? 'pos' : 'neg';
          delta = { text: `Δ ${change > 0 ? '+' : ''}${change} vs prior period`, tone };
        }
        return (
          <div key={card.label} className="rounded-xl border border-line bg-panel px-4 py-3.5">
            <p className="rule-label mb-2 whitespace-nowrap">{card.label}</p>
            <p className={cx('tabular text-2xl leading-tight', value === null ? 'text-faint' : 'text-paper')}>
              {value === null ? '—' : formatUnitValue(value, 'days')}
            </p>
            <p className="mt-2 text-xs text-muted">{card.descriptor}</p>
            <p
              className={cx(
                'mt-1.5 font-mono text-[0.62rem] uppercase tracking-[0.14em]',
                delta === null ? 'text-faint' : delta.tone === 'pos' ? 'text-pos' : delta.tone === 'neg' ? 'text-neg' : 'text-muted'
              )}
            >
              {delta === null ? `${card.source}` : delta.text}
            </p>
          </div>
        );
      })}
    </div>
  );
}
