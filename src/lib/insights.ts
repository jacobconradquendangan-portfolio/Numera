import type { RatioReport, RatioResult } from '@/lib/engine/ratios';
import type { AnalysisResult } from '@/lib/engine/analyzer';

export type InsightTone = 'positive' | 'neutral' | 'watch';

export interface InsightPoint {
  label: string;
  value: string;
  note: string;
}

export interface Insight {
  id: string;
  title: string;
  tone: InsightTone;
  summary: string;
  points: InsightPoint[];
}

export interface InsightReport {
  period: string;
  tone: InsightTone;
  verdict: string;
  strengths: number;
  watches: number;
  insights: Insight[];
}

interface BuildInput {
  report: RatioReport;
  history?: RatioReport[];
  analysis?: AnalysisResult;
}

function indexById(report: RatioReport): Map<string, RatioResult> {
  return new Map(report.ratios.map((ratio) => [ratio.id, ratio]));
}

function priorReport(report: RatioReport, history: RatioReport[]): RatioReport | null {
  const position = history.findIndex((entry) => entry.period === report.period);
  if (position > 0) return history[position - 1];
  return null;
}

function num(byId: Map<string, RatioResult>, id: string): number | null {
  const ratio = byId.get(id);
  if (!ratio || ratio.value === null || ratio.availability === 'unavailable') return null;
  return ratio.value;
}

function point(byId: Map<string, RatioResult>, id: string, note: string): InsightPoint | null {
  const ratio = byId.get(id);
  if (!ratio || ratio.value === null || ratio.availability === 'unavailable') return null;
  return { label: ratio.name, value: ratio.display, note };
}

function delta(byId: Map<string, RatioResult>, prior: RatioReport | null, id: string): number | null {
  if (!prior) return null;
  const current = byId.get(id);
  const previous = prior.ratios.find((ratio) => ratio.id === id);
  if (!current || !previous) return null;
  if (current.value === null || previous.value === null) return null;
  return current.value - previous.value;
}

function directionText(change: number | null, up: string, down: string, flat: string): string {
  if (change === null) return flat;
  if (change > 0.0001) return up;
  if (change < -0.0001) return down;
  return flat;
}

function latestChange(
  analysis: AnalysisResult | undefined,
  category: string,
  period: string
): { percentChange: number | null } | null {
  const entry = analysis?.horizontal.income?.entries.find((item) => item.category === category);
  if (!entry || !entry.changes.length) return null;
  return entry.changes.find((change) => change.toPeriod === period) ?? entry.changes[entry.changes.length - 1];
}

function liquidityInsight(byId: Map<string, RatioResult>): Insight | null {
  const current = num(byId, 'current-ratio');
  const quick = num(byId, 'quick-ratio');
  const cash = num(byId, 'cash-ratio');
  if (current === null && quick === null && cash === null) return null;
  const points = [
    point(byId, 'current-ratio', 'Current assets cover short-term obligations.'),
    point(byId, 'quick-ratio', 'Inventory excluded from the coverage test.'),
    point(byId, 'cash-ratio', 'Immediate cash and equivalents against current liabilities.'),
  ].filter((entry): entry is InsightPoint => entry !== null);
  let tone: InsightTone = 'neutral';
  let summary = 'Short-term liquidity is adequate, with coverage near the one-times guideline.';
  if (current !== null && current >= 2) {
    tone = 'positive';
    summary = 'Comfortable short-term liquidity, with current assets well above near-term obligations.';
  } else if (current !== null && current < 1) {
    tone = 'watch';
    summary = 'Liquidity pressure: current liabilities exceed current assets.';
  } else if (quick !== null && quick < 1) {
    tone = 'watch';
    summary = 'Coverage leans on inventory; quick liquidity is below the one-times guideline.';
  }
  return { id: 'liquidity', title: 'Liquidity', tone, summary, points };
}

function profitabilityInsight(byId: Map<string, RatioResult>, prior: RatioReport | null): Insight | null {
  const net = num(byId, 'net-profit-margin');
  const gross = num(byId, 'gross-margin');
  const operating = num(byId, 'operating-margin');
  const roe = num(byId, 'return-on-equity');
  const roa = num(byId, 'return-on-assets');
  if (net === null && gross === null && operating === null && roe === null && roa === null) return null;
  const marginShift = delta(byId, prior, 'net-profit-margin');
  const points = [
    point(byId, 'gross-margin', 'Share of revenue left after direct costs.'),
    point(byId, 'operating-margin', 'Operating profit as a share of revenue.'),
    point(byId, 'net-profit-margin', directionText(marginShift, 'Net margin expanded versus the prior period.', 'Net margin compressed versus the prior period.', 'Net margin broadly stable.')),
    point(byId, 'return-on-equity', roe !== null && roe >= 15 ? 'Returns to shareholders exceed the 15% reference level.' : 'Returns to shareholders relative to equity.'),
    point(byId, 'return-on-assets', 'Earnings generated per unit of assets.'),
  ].filter((entry): entry is InsightPoint => entry !== null);
  let tone: InsightTone = 'neutral';
  let summary = 'Profitability is positive but modest.';
  if (net !== null && net >= 10) {
    tone = 'positive';
    summary = 'Strong profitability, with net income retaining a healthy share of revenue.';
  } else if (net !== null && net < 0) {
    tone = 'watch';
    summary = 'The business is loss-making on a net basis for this period.';
  } else if (net !== null && net < 3) {
    tone = 'watch';
    summary = 'Thin net margins leave little cushion for cost or pricing pressure.';
  }
  if (roe !== null && roe >= 15 && tone !== 'watch') tone = 'positive';
  return { id: 'profitability', title: 'Profitability', tone, summary, points };
}

