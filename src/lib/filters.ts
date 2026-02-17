import type { Activity, DaySchedule } from './types.js';

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
  { id: 'tennis', label: 'Tennis', match: (n) => /indoor tennis/i.test(n) },
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
