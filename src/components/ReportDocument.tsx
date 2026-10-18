'use client';

import type { AnalyzeSuccess, DayCountBasis } from '@/lib/types';
import { buildReport, type ReportModel, type ReportScope, type ReportTable } from '@/lib/report';
import { cx } from '@/lib/format';

interface ReportDocumentProps {
  result: AnalyzeSuccess;
  scope: ReportScope;
  selectedPeriod: string;
  filename?: string;
  dayCountBasis: DayCountBasis;
}

function alignClass(align: ('left' | 'right')[] | undefined, index: number): string {
  return (align?.[index] ?? 'right') === 'left' ? 'text-left' : 'text-right';
}

function Section({
  index,
  title,
  subtitle,
  children,
}: {
  index: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-7">
      <div className="mb-3 flex items-baseline gap-3 border-b-2 border-accentdim pb-1.5">
        <span className="font-mono text-xs text-accent">{index}</span>
        <h2 className="font-display text-lg text-paper">{title}</h2>
        {subtitle ? <span className="rule-label ml-auto">{subtitle}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Table({ table }: { table: ReportTable }) {
  return (
    <div className="overflow-hidden rounded-md border border-line">
      <table className="w-full border-collapse text-left text-[0.72rem]">
        <thead>
          <tr className="bg-panel2">
            {table.columns.map((column, index) => (
              <th
                key={`${column}-${index}`}
                className={cx('rule-label px-2.5 py-1.5', index === 0 ? 'text-left' : alignClass(table.align, index - 1))}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={`${row.label}-${rowIndex}`} className="border-t border-line/60">
              <td className="px-2.5 py-1.5 text-paper">{row.label}</td>
              {row.cells.map((cell, cellIndex) => (
                <td key={cellIndex} className={cx('tabular px-2.5 py-1.5 text-paper', alignClass(table.align, cellIndex))}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Field({ term, value, mono }: { term: string; value: string; mono?: boolean }) {
  return (
    <p className="text-[0.72rem] leading-relaxed">
      <span className="rule-label mr-2">{term}</span>
      <span className={cx('text-paper', mono && 'tabular')}>{value}</span>
    </p>
  );
}

function RatioEntry({ ratio }: { ratio: ReportModel['ratioPeriods'][number]['categories'][number]['ratios'][number] }) {
  return (
    <div className="break-inside-avoid rounded-md border border-line px-3 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="font-display text-[0.9rem] text-paper">{ratio.name}</p>
        <p className="tabular text-[0.9rem] text-accent">{ratio.display}</p>
      </div>
      <p className="rule-label mt-0.5">{ratio.availability}</p>

      <div className="mt-2 space-y-1">
        <Field term="Formula" value={ratio.formula} mono />
        <Field term="Substituted" value={ratio.substitution} mono />
      </div>

      {ratio.steps.length ? (
        <div className="mt-2">
          <p className="rule-label mb-1">Solution</p>
          <ol className="space-y-0.5">
            {ratio.steps.map((step, index) => (
              <li key={`${step.label}-${index}`} className="flex gap-2 text-[0.72rem] leading-relaxed">
                <span className="tabular text-faint">{index + 1}.</span>
                <span className="tabular text-paper">
                  {step.label}: {step.expression}
                  {step.value !== null ? ` = ${step.value}` : ''}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {ratio.inputs.length ? (
        <div className="mt-2">
          <p className="rule-label mb-1">Source line items</p>
          <ul className="space-y-0.5">
            {ratio.inputs.map((input, index) => (
              <li key={`${input.label}-${index}`} className="flex flex-wrap gap-x-2 text-[0.72rem] leading-relaxed">
                <span className="text-paper">{input.label}</span>
                <span className="tabular text-paper">= {input.value}</span>
                <span className="font-mono text-[0.64rem] text-faint">{input.source}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-2 space-y-1 border-t border-line/60 pt-2">
        <Field term="Measures" value={ratio.measures} />
        <Field term="Interpretation" value={ratio.interpretation} />
        <Field term="Guidance" value={ratio.guidance} />
      </div>

      {ratio.notes.length ? (
        <ul className="mt-1.5 space-y-0.5">
          {ratio.notes.map((note, index) => (
            <li key={index} className="text-[0.7rem] leading-relaxed text-muted">
              · {note}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function ReportDocument({ result, scope, selectedPeriod, filename, dayCountBasis }: ReportDocumentProps) {
  const report = buildReport(result, { scope, selectedPeriod, dayCountBasis, filename });

  return (
    <article className="hidden print:block">
      <header className="border-b-2 border-accentdim pb-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="font-display text-2xl text-paper">Numera</p>
            <p className="rule-label mt-1">Financial Statement Analyzer · Audited summary report</p>
          </div>
          <p className="tabular text-xs text-faint">Generated {report.meta.generatedAt}</p>
        </div>
        <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-1.5 sm:grid-cols-2">
          {report.meta.lines.map((line) => (
            <div key={line.label} className="flex items-baseline gap-3 border-b border-line/70 pb-1">
              <dt className="rule-label shrink-0">{line.label}</dt>
              <dd className="ml-auto text-right text-xs text-paper">{line.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <Section index="01" title="Overview" subtitle={`${report.periods.length} period${report.periods.length === 1 ? '' : 's'}`}>
        <Table table={report.overview} />
        <div className="mt-3 space-y-1.5">
          {report.integrity.map((entry) => (
            <p key={entry.period} className="text-[0.72rem] leading-relaxed">
              <span className="rule-label mr-2">Balance sheet {entry.period}</span>
              <span className={cx('mr-2', entry.balanced ? 'text-pos' : 'text-neg')}>{entry.status}</span>
              <span className="tabular text-paper">{entry.equation}</span>
              <span className="tabular text-faint">
                {' '}
                · Δ {entry.difference} · tol {entry.tolerance}
              </span>
            </p>
          ))}
        </div>
      </Section>

      {report.insights && report.insights.insights.length ? (
        <Section
          index="02"
          title="Financial health summary"
          subtitle={`auto-generated · ${report.insights.period}`}
        >
          <p className="mb-3 text-[0.78rem] leading-relaxed text-paper">{report.insights.verdict}</p>
          <div className="space-y-3">
            {report.insights.insights.map((insight) => (
              <div key={insight.id} className="rounded-lg border border-line px-4 py-3">
                <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-display text-sm text-paper">{insight.title}</span>
                  <span
                    className={cx(
                      'font-mono text-[0.55rem] uppercase tracking-[0.16em]',
                      insight.tone === 'positive' && 'text-pos',
                      insight.tone === 'watch' && 'text-neg',
                      insight.tone === 'neutral' && 'text-faint'
                    )}
                  >
                    {insight.tone === 'positive' ? 'Strengths' : insight.tone === 'watch' ? 'Watch' : 'Neutral'}
                  </span>
                </div>
                <p className="text-[0.72rem] leading-relaxed text-muted">{insight.summary}</p>
                {insight.points.length ? (
                  <ul className="mt-2 space-y-1">
                    {insight.points.map((entry, index) => (
                      <li key={`${insight.id}-${index}`} className="text-[0.68rem] leading-snug">
                        <span className="tabular text-paper">{entry.value}</span>
                        <span className="ml-2 text-faint">{entry.label}</span>
                        <span className="ml-2 text-faint/80">{entry.note}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {report.incomeVertical || report.balanceVertical || report.cashflowVertical ? (
        <Section index="03" title="Vertical analysis" subtitle="percent of base">
          {report.incomeVertical ? (
            <div className="mb-4">
              <p className="rule-label mb-1.5">Income statement · percent of revenue</p>
              <Table table={report.incomeVertical} />
            </div>
          ) : null}
          {report.balanceVertical ? (
            <div className={report.cashflowVertical ? 'mb-4' : undefined}>
              <p className="rule-label mb-1.5">Balance sheet · percent of total assets</p>
              <Table table={report.balanceVertical} />
            </div>
          ) : null}
          {report.cashflowVertical ? (
            <div>
              <p className="rule-label mb-1.5">Cash flow statement · percent of operating cash flow</p>
              <Table table={report.cashflowVertical} />
            </div>
          ) : null}
        </Section>
      ) : null}

      {report.incomeHorizontal || report.balanceHorizontal || report.cashflowHorizontal ? (
        <Section index="04" title="Horizontal analysis" subtitle="period-over-period change">
          {report.incomeHorizontal ? (
            <div className="mb-4">
              <p className="rule-label mb-1.5">Income statement</p>
              <Table table={report.incomeHorizontal} />
            </div>
          ) : null}
          {report.balanceHorizontal ? (
            <div className={report.cashflowHorizontal ? 'mb-4' : undefined}>
              <p className="rule-label mb-1.5">Balance sheet</p>
              <Table table={report.balanceHorizontal} />
            </div>
          ) : null}
          {report.cashflowHorizontal ? (
            <div>
              <p className="rule-label mb-1.5">Cash flow statement</p>
              <Table table={report.cashflowHorizontal} />
            </div>
          ) : null}
        </Section>
      ) : null}

      {report.ratioPeriods.length ? (
        <Section index="05" title="CFI financial ratios" subtitle="full audit trail">
          {report.ratioPeriods.map((periodRatios) => (
            <div key={periodRatios.period} className="mb-6 break-before-page">
              <div className="mb-3 border-b border-line pb-1.5">
                <p className="rule-label">Period</p>
                <h3 className="font-display text-xl text-paper">{periodRatios.period}</h3>
              </div>
              {periodRatios.categories.map((category) => (
                <div key={category.key} className="mb-4">
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3">
                    <div>
                      <p className="font-display text-[0.95rem] text-paper">{category.title}</p>
                      <p className="rule-label">{category.blurb}</p>
                    </div>
                    <span className="tabular text-[0.68rem] text-faint">
                      {category.resolved}/{category.total} resolved
                    </span>
                  </div>
                  <div className="space-y-2">
                    {category.ratios.map((ratio) => (
                      <RatioEntry key={`${periodRatios.period}-${ratio.name}`} ratio={ratio} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </Section>
      ) : null}

      <footer className="mt-8 border-t border-line pt-3">
        <p className="rule-label">Numera · every figure traceable to its source line item</p>
      </footer>
    </article>
  );
}
