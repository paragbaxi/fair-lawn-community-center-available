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

// ─── Fan-out ─────────────────────────────────────────────────────────────────

async function fanOut(
  env: Env,
  notifData: NotificationData,
  type: 'thirtyMin' | 'dailyBriefing',
  idempotencyKeyStr: string,
  sportId?: string,
): Promise<{ sent: number; skipped: number; cleaned: number }> {
  // Idempotency check
  const existing = await env.SUBSCRIPTIONS.get(idempotencyKeyStr);
  if (existing) return { sent: 0, skipped: 0, cleaned: 0 };

  // Write idempotency key before sending (TTL: 2h)
  await env.SUBSCRIPTIONS.put(idempotencyKeyStr, '1', { expirationTtl: 7200 });

  const vapidKeys = getVapidKeys(env);
  let cursor: string | undefined;
  let sent = 0;
  let skipped = 0;
  let cleaned = 0;

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
          : Boolean(sub.prefs[type]);
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
          }
        } catch (err) {
          console.error(`Failed to send to ${k.name}:`, err);
        }
      });

    await Promise.all(sendPromises);
  } while (cursor);

  return { sent, skipped, cleaned };
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

  const key = await sha256hex(body.endpoint);
  const sub: StoredSubscription = {
    endpoint: body.endpoint,
    keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
    prefs: {
      thirtyMin: body.prefs?.thirtyMin ?? true,
      dailyBriefing: body.prefs?.dailyBriefing ?? true,
      sports: body.prefs?.sports ?? [],
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

  await env.SUBSCRIPTIONS.put(key, JSON.stringify(sub));
  return json({ ok: true });
}

async function handleUnsubscribe(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as { endpoint?: string };

  if (!body.endpoint) {
    return json({ error: 'Missing endpoint' }, 400);
  }

  const key = await sha256hex(body.endpoint);
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
      body: `Starts at ${act.start} — ${act.end}`,
      tag: `flcc-sport-${body.sportId}`,
      url: `${env.APP_ORIGIN}/fair-lawn-community-center-available/#sports`,
    };
    const idKey = `idempotent:${isoDate}:${act.dayName}:sport-${body.sportId}`;
    // 'thirtyMin' is unused when sportId is provided — fanOut branches on sportId presence
    const result = await fanOut(env, notifData, 'thirtyMin', idKey, body.sportId);
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
      body: `Starts at ${act.start} — ${act.end}`,
      tag: 'flcc-30min',
      url: `${env.APP_ORIGIN}/fair-lawn-community-center-available/#status`,
    };

    const idKey = idempotencyKey(isoDate, act.dayName, act.start, '30min');
    const result = await fanOut(env, notifData, 'thirtyMin', idKey);
    results.push(result);
  }

  return json({ ok: true, results });
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

async function handleScheduled(env: Env): Promise<void> {
  let data: ScheduleData;
  try {
    const res = await fetch(env.PAGES_DATA_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json() as ScheduleData;
  } catch (err) {
    console.error('Failed to fetch schedule data:', err);
    return;
  }

  // Get today's date in US Eastern time
  const etParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const dayName = etParts.find((p) => p.type === 'weekday')?.value ?? '';
  const month = etParts.find((p) => p.type === 'month')?.value ?? '01';
  const day = etParts.find((p) => p.type === 'day')?.value ?? '01';
  const year = etParts.find((p) => p.type === 'year')?.value ?? '2024';
  const isoDate = `${year}-${month}-${day}`;

  const todaySchedule = data.schedule[dayName];
  const openGymSlots = todaySchedule?.activities.filter((a) => a.isOpenGym) ?? [];

  let notifData: NotificationData;
  if (openGymSlots.length > 0) {
    const times = openGymSlots.map((a) => a.start).join(', ');
    notifData = {
      title: 'FL Gym — Open Gym Today',
      body: times,
      tag: 'flcc-daily',
      url: `${env.APP_ORIGIN}/fair-lawn-community-center-available/#status`,
    };
  } else {
    notifData = {
      title: 'FL Gym — Today\'s Schedule',
      body: 'No open gym today',
      tag: 'flcc-daily',
      url: `${env.APP_ORIGIN}/fair-lawn-community-center-available/#status`,
    };
  }

  const idKey = idempotencyKey(isoDate, dayName, 'daily', 'dailyBriefing');
  const result = await fanOut(env, notifData, 'dailyBriefing', idKey);
  console.log(`Daily briefing sent:`, result);
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

    return json({ error: 'Not found' }, 404);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleScheduled(env));
  },
};
