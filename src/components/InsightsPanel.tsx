'use client';

import { cx } from '@/lib/format';
import type { Insight, InsightReport, InsightTone } from '@/lib/insights';

interface InsightsPanelProps {
  insights: InsightReport | null;
}

const TONE_LABEL: Record<InsightTone, string> = {
  positive: 'Strengths',
  neutral: 'Neutral',
  watch: 'Watch',
};

const TONE_DOT: Record<InsightTone, string> = {
  positive: 'bg-pos',
  neutral: 'bg-accentdim',
  watch: 'bg-neg',
};

const TONE_BADGE: Record<InsightTone, string> = {
  positive: 'border-pos/40 text-pos',
  neutral: 'border-line2 text-muted',
  watch: 'border-neg/40 text-neg',
};

const TONE_BORDER: Record<InsightTone, string> = {
  positive: 'border-l-pos',
  neutral: 'border-l-line2',
  watch: 'border-l-neg',
};

const GROUP_ORDER: InsightTone[] = ['positive', 'watch', 'neutral'];

const GROUP_META: Record<InsightTone, { label: string; accent: string }> = {
  positive: { label: 'Strengths', accent: 'text-pos' },
  watch: { label: 'Watch', accent: 'text-neg' },
  neutral: { label: 'Neutral', accent: 'text-muted' },
};

