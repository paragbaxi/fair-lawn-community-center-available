export interface Activity {
  name: string;
  start: string;
  end: string;
  isOpenGym: boolean;
}

export interface DaySchedule {
  open: string;
  close: string;
  activities: Activity[];
}

export interface Notice {
  text: string;
  date: string; // ISO date, e.g. "2026-02-13"
}

export interface ScheduleData {
  scrapedAt: string;
  schedule: Record<string, DaySchedule>;
  notices: Notice[];
}

export type GymStatus = 'available' | 'in-use' | 'closed';

export type TabId = 'status' | 'today' | 'sports';

export interface NotifPrefs {
  thirtyMin: boolean;
  dailyBriefing: boolean;
  sports?: string[];   // optional; defaults to [] on read; e.g. ['basketball']
}

// Keep types.ts pure (no logic imports) to avoid circular dependencies.
export const VALID_TABS: TabId[] = ['status', 'today', 'sports'];

export interface GymState {
  status: GymStatus;
  currentActivity: Activity | null;
  nextOpenGym: Activity | null;
  nextOpenGymDay: string | null;
  nextOpenDay: string | null;
  nextOpenTime: string | null;
  countdownMs: number;
  countdownLabel: string;
  todaySchedule: DaySchedule | null;
  dayName: string;
}

export type SportStatus =
  | { kind: 'active';         activity: Activity; day: null;   time: string }
  | { kind: 'upcoming-today'; activity: Activity; day: null;   time: string }
  | { kind: 'upcoming-week';  activity: Activity; day: string; time: string }
  | { kind: 'none';           activity: null;     day: null;   time: null   };
