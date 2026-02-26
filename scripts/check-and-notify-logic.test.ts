import { describe, it, expect } from 'vitest';
import {
  parseMinutes,
  findOpenGymSlot,
  findSportSlots,
  SPORT_PATTERNS,
  THIRTY_MIN_WINDOW_MIN,
  THIRTY_MIN_WINDOW_MAX,
} from './check-and-notify-logic.mjs';

// ─── parseMinutes ─────────────────────────────────────────────────────────────

describe('parseMinutes', () => {
  it('parses AM hours', () => {
    expect(parseMinutes('9:00 AM')).toBe(540);
    expect(parseMinutes('8:30 AM')).toBe(510);
  });

  it('parses PM hours (adds 12)', () => {
    expect(parseMinutes('1:00 PM')).toBe(780);
    expect(parseMinutes('2:30 PM')).toBe(870);
    expect(parseMinutes('9:00 PM')).toBe(1260);
  });

  it('treats 12:00 PM as noon (720)', () => {
    expect(parseMinutes('12:00 PM')).toBe(720);
    expect(parseMinutes('12:30 PM')).toBe(750);
  });

  it('treats 12:00 AM as midnight (0)', () => {
    expect(parseMinutes('12:00 AM')).toBe(0);
    expect(parseMinutes('12:30 AM')).toBe(30);
  });

  it('is case-insensitive for AM/PM', () => {
    expect(parseMinutes('9:00 am')).toBe(540);
    expect(parseMinutes('9:00 pm')).toBe(1260);
  });

  it('returns null for unparseable strings', () => {
    expect(parseMinutes('')).toBeNull();
    expect(parseMinutes('9am')).toBeNull();
    expect(parseMinutes('9:00')).toBeNull();
  });
});

// ─── findOpenGymSlot ──────────────────────────────────────────────────────────

const makeOpenGym = (start: string, end = '11:00 AM') => ({
  isOpenGym: true,
  start,
  end,
  name: 'Open Gym',
});

const makeActivity = (name: string, start: string, end = '11:00 AM') => ({
  isOpenGym: false,
  start,
  end,
  name,
});

describe('findOpenGymSlot', () => {
  // nowMinutes = 9:00 AM = 540; window covers 9:20–9:45 AM
  const now = 540;

  it('returns null when no activities', () => {
    expect(findOpenGymSlot([], now)).toBeNull();
  });

  it('returns null when no open gym activities', () => {
    expect(findOpenGymSlot([makeActivity('Basketball', '9:30 AM')], now)).toBeNull();
  });

  it('returns null when open gym is too soon (diff = 19)', () => {
    expect(findOpenGymSlot([makeOpenGym('9:19 AM')], now)).toBeNull();
  });

  it('returns null when open gym is too far (diff = 46)', () => {
    expect(findOpenGymSlot([makeOpenGym('9:46 AM')], now)).toBeNull();
  });

  it('returns slot at exact lower boundary (diff = 20)', () => {
    const slot = makeOpenGym('9:20 AM');
    expect(findOpenGymSlot([slot], now)).toBe(slot);
  });

  it('returns slot at exact upper boundary (diff = 45)', () => {
    const slot = makeOpenGym('9:45 AM');
    expect(findOpenGymSlot([slot], now)).toBe(slot);
  });

  it('returns slot in the middle of window', () => {
    const slot = makeOpenGym('9:30 AM');
    expect(findOpenGymSlot([slot], now)).toBe(slot);
  });

  it('returns only the first slot when multiple open gym sessions qualify', () => {
    const first = makeOpenGym('9:25 AM');
    const second = makeOpenGym('9:35 AM');
    expect(findOpenGymSlot([first, second], now)).toBe(first);
  });

  it('ignores non-open-gym activities even if in window', () => {
    expect(findOpenGymSlot([makeActivity('Basketball', '9:30 AM')], now)).toBeNull();
  });

  it('returns null when open gym start time is unparseable', () => {
    expect(findOpenGymSlot([{ isOpenGym: true, start: 'invalid', end: '', name: 'Open Gym' }], now)).toBeNull();
  });
});

// ─── findSportSlots ───────────────────────────────────────────────────────────

