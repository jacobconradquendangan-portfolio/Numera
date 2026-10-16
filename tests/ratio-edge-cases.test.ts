import { describe, expect, it } from 'vitest';
import { parseFinancialText, parseManualDocument } from '@/lib/engine/parser';
import type { ManualLineInput, StatementType } from '@/lib/engine/parser';
import { computeRatiosForDocument } from '@/lib/engine/ratios';
import type { RatioReport, RatioResult } from '@/lib/engine/ratios';
import { SAMPLE_TEXT } from '@/lib/sample';
import { SAMPLE_SUPPLEMENTAL_NUMERIC } from './fixtures';

interface Line {
  label: string;
  values: (number | null)[];
}

function buildDocument(periods: string[], income: Line[] | null, balance: Line[] | null) {
  const statements: { type: StatementType; periods: string[]; lines: ManualLineInput[] }[] = [];
  if (income) statements.push({ type: 'income', periods, lines: income as ManualLineInput[] });
  if (balance) statements.push({ type: 'balance', periods, lines: balance as ManualLineInput[] });
  return parseManualDocument({ statements });
}

function findRatio(report: RatioReport, id: string): RatioResult {
  const found = report.ratios.find((entry) => entry.id === id);
  expect(found, `missing ratio ${id}`).toBeDefined();
  return found!;
}

const YEAR_INCOME: Line[] = [
  { label: 'Revenue', values: [100000] },
  { label: 'Cost of Goods Sold', values: [60000] },
  { label: 'Gross Profit', values: [40000] },
  { label: 'Operating Expenses', values: [30000] },
  { label: 'Operating Income', values: [10000] },
  { label: 'Interest Expense', values: [2000] },
  { label: 'Net Income', values: [6000] },
];

const YEAR_BALANCE: Line[] = [
  { label: 'Cash and Cash Equivalents', values: [10000] },
  { label: 'Short-Term Investments', values: [5000] },
  { label: 'Accounts Receivable', values: [15000] },
  { label: 'Inventory', values: [30000] },
  { label: 'Total Current Assets', values: [60000] },
  { label: 'Total Assets', values: [100000] },
  { label: 'Total Current Liabilities', values: [30000] },
  { label: 'Total Liabilities', values: [50000] },
  { label: "Total Shareholders' Equity", values: [50000] },
];

