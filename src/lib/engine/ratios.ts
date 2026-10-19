import {
  FinancialCategory,
  NormalizedStatement,
  ParsedDocument,
  TAXONOMY,
} from './parser';
import { orderPeriods } from './analyzer';

export type RatioCategory = 'liquidity' | 'profitability' | 'leverage' | 'efficiency' | 'valuation';

export type RatioUnit = 'times' | 'percent' | 'days' | 'currency' | 'ratio';

export type RatioAvailability = 'computed' | 'partial' | 'unavailable';

export interface RatioInput {
  key: string;
  label: string;
  value: number | null;
  unit: RatioUnit;
  source: string;
  period: string | null;
}

export interface RatioStep {
  label: string;
  expression: string;
  value: number | null;
  unit: RatioUnit;
}

export interface RatioSource {
  title: string;
  url: string;
  note?: string;
}

export interface RatioDescription {
  measures: string;
  interpretation: string;
  benchmark: string;
  source?: RatioSource;
}

export interface RatioResult {
  id: string;
  name: string;
  category: RatioCategory;
  period: string;
  value: number | null;
  unit: RatioUnit;
  display: string;
  formula: string;
  substitution: string;
  steps: RatioStep[];
  inputs: RatioInput[];
  notes: string[];
  description: RatioDescription;
  availability: RatioAvailability;
}

export interface RatioReport {
  period: string;
  unitMultiplier: number;
  daysInYear: number;
  ratios: RatioResult[];
  byCategory: Record<RatioCategory, RatioResult[]>;
  warnings: string[];
}

export interface SupplementalInputs {
  sharePrice?: number;
  sharesOutstanding?: number;
  earningsPerShare?: number;
  marketCapitalization?: number;
  enterpriseValue?: number;
  operatingCashFlow?: number;
  capitalExpenditures?: number;
  ebitda?: number;
  ebit?: number;
  totalDebt?: number;
  cashAndEquivalents?: number;
  volumeCurrent?: number;
  volumePrior?: number;
  netIncomeTrailing12Months?: number;
  netIncomeBasis?: NetIncomeBasis;
}

export type NumericSupplementalKey = Exclude<keyof SupplementalInputs, 'netIncomeBasis'>;

export interface RatioEngineInput {
  statements: {
    income: NormalizedStatement | null;
    balance: NormalizedStatement | null;
    cashflow?: NormalizedStatement | null;
  };
  period?: string;
  supplemental?: SupplementalInputs;
  useAverageBalances?: boolean;
  daysInYear?: number;
  annualNetIncome?: Record<string, { value: number; source: string }>;
}

export interface RatioEngineOptions {
  period?: string;
  supplemental?: SupplementalInputs;
  useAverageBalances?: boolean;
  daysInYear?: number;
}

interface ResolvedValue {
  value: number | null;
  input: RatioInput;
  fallback: boolean;
}

interface RatioContext {
  period: string;
  priorPeriod: string | null;
  availablePeriods: string[];
  income: NormalizedStatement | null;
  balance: NormalizedStatement | null;
  cashflow: NormalizedStatement | null;
  supplemental: SupplementalInputs;
  useAverageBalances: boolean;
  daysInYear: number;
  annualNetIncome: Record<string, { value: number; source: string }>;
  warnings: string[];
  labelFor: (category: FinancialCategory) => string;
  incomeValue: (category: FinancialCategory, period?: string) => number | null;
  balanceValue: (category: FinancialCategory, period?: string) => number | null;
  cashflowValue: (category: FinancialCategory, period?: string) => number | null;
  incomeInput: (category: FinancialCategory) => ResolvedValue;
  balanceInput: (category: FinancialCategory) => ResolvedValue;
  averageBalance: (category: FinancialCategory) => ResolvedValue;
  external: (key: string, label: string, value: number | undefined, source?: string) => RatioInput;
}

const LABEL_BY_CATEGORY = new Map<FinancialCategory, string>();
for (const definition of TAXONOMY) LABEL_BY_CATEGORY.set(definition.key, definition.label);

const INCOME_SOURCE = 'Income Statement';
const BALANCE_SOURCE = 'Balance Sheet';
const CASHFLOW_SOURCE = 'Cash Flow Statement';
const EXTERNAL_SOURCE = 'External input';

const RATIO_DESCRIPTIONS: Record<string, RatioDescription> = {
  'current-ratio': {
    measures: "A company's ability to pay its short-term obligations using its current assets.",
    interpretation: 'A higher ratio indicates stronger short-term liquidity; a ratio below 1.0 means current liabilities exceed current assets.',
    benchmark: 'A long-standing textbook rule of thumb is 2:1, but the appropriate level varies widely by industry and business model \u2014 treat it as directional, not a target.',
  },
  'quick-ratio': {
    measures: "A company's ability to cover current liabilities with its most liquid assets, excluding inventory.",
    interpretation: 'Higher is stronger; below 1.0 suggests reliance on inventory or future sales to meet near-term obligations.',
    benchmark: 'The classic acid-test rule of thumb is 1:1; read it as directional, since the right level depends on the industry.',
  },
  'cash-ratio': {
    measures: 'The proportion of current liabilities covered by cash and cash equivalents alone.',
    interpretation: 'The most conservative liquidity test; a higher value signals a larger cash cushion.',
    benchmark: 'No universal target; the appropriate cash cushion depends on the industry and the cash-conversion cycle. Very high values may indicate idle cash.',
  },
  'defensive-interval-ratio': {
    measures: 'How many days a company can operate using its liquid assets without additional revenue.',
    interpretation: 'A longer interval indicates a stronger buffer against a revenue interruption.',
    benchmark: 'No universal benchmark; a longer runway is safer, and a comfortable level depends on how stable the revenue stream is.',
  },
  'times-interest-earned': {
    measures: "How many times a company's operating profit (EBIT) covers its interest expense.",
    interpretation: 'Higher is safer; a value below 1.0 means EBIT cannot cover interest.',
    benchmark: 'No fixed threshold; higher is safer, and lenders typically want meaningfully more than 1.0. Compare across peers and over time.',
  },
  'tie-cash-basis': {
    measures: 'Interest coverage on a cash basis, adding depreciation and amortization back to EBIT.',
    interpretation: 'Higher is safer; the cash view is more forgiving of non-cash charges than TIE.',
    benchmark: 'Compare against TIE; a markedly higher value signals strong cash generation, though there is no universal target.',
  },
  'capex-to-operating-cash': {
    measures: 'The share of operating cash flow consumed by capital expenditures.',
    interpretation: 'Lower is better for liquidity; a rising ratio means more cash is tied up in investment.',
    benchmark: 'Below 1.0 means operations fund investment; above 1.0 means growth is financed externally \u2014 common for fast-growing companies, so context matters.',
  },
  'operating-cash-flow-ratio': {
    measures: "A company's ability to cover current liabilities with cash generated from operations.",
    interpretation: 'Higher is stronger; it measures liquidity from operations rather than balance-sheet assets.',
    benchmark: 'At least 1.0 generally means operations cover current liabilities; how much headroom is "enough" is industry-dependent.',
  },
  'return-on-equity': {
    measures: "The profit generated per dollar of shareholders' equity.",
    interpretation: 'Higher is better; a rising ROE can reflect improved profitability or heavier leverage.',
    benchmark: 'No universal benchmark; ROE varies widely by industry and leverage. Judge it against peers and the company\u2019s own history.',
  },
  'return-on-assets': {
    measures: 'How efficiently a company uses its total assets to generate profit.',
    interpretation: 'Higher is better; an improving trend signals better asset productivity.',
    benchmark: 'Highly industry-dependent \u2014 asset-heavy sectors naturally run low. Compare against peers and the trend rather than a fixed number.',
  },
  'return-on-capital-employed': {
    measures: 'The return generated on all capital employed (equity plus debt) in the business.',
    interpretation: 'Higher is better; it shows how well long-term capital is turned into profit.',
    benchmark: "Best judged against the company's cost of capital: returns above it create value, below it destroy value. There is no single target figure.",
  },
  'gross-margin': {
    measures: 'The percentage of revenue retained after deducting the cost of goods sold.',
    interpretation: 'Higher is better; it reflects pricing power and production efficiency.',
    benchmark: 'No universal target; gross margins are industry-specific. Read the trend and compare with direct competitors.',
  },
  'operating-margin': {
    measures: 'The percentage of revenue left as operating profit (EBIT) after operating costs.',
    interpretation: 'Higher is better; it captures core operating efficiency before financing and taxes.',
    benchmark: 'No universal threshold; a "good" level is industry-specific. Track the trend and compare with peers.',
  },
  'net-profit-margin': {
    measures: 'The percentage of revenue that becomes net income after all expenses, interest and taxes.',
    interpretation: 'Higher is better; it is the final measure of overall profitability.',
    benchmark: 'No universal benchmark; net margins vary widely by industry. Best read as a trend and against competitors.',
  },
  'debt-to-equity': {
    measures: "The relative proportion of debt and shareholders' equity used to finance assets.",
    interpretation: 'Higher means greater financial risk; lower means more conservative financing.',
    benchmark: 'No universal limit; acceptable leverage depends on the industry, cash-flow stability and the cost of debt. Compare against peers.',
  },
  'equity-ratio': {
    measures: "The proportion of total assets financed by shareholders' equity.",
    interpretation: 'Higher means a stronger equity cushion and lower reliance on debt.',
    benchmark: 'No universal target; capital-structure norms differ by industry and are often shaped by lenders or regulation.',
  },
  'debt-ratio': {
    measures: 'The proportion of total assets financed by all liabilities.',
    interpretation: 'Higher means more leveraged and more reliant on creditors.',
    benchmark: 'No universal threshold; an appropriate level depends on the industry and how predictable the cash flows are.',
  },
  'financial-leverage': {
    measures: "How many dollars of assets the company carries for each dollar of shareholders' equity.",
    interpretation: 'Higher means assets are funded more by liabilities than by owners, which magnifies both returns and losses.',
    benchmark: 'No universal target; a multiplier near 1.0 means assets are funded almost entirely by equity, and leverage norms differ widely by industry.',
  },
  'asset-to-equity': {
    measures: "The period-end amount of assets the company carries for each dollar of shareholders' equity.",
    interpretation: 'Higher means a larger asset base per dollar of equity, i.e. more reliance on debt and other liabilities.',
    benchmark: 'No universal target; compare against peers and the company\u2019s own history, and read it alongside the debt-to-equity ratio.',
  },
  'sales-growth': {
    measures: 'The period-over-period percentage change in revenue.',
    interpretation: 'Positive growth indicates expanding sales, while negative growth signals a contraction in top-line activity.',
    benchmark: 'Highly industry-dependent; compare against the sector and the company\u2019s own long-term trend rather than a fixed number.',
  },
  'volume-growth': {
    measures: 'The period-over-period percentage change in physical sales volume.',
    interpretation: 'Positive growth means more units were sold, isolating volume effects from price and product-mix changes.',
    benchmark: 'Not available from the financial statements alone; supply operational volume data and compare against peers.',
  },
  'ar-turnover': {
    measures: 'How many times accounts receivable are collected during a period.',
    interpretation: 'Higher is better; it signals faster collection and efficient credit management.',
    benchmark: 'No universal benchmark; a good rate depends on credit terms and industry. Track the trend over time.',
  },
  'ar-days': {
    measures: 'The average number of days it takes to collect on receivables.',
    interpretation: 'Lower is better; a shorter period means faster cash collection.',
    benchmark: 'No universal target; it should approximate the company\u2019s credit terms (e.g., net-30). Days well beyond terms can signal collection issues.',
  },
  'asset-turnover': {
    measures: 'How efficiently total assets generate revenue.',
    interpretation: 'Higher is better; it shows more sales per dollar of assets.',
    benchmark: 'No universal benchmark; asset-heavy industries naturally run lower. Best compared with peers.',
  },
  'inventory-turnover': {
    measures: 'How many times inventory is sold and replaced during a period.',
    interpretation: 'Higher is better; it indicates strong demand and efficient inventory management.',
    benchmark: 'No universal target; it depends on the industry and product. Compare with peers and follow the trend.',
  },
  'inventory-days': {
    measures: 'The average number of days inventory is held before it is sold.',
    interpretation: 'Lower is better; a shorter period means inventory converts to sales faster.',
    benchmark: 'No universal benchmark; the appropriate level depends on the industry and product shelf life.',
  },
  'pe-ratio': {
    measures: 'The market price investors pay for each dollar of earnings.',
    interpretation: 'Higher can indicate growth expectations or overvaluation; lower may signal undervaluation.',
    benchmark: 'No universal benchmark; P/E reflects growth, risk and industry. Compare with peers and the company\u2019s own history.',
  },
  'ev-to-ebitda': {
    measures: 'The enterprise value relative to earnings before interest, taxes, depreciation and amortization.',
    interpretation: 'Lower means the company is cheaper on an operating-cash basis; higher implies a premium.',
    benchmark: 'No universal multiple; EV/EBITDA is highly sector-specific. Compare within the industry.',
  },
  'ev-to-ebit': {
    measures: 'The enterprise value relative to operating profit (EBIT).',
    interpretation: 'Lower is cheaper; it accounts for capital intensity better than EV/EBITDA.',
    benchmark: 'No universal benchmark; best compared within the industry, where it accounts for capital intensity.',
  },
  'ev-to-revenue': {
    measures: 'The enterprise value relative to total revenue.',
    interpretation: 'Lower is cheaper; useful when comparing companies with differing profitability.',
    benchmark: 'No universal multiple; revenue multiples vary widely by sector (high-growth software trades far above mature industrials).',
  },
};

