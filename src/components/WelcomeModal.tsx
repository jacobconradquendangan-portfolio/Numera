'use client';

import { useEffect, useState } from 'react';
import { cx } from '@/lib/format';

const STORAGE_KEY = 'numera-welcome-state';

export default function WelcomeModal() {
  const [expanded, setExpanded] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === 'minimized') setExpanded(false);
    } catch {
      setExpanded(true);
    }
    setMounted(true);
  }, []);

  const setPreference = (open: boolean) => {
    setExpanded(open);
    try {
      window.localStorage.setItem(STORAGE_KEY, open ? 'open' : 'minimized');
    } catch {
      setExpanded(open);
    }
  };

  if (!mounted) return null;

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setPreference(true)}
        aria-label="Open welcome message"
        title="Welcome to Numera"
        className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-accentdim/60 bg-panel font-display text-xl text-accent shadow-[0_12px_32px_-16px_rgba(35,33,26,0.5)] transition hover:bg-accent/10"
      >
        N
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-paper/40 p-4 backdrop-blur-sm"
      onClick={() => setPreference(false)}
    >
      <div
        className="panel w-full max-w-md rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <p className="font-display text-lg text-paper">Welcome to Numera</p>
          <button
            type="button"
            onClick={() => setPreference(false)}
            aria-label="Minimize welcome message"
            className="rounded-full p-1.5 text-faint transition hover:text-accent"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="space-y-3 px-5 py-4 text-sm leading-relaxed text-muted">
          <p>
            Audit-grade analysis of any financial statement — vertical and horizontal analysis plus the full
            CFI ratio suite, every figure backed by its formula and step-by-step solution, with each ratio
            explained so you know what it measures and how to interpret it. When you are done, download a
            text-based summary report as a PDF.
          </p>
          <ol className="space-y-1.5">
            {['Enter your figures by hand, paste text, or upload a file.', 'Run the analysis and review the data checks.', 'Switch periods and explore ratios, trends, interpretations and solutions.', 'Download a text-based summary report — for one period or all periods.'].map(
              (step, index) => (
                <li key={index} className="flex items-start gap-2.5">
                  <span className="tabular mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-accentdim text-[0.65rem] text-accent">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              )
            )}
          </ol>
          <p
            className={cx(
              'rounded-lg border border-pos/30 bg-pos/5 px-3 py-2 text-xs leading-relaxed',
              'text-pos'
            )}
          >
            Private by design — no data is gathered. Everything you enter stays on this device and is used
            only to compute your analysis.
          </p>
          <p className="text-xs leading-relaxed text-faint">
            Found a bug or have a suggestion?{' '}
            <a
              href="https://github.com/jacobconradquendangan-portfolio/Numera/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline decoration-accent/40 underline-offset-2 transition hover:text-accent/80"
            >
              Open an issue on GitHub
            </a>
            .
          </p>
        </div>
        <div className="flex justify-end px-5 pb-5">
          <button
            type="button"
            onClick={() => setPreference(false)}
            className="rounded-full border border-accent/50 bg-accent/10 px-6 py-2 font-mono text-xs uppercase tracking-[0.2em] text-accent transition hover:bg-accent/20"
          >
            Get started
          </button>
        </div>
      </div>
    </div>
  );
}
