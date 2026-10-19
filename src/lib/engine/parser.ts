import pdfParse from 'pdf-parse';
import * as XLSX from 'xlsx';
import { promises as fs } from 'fs';
import * as path from 'path';

export type StatementType = 'income' | 'balance' | 'cashflow';

export type Section =
  | 'revenue'
  | 'expense'
  | 'other_income'
  | 'current_assets'
  | 'non_current_assets'
  | 'total_assets'
  | 'current_liabilities'
  | 'non_current_liabilities'
  | 'total_liabilities'
  | 'equity'
  | 'total_equity'
  | 'liabilities_and_equity'
  | 'operating_activities'
  | 'investing_activities'
  | 'financing_activities'
  | 'cash_summary';

export type FinancialCategory =
  | 'revenue'
  | 'cost_of_goods_sold'
  | 'gross_profit'
  | 'research_and_development'
  | 'selling_general_and_administrative'
  | 'operating_expenses'
  | 'depreciation_and_amortization'
  | 'operating_income'
  | 'interest_expense'
  | 'interest_income'
  | 'other_income_expense'
  | 'pretax_income'
  | 'income_tax_expense'
  | 'net_income'
  | 'ebitda'
  | 'cash_and_equivalents'
  | 'short_term_investments'
  | 'accounts_receivable'
  | 'inventory'
  | 'prepaid_expenses'
  | 'other_current_assets'
  | 'total_current_assets'
  | 'property_plant_and_equipment'
  | 'intangible_assets'
  | 'goodwill'
  | 'deferred_tax_assets'
  | 'long_term_investments'
  | 'other_non_current_assets'
  | 'total_assets'
  | 'accounts_payable'
  | 'short_term_debt'
  | 'current_portion_of_long_term_debt'
  | 'accrued_liabilities'
  | 'deferred_revenue'
  | 'other_current_liabilities'
  | 'total_current_liabilities'
  | 'long_term_debt'
  | 'other_non_current_liabilities'
  | 'total_liabilities'
  | 'common_stock'
  | 'additional_paid_in_capital'
  | 'retained_earnings'
  | 'treasury_stock'
  | 'other_equity'
  | 'total_equity'
  | 'total_liabilities_and_equity'
  | 'net_cash_from_operating_activities'
  | 'net_cash_from_investing_activities'
  | 'net_cash_from_financing_activities'
  | 'capital_expenditures'
  | 'dividends_paid'
  | 'net_change_in_cash'
  | 'other_operating_income'
  | 'share_in_associate_and_joint_ventures'
  | 'net_income_attributable_to_parent'
  | 'net_income_attributable_to_noncontrolling_interests'
  | 'investment_in_associates'
  | 'right_of_use_assets'
  | 'investment_property'
  | 'total_non_current_assets'
  | 'crude_oil_and_petroleum_product_liabilities'
  | 'derivative_liabilities'
  | 'income_tax_payable'
  | 'current_lease_liability'
  | 'non_current_lease_liability'
  | 'asset_retirement_obligation'
  | 'total_non_current_liabilities'
  | 'capital_securities'
  | 'equity_reserves'
  | 'equity_attributable_to_parent';

export type DocumentFormat = 'pdf' | 'xlsx' | 'csv' | 'text' | 'manual';

export interface CategoryDefinition {
  key: FinancialCategory;
  statement: StatementType;
  section: Section;
  label: string;
  synonyms: string[];
  total?: boolean;
}

export interface LineItemSource {
  table: string;
  row: number;
}

export interface NormalizedLineItem {
  rawLabel: string;
  category: FinancialCategory;
  statement: StatementType;
  section: Section;
  values: Record<string, number | null>;
  derived: boolean;
  confidence: number;
  source: LineItemSource;
}

export interface NormalizedStatement {
  type: StatementType;
  periods: string[];
  unitMultiplier: number;
  lineItems: NormalizedLineItem[];
  unmappedLabels: string[];
  warnings: string[];
}

export interface BalanceSheetValidation {
  period: string;
  formula: string;
  substitution: string;
  totalAssets: number | null;
  totalLiabilities: number | null;
  totalEquity: number | null;
  totalLiabilitiesAndEquity: number | null;
  difference: number | null;
  relativeDifference: number | null;
  tolerance: number;
  balanced: boolean;
  message: string;
}

export interface AnnualNetIncomeReference {
  value: number;
  source: string;
}

export interface SearchablePdf {
  base64: string;
  pageCount: number;
  mimeType: 'application/pdf';
}

