import type {
  ManualStatementInput,
  ParseManualInput,
} from '@/lib/engine/parser';
import type { SupplementalInputs } from '@/lib/engine/ratios';
import { SAMPLE_SUPPLEMENTAL } from '@/lib/sample';

const row = (...cells: string[]) => cells.join('\t');

export const INCOME_MANUAL: ManualStatementInput = {
  type: 'income',
  periods: ['2025', '2024'],
  lines: [
    { label: 'Revenue', values: [1000000, 900000] },
    { label: 'Cost of Goods Sold', values: [600000, 560000] },
    { label: 'Gross Profit', values: [400000, 340000] },
    { label: 'Operating Expenses', values: [120000, 110000] },
    { label: 'Operating Income', values: [280000, 230000] },
    { label: 'Interest Expense', values: [20000, 18000] },
    { label: 'Income Before Income Taxes', values: [260000, 212000] },
    { label: 'Income Tax Expense', values: [52000, 42400] },
    { label: 'Net Income', values: [208000, 169600] },
  ],
};

export const BALANCE_MANUAL: ManualStatementInput = {
  type: 'balance',
  periods: ['2025', '2024'],
  lines: [
    { label: 'Cash and Cash Equivalents', values: [120000, 100000] },
    { label: 'Accounts Receivable', values: [80000, 70000] },
    { label: 'Inventory', values: [60000, 55000] },
    { label: 'Total Current Assets', values: [260000, 225000] },
    { label: 'Property, Plant and Equipment', values: [240000, 225000] },
    { label: 'Total Assets', values: [500000, 450000] },
    { label: 'Accounts Payable', values: [50000, 45000] },
    { label: 'Total Current Liabilities', values: [50000, 45000] },
    { label: 'Long-Term Debt', values: [150000, 145000] },
    { label: 'Total Liabilities', values: [200000, 190000] },
    { label: 'Common Stock', values: [100000, 100000] },
    { label: 'Retained Earnings', values: [200000, 160000] },
    { label: "Total Shareholders' Equity", values: [300000, 260000] },
  ],
};

export const MANUAL_INPUT: ParseManualInput = {
  statements: [INCOME_MANUAL, BALANCE_MANUAL],
  filename: 'manual-entry',
};

export const INCOME_TEXT = [
  row('Line Item', '2025', '2024'),
  row('Revenue', '1,000,000', '900,000'),
  row('Cost of Goods Sold', '600,000', '560,000'),
  row('Gross Profit', '400,000', '340,000'),
  row('Operating Expenses', '120,000', '110,000'),
  row('Operating Income', '280,000', '230,000'),
  row('Net Income', '208,000', '169,600'),
].join('\n');

export const BALANCE_TEXT = [
  row('Line Item', '2025', '2024'),
  row('Cash and Cash Equivalents', '120,000', '100,000'),
  row('Accounts Receivable', '80,000', '70,000'),
  row('Inventory', '60,000', '55,000'),
  row('Total Current Assets', '260,000', '225,000'),
  row('Total Assets', '500,000', '450,000'),
  row('Total Current Liabilities', '50,000', '45,000'),
  row('Total Liabilities', '200,000', '190,000'),
  row("Total Shareholders' Equity", '300,000', '260,000'),
].join('\n');

export const PASTED_TEXT = [INCOME_TEXT, '', '', BALANCE_TEXT].join('\n');

const toNumber = (value: string) => Number(value.replace(/[^0-9.-]/g, ''));

export const SAMPLE_SUPPLEMENTAL_NUMERIC: SupplementalInputs = Object.fromEntries(
  Object.entries(SAMPLE_SUPPLEMENTAL)
    .filter(([, value]) => value.trim() !== '')
    .map(([key, value]) => [key, toNumber(value)])
) as SupplementalInputs;

export { row };
