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

  it('treats a lone trailing paren (OCR-dropped opener) as accounting-negative', () => {
    const doc = parseFinancialText({
      text: [
        'CONSOLIDATED INTERIM STATEMENTS OF INCOME\t\t',
        'Amounts in Million Pesos\t2025\t2024',
        'Sales\t657,933\t594,900',
        'Selling and administrative expenses\t3)\t(1)',
        'Net income\t9,670\t7,068',
      ].join('\n'),
      options: { applyUnitScaling: false },
    });

    const income = doc.statements.income;
    expect(income).not.toBeNull();
    expect(values(income, 'selling_general_and_administrative')).toEqual({ 2025: -3, 2024: -1 });
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
    expect(values(balance, 'noncontrolling_interests')).toEqual({ 2025: 10314, 2024: 9093 });
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

  it('keeps a pending two-line heading when the next line is a section header', () => {
    const rows = mergeContinuationRows([
      ['CASH FLOWS FROM'],
      ['FINANCING ACTIVITIES'],
      ['Net cash flows provided by (used in) financing'],
      ['activities', '(36,840)', '9,451'],
    ]);

    expect(rows).toEqual([
      ['CASH FLOWS FROM'],
      ['FINANCING ACTIVITIES'],
      ['Net cash flows provided by (used in) financing activities', '(36,840)', '9,451'],
    ]);
  });

  it('maps a financing total split across a heading and keeps cash-flow tail lines out of cash equivalents', () => {
    const doc = parseFinancialText({
      text: [
        'CONSOLIDATED INTERIM STATEMENTS OF CASH FLOWS\t\t',
        'For the Nine Months Ended\t2025\t2024',
        'Cash generated from operations\t65,993\t33,198',
        'Net cash provided by operating activities\t65,993\t33,198',
        'Net cash flows used in investing activities\t(4,948)\t(7,852)',
        'CASH FLOWS FROM',
        'FINANCING ACTIVITIES',
        'Net cash flows provided by (used in) financing activities\t(36,840)\t9,451',
        'EFFECTS OF EXCHANGE RATE CHANGES ON CASH AND CASH EQUIVALENTS\t144\t183',
        'NET INCREASE IN CASH AND CASH EQUIVALENTS\t9,825\t19,479',
        'CASH AND CASH EQUIVALENTS AT END OF PERIOD\t40,214\t46,998',
      ].join('\n'),
    });

    const cashflow = doc.statements.cashflow;
    expect(cashflow).not.toBeNull();
    expect(values(cashflow, 'net_cash_from_financing_activities')).toEqual({ 2025: -36840, 2024: 9451 });
    expect(values(cashflow, 'net_change_in_cash')).toEqual({ 2025: 9825, 2024: 19479 });
    expect(values(cashflow, 'cash_and_equivalents')).toBeNull();
  });

  it('prefers the disclosed net operating cash line over a cash-generated subtotal', () => {
    const doc = parseFinancialText({
      text: [
        'CONSOLIDATED INTERIM STATEMENTS OF CASH FLOWS\t\t',
        'For the Nine Months Ended\t2025\t2024',
        'Cash generated from operations\t65,993\t33,198',
        'Contributions to retirement fund\t(600)\t(700)',
        'Interest paid\t(13,825)\t(14,858)',
        'Income taxes paid\t(983)\t(766)',
        'Interest received\t884\t823',
        'Net cash flows provided by',
        'operating activities\t51,469\t17,697',
      ].join('\n'),
    });

    const cashflow = doc.statements.cashflow;
    expect(cashflow).not.toBeNull();
    expect(values(cashflow, 'net_cash_from_operating_activities')).toEqual({ 2025: 51469, 2024: 17697 });
    const item = cashflow?.lineItems.find((entry) => entry.category === 'net_cash_from_operating_activities');
    expect(item?.rawLabel).toMatch(/operating activities/i);
    expect(item?.source.row).toBe(8);
    expect(doc.warnings.some((warning) => /Replaced duplicate/.test(warning))).toBe(true);
  });

  it('prefers the net operating line when it lands in a later table', () => {
    const doc = parseFinancialText({
      text: [
        'CONSOLIDATED INTERIM STATEMENTS OF CASH FLOWS',
        'For the Nine Months Ended\t2025\t2024',
        'Cash generated from operations\t65,993\t33,198',
        'Net cash flows used in investing activities\t(4,948)\t(7,852)',
        '',
        '',
        '',
        'For the Nine Months Ended\t2025\t2024',
        'Net cash flows provided by operating activities\t51,469\t17,697',
        'Net cash flows provided by (used in) financing activities\t(36,840)\t9,451',
      ].join('\n'),
    });

    expect(values(doc.statements.cashflow, 'net_cash_from_operating_activities')).toEqual({
      2025: 51469,
      2024: 17697,
    });
  });

  it('merges a split net operating total', () => {
    const rows = mergeContinuationRows([
      ['Net cash flows provided by'],
      ['operating activities', '51,469', '17,697'],
    ]);

    expect(rows).toEqual([['Net cash flows provided by operating activities', '51,469', '17,697']]);
  });

  it('keeps cash-flow working-capital and tax lines out of balance/income categories', () => {
    const doc = parseFinancialText({
      text: [
        'CONSOLIDATED INTERIM STATEMENTS OF CASH FLOWS\t\t',
        'For the Nine Months Ended\t2025\t2024',
        'Changes in noncash assets, certain current liabilities and others\t29,765\t(1,054)',
        'Income taxes paid\t(983)\t(766)',
        'Net cash flows provided by operating activities\t51,469\t17,697',
      ].join('\n'),
    });

    const cashflow = doc.statements.cashflow;
    expect(cashflow).not.toBeNull();
    expect(values(cashflow, 'changes_in_working_capital')).toEqual({ 2025: 29765, 2024: -1054 });
    expect(values(cashflow, 'income_taxes_paid')).toEqual({ 2025: -983, 2024: -766 });
    expect(values(cashflow, 'total_current_liabilities')).toBeNull();
    expect(values(cashflow, 'income_tax_expense')).toBeNull();
  });

  it('labels investing and financing cash lines instead of balance-sheet categories', () => {
    const doc = parseFinancialText({
      text: [
        'CONSOLIDATED INTERIM STATEMENTS OF CASH FLOWS\t\t',
        'For the Nine Months Ended\t2025\t2024',
        'Proceeds from sale of property and equipment\t13\t-',
        'Additions to investment property\t(133)\t(240)',
        'Issuance of capital securities\t26,831\t-',
        'Repurchase of capital securities\t(25,051)\t(2,236)',
        'Acquisition of common treasury shares\t(1,130)\t-',
        'Net cash flows used in investing activities\t(4,948)\t(7,852)',
      ].join('\n'),
    });

    const cashflow = doc.statements.cashflow;
    expect(cashflow).not.toBeNull();
    expect(values(cashflow, 'proceeds_from_sale_of_assets')?.[2025]).toBe(13);
    expect(values(cashflow, 'additions_to_investment_property')?.[2025]).toBe(-133);
    expect(values(cashflow, 'issuance_of_capital_securities')?.[2025]).toBe(26831);
    expect(values(cashflow, 'repurchase_of_capital_securities')?.[2025]).toBe(-25051);
    expect(values(cashflow, 'treasury_share_repurchases')?.[2025]).toBe(-1130);
    expect(values(cashflow, 'property_plant_and_equipment')).toBeNull();
    expect(values(cashflow, 'investment_property')).toBeNull();
    expect(values(cashflow, 'capital_securities')).toBeNull();
    expect(values(cashflow, 'treasury_stock')).toBeNull();
  });

  it('appends a short label continuation to the previous numeric row', () => {
    const rows = mergeContinuationRows([
      ['Proceeds from availment of loans, bonds and', '304,147', '267,052'],
      ['advances'],
      ['Payments of:'],
      ['Loans and bonds', '(334,813)', '(265,546)'],
    ]);

    expect(rows).toEqual([
      ['Proceeds from availment of loans, bonds and advances', '304,147', '267,052'],
      ['Payments of: Loans and bonds', '(334,813)', '(265,546)'],
    ]);
  });

  it('maps dividends and distributions to dividends paid', () => {
    const doc = parseFinancialText({
      text: [
        'CONSOLIDATED INTERIM STATEMENTS OF CASH FLOWS\t\t',
        'For the Nine Months Ended\t2025\t2024',
        'Cash dividends and distributions\t(5,197)\t(4,457)',
        'Net cash flows provided by (used in) financing activities\t(36,840)\t9,451',
      ].join('\n'),
    });

    expect(values(doc.statements.cashflow, 'dividends_paid')).toEqual({ 2025: -5197, 2024: -4457 });
  });

  it('reconciles the cash flow statement and flags when it does not', () => {
    const lines = (netChange: string): string =>
      [
        'CONSOLIDATED INTERIM STATEMENTS OF CASH FLOWS\t\t',
        'For the Nine Months Ended\t2025\t2024',
        'Net cash flows provided by operating activities\t51,469\t17,697',
        'Net cash flows used in investing activities\t(4,948)\t(7,852)',
        'Net cash flows provided by (used in) financing activities\t(36,840)\t9,451',
        'EFFECTS OF EXCHANGE RATE CHANGES ON CASH AND CASH EQUIVALENTS\t144\t183',
        `NET INCREASE IN CASH AND CASH EQUIVALENTS\t${netChange}\t19,479`,
      ].join('\n');

    const balanced = parseFinancialText({ text: lines('9,825') });
    expect(values(balanced.statements.cashflow, 'effect_of_exchange_rate_changes_on_cash')).toEqual({
      2025: 144,
      2024: 183,
    });
    expect(balanced.warnings.some((warning) => /does not reconcile/.test(warning))).toBe(false);

    const broken = parseFinancialText({ text: lines('9,000') });
    expect(broken.warnings.some((warning) => /does not reconcile/.test(warning))).toBe(true);
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

  it('separates deferred tax and retirement liabilities and maps OCR current assets', () => {
    const doc = parseFinancialText({
      text: [
        'CONSOLIDATED INTERIM STATEMENTS OF FINANCIAL POSITION\t\t',
        'Note\t2025\t2024',
        'Other currentassets\t~~\t6\t4,686\t~~\t5,108',
        'Deferred tax liabilities - net\t7,937\t6,719',
        'Retirement benefits liability - net\t3,456\t3,661',
        'Other noncurrent liabilities\t474\t487',
        'Lease liabilities - current portion\t1,447\t1,295',
        'Lease liabilities - net of current portion\t12,500\t12,120',
        'Total Noncurrent Liabilities\t143,751\t112,333',
      ].join('\n'),
      options: { applyUnitScaling: false },
    });

    const balance = doc.statements.balance;
    expect(balance).not.toBeNull();
    expect(values(balance, 'other_current_assets')).toEqual({ 2025: 4686, 2024: 5108 });
    expect(values(balance, 'deferred_tax_liabilities')).toEqual({ 2025: 7937, 2024: 6719 });
    expect(values(balance, 'retirement_benefits_liability')).toEqual({ 2025: 3456, 2024: 3661 });
    expect(values(balance, 'other_non_current_liabilities')).toEqual({ 2025: 474, 2024: 487 });
    expect(values(balance, 'current_lease_liability')).toEqual({ 2025: 1447, 2024: 1295 });
    expect(values(balance, 'non_current_lease_liability')).toEqual({ 2025: 12500, 2024: 12120 });
    expect(balance?.warnings.some((warning) => /Conflicting values/.test(warning))).toBe(false);
  });

  it('maps non-controlling interests by statement type', () => {
    const incomeDoc = parseFinancialText({
      text: [
        'CONSOLIDATED INTERIM STATEMENTS OF INCOME\t\t',
        'Note\t2025\t2024',
        'Sales\t594,900\t657,933',
        'Net income\t9,670\t7,068',
        'Attributable to:',
        'Non-controlling interests\t724\t279',
      ].join('\n'),
      options: { applyUnitScaling: false },
    });

    const income = incomeDoc.statements.income;
    expect(income).not.toBeNull();
    expect(values(income, 'net_income_attributable_to_noncontrolling_interests')).toEqual({
      2025: 724,
      2024: 279,
    });
    expect(values(income, 'other_equity')).toBeNull();
  });

  it('ignores a standalone comprehensive income statement when a primary income statement exists', () => {
    const doc = parseFinancialText({
      text: [
        'CONSOLIDATED INTERIM STATEMENTS OF INCOME\t\t',
        'Note\t2025\t2024',
        'Sales\t594,900\t657,933',
        'Net income\t9,670\t7,068',
        'Attributable to:',
        'Non-controlling interests\t724\t279',
        '\f',
        'CONSOLIDATED INTERIM STATEMENTS OF COMPREHENSIVE INCOME\t\t',
        'Note\t2025\t2024',
        'Net income\t9,670\t7,068',
        'Other comprehensive income\t3,453\t6,471',
        'Total comprehensive income\t13,123\t13,545',
        'Attributable to:',
        'Non-controlling interests\t1,316\t1,396',
      ].join('\n'),
      options: { applyUnitScaling: false },
    });

    const income = doc.statements.income;
    expect(income).not.toBeNull();
    expect(values(income, 'net_income')).toEqual({ 2025: 9670, 2024: 7068 });
    expect(values(income, 'net_income_attributable_to_noncontrolling_interests')).toEqual({
      2025: 724,
      2024: 279,
    });
    expect(values(income, 'equity_reserves')).toBeNull();
    expect(doc.warnings.some((warning) => /Conflicting values/.test(warning))).toBe(false);
  });

  it('ignores earnings-per-share lines instead of treating them as net income', () => {
    const doc = parseFinancialText({
      text: [
        'CONSOLIDATED INTERIM STATEMENTS OF INCOME\t\t',
        'Note\t2025\t2024',
        'Net income\t9,670\t7,068',
        'Attributable to: Equity holders of the Parent Company\t8,946\t6,789',
        'Basic/diluted earnings per common share\t0.60\t0.43',
      ].join('\n'),
      options: { applyUnitScaling: false },
    });

    const income = doc.statements.income;
    expect(income).not.toBeNull();
    expect(values(income, 'net_income_attributable_to_parent')).toEqual({ 2025: 8946, 2024: 6789 });
    expect(income?.unmappedLabels).toEqual([]);
  });

  it('maps cash-flow adjustments and ignores statement headers', () => {
    const doc = parseFinancialText({
      text: [
        'CONSOLIDATED INTERIM STATEMENTS OF CASH FLOWS\t\t',
        'For the Nine Months Ended\t2025\t2024',
        'Nata\t2025\t2024',
        'Income before income tax\t12,652\t8,749',
        'Retirement benefits costs\t300\t232',
        'Unrealized foreign exchange losses - net\t309\t249',
        'Net reversal of allowance for impairment of receivables and inventories\t(50)\t(53)',
        'Other gains — net\t(1,111)\t(278)',
        'Increase in other noncurrent assets\t(3)\t-',
        'Lease liabilities\t(1,627)\t(2,186)',
        'Net cash flows provided by operating activities\t51,469\t17,697',
        'Net cash flows used in investing activities\t(4,948)\t(7,852)',
        'Net cash flows provided by (used in) financing activities\t(36,840)\t9,451',
      ].join('\n'),
      options: { applyUnitScaling: false },
    });

    const cashflow = doc.statements.cashflow;
    expect(cashflow).not.toBeNull();
    expect(values(cashflow, 'retirement_benefits_expense')).toEqual({ 2025: 300, 2024: 232 });
    expect(values(cashflow, 'unrealized_foreign_exchange_losses')).toEqual({ 2025: 309, 2024: 249 });
    expect(values(cashflow, 'impairment_reversal')).toEqual({ 2025: -50, 2024: -53 });
    expect(values(cashflow, 'other_operating_gains_losses')).toEqual({ 2025: -1111, 2024: -278 });
    expect(values(cashflow, 'other_investing_adjustments')).toEqual({ 2025: -3, 2024: 0 });
    expect(values(cashflow, 'payments_of_lease_liabilities')).toEqual({ 2025: -1627, 2024: -2186 });
    expect(cashflow?.unmappedLabels).toEqual([]);
  });
});
