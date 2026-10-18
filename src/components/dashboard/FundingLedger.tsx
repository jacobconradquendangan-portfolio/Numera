'use client';

import { CHART_COLORS, type CapitalStructurePoint } from '@/lib/chartData';
import type { RatioResult } from '@/lib/engine/ratios';
import { cx, formatCompact, formatPercent } from '@/lib/format';

interface FundingLedgerProps {
  data: CapitalStructurePoint[];
  selectedPeriod: string;
  equityRatio?: RatioResult | null;
  debtToEquity?: RatioResult | null;
}

const CREDITORS_COLOR = CHART_COLORS.leverage;
const OWNERS_COLOR = CHART_COLORS.netIncome;

function totalAssets(row: CapitalStructurePoint): number | null {
  if (row.Assets !== null) return row.Assets;
  if (row.Liabilities === null && row.Equity === null) return null;
  return (row.Liabilities ?? 0) + (row.Equity ?? 0);
}

export default function FundingLedger({ data, selectedPeriod, equityRatio, debtToEquity }: FundingLedgerProps) {
  if (!data.length) {
    return (
      <p className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-faint">
        No balance sheet to read. Add one to see how the assets are funded.
      </p>
    );
  }

  const totals = data.map(totalAssets);
  const scale = Math.max(...totals.map((value) => (value === null ? 0 : Math.abs(value))), 1);
  const focused = data.find((row) => row.period === selectedPeriod) ?? data[data.length - 1];
  const focusedAssets = totalAssets(focused);
  const focusedEquity = focused.Equity;
  const equityShare =
    focusedAssets === null || focusedEquity === null || focusedAssets === 0
      ? null
      : (focusedEquity / focusedAssets) * 100;

  return (
    <div>
      <ul>
        {data.map((row) => {
          const assets = totalAssets(row);
          const creditors = row.Liabilities === null ? null : Math.max(row.Liabilities, 0);
          const owners = row.Equity === null ? null : Math.max(row.Equity, 0);
          const ownersShare = assets === null || assets === 0 || row.Equity === null ? null : (row.Equity / assets) * 100;
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
                {creditors === null || owners === null ? (
                  <span className="my-auto h-px w-full bg-line2" />
                ) : (
                  <>
                    <span
                      className="rounded-l-[2px]"
                      style={{ width: `${(creditors / scale) * 100}%`, background: CREDITORS_COLOR }}
                    />
                    <span className="w-px bg-panel" />
                    <span style={{ width: `${(owners / scale) * 100}%`, background: OWNERS_COLOR }} />
                    {assets !== null && creditors + owners < Math.abs(assets) ? (
                      <span className="my-auto h-px grow bg-line2" />
                    ) : null}
                  </>
                )}
              </span>

              <span className="flex items-baseline gap-x-3 text-right">
                <span
                  className={cx(
                    'tabular font-mono text-[0.7rem]',
                    row.Equity !== null && row.Equity <= 0 ? 'text-neg' : 'text-muted'
                  )}
                >
                  owners {ownersShare === null ? '—' : formatPercent(ownersShare, 0)}
                </span>
                <span className="tabular w-16 text-right font-mono text-[0.7rem] text-faint">
                  {assets === null ? '—' : formatCompact(assets)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5" style={{ background: CREDITORS_COLOR }} />
          <span className="rule-label">Creditors</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5" style={{ background: OWNERS_COLOR }} />
          <span className="rule-label">Owners&rsquo; equity</span>
        </span>
        <span className="rule-label ml-auto">bar length is total assets on one shared scale</span>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t border-line pt-3">
        <span className="flex items-baseline gap-2">
          <span className="rule-label">Equity ratio</span>
          <span className="tabular font-mono text-sm text-paper">{equityRatio?.display ?? '—'}</span>
        </span>
        <span className="flex items-baseline gap-2">
          <span className="rule-label">Debt to equity</span>
          <span className="tabular font-mono text-sm text-paper">{debtToEquity?.display ?? '—'}</span>
        </span>
        <span className="rule-label ml-auto">
          {focused.period}
          {equityShare === null ? '' : ` · owners fund ${formatPercent(equityShare, 0)} of assets`}
        </span>
      </div>

      {focusedEquity !== null && focusedEquity <= 0 ? (
        <p className="mt-2 text-sm text-neg">
          {focused.period} owners&rsquo; equity is {focusedEquity === 0 ? 'zero' : 'negative'} — assets are funded entirely by
          creditors, so debt-to-equity has no meaningful denominator.
        </p>
      ) : null}
    </div>
  );
}