describe('findSportSlots', () => {
  const now = 540; // 9:00 AM; window covers 9:20–9:45 AM

  it('returns empty array when no activities', () => {
    expect(findSportSlots([], now)).toEqual([]);
  });

  it('returns empty array when no activities in window', () => {
    expect(findSportSlots([makeActivity('Basketball', '9:00 AM')], now)).toEqual([]);
  });

  it('returns empty array for unrecognized activity names', () => {
    expect(findSportSlots([makeActivity('Zumba Class', '9:30 AM')], now)).toEqual([]);
  });

  it('skips open gym activities', () => {
    expect(findSportSlots([makeOpenGym('9:30 AM')], now)).toEqual([]);
  });

  it('matches basketball by name', () => {
    const activity = makeActivity('Basketball', '9:30 AM');
    const results = findSportSlots([activity], now);
    expect(results).toHaveLength(1);
    expect(results[0].pattern.id).toBe('basketball');
    expect(results[0].activity).toBe(activity);
  });

  it('matches table tennis and does NOT also match the tennis pattern', () => {
    const activity = makeActivity('Table Tennis', '9:30 AM');
    const results = findSportSlots([activity], now);
    const ids = results.map((r: { pattern: { id: string } }) => r.pattern.id);
    expect(ids).toContain('table-tennis');
    expect(ids).not.toContain('tennis');
  });

  it('matches standalone tennis (but not table tennis)', () => {
    const activity = makeActivity('Tennis', '9:30 AM');
    const results = findSportSlots([activity], now);
    const ids = results.map((r: { pattern: { id: string } }) => r.pattern.id);
    expect(ids).toContain('tennis');
    expect(ids).not.toContain('table-tennis');
  });

  it('deduplicates by sport ID — two sessions of the same sport yield one entry', () => {
    const a1 = makeActivity('Basketball', '9:25 AM');
    const a2 = makeActivity('Basketball', '9:35 AM');
    const results = findSportSlots([a1, a2], now);
    expect(results.filter((r: { pattern: { id: string } }) => r.pattern.id === 'basketball')).toHaveLength(1);
    expect(results[0].activity).toBe(a1); // first match wins
  });

  it('returns multiple entries for different sports in window', () => {
    const bball = makeActivity('Basketball', '9:30 AM');
    const vball = makeActivity('Volleyball', '9:35 AM');
    const results = findSportSlots([bball, vball], now);
    const ids = results.map((r: { pattern: { id: string } }) => r.pattern.id);
    expect(ids).toContain('basketball');
    expect(ids).toContain('volleyball');
    expect(results).toHaveLength(2);
  });

  it('excludes activity 19 min away (below window min)', () => {
    expect(findSportSlots([makeActivity('Basketball', '9:19 AM')], now)).toEqual([]);
  });

  it('excludes activity 46 min away (above window max)', () => {
    expect(findSportSlots([makeActivity('Basketball', '9:46 AM')], now)).toEqual([]);
  });

  it('includes activity at exact lower boundary (diff = 20)', () => {
    expect(findSportSlots([makeActivity('Basketball', '9:20 AM')], now)).toHaveLength(1);
  });

  it('includes activity at exact upper boundary (diff = 45)', () => {
    expect(findSportSlots([makeActivity('Basketball', '9:45 AM')], now)).toHaveLength(1);
  });

  it('skips activity with unparseable start time', () => {
    expect(findSportSlots([makeActivity('Basketball', 'bad-time')], now)).toEqual([]);
  });
});

// ─── SPORT_PATTERNS ───────────────────────────────────────────────────────────

describe('SPORT_PATTERNS', () => {
  it('contains all expected sport IDs', () => {
    const ids = SPORT_PATTERNS.map((p: { id: string }) => p.id);
    expect(ids).toEqual(expect.arrayContaining([
      'basketball', 'pickleball', 'table-tennis',
      'volleyball', 'badminton', 'tennis', 'youth',
    ]));
  });

  it('basketball pattern matches case-insensitively', () => {
    const p = SPORT_PATTERNS.find((p: { id: string }) => p.id === 'basketball')!;
    expect(p.test('Basketball')).toBe(true);
    expect(p.test('basketball open gym')).toBe(true);
    expect(p.test('Tennis')).toBe(false);
  });

  it('youth pattern matches "Youth Center" but not bare "Youth"', () => {
    const p = SPORT_PATTERNS.find((p: { id: string }) => p.id === 'youth')!;
    expect(p.test('Youth Center')).toBe(true);
    expect(p.test('youth center open')).toBe(true);
    expect(p.test('Youth')).toBe(false);
  });
});

// ─── constants ────────────────────────────────────────────────────────────────

describe('window constants', () => {
  it('THIRTY_MIN_WINDOW_MIN is 20', () => expect(THIRTY_MIN_WINDOW_MIN).toBe(20));
  it('THIRTY_MIN_WINDOW_MAX is 45', () => expect(THIRTY_MIN_WINDOW_MAX).toBe(45));
});
