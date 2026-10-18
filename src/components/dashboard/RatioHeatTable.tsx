'use client';

import type { HeatRow } from '@/lib/chartData';
import { cx } from '@/lib/format';

interface RatioHeatTableProps {
  rows: HeatRow[];
}

const CELL_TONE: Record<string, string> = {
  up: 'bg-pos/10 text-pos',
  down: 'bg-neg/10 text-neg',
  flat: 'text-muted',
};

export default function RatioHeatTable({ rows }: RatioHeatTableProps) {
  if (!rows.length) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-line text-sm text-faint">
        Pick ratios from the chips above to build the table.
      </div>
    );
  }

  const periods = rows[0].cells.map((cell) => cell.period);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[30rem] border-collapse text-sm">
        <thead>
          <tr>
            <th className="rule-label border-b border-line pb-2 pr-3 text-left font-normal">Ratio</th>
            {periods.map((period) => (
              <th key={period} className="rule-label tabular border-b border-line pb-2 px-2 text-right font-normal">
                {period}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="border-b border-line/60 py-2 pr-3 text-paper">{row.label}</td>
              {row.cells.map((cell) => (
                <td
                  key={`${row.id}-${cell.period}`}
                  className={cx(
                    'tabular border-b border-line/60 px-2 py-2 text-right',
                    cell.direction ? CELL_TONE[cell.direction] : 'text-muted'
                  )}
                >
                  {cell.direction === 'up' ? '\u25B2 ' : cell.direction === 'down' ? '\u25BC ' : null}
                  {cell.display}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
