/**
 * check-and-notify.mjs
 *
 * Reads public/data/latest.json, finds open gym activities starting in 20-45
 * minutes (Eastern time), then POSTs to the Cloudflare Worker /notify endpoint.
 *
 * Usage:
 *   node scripts/check-and-notify.mjs --type=30min
 *   node scripts/check-and-notify.mjs --type=30min --force
 *
 * Env vars required:
 *   CLOUDFLARE_WORKER_URL  - base URL of the deployed Worker (no trailing slash)
 *   NOTIFY_API_KEY         - shared secret for Worker auth
 *
 * Exit 0 on all outcomes — notifications are best-effort; must not fail CI.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const type = args.find((a) => a.startsWith('--type='))?.split('=')[1] ?? '30min';
const force = args.includes('--force');

if (type !== '30min') {
  console.error(`Unknown type: ${type}. Only '30min' is supported.`);
  process.exit(0);
}

// ─── Sport patterns ───────────────────────────────────────────────────────────
// SYNC: Must match FILTER_CATEGORIES in src/lib/filters.ts

const SPORT_PATTERNS = [
  { id: 'basketball',   label: 'Basketball',   match: (n) => /basketball/i.test(n) },
  { id: 'pickleball',   label: 'Pickleball',   match: (n) => /pickleball/i.test(n) },
  { id: 'table-tennis', label: 'Table Tennis', match: (n) => /table tennis/i.test(n) },
  { id: 'volleyball',   label: 'Volleyball',   match: (n) => /volleyball/i.test(n) },
  { id: 'badminton',    label: 'Badminton',    match: (n) => /badminton/i.test(n) },
  { id: 'tennis',       label: 'Tennis',       match: (n) => /tennis/i.test(n) && !/table tennis/i.test(n) },
  { id: 'youth',        label: 'Youth',        match: (n) => /youth center/i.test(n) },
];

// ─── Config ──────────────────────────────────────────────────────────────────

const WORKER_URL = process.env.CLOUDFLARE_WORKER_URL;
const API_KEY = process.env.NOTIFY_API_KEY;
const WINDOW_MIN = 20;
const WINDOW_MAX = 45;

if (!WORKER_URL || !API_KEY) {
  console.error('Missing CLOUDFLARE_WORKER_URL or NOTIFY_API_KEY env vars');
  process.exit(0);
}

// ─── Time helpers (verbatim from src/lib/time.ts) ───────────────────────────

/**
 * Returns a Date whose *local* (host-timezone) components equal the current
 * Eastern wall-clock time.  On a UTC host (GitHub Actions) this means the
 * returned Date's epoch is shifted 4–5 hours earlier than the true Eastern
 * epoch, but `.getHours()` / `.getDay()` / `.getDate()` etc. all return the
 * correct Eastern values when the host is UTC.
 *
 * All downstream helpers (parseActivityTime, getEasternDayName,
 * getEasternIsoDate) receive this same Date and operate consistently within
 * this "Eastern-as-local" coordinate system:
 *
 *   • parseActivityTime copies `now` then calls d.setHours(...) — on a UTC
 *     host setHours writes UTC hours — so the resulting start/end Date is in
 *     the same coordinate system.  The subtraction `(start - now) / 60000`
 *     therefore yields the correct minute difference (the shared offset
 *     cancels).
 *
 *   • getEasternDayName / getEasternIsoDate pass `now` to Intl.DateTimeFormat
 *     with timeZone:'America/New_York', which uses the epoch.  Because the
 *     epoch is shifted early by the UTC offset, the Intl formatter would show
 *     the *previous* calendar day for Eastern times between midnight and the
 *     UTC offset (00:00–04:59 ET in summer, 00:00–05:59 ET in winter).
 *     The gym-hours guard `now.getHours() < 8` exits before any of those
 *     helpers are called, so in practice this never fires.
 *
 * FRAGILITY NOTE: Do not pass `now` to any code that interprets its epoch as
 * true Eastern time (e.g. comparing against a real-epoch Date, calling
 * now.toISOString(), or passing to Intl formatters outside the guarded path).
 * If you need a truly correct epoch, construct `new Date()` directly and
 * format it with timeZone:'America/New_York'.
 */
