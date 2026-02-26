import type { ScheduleData } from '../src/lib/types.js';

export interface FreedSlot {
  day: string;
  startTime: string;
  endTime: string;
  activity: string;
}

export interface FreedSlotsFile {
  generatedAt: string;
  slots: FreedSlot[];
}

/**
 * Produce a stable string key that uniquely identifies a scheduled slot.
 * Used to compare slots across two schedule snapshots.
 */
export function slotKey(slot: FreedSlot): string {
  return `${slot.day}|${slot.startTime}|${slot.endTime}|${slot.activity}`;
}

/**
 * Compare two schedule snapshots and return the slots that were present in
 * `prev` but are absent from `next` (i.e. cancelled / freed up).
 *
 * Rules:
 * - Open Gym activities (isOpenGym === true) are derived slots — they are
 *   computed from gaps in the schedule and change whenever any booked activity
 *   changes.  Alerting on derived slot removal would produce noise, so they
 *   are excluded from the diff.
 * - `scrapedAt` differences are ignored (content-only comparison).
 * - A slot that moved its time is treated as one freed slot (old) + one new
 *   slot (new); only the freed/old slot is returned here.
 */
export function diffSchedules(prev: ScheduleData, next: ScheduleData): FreedSlot[] {
  const prevSlots = collectSlots(prev);
  const nextSlots = collectSlots(next);

  const nextKeySet = new Set(nextSlots.map(slotKey));

  return prevSlots.filter(slot => !nextKeySet.has(slotKey(slot)));
}

/** Extract all non-open-gym activity slots from a ScheduleData snapshot. */
function collectSlots(data: ScheduleData): FreedSlot[] {
  const slots: FreedSlot[] = [];
  for (const [day, daySchedule] of Object.entries(data.schedule)) {
    for (const activity of daySchedule.activities) {
      if (activity.isOpenGym) continue;
      slots.push({
        day,
        startTime: activity.start,
        endTime: activity.end,
        activity: activity.name,
      });
    }
  }
  return slots;
}
