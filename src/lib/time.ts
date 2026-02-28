import type { Activity, DaySchedule, GymState, GymStatus, ScheduleData, SportStatus } from './types.js';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Monday-first display order for UI components (DayPicker, WeeklySchedule). */
export const DISPLAY_DAYS: { full: string; short: string }[] = [
  { full: 'Monday', short: 'Mon' },
  { full: 'Tuesday', short: 'Tue' },
  { full: 'Wednesday', short: 'Wed' },
  { full: 'Thursday', short: 'Thu' },
  { full: 'Friday', short: 'Fri' },
  { full: 'Saturday', short: 'Sat' },
  { full: 'Sunday', short: 'Sun' },
];

export function formatEasternDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getEasternNow(): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find(p => p.type === type)!.value);
  return new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
}

export function getEasternDayName(): string {
  return DAYS[getEasternNow().getDay()];
}

export function parseTime(timeStr: string, referenceDate: Date): Date {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return referenceDate;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  const d = new Date(referenceDate);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return '0m';

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Over 1 hour: hours and minutes
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  // Over 5 minutes: minutes only (ceil so each label holds for ~60s)
  if (totalSeconds > 5 * 60) {
    return `${Math.ceil(totalSeconds / 60)}m`;
  }

  // 1–5 minutes: minutes and seconds (urgency zone)
  if (minutes >= 1) {
    return `${minutes}m ${seconds}s`;
  }

  // Under 1 minute: seconds only
  return `${seconds}s`;
}

export function computeGymState(data: ScheduleData): GymState {
  const now = getEasternNow();
  const dayName = getEasternDayName();
  const todaySchedule = data.schedule[dayName] ?? null;

  if (!todaySchedule) {
    return closedState(data, now, dayName);
  }

  const openTime = parseTime(todaySchedule.open, now);
  const closeTime = parseTime(todaySchedule.close, now);

  if (now < openTime || now >= closeTime) {
    return closedState(data, now, dayName);
  }

  // Find current activity
  let currentActivity: Activity | null = null;
  for (const act of todaySchedule.activities) {
    const start = parseTime(act.start, now);
    const end = parseTime(act.end, now);
    if (now >= start && now < end) {
      currentActivity = act;
      break;
    }
  }

  // Path #1: Currently in open gym
  if (currentActivity?.isOpenGym) {
    const end = parseTime(currentActivity.end, now);
    return {
      status: 'available',
      currentActivity,
      nextOpenGym: null,
      nextOpenGymDay: null,
      nextOpenDay: null,
      nextOpenTime: null,
      countdownMs: end.getTime() - now.getTime(),
      countdownLabel: `until ${currentActivity.end}`,
      todaySchedule,
      dayName,
    };
  }

  // Gym is in use or between activities — find next open gym today
  const nextOpen = findNextOpenGym(todaySchedule.activities, now);

  // Paths #2/#3: In a scheduled non-open-gym activity
  if (currentActivity && !currentActivity.isOpenGym) {
    if (nextOpen) {
      // Path #2: same-day open gym coming
      const countdownTarget = parseTime(nextOpen.start, now);
      return {
        status: 'in-use',
        currentActivity,
        nextOpenGym: nextOpen,
        nextOpenGymDay: null,
        nextOpenDay: null,
        nextOpenTime: null,
        countdownMs: countdownTarget.getTime() - now.getTime(),
        countdownLabel: `Next: Open Gym at ${nextOpen.start}`,
        todaySchedule,
        dayName,
      };
    } else {
      // Path #3: no same-day open gym, try cross-day
      const crossDay = findNextOpenGymAcrossDays(data, dayName);
      return {
        status: 'in-use',
        currentActivity,
        nextOpenGym: crossDay?.activity ?? null,
        nextOpenGymDay: crossDay?.day ?? null,
        nextOpenDay: null,
        nextOpenTime: null,
        countdownMs: closeTime.getTime() - now.getTime(),
        countdownLabel: `Closes at ${todaySchedule.close}`,
        todaySchedule,
        dayName,
      };
    }
  }

  // Paths #4a/#4b/#4c: Between activities during open hours
  if (!currentActivity) {
    const nextAny = findNextActivity(todaySchedule.activities, now);
    if (nextAny) {
      const nextStart = parseTime(nextAny.start, now);
      const sameDayOpenGym = nextAny.isOpenGym ? nextAny : findNextOpenGym(todaySchedule.activities, now);
      const crossDay = !sameDayOpenGym ? findNextOpenGymAcrossDays(data, dayName) : null;
      return {
        status: nextAny.isOpenGym ? 'opening-soon' : 'in-use',
        currentActivity: null,
        nextOpenGym: sameDayOpenGym ?? crossDay?.activity ?? null,
        nextOpenGymDay: !sameDayOpenGym ? (crossDay?.day ?? null) : null,
        nextOpenDay: null,
        nextOpenTime: null,
        countdownMs: nextStart.getTime() - now.getTime(),
        countdownLabel: `Next: ${nextAny.name} at ${nextAny.start}`,
        todaySchedule,
        dayName,
      };
    }
  }

  return closedState(data, now, dayName);
}

