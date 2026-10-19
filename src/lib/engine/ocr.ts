import type { RawTable } from './parser';
import type { SearchableWord } from './searchable-pdf';
import { tmpdir } from 'node:os';

interface OcrBBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface OcrWord {
  text: string;
  bbox?: OcrBBox;
}

interface OcrLine {
  text: string;
  bbox?: OcrBBox;
  words?: OcrWord[];
}

interface OcrPage {
  text?: string;
  blocks?: { paragraphs?: { lines?: OcrLine[] }[] }[] | null;
}

interface OcrCell {
  text: string;
  x0: number;
  x1: number;
}

interface OcrRow {
  y: number;
  cells: OcrCell[];
}

export interface OcrSourcePage {
  image: string;
  words: SearchableWord[];
}

export interface OcrResult {
  tables: RawTable[];
  warnings: string[];
  used: boolean;
  imageCount: number;
  sourcePages: OcrSourcePage[];
}

export interface OcrOptions {
  minImageBytes?: number;
  maxImages?: number;
  onProgress?: (page: number, total: number) => void;
}

const DEFAULT_MIN_IMAGE_BYTES = 60_000;
const DEFAULT_MAX_IMAGES = 24;
const YEAR_RE = /^(?:19|20)\d{2}$/;
const YEAR_PREFIX_RE = /^(?:19|20)\d{2}\b/;
const MONTH_WORD_RE =
  /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*|\bmonths?\b|\bquarter\b|\byear\b/i;

function yearOf(text: string): string | null {
  const trimmed = text.trim();
  if (YEAR_RE.test(trimmed)) return trimmed;
  if (trimmed.length <= 24 && YEAR_PREFIX_RE.test(trimmed)) return trimmed.slice(0, 4);
  return null;
}

export function extractEmbeddedJpegs(buffer: Buffer, minBytes: number, maxImages: number): Buffer[] {
  const images: Buffer[] = [];
  let index = 0;
  while (index < buffer.length - 2 && images.length < maxImages) {
    if (buffer[index] === 0xff && buffer[index + 1] === 0xd8 && buffer[index + 2] === 0xff) {
      let end = index + 2;
      while (end < buffer.length - 1 && !(buffer[end] === 0xff && buffer[end + 1] === 0xd9)) end += 1;
      const stop = end + 2;
      if (stop - index >= minBytes) images.push(buffer.subarray(index, stop));
      index = stop;
    } else {
      index += 1;
    }
  }
  return images;
}

function buildRows(page: OcrPage): { rows: string[][]; rowsX: OcrRow[] } {
  const lines: { y: number; words: { text: string; x0: number; x1: number }[] }[] = [];
  for (const block of page.blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        const words = (line.words ?? [])
          .filter((word) => word.bbox && word.text && word.text.trim())
          .map((word) => ({ text: word.text, x0: word.bbox!.x0, x1: word.bbox!.x1 }));
        if (!words.length && line.text && line.text.trim()) {
          line.text
            .trim()
            .split(/\s{2,}/)
            .forEach((part, i) => words.push({ text: part.trim(), x0: i * 1000, x1: i * 1000 + part.trim().length }));
        }
        if (words.length) lines.push({ y: line.bbox?.y0 ?? lines.length, words });
      }
    }
  }
  if (!lines.length && page.text) {
    page.text.split(/\r?\n/).forEach((text, index) => {
      if (text.trim()) lines.push({ y: index, words: [{ text, x0: 0, x1: 0 }] });
    });
  }

  const pageWidth = Math.max(1, ...lines.flatMap((line) => line.words.map((word) => word.x1)));
  const threshold = Math.max(8, pageWidth * 0.012);

  const rowsX: OcrRow[] = [];
  for (const line of [...lines].sort((a, b) => a.y - b.y)) {
    const cells: OcrCell[] = [];
    for (const word of [...line.words].sort((a, b) => a.x0 - b.x0)) {
      const last = cells[cells.length - 1];
      if (last && word.x0 - last.x1 <= threshold) {
        last.text = `${last.text} ${word.text}`;
        last.x1 = Math.max(last.x1, word.x1);
      } else {
        cells.push({ text: word.text, x0: word.x0, x1: word.x1 });
      }
    }
    const cleaned = cells.map((cell) => ({ ...cell, text: cell.text.replace(/\s+/g, ' ').trim() })).filter((cell) => cell.text);
    if (cleaned.length) rowsX.push({ y: line.y, cells: cleaned });
  }

  return { rows: rowsX.map((row) => row.cells.map((cell) => cell.text)), rowsX };
}

function scorePeriodGroup(text: string): number {
  const lower = text.toLowerCase();
  if (/jan|nine months|twelve months|year|annual|full year/.test(lower)) return 2;
  if (/jul|three months|quarter|six months|half/.test(lower)) return 1;
  return 0;
}