const CFI = 'https://corporatefinanceinstitute.com/resources';

const RATIO_SOURCES: Record<string, RatioSource> = {
  'current-ratio': { title: 'Current Ratio Formula \u2014 Overview, Calculation & Examples', url: `${CFI}/accounting/current-ratio-formula` },
  'quick-ratio': { title: 'Quick Ratio \u2014 Definition, Formula & Examples', url: `${CFI}/accounting/quick-ratio-definition/` },
  'cash-ratio': {
    title: 'Cash Ratio \u2014 Definition, Calculation & Template',
    url: `${CFI}/accounting/cash-ratio-formula`,
    note: 'CFI\u2019s cash ratio counts cash and cash equivalents only; this engine also includes short-term investments in the numerator.',
  },
  'defensive-interval-ratio': {
    title: 'Defensive Interval Ratio \u2014 Definition & Formula',
    url: `${CFI}/accounting/defensive-interval-ratio`,
    note: 'CFI divides liquid assets by daily operational expenditure after deducting non-cash charges; this engine uses COGS + operating expenses without that adjustment because depreciation and amortization are not always broken out.',
  },
  'times-interest-earned': { title: 'Interest Coverage Ratio (Times Interest Earned)', url: `${CFI}/commercial-lending/interest-coverage-ratio` },
  'tie-cash-basis': {
    title: 'Corporate Finance Ratios \u2014 Interest Coverage (Cash Basis)',
    url: `${CFI}/accounting/corporate-finance-ratios`,
    note: 'CFI states this as Adjusted Operating Cash Flow / Interest Expense; this engine approximates the cash numerator with EBIT + depreciation & amortization.',
  },
  'capex-to-operating-cash': {
    title: 'Corporate Finance Ratios \u2014 CAPEX to Operating Cash',
    url: `${CFI}/accounting/corporate-finance-ratios`,
    note: 'CFI states the ratio as Operating Cash Flow / Capital Expenditures; this engine inverts it to Capital Expenditures / Operating Cash Flow so a value above 1.0 flags investment funded beyond operating cash.',
  },
  'operating-cash-flow-ratio': { title: 'Operating Cash Flow Ratio Template', url: `${CFI}/financial-modeling/operating-cash-flow-ratio-template` },
  'return-on-equity': { title: 'Return on Equity (ROE) \u2014 Formula, Examples & Guide', url: `${CFI}/accounting/what-is-return-on-equity-roe` },
  'return-on-assets': { title: 'Return on Assets (ROA) \u2014 Formula, Calculation & Examples', url: `${CFI}/accounting/return-on-assets-roa-formula` },
  'return-on-capital-employed': { title: 'Return on Capital Employed (ROCE)', url: `${CFI}/accounting/return-on-capital-employed-roce` },
  'gross-margin': { title: 'Gross Margin Ratio \u2014 Learn How to Calculate', url: `${CFI}/accounting/gross-margin-ratio/` },
  'operating-margin': { title: 'Operating Profit Margin \u2014 Learn to Calculate', url: `${CFI}/accounting/operating-profit-margin` },
  'net-profit-margin': { title: 'Net Profit Margin \u2014 Definition, Formula & Example', url: `${CFI}/accounting/net-profit-margin-formula/` },
  'debt-to-equity': { title: 'Debt Equity Ratio \u2014 Formula & Calculation', url: `${CFI}/commercial-lending/debt-to-equity-ratio-formula` },
  'equity-ratio': { title: 'Equity Ratio \u2014 Definition, Formula & Examples', url: `${CFI}/valuation/equity-ratio` },
  'debt-ratio': {
    title: 'Accounting Ratios \u2014 Debt Ratio = Total Liabilities / Total Assets',
    url: `${CFI}/accounting/accounting-ratios`,
    note: 'Matches CFI\u2019s accounting-ratios definition using total liabilities; CFI\u2019s commercial-lending \u201cdebt to assets\u201d variant counts interest-bearing funded debt only.',
  },
  'financial-leverage': { title: 'Equity Multiplier \u2014 Guide, Examples & Financial Leverage Ratios', url: `${CFI}/valuation/equity-multiplier` },
  'asset-to-equity': { title: 'Equity Multiplier \u2014 Guide, Examples & Financial Leverage Ratios', url: `${CFI}/valuation/equity-multiplier` },
  'sales-growth': { title: 'Horizontal Analysis \u2014 Year-over-Year Change', url: `${CFI}/accounting/horizontal-analysis` },
  'volume-growth': {
    title: 'Horizontal Analysis \u2014 Year-over-Year Change',
    url: `${CFI}/accounting/horizontal-analysis`,
    note: 'Volume growth applies the horizontal-analysis percent-change formula to physical sales volume, which is not reported in the financial statements.',
  },
  'ar-turnover': { title: 'Activity Ratios \u2014 Receivables Turnover = Revenue / Average Receivables', url: `${CFI}/accounting/activity-ratios/` },
  'ar-days': { title: 'Days Sales Outstanding (DSO) \u2014 Formula, Example & Definition', url: `${CFI}/accounting/days-sales-outstanding` },
  'asset-turnover': { title: 'Asset Turnover Ratio \u2014 Overview and How to Calculate', url: `${CFI}/accounting/asset-turnover-ratio` },
  'inventory-turnover': { title: 'Inventory Turnover \u2014 Formula, Calculation & Examples', url: `${CFI}/accounting/inventory-turnover/` },
  'inventory-days': { title: 'Days Sales in Inventory (DSI) \u2014 Formula & Example', url: `${CFI}/financial-modeling/days-sales-in-inventory` },
  'pe-ratio': { title: 'Price Earnings Ratio \u2014 Formula, Examples & Guide to P/E', url: `${CFI}/valuation/price-earnings-ratio` },
  'ev-to-ebitda': { title: 'EV/EBITDA \u2014 Definition, Formula, Uses & Pros and Cons', url: `${CFI}/valuation/ev-ebitda/` },
  'ev-to-ebit': { title: 'EV/EBIT Ratio \u2014 Overview, Formula & Example', url: `${CFI}/valuation/ev-ebit-ratio/` },
  'ev-to-revenue': { title: 'EV to Revenue Multiple \u2014 Learn How to Calculate', url: `${CFI}/valuation/ev-to-revenue-multiple/` },
};

