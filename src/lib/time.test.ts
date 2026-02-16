import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseTime, formatCountdown, computeGymState, getEasternNow } from './time.js';
import type { ScheduleData, DaySchedule, Activity } from './types.js';

// --- parseTime ---

describe('parseTime', () => {
  const ref = new Date(2026, 1, 16, 0, 0, 0); // Feb 16, 2026 midnight

  it('parses AM times', () => {
    const result = parseTime('9:00 AM', ref);
    expect(result.getHours()).toBe(9);
    expect(result.getMinutes()).toBe(0);
  });

  it('parses PM times', () => {
    const result = parseTime('2:30 PM', ref);
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(30);
  });

  it('handles 12:00 PM (noon)', () => {
    const result = parseTime('12:00 PM', ref);
    expect(result.getHours()).toBe(12);
  });

  it('handles 12:00 AM (midnight)', () => {
    const result = parseTime('12:00 AM', ref);
    expect(result.getHours()).toBe(0);
  });

  it('handles single-digit hour', () => {
    const result = parseTime('9:05 AM', ref);
    expect(result.getHours()).toBe(9);
    expect(result.getMinutes()).toBe(5);
  });

  it('returns reference date for invalid input', () => {
    expect(parseTime('invalid', ref)).toEqual(ref);
    expect(parseTime('', ref)).toEqual(ref);
  });

  it('is case insensitive for AM/PM', () => {
    expect(parseTime('9:00 am', ref).getHours()).toBe(9);
    expect(parseTime('2:00 pm', ref).getHours()).toBe(14);
  });

  it('preserves the date of the reference', () => {
    const result = parseTime('3:00 PM', ref);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(1); // Feb
    expect(result.getDate()).toBe(16);
  });
});

// --- formatCountdown ---

describe('formatCountdown', () => {
  it('returns 0m for zero', () => {
    expect(formatCountdown(0)).toBe('0m');
  });

  it('returns 0m for negative values', () => {
    expect(formatCountdown(-1000)).toBe('0m');
  });

  it('shows seconds only under 1 minute', () => {
    expect(formatCountdown(45_000)).toBe('45s');
    expect(formatCountdown(1_000)).toBe('1s');
  });

  it('shows minutes and seconds for 1–5 minutes', () => {
    expect(formatCountdown(90_000)).toBe('1m 30s');
    expect(formatCountdown(5 * 60_000)).toBe('5m 0s');
  });

  it('shows minutes only (ceiled) for > 5 minutes', () => {
    expect(formatCountdown(6 * 60_000)).toBe('6m');
    expect(formatCountdown(5 * 60_000 + 1_000)).toBe('6m'); // 5:01 → ceil to 6m
    expect(formatCountdown(59 * 60_000)).toBe('59m');
  });

  it('shows hours and minutes for > 1 hour', () => {
    expect(formatCountdown(3600_000)).toBe('1h 0m');
    expect(formatCountdown(3600_000 + 30 * 60_000)).toBe('1h 30m');
    expect(formatCountdown(2 * 3600_000 + 15 * 60_000)).toBe('2h 15m');
  });
});

// --- computeGymState ---

