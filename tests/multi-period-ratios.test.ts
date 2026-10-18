import { describe, expect, it } from 'vitest';
import { parseManualDocument } from '@/lib/engine/parser';
import { computeRatiosForAllPeriods, listStatementPeriods } from '@/lib/engine/ratios';
import type { RatioReport, RatioResult } from '@/lib/engine/ratios';

const incomeLines = [
  { label: 'Revenue', values: [100000, 100000, 100000] },
  { label: 'Cost of Goods Sold', values: [60000, 60000, 60000] },
  { label: 'Operating Expenses', values: [20000, 20000, 20000] },
  { label: 'Net Income', values: [6000, 6000, 6000] },
];

const balanceLines = [
  { label: 'Cash and Cash Equivalents', values: [10000, 10000, 10000] },
  { label: 'Accounts Receivable', values: [15000, 15000, 15000] },
  { label: 'Inventory', values: [30000, 30000, 30000] },
  { label: 'Total Assets', values: [100000, 100000, 100000] },
  { label: 'Total Liabilities', values: [40000, 50000, 60000] },
  { label: "Total Shareholders' Equity", values: [60000, 50000, 40000] },
];

const document = parseManualDocument({
  statements: [
    { type: 'income', periods: ['2025', '2024', '2023'], lines: incomeLines },
    { type: 'balance', periods: ['2025', '2024', '2023'], lines: balanceLines },
  ],
});

function ratio(report: RatioReport, id: string): RatioResult {
  const found = report.ratios.find((entry) => entry.id === id);
  expect(found, `missing ratio ${id} in ${report.period}`).toBeDefined();
  return found!;
}

describe('multi-period ratio computation', () => {
  it('lists statement periods in ascending order', () => {
    expect(listStatementPeriods(document)).toEqual(['2023', '2024', '2025']);
  });

  it('produces one report per period in ascending order', () => {
    const reports = computeRatiosForAllPeriods(document);
    expect(reports.map((report) => report.period)).toEqual(['2023', '2024', '2025']);
    for (const report of reports) {
      expect(report.ratios).toHaveLength(27);
    }
  });

  it('uses average balances once a prior period exists', () => {
    const reports = computeRatiosForAllPeriods(document);
    const roe2025 = ratio(reports[2], 'return-on-equity');
    expect(roe2025.value).toBeCloseTo((6000 / 55000) * 100, 4);
    expect(roe2025.availability).toBe('computed');
    const roe2024 = ratio(reports[1], 'return-on-equity');
    expect(roe2024.value).toBeCloseTo((6000 / 45000) * 100, 4);
    expect(roe2024.availability).toBe('computed');
  });

  it('falls back to period-end balances for the earliest period', () => {
    const reports = computeRatiosForAllPeriods(document);
    const roe2023 = ratio(reports[0], 'return-on-equity');
    expect(roe2023.value).toBeCloseTo((6000 / 40000) * 100, 4);
    expect(roe2023.availability).toBe('partial');
    expect(roe2023.notes.join(' ')).toMatch(/period-end/i);
  });

  it('keeps day-based ratios consistent across periods', () => {
    const reports = computeRatiosForAllPeriods(document);
    for (const report of reports) {
      expect(ratio(report, 'ar-days').value).toBeCloseTo(54.75, 2);
    }
    const basis360 = computeRatiosForAllPeriods(document, { daysInYear: 360 });
    for (const report of basis360) {
      expect(report.daysInYear).toBe(360);
      expect(ratio(report, 'ar-days').value).toBeCloseTo(54.0, 2);
    }
  });

  it('handles a single-period document with one report', () => {
    const single = parseManualDocument({
      statements: [
        { type: 'income', periods: ['2025'], lines: incomeLines.map((line) => ({ ...line, values: [line.values[0]] })) },
        { type: 'balance', periods: ['2025'], lines: balanceLines.map((line) => ({ ...line, values: [line.values[0]] })) },
      ],
    });
    const reports = computeRatiosForAllPeriods(single);
    expect(reports).toHaveLength(1);
    expect(reports[0].period).toBe('2025');
  });

  it('returns no reports when no statements were parsed', () => {
    const empty = parseManualDocument({ statements: [] });
    expect(listStatementPeriods(empty)).toEqual([]);
    expect(computeRatiosForAllPeriods(empty)).toEqual([]);
  });
});
