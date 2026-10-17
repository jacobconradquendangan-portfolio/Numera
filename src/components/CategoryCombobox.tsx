'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/lib/format';
import type { CategoryOption } from '@/lib/types';

interface CategoryComboboxProps {
  value: string;
  options: CategoryOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

interface Anchor {
  top: number;
  bottom: number;
  left: number;
  width: number;
}

export default function CategoryCombobox({ value, options, onChange, placeholder, className }: CategoryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const filtered = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(query) ||
        option.key.toLowerCase().includes(query) ||
        option.section.toLowerCase().includes(query)
    );
  }, [options, value]);

  const matched = useMemo(
    () => options.find((option) => option.label.toLowerCase() === value.trim().toLowerCase()),
    [options, value]
  );

  useEffect(() => {
    setActive(0);
  }, [value, open]);

  const measure = () => {
    const element = inputRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    setAnchor({ top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width });
  };

  const openList = () => {
    measure();
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handleScroll = (event: Event) => {
      const target = event.target as Node | null;
      if (target && listRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleResize = () => measure();
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [open]);

  const select = (option: CategoryOption) => {
    onChange(option.label);
    setOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) openList();
      else setActive((index) => Math.min(index + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      if (open && filtered[active]) {
        event.preventDefault();
        select(filtered[active]);
      } else {
        setOpen(false);
      }
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      setOpen(false);
    }
  };

  const dropdown =
    open && anchor && typeof document !== 'undefined'
      ? createPortal(
          (() => {
            const viewport = window.innerHeight;
            const spaceBelow = viewport - anchor.bottom - 10;
            const spaceAbove = anchor.top - 10;
            const flipUp = spaceBelow < 220 && spaceAbove > spaceBelow;
            return (
              <div
                ref={listRef}
                role="listbox"
                id={listboxId}
                style={{
                  left: anchor.left,
                  width: anchor.width,
                  maxHeight: Math.max(160, Math.min(300, flipUp ? spaceAbove : spaceBelow)),
                  ...(flipUp ? { bottom: viewport - anchor.top + 6 } : { top: anchor.bottom + 6 }),
                }}
                className="fixed z-50 overflow-y-auto rounded-xl border border-line bg-panel py-1 shadow-[0_20px_55px_-26px_rgba(35,33,26,0.6)]"
              >
                {filtered.length ? (
                  filtered.map((option, index) => (
                    <button
                      key={option.key}
                      type="button"
                      role="option"
                      aria-selected={index === active}
                      onMouseEnter={() => setActive(index)}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        select(option);
                      }}
                      className={cx(
                        'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition',
                        index === active ? 'bg-accent/10 text-accent' : 'text-paper hover:bg-panel2'
                      )}
                    >
                      <span className="min-w-0 truncate">{option.label}</span>
                      <span className="shrink-0 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-faint">
                        {option.section}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-3 text-sm text-muted">
                    No match for “{value.trim()}”. Keep typing, clear to browse, or leave it as a custom line.
                  </p>
                )}
              </div>
            );
          })(),
          document.body
        )
      : null;

  return (
    <div ref={wrapRef} className="relative">
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          if (!open) openList();
        }}
        onFocus={openList}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        className={cx(className, 'pr-14')}
      />
      <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
        {matched ? (
          <span className="p-1 text-pos" aria-hidden title={`Matched category: ${matched.section}`}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="m5 12.5 4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        ) : null}
        {value ? (
          <button
            type="button"
            aria-label="Clear line item"
            onClick={() => {
              onChange('');
              openList();
              inputRef.current?.focus();
            }}
            className="rounded-full p-1 text-faint transition hover:text-neg"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
        <button
          type="button"
          aria-label={open ? 'Hide categories' : 'Browse categories'}
          onClick={() => {
            if (open) setOpen(false);
            else {
              openList();
              inputRef.current?.focus();
            }
          }}
          className="rounded-full p-1 text-faint transition hover:text-accent"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={cx('transition-transform duration-200', open ? 'rotate-180' : 'rotate-0')}
          >
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {dropdown}
    </div>
  );
}
