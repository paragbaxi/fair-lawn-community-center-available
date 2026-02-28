import { describe, it, expect } from 'vitest';
import { sanitizeSchedule } from './sanitize.js';
import type { DaySchedule } from '../src/lib/types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDay(activities: Array<{
  name: string;
  start: string;
  end: string;
  isOpenGym?: boolean;
}>, close = '9:00 PM'): DaySchedule {
  return {
    open: '7:00 AM',
    close,
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

  // Scenario B — both PM, wrong period on start
  it('auto-corrects both-PM reversed times by flipping start to AM (Scenario B)', () => {
    // 9:00 PM start, 4:30 PM end — both PM, reversed → flip start to 9:00 AM
    const schedule = makeSchedule({
      Tuesday: makeDay([{ name: 'Badminton', start: '9:00 PM', end: '4:30 PM' }]),
    });

    const { schedule: out, skipped, corrected } = sanitizeSchedule(schedule);

    expect(skipped).toBe(0);
    expect(corrected).toBe(1);
    expect(out.Tuesday.activities).toHaveLength(1);
  });

  it('both-PM flip produces correct 9:00 AM – 4:30 PM after correction', () => {
    // 9:00 PM start, 4:30 PM end → should become 9:00 AM start, 4:30 PM end (Scenario B)
    const schedule = makeSchedule({
      Tuesday: makeDay([{ name: 'Badminton', start: '9:00 PM', end: '4:30 PM' }]),
    });

    const { schedule: out } = sanitizeSchedule(schedule);
    const act = out.Tuesday.activities[0];

    expect(act.start).toBe('9:00 AM');
    expect(act.end).toBe('4:30 PM');
    expect(act.corrected).toBe(true);
  });

  it('skips reversed times where end is before 6:00 AM (ambiguous overnight)', () => {
    // end = "2:00 AM" (120 minutes) is below 360 — C1 invalid, ambiguous overnight
    const schedule = makeSchedule({
      Wednesday: makeDay([{ name: 'Late Gym', start: '9:00 PM', end: '2:00 AM' }]),
    });

    const { schedule: out, skipped, corrected } = sanitizeSchedule(schedule);

    expect(skipped).toBe(1);
    expect(corrected).toBe(0);
    expect(out.Wednesday.activities).toHaveLength(0);
  });

  // Scenario C — both AM, wrong period on end
  it('auto-corrects both-AM reversed times by flipping end to PM (Scenario C)', () => {
    // 9:00 AM start, 5:00 AM end — both AM, reversed → flip end to 5:00 PM
    const schedule = makeSchedule({
      Thursday: makeDay([{ name: 'Early Bird', start: '9:00 AM', end: '5:00 AM' }]),
    });

    const { schedule: out, skipped, corrected } = sanitizeSchedule(schedule);

    expect(skipped).toBe(0);
    expect(corrected).toBe(1);
    const act = out.Thursday.activities[0];
    expect(act.start).toBe('9:00 AM');
    expect(act.end).toBe('5:00 PM');
    expect(act.corrected).toBe(true);
  });

  // Scenario D — different periods, times transposed
  it('auto-swaps reversed times with different periods (Scenario D)', () => {
    // 4:30 PM start, 9:00 AM end — different periods → swap → 9:00 AM – 4:30 PM
    const schedule = makeSchedule({
      Monday: makeDay([{ name: 'Open Swim', start: '4:30 PM', end: '9:00 AM' }]),
    });

    const { schedule: out, skipped, corrected } = sanitizeSchedule(schedule);

    expect(skipped).toBe(0);
    expect(corrected).toBe(1);
    const act = out.Monday.activities[0];
    expect(act.start).toBe('9:00 AM');
    expect(act.end).toBe('4:30 PM');
    expect(act.corrected).toBe(true);
  });

  // Signal 1 — day close bound eliminates swap candidate
  it('Signal 1: Sunday close (5 PM) eliminates swap, leaving only flip valid', () => {
    // 9:00 PM – 4:30 PM on a day with close 5:00 PM:
    //   C1 (swap → 4:30 PM – 9:00 PM): 9 PM > close 5 PM → invalid
    //   C2 (flip start → 9:00 AM – 4:30 PM): 4:30 PM ≤ close 5 PM → valid
    const schedule = makeSchedule({
      Sunday: makeDay([{ name: 'Yoga', start: '9:00 PM', end: '4:30 PM' }], '5:00 PM'),
    });

    const { schedule: out, skipped, corrected } = sanitizeSchedule(schedule);

    expect(skipped).toBe(0);
    expect(corrected).toBe(1);
    const act = out.Sunday.activities[0];
    expect(act.start).toBe('9:00 AM');
    expect(act.end).toBe('4:30 PM');
    expect(act.corrected).toBe(true);
  });

  // Signal 3 — morning anchor tiebreaker (both C2 and C1 valid)
  it('Signal 3: morning anchor confirms same-period flip when both C2 and C1 are valid', () => {
    // Basketball (valid, 10 AM morning anchor) + Table Tennis reversed both-PM
    // C2: 9:00 AM – 4:30 PM (valid); C1: 4:30 PM – 9:00 PM (valid)
    // hasMorningAnchor = true (Basketball at 10 AM) → prefer C2
    const schedule = makeSchedule({
      Tuesday: makeDay([
        { name: 'Basketball', start: '10:00 AM', end: '12:00 PM' },
        { name: 'Table Tennis', start: '9:00 PM', end: '4:30 PM' },
      ]),
    });

    const { schedule: out } = sanitizeSchedule(schedule);
    const tableTennis = out.Tuesday.activities.find(a => a.name === 'Table Tennis');

    expect(tableTennis).toBeDefined();
    expect(tableTennis!.start).toBe('9:00 AM');
    expect(tableTennis!.end).toBe('4:30 PM');
    expect(tableTennis!.corrected).toBe(true);
  });

  // Signal 2 default — no morning anchor, same-period flip still preferred
  it('Signal 2 default: no morning anchor → same-period flip still preferred over swap', () => {
    // No other activities; 9:00 PM – 4:30 PM both PM
    // C2: 9:00 AM – 4:30 PM valid; C1: 4:30 PM – 9:00 PM valid
    // hasMorningAnchor = false → Signal 2 default → C2 preferred
    const schedule = makeSchedule({
      Wednesday: makeDay([{ name: 'Yoga', start: '9:00 PM', end: '4:30 PM' }]),
    });

    const { schedule: out } = sanitizeSchedule(schedule);
    const act = out.Wednesday.activities[0];

    expect(act.start).toBe('9:00 AM');
    expect(act.end).toBe('4:30 PM');
    expect(act.corrected).toBe(true);
  });

  // Fallback to swap when same-period flip is invalid
  it('falls back to swap (C1) when same-period flip produces a time below GYM_MIN', () => {
    // 1:00 PM – 12:30 PM (both PM):
    //   C2: flip start → 1:00 AM = 60 min < 360 (GYM_MIN) → invalid
    //   C1: swap → 12:30 PM – 1:00 PM → valid
    const schedule = makeSchedule({
      Thursday: makeDay([{ name: 'Zumba', start: '1:00 PM', end: '12:30 PM' }]),
    });

    const { schedule: out, skipped, corrected } = sanitizeSchedule(schedule);

    expect(skipped).toBe(0);
    expect(corrected).toBe(1);
    const act = out.Thursday.activities[0];
    expect(act.start).toBe('12:30 PM');
    expect(act.end).toBe('1:00 PM');
    expect(act.corrected).toBe(true);
  });

  it('handles multiple activities on the same day: valid pass, reversed get corrected, invalid get skipped', () => {
    const schedule = makeSchedule({
      Friday: makeDay([
        // valid — passes through
        { name: 'Basketball', start: '10:00 AM', end: '12:00 PM' },
        // both PM reversed — C2: flip start 8:00 PM → 8:00 AM (valid, in gym hours, ≤ close 9 PM)
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
    // C2: flip start 8:00 PM → 8:00 AM, end stays 6:00 PM
    expect(volleyball!.start).toBe('8:00 AM');
    expect(volleyball!.end).toBe('6:00 PM');
  });
});
