'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import UploadZone from './UploadZone';
import PasteTextPanel from './PasteTextPanel';
import ManualEntryPanel from './ManualEntryPanel';
import type { ManualValidationState } from './ManualEntryPanel';
import VerifyView from './VerifyView';
import SupplementalPanel from './SupplementalPanel';
import DashboardTab from './DashboardTab';
import Overview from './Overview';
import InsightsPanel from './InsightsPanel';
import ChartsPanel from './ChartsPanel';
import AnalysisTables from './AnalysisTables';
import RatioAccordion from './RatioAccordion';
import ExportMenu from './ExportMenu';
import ReportDocument from './ReportDocument';
import AlertBanner from './AlertBanner';
import type { BannerItem } from './AlertBanner';
import AnalysisProgress from './AnalysisProgress';
import { AnalyzeStreamParser, type AnalyzeProgressStage } from '@/lib/analyze-stream';
import WelcomeModal from './WelcomeModal';
import type { ReportScope } from '@/lib/report';
import type {
  AnalyzeResponse,
  AnalyzeSuccess,
  DayCountBasis,
  ManualStatementPayload,
  NetIncomeBasis,
  NormalizedStatement,
  ParsedDocument,
  SourcePage,
  SupplementalForm,
} from '@/lib/types';
import { cx } from '@/lib/format';
import { buildInsights } from '@/lib/insights';
import { useManualModel } from '@/lib/manualModel';
import { SAMPLE_SUPPLEMENTAL } from '@/lib/sample';

const EMPTY_SUPPLEMENTAL: SupplementalForm = {
  sharePrice: '',
  sharesOutstanding: '',
  earningsPerShare: '',
  marketCapitalization: '',
  enterpriseValue: '',
  ebitda: '',
  ebit: '',
  totalDebt: '',
  cashAndEquivalents: '',
  netIncomeTrailing12Months: '',
  volumeCurrent: '',
  volumePrior: '',
};

type InputMode = 'upload' | 'paste' | 'manual';

type LastInput =
  | { kind: 'file'; file: File }
  | { kind: 'text'; text: string }
  | { kind: 'manual'; statements: ManualStatementPayload[] };

const MODES: { id: InputMode; label: string; beta?: boolean }[] = [
  { id: 'manual', label: 'Manual entry' },
  { id: 'paste', label: 'Paste text' },
  { id: 'upload', label: 'Upload file', beta: true },
];

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

interface ProgressState {
  stage: AnalyzeProgressStage;
  page?: number;
  total?: number;
  startedAt: number;
}

const ANALYSIS_TIMEOUT_MS = 320_000;

function analysisErrorMessage(response: Response, serverError?: string): string {
  if (response.status === 413) {
    return "This file is larger than the server's 4.5 MB upload limit. Try a smaller or statement-only PDF.";
  }
  if (response.status === 502 || response.status === 503 || response.status === 504) {
    return 'The analysis timed out on the server. Scanned PDFs can take a while; try a smaller or statement-only PDF.';
  }
  if (serverError) return serverError;
  return `The analysis service returned an unexpected response (${response.status}).`;
}

