import type { NormalizedStatement, RatioCategory, RatioReport } from '@/lib/types';

export interface TrendPoint {
  period: string;
  Revenue: number | null;
  'Gross Profit': number | null;
  'Net Income': number | null;
}

export interface RatioDatum {
  id: string;
  name: string;
  shortName: string;
  category: RatioCategory;
  value: number;
  display: string;
  unit: string;
}

export interface RatioTrendPoint {
  period: string;
  [series: string]: string | number | null;
}

export interface RatioTrendSeries {
  key: string;
  label: string;
  color: string;
}

export const CHART_COLORS = {
  revenue: '#8f6110',
  grossProfit: '#357a3d',
  netIncome: '#2f6478',
  liquidity: '#357a3d',
  leverage: '#8f6110',
  roe: '#6b5ca5',
  cogs: '#b5744a',
  opex: '#c98a2b',
  interestTax: '#6b5ca5',
  netProfit: '#357a3d',
  grid: '#e4dbc5',
  axis: '#cdc1a2',
  tick: '#6c6555',
  reference: '#cdc1a2',
  surface: '#fffdf8',
  border: '#e4dbc5',
  paper: '#23211a',
};

export interface CommonSizePoint {
  period: string;
  'Cost of Goods Sold': number;
  'Operating Expenses': number;
  'Interest & Taxes': number;
  'Net Income': number;
}

export const COMMON_SIZE_SERIES: { key: keyof Omit<CommonSizePoint, 'period'>; label: string; color: string }[] = [
  { key: 'Cost of Goods Sold', label: 'COGS', color: CHART_COLORS.cogs },
  { key: 'Operating Expenses', label: 'Operating expenses', color: CHART_COLORS.opex },
  { key: 'Interest & Taxes', label: 'Interest & taxes', color: CHART_COLORS.interestTax },
  { key: 'Net Income', label: 'Net income', color: CHART_COLORS.netProfit },
];

export const TREND_SERIES: { key: keyof Omit<TrendPoint, 'period'>; color: string }[] = [
  { key: 'Revenue', color: CHART_COLORS.revenue },
  { key: 'Gross Profit', color: CHART_COLORS.grossProfit },
  { key: 'Net Income', color: CHART_COLORS.netIncome },
];

const COMPARISON_SPECS: { id: string; short: string; category: RatioDatum['category'] }[] = [
  { id: 'current-ratio', short: 'Current', category: 'liquidity' },
  { id: 'quick-ratio', short: 'Quick', category: 'liquidity' },
  { id: 'cash-ratio', short: 'Cash', category: 'liquidity' },
  { id: 'debt-to-equity', short: 'Debt / Equity', category: 'leverage' },
  { id: 'debt-ratio', short: 'Debt Ratio', category: 'leverage' },
  { id: 'equity-ratio', short: 'Equity Ratio', category: 'leverage' },
];

function periodValue(statement: NormalizedStatement | null, category: string, period: string): number | null {
  const item = statement?.lineItems.find((entry) => entry.category === category);
  const value = item?.values[period];
  return value === null || value === undefined ? null : value;
}

function periodSortKey(period: string): number {
  const year = period.match(/\d{4}/);
  if (year) return Number(year[0]);
  const numeric = Number(period.replace(/[^0-9.]/g, ''));
  return /\d/.test(period) && Number.isFinite(numeric) ? numeric : Number.MAX_SAFE_INTEGER;
}

export function sortPeriodsAscending(periods: string[]): string[] {
  return [...periods].sort((a, b) => {
    const keyA = periodSortKey(a);
    const keyB = periodSortKey(b);
    if (keyA !== keyB) return keyA - keyB;
    return a.localeCompare(b);
  });
}

export function buildTrendData(income: NormalizedStatement | null): TrendPoint[] {
  if (!income) return [];
  return sortPeriodsAscending(income.periods).map((period) => ({
    period,
    Revenue: periodValue(income, 'revenue', period),
    'Gross Profit': periodValue(income, 'gross_profit', period),
    'Net Income': periodValue(income, 'net_income', period),
  }));
}

