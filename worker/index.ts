import { buildPushPayload } from '@block65/webcrypto-web-push';
import type { PushSubscription, VapidKeys } from '@block65/webcrypto-web-push';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Env {
  SUBSCRIPTIONS: KVNamespace;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
  NOTIFY_API_KEY: string;
  APP_ORIGIN: string;
  PAGES_DATA_URL: string;
}

// Occupancy types
type OccupancyLevel = 'light' | 'moderate' | 'packed';

interface OccupancyData {
  level: OccupancyLevel;
  reportedAt: string;
  expiresAt: string;
}

interface StoredSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  prefs: NotifPrefs;
  subscribedAt: string;
}

interface NotifPrefs {
  thirtyMin: boolean;
  dailyBriefing: boolean;
  sports?: string[];
  dailyBriefingHour?: number;  // 7–10 AM ET; defaults to 8
  cancelAlerts?: boolean;  // alert when a booked slot is removed; defaults to false
}

interface FreedSlot {
  day: string;
  startTime: string;
  endTime: string;
  activity: string;
}

interface Activity {
  name: string;
  start: string;
  end: string;
  isOpenGym: boolean;
}

interface DaySchedule {
  open: string;
  close: string;
  activities: Activity[];
}

interface ScheduleData {
  scrapedAt: string;
  schedule: Record<string, DaySchedule>;
  notices: unknown[];
}

interface NotificationData {
  title: string;
  body: string;
  tag: string;
  url: string;
}

// ─── Sport patterns & constants ──────────────────────────────────────────────

const SPORT_PATTERNS: Array<{ id: string; label: string; test: (name: string) => boolean }> = [
  { id: 'basketball',   label: 'Basketball',   test: (n) => /basketball/i.test(n) },
  { id: 'pickleball',   label: 'Pickleball',   test: (n) => /pickleball/i.test(n) },
  { id: 'table-tennis', label: 'Table Tennis', test: (n) => /table\s+tennis/i.test(n) },
  { id: 'volleyball',   label: 'Volleyball',   test: (n) => /volleyball/i.test(n) },
  { id: 'badminton',    label: 'Badminton',    test: (n) => /badminton/i.test(n) },
  { id: 'tennis',       label: 'Tennis',       test: (n) => /tennis/i.test(n) && !/table\s+tennis/i.test(n) },
  { id: 'youth',        label: 'Youth',        test: (n) => /youth center/i.test(n) },
];

const THIRTY_MIN_WINDOW_MIN = 20;
const THIRTY_MIN_WINDOW_MAX = 45;
const GYM_OPEN_HOUR = 8;   // 8 AM ET
const GYM_CLOSE_HOUR = 22; // 10 PM ET

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function sha256hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function getVapidKeys(env: Env): VapidKeys {
  return {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT,
  };
}

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key',
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function idempotencyKey(
  isoDate: string,
  dayName: string,
  activityStart: string,
  type: string,
): string {
  return `idempotent:${isoDate}:${dayName}:${activityStart}:${type}`;
}

