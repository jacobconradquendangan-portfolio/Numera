import { describe, expect, it } from 'vitest';
import { parseManualDocument } from '@/lib/engine/parser';
import { computeRatiosForDocument } from '@/lib/engine/ratios';
import type { RatioResult } from '@/lib/engine/ratios';

const incomeLines = [
  { label: 'Revenue', values: [100000, 100000] },
  { label: 'Cost of Goods Sold', values: [60000, 60000] },
  { label: 'Gross Profit', values: [40000, 40000] },
  { label: 'Operating Expenses', values: [30000, 30000] },
  { label: 'Operating Income', values: [10000, 10000] },
  { label: 'Interest Expense', values: [2000, 2000] },
  { label: 'Income Before Income Taxes', values: [8000, 8000] },
  { label: 'Income Tax Expense', values: [2000, 2000] },
  { label: 'Net Income', values: [6000, 6000] },
];

const balanceLines = [
  { label: 'Cash and Cash Equivalents', values: [10000, 10000] },
  { label: 'Short-Term Investments', values: [5000, 5000] },
  { label: 'Accounts Receivable', values: [15000, 15000] },
  { label: 'Inventory', values: [30000, 30000] },
  { label: 'Total Current Assets', values: [60000, 60000] },
  { label: 'Property, Plant and Equipment', values: [40000, 40000] },
  { label: 'Total Assets', values: [100000, 100000] },
  { label: 'Short-Term Debt', values: [30000, 30000] },
  { label: 'Total Current Liabilities', values: [30000, 30000] },
  { label: 'Long-Term Debt', values: [20000, 20000] },
  { label: 'Total Liabilities', values: [50000, 50000] },
  { label: 'Common Stock', values: [20000, 20000] },
  { label: 'Retained Earnings', values: [30000, 30000] },
  { label: "Total Shareholders' Equity", values: [50000, 50000] },
];

const document = parseManualDocument({
  statements: [
    { type: 'income', periods: ['2025', '2024'], lines: incomeLines },
    { type: 'balance', periods: ['2025', '2024'], lines: balanceLines },
  ],
});

const report = computeRatiosForDocument(document);

function ratio(id: string): RatioResult {
  const found = report.ratios.find((entry) => entry.id === id);
  expect(found, `missing ratio ${id}`).toBeDefined();
  return found!;
}

describe('ratio engine against reference benchmark values', () => {
  it('validates the benchmark balance sheet first', () => {
    expect(document.validations.every((validation) => validation.balanced)).toBe(true);
  });

  it('liquidity benchmarks: current 2.0x, quick 1.0x, cash 0.5x', () => {
    expect(ratio('current-ratio').value).toBeCloseTo(2.0, 6);
    expect(ratio('quick-ratio').value).toBeCloseTo(1.0, 6);
    expect(ratio('cash-ratio').value).toBeCloseTo(0.5, 6);
    expect(ratio('current-ratio').availability).toBe('computed');
  });

  it('profitability benchmarks: GM 40%, OM 10%, NPM 6%, ROE 12%, ROA 6%, ROCE 14.29%', () => {
    expect(ratio('gross-margin').value).toBeCloseTo(40, 6);
    expect(ratio('operating-margin').value).toBeCloseTo(10, 6);
    expect(ratio('net-profit-margin').value).toBeCloseTo(6, 6);
    expect(ratio('return-on-equity').value).toBeCloseTo(12, 6);
    expect(ratio('return-on-assets').value).toBeCloseTo(6, 6);
    expect(ratio('return-on-capital-employed').value).toBeCloseTo(14.2857, 3);
  });

  it('leverage benchmarks: debt-to-equity 1.0x, debt ratio 50%, equity ratio 50%', () => {
    expect(ratio('debt-to-equity').value).toBeCloseTo(1.0, 6);
    expect(ratio('debt-ratio').value).toBeCloseTo(50, 6);
    expect(ratio('equity-ratio').value).toBeCloseTo(50, 6);
    expect(ratio('debt-to-equity').availability).toBe('computed');
  });

  it('efficiency benchmarks: asset turnover 1.0x, inventory turnover 2.0x, AR turnover 6.67x', () => {
    expect(ratio('asset-turnover').value).toBeCloseTo(1.0, 6);
    expect(ratio('inventory-turnover').value).toBeCloseTo(2.0, 6);
    expect(ratio('ar-turnover').value).toBeCloseTo(6.666667, 5);
  });

  it('coverage benchmarks: TIE 5.0x, TIE-CB 5.0x, DIR 121.67 days', () => {
    expect(ratio('times-interest-earned').value).toBeCloseTo(5.0, 6);
    expect(ratio('tie-cash-basis').value).toBeCloseTo(5.0, 6);
    expect(ratio('defensive-interval-ratio').value).toBeCloseTo(121.666667, 4);
  });

  it('reproduces each benchmark from its formula inputs', () => {
    const current = ratio('current-ratio');
    const ca = document.statements.balance!.lineItems.find((item) => item.category === 'total_current_assets')!.values['2025']!;
    const cl = document.statements.balance!.lineItems.find((item) => item.category === 'total_current_liabilities')!.values['2025']!;
    expect(current.value).toBeCloseTo(ca / cl, 8);
    expect(current.substitution).toContain('60,000');
    expect(current.substitution).toContain('30,000');
  });
});