export function buildRatioComparisonData(report: RatioReport, selectedIds?: string[]): RatioDatum[] {
  const byId = new Map(report.ratios.map((ratio) => [ratio.id, ratio]));
  const data: RatioDatum[] = [];
  if (selectedIds?.length) {
    for (const id of selectedIds) {
      const ratio = byId.get(id);
      if (!ratio || ratio.value === null) continue;
      data.push({
        id: ratio.id,
        name: ratio.name,
        shortName: ratio.name,
        category: ratio.category,
        value: ratio.unit === 'percent' ? ratio.value / 100 : ratio.value,
        display: ratio.display,
        unit: ratio.unit,
      });
    }
    return data;
  }
  for (const spec of COMPARISON_SPECS) {
    const ratio = byId.get(spec.id);
    if (!ratio || ratio.value === null) continue;
    data.push({
      id: ratio.id,
      name: ratio.name,
      shortName: spec.short,
      category: spec.category,
      value: ratio.unit === 'percent' ? ratio.value / 100 : ratio.value,
      display: ratio.display,
      unit: ratio.unit,
    });
  }
  return data;
}

const RATIO_TREND_SPECS: { id: string; label: string; color: string }[] = [
  { id: 'gross-margin', label: 'Gross margin', color: CHART_COLORS.grossProfit },
  { id: 'net-profit-margin', label: 'Net margin', color: CHART_COLORS.netIncome },
  { id: 'return-on-assets', label: 'ROA', color: CHART_COLORS.leverage },
  { id: 'return-on-equity', label: 'ROE', color: CHART_COLORS.roe },
];

export const CUSTOM_SERIES_PALETTE = [
  CHART_COLORS.roe,
  CHART_COLORS.revenue,
  CHART_COLORS.netIncome,
  CHART_COLORS.grossProfit,
  CHART_COLORS.cogs,
  CHART_COLORS.liquidity,
  CHART_COLORS.leverage,
  CHART_COLORS.opex,
];

function ratioNameLookup(reports: RatioReport[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const report of reports) {
    for (const ratio of report.ratios) {
      if (!names.has(ratio.id)) names.set(ratio.id, ratio.name);
    }
  }
  return names;
}

export function buildRatioTrendData(
  reports: RatioReport[],
  selectedIds?: string[]
): { data: RatioTrendPoint[]; series: RatioTrendSeries[] } {
  const nameById = ratioNameLookup(reports);
  let specs: { id: string; label: string; color: string }[];
  if (selectedIds?.length) {
    specs = selectedIds.map((id, index) => ({
      id,
      label: nameById.get(id) ?? id,
      color: CUSTOM_SERIES_PALETTE[index % CUSTOM_SERIES_PALETTE.length],
    }));
  } else {
    specs = RATIO_TREND_SPECS;
  }
  const data: RatioTrendPoint[] = reports.map((report) => {
    const byId = new Map(report.ratios.map((ratio) => [ratio.id, ratio]));
    const point: RatioTrendPoint = { period: report.period };
    for (const spec of specs) {
      point[spec.label] = byId.get(spec.id)?.value ?? null;
    }
    return point;
  });
  const series: RatioTrendSeries[] = specs.map((spec) => ({
    key: spec.label,
    label: spec.label,
    color: spec.color,
  }));
  return { data, series };
}

function firstNumber(...values: (number | null)[]): number | null {
  for (const value of values) {
    if (value !== null && Number.isFinite(value)) return value;
  }
  return null;
}

function roundPercent(value: number): number {
  return Math.round(value * 10) / 10;
}

export function buildCommonSizeData(income: NormalizedStatement | null): CommonSizePoint[] {
  if (!income) return [];
  const points: CommonSizePoint[] = [];
  for (const period of sortPeriodsAscending(income.periods)) {
    const revenue = periodValue(income, 'revenue', period);
    if (revenue === null || revenue === 0) continue;

    const cogsRaw = periodValue(income, 'cost_of_goods_sold', period);
    const grossProfit = periodValue(income, 'gross_profit', period);
    const opexRaw = periodValue(income, 'operating_expenses', period);
    const operatingIncome = periodValue(income, 'operating_income', period);
    const interest = periodValue(income, 'interest_expense', period);
    const tax = periodValue(income, 'income_tax_expense', period);
    const netIncome = periodValue(income, 'net_income', period);

    const cogs = firstNumber(cogsRaw, grossProfit === null ? null : revenue - grossProfit) ?? 0;
    const opex = firstNumber(opexRaw, grossProfit === null || operatingIncome === null ? null : grossProfit - operatingIncome) ?? 0;
    const derivedInterestTax =
      operatingIncome === null || netIncome === null ? null : operatingIncome - netIncome;
    const explicitInterestTax = interest === null && tax === null ? null : (interest ?? 0) + (tax ?? 0);
    const interestTax = firstNumber(derivedInterestTax, explicitInterestTax) ?? 0;
    const net = netIncome ?? 0;

    points.push({
      period,
      'Cost of Goods Sold': roundPercent((cogs / revenue) * 100),
      'Operating Expenses': roundPercent((opex / revenue) * 100),
      'Interest & Taxes': roundPercent((interestTax / revenue) * 100),
      'Net Income': roundPercent((net / revenue) * 100),
    });
  }
  return points;
}

