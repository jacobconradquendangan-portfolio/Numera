import {
  FinancialCategory,
  NormalizedLineItem,
  NormalizedStatement,
  ParsedDocument,
  Section,
  StatementType,
  TAXONOMY,
} from './parser';

export interface AnalyzerOptions {
  incomeBase?: FinancialCategory;
  balanceBase?: FinancialCategory;
  includeDerived?: boolean;
  includeEmptyValues?: boolean;
}

interface ResolvedAnalyzerOptions {
  incomeBase: FinancialCategory;
  balanceBase: FinancialCategory;
  includeDerived: boolean;
  includeEmptyValues: boolean;
}

export interface VerticalAnalysisEntry {
  category: FinancialCategory;
  label: string;
  section: Section;
  period: string;
  value: number | null;
  baseValue: number | null;
  baseCategory: FinancialCategory;
  ratio: number | null;
  percent: number | null;
  derived: boolean;
  formula: string;
  substitution: string;
  notes: string[];
}

export interface VerticalAnalysis {
  statementType: StatementType;
  baseCategory: FinancialCategory;
  baseLabel: string;
  periods: string[];
  chronological: boolean;
  entries: VerticalAnalysisEntry[];
  warnings: string[];
}

export interface HorizontalChange {
  fromPeriod: string;
  toPeriod: string;
  fromValue: number | null;
  toValue: number | null;
  absoluteChange: number | null;
  ratioChange: number | null;
  percentChange: number | null;
  formula: string;
  substitution: string;
  notes: string[];
}

export interface HorizontalAnalysisEntry {
  category: FinancialCategory;
  label: string;
  section: Section;
  derived: boolean;
  changes: HorizontalChange[];
}

export interface HorizontalAnalysis {
  statementType: StatementType;
  periods: string[];
  chronological: boolean;
  entries: HorizontalAnalysisEntry[];
  warnings: string[];
}

export interface AnalysisResult {
  vertical: {
    income: VerticalAnalysis | null;
    balance: VerticalAnalysis | null;
  };
  horizontal: {
    income: HorizontalAnalysis | null;
    balance: HorizontalAnalysis | null;
  };
}

const DEFAULT_ANALYZER_OPTIONS: ResolvedAnalyzerOptions = {
  incomeBase: 'revenue',
  balanceBase: 'total_assets',
  includeDerived: true,
  includeEmptyValues: false,
};

const DEFINITION_BY_CATEGORY = new Map<FinancialCategory, (typeof TAXONOMY)[number]>();
for (const definition of TAXONOMY) DEFINITION_BY_CATEGORY.set(definition.key, definition);

