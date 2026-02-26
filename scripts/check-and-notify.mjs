/**
 * check-and-notify.mjs
 *
 * Reads public/data/latest.json to determine which push notifications to send,
 * then POSTs to the Cloudflare Worker /notify endpoint.
 *
 * Also reads public/data/freed-slots.json (if present) and sends a
 * slot-freed notification to subscribers with cancelAlerts enabled.
 *
 * Expected environment variables:
 *   CLOUDFLARE_WORKER_URL  — base URL of the Worker, e.g. https://worker.example.com
 *   NOTIFY_API_KEY         — API key for the Worker /notify endpoint
 *
 * The 8 AM–10 PM ET gate is enforced at the top of the script.
 * All notification types reuse this same gate — do NOT duplicate it.
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// ─── Configuration ────────────────────────────────────────────────────────────

const WORKER_URL = process.env.CLOUDFLARE_WORKER_URL;
const API_KEY = process.env.NOTIFY_API_KEY;

if (!WORKER_URL || !API_KEY) {
  console.error('Missing required env vars: CLOUDFLARE_WORKER_URL, NOTIFY_API_KEY');
  process.exit(1);
}

// ─── Time gate: 8 AM–10 PM ET ─────────────────────────────────────────────────

const now = new Date();
const etParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: 'numeric',
  hourCycle: 'h23',
  weekday: 'long',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  minute: 'numeric',
}).formatToParts(now);

function etPart(type) {
  return etParts.find(p => p.type === type)?.value ?? '';
}

const etHour = parseInt(etPart('hour'), 10);
const etMinute = parseInt(etPart('minute'), 10);
const dayName = etPart('weekday');
const nowMinutes = etHour * 60 + etMinute;

const GYM_OPEN_HOUR = 8;   // 8 AM ET
const GYM_CLOSE_HOUR = 22; // 10 PM ET

if (etHour < GYM_OPEN_HOUR || etHour >= GYM_CLOSE_HOUR) {
  console.log(`[check-and-notify] Outside 8 AM–10 PM ET window (${etHour}:${String(etMinute).padStart(2, '0')} ET), skipping all notifications.`);
  process.exit(0);
}

// ─── Read latest schedule ─────────────────────────────────────────────────────

const latestPath = join(root, 'public', 'data', 'latest.json');
if (!existsSync(latestPath)) {
  console.error('[check-and-notify] public/data/latest.json not found');
  process.exit(1);
}

let scheduleData;
try {
  scheduleData = JSON.parse(readFileSync(latestPath, 'utf-8'));
} catch (err) {
  console.error('[check-and-notify] Failed to parse latest.json:', err);
  process.exit(1);
}

const todaySchedule = scheduleData.schedule?.[dayName];
const activities = todaySchedule?.activities ?? [];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function postNotify(body) {
  const res = await fetch(`${WORKER_URL}/notify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': API_KEY,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Worker /notify returned ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

function parseMinutes(timeStr) {
  const m = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ampm = m[3].toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

const THIRTY_MIN_WINDOW_MIN = 20;
const THIRTY_MIN_WINDOW_MAX = 45;

// ─── 30-min Open Gym notifications ────────────────────────────────────────────

const openGymUpcoming = activities.filter(a => {
  if (!a.isOpenGym) return false;
  const startMin = parseMinutes(a.start);
  if (startMin === null) return false;
  const diff = startMin - nowMinutes;
  return diff >= THIRTY_MIN_WINDOW_MIN && diff <= THIRTY_MIN_WINDOW_MAX;
});

if (openGymUpcoming.length > 0) {
  const slot = openGymUpcoming[0];
  try {
    const result = await postNotify({
      type: '30min',
      activities: [{ start: slot.start, end: slot.end, dayName }],
    });
    console.log(`[check-and-notify] 30-min Open Gym (${slot.start}):`, result);
  } catch (err) {
    console.error('[check-and-notify] 30-min Open Gym notify failed:', err);
  }
} else {
  console.log('[check-and-notify] No Open Gym in 20–45 min window.');
}

// ─── 30-min per-sport notifications ───────────────────────────────────────────
// Note: SPORT_PATTERNS must stay in sync with worker/index.ts — see scripts/check-sport-sync.mjs

const SPORT_PATTERNS = [
  { id: 'basketball',   label: 'Basketball',   test: (n) => /basketball/i.test(n) },
  { id: 'pickleball',   label: 'Pickleball',   test: (n) => /pickleball/i.test(n) },
  { id: 'table-tennis', label: 'Table Tennis', test: (n) => /table\s+tennis/i.test(n) },
  { id: 'volleyball',   label: 'Volleyball',   test: (n) => /volleyball/i.test(n) },
  { id: 'badminton',    label: 'Badminton',    test: (n) => /badminton/i.test(n) },
  { id: 'tennis',       label: 'Tennis',       test: (n) => /tennis/i.test(n) && !/table\s+tennis/i.test(n) },
  { id: 'youth',        label: 'Youth',        test: (n) => /youth center/i.test(n) },
];

const sportsSeen = new Set();
for (const activity of activities) {
  if (activity.isOpenGym) continue;
  const startMin = parseMinutes(activity.start);
  if (startMin === null) continue;
  const diff = startMin - nowMinutes;
  if (diff < THIRTY_MIN_WINDOW_MIN || diff > THIRTY_MIN_WINDOW_MAX) continue;

  for (const pattern of SPORT_PATTERNS) {
    if (!pattern.test(activity.name)) continue;
    if (sportsSeen.has(pattern.id)) continue;
    sportsSeen.add(pattern.id);

    try {
      const result = await postNotify({
        type: 'sport-30min',
        sportId: pattern.id,
        sportLabel: pattern.label,
        activities: [{ start: activity.start, end: activity.end, dayName }],
      });
      console.log(`[check-and-notify] sport-30min ${pattern.label} (${activity.start}):`, result);
    } catch (err) {
      console.error(`[check-and-notify] sport-30min ${pattern.label} notify failed:`, err);
    }
  }
}

if (sportsSeen.size === 0) {
  console.log('[check-and-notify] No sports in 20–45 min window.');
}

// ─── Slot-freed (cancelled session) notifications ─────────────────────────────
// Reads freed-slots.json written by the scraper after diff-ing old vs new schedule.

const freedSlotsPath = join(root, 'public', 'data', 'freed-slots.json');
if (existsSync(freedSlotsPath)) {
  let freedSlotsData;
  try {
    freedSlotsData = JSON.parse(readFileSync(freedSlotsPath, 'utf-8'));
  } catch (err) {
    console.error('[check-and-notify] Failed to parse freed-slots.json (skipping):', err);
    freedSlotsData = null;
  }

  if (freedSlotsData && Array.isArray(freedSlotsData.slots) && freedSlotsData.slots.length > 0) {
    try {
      const result = await postNotify({
        type: 'slot-freed',
        slots: freedSlotsData.slots,
        generatedAt: freedSlotsData.generatedAt,
      });
      console.log(`[check-and-notify] slot-freed (${freedSlotsData.slots.length} slot(s)):`, result);
    } catch (err) {
      console.error('[check-and-notify] slot-freed notify failed:', err);
    }
  } else {
    console.log('[check-and-notify] freed-slots.json present but has no slots, skipping.');
  }
} else {
  console.log('[check-and-notify] No freed-slots.json found, skipping slot-freed notifications.');
}
