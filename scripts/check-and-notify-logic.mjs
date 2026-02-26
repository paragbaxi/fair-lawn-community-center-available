/**
 * Pure logic extracted from check-and-notify.mjs for unit testing.
 * No side effects — no file I/O, no fetch, no process.exit.
 */

export const THIRTY_MIN_WINDOW_MIN = 20;
export const THIRTY_MIN_WINDOW_MAX = 45;

export const SPORT_PATTERNS = [
  { id: 'basketball',   label: 'Basketball',   test: (n) => /basketball/i.test(n) },
  { id: 'pickleball',   label: 'Pickleball',   test: (n) => /pickleball/i.test(n) },
  { id: 'table-tennis', label: 'Table Tennis', test: (n) => /table\s+tennis/i.test(n) },
  { id: 'volleyball',   label: 'Volleyball',   test: (n) => /volleyball/i.test(n) },
  { id: 'badminton',    label: 'Badminton',    test: (n) => /badminton/i.test(n) },
  { id: 'tennis',       label: 'Tennis',       test: (n) => /tennis/i.test(n) && !/table\s+tennis/i.test(n) },
  { id: 'youth',        label: 'Youth',        test: (n) => /youth center/i.test(n) },
];

/**
 * Parse a time string like "9:00 AM" into minutes since midnight.
 * Returns null if the string is not parseable.
 */
export function parseMinutes(timeStr) {
  const m = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ampm = m[3].toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

/**
 * Find the first open gym slot starting between windowMin and windowMax
 * minutes from now. Returns null if none qualify.
 */
export function findOpenGymSlot(
  activities,
  nowMinutes,
  windowMin = THIRTY_MIN_WINDOW_MIN,
  windowMax = THIRTY_MIN_WINDOW_MAX,
) {
  const upcoming = activities.filter(a => {
    if (!a.isOpenGym) return false;
    const startMin = parseMinutes(a.start);
    if (startMin === null) return false;
    const diff = startMin - nowMinutes;
    return diff >= windowMin && diff <= windowMax;
  });
  return upcoming[0] ?? null;
}

/**
 * Find per-sport activities starting between windowMin and windowMax minutes
 * from now. Deduplicates by sport ID (first match per sport wins).
 * Returns an array of { pattern, activity } objects.
 */
export function findSportSlots(
  activities,
  nowMinutes,
  patterns = SPORT_PATTERNS,
  windowMin = THIRTY_MIN_WINDOW_MIN,
  windowMax = THIRTY_MIN_WINDOW_MAX,
) {
  const seen = new Set();
  const results = [];

  for (const activity of activities) {
    if (activity.isOpenGym) continue;
    const startMin = parseMinutes(activity.start);
    if (startMin === null) continue;
    const diff = startMin - nowMinutes;
    if (diff < windowMin || diff > windowMax) continue;

    for (const pattern of patterns) {
      if (!pattern.test(activity.name)) continue;
      if (seen.has(pattern.id)) continue;
      seen.add(pattern.id);
      results.push({ pattern, activity });
    }
  }

  return results;
}