export interface DuPontPoint {
  period: string;
  netMargin: number | null;
  assetTurnover: number | null;
  equityMultiplier: number | null;
  roe: number | null;
}

export function buildDuPontData(reports: RatioReport[]): DuPontPoint[] {
  return [...reports]
    .sort((a, b) => periodSortKey(a.period) - periodSortKey(b.period) || a.period.localeCompare(b.period))
    .map((report) => {
      const byId = new Map(report.ratios.map((ratio) => [ratio.id, ratio]));
      return {
        period: report.period,
        netMargin: byId.get('net-profit-margin')?.value ?? null,
        assetTurnover: byId.get('asset-turnover')?.value ?? null,
        equityMultiplier: byId.get('debt-to-equity')?.value === null || byId.get('debt-to-equity') === undefined
          ? null
          : 1 + (byId.get('debt-to-equity')?.value ?? 0),
        roe: byId.get('return-on-equity')?.value ?? null,
      };
    });
}

export interface CapitalStructurePoint {
  period: string;
  Liabilities: number | null;
  Equity: number | null;
}

export function buildCapitalStructureData(balance: NormalizedStatement | null): CapitalStructurePoint[] {
  if (!balance) return [];
  return sortPeriodsAscending(balance.periods).map((period) => ({
    period,
    Liabilities: periodValue(balance, 'total_liabilities', period),
    Equity: periodValue(balance, 'total_equity', period),
  }));
}

export interface WorkingCapitalPoint {
  period: string;
  arDays: number | null;
  inventoryDays: number | null;
  dirDays: number | null;
}

export function buildWorkingCapitalData(reports: RatioReport[]): WorkingCapitalPoint[] {
  return [...reports]
    .sort((a, b) => periodSortKey(a.period) - periodSortKey(b.period) || a.period.localeCompare(b.period))
    .map((report) => {
      const byId = new Map(report.ratios.map((ratio) => [ratio.id, ratio]));
      return {
        period: report.period,
        arDays: byId.get('ar-days')?.value ?? null,
        inventoryDays: byId.get('inventory-days')?.value ?? null,
        dirDays: byId.get('defensive-interval-ratio')?.value ?? null,
      };
    });
}

export interface HeatCell {
  period: string;
  display: string;
  direction: 'up' | 'down' | 'flat' | null;
}

export interface HeatRow {
  id: string;
  label: string;
  cells: HeatCell[];
}

const DIRECTION_EPSILON = 1e-6;

export function buildHeatTableData(reports: RatioReport[], selectedIds: string[]): HeatRow[] {
  if (!selectedIds.length) return [];
  const nameById = ratioNameLookup(reports);
  const sorted = [...reports].sort(
    (a, b) => periodSortKey(a.period) - periodSortKey(b.period) || a.period.localeCompare(b.period)
  );
  const byPeriodId = new Map<string, Map<string, RatioReport['ratios'][number]>>();
  for (const report of sorted) {
    byPeriodId.set(report.period, new Map(report.ratios.map((ratio) => [ratio.id, ratio])));
  }
  const periods = sorted.map((report) => report.period);
  return selectedIds.map((id) => {
    const cells: HeatCell[] = [];
    let previous: number | null = null;
    for (const period of periods) {
      const ratio = byPeriodId.get(period)?.get(id);
      const value = ratio?.value ?? null;
      let direction: HeatCell['direction'] = null;
      if (value !== null && previous !== null) {
        if (value - previous > DIRECTION_EPSILON) direction = 'up';
        else if (previous - value > DIRECTION_EPSILON) direction = 'down';
        else direction = 'flat';
      }
      cells.push({ period, display: ratio?.display ?? '—', direction });
      previous = value;
    }
    return { id, label: nameById.get(id) ?? id, cells };
  });
}
