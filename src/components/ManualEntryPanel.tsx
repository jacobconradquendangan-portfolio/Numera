'use client';

import { useCallback, useEffect, useMemo } from 'react';
import CategoryCombobox from './CategoryCombobox';
import { cx } from '@/lib/format';
import { hasBlockingErrors, isMalformedNumber, validateManualStatements } from '@/lib/validation';
import type { ValidationIssue } from '@/lib/validation';
import type { ManualModel, ManualRow } from '@/lib/manualModel';
import type { CategoryOption, ManualStatementPayload, StatementType } from '@/lib/types';

export interface ManualValidationState {
  blocked: boolean;
  hasLines: boolean;
  issues: ValidationIssue[];
}

interface ManualEntryPanelProps {
  onAnalyze: (statements: ManualStatementPayload[]) => void;
  busy: boolean;
  onValidationChange?: (validation: ManualValidationState) => void;
  model: ManualModel;
}

const CELL =
  'tabular w-full rounded-lg border border-line bg-ink/50 px-3 py-2 text-sm text-paper outline-none transition focus:border-accentdim focus:ring-2 focus:ring-accent/15';

export default function ManualEntryPanel({ onAnalyze, busy, onValidationChange, model }: ManualEntryPanelProps) {
  const { periods, rows, incomeOptions, balanceOptions, cashflowOptions, seedSource } = model;

  const updateLabel = model.updateLabel;
  const updateValue = model.updateValue;
  const addPeriod = model.addPeriod;
  const updatePeriod = model.updatePeriod;
  const removePeriod = model.removePeriod;
  const addRow = model.addRow;
  const removeRow = model.removeRow;

  const hasLines = useMemo(() => {
    const check = (current: ManualRow[]) =>
      current.some((row) => row.label.trim() !== '' && row.values.some((value) => value.trim() !== ''));
    return check(rows.income) || check(rows.balance) || check(rows.cashflow);
  }, [rows]);

  const previewStatements = useMemo(() => model.toStatements(), [model]);

  const issues = useMemo(() => validateManualStatements(previewStatements), [previewStatements]);
  const blocked = hasBlockingErrors(issues);

  const badCells = useMemo(() => {
    const set = new Set<string>();
    const collect = (current: ManualRow[]) =>
      current.forEach((row) =>
        row.values.forEach((value, index) => {
          if (isMalformedNumber(value)) set.add(`${row.id}:${index}`);
        })
      );
    collect(rows.income);
    collect(rows.balance);
    collect(rows.cashflow);
    return set;
  }, [rows]);

  const handleAnalyze = useCallback(() => {
    const statements = model.toStatements();
    if (statements.length && !blocked) onAnalyze(statements);
  }, [blocked, model, onAnalyze]);

  // Report validation upward without an effect loop.
  useEffect(() => {
    onValidationChange?.({ blocked, hasLines, issues });
  }, [blocked, hasLines, issues, onValidationChange]);

  const renderEditor = (
    type: StatementType,
    currentRows: ManualRow[],
    options: CategoryOption[],
    title: string,
    hint: string
  ) => (
    <div className="rounded-2xl border border-line">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
        <div>
          <p className="font-display text-lg text-paper">{title}</p>
          <p className="rule-label mt-0.5">{hint}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {type === 'income' ? (
            <button
              type="button"
              onClick={addPeriod}
              className="rounded-full border border-line2 px-3.5 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted transition hover:border-accentdim hover:text-accent"
            >
              + Add period
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => addRow(type)}
            className="rounded-full border border-line2 px-3.5 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted transition hover:border-accentdim hover:text-accent"
          >
            + Add line
          </button>
        </div>
      </div>
      <div className="overflow-x-auto px-5 py-4">
        <table className="w-full min-w-[34rem] border-collapse">
          <thead>
            <tr>
              <th className="pb-2 text-left">
                <span className="rule-label">Line item</span>
              </th>
              {periods.map((period, index) => (
                <th key={index} className="w-32 pb-2 pl-3 text-left">
                  <div className="flex items-center gap-1">
                    <input
                      value={period}
                      onChange={(event) => updatePeriod(index, event.target.value)}
                      placeholder="Period"
                      className={cx(CELL, 'text-center')}
                    />
                    {periods.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removePeriod(index)}
                        aria-label="Remove period"
                        className="text-faint transition hover:text-neg"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                        </svg>
                      </button>
                    ) : null}
                  </div>
                </th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {currentRows.map((row) => (
              <tr key={row.id} className="align-top">
                <td className="py-1.5 pr-3">
                  <CategoryCombobox
                    value={row.label}
                    options={options}
                    onChange={(next) => updateLabel(type, row.id, next)}
                    placeholder="Search line item…"
                    className={CELL}
                  />
                  {row.sourceLabel ? (
                    <span
                      className="mt-1 block truncate font-mono text-[0.58rem] uppercase tracking-[0.1em] text-faint"
                      title={row.sourceLabel}
                    >
                      from: {row.sourceLabel}
                    </span>
                  ) : null}
                </td>
                {periods.map((_, column) => (
                  <td key={column} className="w-32 py-1.5 pl-3">
                    <input
                      value={row.values[column] ?? ''}
                      inputMode="decimal"
                      onChange={(event) => updateValue(type, row.id, column, event.target.value)}
                      placeholder="0"
                      aria-invalid={badCells.has(`${row.id}:${column}`)}
                      className={cx(
                        CELL,
                        'text-right',
                        badCells.has(`${row.id}:${column}`) && 'border-neg/70 bg-neg/5 text-neg focus:border-neg focus:ring-neg/20'
                      )}
                    />
                  </td>
                ))}
                <td className="w-8 py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => removeRow(type, row.id)}
                    aria-label="Remove line"
                    className="text-faint transition hover:text-neg"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const canAnalyze = hasLines && !busy && !blocked;

  return (
    <details className="acc panel rounded-2xl" open>
      <summary className="flex items-center justify-between gap-4 px-6 py-5">
        <span className="flex items-center gap-3">
          <span className="chev text-accent">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span>
            <span className="block font-display text-lg text-paper">Manual entry</span>
            <span className="rule-label">
              {seedSource
                ? 'Preloaded from your latest paste or upload — edit any figure and run again'
                : 'Type the figures yourself — periods are editable column headers'}
            </span>
          </span>
        </span>
        <span className="rule-label">
          {periods.length} period{periods.length === 1 ? '' : 's'}
        </span>
      </summary>
      <div className="acc-body space-y-5 border-t border-line px-6 py-5">
        {renderEditor('income', rows.income, incomeOptions, 'Income statement', 'Revenue, costs, profit')}
        {renderEditor('balance', rows.balance, balanceOptions, 'Balance sheet', 'Assets, liabilities, equity')}
        {renderEditor('cashflow', rows.cashflow, cashflowOptions, 'Cash flow statement', 'Operating, investing, financing')}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl font-mono text-[0.68rem] uppercase tracking-[0.14em] text-faint">
            Figures are entered as read; do not manually scale for thousands or millions. Labels are matched to the
            taxonomy automatically.
          </p>
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={!canAnalyze}
            className={cx(
              'rounded-full border px-6 py-2.5 font-mono text-xs uppercase tracking-[0.2em] transition',
              canAnalyze
                ? 'border-accent bg-accent/10 text-accent hover:bg-accent/20'
                : 'cursor-not-allowed border-line text-faint'
            )}
          >
            Analyze manual entry
          </button>
        </div>
      </div>
    </details>
  );
}