function findNextOpenGym(activities: Activity[], now: Date): Activity | null {
  for (const act of activities) {
    if (act.isOpenGym && parseTime(act.start, now) > now) {
      return act;
    }
  }
  return null;
}

function findNextActivity(activities: Activity[], now: Date): Activity | null {
  for (const act of activities) {
    if (parseTime(act.start, now) > now) {
      return act;
    }
  }
  return null;
}

/** Find the next day (after currentDay) that has open gym, searching up to 7 days ahead. */
function findNextOpenGymAcrossDays(
  data: ScheduleData, currentDay: string
): { day: string; activity: Activity } | null {
  const dayIdx = DAYS.indexOf(currentDay);
  for (let i = 1; i <= 7; i++) {
    const nextDay = DAYS[(dayIdx + i) % 7];
    const schedule = data.schedule[nextDay];
    if (!schedule) continue;
    const openGym = schedule.activities.find(a => a.isOpenGym);
    if (openGym) return { day: nextDay, activity: openGym };
  }
  return null;
}

/** Check if an activity has ended (for fading past items). */
export function isActivityPast(endTime: string, now: Date, isToday: boolean): boolean {
  if (!isToday) return false;
  return parseTime(endTime, now) <= now;
}

/** Check if an activity is currently happening (for NOW badge). */
export function isActivityCurrent(startTime: string, endTime: string, now: Date, isToday: boolean): boolean {
  if (!isToday) return false;
  return parseTime(startTime, now) <= now && now < parseTime(endTime, now);
}

/** Convert full day name to 3-char abbreviation. */
export function shortDayName(full: string): string {
  return DISPLAY_DAYS.find(d => d.full === full)?.short ?? full.slice(0, 3);
}

/** Status display configuration for each gym status. */
export function getStatusConfig(status: GymStatus) {
  switch (status) {
    case 'available':
      return { icon: '\u2713', label: 'GYM AVAILABLE',  cssClass: 'available',     ariaLabel: 'Gym is available for open play' };
    case 'opening-soon':
      return { icon: '\u23F3', label: 'OPEN GYM SOON',  cssClass: 'opening-soon',  ariaLabel: 'Open Gym is starting soon' };
    case 'in-use':
      return { icon: '\u23F3', label: 'GYM IN USE',     cssClass: 'in-use',        ariaLabel: 'Gym is currently in use for a scheduled activity' };
    case 'closed':
      return { icon: '\u2715', label: 'CLOSED',         cssClass: 'closed',        ariaLabel: 'Community center is currently closed' };
  }
}