function resolvePeriods(rowsX: OcrRow[], pageWidth: number): string[] | undefined {
  const pad = pageWidth * 0.02;
  const window = rowsX.slice(0, 10);

  const groups: OcrCell[] = [];
  for (const row of window) {
    for (const cell of row.cells) {
      if (MONTH_WORD_RE.test(cell.text) && /to\b|\bmonths?\b|\bquarter\b|\byear\b/i.test(cell.text)) groups.push(cell);
    }
  }

  const collectYears = (minX?: number, maxX?: number): string[] => {
    const found: { year: string; x: number }[] = [];
    for (const row of window) {
      for (const cell of row.cells) {
        const year = yearOf(cell.text);
        if (!year) continue;
        const centerX = (cell.x0 + cell.x1) / 2;
        if (minX !== undefined && maxX !== undefined && (centerX < minX - pad || centerX > maxX + pad)) continue;
        found.push({ year, x: centerX });
      }
    }
    found.sort((a, b) => a.x - b.x);
    return [...new Set(found.map((entry) => entry.year))];
  };

  if (groups.length >= 2) {
    const chosen = [...groups].sort((a, b) => scorePeriodGroup(b.text) - scorePeriodGroup(a.text) || b.x0 - a.x0)[0];
    const scoped = collectYears(chosen.x0, chosen.x1);
    if (scoped.length >= 2) return scoped;
  }

  const all = collectYears();
  return all.length ? all : undefined;
}

function pageToTable(page: OcrPage, name: string): RawTable | null {
  const { rows, rowsX } = buildRows(page);
  if (!rows.length) return null;
  const pageWidth = Math.max(1, ...rowsX.flatMap((row) => row.cells.map((cell) => cell.x1)));
  const periods = resolvePeriods(rowsX, pageWidth);
  return periods && periods.length ? { name, rows, periods } : { name, rows };
}

function collectWords(page: OcrPage): SearchableWord[] {
  const words: SearchableWord[] = [];
  for (const block of page.blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        for (const word of line.words ?? []) {
          if (word.bbox && word.text && word.text.trim()) {
            words.push({ text: word.text, x0: word.bbox.x0, y0: word.bbox.y0, x1: word.bbox.x1, y1: word.bbox.y1 });
          }
        }
      }
    }
  }
  return words;
}

export async function ocrEmbeddedImages(buffer: Buffer, options?: OcrOptions): Promise<OcrResult> {
  const minBytes = options?.minImageBytes ?? DEFAULT_MIN_IMAGE_BYTES;
  const maxImages = options?.maxImages ?? DEFAULT_MAX_IMAGES;
  const images = extractEmbeddedJpegs(buffer, minBytes, maxImages);

  if (!images.length) return { tables: [], warnings: [], used: false, imageCount: 0, sourcePages: [] };

  let createWorker: typeof import('tesseract.js').createWorker;
  try {
    ({ createWorker } = await import('tesseract.js'));
  } catch {
    return {
      tables: [],
      warnings: ['Detected image-only pages, but the OCR engine (tesseract.js) is not available.'],
      used: false,
      imageCount: images.length,
      sourcePages: [],
    };
  }

  const warnings: string[] = [];
  const tables: RawTable[] = [];
  const searchablePages: { jpeg: Buffer; words: SearchableWord[] }[] = [];
  let worker: Awaited<ReturnType<typeof createWorker>> | null = null;

  options?.onProgress?.(0, images.length);
  try {
    worker = await createWorker('eng', undefined, { cachePath: tmpdir() });
    await worker.setParameters({ preserve_interword_spaces: '1' });
    for (let index = 0; index < images.length; index += 1) {
      options?.onProgress?.(index + 1, images.length);
      const { data } = await worker.recognize(images[index], {}, { text: true, blocks: true });
      const page = data as unknown as OcrPage;
      const table = pageToTable(page, `ocr image ${index + 1}`);
      if (table) tables.push(table);
      searchablePages.push({ jpeg: images[index], words: collectWords(page) });
    }
  } catch (error) {
    warnings.push(`OCR fallback failed: ${error instanceof Error ? error.message : 'unknown error'}.`);
  } finally {
    if (worker) await worker.terminate();
  }

  if (tables.length) {
    warnings.push(
      `OCR fallback read ${tables.length} image-rendered page(s); these figures are machine-recognised and may be less precise than digital text.`
    );
  }

  const sourcePages: OcrSourcePage[] = searchablePages.map((page) => ({
    image: Buffer.from(page.jpeg).toString('base64'),
    words: page.words,
  }));

  return { tables, warnings, used: true, imageCount: images.length, sourcePages };
}
