import { describe, it, expect } from 'vitest';
import type { ScheduleData, DaySchedule } from '../src/lib/types.js';
import { DAYS } from './parse.js';
import { validateSchedule } from './validate.js';

/** Returns a well-formed ScheduleData that passes all validation rules. */
function makeValidData(): ScheduleData {
  const ACTIVITY_TIMES = [
    { start: '9:00 AM', end: '10:00 AM' },
    { start: '10:00 AM', end: '11:00 AM' },
    { start: '1:00 PM', end: '2:00 PM' },
  ];

  const makeDay = (open: string, close: string, activityCount: number): DaySchedule => ({
    open,
    close,
    activities: ACTIVITY_TIMES.slice(0, activityCount).map((t, i) => ({
      name: `Activity ${i + 1}`,
      ...t,
      isOpenGym: false,
    })),
  });

  const schedule: Record<string, DaySchedule> = {};
  // 5 weekdays with 3 activities each = 15 total, 2 weekend days with 0
  for (const day of DAYS) {
    if (day === 'Saturday' || day === 'Sunday') {
      schedule[day] = makeDay('9:00 AM', '5:00 PM', 0);
    } else {
      schedule[day] = makeDay('7:00 AM', '9:00 PM', 3);
    }
  }

  return {
    scrapedAt: '2026-02-16T05:00:00.000Z',
    schedule,
    notices: [],
  };
}

describe('validateSchedule', () => {
  it('passes for well-formed data', () => {
    const result = validateSchedule(makeValidData());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('passes when 5 days have activities and 2 are empty', () => {
    const data = makeValidData();
    // Default factory already has 5 weekdays with activities, 2 weekend days empty
    const result = validateSchedule(data);
    expect(result.valid).toBe(true);
  });

  it('fails when scrapedAt is empty', () => {
    const data = makeValidData();
    data.scrapedAt = '';
    const result = validateSchedule(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('scrapedAt is missing or not a valid date');
  });

  it('fails when scrapedAt is not a valid date', () => {
    const data = makeValidData();
    data.scrapedAt = 'not-a-date';
    const result = validateSchedule(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('scrapedAt is missing or not a valid date');
  });

  it('fails when a day is missing from schedule', () => {
    const data = makeValidData();
    delete data.schedule['Wednesday'];
    const result = validateSchedule(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing day: Wednesday');
  });

  it('reports each missing day separately', () => {
    const data = makeValidData();
    delete data.schedule['Monday'];
    delete data.schedule['Friday'];
    const result = validateSchedule(data);
    expect(result.errors).toContain('Missing day: Monday');
    expect(result.errors).toContain('Missing day: Friday');
  });

  it('fails when fewer than 3 days have activities', () => {
    const data = makeValidData();
    // Clear all but 2 days
    for (const day of DAYS.slice(2)) {
      data.schedule[day].activities = [];
    }
    const result = validateSchedule(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('day(s) have activities'))).toBe(true);
  });

  it('fails when total activities are fewer than 10', () => {
    const data = makeValidData();
    // Reduce to 3 activities per day for 3 days = 9 total
    for (const day of DAYS) {
      data.schedule[day].activities = [];
    }
    for (const day of DAYS.slice(0, 3)) {
      data.schedule[day].activities = [
        { name: 'A1', start: '9:00 AM', end: '10:00 AM', isOpenGym: false },
        { name: 'A2', start: '10:00 AM', end: '11:00 AM', isOpenGym: false },
        { name: 'A3', start: '11:00 AM', end: '12:00 PM', isOpenGym: false },
      ];
    }
    const result = validateSchedule(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('total activities'))).toBe(true);
  });

  it('fails when open/close times have invalid format', () => {
    const data = makeValidData();
    data.schedule['Monday'].open = 'invalid';
    data.schedule['Monday'].close = '25:00 ZZ';
    const result = validateSchedule(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Monday') && e.includes('invalid open time'))).toBe(true);
    expect(result.errors.some(e => e.includes('Monday') && e.includes('invalid close time'))).toBe(true);
  });

  it('fails when close time is not after open time', () => {
    const data = makeValidData();
    data.schedule['Tuesday'].open = '9:00 PM';
    data.schedule['Tuesday'].close = '7:00 AM';
    const result = validateSchedule(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Tuesday') && e.includes('close time'))).toBe(true);
  });

  it('fails when activity has invalid start/end times', () => {
    const data = makeValidData();
    data.schedule['Monday'].activities[0].start = 'bad';
    data.schedule['Monday'].activities[0].end = 'worse';
    const result = validateSchedule(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('invalid start time'))).toBe(true);
    expect(result.errors.some(e => e.includes('invalid end time'))).toBe(true);
  });

  it('fails when activity start is not before end', () => {
    const data = makeValidData();
    data.schedule['Wednesday'].activities[0] = {
      name: 'Backwards',
      start: '3:00 PM',
      end: '1:00 PM',
      isOpenGym: false,
    };
    const result = validateSchedule(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Backwards') && e.includes('not before end'))).toBe(true);
  });

  it('collects multiple errors from different rules', () => {
    const data = makeValidData();
    data.scrapedAt = '';
    data.schedule['Monday'].open = 'nope';
    data.schedule['Wednesday'].activities[0].start = 'bad';
    const result = validateSchedule(data);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});