function leverageInsight(byId: Map<string, RatioResult>): Insight | null {
  const de = num(byId, 'debt-to-equity');
  const debtRatio = num(byId, 'debt-ratio');
  const equityRatio = num(byId, 'equity-ratio');
  if (de === null && debtRatio === null && equityRatio === null) return null;
  const points = [
    point(byId, 'debt-to-equity', 'Debt relative to shareholders’ equity.'),
    point(byId, 'debt-ratio', 'Share of assets financed by liabilities.'),
    point(byId, 'equity-ratio', 'Share of assets financed by equity.'),
  ].filter((entry): entry is InsightPoint => entry !== null);
  let tone: InsightTone = 'neutral';
  let summary = 'Capital structure is moderately leveraged.';
  if (de !== null && de <= 0.5) {
    tone = 'positive';
    summary = 'Conservative capital structure, with equity comfortably outweighing debt.';
  } else if ((de !== null && de > 1) || (debtRatio !== null && debtRatio > 60)) {
    tone = 'watch';
    summary = 'Elevated leverage increases sensitivity to interest rates and earnings swings.';
  }
  return { id: 'leverage', title: 'Leverage & solvency', tone, summary, points };
}

function coverageInsight(byId: Map<string, RatioResult>): Insight | null {
  const tie = num(byId, 'times-interest-earned');
  const tieCash = num(byId, 'tie-cash-basis');
  if (tie === null && tieCash === null) return null;
  const points = [
    point(byId, 'times-interest-earned', 'Operating profit covers interest charges.'),
    point(byId, 'tie-cash-basis', 'Cash-based interest cover, adding back non-cash charges.'),
  ].filter((entry): entry is InsightPoint => entry !== null);
  let tone: InsightTone = 'neutral';
  let summary = 'Interest obligations are covered with a modest margin.';
  if (tie !== null && tie >= 3) {
    tone = 'positive';
    summary = 'Earnings cover interest charges several times over.';
  } else if (tie !== null && tie < 1.5) {
    tone = 'watch';
    summary = 'Interest cover is thin; a decline in earnings would strain debt service.';
  }
  return { id: 'coverage', title: 'Interest coverage', tone, summary, points };
}

function efficiencyInsight(byId: Map<string, RatioResult>, prior: RatioReport | null): Insight | null {
  const asset = num(byId, 'asset-turnover');
  const arDays = num(byId, 'ar-days');
  const inventoryDays = num(byId, 'inventory-days');
  if (asset === null && arDays === null && inventoryDays === null) return null;
  const arShift = delta(byId, prior, 'ar-days');
  const inventoryShift = delta(byId, prior, 'inventory-days');
  const points = [
    point(byId, 'asset-turnover', 'Revenue generated per unit of assets.'),
    point(byId, 'ar-days', directionText(arShift, 'Collection slowed versus the prior period.', 'Collection improved versus the prior period.', 'Collection period broadly stable.')),
    point(byId, 'inventory-days', directionText(inventoryShift, 'Inventory is turning over more slowly.', 'Inventory is moving faster.', 'Inventory turnover broadly stable.')),
  ].filter((entry): entry is InsightPoint => entry !== null);
  const slowerCollection = arShift !== null && arShift > 0;
  const slowerInventory = inventoryShift !== null && inventoryShift > 0;
  const tone: InsightTone = slowerCollection || slowerInventory ? 'watch' : 'neutral';
  const softened =
    slowerCollection && slowerInventory
      ? 'both receivable collection and inventory turnover'
      : slowerCollection
        ? 'slower receivable collection'
        : 'slower inventory turnover';
  const summary =
    tone === 'watch'
      ? `Working-capital efficiency has softened on ${softened}.`
      : 'Working-capital efficiency is steady.';
  return { id: 'efficiency', title: 'Efficiency', tone, summary, points };
}

function cashFlowInsight(byId: Map<string, RatioResult>): Insight | null {
  const ocfRatio = num(byId, 'operating-cash-flow-ratio');
  const capex = num(byId, 'capex-to-operating-cash');
  if (ocfRatio === null && capex === null) return null;
  const points = [
    point(byId, 'operating-cash-flow-ratio', 'Operating cash flow against current liabilities.'),
    point(byId, 'capex-to-operating-cash', 'Share of operating cash flow reinvested in capital expenditure.'),
  ].filter((entry): entry is InsightPoint => entry !== null);
  let tone: InsightTone = 'neutral';
  let summary = 'Cash generation covers interest and reinvestment with a modest buffer.';
  if (ocfRatio !== null && ocfRatio >= 1) {
    tone = 'positive';
    summary = 'Operating cash flow comfortably covers current liabilities.';
  } else if (ocfRatio !== null && ocfRatio < 0.5) {
    tone = 'watch';
    summary = 'Operating cash flow is weak relative to current liabilities.';
  }
  return { id: 'cash-flow', title: 'Cash flow', tone, summary, points };
}

