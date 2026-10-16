'use client';

import type { RatioCategory, RatioReport, RatioResult } from '@/lib/types';
import { cx, formatCompact } from '@/lib/format';

const CATEGORY_META: Record<RatioCategory, { title: string; index: string; blurb: string }> = {
  liquidity: { title: 'Liquidity', index: '01', blurb: 'Ability to meet short-term obligations' },
  profitability: { title: 'Profitability', index: '02', blurb: 'Earnings generation against sales, assets & equity' },
  leverage: { title: 'Leverage', index: '03', blurb: 'Capital structure and solvency risk' },
  efficiency: { title: 'Efficiency', index: '04', blurb: 'How effectively assets are converted to sales' },
  valuation: { title: 'Valuation', index: '05', blurb: 'Market pricing multiples' },
};

const AVAILABILITY_TONE: Record<RatioResult['availability'], string> = {
  computed: 'border-pos/40 text-pos bg-pos/5',
  partial: 'border-accent/40 text-accent bg-accent/5',
  unavailable: 'border-neg/40 text-neg bg-neg/5',
};

function AvailabilityBadge({ availability }: { availability: RatioResult['availability'] }) {
  return (
    <span
      className={cx(
        'rounded-full border px-2.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.16em]',
        AVAILABILITY_TONE[availability]
      )}
    >
      {availability}
    </span>
  );
}

interface RatioHistoryPoint {
  period: string;
  display: string;
  availability: RatioResult['availability'];
}

function RatioCard({ ratio, history, selectedPeriod }: { ratio: RatioResult; history: RatioHistoryPoint[]; selectedPeriod: string }) {
  return (
    <details className="acc panel group/card overflow-hidden rounded-xl">
      <summary className="flex items-center gap-4 px-5 py-4 transition hover:bg-black/[0.02]">
        <span className="chev text-accent shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-base text-paper">{ratio.name}</span>
          <span className="rule-label">{ratio.id}</span>
        </span>
        <span className="hidden sm:block">
          <AvailabilityBadge availability={ratio.availability} />
        </span>
        <span className="tabular w-28 shrink-0 text-right text-xl text-accent">{ratio.display}</span>
      </summary>

      <div className="acc-body border-t border-line px-5 py-5">
        {history.length > 1 ? (
          <div className="mb-5">
            <p className="rule-label mb-2">Across periods</p>
            <div className="flex flex-wrap gap-2">
              {history.map((point) => (
                <span
                  key={point.period}
                  className={cx(
                    'tabular rounded-full border px-3 py-1 text-xs',
                    point.period === selectedPeriod
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-line2 text-muted'
                  )}
                >
                  {point.period} · {point.display}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <div>
              <p className="rule-label mb-2">Formula</p>
              <p className="tabular rounded-lg border border-line bg-ink px-3 py-2.5 text-sm leading-relaxed text-paper">
                {ratio.formula}
              </p>
            </div>
            <div>
              <p className="rule-label mb-2">Substituted values</p>
              <p className="tabular rounded-lg border border-line bg-ink px-3 py-2.5 text-sm leading-relaxed text-muted">
                {ratio.substitution}
              </p>
            </div>
            <div>
              <p className="rule-label mb-2">Data lineage</p>
              <div className="overflow-hidden rounded-lg border border-line">
                <table className="w-full text-left text-xs">
                  <thead className="bg-panel2">
                    <tr>
                      <th className="rule-label px-3 py-2 font-normal">Concept</th>
                      <th className="rule-label px-3 py-2 text-right font-normal">Value</th>
                      <th className="rule-label px-3 py-2 font-normal">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ratio.inputs.map((input, index) => (
                      <tr key={`${input.key}-${index}`} className="border-t border-line/60">
                        <td className="px-3 py-2 text-paper">{input.label}</td>
                        <td className="tabular px-3 py-2 text-right text-paper">{formatCompact(input.value)}</td>
                        <td className="px-3 py-2 font-mono text-[0.68rem] leading-snug text-faint">{input.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="rule-label mb-2">Step-by-step solution</p>
              <ol className="space-y-2">
                {ratio.steps.map((step, index) => (
                  <li key={`${step.label}-${index}`} className="flex items-start gap-3 rounded-lg border border-line bg-ink px-3 py-2.5">
                    <span className="tabular mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-accentdim text-[0.65rem] text-accent">
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm text-muted">{step.label}</span>
                      <span className="tabular block break-words text-sm text-paper">
                        {step.expression}
                        {step.value !== null ? <span className="text-accent"> = {formatCompact(step.value)}</span> : null}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            {ratio.notes.length ? (
              <div className="space-y-2">
                <p className="rule-label mb-1">Audit notes</p>
                {ratio.notes.map((note, index) => (
                  <p
                    key={index}
                    className="rounded-lg border border-accent/25 bg-accent/5 px-3 py-2 text-xs leading-relaxed text-accent"
                  >
                    {note}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </details>
  );
}

export default function RatioAccordion({ reports, selectedPeriod }: { reports: RatioReport[]; selectedPeriod: string }) {
  const categories: RatioCategory[] = ['liquidity', 'profitability', 'leverage', 'efficiency', 'valuation'];
  const selected = reports.find((report) => report.period === selectedPeriod) ?? reports[reports.length - 1];
  if (!selected) return null;
  const historyById = new Map<string, RatioHistoryPoint[]>();
  for (const report of reports) {
    for (const ratio of report.ratios) {
      const points = historyById.get(ratio.id) ?? [];
      points.push({ period: report.period, display: ratio.display, availability: ratio.availability });
      historyById.set(ratio.id, points);
    }
  }
  return (
    <div className="space-y-10">
      {categories.map((category) => {
        const ratios = selected.byCategory[category];
        if (!ratios.length) return null;
        const meta = CATEGORY_META[category];
        const computed = ratios.filter((ratio) => ratio.availability !== 'unavailable').length;
        return (
          <section key={category} className="rise space-y-4">
            <div className="flex items-end justify-between gap-4 border-b border-line pb-3">
              <div className="flex items-baseline gap-4">
                <span className="font-display text-3xl text-accentdim">{meta.index}</span>
                <div>
                  <h3 className="font-display text-2xl text-paper">{meta.title}</h3>
                  <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-faint">{meta.blurb}</p>
                </div>
              </div>
              <span className="tabular hidden text-xs text-muted sm:block">
                {computed}/{ratios.length} resolved · {selected.period}
              </span>
            </div>
            <div className="space-y-3">
              {ratios.map((ratio) => (
                <RatioCard
                  key={ratio.id}
                  ratio={ratio}
                  history={historyById.get(ratio.id) ?? []}
                  selectedPeriod={selected.period}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
