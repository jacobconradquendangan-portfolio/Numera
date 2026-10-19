'use client';

import { useEffect, useState } from 'react';
import type { AnalyzeProgressStage } from '@/lib/analyze-stream';
import { cx } from '@/lib/format';

export interface AnalysisProgressState {
  stage: AnalyzeProgressStage;
  page?: number;
  total?: number;
  startedAt: number;
}

interface AnalysisProgressProps {
  progress: AnalysisProgressState;
  onCancel?: () => void;
  className?: string;
}

function stageLabel(progress: AnalysisProgressState): string {
  switch (progress.stage) {
    case 'uploading':
      return 'Uploading document';
    case 'reading':
      return 'Reading document structure';
    case 'ocr-init':
      return progress.total ? `Preparing OCR engine (${progress.total} scanned pages)` : 'Preparing OCR engine';
    case 'ocr':
      if (progress.page && progress.total) return `Reading scanned page ${progress.page} of ${progress.total}`;
      return 'Reading scanned pages';
    case 'computing':
      return 'Computing ratios and analysis';
    default:
      return 'Analysing';
  }
}

function stagePercent(progress: AnalysisProgressState): number | null {
  switch (progress.stage) {
    case 'uploading':
      return null;
    case 'reading':
      return 10;
    case 'ocr-init':
      return 12;
    case 'ocr': {
      if (!progress.page || !progress.total) return 20;
      const ratio = Math.min(1, Math.max(0, progress.page / progress.total));
      return Math.min(85, Math.round(12 + ratio * 73));
    }
    case 'computing':
      return 92;
    default:
      return null;
  }
}

export default function AnalysisProgress({ progress, onCancel, className }: AnalysisProgressProps) {
  const [elapsed, setElapsed] = useState(() => Math.max(0, Date.now() - progress.startedAt));

  useEffect(() => {
    setElapsed(Math.max(0, Date.now() - progress.startedAt));
    const timer = window.setInterval(() => {
      setElapsed(Math.max(0, Date.now() - progress.startedAt));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [progress.startedAt]);

  const percent = stagePercent(progress);
  const label = stageLabel(progress);
  const showOcrHint = progress.stage === 'ocr' || progress.stage === 'ocr-init';

  return (
    <div className={cx('rise rounded-2xl border border-line bg-panel px-5 py-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent" aria-hidden="true" />
          <p className="font-display text-lg leading-tight text-paper">{label}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="tabular text-xs text-faint">{Math.round(elapsed / 1000)}s elapsed</span>
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-line2 px-3.5 py-1 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted transition hover:border-accentdim hover:text-accent"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>

      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        aria-valuetext={percent === null ? label : `${label}, ${percent}%`}
        className="mt-3 h-2 w-full overflow-hidden rounded-full border border-line bg-panel2"
      >
        <div
          className={cx(
            'h-full rounded-full bg-accent transition-[width] duration-500 ease-out',
            percent === null ? 'w-full animate-pulse opacity-40' : ''
          )}
          style={percent === null ? undefined : { width: `${percent}%` }}
        />
      </div>

      {showOcrHint ? (
        <p className="mt-2 text-xs leading-relaxed text-faint">
          Scanned PDFs run OCR page by page and can take 30–60 seconds on a cold start. Keep this tab open.
        </p>
      ) : null}
    </div>
  );
}
