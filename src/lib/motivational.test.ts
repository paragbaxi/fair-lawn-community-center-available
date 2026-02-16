/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { getTimeBucket, getSeason, buildCandidatePool, pickMessage, type MessageData } from './motivational.js';

describe('getTimeBucket', () => {
  it('returns plenty for >= 120 min', () => {
    expect(getTimeBucket(120 * 60_000)).toBe('plenty');
    expect(getTimeBucket(180 * 60_000)).toBe('plenty');
  });

  it('returns good for 60–119 min', () => {
    expect(getTimeBucket(60 * 60_000)).toBe('good');
    expect(getTimeBucket(119 * 60_000)).toBe('good');
  });

  it('returns winding for 30–59 min', () => {
    expect(getTimeBucket(30 * 60_000)).toBe('winding');
    expect(getTimeBucket(59 * 60_000)).toBe('winding');
  });

  it('returns last for < 30 min', () => {
    expect(getTimeBucket(29 * 60_000)).toBe('last');
    expect(getTimeBucket(1 * 60_000)).toBe('last');
    expect(getTimeBucket(0)).toBe('last');
  });

  it('handles exact boundaries', () => {
    expect(getTimeBucket(120 * 60_000)).toBe('plenty');
    expect(getTimeBucket(119.9 * 60_000)).toBe('good');
    expect(getTimeBucket(60 * 60_000)).toBe('good');
    expect(getTimeBucket(59.9 * 60_000)).toBe('winding');
    expect(getTimeBucket(30 * 60_000)).toBe('winding');
    expect(getTimeBucket(29.9 * 60_000)).toBe('last');
  });
});

describe('getSeason', () => {
  it('returns spring for months 3–5', () => {
    expect(getSeason(3)).toBe('spring');
    expect(getSeason(4)).toBe('spring');
    expect(getSeason(5)).toBe('spring');
  });

  it('returns summer for months 6–8', () => {
    expect(getSeason(6)).toBe('summer');
    expect(getSeason(7)).toBe('summer');
    expect(getSeason(8)).toBe('summer');
  });

  it('returns fall for months 9–11', () => {
    expect(getSeason(9)).toBe('fall');
    expect(getSeason(10)).toBe('fall');
    expect(getSeason(11)).toBe('fall');
  });

  it('returns winter for months 12, 1, 2', () => {
    expect(getSeason(12)).toBe('winter');
    expect(getSeason(1)).toBe('winter');
    expect(getSeason(2)).toBe('winter');
  });
});

describe('buildCandidatePool', () => {
  const baseData: MessageData = {
    plenty: ['plenty-a', 'plenty-b'],
    good: ['good-a'],
    winding: ['winding-a'],
    last: ['last-a'],
    contextual: {
      'Monday': ['mon-msg'],
      'winter': ['winter-msg'],
      '12-25': ['xmas-msg'],
    },
  };

  it('includes base bucket messages', () => {
    const pool = buildCandidatePool(baseData, 'plenty', 'Tuesday', 6, 15);
    expect(pool).toContain('plenty-a');
    expect(pool).toContain('plenty-b');
  });

  it('adds day-of-week messages with 2x weight', () => {
    const pool = buildCandidatePool(baseData, 'good', 'Monday', 6, 15);
    const monCount = pool.filter(m => m === 'mon-msg').length;
    expect(monCount).toBe(2);
  });

  it('adds season messages with 1x weight', () => {
    const pool = buildCandidatePool(baseData, 'good', 'Tuesday', 1, 15);
    const winterCount = pool.filter(m => m === 'winter-msg').length;
    expect(winterCount).toBe(1);
  });

  it('adds date-specific messages with 3x weight', () => {
    const pool = buildCandidatePool(baseData, 'good', 'Tuesday', 12, 25);
    const xmasCount = pool.filter(m => m === 'xmas-msg').length;
    expect(xmasCount).toBe(3);
  });

  it('combines all matching contextual messages', () => {
    // Monday in winter on Dec 25
    const pool = buildCandidatePool(baseData, 'good', 'Monday', 12, 25);
    expect(pool).toContain('good-a');
    expect(pool).toContain('mon-msg');
    expect(pool).toContain('winter-msg');
    expect(pool).toContain('xmas-msg');
  });

  it('pads single-digit month/day in date key', () => {
    const data: MessageData = {
      ...baseData,
      contextual: { '01-05': ['jan5-msg'] },
    };
    const pool = buildCandidatePool(data, 'plenty', 'Monday', 1, 5);
    expect(pool).toContain('jan5-msg');
  });
});

describe('pickMessage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty string for empty pool', () => {
    expect(pickMessage([])).toBe('');
  });

  it('picks from the pool', () => {
    const pool = ['a', 'b', 'c'];
    const result = pickMessage(pool);
    expect(pool).toContain(result);
  });

  it('prefers unseen messages', () => {
    // Mark 'a' and 'b' as seen
    localStorage.setItem('flcc-seen-messages', JSON.stringify(['a', 'b']));
    const result = pickMessage(['a', 'b', 'c']);
    expect(result).toBe('c');
  });

  it('resets when all messages have been seen', () => {
    localStorage.setItem('flcc-seen-messages', JSON.stringify(['a', 'b']));
    const result = pickMessage(['a', 'b']);
    expect(['a', 'b']).toContain(result);
    // Seen set should have been cleared and then the pick added
    const seen = JSON.parse(localStorage.getItem('flcc-seen-messages')!);
    expect(seen).toHaveLength(1);
  });

  it('tracks seen messages across calls', () => {
    pickMessage(['only-one']);
    const seen = JSON.parse(localStorage.getItem('flcc-seen-messages')!);
    expect(seen).toContain('only-one');
  });
});