function parseActivityMinutes(timeStr: string): number | null {
  // timeStr format: "9:00 AM" or "2:30 PM"
  const m = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ampm = m[3].toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

function truncateBody(s: string, max = 100): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

/**
 * Build a human-readable notification body for freed slots.
 * - Single slot: "Basketball at 2:00 PM was removed from today's schedule"
 * - Multiple slots from same sport: "3 Basketball sessions were removed from the schedule"
 * - Mixed sports: "2 sessions removed from this week's schedule"
 */
export function buildSlotFreedBody(slots: FreedSlot[]): string {
  if (slots.length === 1) {
    const slot = slots[0];
    return `${slot.activity} at ${slot.startTime} was removed from today's schedule`;
  }

  // Check if all slots share the same activity name
  const activities = new Set(slots.map(s => s.activity));
  if (activities.size === 1) {
    const name = slots[0].activity;
    return `${slots.length} ${name} sessions were removed from the schedule`;
  }

  return `${slots.length} sessions removed from this week's schedule`;
}

// ─── Fan-out ─────────────────────────────────────────────────────────────────

async function fanOut(
  env: Env,
  notifData: NotificationData,
  type: 'thirtyMin' | 'dailyBriefing' | 'cancelAlerts',
  idempotencyKeyStr: string,
  sportId?: string,
  etHour?: number,
): Promise<{ sent: number; skipped: number; cleaned: number; failed: number }> {
  // Idempotency check
  const existing = await env.SUBSCRIPTIONS.get(idempotencyKeyStr);
  if (existing) return { sent: 0, skipped: 0, cleaned: 0, failed: 0 };

  // Write idempotency key before sending (TTL: 2h)
  await env.SUBSCRIPTIONS.put(idempotencyKeyStr, '1', { expirationTtl: 7200 });

  const vapidKeys = getVapidKeys(env);
  let cursor: string | undefined;
  let sent = 0;
  let skipped = 0;
  let cleaned = 0;
  let failed = 0;

  // Paginate through all subscriptions
  do {
    const list = await env.SUBSCRIPTIONS.list({ cursor });
    cursor = list.list_complete ? undefined : list.cursor;

    const sendPromises = list.keys
      .filter((k) => !k.name.startsWith('idempotent:'))
      .map(async (k) => {
        const raw = await env.SUBSCRIPTIONS.get(k.name);
        if (!raw) return;

        let sub: StoredSubscription;
        try {
          sub = JSON.parse(raw) as StoredSubscription;
        } catch {
          return;
        }

        const allowed = sportId
          ? (sub.prefs.sports ?? []).includes(sportId)
          : type === 'cancelAlerts'
            ? Boolean(sub.prefs.cancelAlerts)
            : Boolean(sub.prefs[type]) && (
                etHour === undefined || (sub.prefs.dailyBriefingHour ?? 8) === etHour
              );
        if (!allowed) {
          skipped++;
          return;
        }

        const pushSub: PushSubscription = {
          endpoint: sub.endpoint,
          keys: sub.keys,
          expirationTime: null,
        };

        try {
          const payload = await buildPushPayload(
            { data: JSON.stringify(notifData) },
            pushSub,
            vapidKeys,
          );
          const res = await fetch(sub.endpoint, payload);

          if (res.status === 410 || res.status === 404) {
            // Subscription expired — clean up
            await env.SUBSCRIPTIONS.delete(k.name);
            cleaned++;
          } else if (res.status === 429) {
            // Rate limited — skip, don't delete
            console.warn(`Rate limited for subscription ${k.name}`);
          } else if (res.status >= 200 && res.status < 300) {
            sent++;
          } else {
            console.error(`Push delivery failed with status ${res.status} for ${k.name}`);
            failed++;
          }
        } catch (err) {
          console.error(`Failed to send to ${k.name}:`, err);
          failed++;
        }
      });

    await Promise.all(sendPromises);
  } while (cursor);

  return { sent, skipped, cleaned, failed };
}

// ─── Handlers ────────────────────────────────────────────────────────────────

async function handleSubscribe(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
    prefs?: NotifPrefs;
  };

  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return json({ error: 'Missing endpoint or keys' }, 400);
  }

  const incomingHour = body.prefs?.dailyBriefingHour;
  if (incomingHour !== undefined && (!Number.isInteger(incomingHour) || incomingHour < 7 || incomingHour > 10)) {
    return json({ error: 'dailyBriefingHour must be 7, 8, 9, or 10' }, 400);
  }

  const key = await sha256hex(body.endpoint);
  const sub: StoredSubscription = {
    endpoint: body.endpoint,
    keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
    prefs: {
      thirtyMin: body.prefs?.thirtyMin ?? true,
      dailyBriefing: body.prefs?.dailyBriefing ?? true,
      sports: body.prefs?.sports ?? [],
      dailyBriefingHour: incomingHour ?? 8,
      cancelAlerts: body.prefs?.cancelAlerts ?? false,
    },
    subscribedAt: new Date().toISOString(),
  };

  await env.SUBSCRIPTIONS.put(key, JSON.stringify(sub));
  return json({ ok: true }, 201);
}

