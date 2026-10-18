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

function InsightBlock({ insight }: { insight: Insight }) {
  return (
    <div className="rounded-xl border border-line bg-ink/40 px-4 py-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <span className={cx('h-2 w-2 rounded-full', TONE_DOT[insight.tone])} />
          <span className="font-display text-base text-paper">{insight.title}</span>
        </span>
        <span
          className={cx(
            'rounded-full border px-2.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-[0.16em]',
            TONE_BADGE[insight.tone]
          )}
        >
          {TONE_LABEL[insight.tone]}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-muted">{insight.summary}</p>
      {insight.points.length ? (
        <ul className="mt-3 space-y-1.5">
          {insight.points.map((entry, index) => (
            <li key={`${insight.id}-${index}`} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-faint">{entry.label}</span>
              <span className="tabular text-sm text-paper">{entry.value}</span>
              <span className="w-full text-xs leading-snug text-faint/80">{entry.note}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function InsightsPanel({ insights }: InsightsPanelProps) {
  if (!insights || !insights.insights.length) return null;

  const verdictTone: InsightTone = insights.tone;

  return (
    <section className="rise space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-2 border-b border-line pb-3">
        <div>
          <h2 className="font-display text-3xl text-paper">Financial health summary</h2>
          <p className="rule-label mt-1">Auto-generated from the computed ratios</p>
        </div>
        <span className="tabular rounded-sm border border-line2 px-2.5 py-1 text-[0.7rem] text-muted">
          Period {insights.period}
        </span>
      </header>

      <div
        className={cx(
          'rounded-2xl border px-6 py-4',
          verdictTone === 'positive' && 'border-pos/40 bg-pos/5',
          verdictTone === 'watch' && 'border-neg/40 bg-neg/5',
          verdictTone === 'neutral' && 'border-line bg-panel'
        )}
      >
        <p className="text-sm leading-relaxed text-paper sm:text-base">{insights.verdict}</p>
        <p className="rule-label mt-1">
          {insights.strengths} strength{insights.strengths === 1 ? '' : 's'} · {insights.watches} to watch
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {insights.insights.map((insight) => (
          <InsightBlock key={insight.id} insight={insight} />
        ))}
      </div>

      {insights.references.length ? (
        <footer className="rounded-2xl border border-line bg-panel px-6 py-5">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <p className="rule-label">Sources</p>
            <p className="font-body text-[0.78rem] italic leading-snug text-faint">
              Corporate Finance Institute · {insights.referenceNote}
            </p>
          </div>
          <ol className="flex flex-col gap-2">
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
        </footer>
      ) : null}
    </section>
  );
}
