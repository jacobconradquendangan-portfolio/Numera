import { describe, expect, it } from 'vitest';
import { highlightWordIndexes, normalizeToken } from '@/lib/highlight';
import type { SourcePageWord } from '@/lib/types';

function words(...texts: string[]): SourcePageWord[] {
  return texts.map((text, index) => ({ text, x0: index * 10, y0: 0, x1: index * 10 + 8, y1: 8 }));
}

describe('normalizeToken', () => {
  it('strips punctuation and spaces case-insensitively', () => {
    expect(normalizeToken('Total Current Assets')).toBe('totalcurrentassets');
    expect(normalizeToken('28,213')).toBe('28213');
  });
});

describe('highlightWordIndexes', () => {
  it('matches a figure token ignoring commas', () => {
    expect(highlightWordIndexes(words('Cash', '28,213', '18,540'), ['28,213'])).toEqual([1]);
  });

  it('matches a multi-word label across consecutive words', () => {
    expect(highlightWordIndexes(words('Total', 'Current', 'Assets', '5,000'), ['Total Current Assets'])).toEqual([0, 1, 2]);
  });

  it('returns nothing when no term matches', () => {
    expect(highlightWordIndexes(words('Cash', '28,213'), ['Total Liabilities'])).toEqual([]);
  });

  it('ignores very short terms', () => {
    expect(highlightWordIndexes(words('Cash', 'and'), ['and'])).toEqual([]);
  });

  it('prefers a single-word exact match', () => {
    expect(highlightWordIndexes(words('Cash', 'Equivalents'), ['Cash'])).toEqual([0]);
  });
});