function getEasternNow() {
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
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  // new Date(y, m, d, h, min, s) interprets args in the host's local timezone.
  // On a UTC host the resulting epoch equals the Eastern wall-clock time
  // expressed as if it were UTC — i.e. offset by the Eastern UTC offset.
  return new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
}

function parseActivityTime(timeStr, referenceDate) {
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

function getEasternDayName(now) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
  }).format(now);
}

function getEasternIsoDate(now) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // Load schedule data from repo checkout (same as deployed)
  const dataPath = join(__dirname, '..', 'public', 'data', 'latest.json');
  let data;
  try {
    data = JSON.parse(readFileSync(dataPath, 'utf-8'));
  } catch (err) {
    console.error('Failed to read schedule data:', err.message);
    return;
  }

  const now = getEasternNow();

  // Skip outside gym hours (8 AM – 10 PM Eastern) to avoid no-op runs
  if (!force && (now.getHours() < 8 || now.getHours() >= 22)) {
    console.log(`Outside gym hours (${now.getHours()}:xx ET), skipping.`);
    return;
  }

  const dayName = getEasternDayName(now);
  const isoDate = getEasternIsoDate(now);

  console.log(`[check-and-notify] ${isoDate} ${dayName} — checking for open gym in ${WINDOW_MIN}-${WINDOW_MAX} min`);

  const todaySchedule = data.schedule?.[dayName];
  if (!todaySchedule) {
    console.log(`No schedule for ${dayName}, exiting.`);
    return;
  }

  // ─── Open Gym 30-min notifications ─────────────────────────────────────────

  const upcoming = todaySchedule.activities.filter((a) => {
    if (!a.isOpenGym) return false;
    const start = parseActivityTime(a.start, now);
    const diffMin = (start - now) / 60000;
    return force || (diffMin >= WINDOW_MIN && diffMin <= WINDOW_MAX);
  });

  if (upcoming.length) {
    console.log(`Found ${upcoming.length} upcoming open gym slot(s):`, upcoming.map((a) => a.start).join(', '));

    const activities = upcoming.map((a) => ({
      start: a.start,
      end: a.end,
      dayName,
    }));

    try {
      const res = await fetch(`${WORKER_URL}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': API_KEY },
        body: JSON.stringify({ type: '30min', activities, apiKey: API_KEY }),
      });
      const result = await res.json().catch(() => ({}));
      if (res.ok) {
        console.log(`Worker responded ${res.status}:`, JSON.stringify(result));
      } else {
        console.error(`Worker responded ${res.status} (error):`, JSON.stringify(result));
      }
    } catch (err) {
      console.error('Failed to call Worker:', err.message);
    }
  } else {
    console.log('No upcoming open gym slots in window.');
  }

  // ─── Sport-specific 30-min notifications ────────────────────────────────────

  const sportHits = new Map();  // sportId → { label, activity } (first hit per sport)
  for (const activity of todaySchedule.activities) {
    if (activity.isOpenGym) continue;
    const start = parseActivityTime(activity.start, now);
    const diffMin = (start - now) / 60000;
    if (!force && (diffMin < WINDOW_MIN || diffMin > WINDOW_MAX)) continue;
    for (const pattern of SPORT_PATTERNS) {
      if (pattern.match(activity.name) && !sportHits.has(pattern.id)) {
        sportHits.set(pattern.id, { label: pattern.label, activity });
      }
    }
  }

  if (sportHits.size === 0) {
    console.log('No upcoming sport slots in window.');
  }

  for (const [sportId, { label, activity }] of sportHits) {
    console.log(`Sending sport notification for ${label} at ${activity.start}`);
    try {
      const res = await fetch(`${WORKER_URL}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': API_KEY },
        body: JSON.stringify({
          type: 'sport-30min', sportId, sportLabel: label,
          activities: [{ start: activity.start, end: activity.end, dayName }],
          apiKey: API_KEY,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (res.ok) {
        console.log(`Worker responded ${res.status}:`, JSON.stringify(result));
      } else {
        console.error(`Worker responded ${res.status} (error):`, JSON.stringify(result));
      }
    } catch (err) {
      console.error(`Failed to call Worker for ${label}:`, err.message);
    }
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  // Always exit 0 — notifications are best-effort
});
