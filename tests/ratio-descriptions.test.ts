import { describe, expect, it } from 'vitest';
import { parseManualDocument } from '@/lib/engine/parser';
import { computeRatiosForDocument } from '@/lib/engine/ratios';

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

const EXPECTED_IDS = [
  'current-ratio',
  'quick-ratio',
  'cash-ratio',
  'defensive-interval-ratio',
  'times-interest-earned',
  'tie-cash-basis',
  'capex-to-operating-cash',
  'operating-cash-flow-ratio',
  'return-on-equity',
  'return-on-assets',
  'return-on-capital-employed',
  'gross-margin',
  'operating-margin',
  'net-profit-margin',
  'debt-to-equity',
  'equity-ratio',
  'debt-ratio',
  'financial-leverage',
  'asset-to-equity',
  'ar-turnover',
  'ar-days',
  'asset-turnover',
  'inventory-turnover',
  'inventory-days',
  'sales-growth',
  'volume-growth',
  'pe-ratio',
  'ev-to-ebitda',
  'ev-to-ebit',
  'ev-to-revenue',
];

describe('ratio descriptions (CFI)', () => {
  it('exposes a description for every ratio', () => {
    expect(report.ratios).toHaveLength(EXPECTED_IDS.length);
    expect(report.ratios.map((ratio) => ratio.id).sort()).toEqual([...EXPECTED_IDS].sort());
  });

  it('provides non-empty measures, interpretation and benchmark text', () => {
    for (const ratio of report.ratios) {
      expect(ratio.description, `missing description for ${ratio.id}`).toBeDefined();
      expect(ratio.description.measures.length, `${ratio.id} measures`).toBeGreaterThan(0);
      expect(ratio.description.interpretation.length, `${ratio.id} interpretation`).toBeGreaterThan(0);
      expect(ratio.description.benchmark.length, `${ratio.id} benchmark`).toBeGreaterThan(0);
    }
  });

  it('gives each ratio its own distinct description (no generic fallback)', () => {
    const measures = report.ratios.map((ratio) => ratio.description.measures);
    expect(new Set(measures).size).toBe(EXPECTED_IDS.length);
    for (const ratio of report.ratios) {
      expect(ratio.description.benchmark).not.toBe('No universal benchmark; compare against industry peers.');
    }
  });

  it('does not overstate authority by labelling heuristics as CFI rules', () => {
    for (const ratio of report.ratios) {
      expect(ratio.description.benchmark.toLowerCase()).not.toContain('cfi rule of thumb');
    }
  });

  it('cites a CFI source page for every ratio', () => {
    for (const ratio of report.ratios) {
      const source = ratio.description.source;
      expect(source, `missing CFI source for ${ratio.id}`).toBeDefined();
      expect(source?.title.length ?? 0, `${ratio.id} source title`).toBeGreaterThan(0);
      expect(source?.url ?? '', `${ratio.id} source url`).toMatch(
        /^https:\/\/corporatefinanceinstitute\.com\/resources\//
      );
    }
  });

  it('shares one citation across the cash-basis and CAPEX pairs without duplicating a page per ratio', () => {
    const byId = new Map(report.ratios.map((ratio) => [ratio.id, ratio.description.source?.url]));
    expect(byId.get('tie-cash-basis')).toBe(byId.get('capex-to-operating-cash'));
  });
});
