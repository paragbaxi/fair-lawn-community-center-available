import type { ScheduleData } from '../src/lib/types.js';
import { DAYS, parseTimeMinutes, isValidTime } from './parse.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  stats: { daysWithActivities: number; totalActivities: number };
}

export function validateSchedule(data: ScheduleData): ValidationResult {
  const errors: string[] = [];

  // Rule 1: scrapedAt is non-empty and parses as valid date
  if (!data.scrapedAt || isNaN(Date.parse(data.scrapedAt))) {
    errors.push('scrapedAt is missing or not a valid date');
  }

  // Rule 2: All 7 DAYS keys present in schedule
  for (const day of DAYS) {
    if (!data.schedule[day]) {
      errors.push(`Missing day: ${day}`);
    }
  }

  // Collect per-day stats for rules 3-4
  let daysWithActivities = 0;
  let totalActivities = 0;

  for (const day of DAYS) {
    const ds = data.schedule[day];
    if (!ds) continue;

    // Rule 5: open and close times pass isValidTime()
    if (!isValidTime(ds.open)) {
      errors.push(`${day}: invalid open time "${ds.open}"`);
    }
    if (!isValidTime(ds.close)) {
      errors.push(`${day}: invalid close time "${ds.close}"`);
    }

    // Rule 6: close > open
    if (isValidTime(ds.open) && isValidTime(ds.close)) {
      if (parseTimeMinutes(ds.close) <= parseTimeMinutes(ds.open)) {
        errors.push(`${day}: close time (${ds.close}) is not after open time (${ds.open})`);
      }
    }

    if (ds.activities.length > 0) {
      daysWithActivities++;
      totalActivities += ds.activities.length;
    }

    for (const act of ds.activities) {
      // Rule 7: activity start/end pass isValidTime()
      // NOTE: sanitizeSchedule() drops invalid-format activities before this runs,
      // so this rule should never fire on sanitized data. Keep it as a safety net
      // in case validateSchedule() is ever called without sanitization.
      if (!isValidTime(act.start)) {
        errors.push(`${day}: activity "${act.name}" has invalid start time "${act.start}"`);
      }
      if (!isValidTime(act.end)) {
        errors.push(`${day}: activity "${act.name}" has invalid end time "${act.end}"`);
      }

      // Rule 8: activity start < end
      // NOTE: sanitizeSchedule() auto-swaps reversed-but-safe times and drops ambiguous
      // reversed times before this runs, so this rule should never fire on sanitized data.
      // Keep it as a safety net in case validateSchedule() is ever called without sanitization.
      if (isValidTime(act.start) && isValidTime(act.end)) {
        if (parseTimeMinutes(act.start) >= parseTimeMinutes(act.end)) {
          errors.push(`${day}: activity "${act.name}" start (${act.start}) is not before end (${act.end})`);
        }
      }
    }
  }

  // Thresholds for activity-day coverage checks
  const RULE3_MIN_DAYS = 5; // hard error: partial parse or site structural change
  const RULE9_MIN_DAYS = 6; // stricter tier: forward schedule may not be published yet

  // Rule 3: at least 5 of 7 days have ≥1 activity (hard error — partial parse or structural change)
  if (daysWithActivities < RULE3_MIN_DAYS) {
    errors.push(`Only ${daysWithActivities} day(s) have activities (minimum ${RULE3_MIN_DAYS})`);
  }

  // Rule 4: total activity count ≥ 10
  if (totalActivities < 10) {
    errors.push(`Only ${totalActivities} total activities (minimum 10)`);
  }

  // Rule 9: at least 6 of 7 days have ≥1 activity (error — forward schedule may not be published yet)
  if (daysWithActivities < RULE9_MIN_DAYS) {
    errors.push(`Only ${daysWithActivities}/7 days have activities; next week's schedule may not be published yet`);
  }

  return { valid: errors.length === 0, errors, stats: { daysWithActivities, totalActivities } };
}
