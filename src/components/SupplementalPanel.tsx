'use client';

import type { DayCountBasis, SupplementalForm } from '@/lib/types';
import { cx } from '@/lib/format';

interface SupplementalPanelProps {
  values: SupplementalForm;
  onChange: (key: keyof SupplementalForm, value: string) => void;
  onRecompute: () => void;
  busy: boolean;
  dayCountBasis: DayCountBasis;
  onDayCountBasisChange: (value: DayCountBasis) => void;
}

const DAY_COUNT_OPTIONS: DayCountBasis[] = [365, 360];

const FIELDS: { key: keyof SupplementalForm; label: string; group: string; hint: string }[] = [
  { key: 'sharePrice', label: 'Share Price', group: 'Market', hint: 'e.g. 25.40' },
  { key: 'sharesOutstanding', label: 'Shares Outstanding', group: 'Market', hint: 'e.g. 1,200,000' },
  { key: 'earningsPerShare', label: 'EPS (override)', group: 'Market', hint: 'optional' },
  { key: 'marketCapitalization', label: 'Market Cap', group: 'Market', hint: 'optional' },
  { key: 'enterpriseValue', label: 'Enterprise Value', group: 'Market', hint: 'optional' },
  { key: 'totalDebt', label: 'Total Debt (override)', group: 'Debt & Cash', hint: 'optional' },
  { key: 'cashAndEquivalents', label: 'Cash (override)', group: 'Debt & Cash', hint: 'optional' },
  { key: 'ebitda', label: 'EBITDA (override)', group: 'Overrides', hint: 'optional' },
  { key: 'ebit', label: 'EBIT (override)', group: 'Overrides', hint: 'optional' },
];

const GROUPS = ['Market', 'Debt & Cash', 'Overrides'];

export default function SupplementalPanel({
  values,
  onChange,
  onRecompute,
  busy,
  dayCountBasis,
  onDayCountBasisChange,
}: SupplementalPanelProps) {
  const hasAnyValue = FIELDS.some((field) => values[field.key].trim() !== '');
  const clearAll = () => FIELDS.forEach((field) => onChange(field.key, ''));

  return (
    <details className="acc panel rounded-2xl">
      <summary className="flex items-center justify-between gap-4 px-6 py-5">
        <span className="flex items-center gap-3">
          <span className="chev text-accent">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span>
            <span className="block font-display text-lg text-paper">Market inputs</span>
            <span className="rule-label">Valuation and override inputs plus the day-count basis</span>
          </span>
        </span>
        <span className="rule-label">optional</span>
      </summary>
      <div className="acc-body border-t border-line px-6 py-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-ink/40 px-4 py-3">
          <div>
            <p className="rule-label">Day-count basis</p>
            <p className="mt-0.5 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-faint">
              Used for receivables, inventory and defensive-interval days
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-line2 p-1">
            {DAY_COUNT_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onDayCountBasisChange(option)}
                aria-pressed={dayCountBasis === option}
                className={cx(
                  'rounded-full px-4 py-1.5 font-mono text-[0.68rem] uppercase tracking-[0.16em] transition',
                  dayCountBasis === option
                    ? 'bg-accent/15 text-accent'
                    : 'text-muted hover:text-paper'
                )}
              >
                {option} day
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {GROUPS.map((group) => (
            <div key={group} className="space-y-3">
              <p className="rule-label">{group}</p>
              <div className="space-y-3">
                {FIELDS.filter((field) => field.group === group).map((field) => (
                  <label key={field.key} className="block">
                    <span className="mb-1 block font-mono text-[0.68rem] uppercase tracking-[0.12em] text-faint">
                      {field.label}
                    </span>
                    <input
                      inputMode="decimal"
                      placeholder={field.hint}
                      value={values[field.key]}
                      onChange={(event) => onChange(field.key, event.target.value)}
                      className={cx(
                        'tabular w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-paper',
                        'placeholder:text-faint/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40'
                      )}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={clearAll}
            disabled={busy || !hasAnyValue}
            className={cx(
              'rounded-full border px-5 py-2 font-mono text-xs uppercase tracking-[0.2em] transition',
              busy || !hasAnyValue
                ? 'cursor-not-allowed border-line text-faint/60'
                : 'border-line2 text-muted hover:border-neg hover:text-neg'
            )}
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={onRecompute}
            disabled={busy}
            className="rounded-full border border-accent/50 bg-accent/10 px-6 py-2 font-mono text-xs uppercase tracking-[0.2em] text-accent transition hover:bg-accent/20 disabled:opacity-50"
          >
            {busy ? 'Recomputing…' : 'Recompute ratios'}
          </button>
        </div>
      </div>
    </details>
  );
}
