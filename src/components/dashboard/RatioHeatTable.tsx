'use client';

import { Fragment } from 'react';
import type { HeatRow } from '@/lib/chartData';
import { cx } from '@/lib/format';

interface RatioHeatTableProps {
  rows: HeatRow[];
  selectedPeriod?: string;
}

const CATEGORY_ORDER = ['liquidity', 'profitability', 'leverage', 'efficiency', 'valuation', 'other'];

const CATEGORY_LABEL: Record<string, string> = {
  liquidity: 'Liquidity — can it pay',
  profitability: 'Profitability — does it earn',
  leverage: 'Leverage — who funds it',
  efficiency: 'Efficiency — how fast it turns',
  valuation: 'Valuation — what it costs',
  other: 'Other',
};

const TONE_DOT: Record<string, string> = {
  pos: 'bg-pos',
  neg: 'bg-neg',
  flat: 'bg-line2',
};

const TONE_TEXT: Record<string, string> = {
  pos: 'text-pos',
  neg: 'text-neg',
  flat: 'text-muted',
};

function formatDelta(row: HeatRow): string {
  if (row.delta === null || row.latestValue === null) return '—';
  const sign = row.delta > 0 ? '+' : row.delta < 0 ? '−' : '';
  const abs = Math.abs(row.delta);
  if (row.unit === 'percent') return `${sign}${abs.toFixed(2)} pp`;
  if (row.unit === 'days') return `${sign}${abs.toFixed(1)} d`;
  if (row.unit === 'times') return `${sign}${abs.toFixed(2)}x`;
  return `${sign}${abs.toFixed(2)}`;
}

