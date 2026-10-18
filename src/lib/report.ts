import type { AnalyzeSuccess, DayCountBasis, VerticalAnalysis, HorizontalAnalysis } from '@/lib/types';
import type { DocumentFormat, StatementType } from '@/lib/engine/parser';
import type { RatioAvailability, RatioCategory, RatioReport } from '@/lib/engine/ratios';
import { formatNumber, formatPercent, formatSignedPercent, formatUnitValue } from '@/lib/format';

export type ReportScope = 'selected' | 'all';

export interface ReportMetaLine {
  label: string;
  value: string;
}

export interface ReportMeta {
  scopeLabel: string;
  generatedAt: string;
  periods: string[];
  lines: ReportMetaLine[];
}

export interface ReportOptions {
  scope: ReportScope;
  selectedPeriod: string;
  dayCountBasis: DayCountBasis;
  filename?: string;
}

export interface ReportTableRow {
  label: string;
  cells: string[];
}

export interface ReportTable {
  columns: string[];
  rows: ReportTableRow[];
  align?: ('left' | 'right')[];
}

export interface ReportIntegrity {
  period: string;
  balanced: boolean;
  status: string;
  equation: string;
  difference: string;
  tolerance: string;
}

export interface ReportRatio {
  name: string;
  availability: RatioAvailability;
  display: string;
  formula: string;
  substitution: string;
  steps: { label: string; expression: string; value: string | null }[];
  inputs: { label: string; value: string; source: string }[];
  measures: string;
  interpretation: string;
  guidance: string;
  notes: string[];
}

export interface ReportCategory {
  key: RatioCategory;
  title: string;
  blurb: string;
  resolved: number;
  total: number;
  ratios: ReportRatio[];
}

export interface ReportPeriodRatios {
  period: string;
  categories: ReportCategory[];
}

export interface ReportModel {
  meta: ReportMeta;
  periods: string[];
  overview: ReportTable;
  integrity: ReportIntegrity[];
  incomeVertical: ReportTable | null;
  balanceVertical: ReportTable | null;
  cashflowVertical: ReportTable | null;
  incomeHorizontal: ReportTable | null;
  balanceHorizontal: ReportTable | null;
  cashflowHorizontal: ReportTable | null;
  ratioPeriods: ReportPeriodRatios[];
}

const FORMAT_LABELS: Record<DocumentFormat, string> = {
  pdf: 'PDF',
  xlsx: 'Excel (XLSX)',
  csv: 'CSV',
  text: 'Pasted text',
  manual: 'Manual entry',
};

const CATEGORY_ORDER: RatioCategory[] = ['liquidity', 'profitability', 'leverage', 'efficiency', 'valuation'];

const CATEGORY_TITLES: Record<RatioCategory, string> = {
  liquidity: 'Liquidity',
  profitability: 'Profitability',
  leverage: 'Leverage',
  efficiency: 'Efficiency',
  valuation: 'Valuation',
};

const CATEGORY_BLURBS: Record<RatioCategory, string> = {
  liquidity: 'Ability to meet short-term obligations',
  profitability: 'Earnings generation against sales, assets & equity',
  leverage: 'Capital structure and solvency risk',
  efficiency: 'How effectively assets are converted to sales',
  valuation: 'Market pricing multiples',
};

const OVERVIEW_ROWS: { label: string; statement: StatementType; category: string }[] = [
  { label: 'Revenue', statement: 'income', category: 'revenue' },
  { label: 'Net income', statement: 'income', category: 'net_income' },
  { label: 'Total assets', statement: 'balance', category: 'total_assets' },
  { label: 'Total liabilities', statement: 'balance', category: 'total_liabilities' },
  { label: "Shareholders' equity", statement: 'balance', category: 'total_equity' },
  { label: 'Operating cash flow', statement: 'cashflow', category: 'net_cash_from_operating_activities' },
];

function formatMetric(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return formatNumber(value, Math.abs(value) >= 1000 ? 0 : 2);
}

