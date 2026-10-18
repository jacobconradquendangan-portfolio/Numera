import type { RatioCategory } from '@/lib/types';

export const PANEL_IDS = ['kpis', 'trends', 'cashflow', 'dupont', 'capital', 'heat'] as const;

export type PanelId = (typeof PANEL_IDS)[number];

export const PANEL_META: Record<PanelId, { title: string; deck: string }> = {
  kpis: { title: 'Command ratios', deck: 'Headline figures from the selected period, each with its category' },
  trends: { title: 'Ratio trends', deck: 'Chosen ratios charted across every period, never just the focus one' },
  cashflow: { title: 'Cash flow', deck: 'Operating, investing and financing flows across every period' },
  dupont: { title: 'DuPont decomposition', deck: 'Return on equity broken into margin, turnover and leverage' },
  capital: {
    title: 'Capital structure & cycle',
    deck: 'Who funds the assets, and how long cash is tied up before it returns',
  },
  heat: { title: 'Ratio heat table', deck: 'Chosen ratios grouped by family, each with trend, latest reading and move since the prior period' },
};

export interface DashboardState {
  panels: Record<PanelId, boolean>;
  trendIds: string[];
  heatIds: string[];
}

export const DEFAULT_TREND_IDS: string[] = [];

export const DEFAULT_HEAT_IDS: string[] = [];

export const DASHBOARD_CATEGORIES: RatioCategory[] = ['liquidity', 'profitability', 'leverage', 'efficiency', 'valuation'];

const STORAGE_KEY = 'numera-dashboard-state';
const STATE_VERSION = 3;

export function defaultDashboardState(): DashboardState {
  return {
    panels: {
      kpis: true,
      trends: true,
      cashflow: true,
      dupont: true,
      capital: true,
      heat: true,
    },
    trendIds: [...DEFAULT_TREND_IDS],
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
      cashflow: panels.cashflow !== false,
      dupont: panels.dupont !== false,
      capital: panels.capital !== false,
      heat: panels.heat !== false,
    },
    trendIds: ids(incoming.trendIds, base.trendIds),
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

const LOWER_IS_BETTER = new Set(['debt-to-equity', 'debt-ratio', 'financial-leverage', 'ar-days', 'inventory-days']);

const CEILINGS: Record<string, number> = {
  'current-ratio': 3,
};

export function ratioFavoursUp(id: string): boolean | null {
  if (HIGHER_IS_BETTER.has(id)) return true;
  if (LOWER_IS_BETTER.has(id)) return false;
  return null;
}

export type RatioTone = 'pos' | 'neg' | 'flat';

export type RatioVerdict = 'strong' | 'weak' | null;

const VERDICT_RULES: Record<string, { strong: (value: number) => boolean; weak: (value: number) => boolean }> = {
  'current-ratio': { strong: (value) => value >= 2, weak: (value) => value < 1 },
  'quick-ratio': { strong: (value) => value >= 1, weak: (value) => value < 1 },
  'cash-ratio': { strong: (value) => value >= 1, weak: (value) => value < 0.2 },
  'operating-cash-flow-ratio': { strong: (value) => value >= 1, weak: (value) => value < 1 },
  'times-interest-earned': { strong: (value) => value >= 3, weak: (value) => value < 2 },
  'tie-cash-basis': { strong: (value) => value >= 3, weak: (value) => value < 2 },
  'capex-to-operating-cash': { strong: (value) => value <= 1, weak: (value) => value > 1 },
  'net-profit-margin': { strong: (value) => value >= 10, weak: (value) => value < 5 },
  'gross-margin': { strong: (value) => value >= 20, weak: (value) => value < 5 },
  'operating-margin': { strong: (value) => value >= 10, weak: (value) => value < 0 },
  'return-on-equity': { strong: (value) => value >= 15, weak: (value) => value < 0 },
  'return-on-assets': { strong: (value) => value >= 5, weak: (value) => value < 0 },
  'return-on-capital-employed': { strong: (value) => value >= 10, weak: (value) => value < 0 },
  'debt-to-equity': { strong: (value) => value <= 1, weak: (value) => value > 2 },
  'debt-ratio': { strong: (value) => value <= 40, weak: (value) => value > 60 },
  'equity-ratio': { strong: (value) => value >= 50, weak: (value) => value < 30 },
  'financial-leverage': { strong: (value) => value <= 2, weak: (value) => value > 3 },
  'ar-days': { strong: (value) => value <= 30, weak: (value) => value > 60 },
  'inventory-days': { strong: (value) => value <= 30, weak: (value) => value > 90 },
  'defensive-interval-ratio': { strong: (value) => value >= 90, weak: (value) => value < 30 },
};

export function ratioVerdict(id: string, value: number | null | undefined): RatioVerdict {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const rule = VERDICT_RULES[id];
  if (!rule) return null;
  if (rule.strong(value)) return 'strong';
  if (rule.weak(value)) return 'weak';
  return null;
}

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
