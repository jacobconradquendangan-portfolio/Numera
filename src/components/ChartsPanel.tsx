'use client';

import { useMemo } from 'react';
import type { NormalizedStatement, RatioReport } from '@/lib/types';
import { buildCommonSizeData, buildRatioComparisonData, buildRatioTrendData, buildTrendData } from '@/lib/chartData';
import TrendChart from './charts/TrendChart';
import RatioComparisonChart from './charts/RatioComparisonChart';
import RatioTrendChart from './charts/RatioTrendChart';
import CommonSizeChart from './charts/CommonSizeChart';

interface ChartsPanelProps {
  income: NormalizedStatement | null;
  report: RatioReport;
  reports: RatioReport[];
  period: string;
}

export default function ChartsPanel({ income, report, reports, period }: ChartsPanelProps) {
  const trend = useMemo(() => buildTrendData(income), [income]);
  const comparison = useMemo(() => buildRatioComparisonData(report), [report]);
  const ratioTrend = useMemo(() => buildRatioTrendData(reports), [reports]);
  const commonSize = useMemo(() => buildCommonSizeData(income), [income]);

  return (
    <section className="rise space-y-6">
      <header className="border-b border-line pb-3">
        <h2 className="font-display text-3xl text-paper">Visual analysis</h2>
        <p className="rule-label mt-1">Multi-year earnings and ratio trends, a liquidity vs leverage comparison and a common-size cost structure</p>
      </header>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="panel rounded-2xl px-6 py-6">
          <div className="mb-4">
            <p className="font-display text-xl text-paper">Revenue, Gross Profit &amp; Net Income</p>
            <p className="rule-label mt-1">Period trend · normalised units</p>
          </div>
          <TrendChart data={trend} />
        </div>

        <div className="panel rounded-2xl px-6 py-6">
          <div className="mb-4">
            <p className="font-display text-xl text-paper">Liquidity vs Leverage</p>
            <p className="rule-label mt-1">Selected period · {period}</p>
          </div>
          <RatioComparisonChart data={comparison} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="panel rounded-2xl px-6 py-6">
          <div className="mb-4">
            <p className="font-display text-xl text-paper">Profitability trends</p>
            <p className="rule-label mt-1">Gross margin, net margin, ROA &amp; ROE across periods · percent</p>
          </div>
          <RatioTrendChart data={ratioTrend.data} series={ratioTrend.series} />
        </div>

        <div className="panel rounded-2xl px-6 py-6">
          <div className="mb-4">
            <p className="font-display text-xl text-paper">Common-size cost structure</p>
            <p className="rule-label mt-1">Vertical analysis · each line as % of revenue</p>
          </div>
          <CommonSizeChart data={commonSize} />
        </div>
      </div>
    </section>
  );
}
