'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import RatioTrendChart from './charts/RatioTrendChart';
import DuPontPanels from './dashboard/DuPontPanels';
import CapitalStructureChart from './dashboard/CapitalStructureChart';
import CashFlowChart from './dashboard/CashFlowChart';
import WorkingCapitalStrip from './dashboard/WorkingCapitalStrip';
import RatioHeatTable from './dashboard/RatioHeatTable';
import {
  buildCapitalStructureData,
  buildCashFlowData,
  buildDuPontData,
  buildHeatTableData,
  buildRatioTrendData,
  buildWorkingCapitalData,
} from '@/lib/chartData';
import {
  DASHBOARD_CATEGORIES,
  PANEL_IDS,
  PANEL_META,
  defaultDashboardState,
  isDefaultState,
  loadDashboardState,
  movementTone,
  saveDashboardState,
  toggleInList,
  type DashboardState,
  type PanelId,
} from '@/lib/dashboard';
import type { AnalyzeSuccess, RatioCategory } from '@/lib/types';
import type { RatioResult } from '@/lib/engine/ratios';
import { cx } from '@/lib/format';

export interface DashboardTabProps {
  result: AnalyzeSuccess;
  selectedPeriod: string;
}

const KPI_IDS = [
  'current-ratio',
  'return-on-equity',
  'debt-to-equity',
  'net-profit-margin',
  'ar-days',
  'defensive-interval-ratio',
];

const KPI_LABELS: Record<string, string> = {
  'current-ratio': 'Current ratio',
  'return-on-equity': 'Return on equity',
  'debt-to-equity': 'Debt to equity',
  'net-profit-margin': 'Net margin',
  'ar-days': 'Receivable days',
  'defensive-interval-ratio': 'Defensive interval',
};

