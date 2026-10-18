import { describe, expect, it } from 'vitest';
import { parseFinancialText } from '@/lib/engine/parser';
import { analyzeDocument } from '@/lib/engine/analyzer';
import { computeRatiosForDocument } from '@/lib/engine/ratios';
import { SAMPLE_TEXT } from '@/lib/sample';
import { SAMPLE_SUPPLEMENTAL_NUMERIC } from './fixtures';

describe('end-to-end pipeline: paste text -> parse -> analyze -> CFI ratios', () => {
  const document = parseFinancialText({ text: SAMPLE_TEXT, filename: 'Sample statement' });
  const analysis = analyzeDocument(document);
  const report = computeRatiosForDocument(document, { supplemental: SAMPLE_SUPPLEMENTAL_NUMERIC });

  it('parses three statement tables across three periods', () => {
    expect(document.source.format).toBe('text');
    expect(document.source.tableCount).toBe(3);
    expect(document.statements.income!.periods).toEqual(['2025', '2024', '2023']);
    expect(document.statements.balance!.periods).toEqual(['2025', '2024', '2023']);
    expect(document.statements.cashflow!.periods).toEqual(['2025', '2024', '2023']);
  });

  it('validates the balance sheet for every period', () => {
    expect(document.validations).toHaveLength(3);
    for (const validation of document.validations) {
      expect(validation.balanced).toBe(true);
      expect(validation.difference).toBe(0);
    }
    expect(document.warnings).toHaveLength(0);
  });

  it('produces vertical and horizontal analysis for every statement', () => {
    expect(analysis.vertical.income).not.toBeNull();
    expect(analysis.vertical.balance).not.toBeNull();
    expect(analysis.vertical.cashflow).not.toBeNull();
    expect(analysis.horizontal.income).not.toBeNull();
    expect(analysis.horizontal.balance).not.toBeNull();
    expect(analysis.horizontal.cashflow).not.toBeNull();
  });

  it('bases vertical analysis on total revenue and total assets', () => {
    expect(analysis.vertical.income!.baseLabel).toBe('Revenue');
    expect(analysis.vertical.balance!.baseLabel).toBe('Total Assets');

    const cogs = analysis.vertical.income!.entries.find(
      (entry) => entry.category === 'cost_of_goods_sold' && entry.period === '2025'
    );
    expect(cogs?.percent).toBeCloseTo(60, 3);

    const cash = analysis.vertical.balance!.entries.find(
      (entry) => entry.category === 'cash_and_equivalents' && entry.period === '2025'
    );
    expect(cash?.percent).toBeCloseTo(16, 3);
  });

  it('computes horizontal growth between consecutive periods', () => {
    const revenue = analysis.horizontal.income!.entries.find((entry) => entry.category === 'revenue');
    const latest = revenue?.changes.find((change) => change.toPeriod === '2025');
    expect(latest?.absoluteChange).toBeCloseTo(150000, 4);
    expect(latest?.percentChange).toBeCloseTo(13.6364, 3);

    const prior = revenue?.changes.find((change) => change.toPeriod === '2024');
    expect(prior?.absoluteChange).toBeCloseTo(130000, 4);
    expect(prior?.percentChange).toBeCloseTo(13.4021, 3);
  });

  it('computes the full 26-ratio CFI suite with nothing unavailable', () => {
    expect(report.ratios).toHaveLength(26);
    expect(report.ratios.filter((entry) => entry.availability === 'unavailable')).toHaveLength(0);
  });

  it('cross-checks a liquidity ratio against the parsed statements', () => {
    const balance = document.statements.balance!;
    const currentAssets = balance.lineItems.find((item) => item.category === 'total_current_assets')!.values['2025']!;
    const currentLiabilities = balance.lineItems.find((item) => item.category === 'total_current_liabilities')!.values['2025']!;
    const expected = currentAssets / currentLiabilities;
    expect(report.ratios.find((entry) => entry.id === 'current-ratio')!.value).toBeCloseTo(expected, 6);
  });

  it('cross-checks gross margin against the parsed income statement', () => {
    const income = document.statements.income!;
    const revenue = income.lineItems.find((item) => item.category === 'revenue')!.values['2025']!;
    const grossProfit = income.lineItems.find((item) => item.category === 'gross_profit')!.values['2025']!;
    expect(report.ratios.find((entry) => entry.id === 'gross-margin')!.value).toBeCloseTo((grossProfit / revenue) * 100, 4);
  });
});
