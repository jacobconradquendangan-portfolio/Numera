import { describe, expect, it } from 'vitest';
import { parseFinancialText } from '@/lib/engine/parser';
import { analyzeDocument } from '@/lib/engine/analyzer';
import { computeRatiosForAllPeriods, computeRatiosForDocument } from '@/lib/engine/ratios';
import { buildInsights } from '@/lib/insights';
import { SAMPLE_TEXT } from '@/lib/sample';
import { SAMPLE_SUPPLEMENTAL_NUMERIC } from './fixtures';

const document = parseFinancialText({ text: SAMPLE_TEXT, filename: 'Sample statement' });
const history = computeRatiosForAllPeriods(document, { supplemental: SAMPLE_SUPPLEMENTAL_NUMERIC });
const analysis = analyzeDocument(document);
const report = buildInsights({ report: history[history.length - 1], history, analysis });

describe('financial health summary', () => {
  it('produces a verdict and dimension insights for the latest period', () => {
    expect(report.period).toBe('2025');
    expect(report.insights.length).toBeGreaterThan(3);
    expect(report.verdict.length).toBeGreaterThan(0);
    expect(report.strengths + report.watches).toBeGreaterThan(0);
  });

  it('covers the expected dimensions', () => {
    const ids = report.insights.map((insight) => insight.id);
    expect(ids).toContain('liquidity');
    expect(ids).toContain('profitability');
    expect(ids).toContain('leverage');
    expect(ids).toContain('growth');
  });

  it('flags strong profitability for the sample', () => {
    const profitability = report.insights.find((insight) => insight.id === 'profitability')!;
    expect(profitability.tone).toBe('positive');
    expect(profitability.points.map((point) => point.label)).toContain('Return on Equity (ROE)');
  });

  it('cites recognized rules of thumb rather than absolute targets', () => {
    const liquidity = report.insights.find((insight) => insight.id === 'liquidity')!;
    expect(liquidity.summary).toContain('2× current liabilities');
    expect(liquidity.summary).toContain('industry');
    const leverage = report.insights.find((insight) => insight.id === 'leverage')!;
    expect(leverage.tone).toBe('positive');
    const coverage = report.insights.find((insight) => insight.id === 'coverage')!;
    expect(coverage.summary).toContain('1.0×');
  });

  it('lists verifiable external references', () => {
    expect(report.references.length).toBeGreaterThan(3);
    expect(report.referenceNote).toMatch(/not audit standards/i);
    expect(new Set(report.references.map((reference) => reference.url)).size).toBe(report.references.length);
    for (const reference of report.references) {
      expect(reference.title.length).toBeGreaterThan(10);
      expect(reference.url).toMatch(/^https:\/\/corporatefinanceinstitute\.com\/resources\//);
    }
  });

  it('reports growth using period-over-period changes', () => {
    const growth = report.insights.find((insight) => insight.id === 'growth')!;
    const revenue = growth.points.find((point) => point.label === 'Revenue growth')!;
    expect(revenue.value).toContain('%');
    expect(growth.tone).toBe('positive');
  });

  it('flags a revenue-only contraction as a watch', () => {
    const text = [
      ['Line Item', '2025', '2024', '2023'].join('\t'),
      ['Revenue', '222', '2,222', '1,111'].join('\t'),
      ['Cost of Goods Sold', '100', '1,000', '500'].join('\t'),
    ].join('\n');
    const doc = parseFinancialText({ text });
    const run = buildInsights({
      report: computeRatiosForDocument(doc),
      history: computeRatiosForAllPeriods(doc),
      analysis: analyzeDocument(doc),
    });
    const growth = run.insights.find((insight) => insight.id === 'growth')!;
    expect(growth.tone).toBe('watch');
    expect(growth.summary).toContain('Revenue contracted');
    expect(growth.points.find((point) => point.label === 'Revenue growth')!.value).toBe('-90.01%');
  });

  it('returns no insights when nothing can be computed', () => {
    const empty = buildInsights({ report: computeRatiosForDocument(parseFinancialText({ text: '' })) });
    expect(empty.insights).toHaveLength(0);
    expect(empty.verdict).toMatch(/not enough data/i);
  });
});
