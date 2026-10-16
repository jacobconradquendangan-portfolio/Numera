import { describe, expect, it } from 'vitest';
import { parseFinancialText } from '@/lib/engine/parser';
import { INCOME_TEXT, PASTED_TEXT } from './fixtures';

describe('pasted raw text parsing', () => {
  const document = parseFinancialText({ text: PASTED_TEXT, filename: 'Pasted statement' });

  it('splits the paste into two statement tables', () => {
    expect(document.source.format).toBe('text');
    expect(document.source.tableCount).toBe(2);
    expect(document.statements.income).not.toBeNull();
    expect(document.statements.balance).not.toBeNull();
  });

  it('reads period labels from the header row', () => {
    expect(document.statements.income!.periods).toEqual(['2025', '2024']);
    expect(document.statements.balance!.periods).toEqual(['2025', '2024']);
  });

  it('parses comma-formatted, tab-separated numbers', () => {
    const revenue = document.statements.income!.lineItems.find((line) => line.category === 'revenue');
    expect(revenue).toBeDefined();
    expect(revenue!.values).toEqual({ 2025: 1000000, 2024: 900000 });
  });

  it('classifies the income block and the balance block separately', () => {
    expect(document.statements.income!.lineItems.some((line) => line.category === 'gross_profit')).toBe(true);
    expect(document.statements.income!.lineItems.some((line) => line.category === 'total_assets')).toBe(false);
    expect(document.statements.balance!.lineItems.some((line) => line.category === 'total_assets')).toBe(true);
    expect(document.statements.balance!.lineItems.some((line) => line.category === 'revenue')).toBe(false);
  });

  it('aligns values to the correct period columns', () => {
    const cogs = document.statements.income!.lineItems.find((line) => line.category === 'cost_of_goods_sold');
    expect(cogs!.values).toEqual({ 2025: 600000, 2024: 560000 });
  });

  it('handles a single pasted statement', () => {
    const single = parseFinancialText({ text: INCOME_TEXT });
    expect(single.statements.income).not.toBeNull();
    expect(single.statements.balance).toBeNull();
  });

  it('returns an empty document for blank text', () => {
    const empty = parseFinancialText({ text: '   \n  ' });
    expect(empty.statements.income).toBeNull();
    expect(empty.statements.balance).toBeNull();
    expect(empty.warnings.some((warning) => warning.toLowerCase().includes('no tabular content'))).toBe(true);
  });
});
