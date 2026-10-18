'use client';

import type { BalanceSheetValidation, NormalizedStatement } from '@/lib/types';
import { cx, formatCompact } from '@/lib/format';

interface OverviewProps {
  validation: BalanceSheetValidation | undefined;
  income: NormalizedStatement | null;
  balance: NormalizedStatement | null;
  cashflow?: NormalizedStatement | null;
  selectedPeriod: string;
  unitMultiplier: number;
}

function valueOf(statement: NormalizedStatement | null, category: string, period: string): number | null {
  const item = statement?.lineItems.find((entry) => entry.category === category);
  const value = item?.values[period];
  return value === null || value === undefined ? null : value;
}

export default function Overview({ validation, income, balance, cashflow, selectedPeriod, unitMultiplier }: OverviewProps) {
  const figures = [
    { label: 'Revenue', value: valueOf(income, 'revenue', selectedPeriod) },
    { label: 'Net Income', value: valueOf(income, 'net_income', selectedPeriod) },
    { label: 'Total Assets', value: valueOf(balance, 'total_assets', selectedPeriod) },
    { label: 'Total Liabilities', value: valueOf(balance, 'total_liabilities', selectedPeriod) },
    { label: "Shareholders' Equity", value: valueOf(balance, 'total_equity', selectedPeriod) },
    ...(cashflow
      ? [{ label: 'Operating Cash Flow', value: valueOf(cashflow, 'net_cash_from_operating_activities', selectedPeriod) }]
      : []),
  ];

  const balanced = validation?.balanced ?? null;
  const scaleNote = unitMultiplier !== 1 ? `×${unitMultiplier.toLocaleString()} units` : 'as reported';

  return (
    <section className="rise space-y-5">
      <div
        className={cx(
          'flex flex-wrap items-center justify-between gap-4 rounded-2xl border px-6 py-5',
          balanced === true && 'border-pos/40 bg-pos/5',
          balanced === false && 'border-neg/40 bg-neg/5',
          balanced === null && 'border-line bg-panel'
        )}
      >
        <div className="flex items-center gap-4">
          <span
            className={cx(
              'flex h-11 w-11 items-center justify-center rounded-full border text-lg',
              balanced === true && 'border-pos text-pos',
              balanced === false && 'border-neg text-neg',
              balanced === null && 'border-line2 text-muted'
            )}
          >
            {balanced === true ? '=' : balanced === false ? '≠' : '–'}
          </span>
          <div>
            <p className="font-display text-lg text-paper">Balance sheet integrity</p>
            <p className="tabular text-sm text-muted">
              {validation
                ? `${formatCompact(validation.totalAssets)} Assets ${
                    balanced ? '=' : '≠'
                  } ${formatCompact(validation.totalLiabilitiesAndEquity ?? validation.totalEquity)} Liabilities + Equity`
                : 'No balance-sheet validation available for this period.'}
            </p>
          </div>
        </div>
        <div className="text-right">
          {validation ? (
            <>
              <p className={cx('tabular text-lg', balanced ? 'text-pos' : 'text-neg')}>
                {balanced ? 'Balanced' : 'Out of balance'}
              </p>
              <p className="rule-label">
                Δ {formatCompact(validation.difference)} · tol {formatCompact(validation.tolerance)}
              </p>
            </>
          ) : (
            <p className="rule-label">n/a</p>
          )}
        </div>
      </div>

      <div className={cx('grid grid-cols-2 gap-3 md:grid-cols-3', cashflow ? 'xl:grid-cols-6' : 'xl:grid-cols-5')}>
        {figures.map((figure) => (
          <div key={figure.label} className="panel rounded-xl px-4 py-4">
            <p className="rule-label mb-2 sm:whitespace-nowrap">{figure.label}</p>
            <p className="tabular text-xl text-paper">{formatCompact(figure.value)}</p>
          </div>
        ))}
      </div>
      <p className="rule-label">Statement values normalised {scaleNote}</p>
    </section>
  );
}