const FALLBACK_DESCRIPTION: RatioDescription = {
  measures: 'A financial ratio from the CFI corporate finance set.',
  interpretation: 'Interpret the value in the context of the industry and the company\u2019s own history.',
  benchmark: 'No universal benchmark; compare against industry peers.',
};

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function toNumber(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export const DAY_COUNT_BASES = [365, 360] as const;
export type DayCountBasis = (typeof DAY_COUNT_BASES)[number];
export const DEFAULT_DAYS_IN_YEAR: DayCountBasis = 365;

export const NET_INCOME_BASES = ['period', 'trailing'] as const;
export type NetIncomeBasis = (typeof NET_INCOME_BASES)[number];
export const DEFAULT_NET_INCOME_BASIS: NetIncomeBasis = 'period';

function resolveDaysInYear(value: number | undefined): DayCountBasis {
  return value === 360 ? 360 : 365;
}

function add(...values: (number | null)[]): number | null {
  let sum = 0;
  let found = false;
  for (const value of values) {
    if (value === null || value === undefined) continue;
    sum += value;
    found = true;
  }
  return found ? round(sum) : null;
}

function subtract(left: number | null, right: number | null): number | null {
  if (left === null) return null;
  return round(left - (right ?? 0));
}

function divide(numerator: number | null, denominator: number | null): { value: number | null; note?: string } {
  if (numerator === null) return { value: null, note: 'Numerator unavailable.' };
  if (denominator === null) return { value: null, note: 'Denominator unavailable.' };
  if (denominator === 0) return { value: null, note: 'Denominator is zero; ratio is undefined.' };
  return { value: numerator / denominator };
}

function formatNumber(value: number | null): string {
  if (value === null) return 'n/a';
  const rounded = round(value, 6);
  const sign = rounded < 0 ? '-' : '';
  return sign + Math.abs(rounded).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatFixed(value: number): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(round(value, 2));
  return `${sign}${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatForUnit(value: number | null, unit: RatioUnit): string {
  if (value === null) return 'n/a';
  switch (unit) {
    case 'percent':
      return `${round(value, 2).toFixed(2)}%`;
    case 'days':
      return `${round(value, 2).toFixed(2)} days`;
    case 'currency':
      return formatFixed(value);
    case 'ratio':
      return String(Number(round(value, 10).toFixed(10)));
    default:
      return `${round(value, 2).toFixed(2)}x`;
  }
}

function valueInput(
  key: string,
  label: string,
  value: number | null,
  unit: RatioUnit,
  source: string,
  period: string | null
): RatioInput {
  return { key, label, value, unit, source, period };
}

function createContext(input: RatioEngineInput): RatioContext {
  const income = input.statements.income;
  const balance = input.statements.balance;
  const cashflow = input.statements.cashflow ?? null;
  const supplemental = input.supplemental ?? {};
  const useAverageBalances = input.useAverageBalances ?? true;
  const daysInYear = resolveDaysInYear(input.daysInYear);
  const annualNetIncome = input.annualNetIncome ?? {};
  const warnings: string[] = [];

  const rawPeriods: string[] = [];
  for (const statement of [balance, income, cashflow]) {
    if (!statement) continue;
    for (const period of statement.periods) if (!rawPeriods.includes(period)) rawPeriods.push(period);
  }
  const { ordered } = orderPeriods(rawPeriods);

  if (!ordered.length) warnings.push('No statement periods were available.');

  let period = input.period ?? ordered[ordered.length - 1] ?? '';
  if (input.period && !ordered.includes(input.period)) {
    warnings.push(`Requested period "${input.period}" was not found; using latest period instead.`);
    period = ordered[ordered.length - 1] ?? input.period;
  }
  const periodIndex = ordered.indexOf(period);
  const priorPeriod = periodIndex > 0 ? ordered[periodIndex - 1] : null;

  const labelFor = (category: FinancialCategory): string => LABEL_BY_CATEGORY.get(category) ?? category;

  const statementValue = (
    statement: NormalizedStatement | null,
    category: FinancialCategory,
    targetPeriod: string
  ): number | null => {
    if (!statement) return null;
    const item = statement.lineItems.find((entry) => entry.category === category);
    if (!item) return null;
    const value = item.values[targetPeriod];
    return value === null || value === undefined ? null : value;
  };

  const incomeValue = (category: FinancialCategory, targetPeriod = period): number | null =>
    statementValue(income, category, targetPeriod);

  const balanceValue = (category: FinancialCategory, targetPeriod = period): number | null =>
    statementValue(balance, category, targetPeriod);

  const cashflowValue = (category: FinancialCategory, targetPeriod = period): number | null =>
    statementValue(cashflow, category, targetPeriod);

  const incomeInput = (category: FinancialCategory): ResolvedValue => ({
    value: incomeValue(category),
    input: valueInput(category, labelFor(category), incomeValue(category), 'currency', INCOME_SOURCE, period),
    fallback: false,
  });

  const balanceInput = (category: FinancialCategory): ResolvedValue => ({
    value: balanceValue(category),
    input: valueInput(category, labelFor(category), balanceValue(category), 'currency', BALANCE_SOURCE, period),
    fallback: false,
  });

  const averageBalance = (category: FinancialCategory): ResolvedValue => {
    const current = balanceValue(category);
    const prior = priorPeriod ? balanceValue(category, priorPeriod) : null;
    if (useAverageBalances && current !== null && prior !== null) {
      const average = round((current + prior) / 2);
      return {
        value: average,
        input: valueInput(
          category,
          `${labelFor(category)} (average)`,
          average,
          'currency',
          `${BALANCE_SOURCE} average of ${priorPeriod} & ${period}`,
          period
        ),
        fallback: false,
      };
    }
    const periodLabel = priorPeriod ? `${priorPeriod} & ${period}` : period;
    return {
      value: current,
      input: valueInput(
        category,
        `${labelFor(category)} (period-end)`,
        current,
        'currency',
        `${BALANCE_SOURCE} period-end ${periodLabel}`,
        period
      ),
      fallback: true,
    };
  };

  const external = (
    key: string,
    label: string,
    value: number | undefined,
    source: string = EXTERNAL_SOURCE
  ): RatioInput => valueInput(key, label, toNumber(value), 'currency', source, period);

  return {
    period,
    priorPeriod,
    availablePeriods: ordered,
    income,
    balance,
    cashflow,
    supplemental,
    useAverageBalances,
    daysInYear,
    annualNetIncome,
    warnings,
    labelFor,
    incomeValue,
    balanceValue,
    cashflowValue,
    incomeInput,
    balanceInput,
    averageBalance,
    external,
  };
}

function makeResult(
  period: string,
  definition: {
    id: string;
    name: string;
    category: RatioCategory;
    unit: RatioUnit;
    formula: string;
  },
  payload: {
    value: number | null;
    substitution: string;
    steps: RatioStep[];
    inputs: RatioInput[];
    notes?: string[];
    fallback?: boolean;
  }
): RatioResult {
  const notes = payload.notes ?? [];
  let availability: RatioAvailability;
  if (payload.value === null) availability = 'unavailable';
  else if (payload.fallback || notes.length > 0) availability = 'partial';
  else availability = 'computed';

  return {
    id: definition.id,
    name: definition.name,
    category: definition.category,
    period,
    value: payload.value === null ? null : round(payload.value, 6),
    unit: definition.unit,
    display: formatForUnit(payload.value, definition.unit),
    formula: definition.formula,
    substitution: payload.substitution,
    steps: payload.steps.map((step) => ({ ...step, value: step.value === null ? null : round(step.value, 10) })),
    inputs: payload.inputs,
    notes,
    description: { ...(RATIO_DESCRIPTIONS[definition.id] ?? FALLBACK_DESCRIPTION), source: RATIO_SOURCES[definition.id] },
    availability,
  };
}

function percentResult(value: number | null): number | null {
  return value === null ? null : round(value * 100, 4);
}

function currentLiabilities(ctx: RatioContext): ResolvedValue {
  return ctx.balanceInput('total_current_liabilities');
}

function currentAssets(ctx: RatioContext): ResolvedValue {
  return ctx.balanceInput('total_current_assets');
}

function cashAndShortTerm(ctx: RatioContext): { value: number | null; inputs: RatioInput[]; missing: string[] } {
  const cash = ctx.balanceInput('cash_and_equivalents');
  const investments = ctx.balanceInput('short_term_investments');
  const missing: string[] = [];
  if (cash.value === null) missing.push('Cash and Cash Equivalents');
  if (investments.value === null) missing.push('Short-Term Investments');
  return {
    value: add(cash.value, investments.value),
    inputs: [cash.input, investments.input],
    missing,
  };
}

function ebit(ctx: RatioContext): { value: number | null; inputs: RatioInput[]; note?: string } {
  const operatingIncome = ctx.incomeInput('operating_income');
  if (operatingIncome.value !== null) {
    return { value: operatingIncome.value, inputs: [operatingIncome.input] };
  }
  const pretax = ctx.incomeInput('pretax_income');
  const interest = ctx.incomeInput('interest_expense');
  if (pretax.value !== null && interest.value !== null) {
    return {
      value: add(pretax.value, Math.abs(interest.value)),
      inputs: [pretax.input, interest.input],
      note: 'EBIT derived as Income Before Taxes + Interest Expense (operating income unavailable).',
    };
  }
  const net = ctx.incomeInput('net_income');
  const tax = ctx.incomeInput('income_tax_expense');
  if (net.value !== null && tax.value !== null && interest.value !== null) {
    return {
      value: add(net.value, Math.abs(tax.value), Math.abs(interest.value)),
      inputs: [net.input, tax.input, interest.input],
      note: 'EBIT derived as Net Income + Income Tax + Interest Expense.',
    };
  }
  return { value: null, inputs: [operatingIncome.input], note: 'EBIT could not be determined.' };
}

function operatingIncome(ctx: RatioContext): { value: number | null; inputs: RatioInput[]; note?: string } {
  const line = ctx.incomeInput('operating_income');
  if (line.value !== null) {
    return { value: line.value, inputs: [line.input] };
  }
  const gross = ctx.incomeInput('gross_profit');
  const sga = ctx.incomeInput('selling_general_and_administrative');
  if (gross.value !== null && sga.value !== null) {
    const rd = ctx.incomeInput('research_and_development');
    const other = ctx.incomeInput('other_operating_income');
    const sgaAbs = sga.value === null ? null : -Math.abs(sga.value);
    const rdAbs = rd.value === null ? null : -Math.abs(rd.value);
    const value = add(gross.value, sgaAbs, rdAbs, other.value);
    if (value !== null) {
      const inputs = [gross.input, sga.input];
      if (rd.value !== null) inputs.push(rd.input);
      if (other.value !== null) inputs.push(other.input);
      return {
        value,
        inputs,
        note: 'Operating Income line not reported; derived as Gross Profit \u2212 Operating Expenses + Other Operating Income.',
      };
    }
  }
  return ebit(ctx);
}

function ebitda(ctx: RatioContext): { value: number | null; inputs: RatioInput[]; note?: string } {
  const supplied = toNumber(ctx.supplemental.ebitda);
  if (supplied !== null) {
    return { value: supplied, inputs: [ctx.external('ebitda', 'EBITDA (reported)', ctx.supplemental.ebitda)] };
  }
  const ebitResult = ebit(ctx);
  const depreciation = ctx.incomeInput('depreciation_and_amortization');
  if (ebitResult.value !== null && depreciation.value !== null) {
    return {
      value: add(ebitResult.value, depreciation.value),
      inputs: [...ebitResult.inputs, depreciation.input],
      note: 'EBITDA derived as EBIT + Depreciation & Amortization.',
    };
  }
  return { value: null, inputs: ebitResult.inputs, note: 'EBITDA could not be determined.' };
}

function totalDebt(ctx: RatioContext): { value: number | null; inputs: RatioInput[]; fallback: boolean; note?: string } {
  const supplied = toNumber(ctx.supplemental.totalDebt);
  if (supplied !== null) {
    return {
      value: supplied,
      inputs: [ctx.external('totalDebt', 'Total Debt (reported)', ctx.supplemental.totalDebt)],
      fallback: false,
    };
  }
  const shortTerm = ctx.balanceInput('short_term_debt');
  const currentPortion = ctx.balanceInput('current_portion_of_long_term_debt');
  const longTerm = ctx.balanceInput('long_term_debt');
  if (shortTerm.value !== null || currentPortion.value !== null || longTerm.value !== null) {
    return {
      value: add(shortTerm.value, currentPortion.value, longTerm.value),
      inputs: [shortTerm.input, currentPortion.input, longTerm.input],
      fallback: false,
    };
  }
  const liabilities = ctx.balanceInput('total_liabilities');
  if (liabilities.value !== null) {
    return {
      value: liabilities.value,
      inputs: [liabilities.input],
      fallback: true,
      note: 'Debt detail unavailable; fell back to Total Liabilities as a proxy for total debt.',
    };
  }
  return {
    value: null,
    inputs: [shortTerm.input, currentPortion.input, longTerm.input],
    fallback: true,
    note: 'Total debt unavailable.',
  };
}

function revenueInput(ctx: RatioContext): ResolvedValue {
  return ctx.incomeInput('revenue');
}

function operatingExpensesInput(ctx: RatioContext): { value: number | null; inputs: RatioInput[]; note?: string } {
  const total = ctx.incomeInput('operating_expenses');
  if (total.value !== null) return { value: total.value, inputs: [total.input] };
  const rd = ctx.incomeInput('research_and_development');
  const sga = ctx.incomeInput('selling_general_and_administrative');
  const da = ctx.incomeInput('depreciation_and_amortization');
  const sum = add(rd.value, sga.value, da.value);
  if (sum !== null) {
    return {
      value: sum,
      inputs: [rd.input, sga.input, da.input],
      note: 'Operating expenses summed from R&D + SG&A + D&A components.',
    };
  }
  return { value: null, inputs: [total.input], note: 'Operating expenses unavailable.' };
}

function ratioCurrent(ctx: RatioContext): RatioResult {
  const ca = currentAssets(ctx);
  const cl = currentLiabilities(ctx);
  const { value, note } = divide(ca.value, cl.value);
  return makeResult(
    ctx.period,
    {
      id: 'current-ratio',
      name: 'Current Ratio',
      category: 'liquidity',
      unit: 'times',
      formula: 'Current Ratio = Current Assets / Current Liabilities',
    },
    {
      value,
      substitution: `${formatNumber(ca.value)} (Total Current Assets) / ${formatNumber(cl.value)} (Total Current Liabilities)`,
      steps: [
        { label: 'Total Current Assets', expression: formatNumber(ca.value), value: ca.value, unit: 'currency' },
        { label: 'Total Current Liabilities', expression: formatNumber(cl.value), value: cl.value, unit: 'currency' },
        {
          label: 'Current Ratio',
          expression: `${formatNumber(ca.value)} / ${formatNumber(cl.value)}`,
          value,
          unit: 'times',
        },
      ],
      inputs: [ca.input, cl.input],
      notes: note ? [note] : [],
    }
  );
}

function ratioQuick(ctx: RatioContext): RatioResult {
  const cash = cashAndShortTerm(ctx);
  const ar = ctx.balanceInput('accounts_receivable');
  const cl = currentLiabilities(ctx);
  const numerator = add(cash.value, ar.value);
  const { value, note } = divide(numerator, cl.value);
  const notes: string[] = [];
  if (cash.missing.length) notes.push(`Quick assets exclude unavailable items: ${cash.missing.join(', ')}.`);
  if (note) notes.push(note);
  return makeResult(
    ctx.period,
    {
      id: 'quick-ratio',
      name: 'Quick Ratio',
      category: 'liquidity',
      unit: 'times',
      formula: 'Quick Ratio = (Cash + Cash Equivalents + Short-Term Investments + Accounts Receivable) / Current Liabilities',
    },
    {
      value,
      substitution:
        `(${formatNumber(cash.value)} (Cash & Short-Term Investments) + ${formatNumber(ar.value)} (Accounts Receivable)) / ` +
        `${formatNumber(cl.value)} (Total Current Liabilities)`,
      steps: [
        {
          label: 'Quick Assets',
          expression: `${formatNumber(cash.value)} + ${formatNumber(ar.value)}`,
          value: numerator,
          unit: 'currency',
        },
        { label: 'Total Current Liabilities', expression: formatNumber(cl.value), value: cl.value, unit: 'currency' },
        {
          label: 'Quick Ratio',
          expression: `${formatNumber(numerator)} / ${formatNumber(cl.value)}`,
          value,
          unit: 'times',
        },
      ],
      inputs: [...cash.inputs, ar.input, cl.input],
      notes,
    }
  );
}

function ratioCash(ctx: RatioContext): RatioResult {
  const cash = cashAndShortTerm(ctx);
  const cl = currentLiabilities(ctx);
  const { value, note } = divide(cash.value, cl.value);
  const notes: string[] = [];
  if (cash.missing.length) notes.push(`Cash ratio components unavailable: ${cash.missing.join(', ')}.`);
  if (note) notes.push(note);
  return makeResult(
    ctx.period,
    {
      id: 'cash-ratio',
      name: 'Cash Ratio',
      category: 'liquidity',
      unit: 'times',
      formula: 'Cash Ratio = (Cash + Cash Equivalents + Short-Term Investments) / Current Liabilities',
    },
    {
      value,
      substitution: `${formatNumber(cash.value)} (Cash & Short-Term Investments) / ${formatNumber(cl.value)} (Total Current Liabilities)`,
      steps: [
        {
          label: 'Cash & Short-Term Investments',
          expression: formatNumber(cash.value),
          value: cash.value,
          unit: 'currency',
        },
        { label: 'Total Current Liabilities', expression: formatNumber(cl.value), value: cl.value, unit: 'currency' },
        { label: 'Cash Ratio', expression: `${formatNumber(cash.value)} / ${formatNumber(cl.value)}`, value, unit: 'times' },
      ],
      inputs: [...cash.inputs, cl.input],
      notes,
    }
  );
}

function ratioDefensiveInterval(ctx: RatioContext): RatioResult {
  const cash = cashAndShortTerm(ctx);
  const ar = ctx.balanceInput('accounts_receivable');
  const liquidAssets = add(cash.value, ar.value);
  const cogs = ctx.incomeInput('cost_of_goods_sold');
  const opex = operatingExpensesInput(ctx);
  const totalOperating = add(cogs.value, opex.value);
  const daily = totalOperating === null ? null : round(totalOperating / ctx.daysInYear);
  const { value, note } = divide(liquidAssets, daily);
  const notes: string[] = [];
  if (opex.note) notes.push(opex.note);
  if (note) notes.push(note);
  return makeResult(
    ctx.period,
    {
      id: 'defensive-interval-ratio',
      name: 'Defensive Interval Ratio',
      category: 'liquidity',
      unit: 'days',
      formula: 'DIR = (Cash + Short-Term Investments + Accounts Receivable) / Daily Operating Expenditures',
    },
    {
      value,
      substitution:
        `${formatNumber(liquidAssets)} (Liquid Assets) / ${formatNumber(daily)} (Daily Operating Expenditures = ` +
        `(${formatNumber(cogs.value)} COGS + ${formatNumber(opex.value)} Operating Expenses) / ${ctx.daysInYear})`,
      steps: [
        {
          label: 'Liquid Assets',
          expression: `${formatNumber(cash.value)} + ${formatNumber(ar.value)}`,
          value: liquidAssets,
          unit: 'currency',
        },
        {
          label: 'Daily Operating Expenditures',
          expression: `(${formatNumber(cogs.value)} + ${formatNumber(opex.value)}) / ${ctx.daysInYear}`,
          value: daily,
          unit: 'currency',
        },
        {
          label: 'Defensive Interval Ratio',
          expression: `${formatNumber(liquidAssets)} / ${formatNumber(daily)}`,
          value,
          unit: 'days',
        },
      ],
      inputs: [...cash.inputs, ar.input, cogs.input, ...opex.inputs],
      notes,
    }
  );
}

function ratioTie(ctx: RatioContext): RatioResult {
  const ebitResult = ebit(ctx);
  const interest = ctx.incomeInput('interest_expense');
  const interestValue = interest.value === null ? null : Math.abs(interest.value);
  const { value, note } = divide(ebitResult.value, interestValue);
  const notes: string[] = [];
  if (ebitResult.note) notes.push(ebitResult.note);
  if (note) notes.push(note);
  return makeResult(
    ctx.period,
    {
      id: 'times-interest-earned',
      name: 'Times Interest Earned (TIE)',
      category: 'liquidity',
      unit: 'times',
      formula: 'TIE = EBIT / Interest Expense',
    },
    {
      value,
      substitution: `${formatNumber(ebitResult.value)} (EBIT) / ${formatNumber(interestValue)} (Interest Expense)`,
      steps: [
        { label: 'EBIT', expression: formatNumber(ebitResult.value), value: ebitResult.value, unit: 'currency' },
        { label: 'Interest Expense', expression: formatNumber(interestValue), value: interestValue, unit: 'currency' },
        {
          label: 'Times Interest Earned',
          expression: `${formatNumber(ebitResult.value)} / ${formatNumber(interestValue)}`,
          value,
          unit: 'times',
        },
      ],
      inputs: [...ebitResult.inputs, interest.input],
      notes,
    }
  );
}

function ratioTieCashBasis(ctx: RatioContext): RatioResult {
  const ebitResult = ebit(ctx);
  const da = ctx.incomeInput('depreciation_and_amortization');
  const interest = ctx.incomeInput('interest_expense');
  const interestValue = interest.value === null ? null : Math.abs(interest.value);
  const ebitdaValue = add(ebitResult.value, da.value);
  const { value, note } = divide(ebitdaValue, interestValue);
  const notes: string[] = [];
  if (ebitResult.note) notes.push(ebitResult.note);
  if (note) notes.push(note);
  return makeResult(
    ctx.period,
    {
      id: 'tie-cash-basis',
      name: 'Times Interest Earned - Cash Basis (TIE-CB)',
      category: 'liquidity',
      unit: 'times',
      formula: 'TIE-CB = (EBIT + Depreciation & Amortization) / Interest Expense',
    },
    {
      value,
      substitution:
        `(${formatNumber(ebitResult.value)} (EBIT) + ${formatNumber(da.value)} (D&A)) / ` +
        `${formatNumber(interestValue)} (Interest Expense)`,
      steps: [
        { label: 'EBIT', expression: formatNumber(ebitResult.value), value: ebitResult.value, unit: 'currency' },
        {
          label: 'EBIT + D&A',
          expression: `${formatNumber(ebitResult.value)} + ${formatNumber(da.value)}`,
          value: ebitdaValue,
          unit: 'currency',
        },
        { label: 'Interest Expense', expression: formatNumber(interestValue), value: interestValue, unit: 'currency' },
        {
          label: 'TIE-CB',
          expression: `${formatNumber(ebitdaValue)} / ${formatNumber(interestValue)}`,
          value,
          unit: 'times',
        },
      ],
      inputs: [...ebitResult.inputs, da.input, interest.input],
      notes,
    }
  );
}

function preferredCashflowInput(
  ctx: RatioContext,
  category: FinancialCategory,
  label: string,
  supplementalKey: NumericSupplementalKey
): RatioInput {
  const fromStatement = ctx.cashflowValue(category);
  if (fromStatement !== null) {
    return { key: category, label, value: fromStatement, unit: 'currency', source: CASHFLOW_SOURCE, period: ctx.period };
  }
  return ctx.external(supplementalKey, label, ctx.supplemental[supplementalKey], CASHFLOW_SOURCE);
}

function ratioCapexToOperatingCash(ctx: RatioContext): RatioResult {
  const capex = preferredCashflowInput(ctx, 'capital_expenditures', 'Capital Expenditures', 'capitalExpenditures');
  const ocf = preferredCashflowInput(
    ctx,
    'net_cash_from_operating_activities',
    'Operating Cash Flow',
    'operatingCashFlow'
  );
  const { value, note } = divide(capex.value, ocf.value);
  const notes: string[] = [];
  if (capex.value === null || ocf.value === null) {
    notes.push('Add a Cash Flow statement with capital expenditures and operating cash flow, or supply them as external inputs.');
  }
  if (note) notes.push(note);
  return makeResult(
    ctx.period,
    {
      id: 'capex-to-operating-cash',
      name: 'CAPEX to Operating Cash Ratio',
      category: 'liquidity',
      unit: 'times',
      formula: 'CAPEX to Operating Cash = Capital Expenditures / Operating Cash Flow',
    },
    {
      value,
      substitution: `${formatNumber(capex.value)} (Capital Expenditures) / ${formatNumber(ocf.value)} (Operating Cash Flow)`,
      steps: [
        { label: 'Capital Expenditures', expression: formatNumber(capex.value), value: capex.value, unit: 'currency' },
        { label: 'Operating Cash Flow', expression: formatNumber(ocf.value), value: ocf.value, unit: 'currency' },
        {
          label: 'CAPEX to Operating Cash',
          expression: `${formatNumber(capex.value)} / ${formatNumber(ocf.value)}`,
          value,
          unit: 'times',
        },
      ],
      inputs: [capex, ocf],
      notes,
    }
  );
}

function ratioOperatingCashFlow(ctx: RatioContext): RatioResult {
  const ocf = preferredCashflowInput(
    ctx,
    'net_cash_from_operating_activities',
    'Operating Cash Flow',
    'operatingCashFlow'
  );
  const cl = currentLiabilities(ctx);
  const { value, note } = divide(ocf.value, cl.value);
  const notes: string[] = [];
  if (ocf.value === null) notes.push('Add a Cash Flow statement with operating cash flow, or supply it as an external input.');
  if (note) notes.push(note);
  return makeResult(
    ctx.period,
    {
      id: 'operating-cash-flow-ratio',
      name: 'Operating Cash Flow Ratio',
      category: 'liquidity',
      unit: 'times',
      formula: 'Operating Cash Flow Ratio = Operating Cash Flow / Current Liabilities',
    },
    {
      value,
      substitution: `${formatNumber(ocf.value)} (Operating Cash Flow) / ${formatNumber(cl.value)} (Total Current Liabilities)`,
      steps: [
        { label: 'Operating Cash Flow', expression: formatNumber(ocf.value), value: ocf.value, unit: 'currency' },
        { label: 'Total Current Liabilities', expression: formatNumber(cl.value), value: cl.value, unit: 'currency' },
        {
          label: 'Operating Cash Flow Ratio',
          expression: `${formatNumber(ocf.value)} / ${formatNumber(cl.value)}`,
          value,
          unit: 'times',
        },
      ],
      inputs: [ocf, cl.input],
      notes,
    }
  );
}

function fiscalYearOf(period: string): string | null {
  const match = /(19|20)\d{2}/.exec(period);
  return match ? match[0] : null;
}

function trailingTwelveMonthNetIncome(ctx: RatioContext): ResolvedValue & { trailing: boolean; note?: string } {
  if (ctx.supplemental.netIncomeBasis !== 'trailing') {
    return { ...ctx.incomeInput('net_income'), trailing: false };
  }

  const override = toNumber(ctx.supplemental.netIncomeTrailing12Months);
  if (override !== null) {
    return {
      value: override,
      input: ctx.external(
        'netIncomeTrailing12Months',
        'Net Income (trailing 12 months)',
        ctx.supplemental.netIncomeTrailing12Months,
        `${INCOME_SOURCE} (supplied trailing 12 months)`
      ),
      fallback: false,
      trailing: true,
    };
  }

  const current = ctx.incomeValue('net_income');
  const prior = ctx.priorPeriod ? ctx.incomeValue('net_income', ctx.priorPeriod) : null;
  const priorYear = ctx.priorPeriod ? fiscalYearOf(ctx.priorPeriod) : null;
  const annual = priorYear ? ctx.annualNetIncome[priorYear] : undefined;

  if (current !== null && prior !== null && annual && ctx.priorPeriod) {
    const ttm = round(annual.value + current - prior);
    return {
      value: ttm,
      input: ctx.external(
        'netIncomeTrailing12Months',
        'Net Income (trailing 12 months)',
        ttm,
        `Trailing 12 months = FY${priorYear} ${formatNumber(annual.value)} + ${ctx.period} ${formatNumber(current)} \u2212 ${ctx.priorPeriod} ${formatNumber(prior)} (${annual.source})`
      ),
      fallback: false,
      trailing: true,
    };
  }

  return {
    ...ctx.incomeInput('net_income'),
    trailing: false,
    note:
      'Trailing-12-month net income could not be derived from the document and no manual override was supplied; reported period net income was used instead.',
  };
}

function ratioRoe(ctx: RatioContext): RatioResult {
  const netIncome = trailingTwelveMonthNetIncome(ctx);
  const equity = ctx.averageBalance('total_equity');
  const { value: fraction, note } = divide(netIncome.value, equity.value);
  const value = percentResult(fraction);
  const notes: string[] = [];
  if (netIncome.trailing) notes.push('Returns use the supplied trailing-12-month net income.');
  if (netIncome.note) notes.push(netIncome.note);
  if (equity.fallback) notes.push(`Average equity unavailable; fell back to period-end equity (${equity.input.source}).`);
  if (note) notes.push(note);
  return makeResult(
    ctx.period,
    {
      id: 'return-on-equity',
      name: 'Return on Equity (ROE)',
      category: 'profitability',
      unit: 'percent',
      formula: 'ROE = Net Income / Average Shareholders\u2019 Equity',
    },
    {
      value,
      substitution: `${formatNumber(netIncome.value)} (Net Income) / ${formatNumber(equity.value)} (Average Shareholders' Equity)`,
      steps: [
        { label: 'Net Income', expression: formatNumber(netIncome.value), value: netIncome.value, unit: 'currency' },
        {
          label: 'Average Shareholders\u2019 Equity',
          expression: formatNumber(equity.value),
          value: equity.value,
          unit: 'currency',
        },
        {
          label: 'ROE',
          expression: `${formatNumber(netIncome.value)} / ${formatNumber(equity.value)}`,
          value: fraction,
          unit: 'ratio',
        },
        { label: 'ROE (%)', expression: formatForUnit(value, 'percent'), value, unit: 'percent' },
      ],
      inputs: [netIncome.input, equity.input],
      notes,
      fallback: equity.fallback,
    }
  );
}