const MONTH_INDEX: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function formatNumber(value: number): string {
  const rounded = round(value, 6);
  const sign = rounded < 0 ? '-' : '';
  return sign + Math.abs(rounded).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatPercent(fraction: number): string {
  return `${(round(fraction * 100, 4)).toFixed(2)}%`;
}

export function resolveAnalyzerOptions(options?: AnalyzerOptions): ResolvedAnalyzerOptions {
  return {
    incomeBase: options?.incomeBase ?? DEFAULT_ANALYZER_OPTIONS.incomeBase,
    balanceBase: options?.balanceBase ?? DEFAULT_ANALYZER_OPTIONS.balanceBase,
    includeDerived: options?.includeDerived ?? DEFAULT_ANALYZER_OPTIONS.includeDerived,
    includeEmptyValues: options?.includeEmptyValues ?? DEFAULT_ANALYZER_OPTIONS.includeEmptyValues,
  };
}

function periodRank(period: string): number | null {
  const token = period.trim();
  let match: RegExpExecArray | null;

  if ((match = /^(?:fy\s*)?((?:19|20)\d{2})$/i.exec(token))) {
    return Number(match[1]) * 1_000_000;
  }
  if ((match = /^q([1-4])\s*((?:19|20)\d{2})$/i.exec(token))) {
    return Number(match[2]) * 1_000_000 + Number(match[1]) * 10_000;
  }
  if ((match = /^((?:19|20)\d{2})\s*q([1-4])$/i.exec(token))) {
    return Number(match[1]) * 1_000_000 + Number(match[2]) * 10_000;
  }
  if ((match = /^period\s*(\d+)$/i.exec(token))) {
    return Number(match[1]);
  }
  if ((match = /^([a-z]{3,9})\.?\s+(\d{1,2}),?\s+((?:19|20)\d{2})$/i.exec(token))) {
    const month = MONTH_INDEX[match[1].slice(0, 3).toLowerCase()];
    if (month) return Number(match[3]) * 1_000_000 + month * 10_000 + Number(match[2]);
  }
  if ((match = /^(\d{1,2})\/(\d{1,2})\/((?:19|20)\d{2})$/.exec(token))) {
    return Number(match[3]) * 1_000_000 + Number(match[1]) * 10_000 + Number(match[2]);
  }
  if ((match = /^(\d{1,2})-([a-z]{3,9})-((?:19|20)\d{2})$/i.exec(token))) {
    const month = MONTH_INDEX[match[2].slice(0, 3).toLowerCase()];
    if (month) return Number(match[3]) * 1_000_000 + month * 10_000 + Number(match[1]);
  }
  return null;
}

function orderPeriods(periods: string[]): { ordered: string[]; chronological: boolean } {
  const ranked = periods.map((period) => ({ period, rank: periodRank(period) }));
  if (ranked.every((item) => item.rank !== null)) {
    const ordered = [...ranked]
      .sort((a, b) => (a.rank as number) - (b.rank as number))
      .map((item) => item.period);
    return { ordered, chronological: true };
  }
  return { ordered: [...periods], chronological: false };
}

function valueFor(item: NormalizedLineItem, period: string): number | null {
  const value = item.values[period];
  return value === null || value === undefined ? null : value;
}

function labelFor(item: NormalizedLineItem): string {
  return DEFINITION_BY_CATEGORY.get(item.category)?.label ?? item.rawLabel;
}

function selectItems(statement: NormalizedStatement, options: ResolvedAnalyzerOptions): NormalizedLineItem[] {
  return statement.lineItems.filter((item) => {
    if (!options.includeDerived && item.derived) return false;
    if (options.includeEmptyValues) return true;
    return Object.values(item.values).some((value) => value !== null && value !== undefined);
  });
}

export function computeVerticalAnalysis(
  statement: NormalizedStatement,
  options?: AnalyzerOptions
): VerticalAnalysis {
  const resolved = resolveAnalyzerOptions(options);
  const { ordered, chronological } = orderPeriods(statement.periods);
  const baseCategory = statement.type === 'income' ? resolved.incomeBase : resolved.balanceBase;
  const baseLabel = DEFINITION_BY_CATEGORY.get(baseCategory)?.label ?? baseCategory;
  const warnings: string[] = [];
  const items = selectItems(statement, resolved);
  const baseItem = items.find((item) => item.category === baseCategory);

  if (!baseItem) {
    warnings.push(`Base category "${baseLabel}" was not found; vertical percentages cannot be computed.`);
  }

  const entries: VerticalAnalysisEntry[] = [];
  for (const period of ordered) {
    const baseValue = baseItem ? valueFor(baseItem, period) : null;
    if (baseItem && baseValue === null) {
      warnings.push(`Base category "${baseLabel}" has no value for period "${period}".`);
    }
    for (const item of items) {
      const value = valueFor(item, period);
      const notes: string[] = [];
      let ratio: number | null = null;
      let percent: number | null = null;

      if (value === null) {
        notes.push('Value is not available for this period.');
      } else if (baseValue === null) {
        notes.push(`Base value (${baseLabel}) is unavailable for this period.`);
      } else if (baseValue === 0) {
        notes.push(`Base value (${baseLabel}) is zero; ratio is undefined.`);
      } else {
        ratio = round(value / baseValue);
        percent = round(ratio * 100, 4);
      }

      entries.push({
        category: item.category,
        label: labelFor(item),
        section: item.section,
        period,
        value,
        baseValue,
        baseCategory,
        ratio,
        percent,
        derived: item.derived,
        formula: `% of ${baseLabel} = ${labelFor(item)} / ${baseLabel}`,
        substitution:
          value === null || baseValue === null
            ? 'insufficient data'
            : `${formatNumber(value)} / ${formatNumber(baseValue)}` +
              (ratio !== null ? ` = ${formatPercent(ratio)}` : ''),
        notes,
      });
    }
  }

  return {
    statementType: statement.type,
    baseCategory,
    baseLabel,
    periods: ordered,
    chronological,
    entries,
    warnings,
  };
}

export function computeHorizontalAnalysis(
  statement: NormalizedStatement,
  options?: AnalyzerOptions
): HorizontalAnalysis {
  const resolved = resolveAnalyzerOptions(options);
  const { ordered, chronological } = orderPeriods(statement.periods);
  const items = selectItems(statement, resolved);
  const entries: HorizontalAnalysisEntry[] = [];
  const warnings: string[] = [];

  if (ordered.length < 2) {
    warnings.push('Horizontal analysis requires at least two periods; only one period was available.');
  } else if (!chronological) {
    warnings.push('Period order could not be inferred; changes were computed in document order.');
  }

  for (const item of items) {
    const changes: HorizontalChange[] = [];
    for (let index = 0; index < ordered.length - 1; index += 1) {
      const fromPeriod = ordered[index];
      const toPeriod = ordered[index + 1];
      const fromValue = valueFor(item, fromPeriod);
      const toValue = valueFor(item, toPeriod);
      const notes: string[] = [];
      let absoluteChange: number | null = null;
      let ratioChange: number | null = null;
      let percentChange: number | null = null;

      if (fromValue === null || toValue === null) {
        notes.push('Absolute and percentage change require values in both periods.');
      } else {
        absoluteChange = round(toValue - fromValue);
        if (fromValue === 0) {
          notes.push('Base period value is zero; growth rate is undefined.');
          ratioChange = toValue === 0 ? 0 : null;
          percentChange = ratioChange === null ? null : 0;
        } else {
          ratioChange = round((toValue - fromValue) / Math.abs(fromValue));
          percentChange = round(ratioChange * 100, 4);
        }
      }

      const substitutionParts: string[] = [];
      if (absoluteChange !== null) {
        substitutionParts.push(
          `Δ = ${formatNumber(toValue as number)} - ${formatNumber(fromValue as number)} = ${formatNumber(absoluteChange)}`
        );
      }
      if (ratioChange !== null) {
        substitutionParts.push(
          `Growth = (${formatNumber(toValue as number)} - ${formatNumber(fromValue as number)}) / |${formatNumber(fromValue as number)}| = ${formatPercent(ratioChange)}`
        );
      }

      changes.push({
        fromPeriod,
        toPeriod,
        fromValue,
        toValue,
        absoluteChange,
        ratioChange,
        percentChange,
        formula: 'Δ = Value_to - Value_from ; Growth % = (Value_to - Value_from) / |Value_from|',
        substitution: substitutionParts.length ? substitutionParts.join(' ; ') : 'insufficient data',
        notes,
      });
    }
    entries.push({
      category: item.category,
      label: labelFor(item),
      section: item.section,
      derived: item.derived,
      changes,
    });
  }

  return {
    statementType: statement.type,
    periods: ordered,
    chronological,
    entries,
    warnings,
  };
}

export function analyzeStatements(
  statements: { income: NormalizedStatement | null; balance: NormalizedStatement | null },
  options?: AnalyzerOptions
): AnalysisResult {
  return {
    vertical: {
      income: statements.income ? computeVerticalAnalysis(statements.income, options) : null,
      balance: statements.balance ? computeVerticalAnalysis(statements.balance, options) : null,
    },
    horizontal: {
      income: statements.income ? computeHorizontalAnalysis(statements.income, options) : null,
      balance: statements.balance ? computeHorizontalAnalysis(statements.balance, options) : null,
    },
  };
}

export function analyzeDocument(document: ParsedDocument, options?: AnalyzerOptions): AnalysisResult {
  return analyzeStatements(document.statements, options);
}

export { periodRank, orderPeriods };