async function handleUpdatePrefs(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as { endpoint?: string; prefs?: Partial<NotifPrefs> };

  if (!body.endpoint) {
    return json({ error: 'Missing endpoint' }, 400);
  }

  const key = await sha256hex(body.endpoint);
  const raw = await env.SUBSCRIPTIONS.get(key);
  if (!raw) return json({ error: 'Subscription not found' }, 404);

  const sub = JSON.parse(raw) as StoredSubscription;
  if (body.prefs?.thirtyMin !== undefined) sub.prefs.thirtyMin = body.prefs.thirtyMin;
  if (body.prefs?.dailyBriefing !== undefined) sub.prefs.dailyBriefing = body.prefs.dailyBriefing;
  if (body.prefs?.sports !== undefined) sub.prefs.sports = body.prefs.sports;
  if (body.prefs?.cancelAlerts !== undefined) sub.prefs.cancelAlerts = body.prefs.cancelAlerts;
  if (body.prefs?.dailyBriefingHour !== undefined) {
    const h = body.prefs.dailyBriefingHour;
    if (!Number.isInteger(h) || h < 7 || h > 10) return json({ error: 'dailyBriefingHour must be 7, 8, 9, or 10' }, 400);
    sub.prefs.dailyBriefingHour = h;
  }

  await env.SUBSCRIPTIONS.put(key, JSON.stringify(sub));
  return json({ ok: true });
}

/**
 * Auth model: endpoint-as-self-authorization.
 *
 * This endpoint intentionally does not require X-Api-Key. The push endpoint
 * URL is a 256-bit random value issued by the browser's push service — it is
 * effectively unguessable and is only stored in the user's own localStorage.
 * Presenting the endpoint in the request body is sufficient proof that the
 * caller is the same browser that subscribed. Adding X-Api-Key would require
 * distributing a server secret to the browser, which provides no meaningful
 * security benefit over this model.
 *
 * Sanity check: reject requests where endpoint is absent or not a well-formed
 * https:// URL to prevent accidental or malformed calls from deleting entries.
 */
async function handleUnsubscribe(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as { endpoint?: string };
  if (!body.endpoint) return json({ error: 'Missing endpoint' }, 400);
  if (typeof body.endpoint !== 'string' || !body.endpoint.startsWith('https://')) {
    return json({ error: 'Invalid endpoint' }, 400);
  }

  const key = await sha256hex(body.endpoint);
  const existing = await env.SUBSCRIPTIONS.get(key);
  if (!existing) return json({ error: 'Subscription not found' }, 404);

  await env.SUBSCRIPTIONS.delete(key);
  return json({ ok: true });
}

