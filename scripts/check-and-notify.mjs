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
import {
  SPORT_PATTERNS,
  THIRTY_MIN_WINDOW_MIN,
  THIRTY_MIN_WINDOW_MAX,
  parseMinutes,
  findOpenGymSlot,
  findSportSlots,
} from './check-and-notify-logic.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// ─── Dry-run flag ─────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run');
if (DRY_RUN) console.log('[check-and-notify] Dry-run mode — no notifications will be sent.');

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

if (!DRY_RUN && (etHour < GYM_OPEN_HOUR || etHour >= GYM_CLOSE_HOUR)) {
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
    body: JSON.stringify({ ...body, dryRun: DRY_RUN }),
  });
  if (!res.ok) {
    throw new Error(`Worker /notify returned ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

// ─── 30-min Open Gym notifications ────────────────────────────────────────────

const openGymSlot = findOpenGymSlot(activities, nowMinutes);

if (openGymSlot) {
  try {
    const result = await postNotify({
      type: '30min',
      activities: [{ start: openGymSlot.start, end: openGymSlot.end, dayName }],
    });
    console.log(`[check-and-notify] 30-min Open Gym (${openGymSlot.start}):`, result);
  } catch (err) {
    console.error('[check-and-notify] 30-min Open Gym notify failed:', err);
  }
} else {
  console.log('[check-and-notify] No Open Gym in 20–45 min window.');
}

// ─── 30-min per-sport notifications ───────────────────────────────────────────
// Note: SPORT_PATTERNS must stay in sync with worker/index.ts — see scripts/check-sport-sync.mjs

const sportSlots = findSportSlots(activities, nowMinutes);

for (const { pattern, activity } of sportSlots) {
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

if (sportSlots.length === 0) {
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
