import type { ManualStatementPayload } from '@/lib/types';

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  title: string;
  detail?: string;
}

const ALLOWED_EXTENSIONS = ['pdf', 'xlsx', 'xls', 'csv'];
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const PERIOD_TOKEN_RE = /^(?:(?:19|20)\d{2}|fy\s?\d{2,4}|q[1-4](?:\s?(?:19|20)?\d{2})?)$/i;

export function classifyNumber(raw: string | null | undefined): {
  kind: 'empty' | 'valid' | 'invalid';
  value: number | null;
} {
  const text = String(raw ?? '').trim();
  if (!text) return { kind: 'empty', value: null };
  if (/^[-–—]+$/.test(text) || /^n\/?a$/i.test(text)) return { kind: 'valid', value: 0 };

  let s = text;
  let parenthesized = false;
  if (/^\(/.test(s) || /\)$/.test(s)) {
    parenthesized = true;
    s = s.replace(/^\(+/, '').replace(/\)+$/, '').trim();
  }
  s = s.replace(/[^0-9.,+-]/g, '');
  if (!s) return { kind: 'invalid', value: null };

  let sign = 1;
  if (/^-/.test(s)) {
    sign = -1;
    s = s.slice(1);
  } else if (/^\+/.test(s)) {
    s = s.slice(1);
  }
  if (/[+-]/.test(s)) return { kind: 'invalid', value: null };

  if (/^\d{1,3}(?:,\d{3})+$/.test(s)) s = s.replace(/,/g, '');
  else if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(',', '.');
  else s = s.replace(/,/g, '');

  if (!/^\d*\.?\d+$/.test(s)) return { kind: 'invalid', value: null };
  const value = Number(s);
  if (!Number.isFinite(value)) return { kind: 'invalid', value: null };
  return { kind: 'valid', value: value * sign * (parenthesized ? -1 : 1) };
}

export function isMalformedNumber(raw: string | null | undefined): boolean {
  return classifyNumber(raw).kind === 'invalid';
}

export function hasBlockingErrors(issues: ValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'error');
}

function issue(severity: ValidationSeverity, id: string, title: string, detail?: string): ValidationIssue {
  return { id, severity, title, detail };
}

function fmt(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function joinLabels(labels: string[], limit = 5): string {
  const shown = labels.slice(0, limit).join(', ');
  return labels.length > limit ? `${shown} (+${labels.length - limit} more)` : shown;
}

function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type BalanceKey = 'assets' | 'liabilities' | 'equity' | 'liabilitiesAndEquity';

const TOTAL_LE_RE = /liabilit\w*\s+and\s+.*equity/;

function balanceKey(normalized: string): BalanceKey | null {
  if (TOTAL_LE_RE.test(normalized) || /total liabilities and equity/.test(normalized)) return 'liabilitiesAndEquity';
  if (normalized.includes('total liabilities')) return 'liabilities';
  if (normalized.includes('total assets')) return 'assets';
  if (/attributable to/.test(normalized)) return null;
  if (normalized.includes('total equity') || /(shareholders|stockholders) equity/.test(normalized)) return 'equity';
  return null;
}

function resolveBalanceTotals(statement: ManualStatementPayload): Record<BalanceKey, (number | null)[]> {
  const periods = statement.periods;
  const totals: Record<BalanceKey, (number | null)[]> = {
    assets: periods.map(() => null),
    liabilities: periods.map(() => null),
    equity: periods.map(() => null),
    liabilitiesAndEquity: periods.map(() => null),
  };
  for (const line of statement.lines) {
    const key = balanceKey(normalizeLabel(line.label));
    if (!key) continue;
    periods.forEach((_, index) => {
      if (totals[key][index] !== null) return;
      const parsed = classifyNumber(line.values[index]);
      if (parsed.kind === 'valid') totals[key][index] = parsed.value;
    });
  }
  return totals;
}

export function validateManualStatements(statements: ManualStatementPayload[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!statements.length) {
    return [issue('error', 'no-input', 'Nothing to analyse', 'Add at least one line item with a figure before analysing.')];
  }

  for (const statement of statements) {
    const periods = statement.periods.map((period) => period.trim());
    const counts = new Map<string, number>();
    periods.forEach((period) => counts.set(period.toLowerCase(), (counts.get(period.toLowerCase()) ?? 0) + 1));
    counts.forEach((count, period) => {
      if (period && count > 1) {
        issues.push(
          issue('error', `duplicate-period-${statement.type}-${period}`, `Duplicate period "${period}"`, `The ${statement.type} statement lists this period more than once. Each column must be unique.`)
        );
      }
    });

    const malformed: string[] = [];
    const empty: string[] = [];
    statement.lines.forEach((line) => {
      let hasValue = false;
      line.values.forEach((raw, index) => {
        const parsed = classifyNumber(raw);
        if (parsed.kind === 'invalid') {
          malformed.push(`${line.label || 'Untitled line'} · ${periods[index] || `column ${index + 1}`} = "${String(raw).trim()}"`);
        } else if (parsed.kind === 'valid') {
          hasValue = true;
        }
      });
      if (!hasValue) empty.push(line.label || 'Untitled line');
    });

    if (malformed.length) {
      issues.push(
        issue('error', `malformed-${statement.type}`, `${malformed.length} unreadable ${malformed.length === 1 ? 'value' : 'values'} in the ${statement.type} statement`, joinLabels(malformed))
      );
    }
    if (empty.length) {
      issues.push(
        issue('warning', `empty-${statement.type}`, `${empty.length} ${empty.length === 1 ? 'line has' : 'lines have'} no figures`, joinLabels(empty))
      );
    }
  }

  const income = statements.find((statement) => statement.type === 'income');
  const balance = statements.find((statement) => statement.type === 'balance');
  const cashflow = statements.find((statement) => statement.type === 'cashflow');

  if (!income) {
    issues.push(issue('warning', 'no-income', 'No income statement detected', 'Profitability and coverage ratios need income-statement line items.'));
  }
  if (!cashflow) {
    issues.push(
      issue(
        'warning',
        'no-cashflow',
        'No cash flow statement detected',
        'Operating-cash-flow and CAPEX ratios need cash-flow line items, or external inputs.'
      )
    );
  }
  if (!balance) {
    issues.push(issue('warning', 'no-balance', 'No balance sheet detected', 'Liquidity and leverage ratios need balance-sheet line items.'));
    return issues;
  }

  const totals = resolveBalanceTotals(balance);
  balance.periods.forEach((rawPeriod, index) => {
    const period = rawPeriod.trim() || `column ${index + 1}`;
    const assets = totals.assets[index];
    const liabilities = totals.liabilities[index];
    const equity = totals.equity[index];
    const liabilitiesAndEquity = totals.liabilitiesAndEquity[index];
    const rightHandSide =
      liabilities !== null && equity !== null ? liabilities + equity : liabilitiesAndEquity;

    if (assets === null) {
      issues.push(issue('warning', `missing-assets-${period}`, `Missing Total Assets for ${period}`, 'Add a "Total Assets" line so the balance sheet can be verified.'));
    }
    if (rightHandSide === null) {
      issues.push(
        issue('warning', `missing-rhs-${period}`, `Missing liabilities or equity total for ${period}`, 'Add "Total Liabilities" and "Total Equity" (or "Total Liabilities and Equity").')
      );
    }
    if (assets !== null && rightHandSide !== null) {
      const difference = assets - rightHandSide;
      const tolerance = Math.max(1, Math.abs(assets) * 0.005);
      if (Math.abs(difference) > tolerance) {
        issues.push(
          issue(
            'warning',
            `unbalanced-${period}`,
            `Balance sheet does not reconcile for ${period}`,
            `Assets ${fmt(assets)} vs liabilities + equity ${fmt(rightHandSide)} — out by ${fmt(difference)}.`
          )
        );
      }
    }
  });

  return issues;
}

function splitChunks(text: string): string[] {
  const normalized = text.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];
  if (normalized.includes('\f')) {
    return normalized.split('\f').map((chunk) => chunk.trim()).filter(Boolean);
  }
  const blankSplit = normalized.split(/\n{3,}/).map((chunk) => chunk.trim()).filter(Boolean);
  const numericChunks = blankSplit.filter((chunk) => /\d/.test(chunk));
  if (blankSplit.length >= 2 && numericChunks.length >= 2) return blankSplit;
  return [normalized];
}

