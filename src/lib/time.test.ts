import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseTime, formatCountdown, computeGymState, computeSportStatus, getEasternNow, DISPLAY_DAYS, getStatusConfig, splitWeekAroundToday } from './time.js';
import type { ScheduleData, DaySchedule, Activity } from './types.js';

// --- parseTime ---

describe('parseTime', () => {
  const ref = new Date(2026, 1, 16, 0, 0, 0); // frozen fixture — not a live clock, safe at describe scope

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

  it('finds cross-day open gym when no more same-day open gym', () => {
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
    // Cross-day: finds Tuesday's open gym
    expect(state.nextOpenGym?.name).toBe('Open Gym');
    expect(state.nextOpenGymDay).toBe('Tuesday');
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

// --- DISPLAY_DAYS ---

describe('DISPLAY_DAYS', () => {
  it('has 7 entries, starts with Monday, ends with Sunday', () => {
    expect(DISPLAY_DAYS).toHaveLength(7);
    expect(DISPLAY_DAYS[0].full).toBe('Monday');
    expect(DISPLAY_DAYS[6].full).toBe('Sunday');
  });

  it('each entry has full and short string properties', () => {
    for (const day of DISPLAY_DAYS) {
      expect(typeof day.full).toBe('string');
      expect(typeof day.short).toBe('string');
    }
  });

  it('short values are 3-char abbreviations of full', () => {
    for (const day of DISPLAY_DAYS) {
      expect(day.short).toHaveLength(3);
      expect(day.full.startsWith(day.short)).toBe(true);
    }
  });
});

// --- computeSportStatus ---

describe('computeSportStatus', () => {
  // No vi.useFakeTimers() needed — function accepts `now: Date` directly.

  function makeSchedule(overrides: Partial<Record<string, DaySchedule>> = {}): Record<string, DaySchedule> {
    const defaultDay: DaySchedule = {
      open: '8:00 AM',
      close: '10:00 PM',
      activities: [
        { name: 'Open Gym', start: '8:00 AM', end: '12:00 PM', isOpenGym: true },
        { name: 'Basketball', start: '12:00 PM', end: '2:00 PM', isOpenGym: false },
        { name: 'Volleyball', start: '6:00 PM', end: '8:00 PM', isOpenGym: false },
      ],
    };
    return {
      Monday: defaultDay,
      Tuesday: defaultDay,
      Wednesday: defaultDay,
      Thursday: defaultDay,
      Friday: defaultDay,
      Saturday: defaultDay,
      Sunday: defaultDay,
      ...overrides,
    };
  }

  const basketball = (name: string) => name === 'Basketball';

  it('returns active when sport is currently running', () => {
    // Monday at 1:00 PM — during Basketball 12pm-2pm
    const now = new Date(2026, 1, 16, 13, 0, 0);
    const result = computeSportStatus(makeSchedule(), basketball, now, 'Monday');

    expect(result.kind).toBe('active');
    expect(result.activity?.name).toBe('Basketball');
    expect(result.time).toBe('2:00 PM'); // ends at
  });

  it('returns upcoming-today for a session later today', () => {
    // Monday at 10:00 AM — Basketball not until 12pm
    const now = new Date(2026, 1, 16, 10, 0, 0);
    const result = computeSportStatus(makeSchedule(), basketball, now, 'Monday');

    expect(result.kind).toBe('upcoming-today');
    expect(result.time).toBe('12:00 PM');
    expect(result.day).toBeNull();
  });

  it('skips past sessions and returns the upcoming one', () => {
    // Monday at 1:30 PM — Basketball 12-2pm is current (active); skip that, Volleyball at 6pm is next
    // But with match = volleyball only, Basketball at 12pm is past by 2pm
    const volleyball = (name: string) => name === 'Volleyball';
    const now = new Date(2026, 1, 16, 14, 30, 0); // 2:30pm — Basketball ended at 2pm

    const result = computeSportStatus(makeSchedule(), volleyball, now, 'Monday');

    expect(result.kind).toBe('upcoming-today');
    expect(result.time).toBe('6:00 PM');
  });

  it('returns upcoming-week when no sessions remain today but future day has one', () => {
    // Monday at 9:00 PM — Basketball ended at 2pm, Volleyball ended at 8pm
    const now = new Date(2026, 1, 16, 21, 0, 0);
    const result = computeSportStatus(makeSchedule(), basketball, now, 'Monday');

    expect(result.kind).toBe('upcoming-week');
    expect(result.day).toBe('Tuesday');
    expect(result.time).toBe('12:00 PM');
  });

  it('upcoming-week picks the earliest future day in DISPLAY_DAYS wrap order', () => {
    // Thursday at 9pm, only Saturday has Basketball
    const thursdayOnly: DaySchedule = {
      open: '8:00 AM', close: '10:00 PM',
      activities: [{ name: 'Open Gym', start: '8:00 AM', end: '10:00 PM', isOpenGym: true }],
    };
    const withBasketball: DaySchedule = {
      open: '8:00 AM', close: '10:00 PM',
      activities: [{ name: 'Basketball', start: '10:00 AM', end: '12:00 PM', isOpenGym: false }],
    };
    const schedule: Record<string, DaySchedule> = {
      Monday: thursdayOnly,
      Tuesday: thursdayOnly,
      Wednesday: thursdayOnly,
      Thursday: thursdayOnly,
      Friday: thursdayOnly,
      Saturday: withBasketball,
      Sunday: thursdayOnly,
    };

    const now = new Date(2026, 1, 19, 21, 0, 0); // Thursday Feb 19 9pm
    const result = computeSportStatus(schedule, basketball, now, 'Thursday');

    expect(result.kind).toBe('upcoming-week');
    expect(result.day).toBe('Saturday');
  });

  it('returns none when no sessions for sport anywhere this week', () => {
    const noBasketball: DaySchedule = {
      open: '8:00 AM', close: '10:00 PM',
      activities: [{ name: 'Open Gym', start: '8:00 AM', end: '10:00 PM', isOpenGym: true }],
    };
    const allNoBasketball: Record<string, DaySchedule> = {};
    for (const d of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']) {
      allNoBasketball[d] = noBasketball;
    }

    const now = new Date(2026, 1, 16, 10, 0, 0);
    const result = computeSportStatus(allNoBasketball, basketball, now, 'Monday');

    expect(result.kind).toBe('none');
    expect(result.activity).toBeNull();
    expect(result.day).toBeNull();
    expect(result.time).toBeNull();
  });

  it('handles missing today entry gracefully — falls through to upcoming-week', () => {
    const schedule = makeSchedule();
    delete (schedule as Record<string, DaySchedule>)['Monday'];

    const now = new Date(2026, 1, 16, 10, 0, 0); // Monday, but no Monday schedule
    const result = computeSportStatus(schedule, basketball, now, 'Monday');

    expect(result.kind).toBe('upcoming-week');
    expect(result.day).toBe('Tuesday');
  });

  it('treats activity ending exactly at now as past (boundary: end <= now)', () => {
    // Monday at exactly 2:00 PM — Basketball ends at 2:00 PM
    const now = new Date(2026, 1, 16, 14, 0, 0);
    const result = computeSportStatus(makeSchedule(), basketball, now, 'Monday');

    // 2pm is the end; isActivityCurrent requires now < end, so 2pm is NOT current
    // isActivityPast requires end <= now, so 2pm IS past — skip it
    // No more Basketball today → upcoming-week Tuesday
    expect(result.kind).toBe('upcoming-week');
    expect(result.day).toBe('Tuesday');
  });
});

// --- Cross-day next open gym (tested via computeGymState) ---

describe('computeGymState cross-day open gym', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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

  function makeSchedule(overrides: Partial<Record<string, DaySchedule>> = {}): ScheduleData {
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

  it('in-use with same-day nextOpenGym: nextOpenGymDay is null', () => {
    // Monday 1pm during Basketball, next open gym at 2pm same day
    vi.setSystemTime(new Date(2026, 1, 16, 13, 0, 0));
    const state = computeGymState(makeSchedule());

    expect(state.status).toBe('in-use');
    expect(state.nextOpenGym?.start).toBe('2:00 PM');
    expect(state.nextOpenGymDay).toBeNull();
  });

  it('between activities (path #4c): no same-day open gym uses cross-day', () => {
    const noOpenGymDay: DaySchedule = {
      open: '8:00 AM',
      close: '10:00 PM',
      activities: [
        { name: 'Basketball', start: '9:00 AM', end: '11:00 AM', isOpenGym: false },
        { name: 'Volleyball', start: '1:00 PM', end: '3:00 PM', isOpenGym: false },
      ],
    };

    vi.setSystemTime(new Date(2026, 1, 16, 12, 0, 0)); // noon, in the gap
    const state = computeGymState(makeSchedule({ Monday: noOpenGymDay }));

    expect(state.status).toBe('in-use');
    expect(state.nextOpenGymDay).toBe('Tuesday');
    expect(state.nextOpenGym?.name).toBe('Open Gym');
  });

  it('skips days with no schedule', () => {
    const noOpenGymDay: DaySchedule = {
      open: '8:00 AM',
      close: '10:00 PM',
      activities: [
        { name: 'Basketball', start: '8:00 AM', end: '10:00 PM', isOpenGym: false },
      ],
    };

    vi.setSystemTime(new Date(2026, 1, 16, 14, 0, 0)); // Monday 2pm
    const schedule = makeSchedule({ Monday: noOpenGymDay });
    delete (schedule.schedule as Record<string, DaySchedule>)['Tuesday'];

    const state = computeGymState(schedule);
    expect(state.nextOpenGymDay).toBe('Wednesday');
  });

  it('skips days with no open gym activities', () => {
    const noOpenGymDay: DaySchedule = {
      open: '8:00 AM',
      close: '10:00 PM',
      activities: [
        { name: 'Basketball', start: '8:00 AM', end: '10:00 PM', isOpenGym: false },
      ],
    };

    vi.setSystemTime(new Date(2026, 1, 16, 14, 0, 0)); // Monday 2pm
    const state = computeGymState(makeSchedule({
      Monday: noOpenGymDay,
      Tuesday: noOpenGymDay,
    }));

    expect(state.nextOpenGymDay).toBe('Wednesday');
  });

  it('wraps around week (Saturday to Monday)', () => {
    const noOpenGymDay: DaySchedule = {
      open: '8:00 AM',
      close: '10:00 PM',
      activities: [
        { name: 'Basketball', start: '8:00 AM', end: '10:00 PM', isOpenGym: false },
      ],
    };

    // Saturday Feb 21 2026 at 2pm
    vi.setSystemTime(new Date(2026, 1, 21, 14, 0, 0));
    const state = computeGymState(makeSchedule({
      Saturday: noOpenGymDay,
      Sunday: noOpenGymDay,
    }));

    expect(state.nextOpenGymDay).toBe('Monday');
  });

  it('returns null when no open gym in entire schedule', () => {
    const noOpenGymDay: DaySchedule = {
      open: '8:00 AM',
      close: '10:00 PM',
      activities: [
        { name: 'Basketball', start: '8:00 AM', end: '10:00 PM', isOpenGym: false },
      ],
    };

    const allNoOpenGym: Record<string, DaySchedule> = {};
    for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']) {
      allNoOpenGym[day] = noOpenGymDay;
    }

    vi.setSystemTime(new Date(2026, 1, 16, 14, 0, 0));
    const state = computeGymState(makeSchedule(allNoOpenGym));

    expect(state.nextOpenGymDay).toBeNull();
    expect(state.nextOpenGym).toBeNull();
  });

  it('returns earliest open gym activity on the found day', () => {
    const noOpenGymDay: DaySchedule = {
      open: '8:00 AM',
      close: '10:00 PM',
      activities: [
        { name: 'Basketball', start: '8:00 AM', end: '10:00 PM', isOpenGym: false },
      ],
    };

    vi.setSystemTime(new Date(2026, 1, 16, 14, 0, 0));
    const state = computeGymState(makeSchedule({ Monday: noOpenGymDay }));

    // Tuesday's first open gym starts at 8:00 AM
    expect(state.nextOpenGym?.start).toBe('8:00 AM');
  });

  it('closed before opening: today has open gym means same-day (nextOpenGymDay null)', () => {
    // Monday 6am, today has open gym
    vi.setSystemTime(new Date(2026, 1, 16, 6, 0, 0));
    const state = computeGymState(makeSchedule());

    expect(state.status).toBe('closed');
    expect(state.nextOpenGym?.name).toBe('Open Gym');
    expect(state.nextOpenGymDay).toBeNull(); // same-day
  });

  it('closed before opening: today has NO open gym uses cross-day', () => {
    const noOpenGymDay: DaySchedule = {
      open: '8:00 AM',
      close: '10:00 PM',
      activities: [
        { name: 'Basketball', start: '8:00 AM', end: '10:00 PM', isOpenGym: false },
      ],
    };

    vi.setSystemTime(new Date(2026, 1, 16, 6, 0, 0)); // Monday 6am
    const state = computeGymState(makeSchedule({ Monday: noOpenGymDay }));

    expect(state.status).toBe('closed');
    expect(state.nextOpenGymDay).toBe('Tuesday');
    expect(state.nextOpenGym?.name).toBe('Open Gym');
  });

  it('closed after hours: cross-day lookup populates nextOpenGymDay', () => {
    // Monday 10:30pm (after close)
    vi.setSystemTime(new Date(2026, 1, 16, 22, 30, 0));
    const state = computeGymState(makeSchedule());

    expect(state.status).toBe('closed');
    expect(state.nextOpenGymDay).toBe('Tuesday');
    expect(state.nextOpenGym?.name).toBe('Open Gym');
  });

  it('closed after hours: nextOpenGymDay equals nextOpenDay when reopening day has open gym', () => {
    // Monday 10:30pm; Tuesday (nextOpenDay) has open gym
    // The reopening day itself has open gym — nextOpenGymDay should be Tuesday
    vi.setSystemTime(new Date(2026, 1, 16, 22, 30, 0));
    const state = computeGymState(makeSchedule());

    expect(state.nextOpenDay).toBe('Tuesday');
    expect(state.nextOpenGymDay).toBe('Tuesday');
    expect(state.nextOpenGym?.name).toBe('Open Gym');
  });

  it('closed after hours: nextOpenGymDay is on/after nextOpenDay (no wrap-around to current day)', () => {
    // Friday Feb 20 after close; only Friday and Saturday have schedules.
    // Saturday (nextOpenDay) has no open gym; only Friday has open gym.
    // Bug (before fix): findNextOpenGymAcrossDays('Friday') wraps at i=7 back to Friday itself
    //   → nextOpenGymDay='Friday', nextOpenDay='Saturday' — Friday visually before Saturday.
    // Fix: anchor search from Saturday; finds Friday at i=6 (next Friday, 7 days away from today).
    //   → nextOpenGymDay='Friday' still, but now via the correct calendar path.
    const saturdayNoOpenGym: DaySchedule = {
      open: '9:00 AM',
      close: '5:00 PM',
      activities: [
        { name: 'Basketball', start: '9:00 AM', end: '5:00 PM', isOpenGym: false },
      ],
    };
    const fridayOpenGym: DaySchedule = {
      open: '8:00 AM',
      close: '10:00 PM',
      activities: [
        { name: 'Open Gym', start: '2:00 PM', end: '6:00 PM', isOpenGym: true },
      ],
    };

    // Friday Feb 20, 2026 at 10:30pm (after close); only Fri+Sat have schedules
    vi.setSystemTime(new Date(2026, 1, 20, 22, 30, 0));
    const schedule = makeSchedule({ Friday: fridayOpenGym, Saturday: saturdayNoOpenGym });
    const days = schedule.schedule as Record<string, DaySchedule>;
    for (const d of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Sunday']) {
      delete days[d];
    }
    const state = computeGymState(schedule);

    expect(state.status).toBe('closed');
    expect(state.nextOpenDay).toBe('Saturday');
    // nextOpenGymDay must not be 'Friday' as-if it were TODAY (already past);
    // with fix it's found as next Friday (via search anchored from Saturday).
    expect(state.nextOpenGymDay).toBe('Friday');
    expect(state.nextOpenGym?.name).toBe('Open Gym');
  });
});

// --- computeGymState path #4a: opening-soon ---

describe('computeGymState opening-soon (path #4a)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  function makeSchedule(overrides: Partial<Record<string, DaySchedule>> = {}): ScheduleData {
    const defaultDay: DaySchedule = {
      open: '8:00 AM',
      close: '10:00 PM',
      activities: [
        { name: 'Open Gym', start: '8:00 AM', end: '12:00 PM', isOpenGym: true },
        { name: 'Basketball', start: '12:00 PM', end: '2:00 PM', isOpenGym: false },
        { name: 'Open Gym', start: '2:00 PM', end: '6:00 PM', isOpenGym: true },
      ],
    };
    return {
      scrapedAt: '2026-02-16T00:00:00Z',
      schedule: {
        Monday: defaultDay, Tuesday: defaultDay, Wednesday: defaultDay,
        Thursday: defaultDay, Friday: defaultDay, Saturday: defaultDay, Sunday: defaultDay,
        ...overrides,
      },
      notices: [],
    };
  }

  it('returns opening-soon when in gap and next activity is Open Gym', () => {
    const sched: DaySchedule = {
      open: '8:00 AM', close: '10:00 PM',
      activities: [
        { name: 'Basketball', start: '8:00 AM', end: '11:00 AM', isOpenGym: false },
        { name: 'Open Gym',   start: '1:00 PM', end: '5:00 PM',  isOpenGym: true  },
      ],
    };
    vi.setSystemTime(new Date(2026, 1, 16, 12, 0, 0)); // noon
    const state = computeGymState(makeSchedule({ Monday: sched }));
    expect(state.status).toBe('opening-soon');
    expect(state.currentActivity).toBeNull();
    expect(state.nextOpenGym?.start).toBe('1:00 PM');
    expect(state.countdownMs).toBe(60 * 60_000);
  });

  it('returns in-use (not opening-soon) when next activity is non-open-gym', () => {
    const sched: DaySchedule = {
      open: '8:00 AM', close: '10:00 PM',
      activities: [
        { name: 'Basketball', start: '8:00 AM', end: '11:00 AM', isOpenGym: false },
        { name: 'Volleyball', start: '1:00 PM', end: '3:00 PM',  isOpenGym: false },
        { name: 'Open Gym',   start: '3:00 PM', end: '7:00 PM',  isOpenGym: true  },
      ],
    };
    vi.setSystemTime(new Date(2026, 1, 16, 12, 0, 0));
    const state = computeGymState(makeSchedule({ Monday: sched }));
    expect(state.status).toBe('in-use');
    expect(state.currentActivity).toBeNull();
    expect(state.nextOpenGym?.start).toBe('3:00 PM');
  });

  it('opening-soon: nextOpenGym populated with the upcoming session', () => {
    const sched: DaySchedule = {
      open: '8:00 AM', close: '10:00 PM',
      activities: [
        { name: 'Basketball', start: '8:00 AM',  end: '10:00 AM', isOpenGym: false },
        { name: 'Open Gym',   start: '10:30 AM', end: '3:00 PM',  isOpenGym: true  },
      ],
    };
    vi.setSystemTime(new Date(2026, 1, 16, 10, 15, 0)); // 10:15 AM
    const state = computeGymState(makeSchedule({ Monday: sched }));
    expect(state.status).toBe('opening-soon');
    expect(state.nextOpenGym?.name).toBe('Open Gym');
    expect(state.nextOpenGymDay).toBeNull();
    expect(state.countdownMs).toBe(15 * 60_000);
  });
});

// --- splitWeekAroundToday ---

describe('splitWeekAroundToday', () => {
  it('Saturday → Sunday upcoming, Mon–Fri past', () => {
    const { upcoming, past } = splitWeekAroundToday('Saturday');
    expect(upcoming).toEqual(['Sunday']);
    expect(past).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  });

  it('Wednesday → Thu–Sun upcoming, Mon–Tue past', () => {
    const { upcoming, past } = splitWeekAroundToday('Wednesday');
    expect(upcoming).toEqual(['Thursday', 'Friday', 'Saturday', 'Sunday']);
    expect(past).toEqual(['Monday', 'Tuesday']);
  });

  it('Monday → all other 6 days upcoming, nothing past', () => {
    const { upcoming, past } = splitWeekAroundToday('Monday');
    expect(upcoming).toEqual(['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
    expect(past).toEqual([]);
  });

  it('Sunday → nothing upcoming, Mon–Sat all past', () => {
    const { upcoming, past } = splitWeekAroundToday('Sunday');
    expect(upcoming).toEqual([]);
    expect(past).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
  });

  it('exclude param removes day from both upcoming and past', () => {
    // Saturday, excluding Friday (a past day)
    const { upcoming, past } = splitWeekAroundToday('Saturday', 'Friday');
    expect(upcoming).toEqual(['Sunday']);
    expect(past).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday']); // Friday excluded

    // Wednesday, excluding Saturday (an upcoming day)
    const r2 = splitWeekAroundToday('Wednesday', 'Saturday');
    expect(r2.upcoming).toEqual(['Thursday', 'Friday', 'Sunday']); // Saturday excluded
    expect(r2.past).toEqual(['Monday', 'Tuesday']);
  });

  it('exclude same as today has no extra effect', () => {
    const { upcoming, past } = splitWeekAroundToday('Wednesday', 'Wednesday');
    expect(upcoming).toEqual(['Thursday', 'Friday', 'Saturday', 'Sunday']);
    expect(past).toEqual(['Monday', 'Tuesday']);
  });
});

// --- getStatusConfig ---

describe('getStatusConfig', () => {
  it('opening-soon → cssClass opening-soon, label OPEN GYM SOON', () => {
    const c = getStatusConfig('opening-soon');
    expect(c.cssClass).toBe('opening-soon');
    expect(c.label).toBe('OPEN GYM SOON');
  });
  it('available → cssClass available',  () => expect(getStatusConfig('available').cssClass).toBe('available'));
  it('in-use → cssClass in-use',        () => expect(getStatusConfig('in-use').cssClass).toBe('in-use'));
  it('closed → cssClass closed',        () => expect(getStatusConfig('closed').cssClass).toBe('closed'));
});