function ratioRoa(ctx: RatioContext): RatioResult {
  const netIncome = trailingTwelveMonthNetIncome(ctx);
  const assets = ctx.averageBalance('total_assets');
  const { value: fraction, note } = divide(netIncome.value, assets.value);
  const value = percentResult(fraction);
  const notes: string[] = [];
  if (netIncome.trailing) notes.push('Returns use the supplied trailing-12-month net income.');
  if (netIncome.note) notes.push(netIncome.note);
  if (assets.fallback) notes.push(`Average assets unavailable; fell back to period-end assets (${assets.input.source}).`);
  if (note) notes.push(note);
  return makeResult(
    ctx.period,
    {
      id: 'return-on-assets',
      name: 'Return on Assets (ROA)',
      category: 'profitability',
      unit: 'percent',
      formula: 'ROA = Net Income / Average Total Assets',
    },
    {
      value,
      substitution: `${formatNumber(netIncome.value)} (Net Income) / ${formatNumber(assets.value)} (Average Total Assets)`,
      steps: [
        { label: 'Net Income', expression: formatNumber(netIncome.value), value: netIncome.value, unit: 'currency' },
        { label: 'Average Total Assets', expression: formatNumber(assets.value), value: assets.value, unit: 'currency' },
        {
          label: 'ROA',
          expression: `${formatNumber(netIncome.value)} / ${formatNumber(assets.value)}`,
          value: fraction,
          unit: 'ratio',
        },
        { label: 'ROA (%)', expression: formatForUnit(value, 'percent'), value, unit: 'percent' },
      ],
      inputs: [netIncome.input, assets.input],
      notes,
      fallback: assets.fallback,
    }
  );
}

