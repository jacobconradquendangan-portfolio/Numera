import { describe, it, expect } from 'vitest';
import { parseFinancialText, mergeContinuationRows, type NormalizedStatement } from '@/lib/engine/parser';

function values(statement: NormalizedStatement | null, category: string): Record<string, number | null> | null {
  const item = statement?.lineItems.find((entry) => entry.category === category);
  return item ? item.values : null;
}

describe('parser hardening', () => {
  it('classifies a cash flow table as cashflow even with income-style adjustment lines', () => {
    const doc = parseFinancialText({
      text: [
        'CONSOLIDATED INTERIM STATEMENTS OF CASH FLOWS\t\t',
        'For the Nine Months Ended\t2025\t2024',
        'Income before income tax\t12,652\t8,749',
        'Depreciation and amortization\t9,776\t8,801',
        'Net cash from operating activities\t33,198\t29,401',
      ].join('\n'),
    });

    expect(doc.statements.cashflow).not.toBeNull();
    expect(doc.statements.income).toBeNull();
    expect(values(doc.statements.cashflow, 'net_cash_from_operating_activities')).toEqual({
      2025: 33198,
      2024: 29401,
    });
  });

  it('keeps "other noncurrent liabilities" distinct from "total noncurrent liabilities"', () => {
    const doc = parseFinancialText({
      text: [
        'CONSOLIDATED INTERIM STATEMENTS OF FINANCIAL POSITION\t\t',
        'Unaudited\t2025\t2024',
        'Other noncurrent liabilities\t474\t487',
        'Total Noncurrent Liabilities\t143,751\t112.333',
      ].join('\n'),
    });

    const balance = doc.statements.balance;
    expect(balance).not.toBeNull();
    expect(values(balance, 'other_non_current_liabilities')).toEqual({ 2025: 474, 2024: 487 });
    expect(values(balance, 'total_non_current_liabilities')).toEqual({ 2025: 143751, 2024: 112333 });
  });

  it('reads a balance sheet whose header spans multiple annotation rows', () => {
    const doc = parseFinancialText({
      text: [
        'CONSOLIDATED INTERIM STATEMENTS OF FINANCIAL POSITION\t\t',
        'Unaudited\tAudited',
        'September 30\tDecember 31',
        'Note\t2025\t2024',
        'Cash and cash equivalents\t40,214\t30,389',
        'Total Current Assets\t237,382\t255,873',
      ].join('\n'),
    });

    const balance = doc.statements.balance;
    expect(balance).not.toBeNull();
    expect(balance?.periods).toEqual(['2025', '2024']);
    expect(values(balance, 'cash_and_equivalents')).toEqual({ 2025: 40214, 2024: 30389 });
  });

  it('parses parenthesised, currency-prefixed, marker, and dot-thousands cells', () => {
    const doc = parseFinancialText({
      text: [
        'CONSOLIDATED INTERIM STATEMENTS OF INCOME\t\t',
        'Amounts in Million Pesos\t2025\t2024',
        'Sales\t594,900\t657,933',
        'Cost of goods sold\t(555,273)\t(623,542)',
        'Selling and administrative expenses\tP= (14,443)\t(13,460)',
        'Other operating income\thigh\t1,452',
        'Gross profit\t39,627\t34,391',
        'Net income\t9,670\t7,068',
      ].join('\n'),
      options: { applyUnitScaling: false },
    });

    const income = doc.statements.income;
    expect(income).not.toBeNull();
    expect(values(income, 'revenue')).toEqual({ 2025: 594900, 2024: 657933 });
    expect(values(income, 'cost_of_goods_sold')).toEqual({ 2025: -555273, 2024: -623542 });
    expect(values(income, 'selling_general_and_administrative')).toEqual({ 2025: -14443, 2024: -13460 });
    expect(values(income, 'other_operating_income')?.[2024]).toBe(1452);
    expect(values(income, 'other_operating_income')?.[2025]).toBeNull();
  });

  it('maps deferred tax assets, goodwill-net, and capital stock line items', () => {
    const doc = parseFinancialText({
      text: [
        'CONSOLIDATED INTERIM STATEMENTS OF FINANCIAL POSITION\t\t',
        'September 30\tDecember 31',
        'Note\t2025\t2024',
        'Goodwill - net\t9,299\t8,731',
        'Deferred tax assets - net\t539\t560',
        'Other noncurrent assets - net\t2,055\t2,003',
        'Capital stock\t9,502\t9,502',
      ].join('\n'),
      options: { applyUnitScaling: false },
    });

    const balance = doc.statements.balance;
    expect(balance).not.toBeNull();
    expect(values(balance, 'goodwill')).toEqual({ 2025: 9299, 2024: 8731 });
    expect(values(balance, 'deferred_tax_assets')).toEqual({ 2025: 539, 2024: 560 });
    expect(values(balance, 'other_non_current_assets')).toEqual({ 2025: 2055, 2024: 2003 });
    expect(values(balance, 'common_stock')).toEqual({ 2025: 9502, 2024: 9502 });
  });

  it('maps a parent-attributable equity subtotal without clobbering total equity', () => {
    const doc = parseFinancialText({
      text: [
        'CONSOLIDATED STATEMENTS OF FINANCIAL POSITION\t\t',
        'Note\t2025\t2024',
        'Non-controlling Interests\t10,314\t9,093',
        'Total Equity Attributable to Equity Holders of the Parent Company\t103,105\t95,117',
        'Total Equity\t113,419\t104,210',
      ].join('\n'),
      options: { applyUnitScaling: false },
    });

    const balance = doc.statements.balance;
    expect(balance).not.toBeNull();
    expect(values(balance, 'equity_attributable_to_parent')).toEqual({ 2025: 103105, 2024: 95117 });
    expect(values(balance, 'total_equity')).toEqual({ 2025: 113419, 2024: 104210 });
  });

  it('merges OCR label-continuation rows but keeps section headers intact', () => {
    const rows = mergeContinuationRows([
      ['SELLING AND ADMINISTRATIVE'],
      ['EXPENSES', '-14,443', '-13,460'],
      ['Current Assets'],
      ['Cash and cash equivalents', '40,214', '30,389'],
      ['CASH FLOWS FROM OPERATING'],
      ['ACTIVITIES'],
      ['Income before income tax', '12,652', '8,749'],
    ]);

    expect(rows).toEqual([
      ['SELLING AND ADMINISTRATIVE EXPENSES', '-14,443', '-13,460'],
      ['Current Assets'],
      ['Cash and cash equivalents', '40,214', '30,389'],
      ['CASH FLOWS FROM OPERATING'],
      ['ACTIVITIES'],
      ['Income before income tax', '12,652', '8,749'],
    ]);
  });

  it('keeps the current portion of long-term debt separate from short-term loans', () => {
    const doc = parseFinancialText({
      text: [
        'CONSOLIDATED INTERIM STATEMENTS OF FINANCIAL POSITION\t\t',
        'Note\t2025\t2024',
        'Short-term loans\t6,7,8,9\t77,450\t138,906',
        'Current portion of long-term debt - net\t8,9\t28,213\t29,418',
        'Total Current Liabilities\t191,971\t252,259',
      ].join('\n'),
      options: { hint: 'balance' },
    });

    const balance = doc.statements.balance;
    expect(balance).not.toBeNull();
    expect(values(balance, 'short_term_debt')).toEqual({ 2025: 77450, 2024: 138906 });
    expect(values(balance, 'current_portion_of_long_term_debt')).toEqual({ 2025: 28213, 2024: 29418 });
  });

  it('recovers a prior fiscal-year net income from a segment note for TTM derivation', () => {
    const doc = parseFinancialText({
      text: [
        'Elimination/\tPetroleum\tLeasing\tMarketing\tOthers\tTotal',
        'December 31, 2024',
        'Revenue:',
        'External sales\t864,765\t1,229\t1,163\t809\t867,966',
        'Operating income\t29,052\t(90)\t16\t245\t29,223',
        'Net income\t11,630\t(91)\t37\t(3,105)\t8,471',
        'Other segment information:',
        'Interest expense\t21,116\t320\t1\t(476)\t20,961',
        'Interest income\t1,207\t281\t16\t(303)\t1,201',
        'Income tax expense\t4,449\t(33)\t8\t99\t4,523',
      ].join('\n'),
    });

    expect(doc.annualNetIncome?.['2024']?.value).toBe(8471);
    expect(doc.annualNetIncome?.['2024']?.source).toMatch(/December 31, 2024/);
  });

  it('ignores an interim block that shares the fiscal year label when no fiscal year-end header applies', () => {
    const doc = parseFinancialText({
      text: [
        'September 30, 2024 (As restated)',
        'Revenue:',
        'Net income\t8,852\t133\t24\t(1,941)\t7,068',
        'Interest expense\t15,759\t247\t1\t(358)\t15,649',
      ].join('\n'),
    });

    expect(doc.annualNetIncome).toBeUndefined();
  });
});