export function computeSportStatus(
  schedule: Record<string, DaySchedule>,
  matchFn: (name: string) => boolean,
  now: Date,
  todayName: string,
): SportStatus {
  // Check today first: active or upcoming-today
  const todaySchedule = schedule[todayName];
  if (todaySchedule) {
    for (const act of todaySchedule.activities) {
      if (!matchFn(act.name)) continue;
      if (isActivityCurrent(act.start, act.end, now, true)) {
        return { kind: 'active', activity: act, day: null, time: act.end };
      }
      if (!isActivityPast(act.end, now, true)) {
        return { kind: 'upcoming-today', activity: act, day: null, time: act.start };
      }
    }
  }

  // Scan future days in DISPLAY_DAYS order, starting from the day after today
  const todayIdx = DISPLAY_DAYS.findIndex(d => d.full === todayName);
  const orderedDays = [
    ...DISPLAY_DAYS.slice(todayIdx + 1),
    ...DISPLAY_DAYS.slice(0, todayIdx),
  ];
  for (const d of orderedDays) {
    const daySchedule = schedule[d.full];
    if (!daySchedule) continue;
    for (const act of daySchedule.activities) {
      if (matchFn(act.name)) {
        return { kind: 'upcoming-week', activity: act, day: d.full, time: act.start };
      }
    }
  }

  return { kind: 'none', activity: null, day: null, time: null };
}

function closedState(data: ScheduleData, now: Date, currentDay: string): GymState {
  const todaySchedule = data.schedule[currentDay] ?? null;
  const currentDayIdx = DAYS.indexOf(currentDay);

  // Path #5: Before today's opening
  if (todaySchedule) {
    const openTime = parseTime(todaySchedule.open, now);
    if (now < openTime) {
      const todayOpenGym = todaySchedule.activities.find(a => a.isOpenGym) ?? null;
      const crossDay = !todayOpenGym ? findNextOpenGymAcrossDays(data, currentDay) : null;
      return {
        status: 'closed',
        currentActivity: null,
        nextOpenGym: todayOpenGym ?? crossDay?.activity ?? null,
        nextOpenGymDay: todayOpenGym ? null : (crossDay?.day ?? null),
        nextOpenDay: currentDay,
        nextOpenTime: todaySchedule.open,
        countdownMs: openTime.getTime() - now.getTime(),
        countdownLabel: `${currentDay} at ${todaySchedule.open}`,
        todaySchedule,
        dayName: currentDay,
      };
    }
  }

  // Path #6: After close, find next day with a schedule
  for (let i = 1; i <= 7; i++) {
    const nextDayIdx = (currentDayIdx + i) % 7;
    const nextDay = DAYS[nextDayIdx];
    const nextSchedule = data.schedule[nextDay];
    if (nextSchedule) {
      const nextOpenTime = parseTime(nextSchedule.open, now);
      const msPerDay = 24 * 60 * 60 * 1000;
      const targetMs = now.getTime() + i * msPerDay;
      const target = new Date(targetMs);
      target.setHours(nextOpenTime.getHours(), nextOpenTime.getMinutes(), 0, 0);
      const countdown = target.getTime() - now.getTime();

      // Anchor from nextDay (not currentDay) so nextOpenGymDay is always on/after nextOpenDay.
      // findNextOpenGymAcrossDays starts at i=1 (skips the anchor), so check nextDay itself first.
      const nextDayOpenGym = nextSchedule.activities.find(a => a.isOpenGym) ?? null;
      const crossDay = nextDayOpenGym
        ? { day: nextDay, activity: nextDayOpenGym }
        : findNextOpenGymAcrossDays(data, nextDay);
      return {
        status: 'closed',
        currentActivity: null,
        nextOpenGym: crossDay?.activity ?? null,
        nextOpenGymDay: crossDay?.day ?? null,
        nextOpenDay: nextDay,
        nextOpenTime: nextSchedule.open,
        countdownMs: Math.max(0, countdown),
        countdownLabel: `${nextDay} at ${nextSchedule.open}`,
        todaySchedule: todaySchedule,
        dayName: currentDay,
      };
    }
  }

  // Path #7: No schedule anywhere
  return {
    status: 'closed',
    currentActivity: null,
    nextOpenGym: null,
    nextOpenGymDay: null,
    nextOpenDay: null,
    nextOpenTime: null,
    countdownMs: 0,
    countdownLabel: '',
    todaySchedule: null,
    dayName: currentDay,
  };
}
