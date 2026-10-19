import { describe, expect, it } from 'vitest';
import { buildVerification } from '@/lib/verify';
import type { VerifyManualRows, VerifyStatements } from '@/lib/verify';
import type { CategoryOption } from '@/lib/types';
import type { FinancialCategory, NormalizedLineItem, NormalizedStatement, Section, StatementType } from '@/lib/engine/parser';

const CATEGORIES: CategoryOption[] = [
  { key: 'revenue', label: 'Revenue', statement: 'income', section: 'revenue' },
  { key: 'net_income', label: 'Net Income', statement: 'income', section: 'profit' },
  { key: 'cost_of_goods_sold', label: 'Cost of Goods Sold', statement: 'income', section: 'costs' },
  { key: 'total_current_assets', label: 'Total Current Assets', statement: 'balance', section: 'assets' },
  { key: 'total_assets', label: 'Total Assets', statement: 'balance', section: 'assets' },
];

function item(
  category: FinancialCategory,
  statement: StatementType,
  values: Record<string, number | null>,
  options: { derived?: boolean; confidence?: number; rawLabel?: string; row?: number; section?: Section } = {}
): NormalizedLineItem {
  return {
    rawLabel: options.rawLabel ?? category,
    category,
    statement,
    section: options.section ?? ('assets' as Section),
    values,
    derived: options.derived ?? false,
    confidence: options.confidence ?? 1,
    source: { table: 'page 1', row: options.row ?? 2 },
  };
}

function statement(
  type: StatementType,
  periods: string[],
  lineItems: NormalizedLineItem[],
  unmappedLabels: string[] = []
): NormalizedStatement {
  return { type, periods, unitMultiplier: 1, lineItems, unmappedLabels, warnings: [] };
}

const emptyManual: VerifyManualRows = { income: [], balance: [], cashflow: [] };

describe('buildVerification', () => {
  const statements: VerifyStatements = {
    income: statement('income', ['2025'], [
      item('revenue', 'income', { '2025': 100000 }, { row: 2 }),
      item('net_income', 'income', { '2025': 1000 }, { row: 9 }),
      item('total_current_assets', 'balance', { '2025': 100000 }, { derived: true, row: -1, rawLabel: 'Total Current Assets' }),
      item('cost_of_goods_sold', 'income', { '2025': null }, { row: 3 }),
    ]),
    balance: statement('balance', ['2025'], [item('total_assets', 'balance', { '2025': 500000 }, { row: 12 })], ['Mystery Row']),
    cashflow: null,
  };

  it('classifies matched, mismatched, missing, extra, derived and blank cells', () => {
    const manual: VerifyManualRows = {
      income: [
        { label: 'Revenue', values: ['100000'] },
        { label: 'Net Income', values: ['999'] },
        { label: 'Total Current Assets', values: ['100000'] },
        { label: 'Interest Expense', values: ['5000'] },
      ],
      balance: [{ label: 'Total Assets', values: ['500000'] }],
      cashflow: [],
    };

    const report = buildVerification(statements, manual, ['2025'], CATEGORIES);

    const byLabel = new Map(report.rows.map((row) => [row.label, row]));
    expect(byLabel.get('Revenue')?.cells[0].status).toBe('match');
    expect(byLabel.get('Net Income')?.cells[0].status).toBe('mismatch');
    expect(byLabel.get('Total Current Assets')?.cells[0].status).toBe('derived');
    expect(byLabel.get('Cost of Goods Sold')?.cells[0].status).toBe('blank');
    expect(byLabel.get('Interest Expense')?.cells[0].status).toBe('extra');
    expect(byLabel.get('Total Assets')?.cells[0].status).toBe('match');

    expect(report.counts).toMatchObject({ match: 2, mismatch: 1, missing: 0, extra: 1, derived: 1 });
    expect(report.totalCompared).toBe(3);
    expect(report.accuracy).toBeCloseTo(2 / 3, 6);
  });

  it('reports unmapped labels per statement', () => {
    const report = buildVerification(statements, emptyManual, ['2025'], CATEGORIES);
    expect(report.unmatched).toEqual([{ type: 'balance', labels: ['Mystery Row'] }]);
  });

  it('flags parser values the manual grid is missing', () => {
    const report = buildVerification(statements, emptyManual, ['2025'], CATEGORIES);
    const revenue = report.rows.find((row) => row.label === 'Revenue');
    expect(revenue?.cells[0].status).toBe('missing');
    expect(report.counts.missing).toBe(3);
    expect(report.accuracy).toBe(0);
  });

  it('aligns manual values by period header regardless of column order', () => {
    const twoPeriod: VerifyStatements = {
      income: statement('income', ['2025', '2024'], [
        item('revenue', 'income', { '2025': 100000, '2024': 90000 }, { row: 2 }),
      ]),
      balance: null,
      cashflow: null,
    };
    const manual: VerifyManualRows = {
      income: [{ label: 'Revenue', values: ['90000', '100000'] }],
      balance: [],
      cashflow: [],
    };
    const report = buildVerification(twoPeriod, manual, ['2024', '2025'], CATEGORIES);
    const row = report.rows[0];
    expect(row.cells.map((cell) => cell.status)).toEqual(['match', 'match']);
  });

  it('raises accuracy as corrections bring the manual grid in line', () => {
    const manual: VerifyManualRows = {
      income: [
        { label: 'Revenue', values: ['100000'] },
        { label: 'Net Income', values: ['999'] },
        { label: 'Total Current Assets', values: ['100000'] },
      ],
      balance: [{ label: 'Total Assets', values: ['500000'] }],
      cashflow: [],
    };
    const before = buildVerification(statements, manual, ['2025'], CATEGORIES);
    const corrected: VerifyManualRows = {
      ...manual,
      income: manual.income.map((row) => (row.label === 'Net Income' ? { label: row.label, values: ['1000'] } : row)),
    };
    const after = buildVerification(statements, corrected, ['2025'], CATEGORIES);
    expect(after.accuracy).toBeGreaterThan(before.accuracy ?? 0);
    expect(after.counts.mismatch).toBe(0);
  });
});
