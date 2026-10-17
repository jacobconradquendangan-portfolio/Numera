import { describe, expect, it } from 'vitest';
import { parseManualDocument } from '@/lib/engine/parser';
import { buildCommonSizeData, type CommonSizePoint } from '@/lib/chartData';

const completeIncome = {
  type: 'income' as const,
  periods: ['2025', '2024'],
  lines: [
    { label: 'Revenue', values: [1000, 800] },
    { label: 'Cost of Goods Sold', values: [600, 500] },
    { label: 'Gross Profit', values: [400, 300] },
    { label: 'Operating Expenses', values: [200, 160] },
    { label: 'Operating Income', values: [200, 140] },
    { label: 'Interest Expense', values: [20, 15] },
    { label: 'Income Tax Expense', values: [40, 25] },
    { label: 'Net Income', values: [140, 100] },
  ],
};

function sum(point: CommonSizePoint): number {
  return (
    point['Cost of Goods Sold'] +
    point['Operating Expenses'] +
    point['Interest & Taxes'] +
    point['Net Income']
  );
}

describe('buildCommonSizeData (vertical analysis)', () => {
  it('expresses each line as a percentage of revenue summing to 100%', () => {
    const document = parseManualDocument({ statements: [completeIncome] });
    const data = buildCommonSizeData(document.statements.income);
    expect(data).toHaveLength(2);

    const point = data.find((entry) => entry.period === '2025')!;
    expect(point['Cost of Goods Sold']).toBeCloseTo(60, 1);
    expect(point['Operating Expenses']).toBeCloseTo(20, 1);
    expect(point['Interest & Taxes']).toBeCloseTo(6, 1);
    expect(point['Net Income']).toBeCloseTo(14, 1);
    expect(sum(point)).toBeCloseTo(100, 1);
  });

  it('orders periods chronologically', () => {
    const document = parseManualDocument({ statements: [completeIncome] });
    const data = buildCommonSizeData(document.statements.income);
    expect(data.map((entry) => entry.period)).toEqual(['2024', '2025']);
  });

  it('accommodates five periods', () => {
    const document = parseManualDocument({
      statements: [
        {
          type: 'income',
          periods: ['2025', '2024', '2023', '2022', '2021'],
          lines: [
            { label: 'Revenue', values: [1000, 900, 800, 700, 600] },
            { label: 'Cost of Goods Sold', values: [600, 540, 480, 420, 360] },
            { label: 'Gross Profit', values: [400, 360, 320, 280, 240] },
            { label: 'Operating Expenses', values: [200, 180, 160, 140, 120] },
            { label: 'Operating Income', values: [200, 180, 160, 140, 120] },
            { label: 'Interest Expense', values: [20, 18, 16, 14, 12] },
            { label: 'Income Tax Expense', values: [40, 36, 32, 28, 24] },
            { label: 'Net Income', values: [140, 126, 112, 98, 84] },
          ],
        },
      ],
    });
    const data = buildCommonSizeData(document.statements.income);
    expect(data).toHaveLength(5);
    expect(data.map((entry) => entry.period)).toEqual(['2021', '2022', '2023', '2024', '2025']);
    for (const point of data) expect(sum(point)).toBeCloseTo(100, 1);
  });

  it('derives segments when detail lines are absent', () => {
    const document = parseManualDocument({
      statements: [
        {
          type: 'income',
          periods: ['2025'],
          lines: [
            { label: 'Revenue', values: [1000] },
            { label: 'Gross Profit', values: [400] },
            { label: 'Operating Income', values: [200] },
            { label: 'Net Income', values: [140] },
          ],
        },
      ],
    });
    const data = buildCommonSizeData(document.statements.income);
    const point = data[0];
    expect(point['Cost of Goods Sold']).toBeCloseTo(60, 1);
    expect(point['Operating Expenses']).toBeCloseTo(20, 1);
    expect(point['Interest & Taxes']).toBeCloseTo(6, 1);
    expect(sum(point)).toBeCloseTo(100, 1);
  });

  it('returns an empty array without an income statement', () => {
    expect(buildCommonSizeData(null)).toEqual([]);
  });

  it('skips periods without revenue', () => {
    const document = parseManualDocument({
      statements: [
        {
          type: 'income',
          periods: ['2025'],
          lines: [{ label: 'Net Income', values: [140] }],
        },
      ],
    });
    expect(buildCommonSizeData(document.statements.income)).toEqual([]);
  });
});
