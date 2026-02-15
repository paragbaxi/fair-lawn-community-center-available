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

export interface ScheduleData {
  scrapedAt: string;
  schedule: Record<string, DaySchedule>;
  notices: string[];
}

export type GymStatus = 'available' | 'in-use' | 'closed';

export interface GymState {
  status: GymStatus;
  currentActivity: Activity | null;
  nextOpenGym: Activity | null;
  nextOpenDay: string | null;
  nextOpenTime: string | null;
  countdownMs: number;
  countdownLabel: string;
  todaySchedule: DaySchedule | null;
  dayName: string;
}
