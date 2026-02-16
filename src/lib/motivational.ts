export type TimeBucket = 'plenty' | 'good' | 'winding' | 'last';

export interface MessageData {
  plenty: string[];
  good: string[];
  winding: string[];
  last: string[];
  contextual: Record<string, string[]>;
}

export function getTimeBucket(ms: number): TimeBucket {
  const minutes = ms / 60_000;
  if (minutes >= 120) return 'plenty';
  if (minutes >= 60) return 'good';
  if (minutes >= 30) return 'winding';
  return 'last';
}

export function getSeason(month: number): string {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'fall';
  return 'winter';
}

export function buildCandidatePool(
  data: MessageData,
  bucket: TimeBucket,
  dayName: string,
  month: number,
  day: number
): string[] {
  const pool = [...data[bucket]];
  const ctx = data.contextual;
  const dateKey = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const season = getSeason(month);

  // Add contextual messages with weighting
  if (ctx[dateKey]) pool.push(...ctx[dateKey], ...ctx[dateKey], ...ctx[dateKey]); // 3x
  if (ctx[dayName]) pool.push(...ctx[dayName], ...ctx[dayName]);                  // 2x
  if (ctx[season]) pool.push(...ctx[season]);                                      // 1x

  return pool;
}

// localStorage helpers
const STORAGE_KEY = 'flcc-seen-messages';

function getSeenSet(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveSeen(seen: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]));
  } catch { /* quota exceeded — degrade gracefully */ }
}

export function pickMessage(pool: string[]): string {
  if (!pool.length) return '';

  const seen = getSeenSet();
  let unseen = pool.filter(m => !seen.has(m));

  // All seen → reset
  if (unseen.length === 0) {
    seen.clear();
    saveSeen(seen);
    unseen = pool;
  }

  const pick = unseen[Math.floor(Math.random() * unseen.length)];
  seen.add(pick);
  saveSeen(seen);
  return pick;
}
