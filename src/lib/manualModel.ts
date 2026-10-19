'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CategoryOption, ManualStatementPayload, NormalizedStatement, StatementType } from '@/lib/types';

export interface ManualRow {
  id: string;
  label: string;
  values: string[];
  sourceLabel?: string;
}

export type ManualRows = Record<StatementType, ManualRow[]>;

export interface ManualSeed {
  source: string;
  statements: NormalizedStatement[];
}

export interface ManualModel {
  periods: string[];
  rows: ManualRows;
  categories: CategoryOption[];
  incomeOptions: CategoryOption[];
  balanceOptions: CategoryOption[];
  cashflowOptions: CategoryOption[];
  seedSource: string | null;
  addPeriod: () => void;
  updatePeriod: (index: number, value: string) => void;
  removePeriod: (index: number) => void;
  updateLabel: (type: StatementType, id: string, value: string) => void;
  updateValue: (type: StatementType, id: string, column: number, value: string) => void;
  applyCorrection: (type: StatementType, label: string, period: string, value: string) => void;
  addRow: (type: StatementType) => void;
  removeRow: (type: StatementType, id: string) => void;
  reset: () => void;
  applySeed: (statements: NormalizedStatement[]) => void;
  toStatements: () => ManualStatementPayload[];
}

const DEFAULT_PERIODS = ['2025', '2024'];
const DEFAULT_COUNTS: Record<StatementType, number> = { income: 3, balance: 3, cashflow: 2 };
const STATEMENT_TYPES: StatementType[] = ['income', 'balance', 'cashflow'];

let idSequence = 0;
function nextId(): string {
  idSequence += 1;
  return `row-${idSequence}`;
}

export function emptyRow(cols: number): ManualRow {
  return { id: nextId(), label: '', values: Array.from({ length: cols }, () => '') };
}

function defaultRows(cols: number): ManualRows {
  return {
    income: Array.from({ length: DEFAULT_COUNTS.income }, () => emptyRow(cols)),
    balance: Array.from({ length: DEFAULT_COUNTS.balance }, () => emptyRow(cols)),
    cashflow: Array.from({ length: DEFAULT_COUNTS.cashflow }, () => emptyRow(cols)),
  };
}

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

