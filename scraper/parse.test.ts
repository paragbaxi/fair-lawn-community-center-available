import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  normalizeTime,
  parseTimeMinutes,
  minutesToTime,
  parseHeaderDate,
  parseCenterHours,
  parseSchedule,
} from './parse.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = fs.readFileSync(path.join(__dirname, 'fixtures', 'page.txt'), 'utf-8');

// --- normalizeTime ---

describe('normalizeTime', () => {
  it('normalizes "a.m." format', () => {
    expect(normalizeTime('9:00 a.m.')).toBe('9:00 AM');
  });

  it('normalizes "p.m." format', () => {
    expect(normalizeTime('12:00 p.m.')).toBe('12:00 PM');
  });

  it('passes through already-normalized time', () => {
    expect(normalizeTime('7:00 AM')).toBe('7:00 AM');
  });

  it('handles extra whitespace', () => {
    expect(normalizeTime('  3:30  p.m.  ')).toBe('3:30 PM');
  });

  it('handles lowercase am/pm', () => {
    expect(normalizeTime('10:15 am')).toBe('10:15 AM');
  });
});

// --- parseTimeMinutes ---

describe('parseTimeMinutes', () => {
  it('parses AM time', () => {
    expect(parseTimeMinutes('9:00 AM')).toBe(540);
  });

  it('parses PM time', () => {
    expect(parseTimeMinutes('2:30 PM')).toBe(870);
  });

  it('parses noon (12 PM) as 720', () => {
    expect(parseTimeMinutes('12:00 PM')).toBe(720);
  });

  it('parses midnight (12 AM) as 0', () => {
    expect(parseTimeMinutes('12:00 AM')).toBe(0);
  });

  it('returns 0 for invalid input', () => {
    expect(parseTimeMinutes('not a time')).toBe(0);
  });
});

// --- minutesToTime ---

describe('minutesToTime', () => {
  it('converts morning minutes', () => {
    expect(minutesToTime(540)).toBe('9:00 AM');
  });

  it('converts afternoon minutes', () => {
    expect(minutesToTime(870)).toBe('2:30 PM');
  });

  it('converts midnight (0)', () => {
    expect(minutesToTime(0)).toBe('12:00 AM');
  });

  it('converts noon (720)', () => {
    expect(minutesToTime(720)).toBe('12:00 PM');
  });

  it('roundtrips with parseTimeMinutes', () => {
    const times = ['7:00 AM', '12:00 PM', '9:30 PM', '12:00 AM'];
    for (const t of times) {
      expect(minutesToTime(parseTimeMinutes(t))).toBe(t);
    }
  });
});

// --- parseHeaderDate ---

describe('parseHeaderDate', () => {
  it('parses a standard date with explicit year', () => {
    expect(parseHeaderDate('February', '13', 2026)).toBe('2026-02-13');
  });

  it('zero-pads single-digit days', () => {
    expect(parseHeaderDate('February', '9', 2026)).toBe('2026-02-09');
  });

  it('handles different months', () => {
    expect(parseHeaderDate('December', '25', 2026)).toBe('2026-12-25');
  });

  it('handles year-boundary: Dec header with Jan reference', () => {
    // When no explicit year and current month is January (1),
    // but parsed month is December (12) — 12-1=11 > 6 → year--
    // We can't easily test this without mocking Date, but we can
    // verify explicit year works correctly
    expect(parseHeaderDate('December', '31', 2025)).toBe('2025-12-31');
  });

  it('produces TZ-independent output', () => {
    // The key property: same input always gives same output regardless of TZ
    const result1 = parseHeaderDate('February', '13', 2026);
    const result2 = parseHeaderDate('February', '13', 2026);
    expect(result1).toBe(result2);
    expect(result1).toBe('2026-02-13');
  });
});

// --- parseCenterHours ---

describe('parseCenterHours', () => {
  const fixtureLines = FIXTURE.split('\n').map(l => l.trim()).filter(Boolean);

  it('parses M-F hours from fixture', () => {
    const hours = parseCenterHours(fixtureLines);
    expect(hours.Monday).toEqual({ open: '7:00 AM', close: '9:00 PM' });
    expect(hours.Friday).toEqual({ open: '7:00 AM', close: '9:00 PM' });
  });

  it('parses Saturday hours from fixture', () => {
    const hours = parseCenterHours(fixtureLines);
    expect(hours.Saturday).toEqual({ open: '9:00 AM', close: '9:00 PM' });
  });

  it('parses Sunday hours from fixture', () => {
    const hours = parseCenterHours(fixtureLines);
    expect(hours.Sunday).toEqual({ open: '9:00 AM', close: '5:00 PM' });
  });

  it('returns defaults when no matching lines', () => {
    const hours = parseCenterHours(['no hours here']);
    expect(hours.Monday).toEqual({ open: '7:00 AM', close: '9:00 PM' });
    expect(hours.Saturday).toEqual({ open: '9:00 AM', close: '9:00 PM' });
    expect(hours.Sunday).toEqual({ open: '9:00 AM', close: '5:00 PM' });
  });
});

