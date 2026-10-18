'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import RatioTrendChart from './charts/RatioTrendChart';
import CommonSizeChart from './charts/CommonSizeChart';
import RatioComparisonChart from './charts/RatioComparisonChart';
import DuPontPanels from './dashboard/DuPontPanels';
import CapitalStructureChart from './dashboard/CapitalStructureChart';
import WorkingCapitalStrip from './dashboard/WorkingCapitalStrip';
import RatioHeatTable from './dashboard/RatioHeatTable';
import {
  buildCapitalStructureData,
  buildCommonSizeData,
  buildDuPontData,
  buildHeatTableData,
  buildRatioComparisonData,
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

function ChipToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'whitespace-nowrap rounded-sm border px-2.5 py-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] transition',
        active ? 'border-accent bg-accent/10 text-accent' : 'border-line2 text-muted hover:border-accentdim hover:text-paper'
      )}
    >
      {label}
    </button>
  );
}

function ratioChips(
  groups: { category: RatioCategory; items: { id: string; name: string }[] }[],
  activeIds: string[],
  onToggle: (id: string) => void
): ReactNode {
  return (
    <div className="space-y-2">
      {groups.map((group) => (
        <div key={group.category} className="flex flex-wrap items-center gap-1.5">
          <span className="rule-label mr-1 text-faint">{group.category}</span>
          {group.items.map((item) => (
            <ChipToggle
              key={item.id}
              label={item.name}
              active={activeIds.includes(item.id)}
              onClick={() => onToggle(item.id)}
            />
          ))}
        </div>
      ))}
    </div>
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
  const comparisonData = useMemo(
    () => buildRatioComparisonData(selectedReport, state.comparisonIds),
    [selectedReport, state.comparisonIds]
  );
  const duPontData = useMemo(() => buildDuPontData(sortedReports), [sortedReports]);
  const capitalData = useMemo(
    () => buildCapitalStructureData(result.document.statements.balance),
    [result.document.statements.balance]
  );
  const workingData = useMemo(() => buildWorkingCapitalData(sortedReports), [sortedReports]);
  const commonSizeData = useMemo(
    () => buildCommonSizeData(result.document.statements.income),
    [result.document.statements.income]
  );
  const heatRows = useMemo(() => buildHeatTableData(sortedReports, state.heatIds), [sortedReports, state.heatIds]);

  const togglePanel = (id: PanelId) =>
    setState((current) => ({ ...current, panels: { ...current.panels, [id]: !current.panels[id] } }));

  const toggleRatio = (key: 'trendIds' | 'comparisonIds' | 'heatIds', id: string) =>
    setState((current) => ({ ...current, [key]: toggleInList(current[key], id) }));

  const reset = () => setState(defaultDashboardState());

  const trendPicker = state.panels.trends
    ? ratioChips(availableGroups, state.trendIds, (id) => toggleRatio('trendIds', id))
    : null;
  const comparisonPicker = state.panels.margins
    ? ratioChips(availableGroups, state.comparisonIds, (id) => toggleRatio('comparisonIds', id))
    : null;
  const heatPicker = state.panels.heat
    ? ratioChips(availableGroups, state.heatIds, (id) => toggleRatio('heatIds', id))
    : null;

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
                return (
                  <div key={ratio.id} className="rounded-xl border border-line bg-panel px-4 py-3.5">
                    <p className="rule-label mb-2 whitespace-nowrap">{ratio.name}</p>
                    <p
                      className={cx(
                        'tabular text-2xl leading-tight',
                        ratio.value === null ? 'text-faint' : 'text-paper'
                      )}
                    >
                      {ratio.display}
                    </p>
                    <p className="mt-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-faint">
                      {prior ? `prior ${prior.display}` : ratio.category}
                    </p>
                  </div>
                );
              })}
            </div>
          </PanelShell>
        ) : null}

        {state.panels.trends ? (
          <PanelShell metaId="trends" span="xl:col-span-2">
            <div className="space-y-4">
              {trendPicker ? (
                <>
                  {trendPicker}
                  <div className="border-t border-line/60 pt-4" />
                </>
              ) : null}
              <RatioTrendChart data={trendData.data} series={trendData.series} />
            </div>
          </PanelShell>
        ) : null}

        {state.panels.margins ? (
          <PanelShell metaId="margins" span="xl:col-span-2">
            <div className="space-y-4">
              {comparisonPicker ? (
                <>
                  {comparisonPicker}
                  <div className="border-t border-line/60 pt-4" />
                </>
              ) : null}
              <div className="grid gap-6 xl:grid-cols-2">
                <CommonSizeChart data={commonSizeData} />
                <RatioComparisonChart data={comparisonData} />
              </div>
            </div>
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
          <PanelShell metaId="heat" span="xl:col-span-2">
            <div className="space-y-4">
              {heatPicker ? (
                <>
                  {heatPicker}
                  <div className="border-t border-line/60 pt-4" />
                </>
              ) : null}
              <RatioHeatTable rows={heatRows} />
            </div>
          </PanelShell>
        ) : null}
      </div>
    </div>
  );
}