export function useManualModel(): ManualModel {
  const [periods, setPeriods] = useState<string[]>(DEFAULT_PERIODS);
  const [rows, setRows] = useState<ManualRows>(() => defaultRows(2));
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [seed, setSeed] = useState<ManualSeed | null>(null);
  const [seedSource, setSeedSource] = useState<string | null>(null);
  const seededFrom = useRef<string | null>(null);
  const seedSequence = useRef(0);

  useEffect(() => {
    let alive = true;
    fetch('/api/categories')
      .then((response) => response.json())
      .then((payload: { categories?: CategoryOption[] }) => {
        if (alive) setCategories(payload.categories ?? []);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const setterFor = useCallback(
    (type: StatementType) => (updater: (current: ManualRow[]) => ManualRow[]) =>
      setRows((previous) => ({ ...previous, [type]: updater(previous[type]) })),
    []
  );

  const updatePeriod = useCallback((index: number, value: string) => {
    setPeriods((previous) => previous.map((period, i) => (i === index ? value : period)));
  }, []);

  const addPeriod = useCallback(() => {
    setPeriods((previous) => [...previous, '']);
    setRows((previous) => {
      const next = { ...previous };
      for (const type of STATEMENT_TYPES) {
        next[type] = previous[type].map((row) => ({ ...row, values: [...row.values, ''] }));
      }
      return next;
    });
  }, []);

  const removePeriod = useCallback((index: number) => {
    setPeriods((previous) => (previous.length <= 1 ? previous : previous.filter((_, i) => i !== index)));
    setRows((previous) => {
      const next = { ...previous };
      for (const type of STATEMENT_TYPES) {
        next[type] = previous[type].map((row) => ({ ...row, values: row.values.filter((_, i) => i !== index) }));
      }
      return next;
    });
  }, []);

  const updateLabel = useCallback(
    (type: StatementType, id: string, value: string) => {
      setterFor(type)((current) =>
        current.map((row) => (row.id === id ? { ...row, label: value, sourceLabel: undefined } : row))
      );
    },
    [setterFor]
  );

  const updateValue = useCallback(
    (type: StatementType, id: string, column: number, value: string) => {
      setterFor(type)((current) =>
        current.map((row) =>
          row.id === id ? { ...row, values: row.values.map((existing, i) => (i === column ? value : existing)) } : row
        )
      );
    },
    [setterFor]
  );

  const applyCorrection = useCallback(
    (type: StatementType, label: string, period: string, value: string) => {
      const column = periods.indexOf(period);
      if (column < 0) return;
      const target = normalizeLabel(label);
      setterFor(type)((current) =>
        current.map((row) =>
          normalizeLabel(row.label) === target
            ? { ...row, values: row.values.map((existing, i) => (i === column ? value : existing)) }
            : row
        )
      );
    },
    [periods, setterFor]
  );

  const addRow = useCallback(
    (type: StatementType) => {
      setRows((previous) => ({ ...previous, [type]: [...previous[type], emptyRow(previous[type][0]?.values.length ?? periods.length)] }));
    },
    [periods.length]
  );

  const removeRow = useCallback(
    (type: StatementType, id: string) => {
      setterFor(type)((current) => current.filter((row) => row.id !== id));
    },
    [setterFor]
  );

  const reset = useCallback(() => {
    seededFrom.current = null;
    setSeed(null);
    setSeedSource(null);
    setPeriods(DEFAULT_PERIODS);
    setRows(defaultRows(2));
  }, []);

  const applySeed = useCallback((statements: NormalizedStatement[]) => {
    seedSequence.current += 1;
    setSeed({ source: `seed-${seedSequence.current}`, statements });
  }, []);

  useEffect(() => {
    if (!seed || !categories.length) return;
    if (seededFrom.current === seed.source) return;
    seededFrom.current = seed.source;
    setSeedSource(seed.source);
    const labelByKey = new Map(categories.map((category) => [category.key, category.label] as const));
    const periodSet: string[] = [];
    for (const statement of seed.statements) {
      for (const period of statement.periods) {
        if (!periodSet.includes(period)) periodSet.push(period);
      }
    }
    if (!periodSet.length) return;
    const take = (type: StatementType): ManualRow[] | null => {
      const statement = seed.statements.find((entry) => entry.type === type);
      if (!statement) return null;
      const built = statement.lineItems
        .map((item) => {
          const canonical = item.category ? labelByKey.get(item.category) : undefined;
          const label = canonical ?? item.rawLabel;
          const differs =
            canonical !== undefined && canonical.trim().toLowerCase() !== item.rawLabel.trim().toLowerCase();
          return {
            id: nextId(),
            label,
            sourceLabel: differs ? item.rawLabel : undefined,
            values: periodSet.map((period) => {
              const value = item.values[period];
              return value === null || value === undefined ? '' : String(value);
            }),
          };
        })
        .filter((row) => row.values.some((value) => value !== ''));
      return built.length ? built : null;
    };
    const income = take('income');
    const balance = take('balance');
    const cashflow = take('cashflow');
    setPeriods(periodSet);
    setRows((previous) => ({
      income: income ?? previous.income,
      balance: balance ?? previous.balance,
      cashflow: cashflow ?? previous.cashflow,
    }));
  }, [seed, categories]);

  const toStatements = useCallback((): ManualStatementPayload[] => {
    const build = (type: StatementType): ManualStatementPayload | null => {
      const activeColumns = periods
        .map((period, index) => ({ period: period.trim(), index }))
        .filter((column) => column.period !== '');
      if (!activeColumns.length) return null;
      const lines = rows[type]
        .map((row) => ({
          label: row.label.trim(),
          values: activeColumns.map((column) => (row.values[column.index] ?? '').trim()),
        }))
        .filter((line) => line.label !== '' && line.values.some((value) => value !== ''));
      if (!lines.length) return null;
      return { type, periods: activeColumns.map((column) => column.period), lines };
    };
    return STATEMENT_TYPES.map(build).filter((statement): statement is ManualStatementPayload => statement !== null);
  }, [periods, rows]);

  const incomeOptions = useMemo(() => categories.filter((category) => category.statement === 'income'), [categories]);
  const balanceOptions = useMemo(() => categories.filter((category) => category.statement === 'balance'), [categories]);
  const cashflowOptions = useMemo(() => categories.filter((category) => category.statement === 'cashflow'), [categories]);

  return useMemo<ManualModel>(
    () => ({
      periods,
      rows,
      categories,
      incomeOptions,
      balanceOptions,
      cashflowOptions,
      seedSource,
      addPeriod,
      updatePeriod,
      removePeriod,
      updateLabel,
      updateValue,
      applyCorrection,
      addRow,
      removeRow,
      reset,
      applySeed,
      toStatements,
    }),
    [
      periods,
      rows,
      categories,
      incomeOptions,
      balanceOptions,
      cashflowOptions,
      seedSource,
      addPeriod,
      updatePeriod,
      removePeriod,
      updateLabel,
      updateValue,
      applyCorrection,
      addRow,
      removeRow,
      reset,
      applySeed,
      toStatements,
    ]
  );
}
