import type { DaySchedule } from '../src/lib/types.js';
import { isValidTime, parseTimeMinutes } from './parse.js';

// Hard lower floor for gym activities (minutes since midnight).
// The per-day ds.close provides the upper bound (Signal 1).
const GYM_MIN_MINUTES = 360; // 6:00 AM

export interface SanitizeResult {
  schedule: Record<string, DaySchedule>;
  skipped: number;   // activities dropped (invalid format or ambiguous — can't be corrected)
  corrected: number; // activities whose times were corrected
}

/** Flip the AM/PM period of a normalized "H:MM AM/PM" string. */
function flipPeriod(timeStr: string): string {
  if (timeStr.endsWith('AM')) return timeStr.slice(0, -2) + 'PM';
  if (timeStr.endsWith('PM')) return timeStr.slice(0, -2) + 'AM';
  return timeStr;
}

/**
 * Sanitize a parsed schedule by:
 *  1. Dropping activities with invalid time format (can't be auto-corrected).
 *  2. Auto-correcting reversed times using three contextual signals (in priority order):
 *     - Signal 1 (day close bound): use ds.close as the upper validity bound, replacing
 *       the generic GYM_MAX constant. On Sunday (close 5 PM), a swap candidate ending at
 *       9 PM is automatically eliminated.
 *     - Signal 2 (same-period flip): when both times share the same AM/PM period, a single-
 *       field period flip is a more localized correction than transposing the two fields.
 *       Both PM → C2: flip start to AM. Both AM → C3: flip end to PM.
 *     - Signal 3 (morning anchor): when C2/C3 and C1 (swap) are both valid, a same-day
 *       morning activity (start < noon) confirms C2/C3; otherwise Signal 2 default applies.
 *  3. Dropping reversed activities where no valid correction can be determined (ambiguous).
 *
 * Correction paths:
 *  C1 (swap):      use (originalEnd, originalStart)            — different periods or C2/C3 fallback
 *  C2 (flip start to AM): for both-PM reversed times           — Signal 2 preferred
 *  C3 (flip end to PM):   for both-AM reversed times           — Signal 2 preferred
 */
export function sanitizeSchedule(
  schedule: Record<string, DaySchedule>,
): SanitizeResult {
  let skipped = 0;
  let corrected = 0;

  const sanitized: Record<string, DaySchedule> = {};

  for (const [day, ds] of Object.entries(schedule)) {
    // Signal 1: day-specific close bound replaces generic GYM_MAX.
    const closeMin = parseTimeMinutes(ds.close);

    // Signal 3 pre-pass: collect valid (non-reversed) activities to detect morning anchor.
    const validActivities = ds.activities.filter(a =>
      isValidTime(a.start) && isValidTime(a.end) &&
      parseTimeMinutes(a.start) < parseTimeMinutes(a.end)
    );
    const hasMorningAnchor = validActivities.some(a => parseTimeMinutes(a.start) < 720);

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
        // Reversed or equal times — determine the best correction.
        const startPeriod = act.start.endsWith('AM') ? 'AM' : 'PM';
        const endPeriod = act.end.endsWith('AM') ? 'AM' : 'PM';
        const samePeriod = startPeriod === endPeriod;

        if (samePeriod) {
          // Signal 2: try a single-field period flip first (more localized correction).
          const bothPM = startPeriod === 'PM';
          const flippedStart = bothPM ? flipPeriod(act.start) : act.start;
          const flippedEnd = bothPM ? act.end : flipPeriod(act.end);
          const flipStartMin = parseTimeMinutes(flippedStart);
          const flipEndMin = parseTimeMinutes(flippedEnd);

          // C2 (both PM → flip start): valid if flipped start is in gym hours and before end, and end is within close.
          // C3 (both AM → flip end): valid if start is in gym hours and before flipped end, and flipped end is within close.
          const c2c3Valid = bothPM
            ? (flipStartMin >= GYM_MIN_MINUTES && flipStartMin < endMin && endMin <= closeMin)
            : (startMin >= GYM_MIN_MINUTES && startMin < flipEndMin && flipEndMin <= closeMin);

          // C1 (swap): valid if original end (→ new start) is in gym hours and original start (→ new end) is within close.
          const c1Valid = endMin >= GYM_MIN_MINUTES && startMin <= closeMin;

          if (c2c3Valid) {
            // Signal 2 preferred; Signal 3 (morning anchor) confirms but doesn't override.
            const reason = hasMorningAnchor ? 'same-period flip + morning anchor' : 'same-period flip';
            console.warn(
              `[scraper] Auto-corrected reversed times for "${act.name}" on ${day}: ` +
              `was ${act.start}–${act.end}, now ${flippedStart}–${flippedEnd} (${reason})`,
            );
            cleanActivities.push({ ...act, start: flippedStart, end: flippedEnd, corrected: true });
            corrected++;
          } else if (c1Valid) {
            // Fallback to swap when flip candidate is invalid (Signal 2 not applicable).
            console.warn(
              `[scraper] Auto-corrected reversed times for "${act.name}" on ${day}: ` +
              `was ${act.start}–${act.end}, now ${act.end}–${act.start} (swap fallback)`,
            );
            cleanActivities.push({ ...act, start: act.end, end: act.start, corrected: true });
            corrected++;
          } else {
            // Neither flip nor swap produces a valid time range — ambiguous, drop.
            console.warn(
              `[scraper] Skipping "${act.name}" on ${day}: reversed same-period times, no valid correction (${act.start}–${act.end})`,
            );
            skipped++;
          }
        } else {
          // Different periods → C1 (swap).
          const c1Valid = endMin >= GYM_MIN_MINUTES && startMin <= closeMin;
          if (c1Valid) {
            console.warn(
              `[scraper] Auto-corrected reversed times for "${act.name}" on ${day}: ` +
              `was ${act.start}–${act.end}, now ${act.end}–${act.start}`,
            );
            cleanActivities.push({ ...act, start: act.end, end: act.start, corrected: true });
            corrected++;
          } else {
            console.warn(
              `[scraper] Skipping "${act.name}" on ${day}: reversed times with ambiguous overnight range (${act.start}–${act.end})`,
            );
            skipped++;
          }
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
