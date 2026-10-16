'use client';

import { useCallback, useRef, useState } from 'react';
import AlertBanner from './AlertBanner';
import { cx } from '@/lib/format';
import { hasBlockingErrors, validateFile } from '@/lib/validation';
import type { ValidationIssue } from '@/lib/validation';

interface UploadZoneProps {
  onFile: (file: File) => void;
  busy: boolean;
  filename?: string;
}

const ACCEPT = '.pdf,.xlsx,.xls,.csv';

export default function UploadZone({ onFile, busy, filename }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      const found = validateFile(file);
      setIssues(found);
      if (!hasBlockingErrors(found)) onFile(file);
    },
    [onFile]
  );

  return (
    <details
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
      className={cx(
        'acc panel group relative overflow-hidden rounded-2xl transition-all duration-300',
        dragging ? 'glow-accent border-accent/70' : 'hover:border-line2'
      )}
      open
    >
      <summary className="flex items-center justify-between gap-4 px-6 py-5">
        <span className="flex items-center gap-3">
          <span className="chev text-accent">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span>
            <span className="block font-display text-lg text-paper">Upload file</span>
            <span className="rule-label">PDF, Excel or CSV statement</span>
          </span>
        </span>
        <span className="rule-label max-w-56 truncate">
          {filename ? `loaded: ${filename}` : 'PDF · XLSX · CSV'}
        </span>
      </summary>

      <div className="acc-body relative border-t border-line">
        <div className={cx('absolute inset-0 opacity-0 transition-opacity', dragging && 'opacity-100 stripe')} />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="relative flex w-full flex-col items-center gap-5 px-8 py-14 text-center disabled:cursor-progress"
        >
          <span
            className={cx(
              'flex h-16 w-16 items-center justify-center rounded-full border transition-all duration-300',
              dragging ? 'border-accent text-accent' : 'border-line2 text-muted group-hover:text-accent group-hover:border-accentdim'
            )}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M12 16V4m0 0L8 8m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" strokeLinecap="round" />
            </svg>
          </span>
          <span className="space-y-2">
            <span className="block font-display text-2xl leading-tight text-paper">
              {busy ? 'Crunching the numbers…' : 'Drop a financial statement here'}
            </span>
            <span className="block max-w-md font-mono text-xs uppercase tracking-[0.18em] text-faint">
              PDF · XLSX · XLS · CSV — income statement &amp; balance sheet
            </span>
          </span>
          <span
            className={cx(
              'rounded-full border px-5 py-2 font-mono text-xs uppercase tracking-[0.2em] transition',
              'border-line2 text-muted group-hover:border-accent group-hover:text-accent'
            )}
          >
            or browse files
          </span>
          {filename ? (
            <span className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-accent">
              loaded: {filename}
            </span>
          ) : null}
        </button>
        {issues.length ? (
          <div className="relative px-6 pb-6">
            <AlertBanner
              tone={hasBlockingErrors(issues) ? 'error' : 'warning'}
              title={hasBlockingErrors(issues) ? 'That file cannot be analysed' : 'Check this file'}
              items={issues.map((entry) => ({ label: entry.title, detail: entry.detail }))}
              onDismiss={() => setIssues([])}
            />
          </div>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = '';
          }}
        />
      </div>
    </details>
  );
}
