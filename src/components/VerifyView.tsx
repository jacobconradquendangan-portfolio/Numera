'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cx, formatNumber, formatPercent } from '@/lib/format';
import { buildVerification, VERIFY_TOLERANCE } from '@/lib/verify';
import type { VerifyRow, VerifyStatus } from '@/lib/verify';
import { highlightWordIndexes } from '@/lib/highlight';
import type { ManualModel } from '@/lib/manualModel';
import type { ParsedDocument } from '@/lib/types';

interface VerifyViewProps {
  baseline: ParsedDocument;
  model: ManualModel;
  pdfUrl: string | null;
  onRecompute: () => void;
  busy: boolean;
}

type Filter = 'all' | 'flagged' | 'low';

interface Target {
  page: number | null;
  terms: string[];
}

const LOW_CONFIDENCE = 0.9;

const STATUS_TONE: Record<VerifyStatus, string> = {
  match: 'text-pos',
  mismatch: 'text-neg',
  missing: 'text-accent',
  extra: 'text-accentdim',
  derived: 'text-faint',
  blank: 'text-faint',
};

const STATUS_INPUT: Record<VerifyStatus, string> = {
  match: 'border-line bg-ink/40 text-paper',
  mismatch: 'border-neg/70 bg-neg/5 text-neg focus:border-neg',
  missing: 'border-accent/60 bg-accent/5 text-accent focus:border-accent',
  extra: 'border-accentdim/60 bg-accent/5 text-paper focus:border-accentdim',
  derived: 'border-line bg-ink/40 text-faint',
  blank: 'border-line bg-ink/40 text-paper',
};

const STATUS_LABEL: Record<VerifyStatus, string> = {
  match: 'Matches the parsed figure',
  mismatch: 'Differs from the parsed figure',
  missing: 'Numera read a figure the manual grid is missing',
  extra: 'Manual value Numera did not extract',
  derived: 'Derived total, not read from the document',
  blank: 'No value',
};

/**
 * The true page when the source PDF's pages align with the source table name.
 * Digital text extraction yields `page N` (original document); the generated
 * searchable PDF yields pages in OCR image order, so `ocr image N` is page N.
 */
function knownPage(table: string): number | null {
  const match = /^(?:page|ocr image)\s+(\d+)$/i.exec(table.trim());
  return match ? Number(match[1]) : null;
}

/** Search strings used to locate and highlight the row inside the PDF viewer. */
function sourceTerms(row: VerifyRow): string[] {
  const terms: string[] = [];
  const raw = row.rawLabel.trim();
  const label = raw && !/^[a-z0-9_]+$/.test(raw) ? raw : row.label.trim();
  if (label && label.length >= 3) terms.push(label);
  const firstValue = row.cells.find((cell) => cell.parsed !== null)?.parsed;
  if (firstValue !== null && firstValue !== undefined) terms.push(formatNumber(firstValue));
  return terms;
}

function targetForRow(row: VerifyRow): Target {
  return { page: knownPage(row.sourceTable), terms: sourceTerms(row) };
}

function pdfFragment(pdfUrl: string, target: Target): string {
  const params: string[] = [];
  if (target.page !== null) params.push(`page=${target.page}`);
  if (target.terms.length) {
    params.push(`:~:${target.terms.map((term) => `text=${encodeURIComponent(term)}`).join('&')}`);
  }
  return params.length ? `${pdfUrl}#${params.join('&')}` : pdfUrl;
}

function StatusMark({ status }: { status: VerifyStatus }) {
  if (status === 'match') {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === 'derived') return <span className="font-mono text-[0.55rem] uppercase tracking-[0.12em]">derived</span>;
  if (status === 'blank') return <span className="text-faint">—</span>;
  return <span className="font-mono text-[0.6rem] uppercase tracking-[0.12em]">{status}</span>;
}

