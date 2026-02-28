import type { Activity, DaySchedule, Notice } from '../src/lib/types.js';

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Time range regex for patterns like "9:00 a.m. to 12:00 p.m.", "7:00 AM - 9:00 PM", or "9a – 4:30pm"
export const TIME_RANGE_RE = /(\d{1,2}(?::\d{2})?\s*(?:AM?|PM?|am?|pm?|a\.m?\.?|p\.m?\.?))\s*(?:to|-|–)\s*(\d{1,2}(?::\d{2})?\s*(?:AM?|PM?|am?|pm?|a\.m?\.?|p\.m?\.?))/i;

export interface DayParseInfo {
  day: string;
  dateStr: string; // ISO date from the header, e.g. "2026-02-13"
  gymClosed: boolean;
  openGymStart: string | null;
  openGymEnd: string | null;
  scheduledActivities: Activity[];
}

// Normalize time strings like "9:00 a.m.", "12:00 PM" to "H:MM AM/PM"
export function normalizeTime(raw: string): string {
  const t = raw.trim().replace(/\./g, '').replace(/\s+/g, ' ').toUpperCase();
  const match = t.match(/(\d{1,2}):?(\d{2})?\s*(AM?|PM?)/);
  if (match) {
    const period = match[3].length === 1 ? match[3] + 'M' : match[3]; // "A"→"AM", "P"→"PM"
    return `${match[1]}:${match[2] || '00'} ${period}`;
  }
  return t;
}

// Strict format check for normalized "H:MM AM/PM" times
export function isValidTime(timeStr: string): boolean {
  return /^\d{1,2}:\d{2} (AM|PM)$/.test(timeStr.trim());
}

// Parse "H:MM AM/PM" to minutes since midnight
export function parseTimeMinutes(timeStr: string): number {
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return 0;
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const period = match[3].toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

// Convert minutes since midnight to "H:MM AM/PM"
export function minutesToTime(minutes: number): string {
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;
  return `${hours12}:${mins.toString().padStart(2, '0')} ${period}`;
}

const MONTHS: Record<string, string> = {
  January: '01', February: '02', March: '03', April: '04',
  May: '05', June: '06', July: '07', August: '08',
  September: '09', October: '10', November: '11', December: '12',
};

// Parse "February 13" + optional reference year into "2026-02-13"
// Avoids Date object to prevent TZ issues.
export function parseHeaderDate(monthName: string, dayNum: string, referenceYear?: number): string {
  const month = MONTHS[monthName] || '01';
  const day = dayNum.padStart(2, '0');
  let year = referenceYear ?? new Date().getFullYear();
  // Handle year boundary: if parsed month is far ahead of current month,
  // it's likely from the previous year (e.g. Dec header scraped in Jan)
  const refMonth = referenceYear != null
    ? parseInt(month) // when explicit year given, no adjustment needed
    : new Date().getMonth() + 1;
  const parsedMonth = parseInt(month);
  if (referenceYear == null) {
    if (parsedMonth - refMonth > 6) year--;
    if (refMonth - parsedMonth > 6) year++;
  }
  return `${year}-${month}-${day}`;
}

// Parse the community center general hours from the page text.
// Looks for lines like "Monday through Friday - 7:00 a.m. to 9:00 p.m."
export function parseCenterHours(lines: string[]): Record<string, { open: string; close: string }> {
  const hours: Record<string, { open: string; close: string }> = {
    Monday: { open: '7:00 AM', close: '9:00 PM' },
    Tuesday: { open: '7:00 AM', close: '9:00 PM' },
    Wednesday: { open: '7:00 AM', close: '9:00 PM' },
    Thursday: { open: '7:00 AM', close: '9:00 PM' },
    Friday: { open: '7:00 AM', close: '9:00 PM' },
    Saturday: { open: '9:00 AM', close: '9:00 PM' },
    Sunday: { open: '9:00 AM', close: '5:00 PM' },
  };

  for (const line of lines) {
    // "Monday through Friday - 7:00 a.m. to 9:00 p.m."
    if (/monday\s+through\s+friday/i.test(line)) {
      const tm = line.match(TIME_RANGE_RE);
      if (tm) {
        const open = normalizeTime(tm[1]);
        const close = normalizeTime(tm[2]);
        for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
          hours[day] = { open, close };
        }
      }
    }
    // "Saturday - 9:00 a.m. to 9:00 p.m." (skip day headers like "Saturday, February 14 - ...")
    if (/^saturday\s*[-–]/i.test(line) && !/,\s*\w+\s+\d+/i.test(line)) {
      const tm = line.match(TIME_RANGE_RE);
      if (tm) hours.Saturday = { open: normalizeTime(tm[1]), close: normalizeTime(tm[2]) };
    }
    // "Sunday - 9:00 a.m. to 5:00 p.m."
    if (/^sunday\s*[-–]/i.test(line) && !/,\s*\w+\s+\d+/i.test(line)) {
      const tm = line.match(TIME_RANGE_RE);
      if (tm) hours.Sunday = { open: normalizeTime(tm[1]), close: normalizeTime(tm[2]) };
    }
  }

  return hours;
}

