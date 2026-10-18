import { describe, expect, it } from 'vitest';
import { DEFAULT_HEAT_IDS, DEFAULT_TREND_IDS, defaultDashboardState, movementTone, ratioFavoursUp, ratioVerdict } from '@/lib/dashboard';

describe('dashboard defaults', () => {
  it('starts both trends and heat table with no series picked', () => {
    expect(DEFAULT_TREND_IDS).toEqual([]);
    expect(DEFAULT_HEAT_IDS).toEqual([]);
    expect(defaultDashboardState().trendIds).toEqual([]);
    expect(defaultDashboardState().heatIds).toEqual([]);
  });
});

describe('ratioVerdict', () => {
  it('reads higher-is-better ratios against CFI reference levels', () => {
    expect(ratioVerdict('current-ratio', 2.4)).toBe('strong');
    expect(ratioVerdict('current-ratio', 0.8)).toBe('weak');
    expect(ratioVerdict('current-ratio', 1.5)).toBeNull();
    expect(ratioVerdict('net-profit-margin', 12)).toBe('strong');
    expect(ratioVerdict('net-profit-margin', 3)).toBe('weak');
    expect(ratioVerdict('times-interest-earned', 3.5)).toBe('strong');
    expect(ratioVerdict('times-interest-earned', 1.5)).toBe('weak');
  });

  it('reads lower-is-better ratios in the opposite direction', () => {
    expect(ratioVerdict('debt-to-equity', 0.6)).toBe('strong');
    expect(ratioVerdict('debt-to-equity', 2.5)).toBe('weak');
    expect(ratioVerdict('ar-days', 25)).toBe('strong');
    expect(ratioVerdict('ar-days', 75)).toBe('weak');
    expect(ratioVerdict('capex-to-operating-cash', 1.4)).toBe('weak');
  });

  it('leaves market multiples and missing values neutral', () => {
    expect(ratioVerdict('pe-ratio', 18)).toBeNull();
    expect(ratioVerdict('ev-to-ebitda', 9)).toBeNull();
    expect(ratioVerdict('current-ratio', null)).toBeNull();
  });
});

describe('ratioFavoursUp', () => {
  it('marks returns, liquidity and coverage as higher-is-better', () => {
    expect(ratioFavoursUp('current-ratio')).toBe(true);
    expect(ratioFavoursUp('net-profit-margin')).toBe(true);
    expect(ratioFavoursUp('defensive-interval-ratio')).toBe(true);
  });

  it('marks leverage and day counts as lower-is-better', () => {
    expect(ratioFavoursUp('debt-to-equity')).toBe(false);
    expect(ratioFavoursUp('ar-days')).toBe(false);
    expect(ratioFavoursUp('inventory-days')).toBe(false);
  });

  it('leaves market multiples without a polarity', () => {
    expect(ratioFavoursUp('pe-ratio')).toBeNull();
    expect(ratioFavoursUp('ev-to-ebitda')).toBeNull();
  });
});

describe('movementTone', () => {
  it('reads a rising higher-is-better ratio as positive', () => {
    expect(movementTone('net-profit-margin', 15.36, 13.53)).toBe('pos');
  });

  it('reads a falling lower-is-better ratio as positive', () => {
    expect(movementTone('debt-to-equity', 0.35, 0.38)).toBe('pos');
    expect(movementTone('ar-days', 49.64, 50.6)).toBe('pos');
  });

  it('reads a falling higher-is-better ratio as negative', () => {
    expect(movementTone('return-on-equity', 10, 18)).toBe('neg');
  });

  it('flags flat movement and missing data', () => {
    expect(movementTone('current-ratio', 2.4, 2.4)).toBe('flat');
    expect(movementTone('current-ratio', null, 2.4)).toBeNull();
    expect(movementTone('pe-ratio', 12, 11)).toBeNull();
  });

  it('flags a current ratio drop as negative and a rise as positive', () => {
    expect(movementTone('current-ratio', 2.39, 2.4)).toBe('neg');
    expect(movementTone('current-ratio', 2.4, 2.39)).toBe('pos');
  });

  it('stops rewarding a current ratio push beyond the healthy ceiling', () => {
    expect(movementTone('current-ratio', 2.9, 2.8)).toBe('pos');
    expect(movementTone('current-ratio', 3.4, 3.2)).toBeNull();
    expect(movementTone('current-ratio', 3.4, 4.0)).toBe('neg');
  });
});