export default function VerifyView({ baseline, model, pdfUrl, onRecompute, busy }: VerifyViewProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [target, setTarget] = useState<Target | null>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const pageScrollRef = useRef<HTMLDivElement | null>(null);
  const firstMarkRef = useRef<HTMLSpanElement | null>(null);

  const sourcePages = baseline.sourcePages ?? null;
  const sourcePage = target?.page != null ? sourcePages?.find((page) => page.page === target.page) ?? null : null;
  const highlightIdx = useMemo(
    () => (sourcePage && target ? highlightWordIndexes(sourcePage.words, target.terms) : []),
    [sourcePage, target]
  );

  const scrollWordIndex = useMemo(() => {
    if (!sourcePage || !target) return null;
    const numericTerm = target.terms.find((term) => /\d/.test(term));
    if (numericTerm) {
      const numericMatches = highlightWordIndexes(sourcePage.words, [numericTerm]);
      if (numericMatches.length) return numericMatches[0];
    }
    return highlightIdx[0] ?? null;
  }, [sourcePage, target, highlightIdx]);

  const focusPreview = () => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  useEffect(() => {
    setImgSize(null);
  }, [sourcePage?.page]);

  useEffect(() => {
    const mark = firstMarkRef.current;
    const box = pageScrollRef.current;
    if (!mark || !box) return;
    box.scrollTop = Math.max(0, mark.offsetTop - box.clientHeight / 2 + mark.offsetHeight / 2);
  }, [imgSize, highlightIdx, scrollWordIndex]);

  const showSource = (row: VerifyRow) => {
    setTarget(targetForRow(row));
    focusPreview();
  };

  const goToPage = (page: number) => {
    setTarget({ page, terms: [] });
    focusPreview();
  };

  const report = useMemo(
    () => buildVerification(baseline.statements, model.rows, model.periods, model.categories, VERIFY_TOLERANCE),
    [baseline, model.rows, model.periods, model.categories]
  );

  const flaggedRows = report.counts.mismatch + report.counts.missing;
  const lowRows = report.rows.filter((row) => !row.derived && row.confidence < LOW_CONFIDENCE).length;

  const visibleRows = useMemo(() => {
    if (filter === 'flagged') {
      return report.rows.filter((row) => row.cells.some((cell) => cell.status === 'mismatch' || cell.status === 'missing'));
    }
    if (filter === 'low') {
      return report.rows.filter((row) => !row.derived && row.confidence < LOW_CONFIDENCE);
    }
    return report.rows;
  }, [report.rows, filter]);

  const grouped = useMemo(
    () =>
      (['income', 'balance', 'cashflow'] as const)
        .map((type) => ({ type, rows: visibleRows.filter((row) => row.type === type) }))
        .filter((group) => group.rows.length > 0),
    [visibleRows]
  );

  const accuracyTone =
    report.accuracy === null ? 'text-faint' : report.accuracy === 1 ? 'text-pos' : report.accuracy >= 0.95 ? 'text-accent' : 'text-neg';

  const renderCell = (row: VerifyRow, cellIndex: number) => {
    const cell = row.cells[cellIndex];
    const parsedText = cell.parsed === null ? '—' : formatNumber(cell.parsed);
    const editable = !row.derived && (cell.status === 'mismatch' || cell.status === 'missing' || cell.status === 'extra');

    return (
      <div className="space-y-1" title={STATUS_LABEL[cell.status]}>
        <div className="flex items-center justify-between gap-2">
          <span className={cx('tabular text-sm', STATUS_TONE[cell.status])}>{parsedText}</span>
          <span className={cx('shrink-0', STATUS_TONE[cell.status])}>
            <StatusMark status={cell.status} />
          </span>
        </div>
        {editable ? (
          <input
            value={cell.manualRaw}
            inputMode="decimal"
            onChange={(event) => model.applyCorrection(row.type, row.label, cell.period, event.target.value)}
            placeholder="as read"
            className={cx(
              'tabular w-full rounded-md border px-2 py-1 text-right text-xs outline-none transition',
              STATUS_INPUT[cell.status]
            )}
          />
        ) : null}
      </div>
    );
  };

  const currentPage = target?.page ?? null;

  const targetStatus =
    target === null
      ? 'Pick a line item to open its source'
      : target.page !== null && target.terms.length
        ? `Page ${target.page} · highlighting “${target.terms[0]}”`
        : target.page !== null
          ? `Showing page ${target.page}`
          : `Locating “${target.terms[0]}”`;

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-line bg-panel/60 p-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="rule-label">Extraction accuracy</p>
            <p className={cx('mt-1 font-display text-4xl leading-none', accuracyTone)}>
              {report.accuracy === null ? 'n/a' : formatPercent(report.accuracy * 100, 1)}
            </p>
            <p className="mt-2 max-w-md font-mono text-[0.66rem] uppercase tracking-[0.12em] text-faint">
              {report.counts.match} of {report.totalCompared} compared values match the manual grid. Correct any flagged
              cell, then recompute — the accuracy recalculates from your corrections.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-4">
            {(
              [
                ['Matched', report.counts.match, 'text-pos'],
                ['Mismatched', report.counts.mismatch, 'text-neg'],
                ['Missing', report.counts.missing, 'text-accent'],
                ['Unmatched', report.unmatched.reduce((sum, entry) => sum + entry.labels.length, 0), 'text-accentdim'],
              ] as const
            ).map(([label, value, tone]) => (
              <div key={label}>
                <dt className="rule-label">{label}</dt>
                <dd className={cx('tabular mt-0.5 text-2xl', tone)}>{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <span className="rule-label mr-1">Show</span>
          {(
            [
              ['all', `All (${report.rows.length})`],
              ['flagged', `Flagged (${flaggedRows})`],
              ['low', `Low confidence (${lowRows})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={cx(
                'rounded-full border px-3.5 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.16em] transition',
                filter === id ? 'border-accent bg-accent/10 text-accent' : 'border-line2 text-muted hover:border-accentdim hover:text-paper'
              )}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={onRecompute}
            disabled={busy}
            className={cx(
              'ml-auto rounded-full border px-5 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.18em] transition',
              busy ? 'cursor-not-allowed border-line text-faint' : 'border-accent bg-accent/10 text-accent hover:bg-accent/20'
            )}
          >
            Apply corrections &amp; recompute
          </button>
        </div>
      </div>

      {pdfUrl || sourcePages?.length ? (
        <div ref={previewRef} className="scroll-mt-24 rounded-2xl border border-line bg-panel/60 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rule-label">Source document</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => goToPage(Math.max(1, (currentPage ?? 1) - 1))}
                disabled={currentPage === null || currentPage <= 1}
                className={cx(
                  'rounded-sm border px-2 py-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] transition',
                  currentPage === null || currentPage <= 1
                    ? 'cursor-not-allowed border-line text-faint'
                    : 'border-line2 text-muted hover:border-accentdim hover:text-paper'
                )}
              >
                Prev
              </button>
              <input
                value={currentPage ?? ''}
                inputMode="numeric"
                placeholder="—"
                onChange={(event) => {
                  const parsed = Number(event.target.value.replace(/[^0-9]/g, ''));
                  if (Number.isFinite(parsed) && parsed > 0) goToPage(parsed);
                }}
                className="tabular w-16 rounded-sm border border-line bg-ink/50 px-2 py-1 text-center text-sm text-paper outline-none focus:border-accentdim"
              />
              <button
                type="button"
                onClick={() => goToPage((currentPage ?? 0) + 1)}
                className="rounded-sm border border-line2 px-2 py-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted transition hover:border-accentdim hover:text-paper"
              >
                Next
              </button>
            </div>
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-faint">{targetStatus}</span>
            <div className="ml-auto flex items-center gap-3">
              {baseline.searchablePdf && pdfUrl ? (
                <a
                  href={pdfUrl}
                  download={`${(baseline.source.filename ?? 'statements').replace(/\.[a-z0-9]+$/i, '')}-searchable.pdf`}
                  className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-accent underline-offset-2 hover:underline"
                >
                  Download searchable PDF
                </a>
              ) : null}
              {pdfUrl && target && (target.page !== null || target.terms.length) ? (
                <a
                  href={pdfFragment(pdfUrl, target)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-accent underline-offset-2 hover:underline"
                >
                  Open in new tab
                </a>
              ) : null}
            </div>
          </div>

          {sourcePage && target ? (
            <div ref={pageScrollRef} className="mt-3 max-h-[72vh] overflow-auto rounded-xl border border-line bg-ink">
              <div className="relative w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:image/jpeg;base64,${sourcePage.image}`}
                  alt={`Source page ${sourcePage.page}`}
                  onLoad={(event) => setImgSize({ w: event.currentTarget.naturalWidth, h: event.currentTarget.naturalHeight })}
                  className="block w-full"
                />
                {imgSize
                  ? highlightIdx.map((wordIndex) => {
                      const word = sourcePage.words[wordIndex];
                      if (!word) return null;
                      const left = (word.x0 / imgSize.w) * 100;
                      const top = (word.y0 / imgSize.h) * 100;
                      const width = ((word.x1 - word.x0) / imgSize.w) * 100;
                      const height = ((word.y1 - word.y0) / imgSize.h) * 100;
                      return (
                        <span
                          key={wordIndex}
                          ref={wordIndex === scrollWordIndex ? firstMarkRef : undefined}
                          className="pointer-events-none absolute rounded-[3px] bg-accent/25 ring-1 ring-accent"
                          style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
                        />
                      );
                    })
                  : null}
                {imgSize && target.terms.length && highlightIdx.length === 0 ? (
                  <p className="sticky bottom-2 mx-auto w-fit rounded-full border border-accentdim/60 bg-ink/95 px-3 py-1 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-accentdim">
                    No exact match for “{target.terms[0]}” on this page
                  </p>
                ) : null}
              </div>
            </div>
          ) : pdfUrl && target && (target.page !== null || target.terms.length) ? (
            <iframe
              key={JSON.stringify(target)}
              src={pdfFragment(pdfUrl, target)}
              title="Source PDF"
              className="mt-3 h-[70vh] w-full rounded-xl border border-line bg-ink"
            />
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-line bg-ink/30 p-6 text-center font-mono text-[0.66rem] uppercase tracking-[0.12em] text-faint">
              Select a line item’s source to jump to and highlight the figure it was read from.
            </p>
          )}
        </div>
      ) : null}

      {grouped.length === 0 ? (
        <p className="rounded-2xl border border-line bg-panel/60 p-6 text-sm text-muted">
          {filter === 'all'
            ? 'No mapped line items to verify for this document.'
            : 'Nothing matches this filter — every compared value looks correct.'}
        </p>
      ) : null}

      {grouped.map((group) => (
        <section key={group.type} className="space-y-3">
          <header className="flex items-end justify-between border-b border-line pb-2">
            <h3 className="font-display text-2xl capitalize text-paper">{group.type} statement</h3>
            <span className="rule-label">{group.rows.length} line items</span>
          </header>
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[42rem] border-collapse">
              <thead>
                <tr className="border-b border-line bg-panel/50">
                  <th className="px-4 py-3 text-left">
                    <span className="rule-label">Line item</span>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <span className="rule-label">Source</span>
                  </th>
                  {report.periods.map((period) => (
                    <th key={period} className="w-40 px-4 py-3 text-left">
                      <span className="rule-label">{period}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => {
                  const page = knownPage(row.sourceTable);
                  const clickable = page !== null && (Boolean(pdfUrl) || Boolean(sourcePages?.length));
                  const active = target !== null && target.page === page && page !== null;
                  return (
                    <tr key={`${row.type}-${row.label}-${row.sourceRow}`} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-3 align-top">
                        <span className="block text-sm text-paper">{row.label}</span>
                        {row.rawLabel.trim().toLowerCase() !== row.label.trim().toLowerCase() ? (
                          <span className="mt-0.5 block truncate font-mono text-[0.56rem] uppercase tracking-[0.1em] text-faint" title={row.rawLabel}>
                            from: {row.rawLabel}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => showSource(row)}
                            disabled={!clickable}
                            title={clickable ? `Find ${row.rawLabel || row.label} in the source PDF` : undefined}
                            className={cx('group min-w-0 text-left', clickable ? 'cursor-pointer' : 'cursor-default')}
                          >
                            <span
                              className={cx(
                                'block font-mono text-[0.6rem] uppercase tracking-[0.1em]',
                                clickable ? 'text-muted group-hover:text-accent' : 'text-muted'
                              )}
                            >
                              {row.sourceTable}
                              {row.sourceRow >= 0 ? ` · row ${row.sourceRow}` : ''}
                            </span>
                            <span className="mt-1 flex flex-wrap items-center gap-1.5">
                              {row.derived ? (
                                <span className="rounded-sm border border-line2 px-1.5 py-0.5 font-mono text-[0.52rem] uppercase tracking-[0.1em] text-faint">
                                  derived
                                </span>
                              ) : (
                                <span
                                  className={cx(
                                    'rounded-sm border px-1.5 py-0.5 font-mono text-[0.52rem] uppercase tracking-[0.1em]',
                                    row.confidence < LOW_CONFIDENCE ? 'border-accentdim/60 text-accentdim' : 'border-line2 text-faint'
                                  )}
                                >
                                  {Math.round(row.confidence * 100)}%
                                </span>
                              )}
                              {clickable ? (
                                <span
                                  className={cx(
                                    'rounded-sm border px-1.5 py-0.5 font-mono text-[0.52rem] uppercase tracking-[0.1em] transition',
                                    active
                                      ? 'border-accent bg-accent/10 text-accent'
                                      : 'border-line2 text-muted group-hover:border-accentdim group-hover:text-accent'
                                  )}
                                >
                                  {page !== null ? `show page ${page}` : 'find source'}
                                </span>
                              ) : null}
                            </span>
                          </button>
                          {pdfUrl && page !== null ? (
                            <a
                              href={pdfFragment(pdfUrl, targetForRow(row))}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`Open the source for ${row.label} in a new tab`}
                              className="shrink-0 font-mono text-[0.52rem] uppercase tracking-[0.1em] text-accent underline-offset-2 hover:underline"
                            >
                              open
                            </a>
                          ) : null}
                        </div>
                      </td>
                      {report.periods.map((_, cellIndex) => (
                        <td key={cellIndex} className="w-40 px-4 py-3 align-top">
                          {renderCell(row, cellIndex)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {report.unmatched.length ? (
        <section className="space-y-3">
          <header className="border-b border-line pb-2">
            <h3 className="font-display text-2xl text-paper">Unmatched rows</h3>
            <p className="rule-label mt-1">Rows Numera could not map to the taxonomy — add them in Manual entry if needed</p>
          </header>
          <div className="space-y-3">
            {report.unmatched.map((entry) => (
              <div key={entry.type} className="rounded-2xl border border-line bg-panel/60 p-4">
                <p className="rule-label capitalize">{entry.type} statement</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {entry.labels.map((label) => (
                    <li
                      key={label}
                      className="rounded-sm border border-line2 px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted"
                    >
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
