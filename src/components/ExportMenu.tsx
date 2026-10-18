'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReportScope } from '@/lib/report';
import { cx } from '@/lib/format';

interface ExportMenuProps {
  periods: string[];
  selectedPeriod: string;
  onPrint: (scope: ReportScope) => void;
}

function scopeSummary(periods: string[]): string {
  if (!periods.length) return 'No periods detected';
  if (periods.length === 1) return periods[0];
  return `${periods[0]} – ${periods[periods.length - 1]} (${periods.length} periods)`;
}

export default function ExportMenu({ periods, selectedPeriod, onPrint }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cx(
          'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 py-1.5 font-mono text-[0.7rem] uppercase tracking-[0.16em] transition',
          open
            ? 'border-accent bg-accent/10 text-accent'
            : 'border-line2 text-muted hover:border-accentdim hover:text-paper'
        )}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Download summary
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Download summary"
          className="absolute right-0 z-30 mt-2 w-72 overflow-hidden rounded-xl border border-line bg-panel shadow-[0_18px_48px_-24px_rgba(35,33,26,0.55)]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onPrint('selected');
            }}
            className="block w-full border-b border-line/70 px-4 py-3 text-left transition hover:bg-accent/5"
          >
            <span className="block font-display text-sm text-paper">This period</span>
            <span className="tabular mt-0.5 block text-[0.68rem] text-faint">
              {selectedPeriod || 'No period selected'}
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onPrint('all');
            }}
            className="block w-full px-4 py-3 text-left transition hover:bg-accent/5"
          >
            <span className="block font-display text-sm text-paper">All periods</span>
            <span className="tabular mt-0.5 block text-[0.68rem] text-faint">{scopeSummary(periods)}</span>
          </button>
          <p className="border-t border-line/70 bg-panel2 px-4 py-2 text-[0.62rem] leading-relaxed text-faint">
            Opens your browser print dialog — choose “Save as PDF” to download the text-based summary report.
          </p>
        </div>
      ) : null}
    </div>
  );
}
