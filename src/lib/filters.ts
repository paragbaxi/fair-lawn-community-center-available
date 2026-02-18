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
