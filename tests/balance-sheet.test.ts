import { describe, expect, it } from 'vitest';
import { parseFinancialText, parseManualDocument } from '@/lib/engine/parser';
import type { ParseManualInput } from '@/lib/engine/parser';
import { MANUAL_INPUT, PASTED_TEXT } from './fixtures';

function balanceInput(
  lines: { label: string; values: number[] }[],
  periods: string[] = ['2025']
): ParseManualInput {
  return { statements: [{ type: 'balance', periods, lines }] };
}

describe('balance sheet validation (Assets = Liabilities + Equity)', () => {
  it('validates every period of a balanced manual balance sheet', () => {
    const document = parseManualDocument(MANUAL_INPUT);
    expect(document.validations).toHaveLength(2);
    for (const validation of document.validations) {
      expect(validation.formula).toBe('Assets = Liabilities + Equity');
      expect(validation.balanced).toBe(true);
      expect(validation.difference).toBe(0);
      expect(validation.message).toMatch(/Balanced/);
    }
    expect(document.warnings.filter((warning) => warning.includes('does not balance'))).toHaveLength(0);
  });

  it('detects an out-of-balance sheet and quantifies the gap', () => {
    const document = parseManualDocument(
      balanceInput([
        { label: 'Total Assets', values: [10000] },
        { label: 'Total Liabilities', values: [3500] },
        { label: "Total Shareholders' Equity", values: [6000] },
      ])
    );
    const validation = document.validations[0];
    expect(validation.balanced).toBe(false);
    expect(validation.totalAssets).toBe(10000);
    expect(validation.totalLiabilities).toBe(3500);
    expect(validation.totalEquity).toBe(6000);
    expect(validation.difference).toBe(500);
    expect(validation.relativeDifference).toBeCloseTo(500 / 9500, 6);
    expect(validation.message).toMatch(/Out of balance/);
    expect(document.warnings.some((warning) => warning.includes('does not balance'))).toBe(true);
  });

  it('prefers an explicit Total Liabilities and Equity line for the right-hand side', () => {
    const document = parseManualDocument(
      balanceInput([
        { label: 'Total Assets', values: [10000] },
        { label: 'Total Liabilities', values: [3500] },
        { label: "Total Shareholders' Equity", values: [6500] },
        { label: 'Total Liabilities and Equity', values: [10000] },
      ])
    );
    const validation = document.validations[0];
    expect(validation.totalLiabilitiesAndEquity).toBe(10000);
    expect(validation.balanced).toBe(true);
    expect(validation.difference).toBe(0);
  });

  it('treats a sheet within tolerance as balanced', () => {
    const document = parseManualDocument(
      balanceInput([
        { label: 'Total Assets', values: [1000000] },
        { label: 'Total Liabilities', values: [400000] },
        { label: "Total Shareholders' Equity", values: [600400] },
      ])
    );
    const validation = document.validations[0];
    expect(validation.difference).toBe(-400);
    expect(validation.tolerance).toBeCloseTo(5002, 6);
    expect(validation.balanced).toBe(true);
  });

  it('validates the balance sheet recovered from pasted text', () => {
    const document = parseFinancialText({ text: PASTED_TEXT });
    expect(document.validations).toHaveLength(2);
    expect(document.validations.every((validation) => validation.balanced)).toBe(true);
  });
});
