'use client';

import { useMemo, useState } from 'react';
import type { HorizontalAnalysis, VerticalAnalysis } from '@/lib/types';
import { cx, formatCompact, formatSigned, formatSignedPercent, toneFor } from '@/lib/format';

interface AnalysisTablesProps {
  title: string;
  subtitle: string;
  vertical: VerticalAnalysis;
  horizontal: HorizontalAnalysis;
  selectedPeriod: string;
}

type SortDir = 'asc' | 'desc';

interface SortState<K extends string> {
  key: K | null;
  dir: SortDir;
}

type VerticalKey = 'label' | 'value' | 'percent';
type HorizontalKey = 'label' | 'absolute' | 'percent';

function cycleSort<K extends string>(current: SortState<K>, key: K): SortState<K> {
  if (current.key !== key) return { key, dir: 'asc' };
  if (current.dir === 'asc') return { key, dir: 'desc' };
  return { key: null, dir: 'asc' };
}

function compareNullable(a: number | null, b: number | null, dir: SortDir): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return (a - b) * (dir === 'asc' ? 1 : -1);
}

function SortHeader<K extends string>({
  label,
  columnKey,
  sort,
  onSort,
  align = 'left',
}: {
  label: string;
  columnKey: K;
  sort: SortState<K>;
  onSort: (key: K) => void;
  align?: 'left' | 'right';
}) {
  const active = sort.key === columnKey;
  const indicator = active ? (sort.dir === 'asc' ? '\u2191' : '\u2193') : '\u2195';
  return (
    <th className={cx('rule-label px-5 py-3 font-normal', align === 'right' ? 'text-right' : 'text-left')}>
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        aria-label={`Sort by ${label}`}
        className={cx(
          'inline-flex items-center gap-1.5 uppercase transition',
          active ? 'text-accent' : 'text-muted hover:text-paper'
        )}
      >
        <span>{label}</span>
        <span className={cx('text-[0.7rem] leading-none', active ? 'text-accent' : 'text-faint/70')}>{indicator}</span>
      </button>
    </th>
  );
}

