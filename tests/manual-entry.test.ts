import { describe, expect, it } from 'vitest';
import { parseManualDocument } from '@/lib/engine/parser';
import type { NormalizedStatement, ParsedDocument, StatementType } from '@/lib/engine/parser';
import { MANUAL_INPUT } from './fixtures';

function lineValues(
  document: ParsedDocument,
  statement: StatementType,
  category: string
): Record<string, number | null> {
  const parsed = document.statements[statement] as NormalizedStatement | null;
  expect(parsed).not.toBeNull();
  const item = parsed!.lineItems.find((line) => line.category === category);
  expect(item, `expected manual entry to map category "${category}"`).toBeDefined();
  return item!.values;
}

describe('manual data entry', () => {
  const document = parseManualDocument(MANUAL_INPUT);

  it('records the manual source with both statements', () => {
    expect(document.source.format).toBe('manual');
    expect(document.source.filename).toBe('manual-entry');
    expect(document.source.tableCount).toBe(2);
    expect(document.statements.income).not.toBeNull();
    expect(document.statements.balance).not.toBeNull();
  });

  it('maps canonical labels and keeps period order', () => {
    expect(document.statements.income!.periods).toEqual(['2025', '2024']);
    expect(lineValues(document, 'income', 'revenue')).toEqual({ 2025: 1000000, 2024: 900000 });
    expect(lineValues(document, 'income', 'net_income')).toEqual({ 2025: 208000, 2024: 169600 });
    expect(lineValues(document, 'balance', 'total_assets')).toEqual({ 2025: 500000, 2024: 450000 });
  });

  it('matches case-insensitive and synonym labels', () => {
    const loose = parseManualDocument({
      statements: [
        {
          type: 'balance',
          periods: ['2025'],
          lines: [
            { label: 'total assets', values: [1000] },
            { label: 'TOTAL LIABILITIES', values: [400] },
            { label: 'shareholders equity', values: [600] },
          ],
        },
      ],
    });
    const categories = loose.statements.balance!.lineItems.map((line) => line.category);
    expect(categories).toContain('total_assets');
    expect(categories).toContain('total_liabilities');
    expect(categories).toContain('total_equity');
  });

  it('collects unmatched labels as unmapped without dropping the statement', () => {
    const documentWithGap = parseManualDocument({
      statements: [
        {
          type: 'balance',
          periods: ['2025'],
          lines: [
            { label: 'Total Assets', values: [1000] },
            { label: 'Total Liabilities', values: [400] },
            { label: "Total Shareholders' Equity", values: [600] },
            { label: 'Preferred Stock', values: [100] },
          ],
        },
      ],
    });
    expect(documentWithGap.statements.balance).not.toBeNull();
    expect(documentWithGap.statements.balance!.unmappedLabels).toContain('Preferred Stock');
  });

  it('ignores lines that carry no value', () => {
    const sparse = parseManualDocument({
      statements: [
        {
          type: 'income',
          periods: ['2025'],
          lines: [
            { label: 'Revenue', values: [500] },
            { label: 'Net Income', values: [50] },
            { label: 'Cost of Goods Sold', values: [null] },
          ],
        },
      ],
    });
    const categories = sparse.statements.income!.lineItems.map((line) => line.category);
    expect(categories).not.toContain('cost_of_goods_sold');
  });

  it('accepts numbers and numeric strings interchangeably', () => {
    const mixed = parseManualDocument({
      statements: [
        {
          type: 'income',
          periods: ['2025'],
          lines: [
            { label: 'Revenue', values: ['1,250,000'] },
            { label: 'Cost of Goods Sold', values: [750000] },
            { label: 'Net Income', values: [192000] },
          ],
        },
      ],
    });
    expect(lineValues(mixed, 'income', 'revenue')).toEqual({ 2025: 1250000 });
  });

  it('warns when no manual statement is supplied', () => {
    const empty = parseManualDocument({ statements: [] });
    expect(empty.statements.income).toBeNull();
    expect(empty.statements.balance).toBeNull();
    expect(empty.warnings.some((warning) => warning.includes('No manual line items'))).toBe(true);
  });
});
