import { describe, it, expect } from 'vitest';
import {
  FILTER_CATEGORIES,
  getAvailableFilters,
  filterActivities,
  SPORT_CATEGORIES,
  getAvailableSports,
  OPEN_GYM_CATEGORY,
  getAvailableSportsAndOpenGym,
  findSportById,
  getWeekSummary,
  getWeeklySessionCounts,
} from './filters.js';
import type { Activity, DaySchedule } from './types.js';

// --- FILTER_CATEGORIES ---

describe('FILTER_CATEGORIES', () => {
  it("'all' matches everything", () => {
    const all = FILTER_CATEGORIES.find(c => c.id === 'all')!;
    expect(all.match('Open Gym')).toBe(true);
    expect(all.match('Basketball')).toBe(true);
    expect(all.match('anything')).toBe(true);
  });

  it('each category matches expected names', () => {
    const find = (id: string) => FILTER_CATEGORIES.find(c => c.id === id)!;
    expect(find('open-gym').match('Open Gym')).toBe(true);
    expect(find('basketball').match('FLAS Basketball')).toBe(true);
    expect(find('pickleball').match('Pickleball')).toBe(true);
    expect(find('table-tennis').match('Table Tennis')).toBe(true);
    expect(find('volleyball').match('Volleyball League')).toBe(true);
    expect(find('badminton').match('Badminton')).toBe(true);
    expect(find('tennis').match('Indoor Tennis')).toBe(true);
    expect(find('youth').match('Youth Center')).toBe(true);
  });

  it("'tennis' matches 'Indoor Tennis' but not 'Table Tennis'", () => {
    const tennis = FILTER_CATEGORIES.find(c => c.id === 'tennis')!;
    expect(tennis.match('Indoor Tennis')).toBe(true);
    expect(tennis.match('Tennis')).toBe(true);
    expect(tennis.match('Table Tennis')).toBe(false);
  });

  it('has unique IDs', () => {
    const ids = FILTER_CATEGORIES.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// --- getAvailableFilters ---

describe('getAvailableFilters', () => {
  const makeSchedule = (activities: Activity[]): Record<string, DaySchedule> => ({
    Monday: { open: '8:00 AM', close: '10:00 PM', activities },
  });

  it("always includes 'all'", () => {
    const result = getAvailableFilters(makeSchedule([]));
    expect(result.some(c => c.id === 'all')).toBe(true);
  });

  it('only includes relevant categories', () => {
    const result = getAvailableFilters(makeSchedule([
      { name: 'Open Gym', start: '8:00 AM', end: '12:00 PM', isOpenGym: true },
      { name: 'Basketball', start: '12:00 PM', end: '2:00 PM', isOpenGym: false },
    ]));
    const ids = result.map(c => c.id);
    expect(ids).toContain('all');
    expect(ids).toContain('open-gym');
    expect(ids).toContain('basketball');
    expect(ids).not.toContain('volleyball');
    expect(ids).not.toContain('tennis');
  });

  it('scans all days', () => {
    const schedule: Record<string, DaySchedule> = {
      Monday: {
        open: '8:00 AM', close: '10:00 PM',
        activities: [{ name: 'Basketball', start: '8:00 AM', end: '10:00 AM', isOpenGym: false }],
      },
      Tuesday: {
        open: '8:00 AM', close: '10:00 PM',
        activities: [{ name: 'Volleyball', start: '8:00 AM', end: '10:00 AM', isOpenGym: false }],
      },
    };
    const ids = getAvailableFilters(schedule).map(c => c.id);
    expect(ids).toContain('basketball');
    expect(ids).toContain('volleyball');
  });

  it("empty schedule returns only 'all'", () => {
    const result = getAvailableFilters({});
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('all');
  });
});

// --- filterActivities ---

describe('filterActivities', () => {
  const activities: Activity[] = [
    { name: 'Open Gym', start: '8:00 AM', end: '12:00 PM', isOpenGym: true },
    { name: 'Basketball', start: '12:00 PM', end: '2:00 PM', isOpenGym: false },
    { name: 'Volleyball', start: '2:00 PM', end: '4:00 PM', isOpenGym: false },
  ];

  it("'all' returns full array", () => {
    expect(filterActivities(activities, 'all')).toEqual(activities);
  });

  it('unknown filterId returns full array (safe fallback)', () => {
    expect(filterActivities(activities, 'nonexistent')).toEqual(activities);
  });

  it('correctly filters by category', () => {
    const result = filterActivities(activities, 'basketball');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Basketball');
  });

  it('returns empty array when no matches', () => {
    const result = filterActivities(activities, 'tennis');
    expect(result).toHaveLength(0);
  });

  it('preserves original objects (no mutation)', () => {
    const result = filterActivities(activities, 'basketball');
    expect(result[0]).toBe(activities[1]);
  });
});

// --- SPORT_CATEGORIES ---

describe('SPORT_CATEGORIES', () => {
  it("excludes 'all' and 'open-gym'", () => {
    const ids = SPORT_CATEGORIES.map(c => c.id);
    expect(ids).not.toContain('all');
    expect(ids).not.toContain('open-gym');
  });

  it('includes all other categories', () => {
    const ids = SPORT_CATEGORIES.map(c => c.id);
    expect(ids).toContain('basketball');
    expect(ids).toContain('pickleball');
    expect(ids).toContain('table-tennis');
    expect(ids).toContain('volleyball');
    expect(ids).toContain('badminton');
    expect(ids).toContain('tennis');
    expect(ids).toContain('youth');
  });
});

// --- getAvailableSports ---

describe('getAvailableSports', () => {
  it('returns only sports present in schedule', () => {
    const schedule: Record<string, DaySchedule> = {
      Monday: {
        open: '8:00 AM', close: '10:00 PM',
        activities: [
          { name: 'Open Gym', start: '8:00 AM', end: '12:00 PM', isOpenGym: true },
          { name: 'Basketball', start: '12:00 PM', end: '2:00 PM', isOpenGym: false },
        ],
      },
    };
    const result = getAvailableSports(schedule);
    const ids = result.map(c => c.id);
    expect(ids).toContain('basketball');
    expect(ids).not.toContain('volleyball');
    expect(ids).not.toContain('open-gym');
  });

  it('empty schedule returns empty array', () => {
    expect(getAvailableSports({})).toHaveLength(0);
  });

  it('filters out sports with no matches', () => {
    const schedule: Record<string, DaySchedule> = {
      Monday: {
        open: '8:00 AM', close: '10:00 PM',
        activities: [{ name: 'Open Gym', start: '8:00 AM', end: '12:00 PM', isOpenGym: true }],
      },
    };
    expect(getAvailableSports(schedule)).toHaveLength(0);
  });
});

// --- getWeekSummary ---

describe('getWeekSummary', () => {
  const basketball = SPORT_CATEGORIES.find(c => c.id === 'basketball')!;

  const schedule: Record<string, DaySchedule> = {
    Monday: {
      open: '8:00 AM', close: '10:00 PM',
      activities: [
        { name: 'Open Gym', start: '8:00 AM', end: '12:00 PM', isOpenGym: true },
        { name: 'Basketball', start: '12:00 PM', end: '2:00 PM', isOpenGym: false },
      ],
    },
    Wednesday: {
      open: '8:00 AM', close: '10:00 PM',
      activities: [
        { name: 'Basketball League', start: '6:00 PM', end: '8:00 PM', isOpenGym: false },
      ],
    },
    Friday: {
      open: '8:00 AM', close: '10:00 PM',
      activities: [
        { name: 'Volleyball', start: '6:00 PM', end: '8:00 PM', isOpenGym: false },
      ],
    },
  };

  it('returns days in Mon-Sun order', () => {
    const result = getWeekSummary(schedule, basketball);
    const days = result.map(e => e.day);
    expect(days).toEqual(['Monday', 'Wednesday']);
  });

  it('only includes days with matching activities', () => {
    const result = getWeekSummary(schedule, basketball);
    expect(result).toHaveLength(2);
    expect(result.every(e => e.activities.length > 0)).toBe(true);
  });

  it('correctly filters activities per day', () => {
    const result = getWeekSummary(schedule, basketball);
    expect(result[0].activities).toHaveLength(1);
    expect(result[0].activities[0].name).toBe('Basketball');
    expect(result[1].activities[0].name).toBe('Basketball League');
  });

  it('returns empty result for non-matching sport', () => {
    const tennis = SPORT_CATEGORIES.find(c => c.id === 'tennis')!;
    expect(getWeekSummary(schedule, tennis)).toHaveLength(0);
  });
});

// --- getWeeklySessionCounts ---

describe('getWeeklySessionCounts', () => {
  const basketball = SPORT_CATEGORIES.find(c => c.id === 'basketball')!;
  const volleyball = SPORT_CATEGORIES.find(c => c.id === 'volleyball')!;

  const schedule: Record<string, DaySchedule> = {
    Monday: {
      open: '8:00 AM', close: '10:00 PM',
      activities: [
        { name: 'Open Gym', start: '8:00 AM', end: '12:00 PM', isOpenGym: true },
        { name: 'Basketball', start: '12:00 PM', end: '2:00 PM', isOpenGym: false },
        { name: 'Basketball', start: '5:00 PM', end: '7:00 PM', isOpenGym: false },
      ],
    },
    Tuesday: {
      open: '8:00 AM', close: '10:00 PM',
      activities: [
        { name: 'Basketball', start: '1:00 PM', end: '3:00 PM', isOpenGym: false },
        { name: 'Volleyball', start: '6:00 PM', end: '8:00 PM', isOpenGym: false },
      ],
    },
  };

  it('counts sessions per sport across all days', () => {
    const sports = [basketball, volleyball];
    const counts = getWeeklySessionCounts(schedule, sports);
    expect(counts.get('basketball')).toBe(3);
    expect(counts.get('volleyball')).toBe(1);
  });

  it('omits sports with zero sessions from the map', () => {
    const tennis = SPORT_CATEGORIES.find(c => c.id === 'tennis')!;
    const counts = getWeeklySessionCounts(schedule, [basketball, tennis]);
    expect(counts.has('tennis')).toBe(false);
    expect(counts.get('basketball')).toBe(3);
  });

  it('open gym activities are not counted for sports', () => {
    const counts = getWeeklySessionCounts(schedule, [basketball]);
    // Monday has 2 basketball + 1 open gym; open gym must not inflate the count
    expect(counts.get('basketball')).toBe(3);
  });

  it('returns empty map for empty schedule', () => {
    expect(getWeeklySessionCounts({}, [basketball])).toEqual(new Map());
  });

  it('returns empty map when sports array is empty', () => {
    expect(getWeeklySessionCounts(schedule, [])).toEqual(new Map());
  });
});

// --- OPEN_GYM_CATEGORY ---

describe('OPEN_GYM_CATEGORY', () => {
  it('has id open-gym and matches Open Gym activity names', () => {
    expect(OPEN_GYM_CATEGORY.id).toBe('open-gym');
    expect(OPEN_GYM_CATEGORY.match('Open Gym')).toBe(true);
    expect(OPEN_GYM_CATEGORY.match('FLAS Open Gym')).toBe(true);
  });
});

// --- getAvailableSportsAndOpenGym ---

describe('getAvailableSportsAndOpenGym', () => {
  it('appends Open Gym as last chip when open gym sessions exist', () => {
    const schedule = { Monday: { open: '8:00 AM', close: '10:00 PM', activities: [
      { name: 'Open Gym', start: '8:00 AM', end: '12:00 PM', isOpenGym: true },
      { name: 'Basketball', start: '12:00 PM', end: '2:00 PM', isOpenGym: false },
    ]}};
    const result = getAvailableSportsAndOpenGym(schedule);
    const ids = result.map(c => c.id);
    expect(ids).toContain('basketball');
    expect(ids[ids.length - 1]).toBe('open-gym');
  });

  it('excludes Open Gym when no open gym sessions exist', () => {
    const schedule = { Monday: { open: '8:00 AM', close: '10:00 PM', activities: [
      { name: 'Basketball', start: '12:00 PM', end: '2:00 PM', isOpenGym: false },
    ]}};
    expect(getAvailableSportsAndOpenGym(schedule).map(c => c.id)).not.toContain('open-gym');
  });

  it('returns empty array for empty schedule', () => {
    expect(getAvailableSportsAndOpenGym({})).toHaveLength(0);
  });
});

// --- findSportById ---

describe('findSportById', () => {
  it('returns OPEN_GYM_CATEGORY for open-gym', () => {
    expect(findSportById('open-gym')).toBe(OPEN_GYM_CATEGORY);
  });

  it('returns sport category for valid sport id', () => {
    expect(findSportById('basketball')?.id).toBe('basketball');
  });

  it('returns null for unknown id', () => {
    expect(findSportById('unknown')).toBeNull();
  });
});