export interface SourcePageWord {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface SourcePage {
  page: number;
  image: string;
  words: SourcePageWord[];
}

export interface ParsedDocument {
  source: {
    filename?: string;
    format: DocumentFormat;
    tableCount: number;
  };
  statements: {
    income: NormalizedStatement | null;
    balance: NormalizedStatement | null;
    cashflow: NormalizedStatement | null;
  };
  validations: BalanceSheetValidation[];
  warnings: string[];
  annualNetIncome?: Record<string, AnnualNetIncomeReference>;
  searchablePdf?: SearchablePdf;
  sourcePages?: SourcePage[];
}

export interface ParserOptions {
  hint?: StatementType;
  absTolerance?: number;
  relTolerance?: number;
  applyUnitScaling?: boolean;
  minMatchConfidence?: number;
  ocr?: boolean;
}

export interface ParseInput {
  data: Buffer | ArrayBuffer | Uint8Array;
  filename?: string;
  mimeType?: string;
  options?: ParserOptions;
}

interface ResolvedOptions {
  hint?: StatementType;
  absTolerance: number;
  relTolerance: number;
  applyUnitScaling: boolean;
  minMatchConfidence: number;
  ocr: boolean;
}

export interface RawTable {
  name: string;
  rows: string[][];
  periods?: string[];
}

interface NumericEntry {
  col: number;
  value: number;
}

interface PeriodColumn {
  label: string;
  col: number;
}

interface IntermediateStatement {
  type: StatementType;
  tableName: string;
  periods: string[];
  multiplier: number;
  items: Map<FinancialCategory, NormalizedLineItem>;
  unmapped: string[];
  warnings: string[];
}

interface MatchResult {
  category: FinancialCategory | null;
  confidence: number;
}

const DEFAULT_OPTIONS: ResolvedOptions = {
  absTolerance: 1,
  relTolerance: 0.005,
  applyUnitScaling: true,
  minMatchConfidence: 0.6,
  ocr: true,
};

const TAXONOMY: CategoryDefinition[] = [
  {
    key: 'revenue',
    statement: 'income',
    section: 'revenue',
    label: 'Revenue',
    synonyms: [
      'revenue',
      'revenues',
      'total revenue',
      'total revenues',
      'net revenue',
      'net revenues',
      'net sales',
      'sales',
      'total sales',
      'total net sales',
      'operating revenue',
      'net operating revenue',
      'turnover',
    ],
  },
  {
    key: 'cost_of_goods_sold',
    statement: 'income',
    section: 'expense',
    label: 'Cost of Goods Sold',
    synonyms: [
      'cost of goods sold',
      'cost of sales',
      'cost of revenue',
      'cost of revenues',
      'cogs',
      'cost of products sold',
      'cost of services',
    ],
  },
  {
    key: 'gross_profit',
    statement: 'income',
    section: 'revenue',
    label: 'Gross Profit',
    synonyms: ['gross profit', 'gross margin', 'gross income'],
    total: true,
  },
  {
    key: 'research_and_development',
    statement: 'income',
    section: 'expense',
    label: 'Research and Development',
    synonyms: [
      'research and development',
      'research development',
      'research and development expense',
      'research and development expenses',
      'r&d',
      'r and d',
      'r and d expense',
    ],
  },
  {
    key: 'selling_general_and_administrative',
    statement: 'income',
    section: 'expense',
    label: 'Selling, General and Administrative',
    synonyms: [
      'selling general and administrative',
      'selling general administrative',
      'selling general and administrative expenses',
      'selling and administrative',
      'selling and administrative expense',
      'selling and administrative expenses',
      'sga',
      'sg&a',
      'sg and a',
      'general and administrative',
      'general and administrative expenses',
      'selling and marketing',
      'selling and marketing expenses',
    ],
  },
  {
    key: 'operating_expenses',
    statement: 'income',
    section: 'expense',
    label: 'Operating Expenses',
    synonyms: [
      'operating expenses',
      'total operating expenses',
      'operating expense',
      'total operating expense',
    ],
    total: true,
  },
  {
    key: 'depreciation_and_amortization',
    statement: 'income',
    section: 'expense',
    label: 'Depreciation and Amortization',
    synonyms: [
      'depreciation and amortization',
      'depreciation amortization',
      'depreciation and amortisation',
      'depreciation',
      'amortization',
      'amortisation',
    ],
  },
  {
    key: 'operating_income',
    statement: 'income',
    section: 'other_income',
    label: 'Operating Income',
    synonyms: [
      'operating income',
      'income from operations',
      'operating profit',
      'operating income loss',
      'income loss from operations',
      'ebit',
    ],
    total: true,
  },
  {
    key: 'other_operating_income',
    statement: 'income',
    section: 'other_income',
    label: 'Other Operating Income',
    synonyms: ['other operating income', 'other operating income net', 'miscellaneous operating income'],
  },
  {
    key: 'interest_expense',
    statement: 'income',
    section: 'expense',
    label: 'Interest Expense',
    synonyms: [
      'interest expense',
      'interest expense net',
      'interest and debt expense',
      'finance costs',
    ],
  },
  {
    key: 'interest_income',
    statement: 'income',
    section: 'other_income',
    label: 'Interest Income',
    synonyms: ['interest income', 'interest and other income', 'investment income'],
  },
  {
    key: 'share_in_associate_and_joint_ventures',
    statement: 'income',
    section: 'other_income',
    label: 'Share in Net Income of Associates and Joint Ventures',
    synonyms: [
      'share in net income of an associate and joint ventures',
      'share in net income of associate and joint ventures',
      'share in net income of associates and joint ventures',
      'share in net income of associates',
      'share in net income of joint ventures',
      'equity in earnings of associates',
      'share of profit of associates',
      'income from associates',
    ],
  },
  {
    key: 'other_income_expense',
    statement: 'income',
    section: 'other_income',
    label: 'Other Income (Expense), Net',
    synonyms: [
      'other income expense net',
      'other income net',
      'other expense net',
      'other income expense',
      'non operating income',
      'other non operating income',
    ],
  },
  {
    key: 'pretax_income',
    statement: 'income',
    section: 'other_income',
    label: 'Income Before Income Taxes',
    synonyms: [
      'income before income taxes',
      'income before income tax',
      'income before taxes',
      'income loss before income taxes',
      'pretax income',
      'pre tax income',
      'profit before tax',
      'earnings before income taxes',
    ],
    total: true,
  },
  {
    key: 'income_tax_expense',
    statement: 'income',
    section: 'expense',
    label: 'Income Tax Expense',
    synonyms: [
      'income tax expense',
      'provision for income taxes',
      'income taxes',
      'income tax provision',
      'tax expense',
    ],
  },
  {
    key: 'net_income',
    statement: 'income',
    section: 'other_income',
    label: 'Net Income',
    synonyms: [
      'net income',
      'net earnings',
      'net profit',
      'net income loss',
      'profit for the period',
      'profit for the year',
      'net income attributable to parent',
    ],
    total: true,
  },
  {
    key: 'net_income_attributable_to_parent',
    statement: 'income',
    section: 'other_income',
    label: 'Net Income Attributable to Equity Holders of the Parent',
    synonyms: [
      'attributable to equity holders of the parent company',
      'attributable to equity holders of the parent',
      'net income attributable to equity holders of the parent',
      'net income attributable to parent',
      'attributable to owners of the parent',
    ],
  },
  {
    key: 'net_income_attributable_to_noncontrolling_interests',
    statement: 'income',
    section: 'other_income',
    label: 'Net Income Attributable to Non-controlling Interests',
    synonyms: [
      'attributable to non controlling interests',
      'attributable to noncontrolling interests',
      'net income attributable to non controlling interests',
      'net income attributable to minority interests',
    ],
  },
  {
    key: 'ebitda',
    statement: 'income',
    section: 'other_income',
    label: 'EBITDA',
    synonyms: ['ebitda', 'adjusted ebitda'],
  },
  {
    key: 'cash_and_equivalents',
    statement: 'balance',
    section: 'current_assets',
    label: 'Cash and Cash Equivalents',
    synonyms: [
      'cash and cash equivalents',
      'cash and equivalents',
      'cash and short term investments',
      'cash cash equivalents and short term investments',
      'cash',
      'cash equivalents',
    ],
  },
  {
    key: 'short_term_investments',
    statement: 'balance',
    section: 'current_assets',
    label: 'Short-Term Investments',
    synonyms: [
      'short term investments',
      'marketable securities',
      'short term investments and marketable securities',
      'short term marketable securities',
      'financial assets at fair value',
      'financial assets at fair value through profit or loss',
      'financial assets at fair value through other comprehensive income',
    ],
  },
  {
    key: 'accounts_receivable',
    statement: 'balance',
    section: 'current_assets',
    label: 'Accounts Receivable',
    synonyms: [
      'accounts receivable',
      'accounts receivable net',
      'accounts receivable trade',
      'trade receivables',
      'trade and other receivables',
      'trade and other receivables net',
      'receivables',
      'receivables net',
    ],
  },
  {
    key: 'inventory',
    statement: 'balance',
    section: 'current_assets',
    label: 'Inventory',
    synonyms: ['inventory', 'inventories', 'inventory net', 'inventories net'],
  },
  {
    key: 'prepaid_expenses',
    statement: 'balance',
    section: 'current_assets',
    label: 'Prepaid Expenses',
    synonyms: [
      'prepaid expenses',
      'prepaid expenses and other current assets',
      'prepaid expenses and other assets',
      'prepaid and other current assets',
      'prepaids',
    ],
  },
  {
    key: 'other_current_assets',
    statement: 'balance',
    section: 'current_assets',
    label: 'Other Current Assets',
    synonyms: [
      'other current assets',
      'total other current assets',
      'other current assets net',
    ],
  },
  {
    key: 'total_current_assets',
    statement: 'balance',
    section: 'current_assets',
    label: 'Total Current Assets',
    synonyms: ['total current assets', 'current assets', 'total current assets net'],
    total: true,
  },
  {
    key: 'property_plant_and_equipment',
    statement: 'balance',
    section: 'non_current_assets',
    label: 'Property, Plant and Equipment',
    synonyms: [
      'property plant and equipment',
      'property plant equipment',
      'property plant and equipment net',
      'net property plant and equipment',
      'property and equipment',
      'property equipment',
      'property and equipment net',
      'ppe',
      'fixed assets',
      'net fixed assets',
    ],
  },
  {
    key: 'intangible_assets',
    statement: 'balance',
    section: 'non_current_assets',
    label: 'Intangible Assets',
    synonyms: [
      'intangible assets',
      'intangible assets net',
      'intangibles',
      'intangible assets and goodwill',
    ],
  },
  {
    key: 'goodwill',
    statement: 'balance',
    section: 'non_current_assets',
    label: 'Goodwill',
    synonyms: ['goodwill', 'goodwill net', 'goodwill net of impairment'],
  },
  {
    key: 'deferred_tax_assets',
    statement: 'balance',
    section: 'non_current_assets',
    label: 'Deferred Tax Assets',
    synonyms: [
      'deferred tax assets',
      'deferred tax asset',
      'deferred tax assets net',
      'deferred tax asset net',
      'deferred income tax assets',
    ],
  },
  {
    key: 'long_term_investments',
    statement: 'balance',
    section: 'non_current_assets',
    label: 'Long-Term Investments',
    synonyms: ['long term investments', 'long term investment', 'long term marketable securities'],
  },
  {
    key: 'investment_in_associates',
    statement: 'balance',
    section: 'non_current_assets',
    label: 'Investment in Associates and Joint Ventures',
    synonyms: [
      'investment in shares of stock of an associate and joint ventures',
      'investment in shares of stock of an associate and joint venture',
      'investment in associates and joint ventures',
      'investment in associates',
      'investment in joint ventures',
      'investments in associates and joint ventures',
    ],
  },
  {
    key: 'right_of_use_assets',
    statement: 'balance',
    section: 'non_current_assets',
    label: 'Right-of-Use Assets',
    synonyms: [
      'right of use assets',
      'right of use asset',
      'right of use net',
      'right of use asset net',
      'operating lease right of use assets',
      'lease right of use assets',
    ],
  },
  {
    key: 'investment_property',
    statement: 'balance',
    section: 'non_current_assets',
    label: 'Investment Property',
    synonyms: ['investment property', 'investment property net', 'investment properties'],
  },
  {
    key: 'other_non_current_assets',
    statement: 'balance',
    section: 'non_current_assets',
    label: 'Other Non-Current Assets',
    synonyms: [
      'other non current assets',
      'other noncurrent assets',
      'other non current assets net',
      'other assets',
      'other long term assets',
      'deferred tax assets',
    ],
  },
  {
    key: 'total_non_current_assets',
    statement: 'balance',
    section: 'non_current_assets',
    label: 'Total Non-Current Assets',
    synonyms: ['total non current assets', 'total noncurrent assets', 'non current assets', 'noncurrent assets'],
    total: true,
  },
  {
    key: 'total_assets',
    statement: 'balance',
    section: 'total_assets',
    label: 'Total Assets',
    synonyms: ['total assets', 'total assets net', 'assets'],
    total: true,
  },
  {
    key: 'accounts_payable',
    statement: 'balance',
    section: 'current_liabilities',
    label: 'Accounts Payable',
    synonyms: [
      'accounts payable',
      'trade payables',
      'trade and other payables',
      'payables',
      'accounts payable trade',
    ],
  },
  {
    key: 'short_term_debt',
    statement: 'balance',
    section: 'current_liabilities',
    label: 'Short-Term Debt',
    synonyms: [
      'short term debt',
      'short term borrowings',
      'short term loans',
      'short term loan',
      'short term loans payable',
      'loans payable',
      'short term debt and current portion of long term debt',
      'notes payable',
      'short term borrowings and current portion of long term debt',
    ],
  },
  {
    key: 'current_portion_of_long_term_debt',
    statement: 'balance',
    section: 'current_liabilities',
    label: 'Current Portion of Long-Term Debt',
    synonyms: [
      'current portion of long term debt',
      'current portion of long term debt net',
      'current portion of long term debt and notes payable',
      'current portion of long term borrowings',
      'current portion of long term loans',
    ],
  },
  {
    key: 'accrued_liabilities',
    statement: 'balance',
    section: 'current_liabilities',
    label: 'Accrued Liabilities',
    synonyms: [
      'accrued liabilities',
      'accrued expenses',
      'accrued liabilities and other',
      'accrued compensation',
      'accrued liabilities and other current liabilities',
    ],
  },
  {
    key: 'deferred_revenue',
    statement: 'balance',
    section: 'current_liabilities',
    label: 'Deferred Revenue',
    synonyms: ['deferred revenue', 'unearned revenue', 'deferred revenue current', 'contract liabilities'],
  },
  {
    key: 'other_current_liabilities',
    statement: 'balance',
    section: 'current_liabilities',
    label: 'Other Current Liabilities',
    synonyms: [
      'other current liabilities',
      'total other current liabilities',
      'other current liabilities and accrued expenses',
    ],
  },
  {
    key: 'crude_oil_and_petroleum_product_liabilities',
    statement: 'balance',
    section: 'current_liabilities',
    label: 'Liabilities for Crude Oil and Petroleum Products',
    synonyms: [
      'liabilities for crude oil and petroleum products',
      'liabilities for crude oil and petroleum product',
      'crude oil and petroleum product liabilities',
    ],
  },
  {
    key: 'derivative_liabilities',
    statement: 'balance',
    section: 'current_liabilities',
    label: 'Derivative Liabilities',
    synonyms: ['derivative liabilities', 'derivative liability', 'derivatives liabilities'],
  },
  {
    key: 'income_tax_payable',
    statement: 'balance',
    section: 'current_liabilities',
    label: 'Income Tax Payable',
    synonyms: ['income tax payable', 'taxes payable', 'current tax payable'],
  },
  {
    key: 'current_lease_liability',
    statement: 'balance',
    section: 'current_liabilities',
    label: 'Current Portion of Lease Liabilities',
    synonyms: [
      'current portion of lease liability',
      'current portion of lease liabilities',
      'current lease liability',
      'current lease liabilities',
      'lease liability current',
    ],
  },
  {
    key: 'total_current_liabilities',
    statement: 'balance',
    section: 'current_liabilities',
    label: 'Total Current Liabilities',
    synonyms: ['total current liabilities', 'current liabilities'],
    total: true,
  },
  {
    key: 'long_term_debt',
    statement: 'balance',
    section: 'non_current_liabilities',
    label: 'Long-Term Debt',
    synonyms: [
      'long term debt',
      'long term debt non current',
      'long term borrowings',
      'senior notes',
      'long term notes payable',
      'long term debt net',
    ],
  },
  {
    key: 'other_non_current_liabilities',
    statement: 'balance',
    section: 'non_current_liabilities',
    label: 'Other Non-Current Liabilities',
    synonyms: [
      'other non current liabilities',
      'other long term liabilities',
      'deferred tax liabilities',
      'operating lease liabilities',
      'pension obligations',
      'retirement benefits liability',
      'retirement benefits liability net',
      'pension liability',
    ],
  },
  {
    key: 'non_current_lease_liability',
    statement: 'balance',
    section: 'non_current_liabilities',
    label: 'Non-Current Lease Liabilities',
    synonyms: [
      'lease liability net of current portion',
      'non current lease liability',
      'non current lease liabilities',
      'lease liability non current',
    ],
  },
  {
    key: 'asset_retirement_obligation',
    statement: 'balance',
    section: 'non_current_liabilities',
    label: 'Asset Retirement Obligation',
    synonyms: ['asset retirement obligation', 'asset retirement obligations', 'decommissioning obligation'],
  },
  {
    key: 'total_non_current_liabilities',
    statement: 'balance',
    section: 'non_current_liabilities',
    label: 'Total Non-Current Liabilities',
    synonyms: ['total non current liabilities', 'total noncurrent liabilities', 'non current liabilities', 'noncurrent liabilities'],
    total: true,
  },
  {
    key: 'total_liabilities',
    statement: 'balance',
    section: 'total_liabilities',
    label: 'Total Liabilities',
    synonyms: ['total liabilities'],
    total: true,
  },
  {
    key: 'common_stock',
    statement: 'balance',
    section: 'equity',
    label: 'Common Stock',
    synonyms: [
      'common stock',
      'common shares',
      'ordinary shares',
      'share capital',
      'common stock and paid in capital',
      'capital stock',
    ],
  },
  {
    key: 'additional_paid_in_capital',
    statement: 'balance',
    section: 'equity',
    label: 'Additional Paid-In Capital',
    synonyms: [
      'additional paid in capital',
      'additional paid in capital net of tax',
      'paid in capital',
      'additional paid in surplus',
      'capital surplus',
      'share premium',
      'apic',
    ],
  },
  {
    key: 'retained_earnings',
    statement: 'balance',
    section: 'equity',
    label: 'Retained Earnings',
    synonyms: [
      'retained earnings',
      'retained earnings accumulated deficit',
      'retained earnings deficit',
      'accumulated deficit',
      'accumulated earnings',
    ],
  },
  {
    key: 'treasury_stock',
    statement: 'balance',
    section: 'equity',
    label: 'Treasury Stock',
    synonyms: ['treasury stock', 'treasury shares', 'treasury stock at cost'],
  },
  {
    key: 'other_equity',
    statement: 'balance',
    section: 'equity',
    label: 'Other Equity',
    synonyms: [
      'other equity',
      'accumulated other comprehensive income',
      'accumulated other comprehensive loss',
      'other stockholders equity',
      'other shareholders equity',
      'noncontrolling interests',
      'minority interest',
    ],
  },
  {
    key: 'capital_securities',
    statement: 'balance',
    section: 'equity',
    label: 'Capital Securities',
    synonyms: [
      'capital securities',
      'capital security',
      'perpetual securities',
      'perpetual capital securities',
      'redeemable perpetual securities',
    ],
  },
  {
    key: 'equity_reserves',
    statement: 'balance',
    section: 'equity',
    label: 'Equity Reserves',
    synonyms: [
      'equity reserves',
      'equity reserve',
      'reserve for retirement plan',
      'equity reserve for retirement plan',
      'other reserves',
    ],
  },
  {
    key: 'equity_attributable_to_parent',
    statement: 'balance',
    section: 'equity',
    label: "Total Equity Attributable to Equity Holders of the Parent",
    synonyms: [
      'total equity attributable to equity holders of the parent company',
      'total equity attributable to equity holders of the parent',
      'total equity attributable to equity holders of parent company',
      'total equity attributable to equity holders of parent',
      'total equity attributable to owners of the parent company',
      'total equity attributable to owners of the parent',
      'total equity attributable to parent company',
      'total equity attributable to parent',
      'equity attributable to equity holders of the parent company',
      'equity attributable to equity holders of the parent',
      'equity attributable to owners of the parent',
      'equity attributable to parent',
    ],
    total: true,
  },
  {
    key: 'total_equity',
    statement: 'balance',
    section: 'total_equity',
    label: "Total Shareholders' Equity",
    synonyms: [
      'total stockholders equity',
      'total shareholders equity',
      'total stockholders equity deficit',
      'total equity',
      'stockholders equity',
      'shareholders equity',
      'total shareholders investment',
    ],
    total: true,
  },
  {
    key: 'total_liabilities_and_equity',
    statement: 'balance',
    section: 'liabilities_and_equity',
    label: 'Total Liabilities and Equity',
    synonyms: [
      'total liabilities and equity',
      'total liabilities and stockholders equity',
      'total liabilities and shareholders equity',
      'total liabilities and stockholders deficit',
      'total liabilities shareholders equity and minority interest',
    ],
    total: true,
  },
  {
    key: 'net_cash_from_operating_activities',
    statement: 'cashflow',
    section: 'operating_activities',
    label: 'Net Cash from Operating Activities',
    synonyms: [
      'net cash from operating activities',
      'net cash provided by operating activities',
      'net cash flows from operating activities',
      'net cash generated from operating activities',
      'net cash flow from operating activities',
      'net cash provided by used in operating activities',
      'cash flows from operating activities',
      'cash flow from operating activities',
      'net cash from operations',
      'cash flow from operations',
      'cash from operations',
      'operating cash flow',
      'operating activities',
    ],
    total: true,
  },
  {
    key: 'net_cash_from_investing_activities',
    statement: 'cashflow',
    section: 'investing_activities',
    label: 'Net Cash from Investing Activities',
    synonyms: [
      'net cash from investing activities',
      'net cash used in investing activities',
      'net cash flows from investing activities',
      'net cash used for investing activities',
      'cash flows from investing activities',
      'net cash from investing',
      'investing activities',
    ],
    total: true,
  },
  {
    key: 'capital_expenditures',
    statement: 'cashflow',
    section: 'investing_activities',
    label: 'Capital Expenditures',
    synonyms: [
      'capital expenditures',
      'capital expenditure',
      'purchases of property plant and equipment',
      'purchase of property plant and equipment',
      'purchases of property and equipment',
      'purchase of property and equipment',
      'payments for property plant and equipment',
      'payments to acquire property plant and equipment',
      'additions to property plant and equipment',
      'acquisition of property plant and equipment',
      'capital spending',
      'capex',
    ],
  },
  {
    key: 'net_cash_from_financing_activities',
    statement: 'cashflow',
    section: 'financing_activities',
    label: 'Net Cash from Financing Activities',
    synonyms: [
      'net cash from financing activities',
      'net cash provided by financing activities',
      'net cash used in financing activities',
      'net cash flows from financing activities',
      'net cash provided by used in financing activities',
      'cash flows from financing activities',
      'net cash from financing',
      'financing activities',
    ],
    total: true,
  },
  {
    key: 'dividends_paid',
    statement: 'cashflow',
    section: 'financing_activities',
    label: 'Dividends Paid',
    synonyms: [
      'dividends paid',
      'dividend paid',
      'payment of dividends',
      'payments of dividends',
      'cash dividends paid',
      'dividends',
    ],
  },
  {
    key: 'net_change_in_cash',
    statement: 'cashflow',
    section: 'cash_summary',
    label: 'Net Change in Cash',
    synonyms: [
      'net change in cash',
      'net change in cash and cash equivalents',
      'net increase decrease in cash',
      'net increase decrease in cash and cash equivalents',
      'net increase in cash',
      'net decrease in cash',
      'net change in cash cash equivalents',
    ],
    total: true,
  },
];

const TAXONOMY_INDEX = new Map<FinancialCategory, number>();
TAXONOMY.forEach((def, index) => TAXONOMY_INDEX.set(def.key, index));

const EXACT_INDEX = new Map<string, CategoryDefinition>();
const INCLUDE_INDEX: { syn: string; def: CategoryDefinition }[] = [];

for (const def of TAXONOMY) {
  for (const syn of [def.label, ...def.synonyms]) {
    const norm = normalizeLabel(syn);
    if (!norm) continue;
    if (!EXACT_INDEX.has(norm)) EXACT_INDEX.set(norm, def);
    if (norm.includes(' ')) INCLUDE_INDEX.push({ syn: norm, def });
  }
}

INCLUDE_INDEX.sort((a, b) => b.syn.length - a.syn.length);

const CATS_BY_SECTION = new Map<Section, FinancialCategory[]>();
for (const def of TAXONOMY) {
  const list = CATS_BY_SECTION.get(def.section) ?? [];
  list.push(def.key);
  CATS_BY_SECTION.set(def.section, list);
}

const DASH_RE = /^(?:[-–—―]|n\/?a|nil|none)$/i;
const PERIOD_TOKEN_RE =
  /^(?:(?:19|20)\d{2}[a-zA-Z]?|(?:19|20)\d{2}\s*[qQ][1-4]|[fF][yY]\s?\d{2,4}|[qQ][1-4](?:\s*(?:19|20)\d{2})?|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-zA-Z]*\.?\s+\d{1,2},?\s+(?:19|20)\d{2}|\d{1,2}[/-](?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-zA-Z]*[/-](?:19|20)\d{2}|\d{1,2}\/\d{1,2}\/(?:19|20)\d{2}|period\s*\d+)$/;
