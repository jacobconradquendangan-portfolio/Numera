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

  it('reports growth using period-over-period changes', () => {
    const growth = report.insights.find((insight) => insight.id === 'growth')!;
    const revenue = growth.points.find((point) => point.label === 'Revenue growth')!;
    expect(revenue.value).toContain('%');
    expect(growth.tone).toBe('positive');
  });

  it('returns no insights when nothing can be computed', () => {
    const empty = buildInsights({ report: computeRatiosForDocument(parseFinancialText({ text: '' })) });
    expect(empty.insights).toHaveLength(0);
    expect(empty.verdict).toMatch(/not enough data/i);
  });
});