function countTokens(line: string, predicate: (token: string) => boolean): number {
  return line
    .trim()
    .split(/[\t ]+/)
    .filter(Boolean)
    .filter(predicate).length;
}

function splitRowCells(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map((cell) => cell.trim());
  return [line.trim()];
}

export function validatePastedText(text: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const normalized = text.replace(/\r\n?/g, '\n').trim();
  if (!normalized) {
    return [issue('error', 'empty-text', 'Nothing to analyse', 'Paste at least one statement before analysing.')];
  }

  const chunks = splitChunks(normalized);
  const numericChunks = chunks.filter((chunk) => /\d/.test(chunk));

  if (!numericChunks.length) {
    return [issue('error', 'no-numbers', 'No numbers detected', 'Paste rows that include figures — labels alone cannot be analysed.')];
  }

  if (chunks.length === 1) {
    issues.push(
      issue('warning', 'one-table', 'Only one table detected', 'If you have an income statement and a balance sheet, separate them with a blank line (press Enter twice) so both are parsed.')
    );
  }

  chunks.forEach((chunk, index) => {
    const lines = chunk.split('\n').map((line) => line.trim()).filter(Boolean);
    const header = lines.find((line) => countTokens(line, (token) => PERIOD_TOKEN_RE.test(token)) >= 1);
    const periodCount = header ? countTokens(header, (token) => PERIOD_TOKEN_RE.test(token)) : 0;

    if (!header) {
      issues.push(
        issue('warning', `no-header-${index + 1}`, `No period header in table ${index + 1}`, 'Add a header row naming the period(s), for example "2025   2024".')
      );
      return;
    }

    if (periodCount >= 2) {
      const shortRows = lines.filter((line) => {
        const numeric = countTokens(line, (token) => classifyNumber(token).kind === 'valid');
        return numeric > 0 && numeric < periodCount;
      });
      if (shortRows.length) {
        issues.push(
          issue('warning', `short-rows-${index + 1}`, `${shortRows.length} row(s) in table ${index + 1} have fewer values than periods`, `Expected ${periodCount} values per row; for example "${shortRows[0]}".`)
        );
      }
    } else if (splitRowCells(lines.find((line) => /\d/.test(line)) ?? '').length < 2) {
      issues.push(
        issue('warning', `single-column-${index + 1}`, `Table ${index + 1} looks like a single column`, 'Separate each label from its figures with a tab or spaces.')
      );
    }
  });

  return issues;
}

export function validateFile(file: File): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const name = (file.name || '').toLowerCase();
  const extension = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : '';
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    issues.push(
      issue('error', 'unsupported-type', `Unsupported file type${extension ? `: .${extension}` : ''}`, 'Upload a PDF, Excel (.xlsx / .xls) or CSV file.')
    );
  }
  if (file.size === 0) {
    issues.push(issue('error', 'empty-file', 'The file is empty', 'Choose a file that contains statement data.'));
  } else if (file.size > MAX_FILE_BYTES) {
    issues.push(issue('warning', 'large-file', 'Large file', 'Files over 25 MB can take a while to parse.'));
  }
  return issues;
}
