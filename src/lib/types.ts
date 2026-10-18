import type { ParsedDocument, StatementType } from '@/lib/engine/parser';
import type { AnalysisResult } from '@/lib/engine/analyzer';
import type { RatioReport } from '@/lib/engine/ratios';

export type {
  ParsedDocument,
  NormalizedStatement,
  NormalizedLineItem,
  BalanceSheetValidation,
  StatementType,
  FinancialCategory,
  Section,
} from '@/lib/engine/parser';

export type {
  AnalysisResult,
  VerticalAnalysis,
  VerticalAnalysisEntry,
  HorizontalAnalysis,
  HorizontalAnalysisEntry,
  HorizontalChange,
} from '@/lib/engine/analyzer';

export type {
  RatioReport,
  RatioResult,
  RatioCategory,
  RatioInput,
  RatioStep,
  RatioUnit,
  RatioDescription,
  RatioSource,
  RatioAvailability,
  SupplementalInputs,
  DayCountBasis,
} from '@/lib/engine/ratios';

export interface AnalyzeSuccess {
  ok: true;
  document: ParsedDocument;
  analysis: AnalysisResult;
  ratios: RatioReport;
  ratioHistory: RatioReport[];
}

export interface AnalyzeFailure {
  ok: false;
  error: string;
}

export type AnalyzeResponse = AnalyzeSuccess | AnalyzeFailure;

export interface SupplementalForm {
  sharePrice: string;
  sharesOutstanding: string;
  earningsPerShare: string;
  marketCapitalization: string;
  enterpriseValue: string;
  ebitda: string;
  ebit: string;
  totalDebt: string;
  cashAndEquivalents: string;
}

export interface CategoryOption {
  key: string;
  label: string;
  statement: StatementType;
  section: string;
}

export interface ManualLinePayload {
  label: string;
  values: string[];
}

export interface ManualStatementPayload {
  type: StatementType;
  periods: string[];
  lines: ManualLinePayload[];
}
