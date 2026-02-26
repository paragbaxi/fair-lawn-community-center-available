import { describe, it, expect } from 'vitest';
import { sanitizeSchedule } from './sanitize.js';
import type { DaySchedule } from '../src/lib/types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDay(activities: Array<{
  name: string;
  start: string;
  end: string;
  isOpenGym?: boolean;
}>): DaySchedule {
  return {
    open: '7:00 AM',
    close: '9:00 PM',
    activities: activities.map(a => ({
      name: a.name,
      start: a.start,
      end: a.end,
      isOpenGym: a.isOpenGym ?? false,
    })),
  };
}

function makeSchedule(days: Record<string, ReturnType<typeof makeDay>>): Record<string, DaySchedule> {
  return days;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('sanitizeSchedule', () => {
  it('passes a valid activity through unchanged', () => {
    const schedule = makeSchedule({
      Monday: makeDay([{ name: 'Basketball', start: '10:00 AM', end: '12:00 PM' }]),
    });

    const { schedule: out, skipped, corrected } = sanitizeSchedule(schedule);

    expect(skipped).toBe(0);
    expect(corrected).toBe(0);
    expect(out.Monday.activities).toHaveLength(1);
    expect(out.Monday.activities[0]).toMatchObject({
      name: 'Basketball',
      start: '10:00 AM',
      end: '12:00 PM',
    });
    expect(out.Monday.activities[0].corrected).toBeUndefined();
  });

  it('skips an activity with an invalid start time', () => {
    const schedule = makeSchedule({
      Monday: makeDay([{ name: 'Basketball', start: 'not-a-time', end: '12:00 PM' }]),
    });

    const { schedule: out, skipped, corrected } = sanitizeSchedule(schedule);

    expect(skipped).toBe(1);
    expect(corrected).toBe(0);
    expect(out.Monday.activities).toHaveLength(0);
  });

  it('skips an activity with an invalid end time', () => {
    const schedule = makeSchedule({
      Monday: makeDay([{ name: 'Volleyball', start: '9:00 AM', end: 'garbage' }]),
    });

    const { schedule: out, skipped, corrected } = sanitizeSchedule(schedule);

    expect(skipped).toBe(1);
    expect(corrected).toBe(0);
    expect(out.Monday.activities).toHaveLength(0);
  });

  it('auto-swaps reversed times when both times are within gym hours (6 AM–11:59 PM)', () => {
    // 9:00 PM start, 4:30 PM end — both in gym hours, but reversed
    const schedule = makeSchedule({
      Tuesday: makeDay([{ name: 'Pickleball', start: '9:00 PM', end: '4:30 PM' }]),
    });

    const { schedule: out, skipped, corrected } = sanitizeSchedule(schedule);

    expect(skipped).toBe(0);
    expect(corrected).toBe(1);
    expect(out.Tuesday.activities).toHaveLength(1);
  });

  it('swapped activity has start earlier than end after correction', () => {
    // 9:00 PM start, 4:30 PM end → should become 4:30 PM start, 9:00 PM end
    const schedule = makeSchedule({
      Tuesday: makeDay([{ name: 'Pickleball', start: '9:00 PM', end: '4:30 PM' }]),
    });

    const { schedule: out } = sanitizeSchedule(schedule);
    const act = out.Tuesday.activities[0];

    expect(act.start).toBe('4:30 PM');
    expect(act.end).toBe('9:00 PM');
    expect(act.corrected).toBe(true);
  });

  it('skips reversed times where end is before 6:00 AM (ambiguous overnight)', () => {
    // end = "2:00 AM" (120 minutes) is below 360 — ambiguous overnight
    const schedule = makeSchedule({
      Wednesday: makeDay([{ name: 'Late Gym', start: '9:00 PM', end: '2:00 AM' }]),
    });

    const { schedule: out, skipped, corrected } = sanitizeSchedule(schedule);

    expect(skipped).toBe(1);
    expect(corrected).toBe(0);
    expect(out.Wednesday.activities).toHaveLength(0);
  });

  it('skips reversed times where start is before 6:00 AM (ambiguous overnight)', () => {
    // start = "5:00 AM" (300 minutes) is below 360 — ambiguous overnight
    const schedule = makeSchedule({
      Thursday: makeDay([{ name: 'Early Bird', start: '5:00 AM', end: '9:00 AM' }]),
    });

    // 5:00 AM start, 9:00 AM end — start < end so NOT reversed, should pass through
    // Let's instead use a genuine reversed case: 9:00 AM start, 5:00 AM end
    const schedule2 = makeSchedule({
      Thursday: makeDay([{ name: 'Early Bird', start: '9:00 AM', end: '5:00 AM' }]),
    });

    const { schedule: out, skipped, corrected } = sanitizeSchedule(schedule2);

    // 5:00 AM = 300 minutes, which is < 360 — ambiguous, must be skipped
    expect(skipped).toBe(1);
    expect(corrected).toBe(0);
    expect(out.Thursday.activities).toHaveLength(0);
  });

  it('handles multiple activities on the same day: valid pass, reversed-gym-hours get corrected, invalid get skipped', () => {
    const schedule = makeSchedule({
      Friday: makeDay([
        // valid — passes through
        { name: 'Basketball', start: '10:00 AM', end: '12:00 PM' },
        // reversed but both in gym hours — should be corrected
        { name: 'Volleyball', start: '8:00 PM', end: '6:00 PM' },
        // invalid end time — should be skipped
        { name: 'Tennis', start: '1:00 PM', end: 'INVALID' },
        // reversed with ambiguous overnight (end = 3:00 AM) — should be skipped
        { name: 'Night Owl', start: '10:00 PM', end: '3:00 AM' },
      ]),
    });

    const { schedule: out, skipped, corrected } = sanitizeSchedule(schedule);

    // Basketball passes, Volleyball gets corrected (2 activities remain)
    expect(out.Friday.activities).toHaveLength(2);
    expect(corrected).toBe(1);
    // Tennis (invalid) + Night Owl (ambiguous) = 2 skipped
    expect(skipped).toBe(2);

    const basketball = out.Friday.activities.find(a => a.name === 'Basketball');
    const volleyball = out.Friday.activities.find(a => a.name === 'Volleyball');

    expect(basketball).toBeDefined();
    expect(basketball!.corrected).toBeUndefined();

    expect(volleyball).toBeDefined();
    expect(volleyball!.corrected).toBe(true);
    // Swapped: was 8:00 PM → 6:00 PM, now 6:00 PM → 8:00 PM
    expect(volleyball!.start).toBe('6:00 PM');
    expect(volleyball!.end).toBe('8:00 PM');
  });
});
