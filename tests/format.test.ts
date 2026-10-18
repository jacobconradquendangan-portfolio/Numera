import { describe, expect, it } from 'vitest';
import { formatUnitValue } from '@/lib/format';

describe('formatUnitValue', () => {
  it('renders ratio working answers to two decimal places', () => {
    expect(formatUnitValue(2.08, 'times')).toBe('2.08x');
    expect(formatUnitValue(2.4, 'times')).toBe('2.40x');
    expect(formatUnitValue(69.958337, 'days')).toBe('69.96 days');
    expect(formatUnitValue(40, 'percent')).toBe('40.00%');
    expect(formatUnitValue(5.217391, 'currency')).toBe('5.22');
  });

  it('keeps currency working amounts to two decimals with separators', () => {
    expect(formatUnitValue(520000, 'currency')).toBe('520,000.00');
    expect(formatUnitValue(1150, 'currency')).toBe('1,150.00');
  });

  it('renders raw decimal fractions without a percent sign', () => {
    expect(formatUnitValue(0.26853146853146854, 'ratio')).toBe('0.2685314685');
    expect(formatUnitValue(0.4, 'ratio')).toBe('0.4');
    expect(formatUnitValue(0, 'ratio')).toBe('0');
  });

  it('returns a placeholder for missing values', () => {
    expect(formatUnitValue(null, 'times')).toBe('—');
    expect(formatUnitValue(undefined, 'percent')).toBe('—');
    expect(formatUnitValue(Number.NaN, 'days')).toBe('—');
  });
});
