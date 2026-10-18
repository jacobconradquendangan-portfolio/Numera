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
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
        <h2 className="font-display text-3xl text-paper">Financial health summary</h2>
        <p className="rule-label">
          Auto-generated from the computed ratios · {insights.period}
        </p>
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
          {insights.strengths} strength{insights.strengths === 1 ? '' : 's'} · {insights.watches} to watch ·{' '}
          {insights.insights.length} dimensions
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {insights.insights.map((insight) => (
          <InsightBlock key={insight.id} insight={insight} />
        ))}
      </div>

      {insights.references.length ? (
        <footer className="rounded-2xl border border-line bg-panel px-6 py-4">
          <p className="rule-label mb-2">Rules of thumb cited from</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {insights.references.map((reference) => (
              <li key={reference.url}>
                <a
                  href={reference.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent underline decoration-line2 underline-offset-4 hover:text-paper"
                >
                  {reference.label}
                </a>
              </li>
            ))}
          </ul>
        </footer>
      ) : null}
    </section>
  );
}