export default function AnalyzerApp() {
  const [result, setResult] = useState<AnalyzeSuccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [mode, setMode] = useState<InputMode>('manual');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [supplemental, setSupplemental] = useState<SupplementalForm>(EMPTY_SUPPLEMENTAL);
  const [dayCountBasis, setDayCountBasis] = useState<DayCountBasis>(365);
  const [netIncomeBasis, setNetIncomeBasis] = useState<NetIncomeBasis>('period');
  const [filename, setFilename] = useState<string | undefined>(undefined);
  const [manualValidation, setManualValidation] = useState<ManualValidationState>({
    blocked: false,
    hasLines: false,
    issues: [],
  });
  const lastInputRef = useRef<LastInput | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const manualModel = useManualModel();
  const [parsedBaseline, setParsedBaseline] = useState<ParsedDocument | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const pdfUrlRef = useRef<string | null>(null);
  const [searchableUrl, setSearchableUrl] = useState<string | null>(null);
  const searchableUrlRef = useRef<string | null>(null);
  const [clearTick, setClearTick] = useState(0);
  const [activeView, setActiveView] = useState<'analysis' | 'dashboard' | 'verify'>('analysis');
  const [printScope, setPrintScope] = useState<ReportScope | null>(null);

  const releaseSearchable = useCallback(() => {
    if (searchableUrlRef.current) {
      URL.revokeObjectURL(searchableUrlRef.current);
      searchableUrlRef.current = null;
    }
    setSearchableUrl(null);
  }, []);

  const releasePdf = useCallback(() => {
    if (pdfUrlRef.current) {
      URL.revokeObjectURL(pdfUrlRef.current);
      pdfUrlRef.current = null;
    }
    setPdfUrl(null);
    releaseSearchable();
  }, [releaseSearchable]);

  const loadPdf = useCallback(
    (file: File) => {
      releasePdf();
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      if (!isPdf) return;
      const url = URL.createObjectURL(file);
      pdfUrlRef.current = url;
      setPdfUrl(url);
    },
    [releasePdf]
  );

  const loadSearchablePages = useCallback(
    async (pages: SourcePage[]) => {
      if (!pages.length) return;
      try {
        const { buildSearchablePdf } = await import('@/lib/engine/searchable-pdf');
        const bytes = await buildSearchablePdf(
          pages.map((page) => ({ jpeg: decodeBase64(page.image), words: page.words }))
        );
        releaseSearchable();
        const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
        searchableUrlRef.current = url;
        setSearchableUrl(url);
      } catch {
        /* keep whatever source is already loaded */
      }
    },
    [releaseSearchable]
  );

  useEffect(() => () => releasePdf(), [releasePdf]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (!printScope) return;
    const restore = () => setPrintScope(null);
    window.addEventListener('afterprint', restore);
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => window.print());
    });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('afterprint', restore);
    };
  }, [printScope]);

  const handleManualValidation = useCallback((validation: ManualValidationState) => {
    setManualValidation(validation);
  }, []);

  const applySuccess = useCallback(
    (payload: AnalyzeSuccess) => {
      setResult(payload);
      setSelectedPeriod(payload.ratios.period);
      const parsedInput = lastInputRef.current?.kind === 'file' || lastInputRef.current?.kind === 'text';
      if (parsedInput) {
        setParsedBaseline(payload.document);
        if (payload.document.sourcePages?.length) void loadSearchablePages(payload.document.sourcePages);
        const statements = [
          payload.document.statements.income,
          payload.document.statements.balance,
          payload.document.statements.cashflow,
        ].filter((statement): statement is NormalizedStatement => statement !== null);
        if (statements.length) manualModel.applySeed(statements);
      }
    },
    [loadSearchablePages, manualModel]
  );

  const submit = useCallback(
    async (body: FormData) => {
      setLoading(true);
      setError(null);
      setProgress({ stage: 'uploading', startedAt: Date.now() });
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const timeout = window.setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);
      for (const [key, value] of Object.entries(supplemental)) {
        if (value.trim() !== '') body.append(key, value.trim());
      }
      body.append('daysInYear', String(dayCountBasis));
      body.append('netIncomeBasis', netIncomeBasis);

      const reportProgress = (event: { stage: AnalyzeProgressStage; page?: number; total?: number }) => {
        setProgress((previous) => ({
          stage: event.stage,
          page: event.page,
          total: event.total,
          startedAt: previous?.startedAt ?? Date.now(),
        }));
      };

      try {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          body,
          signal: controller.signal,
          headers: { Accept: 'application/x-ndjson' },
        });
        if (!response.ok) {
          let serverError: string | undefined;
          const failureType = response.headers.get('content-type') ?? '';
          if (failureType.includes('application/json')) {
            const failure = (await response.json()) as AnalyzeResponse;
            if (!failure.ok) serverError = failure.error;
          }
          throw new Error(analysisErrorMessage(response, serverError));
        }

        const contentType = response.headers.get('content-type') ?? '';
        if (!contentType.includes('application/x-ndjson') || !response.body) {
          const payload = (await response.json()) as AnalyzeResponse;
          if (!payload.ok) throw new Error(payload.error);
          applySuccess(payload);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const parser = new AnalyzeStreamParser();
        let payload: AnalyzeSuccess | null = null;
        let streamError: string | null = null;
        const handle = (events: ReturnType<AnalyzeStreamParser['push']>) => {
          for (const event of events) {
            if (event.type === 'progress') reportProgress(event);
            else if (event.type === 'error') streamError = event.error;
            else payload = event.payload;
          }
        };
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          handle(parser.push(decoder.decode(value, { stream: true })));
        }
        handle(parser.flush());

        if (streamError) throw new Error(streamError);
        if (!payload) {
          throw new Error('The analysis stopped before it finished. The server may have timed out; please try again.');
        }
        applySuccess(payload);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          setError('The analysis was cancelled or timed out. Please try again.');
        } else {
          setError(caught instanceof Error ? caught.message : 'Unexpected error contacting the analysis service.');
        }
        setResult(null);
      } finally {
        window.clearTimeout(timeout);
        if (abortRef.current === controller) abortRef.current = null;
        setProgress(null);
        setLoading(false);
      }
    },
    [supplemental, dayCountBasis, netIncomeBasis, applySuccess]
  );

  const handleFile = useCallback(
    (file: File) => {
      lastInputRef.current = { kind: 'file', file };
      setFilename(file.name);
      loadPdf(file);
      const body = new FormData();
      body.append('file', file);
      void submit(body);
    },
    [submit, loadPdf]
  );

  const handleText = useCallback(
    (text: string) => {
      lastInputRef.current = { kind: 'text', text };
      setFilename('Pasted statement');
      const body = new FormData();
      body.append('text', text);
      void submit(body);
    },
    [submit]
  );

  const handleManual = useCallback(
    (statements: ManualStatementPayload[]) => {
      lastInputRef.current = { kind: 'manual', statements };
      setFilename('Manual entry');
      const body = new FormData();
      body.append('manual', JSON.stringify(statements));
      void submit(body);
    },
    [submit]
  );

  const handleRecompute = useCallback(() => {
    const last = lastInputRef.current;
    if (!last) return;
    const body = new FormData();
    if (last.kind === 'file') body.append('file', last.file);
    else if (last.kind === 'text') body.append('text', last.text);
    else body.append('manual', JSON.stringify(last.statements));
    void submit(body);
  }, [submit]);

  const handleVerifyRecompute = useCallback(() => {
    const statements = manualModel.toStatements();
    if (!statements.length) return;
    lastInputRef.current = { kind: 'manual', statements };
    const body = new FormData();
    body.append('manual', JSON.stringify(statements));
    void submit(body);
  }, [manualModel, submit]);

  const handleClearAll = useCallback(() => {
    lastInputRef.current = null;
    manualModel.reset();
    releasePdf();
    setParsedBaseline(null);
    setResult(null);
    setError(null);
    setSelectedPeriod('');
    setFilename(undefined);
    setSupplemental(EMPTY_SUPPLEMENTAL);
    setDayCountBasis(365);
    setNetIncomeBasis('period');
    setActiveView('analysis');
    setClearTick((tick) => tick + 1);
  }, [manualModel, releasePdf]);

  const handleSupplementalChange = useCallback((key: keyof SupplementalForm, value: string) => {
    setSupplemental((previous) => ({ ...previous, [key]: value }));
  }, []);

  const handleSupplementalSample = useCallback(() => {
    setSupplemental({ ...SAMPLE_SUPPLEMENTAL });
  }, []);

  const periods = useMemo(() => {
    if (!result) return [];
    return (
      result.analysis.vertical.balance?.periods ??
      result.analysis.vertical.income?.periods ??
      result.analysis.vertical.cashflow?.periods ??
      [result.ratios.period]
    );
  }, [result]);

  const validation = result?.document.validations.find((item) => item.period === selectedPeriod) ?? result?.document.validations[0];

  const ratioReports = useMemo(() => {
    if (!result) return [];
    return result.ratioHistory.length ? result.ratioHistory : [result.ratios];
  }, [result]);

  const selectedReport = useMemo(
    () => ratioReports.find((report) => report.period === selectedPeriod) ?? result?.ratios ?? null,
    [ratioReports, selectedPeriod, result]
  );

  const insights = useMemo(() => {
    if (!result || !selectedReport) return null;
    return buildInsights({ report: selectedReport, history: ratioReports, analysis: result.analysis });
  }, [result, selectedReport, ratioReports]);

  const resultIssues = useMemo<{ errors: BannerItem[]; warnings: BannerItem[] }>(() => {
    if (!result) return { errors: [], warnings: [] };
    const errors: BannerItem[] = [];
    const warnings: BannerItem[] = [];
    const { income, balance, cashflow } = result.document.statements;

    if (!balance) {
      warnings.push({ label: 'No balance sheet detected.', detail: 'Liquidity and leverage ratios may be unavailable.' });
    }
    if (!income) {
      warnings.push({ label: 'No income statement detected.', detail: 'Profitability and coverage ratios may be unavailable.' });
    }
    if (!cashflow) {
      warnings.push({
        label: 'No cash flow statement detected.',
        detail: 'Operating cash flow and CAPEX ratios may be unavailable — add a cash flow statement or supply them as external inputs.',
      });
    }

    for (const entry of result.document.validations) {
      if (!entry.balanced) {
        errors.push({ label: `Balance sheet does not reconcile for ${entry.period}.`, detail: entry.message });
      }
    }

    const unrecognised = [
      ...(income?.unmappedLabels ?? []),
      ...(balance?.unmappedLabels ?? []),
      ...(cashflow?.unmappedLabels ?? []),
    ];
    if (unrecognised.length) {
      const shown = unrecognised.slice(0, 8).join(', ');
      warnings.push({
        label: `${unrecognised.length} line item${unrecognised.length === 1 ? '' : 's'} could not be matched to the taxonomy.`,
        detail: `— ${shown}${unrecognised.length > 8 ? ` (+${unrecognised.length - 8} more)` : ''}`,
      });
    }

    for (const warning of [...result.document.warnings, ...result.ratios.warnings]) {
      warnings.push({ label: warning });
    }

    return { errors, warnings };
  }, [result]);

  return (
    <>
      <div className="mx-auto w-full max-w-7xl px-5 pb-24 pt-8 sm:px-8 print:hidden">
        <header className="rise mb-10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-accentdim/60 bg-accent/5 font-display text-xl text-accent">
            N
          </span>
          <div>
            <p className="font-display text-xl leading-none text-paper">Numera</p>
            <p className="rule-label mt-1">Financial Statement Analyzer</p>
          </div>
        </div>
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-faint">
          CFI ratio engine · vertical &amp; horizontal analysis
        </p>
      </header>

      <div className="rise mb-8 max-w-3xl">
        <h1 className="font-display text-4xl leading-tight text-paper sm:text-5xl">
          Audit-grade analysis of any financial statement.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
          Upload a PDF, Excel or CSV statement, paste the numbers as text, or enter them by hand. Numera
          normalises the line items, proves that Assets = Liabilities + Equity, runs vertical and horizontal
          analysis, then computes the full CFI ratio suite — every figure backed by its formula and step-by-step
          solution.
        </p>
      </div>

      <div id="input-section" className="space-y-5 scroll-mt-6">
        <div className="rise flex flex-wrap items-center gap-2">
          <span className="rule-label mr-2">Input</span>
          {MODES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setMode(option.id)}
              className={cx(
                'inline-flex items-center gap-2 rounded-full border px-4 py-1.5 font-mono text-[0.7rem] uppercase tracking-[0.16em] transition',
                mode === option.id
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-line2 text-muted hover:border-accentdim hover:text-paper'
              )}
            >
              <span>{option.label}</span>
              {option.beta ? (
                <span className="rounded-full border border-accent/50 bg-accent/10 px-1.5 py-0.5 text-[0.5rem] leading-none tracking-[0.12em] text-accentdim">
                  Beta
                </span>
              ) : null}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClearAll}
            disabled={!result && !error && !manualValidation.hasLines}
            className={cx(
              'ml-auto rounded-full border px-3.5 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.18em] transition',
              result || error || manualValidation.hasLines
                ? 'border-line2 text-muted hover:border-neg/60 hover:text-neg'
                : 'cursor-not-allowed border-line text-faint'
            )}
          >
            Clear
          </button>
        </div>

        {mode === 'manual' && manualValidation.hasLines && manualValidation.issues.length ? (
          <AlertBanner
            tone={manualValidation.blocked ? 'error' : 'warning'}
            title={manualValidation.blocked ? 'Some entries need fixing before analysis' : 'Heads-up before you analyse'}
            description={
              manualValidation.blocked
                ? 'Analysis is blocked until the highlighted cells and duplicate periods are corrected.'
                : 'You can still analyse, but the ratios may be incomplete or the balance sheet may not reconcile.'
            }
            items={manualValidation.issues.map((entry) => ({ label: entry.title, detail: entry.detail }))}
            defaultCollapsed
          />
        ) : null}

        {result && !loading && (resultIssues.errors.length || resultIssues.warnings.length) ? (
          <div className="space-y-4">
            {resultIssues.errors.length ? (
              <AlertBanner
                tone="error"
                title={`Balance sheet does not reconcile (${resultIssues.errors.length})`}
                description="The figures are still analysed, but treat the results with caution until the balance sheet balances."
                items={resultIssues.errors}
                defaultCollapsed
              />
            ) : null}
            {resultIssues.warnings.length ? (
              <AlertBanner
                tone="warning"
                title={`${resultIssues.warnings.length} data ${resultIssues.warnings.length === 1 ? 'check' : 'checks'}`}
                description="Missing line items and data warnings are listed here so you can fix them at the source."
                items={resultIssues.warnings}
                defaultCollapsed
              />
            ) : null}
          </div>
        ) : null}

        {mode === 'upload' ? <UploadZone onFile={handleFile} busy={loading} filename={filename} /> : null}
        {mode === 'paste' ? (
          <PasteTextPanel
            onAnalyze={handleText}
            busy={loading}
            onLoadSample={() => setSupplemental({ ...SAMPLE_SUPPLEMENTAL })}
            clearSignal={clearTick}
          />
        ) : null}
        {mode === 'manual' ? <ManualEntryPanel onAnalyze={handleManual} busy={loading} onValidationChange={handleManualValidation} model={manualModel} /> : null}

        <SupplementalPanel
          values={supplemental}
          onChange={handleSupplementalChange}
          onRecompute={handleRecompute}
          onLoadSample={handleSupplementalSample}
          busy={loading}
          dayCountBasis={dayCountBasis}
          onDayCountBasisChange={setDayCountBasis}
          netIncomeBasis={netIncomeBasis}
          onNetIncomeBasisChange={setNetIncomeBasis}
        />
      </div>

      {error ? (
        <AlertBanner
          tone="error"
          title="Analysis failed"
          description={error}
          className="mt-6"
        />
      ) : null}

      {loading ? (
        <div className="mt-8 space-y-4">
          {progress ? (
            <AnalysisProgress progress={progress} onCancel={() => abortRef.current?.abort()} />
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="shimmer h-24 rounded-2xl border border-line" />
            ))}
          </div>
        </div>
      ) : null}

      {result && !loading ? (
        <div className="mt-10 space-y-14">
          <div className="sticky top-0 z-20 border-b border-line bg-ink/90 py-3 backdrop-blur">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rule-label">Period</span>
              <div className="flex flex-wrap gap-2">
                {periods.map((period) => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => setSelectedPeriod(period)}
                    className={cx(
                      'tabular rounded-full border px-4 py-1.5 text-sm transition',
                      selectedPeriod === period
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-line2 bg-panel text-muted hover:border-accentdim hover:text-paper'
                    )}
                  >
                    {period}
                  </button>
                ))}
              </div>
              {activeView === 'analysis' ? (
                <div className="ml-auto flex min-w-0 shrink items-center gap-2">
                  <span
                    title={
                      result.document.source.filename
                        ? `${result.document.source.format.toUpperCase()} · ${result.document.source.tableCount} table(s) · ${result.document.source.filename}`
                        : undefined
                    }
                    className={cx(
                      'tabular hidden min-w-0 shrink-0 text-right text-xs text-faint md:block max-w-[26rem] truncate whitespace-nowrap overflow-hidden overflow-ellipsis'
                    )}
                  >
                    {result.document.source.format.toUpperCase()}
                    {result.document.source.filename ? ` · ${result.document.source.filename}` : ''}
                  </span>
                  <ExportMenu
                    periods={periods}
                    selectedPeriod={selectedPeriod}
                    onPrint={setPrintScope}
                  />
                </div>
              ) : null}
            </div>
            <nav
              aria-label="Report sections"
              className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line/70 pt-2"
            >
              {activeView === 'analysis'
                ? (
                    [
                      ['Input', '#input-section'],
                      ['Overview', '#analysis-overview'],
                      ['Health summary', '#analysis-summary'],
                      ['Charts', '#analysis-charts'],
                      ['Statements', '#analysis-statements'],
                      ['Ratios', '#analysis-ratios'],
                    ] as const
                  ).map(([label, href]) => (
                    <a
                      key={href}
                      href={href}
                      className="rule-label transition hover:text-accent"
                    >
                      {label}
                    </a>
                  ))
                : null}
              <div className="ml-auto flex items-center gap-2">
                <span className="rule-label">View</span>
                {((['analysis', 'dashboard', ...(parsedBaseline ? ['verify'] : [])] as const) as readonly (
                  | 'analysis'
                  | 'dashboard'
                  | 'verify'
                )[]).map((view) => (
                  <button
                    key={view}
                    type="button"
                    onClick={() => setActiveView(view)}
                    className={cx(
                      'inline-flex items-center gap-2 rounded-sm border px-3 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.16em] transition',
                      activeView === view
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-line2 text-muted hover:border-accentdim hover:text-paper'
                    )}
                  >
                    <span>{view}</span>
                    {view === 'dashboard' ? (
                      <span className="rounded-sm border border-accent/50 bg-accent/10 px-1.5 py-0.5 text-[0.5rem] leading-none tracking-[0.12em] text-accentdim">
                        Beta
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </nav>
          </div>

          {activeView === 'dashboard' ? <DashboardTab result={result} selectedPeriod={selectedPeriod} /> : null}
          {activeView === 'verify' && parsedBaseline ? (
            <VerifyView
              baseline={parsedBaseline}
              model={manualModel}
              pdfUrl={pdfUrl}
              searchableUrl={searchableUrl}
              onRecompute={handleVerifyRecompute}
              busy={loading}
            />
          ) : null}
          {activeView === 'analysis' ? (
          <>

          <div id="analysis-overview" className="scroll-mt-32">
            <Overview
              validation={validation}
              income={result.document.statements.income}
              balance={result.document.statements.balance}
              cashflow={result.document.statements.cashflow}
              selectedPeriod={selectedPeriod}
              unitMultiplier={result.ratios.unitMultiplier}
            />
          </div>

          <div id="analysis-summary" className="scroll-mt-32">
            <InsightsPanel insights={insights} />
          </div>

          <div id="analysis-charts" className="scroll-mt-32">
            <ChartsPanel
              income={result.document.statements.income}
              report={selectedReport ?? result.ratios}
              reports={ratioReports}
              period={selectedPeriod}
            />
          </div>

          <section id="analysis-statements" className="scroll-mt-32 space-y-8">
            {result.analysis.vertical.income && result.analysis.horizontal.income ? (
            <AnalysisTables
              title="Income Statement"
              subtitle="Vertical (percent of revenue) & horizontal (period-over-period)"
              vertical={result.analysis.vertical.income}
              horizontal={result.analysis.horizontal.income}
              selectedPeriod={selectedPeriod}
            />
          ) : null}

          {result.analysis.vertical.balance && result.analysis.horizontal.balance ? (
            <AnalysisTables
              title="Balance Sheet"
              subtitle="Vertical (percent of total assets) & horizontal (period-over-period)"
              vertical={result.analysis.vertical.balance}
              horizontal={result.analysis.horizontal.balance}
              selectedPeriod={selectedPeriod}
            />
          ) : null}

          {result.analysis.vertical.cashflow && result.analysis.horizontal.cashflow ? (
            <AnalysisTables
              title="Cash Flow Statement"
              subtitle="Vertical (percent of operating cash flow) & horizontal (period-over-period)"
              vertical={result.analysis.vertical.cashflow}
              horizontal={result.analysis.horizontal.cashflow}
              selectedPeriod={selectedPeriod}
            />
          ) : null}
          </section>

          <section id="analysis-ratios" className="scroll-mt-32 space-y-8">
            <header className="border-b border-line pb-3">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="font-display text-3xl text-paper">CFI Financial Ratios</h2>
                  <p className="rule-label mt-1">
                    Every figure opens into its formula, substituted values and solution audit trail
                  </p>
                </div>
                <span className="rounded-sm border border-line2 px-2.5 py-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-paper">
                  Period {selectedPeriod || selectedReport?.period}
                </span>
              </div>
            </header>
            <RatioAccordion reports={ratioReports} selectedPeriod={selectedPeriod} />
          </section>
          </>
          ) : null}
        </div>
      ) : null}
      <WelcomeModal />
      </div>
      {result ? (
        <ReportDocument
          result={result}
          scope={printScope ?? 'selected'}
          selectedPeriod={selectedPeriod}
          filename={filename}
          dayCountBasis={dayCountBasis}
        />
      ) : null}
    </>
  );
}