describe('ratio edge cases: missing averages and zero denominators', () => {
  it('falls back to period-end balances when no prior period exists', () => {
    const report = computeRatiosForDocument(buildDocument(['2025'], YEAR_INCOME, YEAR_BALANCE));

    const roe = findRatio(report, 'return-on-equity');
    expect(roe.value).toBeCloseTo(12, 6);
    expect(roe.availability).toBe('partial');
    expect(roe.notes.join(' ')).toMatch(/fell back to period-end/i);

    const inventory = findRatio(report, 'inventory-turnover');
    expect(inventory.value).toBeCloseTo(2.0, 6);
    expect(inventory.availability).toBe('partial');
    expect(inventory.notes.join(' ')).toMatch(/fell back to period-end/i);
  });

  it('honours useAverageBalances=false by using period-end values', () => {
    const document = parseFinancialText({ text: SAMPLE_TEXT });
    const withAverage = computeRatiosForDocument(document, { supplemental: SAMPLE_SUPPLEMENTAL_NUMERIC });
    const periodEnd = computeRatiosForDocument(document, {
      supplemental: SAMPLE_SUPPLEMENTAL_NUMERIC,
      useAverageBalances: false,
    });

    const averageRoe = findRatio(withAverage, 'return-on-equity');
    expect(averageRoe.value).toBeCloseTo(26.8531, 3);
    expect(averageRoe.availability).toBe('computed');

    const periodEndRoe = findRatio(periodEnd, 'return-on-equity');
    expect(periodEndRoe.value).toBeCloseTo(25.6, 6);
    expect(periodEndRoe.availability).toBe('partial');
    expect(periodEndRoe.notes.join(' ')).toMatch(/fell back to period-end/i);
  });

  it('returns unavailable (not Infinity) when equity is zero', () => {
    const report = computeRatiosForDocument(
      buildDocument(['2025'], null, [
        { label: 'Total Assets', values: [1000] },
        { label: 'Total Liabilities', values: [1000] },
        { label: "Total Shareholders' Equity", values: [0] },
      ])
    );
    const debtToEquity = findRatio(report, 'debt-to-equity');
    expect(debtToEquity.value).toBeNull();
    expect(debtToEquity.display).toBe('n/a');
    expect(debtToEquity.availability).toBe('unavailable');
    expect(debtToEquity.notes.join(' ')).toMatch(/zero/i);
  });

  it('returns unavailable when current liabilities are zero', () => {
    const report = computeRatiosForDocument(
      buildDocument(['2025'], null, [
        { label: 'Total Current Assets', values: [1000] },
        { label: 'Total Current Liabilities', values: [0] },
      ])
    );
    const current = findRatio(report, 'current-ratio');
    expect(current.value).toBeNull();
    expect(current.availability).toBe('unavailable');
    expect(current.notes.join(' ')).toMatch(/zero/i);
  });

  it('returns unavailable when revenue is zero', () => {
    const report = computeRatiosForDocument(
      buildDocument(['2025'], [
        { label: 'Revenue', values: [0] },
        { label: 'Gross Profit', values: [100] },
      ], null)
    );
    const grossMargin = findRatio(report, 'gross-margin');
    expect(grossMargin.value).toBeNull();
    expect(grossMargin.availability).toBe('unavailable');
    expect(grossMargin.notes.join(' ')).toMatch(/zero/i);
  });

  it('returns unavailable when total assets are zero', () => {
    const report = computeRatiosForDocument(
      buildDocument(['2025'], null, [
        { label: 'Total Liabilities', values: [100] },
        { label: 'Total Assets', values: [0] },
      ])
    );
    const debtRatio = findRatio(report, 'debt-ratio');
    expect(debtRatio.value).toBeNull();
    expect(debtRatio.availability).toBe('unavailable');
    expect(debtRatio.notes.join(' ')).toMatch(/zero/i);
  });

  it('returns unavailable when interest expense is zero', () => {
    const report = computeRatiosForDocument(
      buildDocument(['2025'], [
        { label: 'Revenue', values: [2000] },
        { label: 'Operating Income', values: [1000] },
        { label: 'Interest Expense', values: [0] },
      ], null)
    );
    const tie = findRatio(report, 'times-interest-earned');
    expect(tie.value).toBeNull();
    expect(tie.availability).toBe('unavailable');
    expect(tie.notes.join(' ')).toMatch(/zero/i);
  });

  it('guards P/E against a zero shares-outstanding input', () => {
    const report = computeRatiosForDocument(buildDocument(['2025'], YEAR_INCOME, YEAR_BALANCE), {
      supplemental: { sharePrice: 25, sharesOutstanding: 0 },
    });
    const pe = findRatio(report, 'pe-ratio');
    expect(pe.value).toBeNull();
    expect(pe.display).toBe('n/a');
    expect(pe.availability).toBe('unavailable');
    expect(pe.notes.join(' ')).toMatch(/shares outstanding is zero/i);
  });

  it('leaves every computed ratio finite with no NaN under sparse data', () => {
    const report = computeRatiosForDocument(
      buildDocument(['2025'], [
        { label: 'Revenue', values: [1000] },
        { label: 'Net Income', values: [100] },
      ], [
        { label: 'Total Assets', values: [500] },
        { label: "Total Shareholders' Equity", values: [400] },
      ])
    );
    const computed = report.ratios.filter((entry) => entry.value !== null);
    expect(computed.length).toBeGreaterThan(0);
    for (const entry of computed) {
      expect(Number.isFinite(entry.value)).toBe(true);
      expect(Number.isNaN(entry.value)).toBe(false);
    }
  });
});
