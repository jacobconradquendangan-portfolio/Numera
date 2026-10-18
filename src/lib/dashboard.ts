import type { RatioCategory } from '@/lib/types';

export const PANEL_IDS = ['kpis', 'trends', 'margins', 'dupont', 'capital', 'heat'] as const;

export type PanelId = (typeof PANEL_IDS)[number];

export const PANEL_META: Record<PanelId, { title: string; deck: string }> = {
  kpis: { title: 'Command ratios', deck: 'Headline figures from the selected period, each with its category' },
  trends: { title: 'Ratio trends', deck: 'Chosen ratios charted across every period, never just the focus one' },
  margins: { title: 'Margin structure & coverage', deck: 'How revenue splits, and liquidity and leverage trade off' },
  dupont: { title: 'DuPont decomposition', deck: 'Return on equity broken into margin, turnover and leverage' },
  capital: { title: 'Capital structure & cycle', deck: 'Debt versus equity financing and the working-capital clock' },
  heat: { title: 'Ratio heat table', deck: 'Every chosen ratio across periods, tinted by the change since the prior one' },
};

export interface DashboardState {
  panels: Record<PanelId, boolean>;
  trendIds: string[];
  comparisonIds: string[];
  heatIds: string[];
}

export const DEFAULT_TREND_IDS: string[] = [];

export const DEFAULT_COMPARISON_IDS = [
  'current-ratio',
  'quick-ratio',
  'cash-ratio',
  'debt-to-equity',
  'debt-ratio',
  'equity-ratio',
];

export const DEFAULT_HEAT_IDS = [
  'current-ratio',
  'gross-margin',
  'net-profit-margin',
  'return-on-assets',
  'return-on-equity',
  'debt-to-equity',
  'inventory-days',
  'ar-days',
];

export const DASHBOARD_CATEGORIES: RatioCategory[] = ['liquidity', 'profitability', 'leverage', 'efficiency', 'valuation'];

const STORAGE_KEY = 'numera-dashboard-state';
const STATE_VERSION = 2;

export function defaultDashboardState(): DashboardState {
  return {
    panels: {
      kpis: true,
      trends: true,
      margins: true,
      dupont: true,
      capital: true,
      heat: true,
    },
    trendIds: [...DEFAULT_TREND_IDS],
    comparisonIds: [...DEFAULT_COMPARISON_IDS],
    heatIds: [...DEFAULT_HEAT_IDS],
  };
}

function sanitize(raw: unknown): DashboardState | null {
  if (!raw || typeof raw !== 'object' || (raw as { version?: number }).version !== STATE_VERSION) return null;
  const incoming = raw as Partial<DashboardState> & { version?: number };
  const base = defaultDashboardState();
  const ids = (value: unknown, fallback: string[]): string[] =>
    Array.isArray(value) && value.every((entry) => typeof entry === 'string') ? (value as string[]) : fallback;
  const panels = { ...base.panels, ...(incoming.panels as Record<string, boolean>) };
  return {
    panels: {
      kpis: panels.kpis !== false,
      trends: panels.trends !== false,
      margins: panels.margins !== false,
      dupont: panels.dupont !== false,
      capital: panels.capital !== false,
      heat: panels.heat !== false,
    },
    trendIds: ids(incoming.trendIds, base.trendIds),
    comparisonIds: ids(incoming.comparisonIds, base.comparisonIds),
    heatIds: ids(incoming.heatIds, base.heatIds),
  };
}

export function loadDashboardState(): DashboardState {
  if (typeof window === 'undefined') return defaultDashboardState();
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultDashboardState();
    return sanitize(JSON.parse(stored)) ?? defaultDashboardState();
  } catch {
    return defaultDashboardState();
  }
}

export function saveDashboardState(state: DashboardState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, version: STATE_VERSION }));
  } catch {
    return;
  }
}

export function toggleInList(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id];
}

export function isDefaultState(state: DashboardState): boolean {
  const base = defaultDashboardState();
  return (
    PANEL_IDS.every((id) => state.panels[id] === base.panels[id]) &&
    state.trendIds.join('|') === base.trendIds.join('|') &&
    state.comparisonIds.join('|') === base.comparisonIds.join('|') &&
    state.heatIds.join('|') === base.heatIds.join('|')
  );
}

const HIGHER_IS_BETTER = new Set([
  'current-ratio',
  'quick-ratio',
  'cash-ratio',
  'defensive-interval-ratio',
  'times-interest-earned',
  'tie-cash-basis',
  'operating-cash-flow-ratio',
  'return-on-equity',
  'return-on-assets',
  'return-on-capital-employed',
  'gross-margin',
  'operating-margin',
  'net-profit-margin',
  'equity-ratio',
  'ar-turnover',
  'asset-turnover',
  'inventory-turnover',
]);

const LOWER_IS_BETTER = new Set(['debt-to-equity', 'debt-ratio', 'ar-days', 'inventory-days']);

const CEILINGS: Record<string, number> = {
  'current-ratio': 3,
};

export function ratioFavoursUp(id: string): boolean | null {
  if (HIGHER_IS_BETTER.has(id)) return true;
  if (LOWER_IS_BETTER.has(id)) return false;
  return null;
}

export type RatioTone = 'pos' | 'neg' | 'flat';

export function movementTone(id: string, current: number | null, prior: number | null): RatioTone | null {
  const favoursUp = ratioFavoursUp(id);
  if (favoursUp === null || current === null || prior === null) return null;
  const change = current - prior;
  if (change === 0) return 'flat';
  const better = change > 0 === favoursUp;
  if (!better) return 'neg';
  const ceiling = CEILINGS[id];
  if (ceiling !== undefined && favoursUp && current > ceiling) return null;
  return 'pos';
}
