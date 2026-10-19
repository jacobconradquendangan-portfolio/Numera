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

  it('prefers a supplied trailing-12-month net income for ROE and ROA', () => {
    const document = parseFinancialText({ text: SAMPLE_TEXT });
    const base = computeRatiosForDocument(document, { supplemental: SAMPLE_SUPPLEMENTAL_NUMERIC });
    const report = computeRatiosForDocument(document, {
      supplemental: {
        ...SAMPLE_SUPPLEMENTAL_NUMERIC,
        netIncomeTrailing12Months: 110000,
        netIncomeBasis: 'trailing',
      },
    });

    const baseRoe = findRatio(base, 'return-on-equity');
    const roe = findRatio(report, 'return-on-equity');
    const roa = findRatio(report, 'return-on-assets');
    expect(roe.substitution).toContain('110,000');
    expect(roa.substitution).toContain('110,000');
    expect(roe.value).not.toBeCloseTo(baseRoe.value ?? 0, 6);
    expect(roe.notes.join(' ')).toMatch(/trailing-12-month/i);
    expect(roa.notes.join(' ')).toMatch(/trailing-12-month/i);
  });

  it('derives trailing-12-month net income from a prior fiscal-year figure for ROE and ROA', () => {
    const income: Line[] = [
      { label: 'Revenue', values: [600000, 660000] },
      { label: 'Operating Income', values: [22000, 25000] },
      { label: 'Interest Expense', values: [15649, 18000] },
      { label: 'Income Tax Expense', values: [1681, 2500] },
      { label: 'Net Income', values: [7068, 9670] },
    ];
    const balance: Line[] = [
      { label: 'Total Assets', values: [445769, 468802] },
      { label: 'Total Liabilities', values: [346109, 355383] },
      { label: "Total Shareholders' Equity", values: [99660, 113419] },
    ];
    const base = buildDocument(['2024', '2025'], income, balance);
    const document = {
      ...base,
      annualNetIncome: { '2024': { value: 8471, source: 'Segment note, net income row for FY2024' } },
    };

    const period = computeRatiosForDocument(document);
    expect(findRatio(period, 'return-on-equity').substitution).toContain('9,670');

    const report = computeRatiosForDocument(document, { supplemental: { netIncomeBasis: 'trailing' } });
    const roe = findRatio(report, 'return-on-equity');
    const roa = findRatio(report, 'return-on-assets');

    expect(roe.substitution).toContain('11,073');
    expect(roa.substitution).toContain('11,073');
    expect(roe.value).toBeCloseTo(10.3934, 3);
    expect(roa.value).toBeCloseTo(2.4214, 3);
    expect(roe.notes.join(' ')).toMatch(/trailing-12-month/i);
    expect(roe.inputs.some((input) => /FY2024/.test(input.source))).toBe(true);
  });

  it('lets a manual trailing-12-month override take precedence over auto-derivation', () => {
    const income: Line[] = [
      { label: 'Revenue', values: [600000, 660000] },
      { label: 'Net Income', values: [7068, 9670] },
    ];
    const balance: Line[] = [
      { label: 'Total Assets', values: [445769, 468802] },
      { label: "Total Shareholders' Equity", values: [99660, 113419] },
    ];
    const document = {
      ...buildDocument(['2024', '2025'], income, balance),
      annualNetIncome: { '2024': { value: 8471, source: 'Segment note' } },
    };

    const report = computeRatiosForDocument(document, {
      supplemental: { netIncomeBasis: 'trailing', netIncomeTrailing12Months: 99999 },
    });
    const roe = findRatio(report, 'return-on-equity');
    expect(roe.substitution).toContain('99,999');
    expect(roe.substitution).not.toContain('11,073');
  });

  it('falls back to the reported period when trailing net income cannot be derived', () => {
    const income: Line[] = [
      { label: 'Revenue', values: [600000, 660000] },
      { label: 'Net Income', values: [7068, 9670] },
    ];
    const balance: Line[] = [
      { label: 'Total Assets', values: [445769, 468802] },
      { label: "Total Shareholders' Equity", values: [99660, 113419] },
    ];
    const report = computeRatiosForDocument(buildDocument(['2024', '2025'], income, balance), {
      supplemental: { netIncomeBasis: 'trailing' },
    });
    const roe = findRatio(report, 'return-on-equity');
    expect(roe.substitution).toContain('9,670');
    expect(roe.notes.join(' ')).toMatch(/could not be derived/i);
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

  it('treats interest expense as a positive coverage denominator and derives operating income', () => {
    const report = computeRatiosForDocument(
      buildDocument(
        ['2025'],
        [
          { label: 'Revenue', values: [100000] },
          { label: 'Cost of Goods Sold', values: [60000] },
          { label: 'Gross Profit', values: [40000] },
          { label: 'Selling and Administrative Expenses', values: [-20000] },
          { label: 'Other Operating Income', values: [5000] },
          { label: 'Interest Expense', values: [-2000] },
          { label: 'Income Before Income Tax', values: [23000] },
          { label: 'Net Income', values: [20000] },
        ],
        null
      )
    );

    const tie = findRatio(report, 'times-interest-earned');
    expect(tie.value).toBeCloseTo(12.5, 6);

    const operatingMargin = findRatio(report, 'operating-margin');
    expect(operatingMargin.value).toBeCloseTo(25, 6);
    expect(operatingMargin.substitution).toContain('25,000');
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
