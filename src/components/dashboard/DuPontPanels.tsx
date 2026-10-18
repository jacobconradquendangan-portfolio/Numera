'use client';

import { Fragment } from 'react';
import type { DuPontPoint } from '@/lib/chartData';
import { cx, formatUnitValue, type DisplayUnit } from '@/lib/format';
import DuPontTrendChart from './DuPontTrendChart';

interface DuPontPanelsProps {
  data: DuPontPoint[];
  selectedPeriod: string;
}

interface Factor {
  label: string;
  role: string;
  unit: DisplayUnit;
  pick: (row: DuPontPoint) => number | null;
}

const FACTORS: Factor[] = [
  {
    label: 'Net profit margin',
    role: 'Profit kept per sales dollar',
    unit: 'percent',
    pick: (row) => row.netMargin,
  },
  {
    label: 'Asset turnover',
    role: 'Sales generated per asset dollar',
    unit: 'times',
    pick: (row) => row.assetTurnover,
  },
  {
    label: 'Financial leverage',
    role: 'Assets funded per equity dollar',
    unit: 'times',
    pick: (row) => row.financialLeverage,
  },
];

function display(value: number | null, unit: DisplayUnit): string {
  return value === null ? '—' : formatUnitValue(value, unit);
}

export default function DuPontPanels({ data, selectedPeriod }: DuPontPanelsProps) {
  if (!data.length) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-line text-sm text-faint">
        No ratio periods available to decompose.
      </div>
    );
  }

  const focused = data.find((row) => row.period === selectedPeriod) ?? data[data.length - 1];
  const substitution = [
    display(focused.netMargin, 'percent'),
    display(focused.assetTurnover, 'times'),
    display(focused.financialLeverage, 'times'),
  ].join(' × ');
  const product =
    focused.netMargin === null || focused.assetTurnover === null || focused.financialLeverage === null
      ? null
      : (focused.netMargin / 100) * focused.assetTurnover * focused.financialLeverage * 100;
  const productGap = product === null || focused.roe === null ? null : Math.abs(product - focused.roe);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-line bg-panel2/50 p-4 sm:p-5">
        <p className="rule-label">
          Return on equity = net profit margin × asset turnover × financial leverage
        </p>

        <div className="mt-3.5 flex flex-wrap items-stretch gap-x-2.5 gap-y-3">
          {FACTORS.map((factor, index) => (
            <Fragment key={factor.label}>
              {index > 0 ? (
                <span className="grid place-items-center px-1 font-display text-2xl text-accentdim" aria-hidden>
                  ×
                </span>
              ) : null}
              <div className="min-w-[9.5rem] flex-1 rounded-lg border border-line bg-panel px-4 py-3">
                <p className="rule-label">{factor.label}</p>
                <p
                  className={cx(
                    'tabular mt-1.5 whitespace-nowrap text-2xl leading-none',
                    factor.pick(focused) === null ? 'text-faint' : 'text-paper'
                  )}
                >
                  {display(factor.pick(focused), factor.unit)}
                </p>
                <p className="mt-2.5 text-xs text-faint">{factor.role}</p>
              </div>
            </Fragment>
          ))}

          <span className="grid place-items-center px-1 font-display text-2xl text-accent" aria-hidden>
            =
          </span>
          <div className="min-w-[9.5rem] flex-1 rounded-lg border border-accent/40 bg-accent/[0.07] px-4 py-3">
            <p className="rule-label text-accentdim">Return on equity</p>
            <p
              className={cx(
                'tabular mt-1.5 whitespace-nowrap text-2xl leading-none',
                focused.roe === null ? 'text-faint' : 'text-accent'
              )}
            >
              {display(focused.roe, 'percent')}
            </p>
            <p className="mt-2.5 text-xs text-faint">Shareholder return · {focused.period}</p>
          </div>
        </div>

        <p className="tabular mt-4 border-t border-line/70 pt-3 text-xs text-muted">
          Substitution — {substitution} = {display(product, 'percent')}
          {productGap === null
            ? ' · incomplete inputs shown as dashes'
            : productGap <= 0.05
              ? ` · matches the reported ROE of ${display(focused.roe, 'percent')}`
              : ` · reported ROE is ${display(focused.roe, 'percent')}`}
        </p>
        <p className="rule-label mt-1.5 text-faint">financial leverage = total assets / shareholders&rsquo; equity, the equity multiplier</p>
      </div>

      {data.length > 1 ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <div>
            <p className="rule-label mb-2">Factor trend</p>
            <DuPontTrendChart data={data} highlightPeriod={focused.period} />
          </div>

          <div>
            <p className="rule-label mb-2">Across periods</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[26rem] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="rule-label border-b border-line pb-2 text-left font-normal">Period</th>
                    {FACTORS.map((factor) => (
                      <th
                        key={factor.label}
                        className="rule-label border-b border-line border-l border-l-line/50 px-3 pb-2 text-right font-normal"
                      >
                        {factor.label}
                      </th>
                    ))}
                    <th className="rule-label border-b border-line border-l border-l-line/50 px-3 pb-2 text-right font-normal">
                      Return on equity
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => {
                    const isFocused = row.period === focused.period;
                    return (
                      <tr key={row.period} className={cx(isFocused && 'bg-accent/[0.05]')}>
                        <td
                          className={cx(
                            'tabular border-b border-line/60 py-2',
                            isFocused ? 'font-medium text-paper' : 'text-muted'
                          )}
                        >
                          {row.period}
                        </td>
                        {FACTORS.map((factor) => (
                          <td
                            key={factor.label}
                            className="tabular border-b border-line/60 border-l border-l-line/40 px-3 py-2 text-right text-muted"
                          >
                            {display(factor.pick(row), factor.unit)}
                          </td>
                        ))}
                        <td
                          className={cx(
                            'tabular border-b border-line/60 border-l border-l-line/40 px-3 py-2 text-right',
                            isFocused ? 'font-medium text-accent' : 'text-accent/80'
                          )}
                        >
                          {display(row.roe, 'percent')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-4 border-t border-line pt-4">
        <div>
          <p className="rule-label">Root-cause diagnostics</p>
          <p className="mt-1.5 max-w-[68ch] text-sm leading-relaxed text-muted">
            If ROE drops or spikes, the decomposition shows why at a glance — is the company making less profit per
            dollar of sales (margin), utilizing its assets less efficiently (turnover), or relying more heavily on debt
            (leverage)?
          </p>
        </div>
        <div>
          <p className="rule-label">Strategy alignment</p>
          <p className="mt-1.5 max-w-[68ch] text-sm leading-relaxed text-muted">
            Three different departments meet on one screen:
          </p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="border-l-2 border-l-line2 pl-3">
              <dt className="text-sm text-paper">Margin</dt>
              <dd className="mt-1 text-xs leading-relaxed text-faint">
                Pricing power and cost control — operations &amp; pricing
              </dd>
            </div>
            <div className="border-l-2 border-l-line2 pl-3">
              <dt className="text-sm text-paper">Turnover</dt>
              <dd className="mt-1 text-xs leading-relaxed text-faint">
                Asset and working-capital management — supply chain &amp; sales
              </dd>
            </div>
            <div className="border-l-2 border-l-line2 pl-3">
              <dt className="text-sm text-paper">Leverage</dt>
              <dd className="mt-1 text-xs leading-relaxed text-faint">
                Capital structure and risk appetite — treasury &amp; finance
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
