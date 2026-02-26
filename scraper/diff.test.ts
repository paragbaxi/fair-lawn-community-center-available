import { describe, it, expect } from 'vitest';
import { diffSchedules, slotKey } from './diff.js';
import type { FreedSlot } from './diff.js';
import type { ScheduleData } from '../src/lib/types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSchedule(days: Record<string, Array<{
  name: string;
  start: string;
  end: string;
  isOpenGym?: boolean;
}>>, scrapedAt = '2026-02-24T05:00:00.000Z'): ScheduleData {
  const schedule: ScheduleData['schedule'] = {};
  for (const [day, activities] of Object.entries(days)) {
    schedule[day] = {
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
  return { scrapedAt, schedule, notices: [] };
}

// ─── slotKey ──────────────────────────────────────────────────────────────────

describe('slotKey', () => {
  it('produces a pipe-delimited key from all four fields', () => {
    const slot: FreedSlot = { day: 'Monday', startTime: '9:00 AM', endTime: '12:00 PM', activity: 'Pickleball (Half Gym)' };
    expect(slotKey(slot)).toBe('Monday|9:00 AM|12:00 PM|Pickleball (Half Gym)');
  });

  it('two slots with same fields produce same key', () => {
    const a: FreedSlot = { day: 'Tuesday', startTime: '10:00 AM', endTime: '11:00 AM', activity: 'Basketball' };
    const b: FreedSlot = { day: 'Tuesday', startTime: '10:00 AM', endTime: '11:00 AM', activity: 'Basketball' };
    expect(slotKey(a)).toBe(slotKey(b));
  });

  it('slots differing by any field produce different keys', () => {
    const base: FreedSlot = { day: 'Monday', startTime: '9:00 AM', endTime: '10:00 AM', activity: 'Basketball' };
    expect(slotKey({ ...base, day: 'Tuesday' })).not.toBe(slotKey(base));
    expect(slotKey({ ...base, startTime: '10:00 AM' })).not.toBe(slotKey(base));
    expect(slotKey({ ...base, endTime: '11:00 AM' })).not.toBe(slotKey(base));
    expect(slotKey({ ...base, activity: 'Volleyball' })).not.toBe(slotKey(base));
  });
});

// ─── diffSchedules ────────────────────────────────────────────────────────────

describe('diffSchedules', () => {
  it('returns empty array when schedules are identical', () => {
    const s = makeSchedule({
      Monday: [{ name: 'Basketball', start: '10:00 AM', end: '12:00 PM' }],
    });
    expect(diffSchedules(s, s)).toEqual([]);
  });

  it('returns empty array when only scrapedAt changes', () => {
    const prev = makeSchedule(
      { Monday: [{ name: 'Basketball', start: '10:00 AM', end: '12:00 PM' }] },
      '2026-02-24T05:00:00.000Z',
    );
    const next = makeSchedule(
      { Monday: [{ name: 'Basketball', start: '10:00 AM', end: '12:00 PM' }] },
      '2026-02-25T05:00:00.000Z',
    );
    expect(diffSchedules(prev, next)).toEqual([]);
  });

  it('returns one freed slot when one activity is removed', () => {
    const prev = makeSchedule({
      Monday: [
        { name: 'Basketball', start: '10:00 AM', end: '12:00 PM' },
        { name: 'Pickleball (Half Gym)', start: '1:00 PM', end: '3:00 PM' },
      ],
    });
    const next = makeSchedule({
      Monday: [
        { name: 'Pickleball (Half Gym)', start: '1:00 PM', end: '3:00 PM' },
      ],
    });

    const freed = diffSchedules(prev, next);
    expect(freed).toHaveLength(1);
    expect(freed[0]).toEqual({
      day: 'Monday',
      startTime: '10:00 AM',
      endTime: '12:00 PM',
      activity: 'Basketball',
    });
  });

  it('returns multiple freed slots removed across different days', () => {
    const prev = makeSchedule({
      Monday: [{ name: 'Basketball', start: '10:00 AM', end: '12:00 PM' }],
      Tuesday: [{ name: 'Volleyball', start: '2:00 PM', end: '4:00 PM' }],
      Wednesday: [{ name: 'Pickleball (Half Gym)', start: '9:00 AM', end: '11:00 AM' }],
    });
    const next = makeSchedule({
      Monday: [],
      Tuesday: [],
      Wednesday: [{ name: 'Pickleball (Half Gym)', start: '9:00 AM', end: '11:00 AM' }],
    });

    const freed = diffSchedules(prev, next);
    expect(freed).toHaveLength(2);

    const days = freed.map(s => s.day).sort();
    expect(days).toEqual(['Monday', 'Tuesday']);
  });

  it('treats a time-changed slot as one freed slot and ignores the new slot', () => {
    // Old: Basketball 10 AM–12 PM. New: Basketball 11 AM–1 PM.
    // Diff returns the old slot as freed; the new slot is simply a new addition (not returned).
    const prev = makeSchedule({
      Monday: [{ name: 'Basketball', start: '10:00 AM', end: '12:00 PM' }],
    });
    const next = makeSchedule({
      Monday: [{ name: 'Basketball', start: '11:00 AM', end: '1:00 PM' }],
    });

    const freed = diffSchedules(prev, next);
    expect(freed).toHaveLength(1);
    expect(freed[0]).toMatchObject({ startTime: '10:00 AM', endTime: '12:00 PM', activity: 'Basketball' });
  });

  it('does NOT return a freed slot when a new activity is added (no previous match)', () => {
    const prev = makeSchedule({
      Monday: [{ name: 'Basketball', start: '10:00 AM', end: '12:00 PM' }],
    });
    const next = makeSchedule({
      Monday: [
        { name: 'Basketball', start: '10:00 AM', end: '12:00 PM' },
        { name: 'Volleyball', start: '2:00 PM', end: '4:00 PM' },
      ],
    });

    const freed = diffSchedules(prev, next);
    expect(freed).toEqual([]);
  });

  it('ignores Open Gym slots — they are derived and should not trigger alerts', () => {
    const prev = makeSchedule({
      Monday: [
        { name: 'Open Gym', start: '7:00 AM', end: '9:00 AM', isOpenGym: true },
        { name: 'Basketball', start: '10:00 AM', end: '12:00 PM' },
      ],
    });
    // Open Gym slot disappears; Basketball stays
    const next = makeSchedule({
      Monday: [
        { name: 'Basketball', start: '10:00 AM', end: '12:00 PM' },
      ],
    });

    const freed = diffSchedules(prev, next);
    expect(freed).toEqual([]);
  });

  it('handles empty schedules without error', () => {
    const empty = makeSchedule({ Monday: [], Tuesday: [] });
    expect(diffSchedules(empty, empty)).toEqual([]);
  });

  it('handles schedules with no common days', () => {
    const prev = makeSchedule({ Monday: [{ name: 'Basketball', start: '10:00 AM', end: '12:00 PM' }] });
    const next = makeSchedule({ Tuesday: [{ name: 'Volleyball', start: '2:00 PM', end: '4:00 PM' }] });

    // Monday's Basketball slot is freed (absent from next)
    const freed = diffSchedules(prev, next);
    expect(freed).toHaveLength(1);
    expect(freed[0].day).toBe('Monday');
    expect(freed[0].activity).toBe('Basketball');
  });

  it('handles all slots removed from a multi-activity day', () => {
    const prev = makeSchedule({
      Monday: [
        { name: 'Basketball', start: '10:00 AM', end: '11:00 AM' },
        { name: 'Volleyball', start: '1:00 PM', end: '2:00 PM' },
        { name: 'Pickleball (Half Gym)', start: '3:00 PM', end: '4:00 PM' },
      ],
    });
    const next = makeSchedule({ Monday: [] });

    const freed = diffSchedules(prev, next);
    expect(freed).toHaveLength(3);
    const activities = freed.map(s => s.activity).sort();
    expect(activities).toEqual(['Basketball', 'Pickleball (Half Gym)', 'Volleyball']);
  });
});
