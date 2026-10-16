import { describe, expect, it } from 'vitest';
import { parseFinancialText } from '@/lib/engine/parser';
import { computeRatiosForDocument } from '@/lib/engine/ratios';
import type { RatioReport, RatioResult } from '@/lib/engine/ratios';
import { SAMPLE_TEXT } from '@/lib/sample';
import { SAMPLE_SUPPLEMENTAL_NUMERIC } from './fixtures';

const document = parseFinancialText({ text: SAMPLE_TEXT, filename: 'sample' });
const report: RatioReport = computeRatiosForDocument(document, {
  supplemental: SAMPLE_SUPPLEMENTAL_NUMERIC,
});

function ratio(id: string): RatioResult {
  const found = report.ratios.find((entry) => entry.id === id);
  expect(found, `expected ratio "${id}" to be computed`).toBeDefined();
  return found!;
}

describe('CFI ratio engine', () => {
  it('defaults to the latest period', () => {
    expect(report.period).toBe('2025');
  });

  it('liquidity ratios', () => {
    expect(ratio('current-ratio').value).toBeCloseTo(2.4, 4);
    expect(ratio('quick-ratio').value).toBeCloseTo(1.72, 4);
    expect(ratio('cash-ratio').value).toBeCloseTo(1.0, 4);
    expect(ratio('current-ratio').unit).toBe('times');
    expect(ratio('current-ratio').availability).toBe('computed');
  });

  it('profitability ratios', () => {
    expect(ratio('gross-margin').value).toBeCloseTo(40, 3);
    expect(ratio('operating-margin').value).toBeCloseTo(20.8, 3);
    expect(ratio('net-profit-margin').value).toBeCloseTo(15.36, 3);
    expect(ratio('return-on-equity').value).toBeCloseTo(26.8531, 3);
    expect(ratio('return-on-assets').value).toBeCloseTo(16.1006, 3);
    expect(ratio('return-on-capital-employed').value).toBeCloseTo(26, 3);
    expect(ratio('gross-margin').unit).toBe('percent');
    expect(ratio('gross-margin').display).toBe('40.00%');
  });

  it('leverage ratios', () => {
    expect(ratio('debt-to-equity').value).toBeCloseTo(0.346667, 5);
    expect(ratio('debt-ratio').value).toBeCloseTo(40, 3);
    expect(ratio('equity-ratio').value).toBeCloseTo(60, 3);
  });

  it('efficiency ratios use average balances across periods', () => {
    expect(ratio('ar-turnover').value).toBeCloseTo(7.352941, 4);
    expect(ratio('inventory-turnover').value).toBeCloseTo(5.357143, 4);
    expect(ratio('asset-turnover').value).toBeCloseTo(1.048218, 4);
    expect(ratio('inventory-days').value).toBeCloseTo(68.13, 2);
  });

  it('valuation ratios use the supplied market inputs', () => {
    expect(ratio('pe-ratio').value).toBeCloseTo(10.4167, 3);
    expect(ratio('ev-to-ebitda').value).toBeCloseTo(6.8667, 3);
    expect(ratio('ev-to-ebit').value).toBeCloseTo(7.9231, 3);
    expect(ratio('ev-to-revenue').value).toBeCloseTo(1.648, 3);
  });

  it('groups every ratio under its category', () => {
    expect(report.byCategory.liquidity.map((entry) => entry.id)).toContain('current-ratio');
    expect(report.byCategory.profitability.map((entry) => entry.id)).toContain('gross-margin');
    expect(report.byCategory.leverage.map((entry) => entry.id)).toContain('debt-to-equity');
    expect(report.byCategory.efficiency.map((entry) => entry.id)).toContain('asset-turnover');
    expect(report.byCategory.valuation.map((entry) => entry.id)).toContain('pe-ratio');
  });

  it('exposes a formula, substitution and step-by-step solution for auditability', () => {
    const current = ratio('current-ratio');
    expect(current.formula).toBe('Current Ratio = Current Assets / Current Liabilities');
    expect(current.substitution).toContain('600,000');
    expect(current.substitution).toContain('250,000');
    expect(current.steps.length).toBeGreaterThanOrEqual(3);
    expect(current.inputs.map((input) => input.key)).toContain('total_current_assets');
  });

  it('marks the revenue-proxy efficiency ratio as partial rather than unavailable', () => {
    expect(ratio('ar-turnover').availability).toBe('partial');
    expect(ratio('ar-turnover').notes.join(' ')).toMatch(/net credit sales/i);
  });

  it('reports unavailable ratios when statements are missing', () => {
    const empty = computeRatiosForDocument(parseFinancialText({ text: '' }));
    const current = empty.ratios.find((entry) => entry.id === 'current-ratio')!;
    expect(current.value).toBeNull();
    expect(current.display).toBe('n/a');
    expect(current.availability).toBe('unavailable');
  });
});