function growthInsight(
  analysis: AnalysisResult | undefined,
  byId: Map<string, RatioResult>,
  prior: RatioReport | null,
  period: string
): Insight | null {
  const revenue = latestChange(analysis, 'revenue', period);
  const netIncome = latestChange(analysis, 'net_income', period);
  const roeShift = delta(byId, prior, 'return-on-equity');
  if (!revenue && !netIncome && roeShift === null) return null;
  const points: InsightPoint[] = [];
  if (revenue) {
    points.push({
      label: 'Revenue growth',
      value: revenue.percentChange === null ? '—' : `${revenue.percentChange >= 0 ? '+' : ''}${revenue.percentChange.toFixed(2)}%`,
      note: 'Change in revenue versus the comparable prior period.',
    });
  }
  if (netIncome) {
    points.push({
      label: 'Net income growth',
      value: netIncome.percentChange === null ? '—' : `${netIncome.percentChange >= 0 ? '+' : ''}${netIncome.percentChange.toFixed(2)}%`,
      note: 'Change in net income versus the comparable prior period.',
    });
  }
  if (roeShift !== null) {
    points.push({
      label: 'Return on equity (change)',
      value: `${roeShift >= 0 ? '+' : ''}${roeShift.toFixed(2)} pp`,
      note: 'Movement in ROE versus the prior period, in percentage points.',
    });
  }
  const revenueUp = revenue ? (revenue.percentChange ?? 0) > 0 : null;
  const incomeUp = netIncome ? (netIncome.percentChange ?? 0) > 0 : null;
  let tone: InsightTone = 'neutral';
  let summary = 'Growth is broadly balanced between the periods compared.';
  if (revenueUp && incomeUp === false) {
    tone = 'watch';
    summary = 'Revenue is growing while net income falls — margins are being squeezed.';
  } else if (revenueUp && incomeUp) {
    tone = 'positive';
    summary = 'Revenue and net income are both expanding, with profits keeping pace with sales.';
  } else if (revenueUp === false && incomeUp === false) {
    tone = 'watch';
    summary = 'Both revenue and net income contracted versus the prior period.';
  }
  return { id: 'growth', title: 'Growth', tone, summary, points };
}

function valuationInsight(byId: Map<string, RatioResult>): Insight | null {
  const pe = num(byId, 'pe-ratio');
  const evEbitda = num(byId, 'ev-to-ebitda');
  const evEbit = num(byId, 'ev-to-ebit');
  const evRevenue = num(byId, 'ev-to-revenue');
  if (pe === null && evEbitda === null && evEbit === null && evRevenue === null) return null;
  const points = [
    point(byId, 'pe-ratio', 'Market price relative to earnings per share.'),
    point(byId, 'ev-to-ebitda', 'Enterprise value against EBITDA.'),
    point(byId, 'ev-to-ebit', 'Enterprise value against operating profit.'),
    point(byId, 'ev-to-revenue', 'Enterprise value against revenue.'),
  ].filter((entry): entry is InsightPoint => entry !== null);
  return {
    id: 'valuation',
    title: 'Valuation',
    tone: 'neutral',
    summary: 'Market multiples are shown for reference; interpretation depends on peers and growth.',
    points,
  };
}

export function buildInsights({ report, history = [], analysis }: BuildInput): InsightReport {
  const byId = indexById(report);
  const prior = priorReport(report, history);
  const insights = [
    liquidityInsight(byId),
    profitabilityInsight(byId, prior),
    leverageInsight(byId),
    coverageInsight(byId),
    efficiencyInsight(byId, prior),
    cashFlowInsight(byId),
    growthInsight(analysis, byId, prior, report.period),
    valuationInsight(byId),
  ].filter((entry): entry is Insight => entry !== null);

  const strengths = insights.filter((entry) => entry.tone === 'positive').length;
  const watches = insights.filter((entry) => entry.tone === 'watch').length;
  let tone: InsightTone = 'neutral';
  if (watches === 0 && strengths > 0) tone = 'positive';
  else if (strengths === 0 && watches > 0) tone = 'watch';

  let verdict: string;
  if (!insights.length) {
    verdict = 'Not enough data has been mapped to form a view for this period.';
  } else if (tone === 'positive') {
    verdict = `Broadly healthy — ${strengths} measure${strengths === 1 ? '' : 's'} stand out positively and nothing is flagged for concern.`;
  } else if (tone === 'watch') {
    verdict = `Several warning signs — ${watches} measure${watches === 1 ? '' : 's'} warrant attention before drawing comfort.`;
  } else {
    verdict = `Mixed picture — ${strengths} strength${strengths === 1 ? '' : 's'} tempered by ${watches} area${watches === 1 ? '' : 's'} to watch.`;
  }

  return { period: report.period, tone, verdict, strengths, watches, insights };
}
