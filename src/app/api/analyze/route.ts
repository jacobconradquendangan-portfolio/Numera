import { NextResponse } from 'next/server';
import {
  parseFinancialDocument,
  parseFinancialText,
  parseManualDocument,
  type ParsedDocument,
  type ParseManualInput,
} from '@/lib/engine/parser';
import { analyzeDocument } from '@/lib/engine/analyzer';
import { computeRatiosForDocument, computeRatiosForAllPeriods, SupplementalInputs } from '@/lib/engine/ratios';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPPLEMENTAL_KEYS: (keyof SupplementalInputs)[] = [
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

  try {
    let document: ParsedDocument;
    if (hasFile) {
      const uploaded = file as File;
      const buffer = Buffer.from(await uploaded.arrayBuffer());
      document = await parseFinancialDocument({
        data: buffer,
        filename: uploaded.name,
        mimeType: uploaded.type || undefined,
      });
    } else if (hasText) {
      document = parseFinancialText({ text: String(text), filename: 'Pasted statement' });
    } else {
      let manual: ParseManualInput;
      try {
        const parsed = JSON.parse(String(manualRaw));
        manual = Array.isArray(parsed) ? { statements: parsed } : (parsed as ParseManualInput);
      } catch {
        return NextResponse.json({ ok: false, error: 'Manual entry payload was not valid JSON.' }, { status: 400 });
      }
      document = parseManualDocument({ ...manual, filename: 'Manual entry' });
    }

    const analysis = analyzeDocument(document);
    const ratios = computeRatiosForDocument(document, { period, supplemental, useAverageBalances, daysInYear });
    const ratioHistory = computeRatiosForAllPeriods(document, { supplemental, useAverageBalances, daysInYear });

    return NextResponse.json({ ok: true, document, analysis, ratios, ratioHistory });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse the uploaded document.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
