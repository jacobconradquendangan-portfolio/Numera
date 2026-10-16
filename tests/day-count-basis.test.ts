import { describe, expect, it } from 'vitest';
import { parseManualDocument } from '@/lib/engine/parser';
import { computeRatiosForDocument } from '@/lib/engine/ratios';
import type { RatioResult } from '@/lib/engine/ratios';

const incomeLines = [
  { label: 'Revenue', values: [100000, 100000] },
  { label: 'Cost of Goods Sold', values: [60000, 60000] },
  { label: 'Operating Expenses', values: [30000, 30000] },
];

const balanceLines = [
  { label: 'Cash and Cash Equivalents', values: [10000, 10000] },
  { label: 'Short-Term Investments', values: [5000, 5000] },
  { label: 'Accounts Receivable', values: [15000, 15000] },
  { label: 'Inventory', values: [30000, 30000] },
  { label: 'Total Assets', values: [100000, 100000] },
  { label: 'Total Liabilities', values: [50000, 50000] },
  { label: "Total Shareholders' Equity", values: [50000, 50000] },
];

const document = parseManualDocument({
  statements: [
    { type: 'income', periods: ['2025', '2024'], lines: incomeLines },
    { type: 'balance', periods: ['2025', '2024'], lines: balanceLines },
  ],
});

function ratio(report: ReturnType<typeof computeRatiosForDocument>, id: string): RatioResult {
  const found = report.ratios.find((entry) => entry.id === id);
  expect(found, `missing ratio ${id}`).toBeDefined();
  return found!;
}

describe('configurable day-count basis', () => {
  it('defaults to 365 days', () => {
    const report = computeRatiosForDocument(document);
    expect(report.daysInYear).toBe(365);
    expect(ratio(report, 'ar-days').value).toBeCloseTo(54.75, 2);
    expect(ratio(report, 'inventory-days').value).toBeCloseTo(182.5, 2);
    expect(ratio(report, 'defensive-interval-ratio').value).toBeCloseTo(121.666667, 2);
    expect(ratio(report, 'ar-days').substitution).toContain('365 /');
  });

  it('honours a 360-day basis', () => {
    const report = computeRatiosForDocument(document, { daysInYear: 360 });
    expect(report.daysInYear).toBe(360);
    expect(ratio(report, 'ar-days').value).toBeCloseTo(54.0, 2);
    expect(ratio(report, 'inventory-days').value).toBeCloseTo(180.0, 2);
    expect(ratio(report, 'defensive-interval-ratio').value).toBeCloseTo(120.0, 2);
    expect(ratio(report, 'ar-days').substitution).toContain('360 /');
    expect(ratio(report, 'ar-days').formula).toContain('360');
  });

  it('falls back to 365 for an unsupported basis', () => {
    const report = computeRatiosForDocument(document, { daysInYear: 366 });
    expect(report.daysInYear).toBe(365);
    expect(ratio(report, 'ar-days').value).toBeCloseTo(54.75, 2);
  });
});
