import type { SupplementalForm } from '@/lib/types';

const row = (...cells: string[]) => cells.join('\t');

const income = [
  row('Line Item', '2025', '2024', '2023'),
  row('Revenue', '1,250,000', '1,100,000', '970,000'),
  row('Cost of Goods Sold', '750,000', '680,000', '610,000'),
  row('Gross Profit', '500,000', '420,000', '360,000'),
  row('Research and Development', '60,000', '52,000', '46,000'),
  row('Selling, General and Administrative', '140,000', '128,000', '118,000'),
  row('Depreciation and Amortization', '40,000', '36,000', '34,000'),
  row('Operating Expenses', '240,000', '216,000', '198,000'),
  row('Operating Income', '260,000', '204,000', '162,000'),
  row('Interest Expense', '20,000', '18,000', '16,000'),
  row('Income Before Income Taxes', '240,000', '186,000', '146,000'),
  row('Income Tax Expense', '48,000', '37,200', '29,200'),
  row('Net Income', '192,000', '148,800', '116,800'),
];

const balance = [
  row('Line Item', '2025', '2024', '2023'),
  row('Cash and Cash Equivalents', '200,000', '180,000', '160,000'),
  row('Short-Term Investments', '50,000', '40,000', '30,000'),
  row('Accounts Receivable', '180,000', '160,000', '145,000'),
  row('Inventory', '150,000', '130,000', '120,000'),
  row('Prepaid Expenses', '20,000', '15,000', '12,000'),
  row('Total Current Assets', '600,000', '525,000', '467,000'),
  row('Property, Plant and Equipment', '500,000', '470,000', '440,000'),
  row('Intangible Assets', '100,000', '90,000', '80,000'),
  row('Goodwill', '50,000', '50,000', '50,000'),
  row('Total Assets', '1,250,000', '1,135,000', '1,037,000'),
  row('Accounts Payable', '120,000', '110,000', '100,000'),
  row('Short-Term Debt', '60,000', '50,000', '45,000'),
  row('Accrued Liabilities', '40,000', '35,000', '32,000'),
  row('Deferred Revenue', '30,000', '25,000', '22,000'),
  row('Total Current Liabilities', '250,000', '220,000', '199,000'),
  row('Long-Term Debt', '200,000', '190,000', '180,000'),
  row('Other Non-Current Liabilities', '50,000', '45,000', '40,000'),
  row('Total Liabilities', '500,000', '455,000', '419,000'),
  row('Common Stock', '100,000', '100,000', '100,000'),
  row('Additional Paid-In Capital', '200,000', '200,000', '200,000'),
  row('Retained Earnings', '450,000', '380,000', '318,000'),
  row("Total Shareholders' Equity", '750,000', '680,000', '618,000'),
];

const cashflow = [
  row('Line Item', '2025', '2024', '2023'),
  row('Net Cash from Operating Activities', '232,000', '184,800', '150,800'),
  row('Capital Expenditures', '80,000', '70,000', '60,000'),
  row('Net Cash from Investing Activities', '(80,000)', '(70,000)', '(60,000)'),
  row('Net Cash from Financing Activities', '(32,000)', '(30,000)', '(28,000)'),
];

export const SAMPLE_TEXT = [...income, '', '', ...balance, '', '', ...cashflow].join('\n');

export const SAMPLE_SUPPLEMENTAL: SupplementalForm = {
  sharePrice: '25',
  sharesOutstanding: '80000',
  earningsPerShare: '2.40',
  marketCapitalization: '2000000',
  enterpriseValue: '2060000',
  ebitda: '300000',
  ebit: '260000',
  totalDebt: '260000',
  cashAndEquivalents: '200000',
  netIncomeTrailing12Months: '',
  volumeCurrent: '',
  volumePrior: '',
};