const UNIT_RE = /(?:in\s+(?:thousands|millions|billions)|\bthousands\b|\bmillions\b|\bbillions\b|\(\s*(?:usd|us\$|\$|€|£|inr|jpy|gbp)?\s*0{3}\s*\))/i;

function normalizeLabel(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bnon\s+current\b/g, 'noncurrent')
    .replace(/\bnon\s+controlling\b/g, 'noncontrolling')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeDecimalSeparators(input: string): string | null {
  let s = input;
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(/,/g, '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    if (/^\d{1,3}(?:,\d{3})+$/.test(s)) {
      s = s.replace(/,/g, '');
    } else if (/^\d+,\d{1,2}$/.test(s)) {
      s = s.replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (/^[1-9]\d{0,2}\.\d{3}$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  if (!/^[+-]?\d*\.?\d+$/.test(s)) return null;
  return s;
}

function parseNumberCell(cell: unknown): number | null {
  if (cell === null || cell === undefined) return null;
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : null;
  let s = String(cell).trim();
  if (!s) return null;
  if (DASH_RE.test(s)) return 0;
  if (/^\(?\s*(?:high|low|nm|n\/a)\s*\)?$/i.test(s)) return null;
  s = s.replace(/[a-z₱$€£¥₹]/gi, '').replace(/=/g, '').trim();
  if (!s) return null;
  let negative = false;
  if (/^\(/.test(s) || /\)$/.test(s)) {
    negative = true;
    s = s.replace(/^\(+/, '').replace(/\)+$/, '').trim();
  }
  s = s.replace(/[^0-9.,+-]/g, '');
  if (!s) return null;
  let sign = 1;
  if (/^-/.test(s)) {
    sign = -1;
    s = s.replace(/^-/, '');
  } else if (/^\+/.test(s)) {
    s = s.replace(/^\+/, '');
  }
  if (/[+-]/.test(s)) return null;
  const normalized = normalizeDecimalSeparators(s);
  if (normalized === null) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  if (negative) sign = -sign;
  return value * sign;
}

function isNumericToken(token: string): boolean {
  return /[\d]/.test(token) && parseNumberCell(token) !== null;
}

function isPeriodToken(token: string): boolean {
  return PERIOD_TOKEN_RE.test(token.trim());
}

function splitLabelAndNumbers(line: string): string[] {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  const numbers: string[] = [];
  let i = tokens.length - 1;
  while (i >= 0 && isNumericToken(tokens[i])) {
    numbers.unshift(tokens[i]);
    i -= 1;
  }
  return [tokens.slice(0, i + 1).join(' '), ...numbers];
}

function normalizeExtractedLine(input: string): string {
  return input
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/([$€£¥₹])\s+(?=\d)/g, '$1')
    .replace(/\bp\s*=\s*(?=\d)/gi, '')
    .replace(/(\d)\s+%/g, '$1%')
    .trim();
}

function lineToRow(line: string): string[] | null {
  const cleaned = normalizeExtractedLine(line);
  if (!cleaned) return null;
  return splitLabelAndNumbers(cleaned);
}

function textToRows(text: string): string[][] {
  const rows: string[][] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const row = lineToRow(rawLine);
    if (row) rows.push(row);
  }
  return rows;
}