describe('computeGymState', () => {
  // TZ=America/New_York is set in vitest.config.ts, so fake timers
  // make getEasternNow() return exactly what we set.

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeSchedule(overrides: Partial<Record<string, DaySchedule>> = {}): ScheduleData {
    const defaultDay: DaySchedule = {
      open: '8:00 AM',
      close: '10:00 PM',
      activities: [
        { name: 'Open Gym', start: '8:00 AM', end: '12:00 PM', isOpenGym: true },
        { name: 'Basketball', start: '12:00 PM', end: '2:00 PM', isOpenGym: false },
        { name: 'Open Gym', start: '2:00 PM', end: '6:00 PM', isOpenGym: true },
        { name: 'Volleyball', start: '6:00 PM', end: '8:00 PM', isOpenGym: false },
        { name: 'Open Gym', start: '8:00 PM', end: '10:00 PM', isOpenGym: true },
      ],
    };

    return {
      scrapedAt: '2026-02-16T00:00:00Z',
      schedule: {
        Monday: defaultDay,
        Tuesday: defaultDay,
        Wednesday: defaultDay,
        Thursday: defaultDay,
        Friday: defaultDay,
        Saturday: defaultDay,
        Sunday: defaultDay,
        ...overrides,
      },
      notices: [],
    };
  }

  it('returns available during Open Gym', () => {
    // Monday Feb 16 2026 at 10:00 AM (during first Open Gym 8am-12pm)
    vi.setSystemTime(new Date(2026, 1, 16, 10, 0, 0));
    const state = computeGymState(makeSchedule());

    expect(state.status).toBe('available');
    expect(state.currentActivity?.name).toBe('Open Gym');
    expect(state.countdownMs).toBe(2 * 3600_000); // 2h until noon
    expect(state.countdownLabel).toBe('until 12:00 PM');
  });

  it('returns in-use during scheduled activity', () => {
    // Monday at 1:00 PM (during Basketball 12pm-2pm)
    vi.setSystemTime(new Date(2026, 1, 16, 13, 0, 0));
    const state = computeGymState(makeSchedule());

    expect(state.status).toBe('in-use');
    expect(state.currentActivity?.name).toBe('Basketball');
    expect(state.nextOpenGym?.name).toBe('Open Gym');
    expect(state.nextOpenGym?.start).toBe('2:00 PM');
  });

  it('countdown during in-use points to next open gym', () => {
    // Monday at 1:00 PM — next open gym is at 2:00 PM
    vi.setSystemTime(new Date(2026, 1, 16, 13, 0, 0));
    const state = computeGymState(makeSchedule());

    expect(state.countdownMs).toBe(3600_000); // 1h until 2pm
  });

  it('returns closed before opening hours', () => {
    // Monday at 6:00 AM (before 8am open)
    vi.setSystemTime(new Date(2026, 1, 16, 6, 0, 0));
    const state = computeGymState(makeSchedule());

    expect(state.status).toBe('closed');
    expect(state.nextOpenDay).toBe('Monday');
    expect(state.nextOpenTime).toBe('8:00 AM');
    expect(state.countdownMs).toBe(2 * 3600_000); // 2h until 8am
  });

  it('returns closed after closing hours', () => {
    // Monday at 10:30 PM (after 10pm close)
    vi.setSystemTime(new Date(2026, 1, 16, 22, 30, 0));
    const state = computeGymState(makeSchedule());

    expect(state.status).toBe('closed');
    expect(state.nextOpenDay).toBe('Tuesday');
    expect(state.nextOpenTime).toBe('8:00 AM');
  });

  it('returns closed for day with no schedule', () => {
    vi.setSystemTime(new Date(2026, 1, 16, 12, 0, 0)); // Monday noon
    const schedule = makeSchedule();
    delete (schedule.schedule as Record<string, DaySchedule>)['Monday'];
    const state = computeGymState(schedule);

    expect(state.status).toBe('closed');
    expect(state.todaySchedule).toBeNull();
    expect(state.nextOpenDay).toBe('Tuesday');
  });

  it('handles gap between activities', () => {
    // Schedule with a gap: activity ends at 11am, next starts at 1pm
    const gapSchedule: DaySchedule = {
      open: '8:00 AM',
      close: '10:00 PM',
      activities: [
        { name: 'Basketball', start: '8:00 AM', end: '11:00 AM', isOpenGym: false },
        { name: 'Open Gym', start: '1:00 PM', end: '5:00 PM', isOpenGym: true },
      ],
    };

    vi.setSystemTime(new Date(2026, 1, 16, 12, 0, 0)); // Monday noon (in the gap)
    const state = computeGymState(makeSchedule({ Monday: gapSchedule }));

    // In a gap, the code finds the next activity
    expect(state.nextOpenGym?.start).toBe('1:00 PM');
    expect(state.countdownMs).toBe(3600_000); // 1h until 1pm
  });

  it('includes todaySchedule in all states', () => {
    vi.setSystemTime(new Date(2026, 1, 16, 10, 0, 0));
    const state = computeGymState(makeSchedule());
    expect(state.todaySchedule).not.toBeNull();
    expect(state.todaySchedule!.activities.length).toBeGreaterThan(0);
  });

  it('includes dayName in all states', () => {
    vi.setSystemTime(new Date(2026, 1, 16, 10, 0, 0)); // Monday
    const state = computeGymState(makeSchedule());
    expect(state.dayName).toBe('Monday');
  });

  it('returns available for second Open Gym slot', () => {
    // Monday at 3:00 PM (during second Open Gym 2pm-6pm)
    vi.setSystemTime(new Date(2026, 1, 16, 15, 0, 0));
    const state = computeGymState(makeSchedule());

    expect(state.status).toBe('available');
    expect(state.countdownMs).toBe(3 * 3600_000); // 3h until 6pm
  });

  it('reports no more open gym when last activity is not open gym', () => {
    const noTrailingOpen: DaySchedule = {
      open: '8:00 AM',
      close: '10:00 PM',
      activities: [
        { name: 'Open Gym', start: '8:00 AM', end: '12:00 PM', isOpenGym: true },
        { name: 'Basketball', start: '12:00 PM', end: '10:00 PM', isOpenGym: false },
      ],
    };

    vi.setSystemTime(new Date(2026, 1, 16, 14, 0, 0)); // 2pm during basketball
    const state = computeGymState(makeSchedule({ Monday: noTrailingOpen }));

    expect(state.status).toBe('in-use');
    expect(state.nextOpenGym).toBeNull();
  });

  it('finds next open day when multiple days have no schedule', () => {
    vi.setSystemTime(new Date(2026, 1, 16, 12, 0, 0)); // Monday
    const schedule = makeSchedule();
    const s = schedule.schedule as Record<string, DaySchedule>;
    delete s['Monday'];
    delete s['Tuesday'];
    delete s['Wednesday'];

    const state = computeGymState(schedule);
    expect(state.status).toBe('closed');
    expect(state.nextOpenDay).toBe('Thursday');
  });
});

// --- getEasternNow ---

describe('getEasternNow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a Date object', () => {
    vi.setSystemTime(new Date(2026, 1, 16, 12, 0, 0));
    const result = getEasternNow();
    expect(result).toBeInstanceOf(Date);
  });

  it('returns the faked time (TZ=America/New_York makes conversion identity)', () => {
    vi.setSystemTime(new Date(2026, 1, 16, 14, 30, 0));
    const result = getEasternNow();
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(30);
  });
});
