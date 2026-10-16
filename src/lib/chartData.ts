import type { NormalizedStatement, RatioReport } from '@/lib/types';

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
  category: 'liquidity' | 'leverage';
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
  grid: '#e4dbc5',
  axis: '#cdc1a2',
  tick: '#6c6555',
  reference: '#cdc1a2',
  surface: '#fffdf8',
  border: '#e4dbc5',
  paper: '#23211a',
};

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

export function buildRatioComparisonData(report: RatioReport): RatioDatum[] {
  const byId = new Map(report.ratios.map((ratio) => [ratio.id, ratio]));
  const data: RatioDatum[] = [];
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

export function buildRatioTrendData(reports: RatioReport[]): { data: RatioTrendPoint[]; series: RatioTrendSeries[] } {
  const data: RatioTrendPoint[] = reports.map((report) => {
    const byId = new Map(report.ratios.map((ratio) => [ratio.id, ratio]));
    const point: RatioTrendPoint = { period: report.period };
    for (const spec of RATIO_TREND_SPECS) {
      point[spec.label] = byId.get(spec.id)?.value ?? null;
    }
    return point;
  });
  const series: RatioTrendSeries[] = RATIO_TREND_SPECS.map((spec) => ({
    key: spec.label,
    label: spec.label,
    color: spec.color,
  }));
  return { data, series };
}