export function parseSchedule(
  text: string,
  referenceYear?: number,
): { schedule: Record<string, DaySchedule>; notices: Notice[] } {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const centerHours = parseCenterHours(lines);

  // Find the "Open Gym Hours" section
  const openGymIdx = lines.findIndex(l => /^open\s+gym\s+hours$/i.test(l));
  const dayInfos: DayParseInfo[] = [];
  const notices: Notice[] = [];

  if (openGymIdx !== -1) {
    // Day header: "Monday, February 9 - 7:00 a.m. to 5:00 p.m." or "Friday, February 13 - Gym Closed"
    const dayHeaderRe = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(\w+)\s+(\d+)\s*[-–]\s*(.*)/i;
    // Activity: "Pickleball (Half Gym): 9:00 a.m. to 12:00 p.m." or "Basketball: 9a – 4:30pm"
    const activityRe = /^(.+?):\s*(\d{1,2}(?::\d{2})?\s*(?:a\.?m?\.?|p\.?m?\.?))\s*(?:to|-|–)\s*(\d{1,2}(?::\d{2})?\s*(?:a\.?m?\.?|p\.?m?\.?))/i;
    // Cancelled: "Indoor Tennis: Cancelled"
    const cancelledRe = /:\s*cancell?ed/i;

    let current: DayParseInfo | null = null;

    for (let i = openGymIdx + 1; i < lines.length; i++) {
      const line = lines[i];

      // Stop at non-schedule sections
      if (/^(Recreation\s+&\s+Parks|Program\s+Announcements|Resource\s+Links|Department\s+Directory|How\s+To\s+Reach)/i.test(line)) break;

      // Day header?
      const headerMatch = line.match(dayHeaderRe);
      if (headerMatch) {
        if (current) dayInfos.push(current);

        const dayName = headerMatch[1].charAt(0).toUpperCase() + headerMatch[1].slice(1).toLowerCase();
        const monthName = headerMatch[2];
        const dayNum = headerMatch[3];
        const dateStr = parseHeaderDate(monthName, dayNum, referenceYear);
        const rest = headerMatch[4].trim();

        if (/gym\s*closed/i.test(rest)) {
          current = { day: dayName, dateStr, gymClosed: true, openGymStart: null, openGymEnd: null, scheduledActivities: [] };
          notices.push({ text: line, date: dateStr });
        } else {
          const tm = rest.match(TIME_RANGE_RE);
          current = {
            day: dayName,
            dateStr,
            gymClosed: false,
            openGymStart: tm ? normalizeTime(tm[1]) : null,
            openGymEnd: tm ? normalizeTime(tm[2]) : null,
            scheduledActivities: [],
          };
        }
        continue;
      }

      if (!current) continue;

      // Cancelled activity → add to notices, skip
      if (cancelledRe.test(line)) {
        notices.push({ text: line, date: current.dateStr });
        continue;
      }

      // Scheduled activity?
      const actMatch = line.match(activityRe);
      if (actMatch) {
        current.scheduledActivities.push({
          name: actMatch[1].trim(),
          start: normalizeTime(actMatch[2]),
          end: normalizeTime(actMatch[3]),
          isOpenGym: false,
        });
      }
    }
    if (current) dayInfos.push(current);
  }

  // Build final schedule: compute open gym slots from gaps
  const schedule: Record<string, DaySchedule> = {};

  for (const day of DAYS) {
    const info = dayInfos.find(d => d.day === day);
    const hours = centerHours[day];

    // Extend close time if any activity runs past default close
    let closeTime = hours.close;
    if (info) {
      for (const act of info.scheduledActivities) {
        if (parseTimeMinutes(act.end) > parseTimeMinutes(closeTime)) {
          closeTime = act.end;
        }
      }
    }

    const daySchedule: DaySchedule = {
      open: hours.open,
      close: closeTime,
      activities: [],
    };

    if (info && !info.gymClosed) {
      const activities: Activity[] = [];

      if (info.openGymStart && info.openGymEnd) {
        const ogStart = parseTimeMinutes(info.openGymStart);
        const ogEnd = parseTimeMinutes(info.openGymEnd);

        // Sort scheduled activities by start time
        const sorted = [...info.scheduledActivities].sort(
          (a, b) => parseTimeMinutes(a.start) - parseTimeMinutes(b.start)
        );

        // Fill gaps within the open gym window with "Open Gym" slots
        let cursor = ogStart;
        for (const act of sorted) {
          const actStart = parseTimeMinutes(act.start);
          const actEnd = parseTimeMinutes(act.end);

          // Gap before this activity within the open gym window?
          if (cursor < ogEnd && actStart > cursor) {
            const gapEnd = Math.min(actStart, ogEnd);
            if (gapEnd > cursor) {
              activities.push({
                name: 'Open Gym',
                start: minutesToTime(cursor),
                end: minutesToTime(gapEnd),
                isOpenGym: true,
              });
            }
          }

          activities.push(act);
          cursor = Math.max(cursor, actEnd);
        }

        // Remaining open gym time after last scheduled activity
        if (cursor < ogEnd) {
          activities.push({
            name: 'Open Gym',
            start: minutesToTime(cursor),
            end: minutesToTime(ogEnd),
            isOpenGym: true,
          });
        }
      } else {
        // No open gym range parsed, just include scheduled activities
        activities.push(...info.scheduledActivities);
      }

      activities.sort((a, b) => parseTimeMinutes(a.start) - parseTimeMinutes(b.start));
      daySchedule.activities = activities;
    } else if (info?.gymClosed) {
      // Gym closed but may still have non-gym events
      daySchedule.activities = info.scheduledActivities;
    }

    schedule[day] = daySchedule;
  }

  return { schedule, notices };
}
