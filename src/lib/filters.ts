import type { Activity, DaySchedule } from './types.js';
import { DISPLAY_DAYS } from './time.js';

export interface FilterCategory {
  id: string;
  label: string;
  match: (name: string) => boolean;
}

export const FILTER_CATEGORIES: FilterCategory[] = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'open-gym', label: 'Open Gym', match: (n) => /open gym/i.test(n) },
  { id: 'basketball', label: 'Basketball', match: (n) => /basketball/i.test(n) },
  { id: 'pickleball', label: 'Pickleball', match: (n) => /pickleball/i.test(n) },
  { id: 'table-tennis', label: 'Table Tennis', match: (n) => /table tennis/i.test(n) },
  { id: 'volleyball', label: 'Volleyball', match: (n) => /volleyball/i.test(n) },
  { id: 'badminton', label: 'Badminton', match: (n) => /badminton/i.test(n) },
  { id: 'tennis', label: 'Tennis', match: (n) => /tennis/i.test(n) && !/table tennis/i.test(n) },
  { id: 'youth', label: 'Youth', match: (n) => /youth center/i.test(n) },
];

/** Return only filter categories that have at least one match across the full week. */
export function getAvailableFilters(schedule: Record<string, DaySchedule>): FilterCategory[] {
  const allActivities = Object.values(schedule).flatMap((day) => day.activities);
  return FILTER_CATEGORIES.filter(
    (cat) => cat.id === 'all' || allActivities.some((act) => cat.match(act.name)),
  );
}

export function filterActivities(activities: Activity[], filterId: string): Activity[] {
  const cat = FILTER_CATEGORIES.find((c) => c.id === filterId);
  if (!cat || cat.id === 'all') return activities;
  return activities.filter((act) => cat.match(act.name));
}

/**
 * Sport categories = FILTER_CATEGORIES minus 'all' and 'open-gym'.
 * SYNC: If you add a sport here, also update SPORT_PATTERNS in scripts/check-and-notify.mjs.
 */
export const SPORT_CATEGORIES: FilterCategory[] =
  FILTER_CATEGORIES.filter(c => c.id !== 'all' && c.id !== 'open-gym');

/** Get sport categories that have at least one match in the schedule. */
export function getAvailableSports(schedule: Record<string, DaySchedule>): FilterCategory[] {
  const allActivities = Object.values(schedule).flatMap(d => d.activities);
  return SPORT_CATEGORIES.filter(cat => allActivities.some(act => cat.match(act.name)));
}

export const OPEN_GYM_CATEGORY: FilterCategory =
  FILTER_CATEGORIES.find(c => c.id === 'open-gym')!;

/**
 * Like getAvailableSports, but appends Open Gym as the last chip
 * when any open gym sessions exist this week.
 * SportWeekCard uses this; SPORT_CATEGORIES and NotifSheet are unaffected.
 */
export function getAvailableSportsAndOpenGym(
  schedule: Record<string, DaySchedule>,
): FilterCategory[] {
  const sports = getAvailableSports(schedule);
  const allActivities = Object.values(schedule).flatMap(d => d.activities);
  if (allActivities.some(act => OPEN_GYM_CATEGORY.match(act.name))) {
    return [...sports, OPEN_GYM_CATEGORY];
  }
  return sports;
}

/**
 * Find a sport/open-gym category by ID (for URL validation and hydration).
 * Searches SPORT_CATEGORIES + OPEN_GYM_CATEGORY — does NOT filter by schedule.
 */
export function findSportById(id: string): FilterCategory | null {
  if (id === OPEN_GYM_CATEGORY.id) return OPEN_GYM_CATEGORY;
  return SPORT_CATEGORIES.find(c => c.id === id) ?? null;
}

/**
 * Count sessions per sport across the full week.
 * Only sports with at least one session are included in the map.
 * Uses the same match predicates as getAvailableSports, so counts are
 * always consistent with which chips are shown.
 */
export function getWeeklySessionCounts(
  schedule: Record<string, DaySchedule>,
  sports: FilterCategory[],
): Map<string, number> {
  const allActivities = Object.values(schedule).flatMap((d) => d.activities);
  const counts = new Map<string, number>();
  for (const sport of sports) {
    const count = allActivities.filter((act) => sport.match(act.name)).length;
    if (count > 0) counts.set(sport.id, count);
  }
  return counts;
}

/** Get weekly summary for a sport, grouped by day (Mon-Sun order). */
export function getWeekSummary(
  schedule: Record<string, DaySchedule>,
  sport: FilterCategory,
): { day: string; activities: Activity[] }[] {
  return DISPLAY_DAYS
    .filter(d => schedule[d.full])
    .map(d => ({
      day: d.full,
      activities: schedule[d.full].activities.filter(act => sport.match(act.name)),
    }))
    .filter(entry => entry.activities.length > 0);
}