export default function AnalysisTables({
  title,
  subtitle,
  vertical,
  horizontal,
  selectedPeriod,
}: AnalysisTablesProps) {
  const [verticalSort, setVerticalSort] = useState<SortState<VerticalKey>>({ key: null, dir: 'asc' });
  const [horizontalSort, setHorizontalSort] = useState<SortState<HorizontalKey>>({ key: null, dir: 'asc' });

  const verticalRows = vertical.entries.filter((entry) => entry.period === selectedPeriod);
  const maxPercent = Math.max(
    1,
    ...verticalRows.map((entry) => Math.abs(entry.percent ?? 0)).filter((value) => Number.isFinite(value))
  );

  const priorIndex = horizontal.periods.indexOf(selectedPeriod) - 1;
  const fromPeriod = priorIndex >= 0 ? horizontal.periods[priorIndex] : null;

  const sortedVerticalRows = useMemo(() => {
    if (!verticalSort.key) return verticalRows;
    const rows = [...verticalRows];
    const { key, dir } = verticalSort;
    rows.sort((a, b) => {
      if (key === 'label') return a.label.localeCompare(b.label) * (dir === 'asc' ? 1 : -1);
      if (key === 'value') return compareNullable(a.value, b.value, dir);
      return compareNullable(a.percent, b.percent, dir);
    });
    return rows;
  }, [verticalRows, verticalSort]);

  const horizontalRows = useMemo(
    () =>
      horizontal.entries.map((entry) => ({
        entry,
        change: entry.changes.find((item) => item.toPeriod === selectedPeriod) ?? null,
      })),
    [horizontal.entries, selectedPeriod]
  );

  const sortedHorizontalRows = useMemo(() => {
    if (!horizontalSort.key) return horizontalRows;
    const rows = [...horizontalRows];
    const { key, dir } = horizontalSort;
    rows.sort((a, b) => {
      if (key === 'label') return a.entry.label.localeCompare(b.entry.label) * (dir === 'asc' ? 1 : -1);
      if (key === 'absolute') return compareNullable(a.change?.absoluteChange ?? null, b.change?.absoluteChange ?? null, dir);
      return compareNullable(a.change?.percentChange ?? null, b.change?.percentChange ?? null, dir);
    });
    return rows;
  }, [horizontalRows, horizontalSort]);

  return (
    <section className="rise space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl text-paper">{title}</h3>
          <p className="rule-label mt-1">{subtitle}</p>
        </div>
        <span className="tabular rounded-full border border-line2 px-3 py-1 text-xs text-muted">
          {selectedPeriod}
        </span>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="panel overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <span className="font-display text-lg text-paper">Vertical</span>
            <span className="rule-label">% of {vertical.baseLabel}</span>
          </div>
          <div className="max-h-[30rem] overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-panel2">
                <tr>
                  <SortHeader label="Line item" columnKey="label" sort={verticalSort} onSort={(key) => setVerticalSort((current) => cycleSort(current, key))} />
                  <SortHeader label="Value" columnKey="value" sort={verticalSort} onSort={(key) => setVerticalSort((current) => cycleSort(current, key))} align="right" />
                  <SortHeader label="% of base" columnKey="percent" sort={verticalSort} onSort={(key) => setVerticalSort((current) => cycleSort(current, key))} align="right" />
                </tr>
              </thead>
              <tbody>
                {sortedVerticalRows.map((entry) => {
                  const width = Math.min(100, (Math.abs(entry.percent ?? 0) / maxPercent) * 100);
                  const tone = toneFor(entry.value);
                  return (
                    <tr key={`${entry.category}-${entry.period}`} className="border-t border-line/60 hover:bg-black/[0.025]">
                      <td className="px-5 py-2.5">
                        <span className="block text-paper">{entry.label}</span>
                        {entry.derived ? (
                          <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-accent">
                            derived
                          </span>
                        ) : null}
                      </td>
                      <td className={cx('tabular px-3 py-2.5 text-right', tone === 'neg' ? 'text-neg' : 'text-paper')}>
                        {formatCompact(entry.value)}
                      </td>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center justify-end gap-3">
                          <span className="relative hidden h-1 w-20 overflow-hidden rounded-full bg-line sm:block">
                            <span
                              className={cx('bar absolute inset-y-0 left-0 rounded-full', tone === 'neg' ? 'bg-neg/70' : 'bg-accent/70')}
                              style={{ width: `${width}%` }}
                            />
                          </span>
                          <span className="tabular w-16 text-right text-paper">
                            {entry.percent === null ? '—' : `${entry.percent.toFixed(1)}%`}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {sortedVerticalRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-muted">
                      No line items available for this period.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <span className="font-display text-lg text-paper">Horizontal</span>
            <span className="rule-label">
              {fromPeriod ? `${fromPeriod} → ${selectedPeriod}` : 'no prior period'}
            </span>
          </div>
          <div className="max-h-[30rem] overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-panel2">
                <tr>
                  <SortHeader label="Line item" columnKey="label" sort={horizontalSort} onSort={(key) => setHorizontalSort((current) => cycleSort(current, key))} />
                  <SortHeader label="Δ" columnKey="absolute" sort={horizontalSort} onSort={(key) => setHorizontalSort((current) => cycleSort(current, key))} align="right" />
                  <SortHeader label="Growth" columnKey="percent" sort={horizontalSort} onSort={(key) => setHorizontalSort((current) => cycleSort(current, key))} align="right" />
                </tr>
              </thead>
              <tbody>
                {sortedHorizontalRows.map(({ entry, change }) => {
                  const tone = toneFor(change?.absoluteChange ?? null);
                  return (
                    <tr key={entry.category} className="border-t border-line/60 hover:bg-black/[0.025]">
                      <td className="px-5 py-2.5 text-paper">{entry.label}</td>
                      <td
                        className={cx(
                          'tabular px-3 py-2.5 text-right',
                          tone === 'pos' && 'text-pos',
                          tone === 'neg' && 'text-neg',
                          tone === 'flat' && 'text-muted'
                        )}
                      >
                        {change ? formatSigned(change.absoluteChange) : '—'}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        {change && change.percentChange !== null ? (
                          <span
                            className={cx(
                              'tabular inline-flex min-w-[4.5rem] justify-end rounded-md px-2 py-0.5',
                              tone === 'pos' && 'bg-pos/10 text-pos',
                              tone === 'neg' && 'bg-neg/10 text-neg',
                              tone === 'flat' && 'text-muted'
                            )}
                          >
                            {formatSignedPercent(change.percentChange)}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {sortedHorizontalRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-muted">
                      Not enough periods for horizontal analysis.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
