import type { SourcePageWord } from '@/lib/types';

/** Collapse a word or phrase to comparable alphanumerics (drops spaces, commas, punctuation). */
export function normalizeToken(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const MIN_TERM_LENGTH = 4;
const CURRENCY_PREFIX_RE = /^(?:php|usd|p|us)+/;

/**
 * Returns the indexes of words to highlight for the given search terms.
 * A word matches when it (or a run of consecutive words) equals a term once
 * punctuation and spacing are ignored, so both a figure ("28,213") and a
 * multi-word label ("Total current assets") are found.
 */
export function highlightWordIndexes(words: SourcePageWord[], terms: string[]): number[] {
  const termSet = new Set(terms.map(normalizeToken).filter((term) => term.length >= MIN_TERM_LENGTH));
  if (!termSet.size || !words.length) return [];

  const maxTermLength = Math.max(...[...termSet].map((term) => term.length));
  const numericTerms = new Set([...termSet].filter((term) => /\d/.test(term)));
  const tokens = words.map((word) => normalizeToken(word.text));
  const flags = new Set<number>();

  for (let start = 0; start < tokens.length; start += 1) {
    if (!tokens[start]) continue;
    let joined = '';
    for (let end = start; end < tokens.length; end += 1) {
      joined += tokens[end];
      if (!joined) continue;
      if (termSet.has(joined)) {
        for (let index = start; index <= end; index += 1) flags.add(index);
        break;
      }
      if (end === start && /\d/.test(joined)) {
        const stripped = joined.replace(CURRENCY_PREFIX_RE, '');
        if (stripped !== joined && numericTerms.has(stripped)) {
          flags.add(start);
          break;
        }
      }
      if (joined.length > maxTermLength) break;
    }
  }

  return [...flags].sort((a, b) => a - b);
}
