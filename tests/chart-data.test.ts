import { describe, expect, it } from 'vitest';
import { parseManualDocument } from '@/lib/engine/parser';
import { computeRatiosForAllPeriods } from '@/lib/engine/ratios';
import type { RatioReport } from '@/lib/engine/ratios';
import {
  buildCapitalStructureData,
  buildCommonSizeData,
  buildDuPontData,
  buildHeatTableData,
  buildRatioTrendData,
  buildWorkingCapitalData,
  type CommonSizePoint,
} from '@/lib/chartData';

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

const dashboardDocument = parseManualDocument({
  statements: [
    {
      type: 'income',
      periods: ['2025', '2024', '2023'],
      lines: [
        { label: 'Revenue', values: [100000, 100000, 100000] },
        { label: 'Cost of Goods Sold', values: [60000, 60000, 60000] },
        { label: 'Operating Expenses', values: [20000, 20000, 20000] },
        { label: 'Net Income', values: [6000, 6000, 6000] },
      ],
    },
    {
      type: 'balance',
      periods: ['2025', '2024', '2023'],
      lines: [
        { label: 'Cash and Cash Equivalents', values: [10000, 10000, 10000] },
        { label: 'Accounts Receivable', values: [15000, 15000, 15000] },
        { label: 'Inventory', values: [30000, 30000, 30000] },
        { label: 'Total Assets', values: [100000, 100000, 100000] },
        { label: 'Total Liabilities', values: [40000, 50000, 60000] },
        { label: "Total Shareholders' Equity", values: [60000, 50000, 40000] },
      ],
    },
  ],
});

const dashboardReports: RatioReport[] = computeRatiosForAllPeriods(dashboardDocument);

function ratioValue(report: RatioReport, id: string): number {
  const found = report.ratios.find((entry) => entry.id === id);
  expect(found, `missing ratio ${id}`).toBeDefined();
  return found!.value ?? NaN;
}

describe('buildDuPontData', () => {
  it('maps each phase from the computed ratios', () => {
    const data = buildDuPontData(dashboardReports);
    expect(data.map((row) => row.period)).toEqual(['2023', '2024', '2025']);
    const row2025 = data.find((row) => row.period === '2025')!;
    const report = dashboardReports.find((entry) => entry.period === '2025')!;
    expect(row2025.netMargin).toBeCloseTo(ratioValue(report, 'net-profit-margin'), 6);
    expect(row2025.assetTurnover).toBeCloseTo(ratioValue(report, 'asset-turnover'), 6);
    expect(row2025.equityMultiplier).toBeCloseTo(1 + ratioValue(report, 'debt-to-equity'), 6);
    expect(row2025.roe).toBeCloseTo(ratioValue(report, 'return-on-equity'), 6);
  });

  it('stays within two points of the reported ROE when phases are present', () => {
    const data = buildDuPontData(dashboardReports);
    for (const row of data) {
      if (row.netMargin === null || row.assetTurnover === null || row.equityMultiplier === null) continue;
      const product = (row.netMargin / 100) * row.assetTurnover * row.equityMultiplier * 100;
      expect(product).toBeCloseTo(row.roe ?? NaN, -1);
    }
  });

  it('leaves turnover null without a balance sheet', () => {
    const document = parseManualDocument({
      statements: [
        {
          type: 'income',
          periods: ['2025', '2024'],
          lines: [
            { label: 'Revenue', values: [1000, 800] },
            { label: 'Net Income', values: [100, 80] },
          ],
        },
      ],
    });
    const data = buildDuPontData(computeRatiosForAllPeriods(document));
    expect(data[1].netMargin).toBeCloseTo(10, 6);
    expect(data[1].assetTurnover).toBeNull();
    expect(data[1].equityMultiplier).toBeNull();
  });
});

describe('buildCapitalStructureData', () => {
  it('pairs liabilities and equity per period', () => {
    const data = buildCapitalStructureData(dashboardDocument.statements.balance);
    expect(data.map((row) => row.period)).toEqual(['2023', '2024', '2025']);
    const row2025 = data.find((row) => row.period === '2025')!;
    expect(row2025.Liabilities).toBe(40000);
    expect(row2025.Equity).toBe(60000);
  });

  it('returns an empty array without a balance sheet', () => {
    expect(buildCapitalStructureData(null)).toEqual([]);
  });
});

describe('buildWorkingCapitalData', () => {
  it('maps the day-count ratios per period', () => {
    const data = buildWorkingCapitalData(dashboardReports);
    const row2025 = data.find((row) => row.period === '2025')!;
    const report = dashboardReports.find((entry) => entry.period === '2025')!;
    expect(row2025.arDays).toBeCloseTo(ratioValue(report, 'ar-days'), 6);
    expect(row2025.inventoryDays).toBeCloseTo(ratioValue(report, 'inventory-days'), 6);
    expect(row2025.dirDays).toBeCloseTo(ratioValue(report, 'defensive-interval-ratio'), 6);
  });
});

describe('buildHeatTableData', () => {
  it('tints direction against the prior period and orders ascending', () => {
    const rows = buildHeatTableData(dashboardReports, ['debt-to-equity', 'net-profit-margin']);
    const debtRow = rows[0];
    const report = dashboardReports[0];
    expect(debtRow.label).toBe(
      report.ratios.find((entry) => entry.id === 'debt-to-equity')!.name
    );
    expect(debtRow.cells[0].direction).toBeNull();
    expect(debtRow.cells[1].direction).toBe('down');
    expect(debtRow.cells[2].direction).toBe('down');
    const marginRow = rows[1];
    expect(marginRow.cells[1].direction).toBe('flat');
  });

  it('returns no rows without selection', () => {
    expect(buildHeatTableData(dashboardReports, [])).toEqual([]);
  });

  it('shows an em dash for ratios a period lacks', () => {
    const incomeOnly = parseManualDocument({
      statements: [
        {
          type: 'income',
          periods: ['2025', '2024'],
          lines: [
            { label: 'Revenue', values: [1000, 800] },
            { label: 'Net Income', values: [100, 80] },
          ],
        },
      ],
    });
    const reports = computeRatiosForAllPeriods(incomeOnly);
    const rows = buildHeatTableData(reports, ['current-ratio']);
    expect(rows[0].cells[0].display).toBe('n/a');
    expect(rows[0].cells[0].direction).toBeNull();
  });
});

describe('buildRatioTrendData with a selection', () => {
  it('uses the chosen ratio ids as series names', () => {
    const roeName = dashboardReports[0].ratios.find((entry) => entry.id === 'return-on-equity')!.name;
    const { series, data } = buildRatioTrendData(dashboardReports, ['return-on-equity']);
    expect(series.map((entry) => entry.key)).toEqual([roeName]);
    expect(series[0].key in data[0]).toBe(true);
  });

  it('keeps the default four series without a selection', () => {
    const { series } = buildRatioTrendData(dashboardReports);
    expect(series.map((entry) => entry.key)).toEqual(['Gross margin', 'Net margin', 'ROA', 'ROE']);
  });

  it('plots nothing when the selection is empty', () => {
    const { series, data } = buildRatioTrendData(dashboardReports, []);
    expect(series).toEqual([]);
    expect(data).toHaveLength(dashboardReports.length);
  });
});
