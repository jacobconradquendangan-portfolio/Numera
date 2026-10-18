'use client';

import { useEffect, useMemo, useState } from 'react';
import AlertBanner from './AlertBanner';
import { cx } from '@/lib/format';
import { hasBlockingErrors, validatePastedText } from '@/lib/validation';
import { SAMPLE_TEXT } from '@/lib/sample';

interface PasteTextPanelProps {
  onAnalyze: (text: string) => void;
  busy: boolean;
  onLoadSample?: () => void;
  clearSignal?: number;
}

export default function PasteTextPanel({ onAnalyze, busy, onLoadSample, clearSignal }: PasteTextPanelProps) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (!clearSignal) return;
    setText('');
  }, [clearSignal]);

  const issues = useMemo(() => (text.trim() ? validatePastedText(text) : []), [text]);
  const blocked = hasBlockingErrors(issues);

  const canAnalyze = text.trim() !== '' && !busy && !blocked;

  const loadSample = () => {
    setText(SAMPLE_TEXT);
    onLoadSample?.();
  };

  return (
    <details className="acc panel rounded-2xl" open>
      <summary className="flex items-center justify-between gap-4 px-6 py-5">
        <span className="flex items-center gap-3">
          <span className="chev text-accent">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span>
            <span className="block font-display text-lg text-paper">Paste statement text</span>
            <span className="rule-label">Copy the numbers straight out of a PDF or document</span>
          </span>
        </span>
        <span className="rule-label">{text.trim() ? `${text.trim().length} chars` : 'empty'}</span>
      </summary>

      <div className="acc-body space-y-4 border-t border-line px-6 py-5">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setText('')}
            disabled={text === ''}
            className={cx(
              'rounded-full border px-4 py-1.5 font-mono text-[0.68rem] uppercase tracking-[0.18em] transition',
              text === ''
                ? 'cursor-not-allowed border-line text-faint/60'
                : 'border-line2 text-muted hover:border-neg hover:text-neg'
            )}
          >
            Clear
          </button>
          <button
            type="button"
            onClick={loadSample}
            className="rounded-full border border-line2 px-4 py-1.5 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-muted transition hover:border-accentdim hover:text-accent"
          >
            Load sample
          </button>
        </div>

        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          spellCheck={false}
          placeholder={'Revenues\t12,000\t11,000\nCost of revenues\t7,200\t6,600\n...'}
          className={cx(
            'tabular h-64 w-full resize-y rounded-xl border bg-ink/60 px-4 py-3 text-sm leading-relaxed text-paper outline-none transition placeholder:text-faint/70 focus:ring-2',
            blocked ? 'border-neg/60 focus:border-neg focus:ring-neg/15' : 'border-line focus:border-accentdim focus:ring-accent/15'
          )}
        />

        {issues.length ? (
          <AlertBanner
            tone={blocked ? 'error' : 'warning'}
            title={blocked ? 'This text cannot be analysed yet' : 'Check the pasted text'}
            description={
              blocked
                ? 'Add recognisable rows with figures and a period header, then try again.'
                : 'Analysis can usually continue, but these points may leave some ratios unavailable.'
            }
            items={issues.map((entry) => ({ label: entry.title, detail: entry.detail }))}
          />
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl font-mono text-[0.68rem] uppercase tracking-[0.14em] text-faint">
            Rows can be tab-separated (from a spreadsheet) or space-aligned. Paste one statement at a time, or
            separate the income statement and balance sheet with a blank line (press Enter twice).
          </p>
          <button
            type="button"
            onClick={() => onAnalyze(text)}
            disabled={!canAnalyze}
            className={cx(
              'rounded-full border px-6 py-2.5 font-mono text-xs uppercase tracking-[0.2em] transition',
              canAnalyze
                ? 'border-accent bg-accent/10 text-accent hover:bg-accent/20'
                : 'cursor-not-allowed border-line text-faint'
            )}
          >
            Analyze text
          </button>
        </div>
      </div>
    </details>
  );
}