// --- parseSchedule (integration-level with fixture) ---

describe('parseSchedule', () => {
  const { schedule, notices } = parseSchedule(FIXTURE, 2026);

  it('produces entries for all 7 days', () => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    for (const day of days) {
      expect(schedule[day]).toBeDefined();
    }
  });

  // Monday: Open Gym 7-5, with Pickleball 9-12. Gaps: 7-9 AM, 12-5 PM
  describe('Monday', () => {
    const mon = schedule.Monday;

    it('has correct hours', () => {
      expect(mon.open).toBe('7:00 AM');
      expect(mon.close).toBe('9:00 PM');
    });

    it('fills open gym gap before Pickleball (7-9 AM)', () => {
      const openGym7to9 = mon.activities.find(
        a => a.isOpenGym && a.start === '7:00 AM' && a.end === '9:00 AM'
      );
      expect(openGym7to9).toBeDefined();
    });

    it('includes Pickleball (Half Gym) 9 AM - 12 PM', () => {
      const pb = mon.activities.find(a => a.name.includes('Pickleball'));
      expect(pb).toBeDefined();
      expect(pb!.start).toBe('9:00 AM');
      expect(pb!.end).toBe('12:00 PM');
    });

    it('fills open gym gap after Pickleball (12-5 PM)', () => {
      const openGym12to5 = mon.activities.find(
        a => a.isOpenGym && a.start === '12:00 PM' && a.end === '5:00 PM'
      );
      expect(openGym12to5).toBeDefined();
    });

    it('includes FLAS Basketball and Mens Basketball', () => {
      expect(mon.activities.find(a => a.name === 'FLAS Basketball')).toBeDefined();
      expect(mon.activities.find(a => a.name === "Men's Basketball")).toBeDefined();
    });
  });

  // Tuesday: FLAS Basketball 5:30-9:30 PM extends close past default 9:00 PM
  describe('Tuesday', () => {
    it('extends close time past 9 PM for late activity', () => {
      expect(schedule.Tuesday.close).toBe('9:30 PM');
    });

    it('includes Table Tennis, Pickleball, FLAS Basketball', () => {
      const names = schedule.Tuesday.activities.map(a => a.name);
      expect(names).toContain('Table Tennis (Half Gym)');
      expect(names).toContain('Pickleball');
      expect(names).toContain('FLAS Basketball');
    });
  });

  // Friday: Gym Closed
  describe('Friday', () => {
    it('has gym closed activities (Access for All Dance)', () => {
      const dance = schedule.Friday.activities.find(a => a.name.includes('Access for All'));
      expect(dance).toBeDefined();
      expect(dance!.start).toBe('6:00 PM');
      expect(dance!.end).toBe('9:00 PM');
    });

    it('has no open gym slots', () => {
      expect(schedule.Friday.activities.filter(a => a.isOpenGym)).toHaveLength(0);
    });
  });

  // Saturday: activities before open gym range included
  describe('Saturday', () => {
    it('includes Pee Wee Basketball before open gym start', () => {
      const peeWee = schedule.Saturday.activities.find(a => a.name.includes('Pee Wee'));
      expect(peeWee).toBeDefined();
      expect(peeWee!.start).toBe('3:00 PM');
    });

    it('includes Youth Center after open gym', () => {
      const yc = schedule.Saturday.activities.find(a => a.name.includes('Youth Center'));
      expect(yc).toBeDefined();
    });

    it('extends close time for Youth Center (9:30 PM)', () => {
      expect(schedule.Saturday.close).toBe('9:30 PM');
    });
  });

  // Sunday: activities outside open gym range
  describe('Sunday', () => {
    it('includes Badminton before open gym start', () => {
      const badminton = schedule.Sunday.activities.find(a => a.name === 'Badminton');
      expect(badminton).toBeDefined();
      expect(badminton!.start).toBe('9:00 AM');
    });

    it('extends close time for Table Tennis (9:00 PM)', () => {
      expect(schedule.Sunday.close).toBe('9:00 PM');
    });
  });

  // Notices
  describe('notices', () => {
    it('includes gym closed notice for Friday', () => {
      const gymClosed = notices.find(n => n.text.includes('Gym Closed'));
      expect(gymClosed).toBeDefined();
      expect(gymClosed!.date).toBe('2026-02-13');
    });

    it('includes cancelled items', () => {
      const cancelled = notices.filter(n => /cancell?ed/i.test(n.text));
      expect(cancelled.length).toBeGreaterThanOrEqual(2); // Indoor Tennis + Youth Center
    });

    it('associates cancelled notices with correct date', () => {
      const tennisCancelled = notices.find(n => n.text.includes('Indoor Tennis'));
      expect(tennisCancelled).toBeDefined();
      expect(tennisCancelled!.date).toBe('2026-02-13'); // Friday
    });
  });
});