async function handleNotify(request: Request, env: Env): Promise<Response> {
  const body = await request.json().catch(() => ({})) as {
    apiKey?: string;
    type?: string;
    activities?: Array<{ start: string; end: string; dayName: string }>;
    sportId?: string;
    sportLabel?: string;
    slots?: FreedSlot[];
  };

  const headerKey = request.headers.get('X-Api-Key') ?? '';
  if (headerKey !== env.NOTIFY_API_KEY && body.apiKey !== env.NOTIFY_API_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const isoDate = new Date().toISOString().slice(0, 10);
  const activities = body.activities ?? [];

  if (body.type === 'sport-30min') {
    if (!body.sportId || typeof body.sportId !== 'string') return json({ error: 'Missing sportId' }, 400);
    if (!activities.length) return json({ ok: true, sent: 0, reason: 'no-activities' });
    const label = body.sportLabel ?? body.sportId;
    const act = activities[0];  // one representative activity (deduped by script)
    const notifData: NotificationData = {
      title: `${label} in ~30 min`,
      body: truncateBody(`Starts at ${act.start} — ${act.end}`),
      tag: `flcc-sport-${body.sportId}`,
      url: `${env.APP_ORIGIN}/fair-lawn-community-center-available/#sports`,
    };
    const idKey = `idempotent:${isoDate}:${act.dayName}:sport-${body.sportId}`;
    // 'thirtyMin' is unused when sportId is provided — fanOut branches on sportId presence
    const result = await fanOut(env, notifData, 'thirtyMin', idKey, body.sportId);
    return json({ ok: true, result });
  }

  if (body.type === 'slot-freed') {
    const slots = body.slots;
    if (!slots || !Array.isArray(slots) || slots.length === 0) {
      return json({ error: 'Missing or empty slots' }, 400);
    }

    const notifBody = buildSlotFreedBody(slots);
    const notifData: NotificationData = {
      title: 'Session removed from schedule',
      body: truncateBody(notifBody),
      tag: 'flcc-slot-freed',
      url: `${env.APP_ORIGIN}/fair-lawn-community-center-available/#today`,
    };

    const idKey = `idempotent:${isoDate}:slot-freed:${slots.map(s => `${s.day}|${s.startTime}|${s.activity}`).join(',')}`;
    const result = await fanOut(env, notifData, 'cancelAlerts', idKey);
    return json({ ok: true, result });
  }

  if (body.type !== '30min') {
    return json({ error: 'Invalid type' }, 400);
  }

  if (!activities.length) {
    return json({ ok: true, sent: 0, reason: 'no-activities' });
  }

  const results = [];

  for (const act of activities) {
    const notifData: NotificationData = {
      title: 'Open Gym in ~30 min',
      body: truncateBody(`Starts at ${act.start} — ${act.end}`),
      tag: 'flcc-30min',
      url: `${env.APP_ORIGIN}/fair-lawn-community-center-available/#status`,
    };

    const idKey = idempotencyKey(isoDate, act.dayName, act.start, '30min');
    const result = await fanOut(env, notifData, 'thirtyMin', idKey);
    results.push(result);
  }

  return json({ ok: true, results });
}

async function handleCheckin(request: Request, env: Env): Promise<Response> {
  const VALID_LEVELS: OccupancyLevel[] = ['light', 'moderate', 'packed'];
  const OCCUPANCY_TTL = 900; // 15 minutes in seconds

  const body = await request.json().catch(() => ({})) as { level?: unknown };
  if (!body.level || !VALID_LEVELS.includes(body.level as OccupancyLevel)) {
    return json({ error: 'Invalid level. Must be light, moderate, or packed' }, 400);
  }
  const level = body.level as OccupancyLevel;

  // Rate limiting: one report per IP per 15 minutes
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const ipHash = await sha256hex(ip);
  const ipKey = `occupancy:ip:${ipHash}`;
  const existing = await env.SUBSCRIPTIONS.get(ipKey);
  if (existing) {
    return json({ error: 'Already reported recently. Please wait before reporting again.' }, 429);
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + OCCUPANCY_TTL * 1000).toISOString();
  const reportedAt = now.toISOString();

  const data: OccupancyData = { level, reportedAt, expiresAt };

  // Write occupancy record and IP rate-limit key concurrently
  await Promise.all([
    env.SUBSCRIPTIONS.put('occupancy:current', JSON.stringify(data), { expirationTtl: OCCUPANCY_TTL }),
    env.SUBSCRIPTIONS.put(ipKey, '1', { expirationTtl: OCCUPANCY_TTL }),
  ]);

  return json({ ok: true, level, expiresAt });
}

async function handleOccupancy(_request: Request, env: Env): Promise<Response> {
  const raw = await env.SUBSCRIPTIONS.get('occupancy:current');
  if (!raw) {
    return json({ level: null, reportedAt: null, expiresAt: null });
  }

  let data: OccupancyData;
  try {
    data = JSON.parse(raw) as OccupancyData;
  } catch {
    return json({ level: null, reportedAt: null, expiresAt: null });
  }

  // Belt-and-suspenders: also check expiresAt in the value
  if (data.expiresAt && new Date(data.expiresAt) <= new Date()) {
    return json({ level: null, reportedAt: null, expiresAt: null });
  }

  return json({ level: data.level, reportedAt: data.reportedAt, expiresAt: data.expiresAt });
}

async function handleStats(request: Request, env: Env): Promise<Response> {
  // Auth check — GET request, no body, header only
  const apiKey = request.headers.get('X-Api-Key') ?? '';
  if (apiKey !== env.NOTIFY_API_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let cursor: string | undefined;
  let subscribers = 0;
  let idempotencyKeys = 0;

  do {
    const list = await env.SUBSCRIPTIONS.list({ cursor });
    cursor = list.list_complete ? undefined : list.cursor;

    for (const k of list.keys) {
      if (k.name.startsWith('idempotent:')) {
        idempotencyKeys++;
      } else {
        subscribers++;
      }
    }
  } while (cursor);

  return json({ ok: true, subscribers, idempotencyKeys });
}

async function handleDailyBriefing(env: Env): Promise<void> {
  let data: ScheduleData;
  try {
    const res = await fetch(env.PAGES_DATA_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json() as ScheduleData;
  } catch (err) {
    console.error('Failed to fetch schedule data:', err);
    return;
  }

  // Get today's date + current hour in US Eastern time
  const now = new Date();
  const etParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now);

  const dayName = etParts.find((p) => p.type === 'weekday')?.value ?? '';
  const month   = etParts.find((p) => p.type === 'month')?.value   ?? '01';
  const day     = etParts.find((p) => p.type === 'day')?.value     ?? '01';
  const year    = etParts.find((p) => p.type === 'year')?.value    ?? '2024';
  const etHour  = parseInt(etParts.find((p) => p.type === 'hour')?.value ?? '8', 10);
  const isoDate = `${year}-${month}-${day}`;

  const todaySchedule = data.schedule[dayName];
  const allActivities = todaySchedule?.activities ?? [];
  const openGymSlots  = allActivities.filter((a) => a.isOpenGym);
  const otherActs     = allActivities.filter((a) => !a.isOpenGym);

  // Skip if gym has no activities today — nothing useful to tell users
  if (allActivities.length === 0) {
    console.log(`Daily briefing: no activities for ${dayName} (${etHour}h ET), skipping`);
    return;
  }

  // Build notification body (≤100 chars for lock-screen visibility)
  let body: string;
  if (openGymSlots.length > 0) {
    const gymTimes = openGymSlots.map((a) => a.start).join(' & ');
    body = truncateBody(`Open Gym: ${gymTimes}`);
    if (otherActs.length > 0) {
      // Abbreviate to first word of activity name; show up to 2
      const names = otherActs.slice(0, 2).map((a) => a.name.split(/\s+/)[0]).join(', ');
      body = truncateBody(body + ` · ${names}`);
    }
  } else {
    body = 'No open gym today';
    if (otherActs.length > 0) {
      const acts = otherActs.slice(0, 2)
        .map((a) => `${a.name.split(/\s+/)[0]}: ${a.start}`)
        .join(' · ');
      body = truncateBody(body + ` · ${acts}`);
    }
  }

  const notifData: NotificationData = {
    title: 'Fair Lawn Gym · Today',
    body,
    tag: 'flcc-daily',
    url: `${env.APP_ORIGIN}/fair-lawn-community-center-available/#today`,
  };

  // Idempotency key scoped to date + hour so each user's chosen hour gets one send per day
  const idKey = idempotencyKey(isoDate, dayName, `${etHour}h`, 'dailyBriefing');
  const result = await fanOut(env, notifData, 'dailyBriefing', idKey, undefined, etHour);
  console.log(`Daily briefing (${etHour}h ET, ${dayName}): sent=${result.sent} skipped=${result.skipped} cleaned=${result.cleaned} failed=${result.failed}`);
}

async function handleThirtyMinNotifications(env: Env): Promise<void> {
  // Get current ET hour + minute
  const now = new Date();
  const etTimeParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric', minute: 'numeric',
    hourCycle: 'h23',
    weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => etTimeParts.find((p) => p.type === type)?.value ?? '';
  const etHour = parseInt(get('hour'), 10);
  const etMinute = parseInt(get('minute'), 10);
  const dayName = get('weekday');
  const isoDate = `${get('year')}-${get('month')}-${get('day')}`;
  const nowMinutes = etHour * 60 + etMinute;

  // Skip outside gym hours
  if (etHour < GYM_OPEN_HOUR || etHour >= GYM_CLOSE_HOUR) {
    console.log(`30-min check: outside gym hours (${etHour}h ET), skipping`);
    return;
  }

  // Fetch schedule
  const res = await fetch(env.PAGES_DATA_URL);
  if (!res.ok) {
    console.error(`30-min check: failed to fetch schedule (${res.status})`);
    return;
  }
  const data = await res.json() as ScheduleData;
  const todaySchedule = data.schedule?.[dayName];
  if (!todaySchedule) {
    console.log(`30-min check: no schedule for ${dayName}`);
    return;
  }

  const activities = todaySchedule.activities ?? [];

  // ── Open Gym notifications ──────────────────────────────────────────────────
  const openGymUpcoming = activities.filter((a) => {
    if (!a.isOpenGym) return false;
    const startMin = parseActivityMinutes(a.start);
    if (startMin === null) return false;
    const diff = startMin - nowMinutes;
    return diff >= THIRTY_MIN_WINDOW_MIN && diff <= THIRTY_MIN_WINDOW_MAX;
  });

  if (openGymUpcoming.length > 0) {
    const slot = openGymUpcoming[0]; // earliest only, prevent duplicates
    const notifData: NotificationData = {
      title: 'Open Gym starting soon',
      body: truncateBody(`Open Gym starts at ${slot.start} · ${dayName}`),
      tag: `flcc-opengym-${slot.start}`,
      url: `${env.APP_ORIGIN}/fair-lawn-community-center-available/#sports?sport=open-gym`,
    };
    const idKey = idempotencyKey(isoDate, 'opengym', slot.start, 'thirtyMin');
    const result = await fanOut(env, notifData, 'thirtyMin', idKey);
    console.log(`30-min open gym (${slot.start}): sent=${result.sent} skipped=${result.skipped} failed=${result.failed}`);
  }

  // ── Per-sport notifications ─────────────────────────────────────────────────
  const sportsSeen = new Set<string>();
  for (const activity of activities) {
    if (activity.isOpenGym) continue;
    const startMin = parseActivityMinutes(activity.start);
    if (startMin === null) continue;
    const diff = startMin - nowMinutes;
    if (diff < THIRTY_MIN_WINDOW_MIN || diff > THIRTY_MIN_WINDOW_MAX) continue;

    for (const pattern of SPORT_PATTERNS) {
      if (!pattern.test(activity.name)) continue;
      if (sportsSeen.has(pattern.id)) continue; // one notification per sport per window
      sportsSeen.add(pattern.id);

      const notifData: NotificationData = {
        title: `${pattern.label} starting soon`,
        body: truncateBody(`${pattern.label} starts at ${activity.start} · ${dayName}`),
        tag: `flcc-sport-${pattern.id}-${activity.start}`,
        url: `${env.APP_ORIGIN}/fair-lawn-community-center-available/#sports?sport=${pattern.id}`,
      };
      const idKey = idempotencyKey(isoDate, pattern.id, activity.start, 'thirtyMin');
      const result = await fanOut(env, notifData, 'thirtyMin', idKey, pattern.id);
      console.log(`30-min ${pattern.label} (${activity.start}): sent=${result.sent} skipped=${result.skipped} failed=${result.failed}`);
    }
  }
}

async function handleScheduled(event: ScheduledEvent, env: Env): Promise<void> {
  if (event.cron === '*/30 * * * *') {
    await handleThirtyMinNotifications(env);
  } else {
    // Daily briefing: cron "0 11,12,13,14,15 * * *"
    await handleDailyBriefing(env);
  }
}

// ─── Main fetch handler ──────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true, ts: new Date().toISOString() });
    }

    if (request.method === 'POST' && url.pathname === '/subscribe') {
      return handleSubscribe(request, env);
    }

    if (request.method === 'PATCH' && url.pathname === '/subscription') {
      return handleUpdatePrefs(request, env);
    }

    if (request.method === 'DELETE' && url.pathname === '/unsubscribe') {
      return handleUnsubscribe(request, env);
    }

    if (request.method === 'POST' && url.pathname === '/notify') {
      return handleNotify(request, env);
    }

    if (request.method === 'GET' && url.pathname === '/stats') {
      return handleStats(request, env);
    }

    if (request.method === 'POST' && url.pathname === '/checkin') {
      return handleCheckin(request, env);
    }

    if (request.method === 'GET' && url.pathname === '/occupancy') {
      return handleOccupancy(request, env);
    }

    return json({ error: 'Not found' }, 404);
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleScheduled(event, env));
  },
};