function formatSignedMetric(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${formatNumber(value)}`;
}

export function reportPeriods(result: AnalyzeSuccess): string[] {
  const fromHistory = result.ratioHistory.map((report) => report.period);
  if (fromHistory.length) return fromHistory;
  if (result.ratios?.period) return [result.ratios.period];
  const balance = result.analysis.vertical.balance?.periods;
  if (balance?.length) return balance;
  const income = result.analysis.vertical.income?.periods;
  if (income?.length) return income;
  return [];
}

export function documentSourceLabel(result: AnalyzeSuccess, filenameOverride?: string): string {
  const { format, filename, tableCount } = result.document.source;
  const name = filenameOverride ?? filename;
  const parts = [FORMAT_LABELS[format] ?? format.toUpperCase()];
  if (name) parts.push(name);
  if (tableCount > 0) parts.push(`${tableCount} table${tableCount === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

export function describeScope(scope: ReportScope, periods: string[], selectedPeriod: string): string {
  if (scope === 'all') {
    if (!periods.length) return 'All periods';
    if (periods.length === 1) return `All periods (${periods[0]})`;
    return `All periods (${periods[0]} – ${periods[periods.length - 1]})`;
  }
  return `Selected period (${selectedPeriod || '—'})`;
}

export function buildReportMeta(result: AnalyzeSuccess, options: ReportOptions): ReportMeta {
  const periods = reportPeriods(result);
  const scale = result.ratios.unitMultiplier;
  const scaleNote = scale !== 1 ? `×${scale.toLocaleString()} units` : 'as reported';
  const scopeLabel = describeScope(options.scope, periods, options.selectedPeriod);
  const lines: ReportMetaLine[] = [
    { label: 'Source', value: documentSourceLabel(result, options.filename) },
    { label: 'Scope', value: scopeLabel },
    { label: 'Periods', value: periods.length ? periods.join(' · ') : '—' },
    { label: 'Statement scale', value: scaleNote },
    { label: 'Day-count basis', value: `${options.dayCountBasis} days` },
  ];
  return {
    scopeLabel,
    generatedAt: new Date().toLocaleString(),
    periods,
    lines,
  };
}

function scopedPeriods(result: AnalyzeSuccess, options: ReportOptions): string[] {
  const all = reportPeriods(result);
  if (options.scope === 'all') return all;
  if (options.selectedPeriod && all.includes(options.selectedPeriod)) return [options.selectedPeriod];
  return all.length ? [all[all.length - 1]] : [];
}

function statementValue(result: AnalyzeSuccess, statement: StatementType, category: string, period: string): number | null {
  const source = result.document.statements[statement];
  const item = source?.lineItems.find((entry) => entry.category === category);
  const value = item?.values[period];
  return value === null || value === undefined ? null : value;
}

function buildOverview(result: AnalyzeSuccess, periods: string[]): ReportTable {
  const rows: ReportTableRow[] = OVERVIEW_ROWS.map((row) => ({
    label: row.label,
    cells: periods.map((period) => formatMetric(statementValue(result, row.statement, row.category, period))),
  }));
  return { columns: ['Metric', ...periods], rows };
}

function buildIntegrity(result: AnalyzeSuccess, periods: string[]): ReportIntegrity[] {
  const lines: ReportIntegrity[] = [];
  for (const period of periods) {
    const validation = result.document.validations.find((entry) => entry.period === period);
    if (!validation) {
      lines.push({
        period,
        balanced: false,
        status: 'Not available',
        equation: 'No balance-sheet validation for this period.',
        difference: '—',
        tolerance: '—',
      });
      continue;
    }
    const liabilitiesAndEquity = validation.totalLiabilitiesAndEquity ?? validation.totalEquity;
    const equation = `${formatMetric(validation.totalAssets)} Assets ${validation.balanced ? '=' : '≠'} ${formatMetric(
      liabilitiesAndEquity
    )} Liabilities + Equity`;
    lines.push({
      period,
      balanced: validation.balanced,
      status: validation.balanced ? 'Balanced' : 'Out of balance',
      equation,
      difference: formatMetric(validation.difference),
      tolerance: formatMetric(validation.tolerance),
    });
  }
  return lines;
}

function buildVerticalTable(vertical: VerticalAnalysis | null, periods: string[]): ReportTable | null {
  if (!vertical) return null;
  const labels: string[] = [];
  for (const period of periods) {
    for (const entry of vertical.entries) {
      if (entry.period === period && !labels.includes(entry.label)) labels.push(entry.label);
    }
  }
  if (!labels.length) return null;
  const lookup = new Map<string, string>();
  for (const entry of vertical.entries) {
    if (entry.percent === null) continue;
    lookup.set(`${entry.period}\u0000${entry.label}`, formatPercent(entry.percent));
  }
  const rows: ReportTableRow[] = labels.map((label) => ({
    label,
    cells: periods.map((period) => lookup.get(`${period}\u0000${label}`) ?? '—'),
  }));
  return { columns: ['Line item', ...periods], rows };
}

function buildHorizontalTable(horizontal: HorizontalAnalysis | null, periods: string[]): ReportTable | null {
  if (!horizontal) return null;
  const rows: ReportTableRow[] = [];
  for (const entry of horizontal.entries) {
    for (const change of entry.changes) {
      if (periods.length && !periods.includes(change.toPeriod)) continue;
      rows.push({
        label: entry.label,
        cells: [
          `${change.fromPeriod} → ${change.toPeriod}`,
          formatSignedMetric(change.absoluteChange),
          formatSignedPercent(change.percentChange),
        ],
      });
    }
  }
  if (!rows.length) return null;
  return { columns: ['Line item', 'Comparison', 'Δ change', '% change'], rows, align: ['left', 'right', 'right'] };
}

function reportForPeriod(result: AnalyzeSuccess, period: string): RatioReport | null {
  return (
    result.ratioHistory.find((report) => report.period === period) ??
    (result.ratios?.period === period ? result.ratios : null)
  );
}

function buildRatioPeriods(result: AnalyzeSuccess, periods: string[]): ReportPeriodRatios[] {
  const output: ReportPeriodRatios[] = [];
  for (const period of periods) {
    const report = reportForPeriod(result, period);
    if (!report) continue;
    const categories: ReportCategory[] = CATEGORY_ORDER.map((key) => {
      const ratios = report.byCategory[key] ?? [];
      return {
        key,
        title: CATEGORY_TITLES[key],
        blurb: CATEGORY_BLURBS[key],
        resolved: ratios.filter((ratio) => ratio.availability !== 'unavailable').length,
        total: ratios.length,
        ratios: ratios.map((ratio) => ({
          name: ratio.name,
          availability: ratio.availability,
          display: ratio.display,
          formula: ratio.formula,
          substitution: ratio.substitution,
          steps: ratio.steps.map((step) => ({
            label: step.label,
            expression: step.expression,
            value: step.value === null ? null : formatUnitValue(step.value, step.unit),
          })),
          inputs: ratio.inputs.map((input) => ({
            label: input.label,
            value: formatMetric(input.value),
            source: input.source,
          })),
          measures: ratio.description.measures,
          interpretation: ratio.description.interpretation,
          guidance: ratio.description.benchmark,
          notes: ratio.notes,
        })),
      };
    }).filter((category) => category.ratios.length);
    output.push({ period, categories });
  }
  return output;
}

export function buildReport(result: AnalyzeSuccess, options: ReportOptions): ReportModel {
  const periods = scopedPeriods(result, options);
  return {
    meta: buildReportMeta(result, options),
    periods,
    overview: buildOverview(result, periods),
    integrity: buildIntegrity(result, periods),
    incomeVertical: buildVerticalTable(result.analysis.vertical.income, periods),
    balanceVertical: buildVerticalTable(result.analysis.vertical.balance, periods),
    cashflowVertical: buildVerticalTable(result.analysis.vertical.cashflow, periods),
    incomeHorizontal: buildHorizontalTable(result.analysis.horizontal.income, periods),
    balanceHorizontal: buildHorizontalTable(result.analysis.horizontal.balance, periods),
    cashflowHorizontal: buildHorizontalTable(result.analysis.horizontal.cashflow, periods),
    ratioPeriods: buildRatioPeriods(result, periods),
  };
}
