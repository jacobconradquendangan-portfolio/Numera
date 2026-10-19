import { describe, expect, it } from 'vitest';
import {
  classifyNumber,
  hasBlockingErrors,
  isMalformedNumber,
  validateFile,
  validateManualStatements,
  validatePastedText,
} from '@/lib/validation';
import type { ManualStatementPayload } from '@/lib/types';

const BALANCED: ManualStatementPayload = {
  type: 'balance',
  periods: ['2025', '2024'],
  lines: [
    { label: 'Total Assets', values: ['100,000', '100,000'] },
    { label: 'Total Liabilities', values: ['50,000', '50,000'] },
    { label: "Total Shareholders' Equity", values: ['50,000', '50,000'] },
  ],
};

describe('classifyNumber', () => {
  it('accepts plain, comma-grouped, parenthesised and dash values', () => {
    expect(classifyNumber('1,250')).toEqual({ kind: 'valid', value: 1250 });
    expect(classifyNumber('(500)')).toEqual({ kind: 'valid', value: -500 });
    expect(classifyNumber('$12,000')).toEqual({ kind: 'valid', value: 12000 });
    expect(classifyNumber('—')).toEqual({ kind: 'valid', value: 0 });
    expect(classifyNumber('12.5%')).toEqual({ kind: 'valid', value: 12.5 });
  });

  it('flags malformed and treats blanks as empty', () => {
    expect(classifyNumber('')).toEqual({ kind: 'empty', value: null });
    expect(isMalformedNumber('abc')).toBe(true);
    expect(isMalformedNumber('1.2.3')).toBe(true);
    expect(isMalformedNumber('12')).toBe(false);
    expect(isMalformedNumber('')).toBe(false);
  });
});

describe('validateManualStatements', () => {
  it('passes a balanced sheet without blocking errors', () => {
    const issues = validateManualStatements([BALANCED]);
    expect(hasBlockingErrors(issues)).toBe(false);
    expect(issues.some((entry) => entry.title.includes('does not reconcile'))).toBe(false);
  });

  it('warns when the balance sheet does not reconcile', () => {
    const issues = validateManualStatements([
      {
        type: 'balance',
        periods: ['2025'],
        lines: [
          { label: 'Total Assets', values: ['100000'] },
          { label: 'Total Liabilities', values: ['40000'] },
          { label: 'Total Equity', values: ['50000'] },
        ],
      },
    ]);
    const mismatch = issues.find((entry) => entry.title.includes('does not reconcile'));
    expect(mismatch).toBeDefined();
    expect(mismatch!.severity).toBe('warning');
    expect(mismatch!.detail).toContain('10,000');
  });

  it('ignores a parent-attributable equity subtotal when reading total equity', () => {
    const issues = validateManualStatements([
      {
        type: 'balance',
        periods: ['2025'],
        lines: [
          { label: 'Total Assets', values: ['113419'] },
          { label: 'Total Liabilities', values: ['0'] },
          {
            label: 'Total Equity Attributable to Equity Holders of the Parent Company',
            values: ['103105'],
          },
          { label: 'Non-controlling Interests', values: ['10314'] },
          { label: 'Total Equity', values: ['113419'] },
        ],
      },
    ]);
    expect(issues.some((entry) => entry.title.includes('does not reconcile'))).toBe(false);
  });

  it('blocks duplicate periods and unreadable values', () => {
    const issues = validateManualStatements([
      {
        type: 'income',
        periods: ['2025', '2025'],
        lines: [{ label: 'Revenue', values: ['12000', 'n/a-ish'] }],
      },
    ]);
    expect(issues.some((entry) => entry.severity === 'error' && entry.title.includes('Duplicate period'))).toBe(true);
    expect(issues.some((entry) => entry.severity === 'error' && entry.title.includes('unreadable'))).toBe(true);
    expect(hasBlockingErrors(issues)).toBe(true);
  });

  it('warns about missing totals and missing statements', () => {
    const issues = validateManualStatements([
      { type: 'balance', periods: ['2025'], lines: [{ label: 'Cash', values: ['1000'] }] },
    ]);
    expect(issues.some((entry) => entry.id.startsWith('missing-assets'))).toBe(true);
    expect(issues.some((entry) => entry.id.startsWith('missing-rhs'))).toBe(true);
    expect(issues.some((entry) => entry.id === 'no-income')).toBe(true);
  });

  it('errors when there is no input at all', () => {
    const issues = validateManualStatements([]);
    expect(hasBlockingErrors(issues)).toBe(true);
  });
});

describe('validatePastedText', () => {
  it('accepts two blank-line separated tables', () => {
    const text = [
      'Income Statement\t2025\t2024',
      'Revenue\t12000\t11000',
      'Cost of revenue\t7200\t6600',
      '',
      '',
      'Balance Sheet\t2025\t2024',
      'Cash\t2000\t1800',
      'Total assets\t2000\t1800',
    ].join('\n');
    const issues = validatePastedText(text);
    expect(issues.some((entry) => entry.id === 'one-table')).toBe(false);
    expect(hasBlockingErrors(issues)).toBe(false);
  });

  it('warns about a single table and a missing period header', () => {
    const issues = validatePastedText('Revenue\t12000\t11000');
    expect(issues.some((entry) => entry.id === 'one-table')).toBe(true);
    expect(issues.some((entry) => entry.id === 'no-header-1')).toBe(true);
    expect(hasBlockingErrors(issues)).toBe(false);
  });

  it('warns when rows have fewer values than periods', () => {
    const issues = validatePastedText(['2025\t2024', 'Cash\t2000'].join('\n'));
    expect(issues.some((entry) => entry.id === 'short-rows-1')).toBe(true);
  });

  it('errors on empty or numeric-free text', () => {
    expect(hasBlockingErrors(validatePastedText('   '))).toBe(true);
    expect(hasBlockingErrors(validatePastedText('Revenue\nCost of revenue'))).toBe(true);
  });
});

describe('validateFile', () => {
  it('rejects unsupported extensions and empty files', () => {
    expect(validateFile(new File(['x'], 'notes.txt')).some((entry) => entry.severity === 'error')).toBe(true);
    expect(validateFile(new File([], 'data.csv')).some((entry) => entry.id === 'empty-file')).toBe(true);
  });

  it('accepts a small CSV', () => {
    expect(validateFile(new File(['a,b\n1,2'], 'data.csv'))).toHaveLength(0);
  });
});
