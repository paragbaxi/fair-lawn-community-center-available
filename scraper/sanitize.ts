import type { DaySchedule } from '../src/lib/types.js';
import { isValidTime, parseTimeMinutes } from './parse.js';

// Gym operating hours expressed as minutes since midnight.
// Activities outside this range are considered ambiguous (potential overnight slots).
const GYM_MIN_MINUTES = 360;  // 6:00 AM
const GYM_MAX_MINUTES = 1439; // 11:59 PM

export interface SanitizeResult {
  schedule: Record<string, DaySchedule>;
  skipped: number;   // activities dropped (invalid format — can't be corrected)
  corrected: number; // activities whose times were swapped
}

/**
 * Sanitize a parsed schedule by:
 *  1. Dropping activities with invalid time format (can't be auto-corrected).
 *  2. Auto-swapping reversed times when both times fall within gym hours [6:00 AM–11:59 PM].
 *  3. Dropping reversed activities where either time is outside gym hours (ambiguous overnight).
 *
 * This runs BEFORE validateSchedule so that Rules 7+8 in validate.ts act as a safety net
 * rather than the primary enforcement path.
 */
export function sanitizeSchedule(
  schedule: Record<string, DaySchedule>,
): SanitizeResult {
  let skipped = 0;
  let corrected = 0;

  const sanitized: Record<string, DaySchedule> = {};

  for (const [day, ds] of Object.entries(schedule)) {
    const cleanActivities = [];

    for (const act of ds.activities) {
      // Rule 1: Invalid format — drop the activity entirely.
      if (!isValidTime(act.start) || !isValidTime(act.end)) {
        console.warn(
          `[scraper] Skipping "${act.name}" on ${day}: invalid time format (${act.start}–${act.end})`,
        );
        skipped++;
        continue;
      }

      const startMin = parseTimeMinutes(act.start);
      const endMin = parseTimeMinutes(act.end);

      if (startMin >= endMin) {
        // Times are reversed (or equal). Decide whether to swap or skip.
        const bothInGymHours =
          startMin >= GYM_MIN_MINUTES &&
          startMin <= GYM_MAX_MINUTES &&
          endMin >= GYM_MIN_MINUTES &&
          endMin <= GYM_MAX_MINUTES;

        if (bothInGymHours) {
          // Rule 2: Safe to swap — both times are within gym operating hours.
          const originalStart = act.start;
          const originalEnd = act.end;
          console.warn(
            `[scraper] Auto-corrected reversed times for "${act.name}" on ${day}: ` +
            `was ${originalStart}–${originalEnd}, now ${originalEnd}–${originalStart}`,
          );
          cleanActivities.push({
            ...act,
            start: originalEnd,
            end: originalStart,
            corrected: true,
          });
          corrected++;
        } else {
          // Rule 3: Ambiguous overnight — one or both times are outside gym hours; skip.
          console.warn(
            `[scraper] Skipping "${act.name}" on ${day}: reversed times with ambiguous overnight range (${act.start}–${act.end})`,
          );
          skipped++;
        }
        continue;
      }

      // Times are valid and ordered — pass through unchanged.
      cleanActivities.push(act);
    }

    sanitized[day] = { ...ds, activities: cleanActivities };
  }

  return { schedule: sanitized, skipped, corrected };
}
