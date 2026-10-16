'use client';

import { useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { cx } from '@/lib/format';

export type BannerTone = 'error' | 'warning' | 'info' | 'success';

export interface BannerItem {
  label: string;
  detail?: string;
}

export interface BannerAction {
  label: string;
  onClick: () => void;
}

interface AlertBannerProps {
  tone: BannerTone;
  title: string;
  description?: string;
  items?: BannerItem[];
  action?: BannerAction;
  onDismiss?: () => void;
  defaultCollapsed?: boolean;
  className?: string;
}

const TONES: Record<
  BannerTone,
  { wrap: string; accent: string; title: string; body: string; bullet: string; button: string }
> = {
  error: {
    wrap: 'border-neg/50 bg-neg/[0.07]',
    accent: 'border-neg/40 bg-neg/10 text-neg',
    title: 'text-neg',
    body: 'text-neg/90',
    bullet: 'text-neg',
    button: 'border-neg/50 text-neg hover:bg-neg/10',
  },
  warning: {
    wrap: 'border-accent/50 bg-accent/[0.08]',
    accent: 'border-accent/40 bg-accent/10 text-accent',
    title: 'text-paper',
    body: 'text-muted',
    bullet: 'text-accent',
    button: 'border-accent/50 text-accent hover:bg-accent/10',
  },
  info: {
    wrap: 'border-line2 bg-panel2',
    accent: 'border-line2 bg-panel text-muted',
    title: 'text-paper',
    body: 'text-muted',
    bullet: 'text-accentdim',
    button: 'border-line2 text-muted hover:border-accentdim hover:text-accent',
  },
  success: {
    wrap: 'border-pos/40 bg-pos/[0.07]',
    accent: 'border-pos/40 bg-pos/10 text-pos',
    title: 'text-pos',
    body: 'text-muted',
    bullet: 'text-pos',
    button: 'border-pos/50 text-pos hover:bg-pos/10',
  },
};

const ICONS: Record<BannerTone, ReactNode> = {
  error: (
    <>
      <path d="M12 8v5" strokeLinecap="round" />
      <path d="M12 16h.01" strokeLinecap="round" />
      <circle cx="12" cy="12" r="9" />
    </>
  ),
  warning: (
    <>
      <path d="M12 9v4" strokeLinecap="round" />
      <path d="M12 16.5h.01" strokeLinecap="round" />
      <path d="M10.3 3.6 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" strokeLinejoin="round" />
    </>
  ),
  info: (
    <>
      <path d="M12 11v5" strokeLinecap="round" />
      <path d="M12 8h.01" strokeLinecap="round" />
      <circle cx="12" cy="12" r="9" />
    </>
  ),
  success: (
    <>
      <path d="m8.5 12.5 2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="9" />
    </>
  ),
};

export default function AlertBanner({
  tone,
  title,
  description,
  items,
  action,
  onDismiss,
  defaultCollapsed = false,
  className,
}: AlertBannerProps) {
  const palette = TONES[tone];
  const hasItems = Boolean(items && items.length);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const toggle = () => setCollapsed((value) => !value);
  const handleToggle = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button, a')) return;
    toggle();
  };

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      onClick={handleToggle}
      className={cx('rise flex cursor-pointer gap-4 rounded-2xl border px-5 py-4', palette.wrap, className)}
    >
      <span className={cx('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border', palette.accent)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          {ICONS[tone]}
        </svg>
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className={cx('font-display text-lg leading-tight', palette.title)}>{title}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Expand' : 'Minimize'}
              className={cx('rounded-full p-1 transition', palette.body, 'hover:opacity-70')}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={cx('transition-transform duration-200', collapsed ? 'rotate-0' : 'rotate-180')}
              >
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {action ? (
              <button type="button" onClick={action.onClick} className={cx('rounded-full border px-3.5 py-1 font-mono text-[0.62rem] uppercase tracking-[0.16em] transition', palette.button)}>
                {action.label}
              </button>
            ) : null}
            {onDismiss ? (
              <button type="button" onClick={onDismiss} aria-label="Dismiss" className={cx('rounded-full p-1 transition', palette.body, 'hover:opacity-70')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            ) : null}
          </div>
        </div>

        {!collapsed && description ? <p className={cx('mt-1 text-sm leading-relaxed', palette.body)}>{description}</p> : null}

        {!collapsed && hasItems ? (
          <ul className={cx('mt-3 space-y-2', items!.length > 6 ? 'max-h-48 overflow-y-auto pr-1' : '')}>
            {items!.map((item, index) => (
              <li key={index} className="flex gap-3 text-sm leading-relaxed">
                <span className={cx('select-none', palette.bullet)}>—</span>
                <span className="min-w-0">
                  <span className="text-paper">{item.label}</span>
                  {item.detail ? <span className={cx('ml-1', palette.body)}>{item.detail}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
