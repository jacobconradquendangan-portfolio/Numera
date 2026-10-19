import { describe, expect, it } from 'vitest';
import { AnalyzeStreamParser } from '@/lib/analyze-stream';
import type { AnalyzeSuccess } from '@/lib/types';

const payload = { ok: true, document: {} } as unknown as AnalyzeSuccess;

describe('AnalyzeStreamParser', () => {
  it('parses events split across chunks', () => {
    const parser = new AnalyzeStreamParser();
    expect(parser.push('{"type":"progress","stage":"rea')).toEqual([]);
    expect(parser.push('ding"}\n{"type":"progress","stage":"ocr","page":1,"total":8}\n')).toEqual([
      { type: 'progress', stage: 'reading' },
      { type: 'progress', stage: 'ocr', page: 1, total: 8 },
    ]);
  });

  it('parses multiple events in one chunk and flushes the last line', () => {
    const parser = new AnalyzeStreamParser();
    const events = parser.push(
      '{"type":"progress","stage":"computing"}\n' + JSON.stringify({ type: 'result', payload })
    );
    expect(events).toEqual([{ type: 'progress', stage: 'computing' }]);
    expect(parser.flush()).toEqual([{ type: 'result', payload }]);
  });

  it('reports an in-stream error', () => {
    const parser = new AnalyzeStreamParser();
    expect(parser.push('{"type":"error","error":"OCR failed"}\n')).toEqual([
      { type: 'error', error: 'OCR failed' },
    ]);
  });

  it('rejects corrupted lines', () => {
    const parser = new AnalyzeStreamParser();
    expect(() => parser.push('not json\n')).toThrow('The analysis stream was corrupted.');
  });

  it('rejects unknown event types', () => {
    const parser = new AnalyzeStreamParser();
    expect(() => parser.push('{"type":"mystery"}\n')).toThrow(
      'The analysis stream contained an unexpected event.'
    );
  });
});