function splitTextChunks(text: string): string[] {
  const normalized = text.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];
  if (normalized.includes('\f')) {
    return normalized.split('\f').map((chunk) => chunk.trim()).filter(Boolean);
  }
  const blankSplit = normalized.split(/\n{3,}/).map((chunk) => chunk.trim()).filter(Boolean);
  const numericChunks = blankSplit.filter((chunk) => /\d/.test(chunk));
  if (blankSplit.length >= 2 && numericChunks.length >= 2) return blankSplit;
  return [normalized];
}

function pastedLineToRow(line: string): string[] | null {
  if (line.includes('\t')) {
    const cells = line.split('\t').map((cell) => cell.replace(/\u00a0/g, ' ').trim());
    return cells.some((cell) => cell !== '') ? cells : null;
  }
  return lineToRow(line);
}

function textToTables(text: string): RawTable[] {
  return splitTextChunks(text)
    .map((chunk, index) => ({
      name: `text ${index + 1}`,
      rows: chunk
        .split('\n')
        .map((line) => pastedLineToRow(line))
        .filter((row): row is string[] => row !== null),
    }))
    .filter((table) => table.rows.length > 0);
}

function detectUnitMultiplier(table: RawTable): { multiplier: number; detected: boolean } {
  for (const row of table.rows) {
    for (const cell of row) {
      const text = String(cell ?? '');
      if (!UNIT_RE.test(text)) continue;
      const lower = text.toLowerCase();
      if (/billion/.test(lower)) return { multiplier: 1_000_000_000, detected: true };
      if (/million/.test(lower)) return { multiplier: 1_000_000, detected: true };
      if (/thousand/.test(lower)) return { multiplier: 1_000, detected: true };
      if (/000/.test(lower)) return { multiplier: 1_000, detected: true };
    }
  }
  return { multiplier: 1, detected: false };
}

function collectNumericEntries(cells: string[]): NumericEntry[] {
  const entries: NumericEntry[] = [];
  cells.forEach((cell, col) => {
    const value = parseNumberCell(cell);
    if (value !== null) entries.push({ col, value });
  });
  return entries;
}