function LedgerCard({ insight }: { insight: Insight }) {
  return (
    <details className={cx('acc rounded-xl border border-line border-l-2 bg-ink/40', TONE_BORDER[insight.tone])}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <span className="flex min-w-0 items-center gap-2">
          <span className={cx('h-2 w-2 shrink-0 rounded-full', TONE_DOT[insight.tone])} />
          <span className="truncate font-display text-base text-paper">{insight.title}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span
            className={cx(
              'rounded-full border px-2.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-[0.16em]',
              TONE_BADGE[insight.tone]
            )}
          >
            {TONE_LABEL[insight.tone]}
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="chev text-faint" aria-hidden>
            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </summary>
      <div className="acc-body px-4 pb-4">
        <p className="max-w-[62ch] text-sm leading-relaxed text-muted">{insight.summary}</p>
        {insight.points.length ? (
          <ul className="mt-3 border-t border-line/70 pt-1">
            {insight.points.map((entry, index) => (
              <li
                key={`${insight.id}-${index}`}
                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-line/60 py-1.5 last:border-b-0"
              >
                <span className="font-mono text-[0.66rem] uppercase tracking-[0.1em] text-faint">{entry.label}</span>
                <span className="tabular font-mono text-sm text-paper">{entry.value}</span>
                {entry.note ? (
                  <span className="w-full text-xs leading-snug text-faint/80">{entry.note}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        </div>
    </details>
  );
}

export default function InsightsPanel({ insights }: InsightsPanelProps) {
  if (!insights || !insights.insights.length) return null;

  const verdictTone: InsightTone = insights.tone;
  const neutralCount = Math.max(insights.insights.length - insights.strengths - insights.watches, 0);
  const total = insights.insights.length || 1;
  const gauge = [
    { key: 'pos', width: (insights.strengths / total) * 100, color: 'bg-pos' },
    { key: 'neg', width: (insights.watches / total) * 100, color: 'bg-neg' },
    { key: 'flat', width: (neutralCount / total) * 100, color: 'bg-line2' },
  ];
  const groups = GROUP_ORDER.map((tone) => ({
    tone,
    items: insights.insights.filter((insight) => insight.tone === tone),
  })).filter((group) => group.items.length);

  return (
    <section className="rise space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-2 border-b border-line pb-3">
        <div>
          <h2 className="font-display text-3xl text-paper">Financial health summary</h2>
          <p className="rule-label mt-1">Auto-generated from the computed ratios</p>
        </div>
        <span className="tabular rounded-sm border border-line2 px-2.5 py-1 text-[0.7rem] text-muted">
          Period {insights.period}
        </span>
      </header>

      <div className="rounded-2xl border border-line bg-panel px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
          <div className="min-w-0 flex-1">
            <p
              className={cx(
                'font-display text-2xl leading-snug sm:text-[1.7rem]',
                verdictTone === 'positive' && 'text-pos',
                verdictTone === 'watch' && 'text-neg',
                verdictTone === 'neutral' && 'text-paper'
              )}
            >
              {insights.verdict}
            </p>
            <p className="rule-label mt-2">read across the eight CFI domains below</p>
          </div>

          <div className="w-full shrink-0 sm:w-auto sm:max-w-[18rem]">
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-line" role="img" aria-label={`${insights.strengths} strengths, ${insights.watches} to watch, ${neutralCount} neutral`}>
              {gauge.map((segment) => (
                <span
                  key={segment.key}
                  className={cx('block', segment.color)}
                  style={{ width: `${segment.width}%` }}
                  aria-hidden
                />
              ))}
            </div>
            <dl className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1">
              {[
                { label: 'Strengths', count: insights.strengths, color: 'text-pos' },
                { label: 'Watch', count: insights.watches, color: 'text-neg' },
                { label: 'Neutral', count: neutralCount, color: 'text-muted' },
              ].map((entry) => (
                <div key={entry.label} className="flex items-baseline gap-2">
                  <dd className={cx('tabular font-mono text-lg leading-none', entry.color)}>
                    {entry.count}
                  </dd>
                  <dt className="rule-label">{entry.label}</dt>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        {groups.map((group) => (
          <section key={group.tone} aria-label={GROUP_META[group.tone].label} className="min-w-0">
            <div className="mb-3 flex items-center gap-2.5">
              <span className={cx('rule-label whitespace-nowrap', GROUP_META[group.tone].accent)}>
                {GROUP_META[group.tone].label}
              </span>
              <span className="tabular rounded-sm border border-line bg-panel2/60 px-1.5 py-0.5 font-mono text-[0.6rem] leading-none text-muted">
                {group.items.length}
              </span>
              <span className="h-px w-full bg-line" aria-hidden />
            </div>
            <div className="flex flex-col gap-3">
              {group.items.map((insight) => (
                <LedgerCard key={insight.id} insight={insight} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {insights.references.length ? (
        <details className="acc rounded-2xl border border-line bg-panel px-6 py-4">
          <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-x-6 gap-y-1 outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <span className="flex items-center gap-2">
              <span className="rule-label">Sources</span>
              <span className="tabular rounded-sm border border-line bg-panel2/60 px-1.5 py-0.5 font-mono text-[0.6rem] text-muted">
                {insights.references.length}
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="chev text-faint" aria-hidden>
                <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="font-body text-[0.78rem] italic leading-snug text-faint">
              Corporate Finance Institute · {insights.referenceNote}
            </span>
          </summary>
          <ol className="acc-body mt-4 flex flex-col gap-2 border-t border-line/70 pt-4">
            {insights.references.map((reference, index) => {
              const path = reference.url.replace(/^https:\/\//, '');
              return (
                <li key={reference.url} className="flex min-w-0 items-baseline gap-3">
                  <span className="w-4 shrink-0 text-right font-mono text-[0.6rem] text-faint">{index + 1}</span>
                  <a
                    href={reference.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex min-w-0 flex-1 items-baseline gap-2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <span className="shrink-0 font-body text-[0.84rem] text-paper transition-colors group-hover:text-accent group-focus-visible:text-accent">
                      {reference.title}
                    </span>
                    <span aria-hidden className="hidden min-w-6 flex-1 translate-y-[-3px] border-b border-dotted border-line2 sm:block" />
                    <span className="hidden shrink-0 truncate font-mono text-[0.6rem] text-faint transition-colors group-hover:text-accent group-focus-visible:text-accent max-w-[15rem] lg:max-w-xs sm:block">
                      {path}
                    </span>
                  </a>
                </li>
              );
            })}
          </ol>
        </details>
      ) : null}
    </section>
  );
}
