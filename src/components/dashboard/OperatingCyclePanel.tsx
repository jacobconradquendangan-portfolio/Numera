'use client';

import { CHART_COLORS, type WorkingCapitalPoint } from '@/lib/chartData';
import type { RatioResult } from '@/lib/engine/ratios';
import { cx, formatUnitValue } from '@/lib/format';

interface OperatingCyclePanelProps {
  data: WorkingCapitalPoint[];
  selectedPeriod: string;
  defensiveInterval?: RatioResult | null;
}

const RECEIVABLE_COLOR = CHART_COLORS.cogs;
const INVENTORY_COLOR = CHART_COLORS.opex;

const SEGMENTS = [
  { key: 'arDays' as const, label: 'Receivable days', detail: 'collection window', color: RECEIVABLE_COLOR },
  { key: 'inventoryDays' as const, label: 'Inventory days', detail: 'holding period', color: INVENTORY_COLOR },
];

export default function OperatingCyclePanel({ data, selectedPeriod, defensiveInterval }: OperatingCyclePanelProps) {
  const rowsWithCycle = data.filter((row) => row.operatingCycle !== null);

  if (!rowsWithCycle.length) {
    return (
      <p className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-faint">
        No operating cycle to read — receivable days and inventory days both need a receivables or inventory balance and
        a full period of revenue or cost of goods sold.
      </p>
    );
  }

  const scale = Math.max(...rowsWithCycle.map((row) => row.operatingCycle ?? 0), 1);
  const foundIndex = rowsWithCycle.findIndex((row) => row.period === selectedPeriod);
  const focusedIndex = foundIndex >= 0 ? foundIndex : rowsWithCycle.length - 1;
  const focused = rowsWithCycle[focusedIndex];
  const prior = focusedIndex > 0 ? rowsWithCycle[focusedIndex - 1] : null;

  const cycleDelta =
    prior && prior.operatingCycle !== null && focused.operatingCycle !== null
      ? focused.operatingCycle - prior.operatingCycle
      : null;
  const intervalDelta =
    prior && prior.dirDays !== null && focused.dirDays !== null ? focused.dirDays - prior.dirDays : null;

  return (
    <div>
      <ul>
        {rowsWithCycle.map((row) => {
          return (
            <li
              key={row.period}
              className="grid grid-cols-[3.6rem_1fr_auto] items-center gap-x-3 border-b border-line/70 py-2 last:border-b-0"
            >
              <span
                className="font-mono text-[0.7rem] uppercase tracking-[0.12em] text-muted"
              >
                {row.period}
              </span>

              <span className="flex h-3.5 items-stretch" aria-hidden>
                <span
                  className="rounded-l-[2px]"
                  style={{ width: `${((row.arDays ?? 0) / scale) * 100}%`, background: RECEIVABLE_COLOR }}
                />
                <span className="w-px bg-panel" />
                <span
                  className="rounded-r-[2px]"
                  style={{ width: `${((row.inventoryDays ?? 0) / scale) * 100}%`, background: INVENTORY_COLOR }}
                />
              </span>

              <span className="flex items-baseline justify-end gap-x-3">
                <span className="tabular font-mono text-[0.62rem] uppercase tracking-[0.12em] text-faint">
                  {row.arDays === null ? '—' : row.arDays.toFixed(1)} + {row.inventoryDays === null ? '—' : row.inventoryDays.toFixed(1)}
                </span>
                <span
                  className="tabular w-24 whitespace-nowrap text-right font-mono text-sm text-muted"
                >
                  {formatUnitValue(row.operatingCycle, 'days', 1)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">
        {SEGMENTS.map((segment) => (
          <span key={segment.key} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5" style={{ background: segment.color }} />
            <span className="rule-label">
              {segment.label} · {segment.detail}
            </span>
          </span>
        ))}
        <span className="rule-label ml-auto">receivable days + inventory days, longest cycle sets the scale</span>
      </div>

      <div className="mt-3 border-t border-line pt-3">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <span className="flex items-baseline gap-2">
            <span className="rule-label">Defensive interval</span>
            <span className="tabular font-mono text-sm text-paper">{defensiveInterval?.display ?? '—'}</span>
          </span>
          <span
            className={cx(
              'tabular font-mono text-[0.62rem] uppercase tracking-[0.12em]',
              intervalDelta === null
                ? 'text-faint'
                : intervalDelta === 0
                  ? 'text-muted'
                  : intervalDelta > 0
                    ? 'text-pos'
                    : 'text-neg'
            )}
          >
            {intervalDelta === null
              ? 'no prior period'
              : `Δ ${intervalDelta > 0 ? '+' : ''}${intervalDelta.toFixed(1)} days vs ${prior?.period}`}
          </span>
          {cycleDelta === null ? null : (
            <span className="tabular ml-auto font-mono text-[0.62rem] uppercase tracking-[0.12em] text-faint">
              cycle {cycleDelta === 0 ? 'unchanged' : `${cycleDelta > 0 ? 'up' : 'down'} ${Math.abs(cycleDelta).toFixed(1)} days`} vs {prior?.period}
            </span>
          )}
        </div>
        <p className="mt-1.5 text-sm text-muted">
          The defensive interval is a liquidity guardrail, not part of the cycle — it reads how many days liquid assets
          alone would cover operating costs, so longer is safer.
        </p>
      </div>
    </div>
  );
}