function ratioRoce(ctx: RatioContext): RatioResult {
  const ebitResult = ebit(ctx);
  const assets = ctx.balanceInput('total_assets');
  const cl = currentLiabilities(ctx);
  const capitalEmployed = subtract(assets.value, cl.value);
  const { value: fraction, note } = divide(ebitResult.value, capitalEmployed);
  const value = percentResult(fraction);
  const notes: string[] = [];
  if (ebitResult.note) notes.push(ebitResult.note);
  if (note) notes.push(note);
  return makeResult(
    ctx.period,
    {
      id: 'return-on-capital-employed',
      name: 'Return on Capital Employed (ROCE)',
      category: 'profitability',
      unit: 'percent',
      formula: 'ROCE = EBIT / Capital Employed, where Capital Employed = Total Assets \u2212 Current Liabilities',
    },
    {
      value,
      substitution:
        `${formatNumber(ebitResult.value)} (EBIT) / ${formatNumber(capitalEmployed)} (Capital Employed = ` +
        `${formatNumber(assets.value)} Total Assets \u2212 ${formatNumber(cl.value)} Current Liabilities)`,
      steps: [
        { label: 'EBIT', expression: formatNumber(ebitResult.value), value: ebitResult.value, unit: 'currency' },
        {
          label: 'Capital Employed',
          expression: `${formatNumber(assets.value)} - ${formatNumber(cl.value)}`,
          value: capitalEmployed,
          unit: 'currency',
        },
        {
          label: 'ROCE',
          expression: `${formatNumber(ebitResult.value)} / ${formatNumber(capitalEmployed)}`,
          value: fraction,
          unit: 'ratio',
        },
        { label: 'ROCE (%)', expression: formatForUnit(value, 'percent'), value, unit: 'percent' },
      ],
      inputs: [...ebitResult.inputs, assets.input, cl.input],
      notes,
    }
  );
}

