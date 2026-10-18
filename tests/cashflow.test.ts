import { describe, expect, it } from 'vitest';
import { parseManualDocument } from '@/lib/engine/parser';
import { computeRatiosForDocument } from '@/lib/engine/ratios';
import type { RatioReport, RatioResult } from '@/lib/engine/ratios';
import type { ManualLineInput, StatementType } from '@/lib/engine/parser';

const PERIODS = ['2025'];

const input = {
  statements: [
    {
      type: 'income' as StatementType,
      periods: PERIODS,
      lines: [
        { label: 'Revenue', values: [1000000] },
        { label: 'Net Income', values: [208000] },
      ],
    },
    {
      type: 'balance' as StatementType,
      periods: PERIODS,
      lines: [
        { label: 'Cash and Cash Equivalents', values: [100000] },
        { label: 'Total Current Assets', values: [250000] },
        { label: 'Total Current Liabilities', values: [100000] },
        { label: 'Total Assets', values: [500000] },
        { label: 'Total Liabilities', values: [200000] },
        { label: "Total Shareholders' Equity", values: [300000] },
      ],
    },
    {
      type: 'cashflow' as StatementType,
      periods: PERIODS,
      lines: [
        { label: 'Net Cash from Operating Activities', values: [150000] },
        { label: 'Net Cash from Investing Activities', values: [-60000] },
        { label: 'Capital Expenditures', values: [60000] },
        { label: 'Net Cash from Financing Activities', values: [-20000] },
      ],
    },
  ],
};

const document = parseManualDocument(input);
const report: RatioReport = computeRatiosForDocument(document);

function ratio(id: string): RatioResult {
  const found = report.ratios.find((entry) => entry.id === id);
  expect(found, `expected ratio "${id}" to be computed`).toBeDefined();
  return found!;
}

describe('cash flow statement support', () => {
  it('parses and maps cash flow line items', () => {
    const cashflow = document.statements.cashflow;
    expect(cashflow).not.toBeNull();
    expect(cashflow!.periods).toEqual(PERIODS);
    const categories = cashflow!.lineItems.map((line) => line.category);
    expect(categories).toContain('net_cash_from_operating_activities');
    expect(categories).toContain('capital_expenditures');
    expect(categories).toContain('net_cash_from_financing_activities');
  });

  it('derives the net change in cash from the three activity totals', () => {
    const netChange = document.statements.cashflow!.lineItems.find(
      (line) => line.category === 'net_change_in_cash'
    );
    expect(netChange).toBeDefined();
    expect(netChange!.values['2025']).toBe(70000);
  });

  it('computes cash flow ratios from the statement', () => {
    expect(ratio('capex-to-operating-cash').value).toBeCloseTo(0.4, 6);
    expect(ratio('operating-cash-flow-ratio').value).toBeCloseTo(1.5, 6);
    expect(ratio('capex-to-operating-cash').availability).toBe('computed');
    expect(ratio('operating-cash-flow-ratio').inputs.map((entry) => entry.source)).toContain('Cash Flow Statement');
  });

  it('flags cash flow ratios unavailable when no statement is supplied', () => {
    const withoutCashflow = parseManualDocument({
      statements: input.statements.filter((statement) => statement.type !== 'cashflow') as {
        type: StatementType;
        periods: string[];
        lines: ManualLineInput[];
      }[],
    });
    const fallback = computeRatiosForDocument(withoutCashflow);
    const capex = fallback.ratios.find((entry) => entry.id === 'capex-to-operating-cash')!;
    expect(capex.value).toBeNull();
    expect(capex.availability).toBe('unavailable');
  });
});
