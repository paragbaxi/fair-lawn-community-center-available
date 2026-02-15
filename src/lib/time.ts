import type { Activity, DaySchedule, GymState, ScheduleData } from './types.js';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function getEasternNow(): Date {
  const str = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
  return new Date(str);
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

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
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

  if (currentActivity?.isOpenGym) {
    const end = parseTime(currentActivity.end, now);
    return {
      status: 'available',
      currentActivity,
      nextOpenGym: null,
      nextOpenDay: null,
      nextOpenTime: null,
      countdownMs: end.getTime() - now.getTime(),
      countdownLabel: `until ${currentActivity.end}`,
      todaySchedule,
      dayName,
    };
  }

  // Gym is in use or between activities — find next open gym
  const nextOpen = findNextOpenGym(todaySchedule.activities, now);

  if (currentActivity && !currentActivity.isOpenGym) {
    const countdownTarget = nextOpen
      ? parseTime(nextOpen.start, now)
      : closeTime;

    return {
      status: 'in-use',
      currentActivity,
      nextOpenGym: nextOpen,
      nextOpenDay: null,
      nextOpenTime: null,
      countdownMs: countdownTarget.getTime() - now.getTime(),
      countdownLabel: nextOpen ? `Next: Open Gym at ${nextOpen.start}` : `Closes at ${todaySchedule.close}`,
      todaySchedule,
      dayName,
    };
  }

  // Between activities during open hours — check if it's effectively open gym
  if (!currentActivity) {
    // No explicit activity right now during open hours
    // Check if next activity is soon
    const nextAny = findNextActivity(todaySchedule.activities, now);
    if (nextAny) {
      const nextStart = parseTime(nextAny.start, now);
      return {
        status: nextAny.isOpenGym ? 'available' : 'in-use',
        currentActivity: null,
        nextOpenGym: nextAny.isOpenGym ? nextAny : findNextOpenGym(todaySchedule.activities, now),
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

function closedState(data: ScheduleData, now: Date, currentDay: string): GymState {
  // Find next opening
  const todaySchedule = data.schedule[currentDay] ?? null;
  const currentDayIdx = DAYS.indexOf(currentDay);

  // Check if still before today's opening
  if (todaySchedule) {
    const openTime = parseTime(todaySchedule.open, now);
    if (now < openTime) {
      return {
        status: 'closed',
        currentActivity: null,
        nextOpenGym: null,
        nextOpenDay: currentDay,
        nextOpenTime: todaySchedule.open,
        countdownMs: openTime.getTime() - now.getTime(),
        countdownLabel: `${currentDay} at ${todaySchedule.open}`,
        todaySchedule,
        dayName: currentDay,
      };
    }
  }

  // Find next day with a schedule
  for (let i = 1; i <= 7; i++) {
    const nextDayIdx = (currentDayIdx + i) % 7;
    const nextDay = DAYS[nextDayIdx];
    const nextSchedule = data.schedule[nextDay];
    if (nextSchedule) {
      const nextOpen = parseTime(nextSchedule.open, now);
      // Calculate ms until next opening (approximate — add days)
      const msPerDay = 24 * 60 * 60 * 1000;
      let daysUntil = i;
      // If after close today, we need to go to the next occurrence
      const targetMs = now.getTime() + daysUntil * msPerDay;
      const target = new Date(targetMs);
      target.setHours(nextOpen.getHours(), nextOpen.getMinutes(), 0, 0);
      const countdown = target.getTime() - now.getTime();

      return {
        status: 'closed',
        currentActivity: null,
        nextOpenGym: null,
        nextOpenDay: nextDay,
        nextOpenTime: nextSchedule.open,
        countdownMs: Math.max(0, countdown),
        countdownLabel: `${nextDay} at ${nextSchedule.open}`,
        todaySchedule: todaySchedule,
        dayName: currentDay,
      };
    }
  }

  return {
    status: 'closed',
    currentActivity: null,
    nextOpenGym: null,
    nextOpenDay: null,
    nextOpenTime: null,
    countdownMs: 0,
    countdownLabel: '',
    todaySchedule: null,
    dayName: currentDay,
  };
}