function marginResult(
  ctx: RatioContext,
  id: string,
  name: string,
  numeratorLabel: string,
  numerator: ResolvedValue,
  extraInputs: RatioInput[] = [],
  extraNotes: string[] = []
): RatioResult {
  const revenue = revenueInput(ctx);
  const { value: fraction, note } = divide(numerator.value, revenue.value);
  const value = percentResult(fraction);
  const notes = [...extraNotes];
  if (note) notes.push(note);
  return makeResult(
    ctx.period,
    { id, name, category: 'profitability', unit: 'percent', formula: `${name} = ${numeratorLabel} / Revenue` },
    {
      value,
      substitution: `${formatNumber(numerator.value)} (${numeratorLabel}) / ${formatNumber(revenue.value)} (Revenue)`,
      steps: [
        { label: numeratorLabel, expression: formatNumber(numerator.value), value: numerator.value, unit: 'currency' },
        { label: 'Revenue', expression: formatNumber(revenue.value), value: revenue.value, unit: 'currency' },
        {
          label: name,
          expression: `${formatNumber(numerator.value)} / ${formatNumber(revenue.value)}`,
          value: fraction,
          unit: 'ratio',
        },
        { label: `${name} (%)`, expression: formatForUnit(value, 'percent'), value, unit: 'percent' },
      ],
      inputs: [numerator.input, revenue.input, ...extraInputs],
      notes,
    }
  );
}

function ratioGrossMargin(ctx: RatioContext): RatioResult {
  const grossProfit = ctx.incomeInput('gross_profit');
  const revenue = revenueInput(ctx);
  const cogs = ctx.incomeInput('cost_of_goods_sold');
  if (grossProfit.value !== null) {
    return marginResult(ctx, 'gross-margin', 'Gross Margin', 'Gross Profit', grossProfit);
  }
  if (revenue.value !== null && cogs.value !== null) {
    const derived = add(revenue.value, -cogs.value);
    const resolved: ResolvedValue = {
      value: derived,
      input: valueInput(
        'gross_profit',
        `Gross Profit (derived)`,
        derived,
        'currency',
        `${INCOME_SOURCE} (Revenue \u2212 COGS)`,
        ctx.period
      ),
      fallback: false,
    };
    return marginResult(
      ctx,
      'gross-margin',
      'Gross Margin',
      'Gross Profit (derived as Revenue \u2212 COGS)',
      resolved,
      [cogs.input],
      ['Gross Profit line not reported; derived from Revenue \u2212 Cost of Goods Sold.']
    );
  }
  return marginResult(ctx, 'gross-margin', 'Gross Margin', 'Gross Profit', grossProfit);
}

function ratioOperatingMargin(ctx: RatioContext): RatioResult {
  const operating = operatingIncome(ctx);
  const resolved: ResolvedValue = {
    value: operating.value,
    input: valueInput('operating_income', 'Operating Income', operating.value, 'currency', INCOME_SOURCE, ctx.period),
    fallback: false,
  };
  return marginResult(
    ctx,
    'operating-margin',
    'Operating Margin',
    'Operating Income',
    resolved,
    operating.inputs,
    operating.note ? [operating.note] : []
  );
}

function ratioNetProfitMargin(ctx: RatioContext): RatioResult {
  return marginResult(ctx, 'net-profit-margin', 'Net Profit Margin', 'Net Income', ctx.incomeInput('net_income'));
}

function ratioDebtToEquity(ctx: RatioContext): RatioResult {
  const debt = totalDebt(ctx);
  const equity = ctx.balanceInput('total_equity');
  const { value, note } = divide(debt.value, equity.value);
  const notes: string[] = [];
  if (debt.note) notes.push(debt.note);
  if (note) notes.push(note);
  return makeResult(
    ctx.period,
    {
      id: 'debt-to-equity',
      name: 'Debt-to-Equity Ratio',
      category: 'leverage',
      unit: 'times',
      formula: 'Debt-to-Equity = Total Debt / Shareholders\u2019 Equity',
    },
    {
      value,
      substitution: `${formatNumber(debt.value)} (Total Debt) / ${formatNumber(equity.value)} (Total Equity)`,
      steps: [
        { label: 'Total Debt', expression: formatNumber(debt.value), value: debt.value, unit: 'currency' },
        { label: 'Total Equity', expression: formatNumber(equity.value), value: equity.value, unit: 'currency' },
        {
          label: 'Debt-to-Equity',
          expression: `${formatNumber(debt.value)} / ${formatNumber(equity.value)}`,
          value,
          unit: 'times',
        },
      ],
      inputs: [...debt.inputs, equity.input],
      notes,
      fallback: debt.fallback,
    }
  );
}

function ratioEquityRatio(ctx: RatioContext): RatioResult {
  const equity = ctx.balanceInput('total_equity');
  const assets = ctx.balanceInput('total_assets');
  const { value: fraction, note } = divide(equity.value, assets.value);
  const value = percentResult(fraction);
  return makeResult(
    ctx.period,
    {
      id: 'equity-ratio',
      name: 'Equity Ratio',
      category: 'leverage',
      unit: 'percent',
      formula: 'Equity Ratio = Total Equity / Total Assets',
    },
    {
      value,
      substitution: `${formatNumber(equity.value)} (Total Equity) / ${formatNumber(assets.value)} (Total Assets)`,
      steps: [
        { label: 'Total Equity', expression: formatNumber(equity.value), value: equity.value, unit: 'currency' },
        { label: 'Total Assets', expression: formatNumber(assets.value), value: assets.value, unit: 'currency' },
        {
          label: 'Equity Ratio',
          expression: `${formatNumber(equity.value)} / ${formatNumber(assets.value)}`,
          value: fraction,
          unit: 'ratio',
        },
        { label: 'Equity Ratio (%)', expression: formatForUnit(value, 'percent'), value, unit: 'percent' },
      ],
      inputs: [equity.input, assets.input],
      notes: note ? [note] : [],
    }
  );
}

function ratioDebtRatio(ctx: RatioContext): RatioResult {
  const liabilities = ctx.balanceInput('total_liabilities');
  const assets = ctx.balanceInput('total_assets');
  const { value: fraction, note } = divide(liabilities.value, assets.value);
  const value = percentResult(fraction);
  return makeResult(
    ctx.period,
    {
      id: 'debt-ratio',
      name: 'Debt Ratio',
      category: 'leverage',
      unit: 'percent',
      formula: 'Debt Ratio = Total Liabilities / Total Assets',
    },
    {
      value,
      substitution: `${formatNumber(liabilities.value)} (Total Liabilities) / ${formatNumber(assets.value)} (Total Assets)`,
      steps: [
        { label: 'Total Liabilities', expression: formatNumber(liabilities.value), value: liabilities.value, unit: 'currency' },
        { label: 'Total Assets', expression: formatNumber(assets.value), value: assets.value, unit: 'currency' },
        {
          label: 'Debt Ratio',
          expression: `${formatNumber(liabilities.value)} / ${formatNumber(assets.value)}`,
          value: fraction,
          unit: 'ratio',
        },
        { label: 'Debt Ratio (%)', expression: formatForUnit(value, 'percent'), value, unit: 'percent' },
      ],
      inputs: [liabilities.input, assets.input],
      notes: note ? [note] : [],
    }
  );
}

