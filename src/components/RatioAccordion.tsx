'use client';

import type { RatioCategory, RatioReport, RatioResult } from '@/lib/types';
import { cx, formatCompact, formatUnitValue } from '@/lib/format';

const CATEGORY_META: Record<RatioCategory, { title: string; blurb: string }> = {
  liquidity: { title: 'Liquidity', blurb: 'Ability to meet short-term obligations' },
  profitability: { title: 'Profitability', blurb: 'Earnings generation against sales, assets & equity' },
  leverage: { title: 'Leverage', blurb: 'Capital structure and solvency risk' },
  efficiency: { title: 'Efficiency', blurb: 'How effectively assets are converted to sales' },
  valuation: { title: 'Valuation', blurb: 'Market pricing multiples' },
};

const AVAILABILITY_TONE: Record<RatioResult['availability'], string> = {
  computed: 'border-pos/40 text-pos bg-pos/5',
  partial: 'border-accent/40 text-accent bg-accent/5',
  unavailable: 'border-neg/40 text-neg bg-neg/5',
};

interface RatioHistoryPoint {
  period: string;
  display: string;
  availability: RatioResult['availability'];
}

function AvailabilityBadge({ availability }: { availability: RatioResult['availability'] }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.16em]',
        AVAILABILITY_TONE[availability]
      )}
    >
      <span className="inline-block h-1.5 w-1.5 bg-current" aria-hidden />
      {availability}
    </span>
  );
}

function splitFormula(formula: string): [string, string] {
  const index = formula.indexOf('=');
  if (index === -1) return ['', formula];
  return [formula.slice(0, index).trim(), formula.slice(index + 1).trim()];
}

function StepList({ steps }: { steps: RatioResult['steps'] }) {
  return (
    <ol className="space-y-3">
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        return (
          <li key={`${step.label}-${index}`} className="flex gap-3">
            <div className="flex flex-col items-center">
                <span
                  className={cx(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border font-mono text-[0.62rem]',
                    last ? 'border-accent bg-accent text-ink' : 'border-line2 bg-panel text-faint'
                  )}
                >
                {index + 1}
              </span>
              {!last ? <span className="mt-1 w-px flex-1 bg-line" aria-hidden /> : null}
            </div>
            <div className={cx('flex-1', last ? 'pb-0' : 'pb-1.5')}>
              <div
                className={cx(
                  'rounded-lg border px-3 py-2',
                  last ? 'border-accent/30 bg-accent/[0.05]' : 'border-line bg-ink'
                )}
              >
                <p className="rule-label mb-1">{step.label}</p>
                <p className="tabular break-words text-sm leading-relaxed text-paper">
                  {step.expression}
                  {step.value !== null ? (
                    <span className={last ? 'text-accent' : 'text-muted'}> = {formatUnitValue(step.value, step.unit)}</span>
                  ) : null}
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function RatioCard({
  ratio,
  history,
  selectedPeriod,
}: {
  ratio: RatioResult;
  history: RatioHistoryPoint[];
  selectedPeriod: string;
}) {
  const [lhs, rhs] = splitFormula(ratio.formula);

  return (
    <details className="acc panel overflow-hidden rounded-xl border-l-2 border-l-transparent transition-colors open:border-l-accentdim">
      <summary className="flex items-center gap-4 px-5 py-4 transition hover:bg-black/[0.02]">
        <span className="chev text-accent shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-[1.05rem] text-paper">{ratio.name}</span>
          <span className="mt-1.5 flex items-center gap-2.5">
            <AvailabilityBadge availability={ratio.availability} />
            <span className="rule-label hidden sm:inline">{ratio.id}</span>
          </span>
        </span>
        <span className="tabular w-24 shrink-0 text-right text-xl text-accent sm:w-28">{ratio.display}</span>
      </summary>

      <div className="acc-body space-y-6 border-t border-line px-5 py-6">
        <div className="rounded-xl border border-accent/20 bg-accent/[0.04] p-4">
          <p className="rule-label mb-2">Definition &amp; interpretation</p>
          <p className="text-[0.95rem] leading-relaxed text-paper">{ratio.description.measures}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">{ratio.description.interpretation}</p>
          <div className="mt-3 flex items-start gap-2 border-t border-accent/15 pt-3">
            <span className="rule-label shrink-0 pt-0.5 text-accent/80">Guidance</span>
            <span className="text-xs leading-relaxed text-accent/90">{ratio.description.benchmark}</span>
          </div>
        </div>

        {history.length > 1 ? (
          <div>
            <p className="rule-label mb-2">Across periods</p>
            <div className="flex flex-wrap gap-2">
              {history.map((point) => (
                <span
                  key={point.period}
                  className={cx(
                    'tabular flex items-baseline gap-2 rounded-sm border px-2.5 py-1 text-xs',
                    point.period === selectedPeriod
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-line2 text-muted'
                  )}
                >
                  <span className="font-mono text-[0.58rem] uppercase tracking-[0.14em] opacity-70">
                    {point.period}
                  </span>
                  <span>{point.display}</span>
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-x-8 gap-y-6 lg:grid-cols-2">
          <div className="space-y-5">
            <p className="rule-label border-b border-line pb-2">Method</p>
            <div>
              <p className="rule-label mb-2">Formula</p>
              <div className="rounded-xl border border-line2 bg-panel2 px-4 py-4 text-center">
                <p className="font-display text-lg leading-snug text-paper">
                  <span className="text-muted">{lhs}</span>
                  <span className="mx-2 text-accent">=</span>
                  <span>{rhs}</span>
                </p>
              </div>
            </div>
            <div>
              <p className="rule-label mb-2">Substituted values</p>
              <div className="rounded-xl border border-accent/25 bg-accent/[0.05] px-4 py-3">
                <p className="tabular text-sm leading-relaxed text-paper">{ratio.substitution}</p>
              </div>
            </div>
            <div>
              <p className="rule-label mb-2">Data lineage</p>
              <div className="overflow-hidden rounded-xl border border-line">
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

          <div className="space-y-5">
            <p className="rule-label border-b border-line pb-2">Workings</p>
            <div>
              <p className="rule-label mb-2">Step-by-step solution</p>
              <StepList steps={ratio.steps} />
            </div>
            {ratio.notes.length ? (
              <div>
                <p className="rule-label mb-2">Audit notes</p>
                <div className="space-y-2">
                  {ratio.notes.map((note, index) => (
                    <p
                      key={index}
                      className="flex items-start gap-2 rounded-lg border border-accent/25 bg-accent/[0.05] px-3 py-2 text-xs leading-relaxed text-accent"
                    >
                      <span className="mt-1.5 inline-block h-1 w-1 shrink-0 bg-accent" aria-hidden />
                      <span>{note}</span>
                    </p>
                  ))}
                </div>
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
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-3">
              <div>
                <h3 className="font-display text-2xl text-paper">{meta.title}</h3>
                <p className="rule-label mt-0.5">{meta.blurb}</p>
              </div>
              <span className="tabular rounded-sm border border-line2 px-2.5 py-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted">
                {computed}/{ratios.length} resolved
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
