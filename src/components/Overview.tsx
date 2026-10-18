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

interface Kpi {
  label: string;
  source: string;
  value: number | null;
}

function valueOf(statement: NormalizedStatement | null, category: string, period: string): number | null {
  const item = statement?.lineItems.find((entry) => entry.category === category);
  const value = item?.values[period];
  return value === null || value === undefined ? null : value;
}

export default function Overview({ validation, income, balance, cashflow, selectedPeriod, unitMultiplier }: OverviewProps) {
  const period = selectedPeriod;
  const balanced = validation?.balanced ?? null;

  const figures: Kpi[] = [
    income ? { label: 'Revenue', source: 'Income statement', value: valueOf(income, 'revenue', period) } : null,
    income ? { label: 'Net income', source: 'Income statement', value: valueOf(income, 'net_income', period) } : null,
    balance ? { label: 'Total assets', source: 'Balance sheet', value: valueOf(balance, 'total_assets', period) } : null,
    balance ? { label: 'Total liabilities', source: 'Balance sheet', value: valueOf(balance, 'total_liabilities', period) } : null,
    balance
      ? { label: "Shareholders' equity", source: 'Balance sheet', value: valueOf(balance, 'total_equity', period) }
      : null,
    cashflow
      ? { label: 'Operating cash flow', source: 'Cash flow statement', value: valueOf(cashflow, 'net_cash_from_operating_activities', period) }
      : null,
  ].filter((figure): figure is Kpi => figure !== null);

  return (
    <section className="rise space-y-5" aria-label="Overview">
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
              'grid h-11 w-11 place-items-center rounded-sm border font-mono text-xl',
              balanced === true && 'border-pos text-pos',
              balanced === false && 'border-neg text-neg',
              balanced === null && 'border-line2 text-muted'
            )}
            aria-hidden="true"
          >
            {balanced === true ? '=' : balanced === false ? '\u2260' : '–'}
          </span>
          <div>
            <p className="font-display text-lg text-paper">Balance sheet integrity</p>
            <p className="rule-label mt-0.5">
              {validation ? `audited against the accounting equation for ${validation.period}` : 'no validation available for this period'}
            </p>
          </div>
        </div>
        <div className="text-right">
          {validation ? (
            <>
              <p className={cx('tabular text-lg', balanced ? 'text-pos' : 'text-neg')}>
                {formatCompact(validation.totalAssets)} {balanced ? '=' : '\u2260'}{' '}
                {formatCompact(validation.totalLiabilitiesAndEquity ?? validation.totalEquity)}
              </p>
              <p className="tabular rule-label mt-0.5">
                Assets {balanced ? '=' : '\u2260'} Liabilities + Equity · Δ {formatCompact(validation.difference)} against a tolerance of{' '}
                {formatCompact(validation.tolerance)}
              </p>
            </>
          ) : (
            <p className="rule-label">not verified</p>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="rule-label">Key figures from the statements</p>
          <span className="flex items-center gap-2">
            <span className="rounded-sm border border-line2 px-2.5 py-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-paper">
              Period {period}
            </span>
            <span
              className={cx(
                'rounded-sm border border-line2 px-2.5 py-1 font-mono text-[0.62rem] uppercase tracking-[0.14em]',
                unitMultiplier !== 1 ? 'text-accent' : 'text-faint'
              )}
            >
              {unitMultiplier !== 1 ? `\u00d7${unitMultiplier.toLocaleString()} units` : 'as reported'}
            </span>
          </span>
        </div>
        <div className={cx('grid grid-cols-2 gap-3 md:grid-cols-3', cashflow ? 'xl:grid-cols-6' : 'xl:grid-cols-5')}>
          {figures.map((figure) => (
            <div key={figure.label} className="group rounded-xl border border-line bg-panel px-4 py-3.5">
              <p className="rule-label mb-2 whitespace-nowrap">{figure.label}</p>
              <p
                className={cx(
                  'tabular text-2xl leading-tight',
                  figure.value === null ? 'text-faint' : figure.value < 0 ? 'text-neg' : 'text-pos'
                )}
              >
                {formatCompact(figure.value)}
              </p>
              <p className="mt-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-faint">{figure.source}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