function ratioFinancialLeverage(ctx: RatioContext): RatioResult {
  const assets = ctx.averageBalance('total_assets');
  const equity = ctx.averageBalance('total_equity');
  const { value, note } = divide(assets.value, equity.value);
  const notes: string[] = [];
  if (assets.fallback || equity.fallback) {
    notes.push('A prior period is not available, so period-end balances were used in place of averages.');
  } else {
    notes.push('Uses average assets and equity, matching the DuPont breakdown, so it can read differently from the period-end debt-to-equity and equity ratios.');
  }
  if (note) notes.push(note);
  return makeResult(
    ctx.period,
    {
      id: 'financial-leverage',
      name: 'Financial Leverage Ratio',
      category: 'leverage',
      unit: 'times',
      formula: 'Financial Leverage (Equity Multiplier) = Total Assets / Shareholders\u2019 Equity',
    },
    {
      value,
      substitution: `${formatNumber(assets.value)} (Total Assets) / ${formatNumber(equity.value)} (Shareholders\u2019 Equity)`,
      steps: [
        {
          label: assets.fallback ? 'Total Assets (period-end)' : 'Total Assets (average)',
          expression: formatNumber(assets.value),
          value: assets.value,
          unit: 'currency',
        },
        {
          label: equity.fallback ? 'Shareholders\u2019 Equity (period-end)' : 'Shareholders\u2019 Equity (average)',
          expression: formatNumber(equity.value),
          value: equity.value,
          unit: 'currency',
        },
        {
          label: 'Financial Leverage',
          expression: `${formatNumber(assets.value)} / ${formatNumber(equity.value)}`,
          value,
          unit: 'times',
        },
      ],
      inputs: [assets.input, equity.input],
      notes,
    }
  );
}

function ratioAssetToEquity(ctx: RatioContext): RatioResult {
  const assets = ctx.balanceInput('total_assets');
  const equity = ctx.balanceInput('total_equity');
  const { value, note } = divide(assets.value, equity.value);
  return makeResult(
    ctx.period,
    {
      id: 'asset-to-equity',
      name: 'Asset-to-Equity Ratio',
      category: 'leverage',
      unit: 'times',
      formula: 'Asset-to-Equity = Total Assets / Total Equity',
    },
    {
      value,
      substitution: `${formatNumber(assets.value)} (Total Assets) / ${formatNumber(equity.value)} (Total Equity)`,
      steps: [
        { label: 'Total Assets', expression: formatNumber(assets.value), value: assets.value, unit: 'currency' },
        { label: 'Total Equity', expression: formatNumber(equity.value), value: equity.value, unit: 'currency' },
        {
          label: 'Asset-to-Equity',
          expression: `${formatNumber(assets.value)} / ${formatNumber(equity.value)}`,
          value,
          unit: 'times',
        },
      ],
      inputs: [assets.input, equity.input],
      notes: note ? [note] : [],
    }
  );
}

function ratioSalesGrowth(ctx: RatioContext): RatioResult {
  const current = ctx.incomeInput('revenue');
  const prior = ctx.priorPeriod ? ctx.incomeValue('revenue', ctx.priorPeriod) : null;
  const priorInput = valueInput('revenue', 'Revenue (prior period)', prior, 'currency', INCOME_SOURCE, ctx.priorPeriod);
  const change = current.value === null || prior === null ? null : current.value - prior;
  const { value: fraction, note } = divide(change, prior);
  const value = percentResult(fraction);
  const notes: string[] = [];
  if (prior === null) notes.push('A prior period is required to compute growth; no earlier period was available.');
  if (note) notes.push(note);
  return makeResult(
    ctx.period,
    {
      id: 'sales-growth',
      name: 'Sales Growth',
      category: 'efficiency',
      unit: 'percent',
      formula: 'Sales Growth = (Current Period Revenue \u2212 Prior Period Revenue) / Prior Period Revenue',
    },
    {
      value,
      substitution: `(${formatNumber(current.value)} (Current Revenue) \u2212 ${formatNumber(prior)} (Prior Revenue)) / ${formatNumber(prior)} (Prior Revenue)`,
      steps: [
        { label: 'Current Period Revenue', expression: formatNumber(current.value), value: current.value, unit: 'currency' },
        { label: 'Prior Period Revenue', expression: formatNumber(prior), value: prior, unit: 'currency' },
        {
          label: 'Growth (fraction)',
          expression: `${formatNumber(change)} / ${formatNumber(prior)}`,
          value: fraction,
          unit: 'ratio',
        },
        { label: 'Sales Growth', expression: formatForUnit(value, 'percent'), value, unit: 'percent' },
      ],
      inputs: [current.input, priorInput],
      notes,
    }
  );
}

function ratioVolumeGrowth(ctx: RatioContext): RatioResult {
  const current = toNumber(ctx.supplemental.volumeCurrent);
  const prior = toNumber(ctx.supplemental.volumePrior);
  const currentInput = ctx.external('volumeCurrent', 'Current Period Volume', ctx.supplemental.volumeCurrent);
  const priorInput = ctx.external('volumePrior', 'Prior Period Volume', ctx.supplemental.volumePrior);
  const change = current === null || prior === null ? null : current - prior;
  const { value: fraction, note } = divide(change, prior);
  const value = percentResult(fraction);
  const notes: string[] = [];
  if (current === null || prior === null) {
    notes.push(
      'Volume (physical quantity sold) is not disclosed in financial statements; supply current and prior period volume to compute growth.'
    );
  }
  if (note) notes.push(note);
  return makeResult(
    ctx.period,
    {
      id: 'volume-growth',
      name: 'Volume Growth',
      category: 'efficiency',
      unit: 'percent',
      formula: 'Volume Growth = (Current Period Volume \u2212 Prior Period Volume) / Prior Period Volume',
    },
    {
      value,
      substitution: `(${formatNumber(current)} (Current Volume) \u2212 ${formatNumber(prior)} (Prior Volume)) / ${formatNumber(prior)} (Prior Volume)`,
      steps: [
        { label: 'Current Period Volume', expression: formatNumber(current), value: current, unit: 'currency' },
        { label: 'Prior Period Volume', expression: formatNumber(prior), value: prior, unit: 'currency' },
        {
          label: 'Growth (fraction)',
          expression: `${formatNumber(change)} / ${formatNumber(prior)}`,
          value: fraction,
          unit: 'ratio',
        },
        { label: 'Volume Growth', expression: formatForUnit(value, 'percent'), value, unit: 'percent' },
      ],
      inputs: [currentInput, priorInput],
      notes,
    }
  );
}


function turnoverResult(
  ctx: RatioContext,
  id: string,
  name: string,
  numeratorLabel: string,
  numerator: ResolvedValue,
  denominator: ResolvedValue,
  denominatorLabel: string,
  extraInputs: RatioInput[] = [],
  extraNotes: string[] = []
): RatioResult {
  const { value, note } = divide(numerator.value, denominator.value);
  const notes = [...extraNotes];
  if (denominator.fallback) notes.push(`Average ${denominatorLabel} unavailable; fell back to period-end values.`);
  if (note) notes.push(note);
  return makeResult(
    ctx.period,
    {
      id,
      name,
      category: 'efficiency',
      unit: 'times',
      formula: `${name} = ${numeratorLabel} / Average ${denominatorLabel}`,
    },
    {
      value,
      substitution: `${formatNumber(numerator.value)} (${numeratorLabel}) / ${formatNumber(denominator.value)} (Average ${denominatorLabel})`,
      steps: [
        { label: numeratorLabel, expression: formatNumber(numerator.value), value: numerator.value, unit: 'currency' },
        {
          label: `Average ${denominatorLabel}`,
          expression: formatNumber(denominator.value),
          value: denominator.value,
          unit: 'currency',
        },
        {
          label: name,
          expression: `${formatNumber(numerator.value)} / ${formatNumber(denominator.value)}`,
          value,
          unit: 'times',
        },
      ],
      inputs: [numerator.input, denominator.input, ...extraInputs],
      notes,
      fallback: denominator.fallback,
    }
  );
}

function daysResult(
  ctx: RatioContext,
  id: string,
  name: string,
  turnoverResultValue: RatioResult,
  directLabel: string
): RatioResult {
  const turnover = turnoverResultValue.value;
  const { value, note } = divide(ctx.daysInYear, turnover);
  const notes: string[] = [];
  if (turnoverResultValue.availability !== 'computed') {
    notes.push('Derived from the turnover ratio, which uses a period-end fallback for average balances.');
  }
  if (note) notes.push(note);
  return makeResult(
    ctx.period,
    {
      id,
      name,
      category: 'efficiency',
      unit: 'days',
      formula: `${name} = ${ctx.daysInYear} / ${directLabel}`,
    },
    {
      value,
      substitution: `${ctx.daysInYear} / ${formatNumber(turnover)} (${turnoverResultValue.name})`,
      steps: [
        { label: turnoverResultValue.name, expression: formatNumber(turnover), value: turnover, unit: 'times' },
        { label: name, expression: `${ctx.daysInYear} / ${formatNumber(turnover)}`, value, unit: 'days' },
      ],
      inputs: [turnoverResultValue.inputs[0], turnoverResultValue.inputs[1]].filter(Boolean) as RatioInput[],
      notes,
    }
  );
}

function ratioArTurnover(ctx: RatioContext): RatioResult {
  const revenue = revenueInput(ctx);
  const ar = ctx.averageBalance('accounts_receivable');
  const sales: ResolvedValue = {
    value: revenue.value,
    input: valueInput(
      'revenue',
      'Net Credit Sales (Revenue)',
      revenue.value,
      'currency',
      `${INCOME_SOURCE} (revenue used as net credit sales proxy)`,
      ctx.period
    ),
    fallback: false,
  };
  return turnoverResult(
    ctx,
    'ar-turnover',
    'Accounts Receivable Turnover',
    'Net Credit Sales',
    sales,
    ar,
    'Accounts Receivable',
    [],
    ['Total revenue was used as a proxy for net credit sales.']
  );
}

function ratioAssetTurnover(ctx: RatioContext): RatioResult {
  const revenue = revenueInput(ctx);
  const assets = ctx.averageBalance('total_assets');
  const sales: ResolvedValue = {
    value: revenue.value,
    input: valueInput('revenue', 'Net Sales (Revenue)', revenue.value, 'currency', INCOME_SOURCE, ctx.period),
    fallback: false,
  };
  return turnoverResult(ctx, 'asset-turnover', 'Asset Turnover', 'Net Sales', sales, assets, 'Total Assets');
}

function ratioInventoryTurnover(ctx: RatioContext): RatioResult {
  const cogs = ctx.incomeInput('cost_of_goods_sold');
  const inventory = ctx.averageBalance('inventory');
  return turnoverResult(ctx, 'inventory-turnover', 'Inventory Turnover', 'Cost of Goods Sold', cogs, inventory, 'Inventory');
}