function PanelShell({
  metaId,
  children,
  right,
  span,
}: {
  metaId: PanelId;
  children: ReactNode;
  right?: ReactNode;
  span?: string;
}) {
  const meta = PANEL_META[metaId];
  return (
    <section className={cx('rounded-2xl border border-line bg-panel/40', span)}>
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h3 className="font-display text-xl text-paper">{meta.title}</h3>
          <p className="rule-label mt-0.5">{meta.deck}</p>
        </div>
        {right}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function RatioPicker({
  label,
  groups,
  activeIds,
  onToggle,
  onClear,
}: {
  label: string;
  groups: { category: RatioCategory; items: { id: string; name: string }[] }[];
  activeIds: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  return (
    <details className="relative group">
      <summary className="inline-flex cursor-pointer items-center gap-2 rounded-sm border border-line2 px-2.5 py-1 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted transition hover:border-accentdim hover:text-paper">
        <span>{label}</span>
        <span
          className={cx(
            'grid h-4 min-w-[1.1rem] place-items-center border px-1 font-mono text-[0.6rem] leading-none',
            activeIds.length ? 'border-accent bg-accent/10 text-accent' : 'border-line2 text-faint'
          )}
        >
          {activeIds.length}
        </span>
      </summary>
      <div className="absolute right-0 top-full z-30 mt-2 hidden max-h-80 w-72 overflow-y-auto rounded-xl border border-line bg-ink p-3 shadow-2xl group-open:block">
        {groups.map((group) => (
          <div key={group.category} className="mb-2 last:mb-0">
            <p className="rule-label mb-1 px-2 text-faint">{group.category}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = activeIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onToggle(item.id)}
                    aria-pressed={active}
                    className={cx(
                      'flex w-full items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-left text-sm transition hover:bg-panel',
                      active ? 'text-paper' : 'text-muted hover:text-paper'
                    )}
                  >
                    <span className="truncate">{item.name}</span>
                    <span
                      className={cx(
                        'flex h-4 w-4 shrink-0 items-center justify-center border font-mono text-[0.6rem]',
                        active ? 'border-accent bg-accent/20 text-accent' : 'border-line2 text-transparent'
                      )}
                      aria-hidden
                    >
                      ✓
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {activeIds.length ? (
          <button
            type="button"
            onClick={onClear}
            className="mt-2 w-full rounded-sm border border-line2 px-2 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-faint transition hover:border-neg/60 hover:text-neg"
          >
            Clear selection
          </button>
        ) : null}
      </div>
    </details>
  );
}

export default function DashboardTab({ result, selectedPeriod }: DashboardTabProps) {
  const [state, setState] = useState<DashboardState>(() => loadDashboardState());

  useEffect(() => {
    saveDashboardState(state);
  }, [state]);

  const sortedReports = useMemo(
    () =>
      [...result.ratioHistory].sort((a, b) => {
        const keyA = Number(a.period.match(/\d{4}/)?.[0] ?? Number.MAX_SAFE_INTEGER);
        const keyB = Number(b.period.match(/\d{4}/)?.[0] ?? Number.MAX_SAFE_INTEGER);
        return keyA - keyB || a.period.localeCompare(b.period);
      }),
    [result.ratioHistory]
  );

  const selectedReport = sortedReports.find((report) => report.period === selectedPeriod) ?? sortedReports[sortedReports.length - 1];
  const selectedIndex = sortedReports.indexOf(selectedReport);
  const priorReport = selectedIndex > 0 ? sortedReports[selectedIndex - 1] : null;

  const kpiRatios = useMemo(() => {
    const byId = new Map(selectedReport.ratios.map((ratio) => [ratio.id, ratio]));
    return KPI_IDS.map((id) => byId.get(id)).filter((ratio): ratio is RatioResult => ratio !== undefined);
  }, [selectedReport]);

  const availableGroups = useMemo(
    () =>
      DASHBOARD_CATEGORIES.map((category) => ({
        category,
        items: selectedReport.ratios
          .filter((ratio) => ratio.category === category)
          .map((ratio) => ({ id: ratio.id, name: ratio.name })),
      })).filter((group) => group.items.length),
    [selectedReport]
  );

  const trendData = useMemo(() => buildRatioTrendData(sortedReports, state.trendIds), [sortedReports, state.trendIds]);
  const duPontData = useMemo(() => buildDuPontData(sortedReports), [sortedReports]);
  const capitalData = useMemo(
    () => buildCapitalStructureData(result.document.statements.balance),
    [result.document.statements.balance]
  );
  const cashFlowData = useMemo(
    () => buildCashFlowData(result.document.statements.cashflow),
    [result.document.statements.cashflow]
  );
  const workingData = useMemo(() => buildWorkingCapitalData(sortedReports), [sortedReports]);
  const heatRows = useMemo(() => buildHeatTableData(sortedReports, state.heatIds), [sortedReports, state.heatIds]);

  const togglePanel = (id: PanelId) =>
    setState((current) => ({ ...current, panels: { ...current.panels, [id]: !current.panels[id] } }));

  const toggleRatio = (key: 'trendIds' | 'heatIds', id: string) =>
    setState((current) => ({ ...current, [key]: toggleInList(current[key], id) }));

  const clearRatio = (key: 'trendIds' | 'heatIds') => setState((current) => ({ ...current, [key]: [] }));

  const reset = () => setState(defaultDashboardState());

  const trendPicker = (
    <RatioPicker
      label="Series"
      groups={availableGroups}
      activeIds={state.trendIds}
      onToggle={(id) => toggleRatio('trendIds', id)}
      onClear={() => clearRatio('trendIds')}
    />
  );
  const heatPicker = (
    <RatioPicker
      label="Ratios"
      groups={availableGroups}
      activeIds={state.heatIds}
      onToggle={(id) => toggleRatio('heatIds', id)}
      onClear={() => clearRatio('heatIds')}
    />
  );

  const periodChip = (
    <span className="rounded-sm border border-line2 px-2.5 py-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-paper">
      Period {selectedReport.period}
    </span>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-3xl text-paper">Dashboard</h2>
            <span className="rounded-sm border border-accent/50 bg-accent/10 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase leading-none tracking-[0.16em] text-accentdim">
              Beta
            </span>
          </div>
          <p className="rule-label mt-1">A composed deck over the computed ratios · panels and chart series are yours to choose</p>
        </div>
        <span className="flex flex-wrap items-center gap-2">
          <details className="relative group">
            <summary className="cursor-pointer rounded-sm border border-line2 px-2.5 py-1 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted transition hover:border-accentdim hover:text-paper">
              Panels
            </summary>
            <div className="absolute right-0 top-full z-30 mt-2 hidden w-72 rounded-xl border border-line bg-ink p-3 shadow-2xl group-open:block">
              <div className="space-y-1">
                {PANEL_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => togglePanel(id)}
                    className="flex w-full items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-left text-sm text-muted transition hover:bg-panel hover:text-paper"
                  >
                    <span>{PANEL_META[id].title}</span>
                    <span
                      className={cx(
                        'flex h-4 w-4 shrink-0 items-center justify-center border font-mono text-[0.6rem]',
                        state.panels[id] ? 'border-accent bg-accent/20 text-accent' : 'border-line2 text-transparent'
                      )}
                      aria-hidden
                    >
                      ✓
                    </span>
                  </button>
                ))}
              </div>
              {!isDefaultState(state) ? (
                <button
                  type="button"
                  onClick={reset}
                  className="mt-2 w-full rounded-sm border border-line2 px-2 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-faint transition hover:border-neg/60 hover:text-neg"
                >
                  Reset to standard deck
                </button>
              ) : null}
            </div>
          </details>
          {periodChip}
        </span>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {state.panels.kpis && kpiRatios.length ? (
          <PanelShell metaId="kpis" span="xl:col-span-2">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {kpiRatios.map((ratio) => {
                const prior = priorReport?.ratios.find((entry) => entry.id === ratio.id);
                const tone = movementTone(ratio.id, ratio.value, prior?.value ?? null);
                return (
                  <div key={ratio.id} className="flex flex-col rounded-xl border border-line bg-panel px-4 py-3.5">
                    <p className="rule-label truncate" title={ratio.name}>
                      {KPI_LABELS[ratio.id] ?? ratio.name}
                    </p>
                    <p
                      className={cx(
                        'tabular mt-2.5 whitespace-nowrap text-xl leading-none xl:text-2xl',
                        ratio.value === null
                          ? 'text-faint'
                          : tone === 'pos'
                            ? 'text-pos'
                            : tone === 'neg'
                              ? 'text-neg'
                              : 'text-paper'
                      )}
                    >
                      {ratio.display}
                    </p>
                    <p className="mt-auto truncate pt-2.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-faint">
                      {prior ? `prior ${prior.display}` : ratio.category}
                    </p>
                  </div>
                );
              })}
            </div>
          </PanelShell>
        ) : null}

        {state.panels.trends ? (
          <PanelShell metaId="trends" span="xl:col-span-2" right={trendPicker}>
            {trendData.series.length ? (
              <RatioTrendChart data={trendData.data} series={trendData.series} />
            ) : (
              <div className="flex h-80 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line text-center">
                <p className="text-sm text-muted">Nothing plotted yet</p>
                <p className="rule-label">choose ratios under Series to trend them across periods</p>
              </div>
            )}
          </PanelShell>
        ) : null}

        {state.panels.cashflow ? (
          <PanelShell metaId="cashflow" span="xl:col-span-2">
            <CashFlowChart data={cashFlowData} />
          </PanelShell>
        ) : null}

        {state.panels.dupont ? (
          <PanelShell metaId="dupont" span="xl:col-span-2">
            <DuPontPanels data={duPontData} selectedPeriod={selectedReport.period} />
          </PanelShell>
        ) : null}

        {state.panels.capital ? (
          <PanelShell metaId="capital" span="xl:col-span-2">
            <div className="grid gap-8 xl:grid-cols-2">
              <CapitalStructureChart data={capitalData} />
              <WorkingCapitalStrip data={workingData} selectedPeriod={selectedReport.period} />
            </div>
          </PanelShell>
        ) : null}

        {state.panels.heat ? (
          <PanelShell metaId="heat" span="xl:col-span-2" right={heatPicker}>
            <RatioHeatTable rows={heatRows} />
          </PanelShell>
        ) : null}
      </div>
    </div>
  );
}
