import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { buildSearchablePdf } from '@/lib/engine/searchable-pdf';

const JPEG_1x1 = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAA//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AfwD/2Q==',
  'base64'
);

describe('buildSearchablePdf', () => {
  it('emits a valid PDF with one page per scanned image', async () => {
    const bytes = await buildSearchablePdf([
      { jpeg: JPEG_1x1, words: [{ text: '28,213', x0: 0, y0: 0, x1: 8, y1: 8 }] },
      { jpeg: JPEG_1x1, words: [] },
    ]);

    expect(Buffer.from(bytes.subarray(0, 4)).toString()).toBe('%PDF');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getTitle()).toBe('Numera searchable source');
  });

  it('keeps a page even when no words were recognised', async () => {
    const bytes = await buildSearchablePdf([{ jpeg: JPEG_1x1, words: [] }]);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });
});