function ratioPe(ctx: RatioContext): RatioResult {
  const suppliedEps = toNumber(ctx.supplemental.earningsPerShare);
  const netIncome = ctx.incomeInput('net_income');
  const shares = toNumber(ctx.supplemental.sharesOutstanding);
  const price = toNumber(ctx.supplemental.sharePrice);
  const marketCap = toNumber(ctx.supplemental.marketCapitalization);

  const epsInputs: RatioInput[] = [];
  let eps = suppliedEps;
  if (eps !== null) {
    epsInputs.push(ctx.external('earningsPerShare', 'Earnings Per Share', ctx.supplemental.earningsPerShare));
  } else if (netIncome.value !== null && shares !== null && shares > 0) {
    eps = round(netIncome.value / shares);
    epsInputs.push(netIncome.input, ctx.external('sharesOutstanding', 'Shares Outstanding', ctx.supplemental.sharesOutstanding));
  }

  const { value, note } = divide(price, eps);
  const notes: string[] = [];
  if (price === null) notes.push('Share price must be supplied as an external input.');
  if (eps === null) {
    notes.push(
      shares === 0
        ? 'Shares outstanding is zero; earnings per share cannot be derived.'
        : 'Earnings per share could not be determined from the statements.'
    );
  }
  if (note) notes.push(note);

  return makeResult(
    ctx.period,
    {
      id: 'pe-ratio',
      name: 'Price-to-Earnings (P/E) Ratio',
      category: 'valuation',
      unit: 'times',
      formula: 'P/E = Share Price / Earnings Per Share (EPS)',
    },
    {
      value,
      substitution: `${formatNumber(price)} (Share Price) / ${formatNumber(eps)} (EPS)`,
      steps: [
        { label: 'Share Price', expression: formatNumber(price), value: price, unit: 'currency' },
        { label: 'Earnings Per Share', expression: formatNumber(eps), value: eps, unit: 'currency' },
        { label: 'P/E Ratio', expression: `${formatNumber(price)} / ${formatNumber(eps)}`, value, unit: 'times' },
      ],
      inputs: [
        ctx.external('sharePrice', 'Share Price', ctx.supplemental.sharePrice),
        ...epsInputs,
        ...(marketCap !== null ? [ctx.external('marketCapitalization', 'Market Capitalization', ctx.supplemental.marketCapitalization)] : []),
      ],
      notes,
    }
  );
}

function enterpriseValue(ctx: RatioContext): { value: number | null; inputs: RatioInput[]; note?: string } {
  const supplied = toNumber(ctx.supplemental.enterpriseValue);
  if (supplied !== null) {
    return { value: supplied, inputs: [ctx.external('enterpriseValue', 'Enterprise Value (reported)', ctx.supplemental.enterpriseValue)] };
  }
  const marketCapSupplied = toNumber(ctx.supplemental.marketCapitalization);
  const price = toNumber(ctx.supplemental.sharePrice);
  const shares = toNumber(ctx.supplemental.sharesOutstanding);
  let marketCap = marketCapSupplied;
  const inputs: RatioInput[] = [];
  if (marketCap !== null) {
    inputs.push(ctx.external('marketCapitalization', 'Market Capitalization', ctx.supplemental.marketCapitalization));
  } else if (price !== null && shares !== null) {
    marketCap = round(price * shares);
    inputs.push(
      ctx.external('sharePrice', 'Share Price', ctx.supplemental.sharePrice),
      ctx.external('sharesOutstanding', 'Shares Outstanding', ctx.supplemental.sharesOutstanding)
    );
  }
  if (marketCap === null) return { value: null, inputs, note: 'Enterprise value requires market capitalization.' };

  const debt = totalDebt(ctx);
  const cashSupplied = toNumber(ctx.supplemental.cashAndEquivalents);
  const cash = cashSupplied !== null ? cashSupplied : ctx.balanceValue('cash_and_equivalents');
  const cashInput = cashSupplied !== null
    ? ctx.external('cashAndEquivalents', 'Cash & Cash Equivalents', ctx.supplemental.cashAndEquivalents)
    : ctx.balanceInput('cash_and_equivalents').input;
  if (debt.note) inputs.push(...debt.inputs);

  const ev = round(marketCap + (debt.value ?? 0) - (cash ?? 0));
  return {
    value: ev,
    inputs: [...inputs, ...debt.inputs, cashInput],
    note: 'Enterprise Value derived as Market Cap + Total Debt \u2212 Cash.',
  };
}

function evMultiple(
  ctx: RatioContext,
  id: string,
  name: string,
  denominatorLabel: string,
  denominator: { value: number | null; inputs: RatioInput[]; note?: string }
): RatioResult {
  const ev = enterpriseValue(ctx);
  const { value, note } = divide(ev.value, denominator.value);
  const notes: string[] = [];
  if (ev.note) notes.push(ev.note);
  if (denominator.note) notes.push(denominator.note);
  if (note) notes.push(note);
  return makeResult(
    ctx.period,
    {
      id,
      name,
      category: 'valuation',
      unit: 'times',
      formula: `${name} = Enterprise Value / ${denominatorLabel}`,
    },
    {
      value,
      substitution: `${formatNumber(ev.value)} (Enterprise Value) / ${formatNumber(denominator.value)} (${denominatorLabel})`,
      steps: [
        { label: 'Enterprise Value', expression: formatNumber(ev.value), value: ev.value, unit: 'currency' },
        { label: denominatorLabel, expression: formatNumber(denominator.value), value: denominator.value, unit: 'currency' },
        {
          label: name,
          expression: `${formatNumber(ev.value)} / ${formatNumber(denominator.value)}`,
          value,
          unit: 'times',
        },
      ],
      inputs: [...ev.inputs, ...denominator.inputs],
      notes,
    }
  );
}

function emptyCategoryMap(): Record<RatioCategory, RatioResult[]> {
  return { liquidity: [], profitability: [], leverage: [], efficiency: [], valuation: [] };
}

export function computeFinancialRatios(input: RatioEngineInput): RatioReport {
  const ctx = createContext(input);
  const ratios: RatioResult[] = [];

  ratios.push(
    ratioCurrent(ctx),
    ratioQuick(ctx),
    ratioCash(ctx),
    ratioDefensiveInterval(ctx),
    ratioTie(ctx),
    ratioTieCashBasis(ctx),
    ratioCapexToOperatingCash(ctx),
    ratioOperatingCashFlow(ctx),
    ratioRoe(ctx),
    ratioRoa(ctx),
    ratioRoce(ctx),
    ratioGrossMargin(ctx),
    ratioOperatingMargin(ctx),
    ratioNetProfitMargin(ctx),
    ratioDebtToEquity(ctx),
    ratioEquityRatio(ctx),
    ratioDebtRatio(ctx),
    ratioFinancialLeverage(ctx),
    ratioAssetToEquity(ctx)
  );

  const arTurnover = ratioArTurnover(ctx);
  ratios.push(
    arTurnover,
    daysResult(ctx, 'ar-days', 'Accounts Receivable Days', arTurnover, 'Accounts Receivable Turnover')
  );

  ratios.push(ratioAssetTurnover(ctx));

  const inventoryTurnover = ratioInventoryTurnover(ctx);
  ratios.push(
    inventoryTurnover,
    daysResult(ctx, 'inventory-days', 'Inventory Days', inventoryTurnover, 'Inventory Turnover')
  );

  ratios.push(ratioSalesGrowth(ctx), ratioVolumeGrowth(ctx));

  ratios.push(
    ratioPe(ctx),
    evMultiple(ctx, 'ev-to-ebitda', 'EV/EBITDA', 'EBITDA', ebitda(ctx)),
    evMultiple(ctx, 'ev-to-ebit', 'EV/EBIT', 'EBIT', ebit(ctx)),
    evMultiple(ctx, 'ev-to-revenue', 'EV/Revenue', 'Revenue', {
      value: revenueInput(ctx).value,
      inputs: [revenueInput(ctx).input],
    })
  );

  const byCategory = emptyCategoryMap();
  for (const ratio of ratios) byCategory[ratio.category].push(ratio);

  const unitMultiplier = ctx.balance?.unitMultiplier ?? ctx.income?.unitMultiplier ?? ctx.cashflow?.unitMultiplier ?? 1;
  const warnings = [...ctx.warnings];
  if (unitMultiplier !== 1 && Object.values(input.supplemental ?? {}).some((value) => typeof value === 'number')) {
    warnings.push(
      `Statements were normalized with a x${unitMultiplier} unit multiplier; supplemental inputs must use the same scale to stay consistent.`
    );
  }
  const unavailable = ratios.filter((ratio) => ratio.availability === 'unavailable');
  if (unavailable.length) {
    warnings.push(
      `${unavailable.length} ratio(s) could not be computed for period "${ctx.period}": ${unavailable
        .map((ratio) => ratio.name)
        .join(', ')}.`
    );
  }

  return {
    period: ctx.period,
    unitMultiplier,
    daysInYear: ctx.daysInYear,
    ratios,
    byCategory,
    warnings,
  };
}

export function computeRatiosForDocument(
  document: ParsedDocument,
  options?: RatioEngineOptions
): RatioReport {
  return computeFinancialRatios({
    statements: document.statements,
    period: options?.period,
    supplemental: options?.supplemental,
    useAverageBalances: options?.useAverageBalances,
    daysInYear: options?.daysInYear,
    annualNetIncome: document.annualNetIncome,
  });
}

export function listStatementPeriods(document: ParsedDocument): string[] {
  const rawPeriods: string[] = [];
  for (const statement of [document.statements.balance, document.statements.income, document.statements.cashflow]) {
    if (!statement) continue;
    for (const period of statement.periods) if (!rawPeriods.includes(period)) rawPeriods.push(period);
  }
  return orderPeriods(rawPeriods).ordered;
}

export function computeRatiosForAllPeriods(
  document: ParsedDocument,
  options?: RatioEngineOptions
): RatioReport[] {
  return listStatementPeriods(document).map((period) =>
    computeFinancialRatios({
      statements: document.statements,
      period,
      supplemental: options?.supplemental,
      useAverageBalances: options?.useAverageBalances,
      daysInYear: options?.daysInYear,
      annualNetIncome: document.annualNetIncome,
    })
  );
}

export const RATIO_CATEGORIES: RatioCategory[] = [
  'liquidity',
  'profitability',
  'leverage',
  'efficiency',
  'valuation',
];
