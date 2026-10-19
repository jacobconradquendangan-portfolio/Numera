import type { CategoryOption, NormalizedStatement, StatementType } from '@/lib/types';
import { classifyNumber } from '@/lib/validation';

export type VerifyStatus = 'match' | 'mismatch' | 'missing' | 'extra' | 'derived' | 'blank';

export interface VerifyCell {
  period: string;
  parsed: number | null;
  manual: number | null;
  manualRaw: string;
  status: VerifyStatus;
}

export interface VerifyRow {
  type: StatementType;
  label: string;
  rawLabel: string;
  sourceTable: string;
  sourceRow: number;
  confidence: number;
  derived: boolean;
  cells: VerifyCell[];
}

export interface VerifyUnmatched {
  type: StatementType;
  labels: string[];
}

export interface VerifyCounts {
  match: number;
  mismatch: number;
  missing: number;
  extra: number;
  derived: number;
}

export interface VerificationReport {
  periods: string[];
  rows: VerifyRow[];
  unmatched: VerifyUnmatched[];
  counts: VerifyCounts;
  totalCompared: number;
  accuracy: number | null;
}

export const VERIFY_TOLERANCE = 0.5;

const STATEMENT_TYPES: StatementType[] = ['income', 'balance', 'cashflow'];

export type VerifyStatements = Record<StatementType, NormalizedStatement | null>;

export interface VerifyManualRow {
  label: string;
  values: string[];
}

export type VerifyManualRows = Record<StatementType, VerifyManualRow[]>;

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

function manualNumber(raw: string): number | null {
  const { kind, value } = classifyNumber(raw);
  return kind === 'valid' ? value : null;
}

function classify(parsed: number | null, manual: number | null, derived: boolean, tolerance: number): VerifyStatus {
  if (derived) return 'derived';
  if (parsed === null && manual === null) return 'blank';
  if (parsed !== null && manual === null) return 'missing';
  if (parsed === null && manual !== null) return 'extra';
  return Math.abs((parsed as number) - (manual as number)) <= tolerance ? 'match' : 'mismatch';
}

export function buildVerification(
  statements: VerifyStatements,
  manual: VerifyManualRows,
  manualPeriods: string[],
  categories: CategoryOption[],
  tolerance = VERIFY_TOLERANCE
): VerificationReport {
  const labelByKey = new Map(categories.map((category) => [category.key, category.label] as const));
  const periodIndex = new Map(manualPeriods.map((period, index) => [period.trim(), index] as const));

  const periods: string[] = [];
  for (const type of STATEMENT_TYPES) {
    const statement = statements[type];
    if (!statement) continue;
    for (const period of statement.periods) {
      if (!periods.includes(period)) periods.push(period);
    }
  }

  const rows: VerifyRow[] = [];
  const unmatched: VerifyUnmatched[] = [];
  const counts: VerifyCounts = { match: 0, mismatch: 0, missing: 0, extra: 0, derived: 0 };

  for (const type of STATEMENT_TYPES) {
    const statement = statements[type];
    if (!statement) continue;

    const manualByLabel = new Map<string, VerifyManualRow>();
    for (const row of manual[type] ?? []) {
      const key = normalizeLabel(row.label);
      if (key && !manualByLabel.has(key)) manualByLabel.set(key, row);
    }
    const matchedManual = new Set<string>();

    for (const item of statement.lineItems) {
      const canonical = item.category ? labelByKey.get(item.category) : undefined;
      const label = canonical ?? item.rawLabel;
      const key = normalizeLabel(label);
      const manualRow = manualByLabel.get(key);
      if (manualRow) matchedManual.add(key);

      const cells = periods.map((period): VerifyCell => {
        const parsedValue = item.values[period];
        const parsed = parsedValue === null || parsedValue === undefined ? null : parsedValue;
        const index = periodIndex.get(period.trim());
        const manualRaw = manualRow && index !== undefined ? manualRow.values[index] ?? '' : '';
        const manualValue = manualNumber(manualRaw);
        const status = classify(parsed, manualValue, item.derived, tolerance);
        if (status !== 'blank') counts[status] += 1;
        return { period, parsed, manual: manualValue, manualRaw, status };
      });

      rows.push({
        type,
        label,
        rawLabel: item.rawLabel,
        sourceTable: item.source.table,
        sourceRow: item.source.row,
        confidence: item.confidence,
        derived: item.derived,
        cells,
      });
    }

    for (const row of manual[type] ?? []) {
      const key = normalizeLabel(row.label);
      if (!key || matchedManual.has(key)) continue;
      if (!row.values.some((value) => manualNumber(value) !== null)) continue;
      const cells = periods.map((period): VerifyCell => {
        const index = periodIndex.get(period.trim());
        const manualRaw = index !== undefined ? row.values[index] ?? '' : '';
        const manualValue = manualNumber(manualRaw);
        const status = classify(null, manualValue, false, tolerance);
        if (status !== 'blank') counts[status] += 1;
        return { period, parsed: null, manual: manualValue, manualRaw, status };
      });
      rows.push({
        type,
        label: row.label,
        rawLabel: row.label,
        sourceTable: '(manual)',
        sourceRow: -1,
        confidence: 1,
        derived: false,
        cells,
      });
    }

    if (statement.unmappedLabels.length) {
      unmatched.push({ type, labels: statement.unmappedLabels });
    }
  }

  const totalCompared = counts.match + counts.mismatch + counts.missing;
  const accuracy = totalCompared === 0 ? null : counts.match / totalCompared;

  return { periods, rows, unmatched, counts, totalCompared, accuracy };
}

export function isCountedStatus(status: VerifyStatus): boolean {
  return status === 'match' || status === 'mismatch' || status === 'missing';
}
