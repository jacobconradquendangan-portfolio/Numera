import type { AnalyzeSuccess } from '@/lib/types';

export type AnalyzeProgressStage = 'uploading' | 'reading' | 'ocr-init' | 'ocr' | 'computing';

export type AnalyzeStreamEvent =
  | { type: 'progress'; stage: AnalyzeProgressStage; page?: number; total?: number }
  | { type: 'result'; payload: AnalyzeSuccess }
  | { type: 'error'; error: string };

function isAnalyzeStreamEvent(value: unknown): value is AnalyzeStreamEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as { type?: unknown; stage?: unknown; page?: unknown; total?: unknown; payload?: unknown; error?: unknown };
  if (event.type === 'progress') {
    return (
      typeof event.stage === 'string' &&
      (event.page === undefined || typeof event.page === 'number') &&
      (event.total === undefined || typeof event.total === 'number')
    );
  }
  if (event.type === 'result') return event.payload !== undefined;
  if (event.type === 'error') return typeof event.error === 'string';
  return false;
}

function parseLine(line: string): AnalyzeStreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error('The analysis stream was corrupted.');
  }
  if (!isAnalyzeStreamEvent(parsed)) {
    throw new Error('The analysis stream contained an unexpected event.');
  }
  return parsed;
}

export class AnalyzeStreamParser {
  private buffer = '';

  push(chunk: string): AnalyzeStreamEvent[] {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';
    return lines.map(parseLine).filter((event): event is AnalyzeStreamEvent => event !== null);
  }

  flush(): AnalyzeStreamEvent[] {
    const line = this.buffer;
    this.buffer = '';
    const event = parseLine(line);
    return event ? [event] : [];
  }
}