function sparkPath(values: (number | null)[], width: number, height: number): string {
  const points = values
    .map((value, index) => ({ value, index }))
    .filter((entry): entry is { value: number; index: number } => entry.value !== null && Number.isFinite(entry.value));
  if (points.length < 2) return '';
  const xs = points.map((entry) => entry.index);
  const ys = points.map((entry) => entry.value);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || Math.max(Math.abs(maxY) * 0.1, 1e-9);
  const pad = 2;
  return points
    .map((entry, i) => {
      const x = pad + ((entry.index - minX) / spanX) * (width - pad * 2);
      const y = height - pad - ((entry.value - minY) / spanY) * (height - pad * 2);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function sparkPoint(values: (number | null)[], index: number, width: number, height: number): { x: number; y: number } | null {
  const value = values[index];
  if (value === null || !Number.isFinite(value)) return null;
  const pts = values
    .map((v, i) => ({ v, i }))
    .filter((e): e is { v: number; i: number } => e.v !== null && Number.isFinite(e.v));
  if (!pts.length) return null;
  const xs = pts.map((e) => e.i);
  const ys = pts.map((e) => e.v);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || Math.max(Math.abs(maxY) * 0.1, 1e-9);
  const pad = 2;
  return {
    x: pad + ((index - minX) / spanX) * (width - pad * 2),
    y: height - pad - ((value - minY) / spanY) * (height - pad * 2),
  };
}

function sparkTone(row: HeatRow): string {
  if (row.deltaTone === 'pos') return '#357a3d';
  if (row.deltaTone === 'neg') return '#b04236';
  return '#857c66';
}

function cellShade(tone: string | null): string {
  if (tone === 'pos') return 'bg-pos/[0.08]';
  if (tone === 'neg') return 'bg-neg/[0.08]';
  return '';
}

export default function RatioHeatTable({ rows, selectedPeriod }: RatioHeatTableProps) {
  if (!rows.length) {
    return (
      <div className="flex h-44 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line text-center">
        <p className="font-display text-lg text-paper">No ratios on the heat table</p>
        <p className="rule-label">pick ratios under Ratios to lay them across periods</p>
      </div>
    );
  }

  const periods = rows[0].cells.map((cell) => cell.period);
  const focusIndex = selectedPeriod ? periods.lastIndexOf(selectedPeriod) : periods.length - 1;
  const grouped = new Map<string, HeatRow[]>();
  for (const row of rows) {
    const key = CATEGORY_LABEL[row.category] ? row.category : 'other';
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }
  const orderedGroups = CATEGORY_ORDER.filter((key) => grouped.has(key));
  const maxima = new Map<string, number>();
  for (const period of periods) {
    let max = 0;
    for (const row of rows) {
      const cell = row.cells.find((entry) => entry.period === period);
      const v = cell?.value;
      if (v !== null && v !== undefined && Number.isFinite(v)) max = Math.max(max, Math.abs(v));
    }
    maxima.set(period, max || 1);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[46rem] border-collapse text-sm" aria-label="Ratio heat table">
        <thead>
          <tr>
            <th className="rule-label border-b border-line pb-2 pr-3 text-left font-normal">Ratio · trend · latest</th>
            {periods.map((period, index) => (
              <th
                key={period}
                className={cx('rule-label tabular border-b border-line px-2 pb-2 text-right font-normal', index === focusIndex && 'text-paper')}
              >
                <span className={cx('inline-block rounded-sm px-1.5 py-0.5', index === focusIndex && 'border border-accent/50 bg-accent/10 text-accent')}>
                  {period}
                </span>
              </th>
            ))}
            <th className="rule-label border-b border-line pb-2 pl-3 text-right font-normal">Δ prior</th>
          </tr>
        </thead>
        <tbody>
          {orderedGroups.map((group) => (
            <Fragment key={`group-${group}`}>
              <tr>
                <td colSpan={periods.length + 2} className="pb-1 pt-4">
                  <div className="flex items-center gap-2.5">
                    <span className="rule-label whitespace-nowrap text-accentdim">{CATEGORY_LABEL[group]}</span>
                    <span className="h-px w-full bg-line" aria-hidden />
                    <span className="rule-label tabular whitespace-nowrap">{(grouped.get(group) ?? []).length} lines</span>
                  </div>
                </td>
              </tr>
              {(grouped.get(group) ?? []).map((row) => {
                const focusCell = row.cells[focusIndex] ?? null;
                return (
                <tr key={row.id} className="hover:bg-panel2/40">
                  <td className="border-b border-line/60 py-2.5 pr-3 align-middle">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={cx('h-8 w-1 shrink-0 rounded-full', row.deltaTone ? TONE_DOT[row.deltaTone] : 'bg-line2')} aria-hidden />
                      <div className="min-w-0">
                        <p className="truncate font-medium leading-tight text-paper" title={row.label}>{row.label}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <svg width="64" height="18" viewBox="0 0 64 18" aria-hidden className="shrink-0">
                            {sparkPath(row.spark, 64, 18) ? (
                              <>
                                <path d={sparkPath(row.spark, 64, 18)} fill="none" stroke={sparkTone(row)} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                {focusIndex >= 0 && sparkPoint(row.spark, focusIndex, 64, 18) ? (
                                  <circle
                                    cx={sparkPoint(row.spark, focusIndex, 64, 18)!.x}
                                    cy={sparkPoint(row.spark, focusIndex, 64, 18)!.y}
                                    r="2.6"
                                    fill={sparkTone(row)}
                                    stroke="var(--color-panel)"
                                    strokeWidth="1.2"
                                  />
                                ) : null}
                              </>
                            ) : (
                              <line x1="4" y1="9" x2="60" y2="9" stroke="#cdc1a2" strokeWidth="1" strokeDasharray="2 3" />
                            )}
                          </svg>
                          <span className={cx('tabular font-mono text-[0.7rem]', focusCell?.value === null ? 'text-faint' : 'text-paper')}>
                            {focusCell?.display ?? row.latest}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                  {row.cells.map((cell) => {
                    const scale = maxima.get(cell.period) ?? 1;
                    const magnitude = cell.value === null ? 0 : Math.min(Math.abs(cell.value) / scale, 1);
                    const title = cell.change === null
                      ? `${row.label} · ${cell.period}: ${cell.display} (no prior period)`
                      : `${row.label} · ${cell.period}: ${cell.display} (${cell.change >= 0 ? '+' : '−'}${Math.abs(cell.change).toFixed(2)}${cell.changePct === null ? '' : `, ${cell.changePct >= 0 ? '+' : ''}${cell.changePct.toFixed(1)}%`})`;
                    return (
                      <td key={`${row.id}-${cell.period}`} title={title} className={cx('border-b border-line/60 px-2 py-2.5 text-right align-middle', cellShade(cell.tone))}>
                        <span className={cx('tabular font-mono text-[0.8rem]', cell.value === null ? 'text-faint' : 'text-paper')}>{cell.display}</span>
                        <span className="mt-1 flex items-center justify-end gap-1.5">
                          <span className={cx('inline-block h-1.5 w-1.5 rounded-full', cell.tone ? TONE_DOT[cell.tone] : 'bg-transparent')} aria-hidden />
                          <span className={cx('tabular font-mono text-[0.62rem]', cell.tone ? TONE_TEXT[cell.tone] : 'text-faint')}>
                            {cell.direction === 'up' ? '▲' : cell.direction === 'down' ? '▼' : cell.direction === 'flat' ? '■' : '·'}
                            {cell.changePct === null ? '' : ` ${cell.changePct >= 0 ? '+' : ''}${cell.changePct.toFixed(1)}%`}
                          </span>
                        </span>
                        <span className="mt-1 block h-[3px] overflow-hidden rounded-full bg-line/60" aria-hidden>
                          <span className={cx('block h-full rounded-full', cell.tone === 'neg' ? 'bg-neg/70' : cell.tone === 'pos' ? 'bg-pos/70' : 'bg-line2/70')} style={{ width: `${Math.max(magnitude * 100, cell.value === null ? 0 : 6)}%` }} />
                        </span>
                      </td>
                    );
                  })}
                  <td className="border-b border-line/60 py-2.5 pl-3 text-right align-middle">
                    <span className={cx('tabular rounded-sm border px-1.5 py-0.5 font-mono text-[0.7rem]', row.deltaTone === 'pos' && 'border-pos/40 bg-pos/10 text-pos', row.deltaTone === 'neg' && 'border-neg/40 bg-neg/10 text-neg', (row.deltaTone === 'flat' || row.deltaTone === null) && 'border-line bg-panel2/60 text-muted')}>
                      {formatDelta(row)}
                    </span>
                  </td>
                </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line pt-3">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-pos" />
          <span className="rule-label">Favourable move</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-neg" />
          <span className="rule-label">Adverse move</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-line2" />
          <span className="rule-label">Flat · direction only</span>
        </span>
        <span className="rule-label ml-auto">tint and arrow read direction-aware favourability, not raw up or down</span>
      </div>
    </div>
  );
}