function extractLabel(cells: string[], firstNumericCol: number): string {
  const parts = cells
    .slice(0, firstNumericCol)
    .map((cell) => String(cell ?? '').trim())
    .filter(Boolean);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

const HEADER_ANNOTATION_RE =
  /^(?:%|amounts?|change|increase|decrease|increase decrease|as restated|restated|horizontal analysis|vertical analysis|in millions|in thousands|in billions|usd|php|pesos?|notes?|no|period|net|total|average)$/;

function parsePeriodHeader(cells: string[]): PeriodColumn[] | null {
  const periods: PeriodColumn[] = [];
  let nonPeriodText = 0;
  for (let col = 0; col < cells.length; col += 1) {
    const raw = String(cells[col] ?? '').trim();
    if (!raw) continue;
    if (isPeriodToken(raw)) {
      periods.push({ label: raw, col });
      continue;
    }
    if (/%\s*$/.test(raw)) continue;
    const normalized = raw
      .toLowerCase()
      .replace(/[^a-z%]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (normalized === '' || HEADER_ANNOTATION_RE.test(normalized)) continue;
    const trimmed = raw.replace(/[₱$€£¥₹]/g, '').trim();
    if (/^[-+(]?[0-9][0-9.,\s()+-]*$/.test(trimmed)) return null;
    nonPeriodText += 1;
  }
  if (periods.length >= 2 || (periods.length === 1 && nonPeriodText === 0)) return periods;
  return null;
}

function alignToPeriods(entries: NumericEntry[], periods: PeriodColumn[]): (number | null)[] {
  const allExact = periods.every((period) => entries.some((entry) => entry.col === period.col));
  if (allExact && entries.length === periods.length) {
    return periods.map((period) => (entries.find((entry) => entry.col === period.col) as NumericEntry).value);
  }
  if (entries.length >= periods.length) return alignRight(entries, periods.length);
  return periods.map((period) => {
    const exact = entries.find((entry) => entry.col === period.col);
    return exact ? exact.value : null;
  });
}

function alignRight(entries: NumericEntry[], count: number): (number | null)[] {
  const values: (number | null)[] = new Array(count).fill(null);
  const tail = entries.slice(Math.max(0, entries.length - count));
  const offset = count - tail.length;
  tail.forEach((entry, index) => {
    values[offset + index] = entry.value;
  });
  return values;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

const HEADING_CASHFLOW_RE = /\bcash flows?(?:\s+(?:from|arising|used))?\b|\bstatement of cash flows?\b/;
const HEADING_BALANCE_RE = /\b(?:statements? of financial position|balance sheets?)\b/;
const HEADING_INCOME_RE = /\bstatements? of (?:income|comprehensive income|profit or loss|operations)\b/;

function detectStatementByHeading(rows: string[][]): StatementType | null {
  const text = rows.slice(0, 12).flat().join(' ').toLowerCase();
  if (HEADING_CASHFLOW_RE.test(text)) return 'cashflow';
  if (HEADING_BALANCE_RE.test(text)) return 'balance';
  if (HEADING_INCOME_RE.test(text)) return 'income';
  return null;
}

function matchCategory(rawLabel: string, minConfidence: number): MatchResult {
  const norm = normalizeLabel(rawLabel);
  if (!norm) return { category: null, confidence: 0 };
  const exact = EXACT_INDEX.get(norm);
  if (exact) return { category: exact.key, confidence: 1 };
  const singular = norm.endsWith('ies') ? `${norm.slice(0, -3)}y` : norm.endsWith('s') ? norm.slice(0, -1) : '';
  if (singular) {
    const singularMatch = EXACT_INDEX.get(singular);
    if (singularMatch) return { category: singularMatch.key, confidence: 0.92 };
  }
  for (const candidate of INCLUDE_INDEX) {
    if (norm.includes(candidate.syn)) {
      return { category: candidate.def.key, confidence: 0.9 };
    }
  }
  const tokens = new Set(norm.split(' ').filter(Boolean));
  let best: { def: CategoryDefinition; score: number } | null = null;
  for (const def of TAXONOMY) {
    for (const syn of [def.label, ...def.synonyms]) {
      const normalizedSyn = normalizeLabel(syn);
      if (!normalizedSyn) continue;
      const score = jaccard(tokens, new Set(normalizedSyn.split(' ').filter(Boolean)));
      if (!best || score > best.score) best = { def, score };
    }
  }
  if (best && best.score >= 0.6) {
    const confidence = Math.min(0.85, 0.5 + best.score * 0.35);
    if (confidence >= minConfidence) return { category: best.def.key, confidence };
  }
  return { category: null, confidence: 0 };
}

const HEADER_YEAR_RE = /^(?:19|20)\d{2}$/;
const HEADER_YEAR_PREFIX_RE = /^(?:19|20)\d{2}\b/;

function isHeaderLikeCell(cell: string): boolean {
  const trimmed = cell.trim();
  if (!trimmed) return true;
  if (HEADER_YEAR_RE.test(trimmed)) return true;
  if (trimmed.length <= 24 && HEADER_YEAR_PREFIX_RE.test(trimmed)) return true;
  const normalized = trimmed.toLowerCase().replace(/[^a-z%]+/g, ' ').trim();
  return HEADER_ANNOTATION_RE.test(normalized) || /^(note|as restated|unaudited|audited)$/.test(normalized);
}

function isHeaderLikeRow(cells: string[]): boolean {
  const nonEmpty = cells.filter((cell) => cell.trim());
  return nonEmpty.length > 0 && nonEmpty.every(isHeaderLikeCell);
}

const SECTION_HEADERS = new Set([
  'assets',
  'current assets',
  'noncurrent assets',
  'non current assets',
  'liabilities',
  'equity',
  'current liabilities',
  'noncurrent liabilities',
  'non current liabilities',
  'liabilities and equity',
  'total assets',
  'total liabilities',
  'total equity',
  'shareholders equity',
  'stockholders equity',
  'equity attributable to equity holders',
  'equity attributable to equity holders of the parent company',
  'activities',
  'operating activities',
  'investing activities',
  'financing activities',
  'cash flows from operating',
  'cash flows from investing',
  'cash flows from financing',
  'forward',
]);

function isSectionHeaderRow(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  return SECTION_HEADERS.has(normalized) || /^cash flows from /.test(normalized);
}

export function mergeContinuationRows(rows: string[][]): string[][] {
  const out: string[][] = [];
  let pending: string | null = null;
  for (const row of rows) {
    if (row.length === 1 && !/\d/.test(row[0])) {
      const text = row[0].trim();
      if (isSectionHeaderRow(text)) {
        pending = null;
        out.push(row);
      } else {
        pending = pending ? `${pending} ${text}` : text;
      }
      continue;
    }
    if (pending) {
      const first = row[0] ?? '';
      out.push(/\d/.test(first) ? [pending, ...row] : [`${pending} ${first}`.trim(), ...row.slice(1)]);
      pending = null;
    } else {
      out.push(row);
    }
  }
  if (pending) out.push([pending]);
  return out;
}

function buildIntermediateStatement(table: RawTable, options: ResolvedOptions): IntermediateStatement | null {
  const effectiveTable: RawTable =
    table.periods && table.periods.length ? { ...table, rows: mergeContinuationRows(table.rows) } : table;
  const unit = detectUnitMultiplier(effectiveTable);
  const multiplier = options.applyUnitScaling ? unit.multiplier : 1;

  let periods: PeriodColumn[] | null = null;
  const headerRows = new Set<number>();
  if (effectiveTable.periods && effectiveTable.periods.length) {
    periods = effectiveTable.periods.map((label, index) => ({ label, col: index }));
    effectiveTable.rows.forEach((row, index) => {
      if (isHeaderLikeRow(row)) headerRows.add(index);
    });
  } else {
    for (let index = 0; index < effectiveTable.rows.length; index += 1) {
      const header = parsePeriodHeader(effectiveTable.rows[index]);
      if (header) {
        periods = header;
        headerRows.add(index);
        break;
      }
    }
  }

  const warnings: string[] = [];
  if (unit.detected && options.applyUnitScaling && multiplier !== 1) {
    warnings.push(`Applied unit scaling of x${multiplier} to table "${table.name}" from an "(in thousands/millions)" note.`);
  }

  const parsedRows: { label: string; entries: NumericEntry[]; rowIndex: number }[] = [];
  let maxNumericCount = 0;
  effectiveTable.rows.forEach((cells, rowIndex) => {
    if (headerRows.has(rowIndex)) return;
    const entries = collectNumericEntries(cells);
    maxNumericCount = Math.max(maxNumericCount, entries.length);
    if (entries.length === 0) return;
    const firstNumericCol = entries[0].col;
    const label = extractLabel(cells, firstNumericCol);
    if (!label) return;
    parsedRows.push({ label, entries, rowIndex });
  });

  if (!parsedRows.length) return null;

  let periodLabels: string[];
  if (periods) {
    periodLabels = dedupePeriodLabels(periods.map((period) => period.label));
  } else {
    periodLabels = Array.from({ length: maxNumericCount }, (_, index) => `Period ${index + 1}`);
  }

  const unmapped: string[] = [];
  const items = new Map<FinancialCategory, NormalizedLineItem>();
  const statementScores: Record<StatementType, number> = { income: 0, balance: 0, cashflow: 0 };

  for (const parsed of parsedRows) {
    const match = matchCategory(parsed.label, options.minMatchConfidence);
    const rawValues = periods
      ? alignToPeriods(parsed.entries, periods)
      : alignRight(parsed.entries, periodLabels.length);
    const hasValue = rawValues.some((value) => value !== null);
    if (!match.category) {
      if (hasValue) unmapped.push(parsed.label);
      continue;
    }
    const def = TAXONOMY[TAXONOMY_INDEX.get(match.category) as number];
    statementScores[def.statement] += match.confidence;
    const values: Record<string, number | null> = {};
    periodLabels.forEach((period, index) => {
      const value = rawValues[index];
      values[period] = value === null || value === undefined ? null : roundValue(value * multiplier);
    });
    const existing = items.get(match.category);
    if (existing) {
      for (const period of periodLabels) {
        if (existing.values[period] === null && values[period] !== null) {
          existing.values[period] = values[period];
        }
      }
      warnings.push(`Duplicate line for "${def.label}" found in table "${table.name}"; merged values.`);
      continue;
    }
    items.set(match.category, {
      rawLabel: parsed.label,
      category: match.category,
      statement: def.statement,
      section: def.section,
      values,
      derived: false,
      confidence: match.confidence,
      source: { table: table.name, row: parsed.rowIndex },
    });
  }

  if (items.size < 2) return null;
  if (!periods && items.size < 3) return null;

  let type: StatementType;
  if (options.hint) {
    type = options.hint;
  } else {
    const heading = detectStatementByHeading(effectiveTable.rows);
    type = heading ?? (Object.keys(statementScores) as StatementType[]).reduce((best, candidate) =>
      statementScores[candidate] > statementScores[best] ? candidate : best
    );
  }

  return {
    type,
    tableName: table.name,
    periods: periodLabels,
    multiplier,
    items,
    unmapped,
    warnings,
  };
}

function dedupePeriodLabels(labels: string[]): string[] {
  const seen = new Map<string, number>();
  return labels.map((label) => {
    const base = label || 'Period';
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });
}

function roundValue(value: number): number {
  return Math.round((value + Number.EPSILON) * 1e6) / 1e6;
}

function mergeByType(statements: IntermediateStatement[], type: StatementType): NormalizedStatement | null {
  const relevant = statements.filter((statement) => statement.type === type);
  if (!relevant.length) return null;
  const periods: string[] = [];
  const items = new Map<FinancialCategory, NormalizedLineItem>();
  const unmapped = new Set<string>();
  const warnings: string[] = [];
  let multiplier = 1;

  for (const statement of relevant) {
    multiplier = Math.max(multiplier, statement.multiplier);
    for (const period of statement.periods) if (!periods.includes(period)) periods.push(period);
    statement.warnings.forEach((warning) => warnings.push(warning));
    statement.unmapped.forEach((label) => unmapped.add(label));

    for (const [category, item] of statement.items) {
      const existing = items.get(category);
      if (!existing) {
        items.set(category, { ...item, values: { ...item.values } });
        continue;
      }
      for (const period of statement.periods) {
        const value = item.values[period];
        if (value === null || value === undefined) continue;
        if (existing.values[period] === null || existing.values[period] === undefined) {
          existing.values[period] = value;
        } else if (existing.values[period] !== value) {
          warnings.push(
            `Conflicting values for "${getDefinition(category).label}" in period "${period}" across tables; kept ${existing.values[period]}.`
          );
        }
      }
    }
  }

  const lineItems = [...items.values()].sort(
    (a, b) => (TAXONOMY_INDEX.get(a.category) as number) - (TAXONOMY_INDEX.get(b.category) as number)
  );

  return {
    type,
    periods,
    unitMultiplier: multiplier,
    lineItems,
    unmappedLabels: [...unmapped],
    warnings,
  };
}

function getDefinition(category: FinancialCategory): CategoryDefinition {
  return TAXONOMY[TAXONOMY_INDEX.get(category) as number];
}

function getValue(items: Map<FinancialCategory, NormalizedLineItem>, category: FinancialCategory, period: string): number | null {
  const value = items.get(category)?.values[period];
  return value === null || value === undefined ? null : value;
}

function sumCategories(
  items: Map<FinancialCategory, NormalizedLineItem>,
  categories: FinancialCategory[],
  period: string
): number | null {
  let sum = 0;
  let found = false;
  for (const category of categories) {
    const value = getValue(items, category, period);
    if (value !== null) {
      sum += value;
      found = true;
    }
  }
  return found ? roundValue(sum) : null;
}

function sectionCategories(section: Section): FinancialCategory[] {
  return CATS_BY_SECTION.get(section) ?? [];
}

function applyDerived(statement: NormalizedStatement): NormalizedStatement {
  if (statement.type === 'income') return applyIncomeDerived(statement);
  if (statement.type === 'balance') return applyBalanceDerived(statement);
  return applyCashflowDerived(statement);
}

function applyIncomeDerived(statement: NormalizedStatement): NormalizedStatement {
  const items = new Map(statement.lineItems.map((item) => [item.category, item] as const));
  for (const period of statement.periods) {
    if (getValue(items, 'gross_profit', period) !== null) continue;
    const revenue = getValue(items, 'revenue', period);
    const cogs = getValue(items, 'cost_of_goods_sold', period);
    if (revenue !== null && cogs !== null) {
      addDerivedItem(items, 'gross_profit', period, roundValue(revenue - cogs));
    }
  }
  return finalizeStatement(statement, items);
}

function applyBalanceDerived(statement: NormalizedStatement): NormalizedStatement {
  const items = new Map(statement.lineItems.map((item) => [item.category, item] as const));
  const currentAssets = sectionCategories('current_assets').filter((category) => category !== 'total_current_assets');
  const nonCurrentAssets = sectionCategories('non_current_assets').filter(
    (category) => category !== 'total_non_current_assets'
  );
  const currentLiabilities = sectionCategories('current_liabilities').filter(
    (category) => category !== 'total_current_liabilities'
  );
  const nonCurrentLiabilities = sectionCategories('non_current_liabilities').filter(
    (category) => category !== 'total_non_current_liabilities'
  );
  const equity = sectionCategories('equity').filter(
    (category) => category !== 'equity_attributable_to_parent'
  );

  for (const period of statement.periods) {
    let totalCurrentAssets = getValue(items, 'total_current_assets', period);
    if (totalCurrentAssets === null) {
      const derived = sumCategories(items, currentAssets, period);
      if (derived !== null) {
        addDerivedItem(items, 'total_current_assets', period, derived);
        totalCurrentAssets = derived;
      }
    }

    let totalNonCurrentAssets = getValue(items, 'total_non_current_assets', period);
    if (totalNonCurrentAssets === null) {
      const derived = sumCategories(items, nonCurrentAssets, period);
      if (derived !== null) {
        addDerivedItem(items, 'total_non_current_assets', period, derived);
        totalNonCurrentAssets = derived;
      }
    }

    if (getValue(items, 'total_assets', period) === null) {
      const nonCurrentSum = sumCategories(items, nonCurrentAssets, period);
      if (totalCurrentAssets !== null || nonCurrentSum !== null) {
        addDerivedItem(items, 'total_assets', period, roundValue((totalCurrentAssets ?? 0) + (nonCurrentSum ?? 0)));
      }
    }

    let totalCurrentLiabilities = getValue(items, 'total_current_liabilities', period);
    if (totalCurrentLiabilities === null) {
      const derived = sumCategories(items, currentLiabilities, period);
      if (derived !== null) {
        addDerivedItem(items, 'total_current_liabilities', period, derived);
        totalCurrentLiabilities = derived;
      }
    }

    let totalNonCurrentLiabilities = getValue(items, 'total_non_current_liabilities', period);
    if (totalNonCurrentLiabilities === null) {
      const derived = sumCategories(items, nonCurrentLiabilities, period);
      if (derived !== null) {
        addDerivedItem(items, 'total_non_current_liabilities', period, derived);
        totalNonCurrentLiabilities = derived;
      }
    }

    if (getValue(items, 'total_liabilities', period) === null) {
      const nonCurrentSum = sumCategories(items, nonCurrentLiabilities, period);
      if (totalCurrentLiabilities !== null || nonCurrentSum !== null) {
        addDerivedItem(
          items,
          'total_liabilities',
          period,
          roundValue((totalCurrentLiabilities ?? 0) + (nonCurrentSum ?? 0))
        );
      }
    }

    if (getValue(items, 'total_equity', period) === null) {
      const derived = sumCategories(items, equity, period);
      if (derived !== null) addDerivedItem(items, 'total_equity', period, derived);
    }

    if (getValue(items, 'total_liabilities_and_equity', period) === null) {
      const liabilities = getValue(items, 'total_liabilities', period);
      const totalEquity = getValue(items, 'total_equity', period);
      if (liabilities !== null || totalEquity !== null) {
        addDerivedItem(
          items,
          'total_liabilities_and_equity',
          period,
          roundValue((liabilities ?? 0) + (totalEquity ?? 0))
        );
      }
    }
  }

  return finalizeStatement(statement, items);
}

function applyCashflowDerived(statement: NormalizedStatement): NormalizedStatement {
  const items = new Map(statement.lineItems.map((item) => [item.category, item] as const));
  for (const period of statement.periods) {
    if (getValue(items, 'net_change_in_cash', period) !== null) continue;
    const operating = getValue(items, 'net_cash_from_operating_activities', period);
    const investing = getValue(items, 'net_cash_from_investing_activities', period);
    const financing = getValue(items, 'net_cash_from_financing_activities', period);
    if (operating !== null || investing !== null || financing !== null) {
      addDerivedItem(
        items,
        'net_change_in_cash',
        period,
        roundValue((operating ?? 0) + (investing ?? 0) + (financing ?? 0))
      );
    }
  }
  return finalizeStatement(statement, items);
}

function addDerivedItem(
  items: Map<FinancialCategory, NormalizedLineItem>,
  category: FinancialCategory,
  period: string,
  value: number
): void {
  const def = getDefinition(category);
  let item = items.get(category);
  if (!item) {
    item = {
      rawLabel: def.label,
      category,
      statement: def.statement,
      section: def.section,
      values: Object.fromEntries(statementPeriods(items).map((p) => [p, null])),
      derived: true,
      confidence: 0.6,
      source: { table: '(derived)', row: -1 },
    };
    items.set(category, item);
  }
  item.values[period] = value;
  item.derived = true;
}

function statementPeriods(items: Map<FinancialCategory, NormalizedLineItem>): string[] {
  const periods = new Set<string>();
  for (const item of items.values()) {
    Object.keys(item.values).forEach((period) => periods.add(period));
  }
  return [...periods];
}

function finalizeStatement(
  statement: NormalizedStatement,
  items: Map<FinancialCategory, NormalizedLineItem>
): NormalizedStatement {
  const periods = [...statement.periods];
  for (const period of statementPeriods(items)) if (!periods.includes(period)) periods.push(period);
  const lineItems = [...items.values()]
    .map((item) => {
      const values: Record<string, number | null> = {};
      for (const period of periods) values[period] = item.values[period] ?? null;
      return { ...item, values };
    })
    .sort(
      (a, b) => (TAXONOMY_INDEX.get(a.category) as number) - (TAXONOMY_INDEX.get(b.category) as number)
    );
  return { ...statement, periods, lineItems };
}

function formatNumber(value: number): string {
  const rounded = roundValue(value);
  const sign = rounded < 0 ? '-' : '';
  return sign + Math.abs(rounded).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function validateBalanceSheet(statement: NormalizedStatement, options: ResolvedOptions): BalanceSheetValidation[] {
  const items = new Map(statement.lineItems.map((item) => [item.category, item] as const));
  return statement.periods.map((period) => {
    const assets = getValue(items, 'total_assets', period);
    const liabilities = getValue(items, 'total_liabilities', period);
    const equity = getValue(items, 'total_equity', period);
    const liabilitiesAndEquity = getValue(items, 'total_liabilities_and_equity', period);
    const computed = liabilities !== null && equity !== null ? roundValue(liabilities + equity) : null;
    const rhs = liabilitiesAndEquity !== null ? liabilitiesAndEquity : computed;

    const formula = 'Assets = Liabilities + Equity';
    if (assets === null || rhs === null) {
      return {
        period,
        formula,
        substitution: 'insufficient data',
        totalAssets: assets,
        totalLiabilities: liabilities,
        totalEquity: equity,
        totalLiabilitiesAndEquity: liabilitiesAndEquity,
        difference: null,
        relativeDifference: null,
        tolerance: 0,
        balanced: false,
        message: `Cannot validate period "${period}": missing total assets or total liabilities/equity.`,
      };
    }

    const difference = roundValue(assets - rhs);
    const base = Math.max(Math.abs(assets), Math.abs(rhs));
    const tolerance = Math.max(options.absTolerance, options.relTolerance * base);
    const relativeDifference = rhs !== 0 ? Math.abs(difference) / Math.abs(rhs) : difference === 0 ? 0 : Infinity;
    const balanced = Math.abs(difference) <= tolerance;
    const substitution =
      `${formatNumber(assets)} (Total Assets) = ` +
      `${formatNumber(liabilities ?? 0)} (Total Liabilities) + ` +
      `${formatNumber(equity ?? 0)} (Total Equity)`;
    const message = balanced
      ? `Balanced within tolerance (difference ${formatNumber(difference)}, tolerance ${formatNumber(tolerance)}).`
      : `Out of balance by ${formatNumber(difference)} (relative ${(relativeDifference * 100).toFixed(2)}%), exceeding tolerance ${formatNumber(tolerance)}.`;

    return {
      period,
      formula,
      substitution,
      totalAssets: assets,
      totalLiabilities: liabilities,
      totalEquity: equity,
      totalLiabilitiesAndEquity: liabilitiesAndEquity,
      difference,
      relativeDifference,
      tolerance,
      balanced,
      message,
    };
  });
}

function toBuffer(data: Buffer | ArrayBuffer | Uint8Array): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(new Uint8Array(data));
  return Buffer.from(data);
}

function detectFormat(buffer: Buffer, input: ParseInput): DocumentFormat {
  const mime = (input.mimeType ?? '').toLowerCase();
  const name = (input.filename ?? '').toLowerCase();
  if (mime.includes('pdf') || name.endsWith('.pdf') || buffer.slice(0, 5).toString('latin1') === '%PDF-') {
    return 'pdf';
  }
  if (mime.includes('csv') || name.endsWith('.csv')) return 'csv';
  return 'xlsx';
}

interface PdfTextItem {
  str?: string;
  transform?: number[];
}

function pdfNeedsSpace(previous: string, next: string): boolean {
  if (!previous || !next) return false;
  return !/[\s(]$/.test(previous) && !/^[\s),.%]/.test(next);
}

function buildPdfPageRows(items: PdfTextItem[]): string[][] {
  const lineBuckets = new Map<number, { x: number; str: string }[]>();
  for (const item of items) {
    const str = String(item.str ?? '');
    if (!str.trim()) continue;
    const transform = item.transform ?? [];
    const x = typeof transform[4] === 'number' ? transform[4] : 0;
    const y = typeof transform[5] === 'number' ? transform[5] : 0;
    const key = Math.round(y / 2) * 2;
    const bucket = lineBuckets.get(key) ?? [];
    bucket.push({ x, str });
    lineBuckets.set(key, bucket);
  }

  const rows: string[][] = [];
  for (const key of [...lineBuckets.keys()].sort((a, b) => b - a)) {
    const bucket = (lineBuckets.get(key) as { x: number; str: string }[]).sort((a, b) => a.x - b.x);
    let line = '';
    for (const piece of bucket) {
      line = line === '' ? piece.str : `${line}${pdfNeedsSpace(line, piece.str) ? ' ' : ''}${piece.str}`;
    }
    const row = lineToRow(line);
    if (row) rows.push(row);
  }
  return rows;
}

async function extractPdfTables(buffer: Buffer): Promise<RawTable[]> {
  const bytes = new Uint8Array(buffer);
  const pdfInput = bytes as unknown as Buffer;
  const tables: RawTable[] = [];
  let pageIndex = 0;
  try {
    await pdfParse(pdfInput, {
      pagerender: async (pageData: {
        getTextContent: (options?: unknown) => Promise<{ items: PdfTextItem[] }>;
      }) => {
        pageIndex += 1;
        const content = await pageData.getTextContent({
          normalizeWhitespace: false,
          disableCombineTextItems: false,
        });
        const rows = buildPdfPageRows(content.items ?? []);
        tables.push({ name: `page ${pageIndex}`, rows });
        return rows.map((row) => row.join('\t')).join('\n');
      },
    });
  } catch {
    tables.length = 0;
  }

  const usable = tables.filter((table) => table.rows.length > 0);
  if (usable.length) return usable;

  const parsed = await pdfParse(pdfInput);
  const text = parsed.text ?? '';
  const chunks = text.includes('\f') ? text.split('\f') : [text];
  return chunks
    .map((chunk, index) => ({ name: `page ${index + 1}`, rows: textToRows(chunk) }))
    .filter((table) => table.rows.length > 0);
}

function extractWorkbookTables(buffer: Buffer, format: DocumentFormat): RawTable[] {
  const workbook =
    format === 'csv'
      ? XLSX.read(buffer.toString('utf8'), { type: 'string' })
      : XLSX.read(buffer, { type: 'buffer' });
  const tables: RawTable[] = [];
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false,
    }) as unknown as string[][];
    const normalized = rows.map((row) =>
      (Array.isArray(row) ? row : [row]).map((cell) => (cell === null || cell === undefined ? '' : String(cell)))
    );
    if (normalized.length) tables.push({ name, rows: normalized });
  }
  return tables;
}

export function resolveOptions(options?: ParserOptions): ResolvedOptions {
  return {
    hint: options?.hint,
    absTolerance: options?.absTolerance ?? DEFAULT_OPTIONS.absTolerance,
    relTolerance: options?.relTolerance ?? DEFAULT_OPTIONS.relTolerance,
    applyUnitScaling: options?.applyUnitScaling ?? DEFAULT_OPTIONS.applyUnitScaling,
    minMatchConfidence: options?.minMatchConfidence ?? DEFAULT_OPTIONS.minMatchConfidence,
    ocr: options?.ocr ?? DEFAULT_OPTIONS.ocr,
  };
}

interface DocumentSourceMeta {
  filename?: string;
  format: DocumentFormat;
  tableCount: number;
}

function assembleDocument(
  intermediates: IntermediateStatement[],
  options: ResolvedOptions,
  source: DocumentSourceMeta,
  baseWarnings: string[] = []
): ParsedDocument {
  const warnings = [...baseWarnings];

  const income = mergeByType(intermediates, 'income');
  const balance = mergeByType(intermediates, 'balance');
  const cashflow = mergeByType(intermediates, 'cashflow');
  const derivedIncome = income ? applyDerived(income) : null;
  const derivedBalance = balance ? applyDerived(balance) : null;
  const derivedCashflow = cashflow ? applyDerived(cashflow) : null;

  const validations = derivedBalance ? validateBalanceSheet(derivedBalance, options) : [];
  const unbalanced = validations.filter((validation) => !validation.balanced && validation.difference !== null);
  unbalanced.forEach((validation) =>
    warnings.push(`Balance sheet does not balance for period "${validation.period}": ${validation.message}`)
  );

  return {
    source,
    statements: {
      income: derivedIncome,
      balance: derivedBalance,
      cashflow: derivedCashflow,
    },
    validations,
    warnings,
  };
}

function buildParsedDocument(
  tables: RawTable[],
  options: ResolvedOptions,
  source: DocumentSourceMeta,
  baseWarnings: string[] = []
): ParsedDocument {
  const warnings: string[] = [...baseWarnings];
  if (!tables.length) warnings.push('No tabular content could be extracted from the document.');

  const intermediates: IntermediateStatement[] = [];
  for (const table of tables) {
    const statement = buildIntermediateStatement(table, options);
    if (!statement) {
      warnings.push(`Table "${table.name}" contained no recognized financial line items.`);
      continue;
    }
    intermediates.push(statement);
  }

  if (!intermediates.length && tables.length) {
    const sampleTable = tables.find((table) => table.rows.length > 0) ?? tables[0];
    const sampleRows = sampleTable.rows
      .slice(0, 12)
      .map((row) => row.join(' | '))
      .filter(Boolean);
    warnings.push(
      `No financial line items were recognised. Extracted ${tables.length} table(s); sample rows from "${sampleTable.name}": ` +
        sampleRows.join(' || ') +
        '. The layout may need manual mapping.'
    );
  }

  const annualNetIncome = detectAnnualNetIncome(tables);
  const document = assembleDocument(intermediates, options, source, warnings);
  return Object.keys(annualNetIncome).length ? { ...document, annualNetIncome } : document;
}

const PERIOD_HEADER_RE =
  /^(january|february|march|april|may|june|july|august|september|october|november|december)(\d{1,2})(19|20)(\d{2})/;

function periodHeader(row: string[]): { fiscalYearEnd: boolean; year: string } | null {
  const compact = row.join('').toLowerCase().replace(/[^a-z0-9]/g, '');
  const match = PERIOD_HEADER_RE.exec(compact);
  if (!match) return null;
  const year = `${match[3]}${match[4]}`;
  return { fiscalYearEnd: match[1] === 'december' && match[2] === '31', year };
}

function lastNumericCell(row: string[]): number | null {
  for (let index = row.length - 1; index >= 0; index -= 1) {
    const value = parseNumberCell(row[index]);
    if (value !== null) return value;
  }
  return null;
}

function detectAnnualNetIncome(tables: RawTable[]): Record<string, AnnualNetIncomeReference> {
  const result: Record<string, AnnualNetIncomeReference> = {};
  for (const table of tables) {
    let year: string | null = null;
    let hasInterestExpense = false;
    let netIncome: number | null = null;
    const flush = () => {
      if (year && hasInterestExpense && netIncome !== null && result[year] === undefined) {
        result[year] = {
          value: netIncome,
          source: `Segment/period note "${table.name}", net income row for the fiscal year ended December 31, ${year}`,
        };
      }
    };
    for (const row of table.rows) {
      const header = periodHeader(row);
      if (header) {
        flush();
        year = header.fiscalYearEnd ? header.year : null;
        hasInterestExpense = false;
        netIncome = null;
        continue;
      }
      if (!year) continue;
      const label = normalizeLabel(row[0] ?? '');
      if (/^net income\b/.test(label)) {
        const value = lastNumericCell(row);
        if (value !== null) netIncome = value;
      } else if (/^interest expense\b/.test(label)) {
        hasInterestExpense = true;
      }
    }
    flush();
  }
  return result;
}

export async function parseFinancialDocument(input: ParseInput): Promise<ParsedDocument> {
  const buffer = toBuffer(input.data);
  const format = detectFormat(buffer, input);
  const options = resolveOptions(input.options);

  const tables = format === 'pdf' ? await extractPdfTables(buffer) : extractWorkbookTables(buffer, format);
  let document = buildParsedDocument(tables, options, {
    filename: input.filename,
    format,
    tableCount: tables.length,
  });

  if (format === 'pdf' && options.ocr) {
    const { extractEmbeddedJpegs, ocrEmbeddedImages } = await import('./ocr');
    const images = extractEmbeddedJpegs(buffer, OCR_MIN_IMAGE_BYTES, OCR_MAX_IMAGES);
    const scanned = images.length >= OCR_SCANNED_IMAGE_COUNT;
    if (scanned || shouldAttemptOcr(document)) {
      const ocr = await ocrEmbeddedImages(buffer);
      if (ocr.tables.length) {
        const ocrDocument = buildParsedDocument(
          ocr.tables,
          options,
          { filename: input.filename, format, tableCount: ocr.tables.length },
          ocr.warnings
        );
        const ocrCount = statementCount(ocrDocument);
        const textCount = statementCount(document);
        if (ocrCount >= 2 && (scanned ? ocrCount >= textCount : ocrCount > textCount)) {
          document = {
            ...ocrDocument,
            annualNetIncome: ocrDocument.annualNetIncome ?? document.annualNetIncome,
            searchablePdf: ocr.searchablePdf
              ? {
                  base64: Buffer.from(ocr.searchablePdf).toString('base64'),
                  pageCount: ocr.imageCount,
                  mimeType: 'application/pdf',
                }
              : undefined,
            sourcePages: ocr.sourcePages.map((page, index) => ({
              page: index + 1,
              image: page.image,
              words: page.words,
            })),
          };
        } else {
          document = { ...document, warnings: [...document.warnings, ...ocr.warnings] };
        }
      } else if (ocr.warnings.length) {
        document = { ...document, warnings: [...document.warnings, ...ocr.warnings] };
      }
    }
  }

  return document;
}

const OCR_MIN_IMAGE_BYTES = 60_000;
const OCR_MAX_IMAGES = 24;
const OCR_SCANNED_IMAGE_COUNT = 2;

function statementCount(document: ParsedDocument): number {
  const { income, balance, cashflow } = document.statements;
  return [income, balance, cashflow].filter(Boolean).length;
}

function shouldAttemptOcr(document: ParsedDocument): boolean {
  return statementCount(document) < 3;
}

export interface ParseTextInput {
  text: string;
  filename?: string;
  options?: ParserOptions;
}

export function parseFinancialText(input: ParseTextInput): ParsedDocument {
  const options = resolveOptions(input.options);
  const tables = input.text.trim() === '' ? [] : textToTables(input.text);
  return buildParsedDocument(tables, options, {
    filename: input.filename,
    format: 'text',
    tableCount: tables.length,
  });
}

export interface ManualLineInput {
  label: string;
  values: (number | string | null)[];
}

export interface ManualStatementInput {
  type: StatementType;
  periods: string[];
  lines: ManualLineInput[];
}

export interface ParseManualInput {
  statements: ManualStatementInput[];
  filename?: string;
  options?: ParserOptions;
}

function manualValue(raw: number | string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? roundValue(raw) : null;
  const parsed = parseNumberCell(raw);
  return parsed === null ? null : roundValue(parsed);
}

function buildManualStatement(input: ManualStatementInput, options: ResolvedOptions): IntermediateStatement | null {
  const periods = (input.periods ?? []).map((period) => String(period).trim()).filter(Boolean);
  if (!periods.length) return null;

  const items = new Map<FinancialCategory, NormalizedLineItem>();
  const unmapped: string[] = [];
  const warnings: string[] = [];

  (input.lines ?? []).forEach((line, index) => {
    const label = String(line.label ?? '').trim();
    if (!label) return;
    const values: Record<string, number | null> = {};
    periods.forEach((period, column) => {
      values[period] = manualValue(line.values?.[column]);
    });
    const hasValue = Object.values(values).some((value) => value !== null);
    const match = matchCategory(label, options.minMatchConfidence);
    if (!match.category || !hasValue) {
      if (hasValue) unmapped.push(label);
      return;
    }
    const def = getDefinition(match.category);
    const existing = items.get(match.category);
    if (existing) {
      for (const period of periods) {
        if (existing.values[period] === null && values[period] !== null) existing.values[period] = values[period];
      }
      warnings.push(`Duplicate manual line for "${def.label}"; merged values.`);
      return;
    }
    items.set(match.category, {
      rawLabel: label,
      category: match.category,
      statement: def.statement,
      section: def.section,
      values,
      derived: false,
      confidence: match.confidence,
      source: { table: `manual ${input.type}`, row: index },
    });
  });

  if (!items.size) return null;

  return {
    type: input.type,
    tableName: `manual ${input.type}`,
    periods,
    multiplier: 1,
    items,
    unmapped,
    warnings,
  };
}

export function parseManualDocument(input: ParseManualInput): ParsedDocument {
  const options = resolveOptions(input.options);
  const warnings: string[] = [];
  const intermediates: IntermediateStatement[] = [];

  for (const statement of input.statements ?? []) {
    const built = buildManualStatement(statement, options);
    if (built) intermediates.push(built);
  }

  const recognized = intermediates.reduce((sum, statement) => sum + statement.items.size, 0);
  if (!intermediates.length) {
    warnings.push('No manual line items with values were provided, or none matched the financial taxonomy.');
  } else if (!recognized) {
    warnings.push('Manually entered labels did not match the taxonomy; try canonical labels such as "Revenue" or "Total assets".');
  }

  return assembleDocument(
    intermediates,
    options,
    {
      filename: input.filename,
      format: 'manual',
      tableCount: intermediates.length,
    },
    warnings
  );
}


export async function parseFinancialFile(filePath: string, options?: ParserOptions): Promise<ParsedDocument> {
  const buffer = await fs.readFile(filePath);
  return parseFinancialDocument({
    data: buffer,
    filename: path.basename(filePath),
    options,
  });
}

export { TAXONOMY, normalizeLabel, parseNumberCell, lineToRow };
