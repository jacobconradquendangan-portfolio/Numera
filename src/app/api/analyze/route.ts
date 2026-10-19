import { NextResponse } from 'next/server';
import {
  parseFinancialDocument,
  parseFinancialText,
  parseManualDocument,
  type ParsedDocument,
  type ParseManualInput,
} from '@/lib/engine/parser';
import { analyzeDocument } from '@/lib/engine/analyzer';
import { computeRatiosForDocument, computeRatiosForAllPeriods, SupplementalInputs, NumericSupplementalKey } from '@/lib/engine/ratios';
import type { AnalyzeProgressStage, AnalyzeStreamEvent } from '@/lib/analyze-stream';
import type { AnalyzeSuccess } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPPLEMENTAL_KEYS: NumericSupplementalKey[] = [
  'sharePrice',
  'sharesOutstanding',
  'earningsPerShare',
  'marketCapitalization',
  'enterpriseValue',
  'operatingCashFlow',
  'capitalExpenditures',
  'ebitda',
  'ebit',
  'totalDebt',
  'cashAndEquivalents',
  'netIncomeTrailing12Months',
  'volumeCurrent',
  'volumePrior',
];

function readSupplemental(form: FormData): SupplementalInputs {
  const supplemental: SupplementalInputs = {};
  for (const key of SUPPLEMENTAL_KEYS) {
    const raw = form.get(key);
    if (typeof raw !== 'string' || raw.trim() === '') continue;
    const value = Number(raw.replace(/[,\s]/g, ''));
    if (Number.isFinite(value)) supplemental[key] = value;
  }
  return supplemental;
}

interface PreparedAnalysis {
  file: File | null;
  text: string | null;
  manual: ParseManualInput | null;
  period?: string;
  useAverageBalances: boolean;
  daysInYear?: number;
  supplemental: SupplementalInputs;
}

type ProgressEmitter = (event: { stage: AnalyzeProgressStage; page?: number; total?: number }) => void;

async function runAnalysis(prepared: PreparedAnalysis, emit?: ProgressEmitter): Promise<AnalyzeSuccess> {
  let document: ParsedDocument;
  if (prepared.file) {
    const uploaded = prepared.file;
    const buffer = Buffer.from(await uploaded.arrayBuffer());
    emit?.({ stage: 'reading' });
    document = await parseFinancialDocument({
      data: buffer,
      filename: uploaded.name,
      mimeType: uploaded.type || undefined,
      options: {
        onProgress: (event) => emit?.({ stage: event.stage, page: event.page, total: event.total }),
      },
    });
  } else if (prepared.text) {
    emit?.({ stage: 'reading' });
    document = parseFinancialText({ text: prepared.text, filename: 'Pasted statement' });
  } else {
    emit?.({ stage: 'reading' });
    document = parseManualDocument({ ...(prepared.manual as ParseManualInput), filename: 'Manual entry' });
  }

  emit?.({ stage: 'computing' });
  const analysis = analyzeDocument(document);
  const { period, supplemental, useAverageBalances, daysInYear } = prepared;
  const ratios = computeRatiosForDocument(document, { period, supplemental, useAverageBalances, daysInYear });
  const ratioHistory = computeRatiosForAllPeriods(document, { supplemental, useAverageBalances, daysInYear });

  return { ok: true, document, analysis, ratios, ratioHistory };
}

function streamAnalysis(prepared: PreparedAnalysis): Response {
  const encoder = new TextEncoder();
  let closed = false;
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;

  const send = (event: AnalyzeStreamEvent) => {
    if (closed || !controllerRef) return;
    try {
      controllerRef.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
    } catch {
      closed = true;
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
    },
    async pull(controller) {
      controllerRef = controller;
      try {
        const payload = await runAnalysis(prepared, (event) => send({ type: 'progress', ...event }));
        send({ type: 'result', payload });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to parse the uploaded document.';
        send({ type: 'error', error: message });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed by cancellation */
        }
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: 'Expected multipart/form-data upload.' }, { status: 400 });
  }

  const file = form.get('file');
  const text = form.get('text');
  const manualRaw = form.get('manual');

  const hasFile = file instanceof File && file.size > 0;
  const hasText = typeof text === 'string' && text.trim() !== '';
  const hasManual = typeof manualRaw === 'string' && manualRaw.trim() !== '';

  if (!hasFile && !hasText && !hasManual) {
    return NextResponse.json({ ok: false, error: 'Provide a file, pasted statement text, or manual line items.' }, { status: 400 });
  }

  const period = typeof form.get('period') === 'string' && form.get('period') ? String(form.get('period')) : undefined;
  const useAverageBalances = String(form.get('useAverageBalances') ?? 'true') !== 'false';
  const daysRaw = String(form.get('daysInYear') ?? '');
  const daysInYear = daysRaw === '360' ? 360 : daysRaw === '365' ? 365 : undefined;
  const supplemental = readSupplemental(form);
  const basisRaw = String(form.get('netIncomeBasis') ?? '');
  if (basisRaw === 'trailing' || basisRaw === 'period') supplemental.netIncomeBasis = basisRaw;

  let manual: ParseManualInput | null = null;
  if (hasManual) {
    try {
      const parsed = JSON.parse(String(manualRaw));
      manual = Array.isArray(parsed) ? { statements: parsed } : (parsed as ParseManualInput);
    } catch {
      return NextResponse.json({ ok: false, error: 'Manual entry payload was not valid JSON.' }, { status: 400 });
    }
  }

  const prepared: PreparedAnalysis = {
    file: hasFile ? (file as File) : null,
    text: hasText ? String(text) : null,
    manual,
    period,
    useAverageBalances,
    daysInYear,
    supplemental,
  };

  const wantsStream = (request.headers.get('accept') ?? '').includes('application/x-ndjson');
  if (wantsStream) return streamAnalysis(prepared);

  try {
    return NextResponse.json(await runAnalysis(prepared));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse the uploaded document.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
