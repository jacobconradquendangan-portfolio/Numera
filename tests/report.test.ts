import { describe, expect, it } from 'vitest';
import { parseManualDocument } from '@/lib/engine/parser';
import { analyzeDocument } from '@/lib/engine/analyzer';
import { computeRatiosForAllPeriods } from '@/lib/engine/ratios';
import {
  buildReport,
  buildReportMeta,
  describeScope,
  documentSourceLabel,
  reportPeriods,
} from '@/lib/report';
import type { AnalyzeSuccess } from '@/lib/types';
import { BALANCE_MANUAL, INCOME_MANUAL } from './fixtures';

function buildResult(): AnalyzeSuccess {
  const document = parseManualDocument({ statements: [INCOME_MANUAL, BALANCE_MANUAL] });
  const analysis = analyzeDocument(document);
  const ratioHistory = computeRatiosForAllPeriods(document);
  return {
    ok: true,
    document,
    analysis,
    ratios: ratioHistory[ratioHistory.length - 1],
    ratioHistory,
  };
}

const result = buildResult();

describe('report summary helpers', () => {
  it('lists periods in ascending order from the ratio history', () => {
    expect(reportPeriods(result)).toEqual(['2024', '2025']);
  });

  it('labels the document source by format and table count', () => {
    const label = documentSourceLabel(result);
    expect(label).toContain('Manual entry');
    expect(label).toContain('2 tables');
    expect(documentSourceLabel(result, 'manual-entry')).toContain('manual-entry');
  });

  it('describes the selected scope with the chosen period', () => {
    expect(describeScope('selected', ['2024', '2025'], '2025')).toBe('Selected period (2025)');
  });

  it('describes the all-periods scope as a range', () => {
    expect(describeScope('all', ['2024', '2025'], '2025')).toBe('All periods (2024 – 2025)');
    expect(describeScope('all', ['2025'], '2025')).toBe('All periods (2025)');
    expect(describeScope('all', [], '2025')).toBe('All periods');
  });

  it('builds a report header with source, scope, periods and basis', () => {
    const meta = buildReportMeta(result, {
      scope: 'all',
      selectedPeriod: '2025',
      dayCountBasis: 365,
      filename: 'manual-entry',
    });
    expect(meta.lines.map((line) => line.label)).toEqual([
      'Source',
      'Scope',
      'Periods',
      'Statement scale',
      'Day-count basis',
    ]);
    expect(meta.scopeLabel).toBe('All periods (2024 – 2025)');
    expect(meta.generatedAt.length).toBeGreaterThan(0);
    expect(meta.lines.find((line) => line.label === 'Periods')?.value).toBe('2024 · 2025');
    expect(meta.lines.find((line) => line.label === 'Day-count basis')?.value).toBe('365 days');
  });
});

describe('buildReport — text summary document', () => {
  it('covers every period when the scope is all', () => {
    const report = buildReport(result, { scope: 'all', selectedPeriod: '2025', dayCountBasis: 365 });
    expect(report.periods).toEqual(['2024', '2025']);
    expect(report.overview.columns).toEqual(['Metric', '2024', '2025']);
    expect(report.ratioPeriods.map((entry) => entry.period)).toEqual(['2024', '2025']);
  });

  it('limits the document to the selected period when scoped', () => {
    const report = buildReport(result, { scope: 'selected', selectedPeriod: '2024', dayCountBasis: 365 });
    expect(report.periods).toEqual(['2024']);
    expect(report.overview.columns).toEqual(['Metric', '2024']);
    expect(report.ratioPeriods.map((entry) => entry.period)).toEqual(['2024']);
  });

  it('renders key figures as formatted text rows', () => {
    const report = buildReport(result, { scope: 'all', selectedPeriod: '2025', dayCountBasis: 365 });
    const revenue = report.overview.rows.find((row) => row.label === 'Revenue');
    expect(revenue?.cells).toEqual(['900,000', '1,000,000']);
    const equity = report.overview.rows.find((row) => row.label === "Shareholders' equity");
    expect(equity?.cells).toEqual(['260,000', '300,000']);
  });

  it('reports balance-sheet integrity per period', () => {
    const report = buildReport(result, { scope: 'all', selectedPeriod: '2025', dayCountBasis: 365 });
    expect(report.integrity).toHaveLength(2);
    for (const entry of report.integrity) {
      expect(entry.balanced).toBe(true);
      expect(entry.equation).toContain('=');
    }
  });

  it('produces vertical and horizontal text tables', () => {
    const report = buildReport(result, { scope: 'all', selectedPeriod: '2025', dayCountBasis: 365 });
    expect(report.incomeVertical?.columns).toEqual(['Line item', '2024', '2025']);
    expect(report.balanceVertical).not.toBeNull();
    expect(report.incomeHorizontal?.rows.length).toBeGreaterThan(0);
    expect(report.balanceHorizontal).not.toBeNull();
  });

  it('carries the full ratio audit trail for each period', () => {
    const report = buildReport(result, { scope: 'all', selectedPeriod: '2025', dayCountBasis: 365 });
    const allRatios = report.ratioPeriods.flatMap((entry) => entry.categories.flatMap((category) => category.ratios));
    expect(allRatios.length).toBeGreaterThan(0);

    const currentRatio = report.ratioPeriods[1].categories
      .find((category) => category.key === 'liquidity')
      ?.ratios.find((ratio) => ratio.name.includes('Current'));
    expect(currentRatio).toBeDefined();
    expect(currentRatio?.formula.length).toBeGreaterThan(0);
    expect(currentRatio?.substitution.length).toBeGreaterThan(0);
    expect(currentRatio?.measures.length).toBeGreaterThan(0);
    expect(currentRatio?.interpretation.length).toBeGreaterThan(0);
    expect(currentRatio?.guidance.length).toBeGreaterThan(0);
    expect(currentRatio?.steps.length).toBeGreaterThan(0);
    expect(currentRatio?.inputs.length).toBeGreaterThan(0);
    for (const step of currentRatio?.steps ?? []) expect(step.expression.length).toBeGreaterThan(0);
    for (const input of currentRatio?.inputs ?? []) expect(input.source.length).toBeGreaterThan(0);
  });

  it('counts resolved ratios per category', () => {
    const report = buildReport(result, { scope: 'all', selectedPeriod: '2025', dayCountBasis: 365 });
    const liquidity = report.ratioPeriods[0].categories.find((category) => category.key === 'liquidity');
    expect(liquidity?.total).toBeGreaterThan(0);
    expect(liquidity?.resolved).toBeGreaterThan(0);
    expect(liquidity?.resolved).toBeLessThanOrEqual(liquidity?.total ?? 0);
  });
});
