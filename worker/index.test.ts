import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker from './index.js';

// ─── Mock @block65/webcrypto-web-push ─────────────────────────────────────────

vi.mock('@block65/webcrypto-web-push', () => ({
  buildPushPayload: vi.fn().mockResolvedValue({ method: 'POST', headers: {}, body: '' }),
}));

// ─── KV Mock Factory ──────────────────────────────────────────────────────────

function createKVMock(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string, _opts?: unknown) => { store.set(key, value); },
    delete: async (key: string) => { store.delete(key); },
    list: async ({ cursor }: { cursor?: string } = {}) => ({
      keys: [...store.keys()].map(name => ({ name })),
      cursor: undefined,
      list_complete: true,
    }),
  };
}

// ─── Env Factory ─────────────────────────────────────────────────────────────

function makeEnv(kvMock: ReturnType<typeof createKVMock>) {
  return {
    SUBSCRIPTIONS: kvMock,
    VAPID_PUBLIC_KEY: 'pk',
    VAPID_PRIVATE_KEY: 'sk',
    VAPID_SUBJECT: 'https://example.com',
    NOTIFY_API_KEY: 'test-key',
    APP_ORIGIN: 'https://example.com',
    PAGES_DATA_URL: 'https://example.com/data.json',
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSub(overrides: {
  endpoint?: string;
  thirtyMin?: boolean;
  dailyBriefing?: boolean;
  sports?: string[];
  dailyBriefingHour?: number;
} = {}) {
  return JSON.stringify({
    endpoint: overrides.endpoint ?? 'https://push.example.com/sub1',
    keys: { p256dh: 'dGVzdA==', auth: 'dGVzdA==' },
    prefs: {
      thirtyMin: overrides.thirtyMin ?? true,
      dailyBriefing: overrides.dailyBriefing ?? true,
      sports: overrides.sports ?? [],
      dailyBriefingHour: overrides.dailyBriefingHour ?? 8,
    },
    subscribedAt: '2026-01-01T00:00:00.000Z',
  });
}

function notifyRequest(body: unknown, apiKey = 'test-key') {
  return new Request('https://example.com/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
    body: JSON.stringify(body),
  });
}

// ─── Paginated KV Mock Factory ────────────────────────────────────────────────

function createPaginatedKVMock(initial: Record<string, string>, pageSize: number) {
  const store = new Map(Object.entries(initial));
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string, _opts?: unknown) => { store.set(key, value); },
    delete: async (key: string) => { store.delete(key); },
    list: async ({ cursor }: { cursor?: string } = {}) => {
      const allKeys = [...store.keys()];
      const offset = cursor ? parseInt(cursor, 10) : 0;
      const page = allKeys.slice(offset, offset + pageSize);
      const nextOffset = offset + pageSize;
      const list_complete = nextOffset >= allKeys.length;
      return {
        keys: page.map(name => ({ name })),
        cursor: list_complete ? undefined : String(nextOffset),
        list_complete,
      };
    },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('fanOut idempotency', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns {sent:0, skipped:0, cleaned:0} immediately when idempotency key exists', async () => {
    // Compute the key exactly as the worker will — using today's actual date.
    // idempotencyKey(isoDate, dayName, actStart, '30min')
    // = `idempotent:${isoDate}:${dayName}:${actStart}:30min`
    const isoDate = new Date().toISOString().slice(0, 10);
    const actStart = '09:00';
    const dayName = 'Wednesday';
    const idKey = `idempotent:${isoDate}:${dayName}:${actStart}:30min`;

    const kv = createKVMock({
      // Pre-existing idempotency key matching what fanOut will compute
      [idKey]: '1',
      // A subscriber that would otherwise receive a push
      'sub-abc': makeSub({ endpoint: 'https://push.example.com/sub-abc' }),
    });
    const env = makeEnv(kv);

    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    global.fetch = mockFetch;

    const req = notifyRequest({
      type: '30min',
      activities: [{ start: actStart, end: '10:00', dayName }],
    });

    const res = await worker.fetch(req, env as never);
    const data = await res.json() as { ok: boolean; results: Array<{ sent: number; skipped: number; cleaned: number }> };

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    // fanOut finds the existing idempotency key and returns early without sending
    expect(data.results[0]).toEqual({ sent: 0, skipped: 0, cleaned: 0, failed: 0 });

    // Confirm push endpoint was never fetched
    const pushCalls = mockFetch.mock.calls.filter(
      ([url]: [string]) => url === 'https://push.example.com/sub-abc',
    );
    expect(pushCalls.length).toBe(0);
  });
});

describe('sport filtering', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('sends to basketball subscriber but skips volleyball subscriber when sportId=basketball', async () => {
    const kv = createKVMock({
      'sub-bball': makeSub({
        endpoint: 'https://push.example.com/bball',
        sports: ['basketball'],
      }),
      'sub-vball': makeSub({
        endpoint: 'https://push.example.com/vball',
        sports: ['volleyball'],
      }),
    });
    const env = makeEnv(kv);

    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    global.fetch = mockFetch;

    const req = notifyRequest({
      type: 'sport-30min',
      sportId: 'basketball',
      sportLabel: 'Basketball',
      activities: [{ start: '10:00', end: '11:00', dayName: 'Wednesday' }],
    });

    const res = await worker.fetch(req, env as never);
    const data = await res.json() as { ok: boolean; result: { sent: number; skipped: number; cleaned: number } };

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.result.sent).toBe(1);
    expect(data.result.skipped).toBe(1);
    expect(data.result.cleaned).toBe(0);

    // The basketball endpoint was called
    const bballCalls = mockFetch.mock.calls.filter(
      ([url]: [string]) => url === 'https://push.example.com/bball',
    );
    expect(bballCalls.length).toBe(1);

    // The volleyball endpoint was NOT called
    const vballCalls = mockFetch.mock.calls.filter(
      ([url]: [string]) => url === 'https://push.example.com/vball',
    );
    expect(vballCalls.length).toBe(0);
  });

  it('skips basketball subscriber when sportId=volleyball', async () => {
    const kv = createKVMock({
      'sub-bball': makeSub({
        endpoint: 'https://push.example.com/bball',
        sports: ['basketball'],
      }),
    });
    const env = makeEnv(kv);

    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    global.fetch = mockFetch;

    const req = notifyRequest({
      type: 'sport-30min',
      sportId: 'volleyball',
      sportLabel: 'Volleyball',
      activities: [{ start: '10:00', end: '11:00', dayName: 'Wednesday' }],
    });

    const res = await worker.fetch(req, env as never);
    const data = await res.json() as { ok: boolean; result: { sent: number; skipped: number; cleaned: number } };

    expect(res.status).toBe(200);
    expect(data.result.sent).toBe(0);
    expect(data.result.skipped).toBe(1);
  });
});

describe('thirtyMin filtering', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('skips subscriber with prefs.thirtyMin=false for type=30min', async () => {
    const kv = createKVMock({
      'sub-no30': makeSub({
        endpoint: 'https://push.example.com/no30',
        thirtyMin: false,
      }),
      'sub-yes30': makeSub({
        endpoint: 'https://push.example.com/yes30',
        thirtyMin: true,
      }),
    });
    const env = makeEnv(kv);

    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    global.fetch = mockFetch;

    const req = notifyRequest({
      type: '30min',
      activities: [{ start: '11:00', end: '12:00', dayName: 'Wednesday' }],
    });

    const res = await worker.fetch(req, env as never);
    const data = await res.json() as { ok: boolean; results: Array<{ sent: number; skipped: number; cleaned: number }> };

    expect(res.status).toBe(200);
    expect(data.results[0].sent).toBe(1);
    expect(data.results[0].skipped).toBe(1);

    // Only the yes30 endpoint was called
    const no30Calls = mockFetch.mock.calls.filter(
      ([url]: [string]) => url === 'https://push.example.com/no30',
    );
    expect(no30Calls.length).toBe(0);

    const yes30Calls = mockFetch.mock.calls.filter(
      ([url]: [string]) => url === 'https://push.example.com/yes30',
    );
    expect(yes30Calls.length).toBe(1);
  });
});

describe('dailyBriefing filtering', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Freeze time to a Wednesday (2026-02-18 is a Wednesday)
    // 2026-02-18T13:00:00.000Z = 8 AM EST (UTC-5) — matches default dailyBriefingHour=8
    vi.useFakeTimers({ now: new Date('2026-02-18T13:00:00.000Z') });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('skips subscriber with prefs.dailyBriefing=false for dailyBriefing fanOut', async () => {
    const kv = createKVMock({
      'sub-nodaily': makeSub({
        endpoint: 'https://push.example.com/nodaily',
        dailyBriefing: false,
      }),
      'sub-yesdaily': makeSub({
        endpoint: 'https://push.example.com/yesdaily',
        dailyBriefing: true,
      }),
    });
    const env = makeEnv(kv);

    // Mock fetch: first call is for PAGES_DATA_URL, subsequent calls are push endpoints
    const scheduleData = {
      scrapedAt: '2026-02-18T00:00:00.000Z',
      schedule: {
        Wednesday: {
          open: '09:00',
          close: '21:00',
          activities: [
            { name: 'Open Gym', start: '09:00', end: '10:00', isOpenGym: true },
          ],
        },
      },
      notices: [],
    };

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url === env.PAGES_DATA_URL) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(scheduleData),
        });
      }
      // Push endpoint calls
      return Promise.resolve({ ok: true, status: 201 });
    });
    global.fetch = mockFetch;

    // Trigger the scheduled handler
    // waitUntil captures the promise; we store it so we can await completion.
    let scheduledPromise: Promise<unknown> = Promise.resolve();
    const ctx = {
      waitUntil: (p: Promise<unknown>) => { scheduledPromise = p; },
    } as unknown as ExecutionContext;
    await worker.scheduled({} as ScheduledEvent, env as never, ctx);
    await scheduledPromise;

    // sub-nodaily should be skipped
    const nodailyCalls = mockFetch.mock.calls.filter(
      ([url]: [string]) => url === 'https://push.example.com/nodaily',
    );
    expect(nodailyCalls.length).toBe(0);

    // sub-yesdaily should receive a push
    const yesdailyCalls = mockFetch.mock.calls.filter(
      ([url]: [string]) => url === 'https://push.example.com/yesdaily',
    );
    expect(yesdailyCalls.length).toBe(1);
  });

  it('skips subscriber whose dailyBriefingHour does not match current ET hour', async () => {
    // Fake time: 2026-02-18T13:00:00.000Z = 8 AM EST
    const kv = createKVMock({
      'sub-8am': makeSub({ endpoint: 'https://push.example.com/8am', dailyBriefingHour: 8 }),
      'sub-9am': makeSub({ endpoint: 'https://push.example.com/9am', dailyBriefingHour: 9 }),
    });
    const env = makeEnv(kv);

    const scheduleData = {
      scrapedAt: '2026-02-18T00:00:00.000Z',
      schedule: {
        Wednesday: {
          open: '09:00',
          close: '21:00',
          activities: [
            { name: 'Open Gym', start: '09:00', end: '10:00', isOpenGym: true },
          ],
        },
      },
      notices: [],
    };
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url === env.PAGES_DATA_URL) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(scheduleData) });
      return Promise.resolve({ ok: true, status: 201 });
    });
    global.fetch = mockFetch;

    let scheduledPromise: Promise<unknown> = Promise.resolve();
    const ctx = { waitUntil: (p: Promise<unknown>) => { scheduledPromise = p; } } as unknown as ExecutionContext;
    await worker.scheduled({} as ScheduledEvent, env as never, ctx);
    await scheduledPromise;

    // sub-8am should receive push (hour matches)
    expect(mockFetch.mock.calls.filter(([url]: [string]) => url === 'https://push.example.com/8am').length).toBe(1);
    // sub-9am should NOT receive push (9 ≠ 8)
    expect(mockFetch.mock.calls.filter(([url]: [string]) => url === 'https://push.example.com/9am').length).toBe(0);
  });

  it('sends daily briefing when there is no open gym but other activities exist', async () => {
    // Fake time: 2026-02-18T13:00:00.000Z = 8 AM EST
    const kv = createKVMock({
      'sub-daily': makeSub({ endpoint: 'https://push.example.com/daily', dailyBriefingHour: 8 }),
    });
    const env = makeEnv(kv);

    const scheduleData = {
      scrapedAt: '2026-02-18T00:00:00.000Z',
      schedule: {
        Wednesday: {
          open: '09:00',
          close: '21:00',
          activities: [
            { name: 'Basketball', start: '10:00', end: '11:00', isOpenGym: false },
            { name: 'Tennis', start: '14:00', end: '15:00', isOpenGym: false },
          ],
        },
      },
      notices: [],
    };
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url === env.PAGES_DATA_URL) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(scheduleData) });
      return Promise.resolve({ ok: true, status: 201 });
    });
    global.fetch = mockFetch;

    let scheduledPromise: Promise<unknown> = Promise.resolve();
    const ctx = { waitUntil: (p: Promise<unknown>) => { scheduledPromise = p; } } as unknown as ExecutionContext;
    await worker.scheduled({} as ScheduledEvent, env as never, ctx);
    await scheduledPromise;

    // Should send even without open gym
    const pushCalls = mockFetch.mock.calls.filter(([url]: [string]) => url === 'https://push.example.com/daily');
    expect(pushCalls.length).toBe(1);
  });

  it('skips daily briefing when no activities are scheduled today', async () => {
    // Fake time: 2026-02-18T13:00:00.000Z = 8 AM EST
    const kv = createKVMock({
      'sub-daily': makeSub({ endpoint: 'https://push.example.com/daily', dailyBriefingHour: 8 }),
    });
    const env = makeEnv(kv);

    const scheduleData = {
      scrapedAt: '2026-02-18T00:00:00.000Z',
      schedule: {
        Wednesday: { open: '09:00', close: '21:00', activities: [] },
      },
      notices: [],
    };
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url === env.PAGES_DATA_URL) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(scheduleData) });
      return Promise.resolve({ ok: true, status: 201 });
    });
    global.fetch = mockFetch;

    let scheduledPromise: Promise<unknown> = Promise.resolve();
    const ctx = { waitUntil: (p: Promise<unknown>) => { scheduledPromise = p; } } as unknown as ExecutionContext;
    await worker.scheduled({} as ScheduledEvent, env as never, ctx);
    await scheduledPromise;

    // No activities → no push sent
    const pushCalls = mockFetch.mock.calls.filter(([url]: [string]) => url === 'https://push.example.com/daily');
    expect(pushCalls.length).toBe(0);
  });
});

describe('410 cleanup', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('deletes subscription from KV when push endpoint returns 410', async () => {
    const kv = createKVMock({
      'sub-gone': makeSub({
        endpoint: 'https://push.example.com/gone',
        thirtyMin: true,
      }),
    });
    const env = makeEnv(kv);

    // The push endpoint returns 410 — subscription has expired
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 410 });
    global.fetch = mockFetch;

    const req = notifyRequest({
      type: '30min',
      activities: [{ start: '14:00', end: '15:00', dayName: 'Wednesday' }],
    });

    const res = await worker.fetch(req, env as never);
    const data = await res.json() as { ok: boolean; results: Array<{ sent: number; skipped: number; cleaned: number }> };

    expect(res.status).toBe(200);
    expect(data.results[0].cleaned).toBe(1);
    expect(data.results[0].sent).toBe(0);

    // Verify the key was deleted from KV
    const remaining = await kv.get('sub-gone');
    expect(remaining).toBeNull();
  });
});

describe('fanOut non-2xx delivery', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('does not count non-2xx push delivery as sent', async () => {
    const kv = createKVMock({
      'sub-bad': makeSub({
        endpoint: 'https://push.example.com/bad',
        thirtyMin: true,
      }),
    });
    const env = makeEnv(kv);

    // Push endpoint returns 400 Bad Request — not 2xx, not 410/404, not 429
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 400 });
    global.fetch = mockFetch;

    const req = notifyRequest({
      type: '30min',
      activities: [{ start: '15:00', end: '16:00', dayName: 'Wednesday' }],
    });

    const res = await worker.fetch(req, env as never);
    const data = await res.json() as { ok: boolean; results: Array<{ sent: number; skipped: number; cleaned: number; failed: number }> };

    expect(res.status).toBe(200);
    expect(data.results[0].sent).toBe(0);
    expect(data.results[0].failed).toBe(1);
  });
});

describe('/stats auth', () => {
  it('returns 401 when X-Api-Key is wrong', async () => {
    const kv = createKVMock({});
    const env = makeEnv(kv);

    const req = new Request('https://example.com/stats', {
      method: 'GET',
      headers: { 'X-Api-Key': 'wrong-key' },
    });

    const res = await worker.fetch(req, env as never);
    expect(res.status).toBe(401);

    const data = await res.json() as { error: string };
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 401 when X-Api-Key header is missing', async () => {
    const kv = createKVMock({});
    const env = makeEnv(kv);

    const req = new Request('https://example.com/stats', {
      method: 'GET',
    });

    const res = await worker.fetch(req, env as never);
    expect(res.status).toBe(401);
  });
});

describe('/stats counting', () => {
  it('returns correct subscriber and idempotency key counts', async () => {
    const kv = createKVMock({
      'sub-aaa': makeSub({ endpoint: 'https://push.example.com/aaa' }),
      'sub-bbb': makeSub({ endpoint: 'https://push.example.com/bbb' }),
      'sub-ccc': makeSub({ endpoint: 'https://push.example.com/ccc' }),
      'idempotent:2026-02-18:Wednesday:09:00:30min': '1',
      'idempotent:2026-02-18:Wednesday:sport-basketball': '1',
    });
    const env = makeEnv(kv);

    const req = new Request('https://example.com/stats', {
      method: 'GET',
      headers: { 'X-Api-Key': 'test-key' },
    });

    const res = await worker.fetch(req, env as never);
    expect(res.status).toBe(200);

    const data = await res.json() as { ok: boolean; subscribers: number; idempotencyKeys: number };
    expect(data.ok).toBe(true);
    expect(data.subscribers).toBe(3);
    expect(data.idempotencyKeys).toBe(2);
  });

  it('returns zeros when KV is empty', async () => {
    const kv = createKVMock({});
    const env = makeEnv(kv);

    const req = new Request('https://example.com/stats', {
      method: 'GET',
      headers: { 'X-Api-Key': 'test-key' },
    });

    const res = await worker.fetch(req, env as never);
    expect(res.status).toBe(200);

    const data = await res.json() as { ok: boolean; subscribers: number; idempotencyKeys: number };
    expect(data.ok).toBe(true);
    expect(data.subscribers).toBe(0);
    expect(data.idempotencyKeys).toBe(0);
  });

  it('counts only idempotency keys when all keys are idempotent', async () => {
    const kv = createKVMock({
      'idempotent:2026-02-18:Wednesday:daily:dailyBriefing': '1',
    });
    const env = makeEnv(kv);

    const req = new Request('https://example.com/stats', {
      method: 'GET',
      headers: { 'X-Api-Key': 'test-key' },
    });

    const res = await worker.fetch(req, env as never);
    const data = await res.json() as { ok: boolean; subscribers: number; idempotencyKeys: number };
    expect(data.subscribers).toBe(0);
    expect(data.idempotencyKeys).toBe(1);
  });
});

describe('cursor pagination', () => {
  it('handleStats counts all subscribers across multiple pages', async () => {
    const kv = createPaginatedKVMock(
      {
        'sub-1': makeSub({ endpoint: 'https://push.example.com/1' }),
        'sub-2': makeSub({ endpoint: 'https://push.example.com/2' }),
        'sub-3': makeSub({ endpoint: 'https://push.example.com/3' }),
        'sub-4': makeSub({ endpoint: 'https://push.example.com/4' }),
        'sub-5': makeSub({ endpoint: 'https://push.example.com/5' }),
        'idempotent:2026-02-18:Wednesday:09:00:30min': '1',
        'idempotent:2026-02-18:Wednesday:sport-basketball': '1',
      },
      2,
    );
    const env = makeEnv(kv);

    const req = new Request('https://example.com/stats', {
      method: 'GET',
      headers: { 'X-Api-Key': 'test-key' },
    });

    const res = await worker.fetch(req, env as never);
    expect(res.status).toBe(200);

    const data = await res.json() as { ok: boolean; subscribers: number; idempotencyKeys: number };
    expect(data.ok).toBe(true);
    expect(data.subscribers).toBe(5);
    expect(data.idempotencyKeys).toBe(2);
  });
});

describe('/unsubscribe', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  function unsubscribeRequest(endpoint: string) {
    return new Request('https://example.com/unsubscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    });
  }

  it('subscribe then unsubscribe returns 200 ok', async () => {
    const kv = createKVMock({});
    const env = makeEnv(kv);

    // Subscribe first
    const subReq = new Request('https://example.com/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'https://push.example.com/to-remove',
        keys: { p256dh: 'dGVzdA==', auth: 'dGVzdA==' },
        prefs: { thirtyMin: true, dailyBriefing: true, sports: [] },
      }),
    });
    const subRes = await worker.fetch(subReq, env as never);
    expect(subRes.status).toBe(201);

    // Now unsubscribe
    const unsubRes = await worker.fetch(unsubscribeRequest('https://push.example.com/to-remove'), env as never);
    expect(unsubRes.status).toBe(200);
    const data = await unsubRes.json() as { ok: boolean };
    expect(data.ok).toBe(true);
  });

  it('returns 404 for unknown endpoint', async () => {
    const kv = createKVMock({});
    const env = makeEnv(kv);

    const res = await worker.fetch(unsubscribeRequest('https://push.example.com/nonexistent'), env as never);
    expect(res.status).toBe(404);
    const data = await res.json() as { error: string };
    expect(data.error).toBe('Subscription not found');
  });

  it('returns 400 when endpoint field is missing', async () => {
    const kv = createKVMock({});
    const env = makeEnv(kv);

    const req = new Request('https://example.com/unsubscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await worker.fetch(req, env as never);
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toBe('Missing endpoint');
  });

  it('returns 400 for malformed endpoint (not https://)', async () => {
    const kv = createKVMock({});
    const env = makeEnv(kv);

    const req = new Request('https://example.com/unsubscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: 'http://push.example.com/bad-scheme' }),
    });
    const res = await worker.fetch(req, env as never);
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toBe('Invalid endpoint');
  });
});

describe('fanOut network failure', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('counts network errors in failed', async () => {
    const kv = createKVMock({
      'sub-net-err': makeSub({
        endpoint: 'https://push.example.com/net-err',
        thirtyMin: true,
      }),
    });
    const env = makeEnv(kv);

    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    const req = notifyRequest({
      type: '30min',
      activities: [{ start: '16:00', end: '17:00', dayName: 'Wednesday' }],
    });

    const res = await worker.fetch(req, env as never);
    const data = await res.json() as { ok: boolean; results: Array<{ sent: number; skipped: number; cleaned: number; failed: number }> };

    expect(res.status).toBe(200);
    expect(data.results[0].failed).toBe(1);
    expect(data.results[0].sent).toBe(0);
    expect(data.results[0].cleaned).toBe(0);
    expect(data.results[0].skipped).toBe(0);
  });
});

describe('thirtyMin cron notifications', () => {
  // Fake time: 2026-02-18T13:30:00.000Z = 8:30 AM EST (UTC-5)
  // Activity "9:00 AM" = 540 minutes; nowMinutes = 510; diff = 30 → in window [20, 45]
  const FAKE_NOW = new Date('2026-02-18T13:30:00.000Z');

  function makeScheduleData(activities: Array<{ name: string; start: string; end: string; isOpenGym: boolean }>) {
    return {
      scrapedAt: '2026-02-18T00:00:00.000Z',
      schedule: {
        Wednesday: {
          open: '8:00 AM',
          close: '10:00 PM',
          activities,
        },
      },
      notices: [],
    };
  }

  function makeScheduledCtx() {
    let scheduledPromise: Promise<unknown> = Promise.resolve();
    const ctx = {
      waitUntil: (p: Promise<unknown>) => { scheduledPromise = p; },
    } as unknown as ExecutionContext;
    return { ctx, getPromise: () => scheduledPromise };
  }

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ now: FAKE_NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends open gym notification when activity starts in 30-min window', async () => {
    // 8:30 AM now, activity at 9:00 AM → diff = 30 min → in [20, 45]
    const kv = createKVMock({
      'sub-og': makeSub({ endpoint: 'https://push.example.com/og', thirtyMin: true }),
    });
    const env = makeEnv(kv);

    const scheduleData = makeScheduleData([
      { name: 'Open Gym', start: '9:00 AM', end: '10:00 AM', isOpenGym: true },
    ]);
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url === env.PAGES_DATA_URL) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(scheduleData) });
      return Promise.resolve({ ok: true, status: 201 });
    });
    global.fetch = mockFetch;

    const { ctx, getPromise } = makeScheduledCtx();
    await worker.scheduled({ cron: '*/30 * * * *' } as ScheduledEvent, env as never, ctx);
    await getPromise();

    const pushCalls = mockFetch.mock.calls.filter(([url]: [string]) => url === 'https://push.example.com/og');
    expect(pushCalls.length).toBe(1);
  });

  it('skips open gym activity outside the 30-min window (2 min away or 60 min away)', async () => {
    // 8:30 AM now; 8:32 AM = diff 2 (< 20); 9:30 AM = diff 60 (> 45)
    const kv = createKVMock({
      'sub-og': makeSub({ endpoint: 'https://push.example.com/og', thirtyMin: true }),
    });
    const env = makeEnv(kv);

    const scheduleData = makeScheduleData([
      { name: 'Open Gym', start: '8:32 AM', end: '9:00 AM', isOpenGym: true },
      { name: 'Open Gym', start: '9:30 AM', end: '10:30 AM', isOpenGym: true },
    ]);
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url === env.PAGES_DATA_URL) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(scheduleData) });
      return Promise.resolve({ ok: true, status: 201 });
    });
    global.fetch = mockFetch;

    const { ctx, getPromise } = makeScheduledCtx();
    await worker.scheduled({ cron: '*/30 * * * *' } as ScheduledEvent, env as never, ctx);
    await getPromise();

    const pushCalls = mockFetch.mock.calls.filter(([url]: [string]) => url === 'https://push.example.com/og');
    expect(pushCalls.length).toBe(0);
  });

  it('sends sport notification to matching subscriber, skips non-matching subscriber', async () => {
    // 8:30 AM now, basketball at 9:00 AM → diff 30 → in window
    const kv = createKVMock({
      'sub-bball': makeSub({ endpoint: 'https://push.example.com/bball', thirtyMin: true, sports: ['basketball'] }),
      'sub-vball': makeSub({ endpoint: 'https://push.example.com/vball', thirtyMin: true, sports: ['volleyball'] }),
    });
    const env = makeEnv(kv);

    const scheduleData = makeScheduleData([
      { name: 'Basketball', start: '9:00 AM', end: '10:00 AM', isOpenGym: false },
    ]);
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url === env.PAGES_DATA_URL) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(scheduleData) });
      return Promise.resolve({ ok: true, status: 201 });
    });
    global.fetch = mockFetch;

    const { ctx, getPromise } = makeScheduledCtx();
    await worker.scheduled({ cron: '*/30 * * * *' } as ScheduledEvent, env as never, ctx);
    await getPromise();

    // Basketball subscriber receives push
    expect(mockFetch.mock.calls.filter(([url]: [string]) => url === 'https://push.example.com/bball').length).toBe(1);
    // Volleyball subscriber does not
    expect(mockFetch.mock.calls.filter(([url]: [string]) => url === 'https://push.example.com/vball').length).toBe(0);
  });

  it('respects idempotency — second identical scheduled run is skipped', async () => {
    const kv = createKVMock({
      'sub-og': makeSub({ endpoint: 'https://push.example.com/og', thirtyMin: true }),
    });
    const env = makeEnv(kv);

    const scheduleData = makeScheduleData([
      { name: 'Open Gym', start: '9:00 AM', end: '10:00 AM', isOpenGym: true },
    ]);
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url === env.PAGES_DATA_URL) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(scheduleData) });
      return Promise.resolve({ ok: true, status: 201 });
    });
    global.fetch = mockFetch;

    // First run
    const { ctx: ctx1, getPromise: getPromise1 } = makeScheduledCtx();
    await worker.scheduled({ cron: '*/30 * * * *' } as ScheduledEvent, env as never, ctx1);
    await getPromise1();
    const firstRunPushes = mockFetch.mock.calls.filter(([url]: [string]) => url === 'https://push.example.com/og').length;
    expect(firstRunPushes).toBe(1);

    // Second run with same fake time — idempotency key is already set
    mockFetch.mockClear();
    const { ctx: ctx2, getPromise: getPromise2 } = makeScheduledCtx();
    await worker.scheduled({ cron: '*/30 * * * *' } as ScheduledEvent, env as never, ctx2);
    await getPromise2();
    const secondRunPushes = mockFetch.mock.calls.filter(([url]: [string]) => url === 'https://push.example.com/og').length;
    expect(secondRunPushes).toBe(0);
  });

  it('skips outside gym hours — before 8 AM ET', async () => {
    // Override to 7:30 AM EST = 12:30 UTC
    vi.setSystemTime(new Date('2026-02-18T12:30:00.000Z'));

    const kv = createKVMock({
      'sub-og': makeSub({ endpoint: 'https://push.example.com/og', thirtyMin: true }),
    });
    const env = makeEnv(kv);

    const scheduleData = makeScheduleData([
      { name: 'Open Gym', start: '8:00 AM', end: '9:00 AM', isOpenGym: true },
    ]);
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url === env.PAGES_DATA_URL) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(scheduleData) });
      return Promise.resolve({ ok: true, status: 201 });
    });
    global.fetch = mockFetch;

    const { ctx, getPromise } = makeScheduledCtx();
    await worker.scheduled({ cron: '*/30 * * * *' } as ScheduledEvent, env as never, ctx);
    await getPromise();

    // Should not even fetch the schedule (returns early on gym hours check)
    const pageFetches = mockFetch.mock.calls.filter(([url]: [string]) => url === env.PAGES_DATA_URL);
    expect(pageFetches.length).toBe(0);
  });

  it('skips outside gym hours — at 10 PM ET (22:00)', async () => {
    // 10 PM EST = 03:00 UTC next day
    vi.setSystemTime(new Date('2026-02-19T03:00:00.000Z'));

    const kv = createKVMock({
      'sub-og': makeSub({ endpoint: 'https://push.example.com/og', thirtyMin: true }),
    });
    const env = makeEnv(kv);

    const scheduleData = makeScheduleData([
      { name: 'Open Gym', start: '10:30 PM', end: '11:00 PM', isOpenGym: true },
    ]);
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url === env.PAGES_DATA_URL) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(scheduleData) });
      return Promise.resolve({ ok: true, status: 201 });
    });
    global.fetch = mockFetch;

    const { ctx, getPromise } = makeScheduledCtx();
    await worker.scheduled({ cron: '*/30 * * * *' } as ScheduledEvent, env as never, ctx);
    await getPromise();

    const pageFetches = mockFetch.mock.calls.filter(([url]: [string]) => url === env.PAGES_DATA_URL);
    expect(pageFetches.length).toBe(0);
  });

  it('cron dispatch: */30 cron routes to 30-min handler, not daily briefing', async () => {
    // 8:30 AM ET now; open gym at 9:00 AM = in window
    // Daily briefing would send title 'Fair Lawn Gym · Today'; 30-min sends 'Open Gym starting soon'
    const kv = createKVMock({
      'sub-og': makeSub({ endpoint: 'https://push.example.com/og', thirtyMin: true }),
    });
    const env = makeEnv(kv);

    const scheduleData = makeScheduleData([
      { name: 'Open Gym', start: '9:00 AM', end: '10:00 AM', isOpenGym: true },
    ]);
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url === env.PAGES_DATA_URL) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(scheduleData) });
      return Promise.resolve({ ok: true, status: 201 });
    });
    global.fetch = mockFetch;

    const { ctx, getPromise } = makeScheduledCtx();
    await worker.scheduled({ cron: '*/30 * * * *' } as ScheduledEvent, env as never, ctx);
    await getPromise();

    // Verify push was sent (30-min handler ran, not daily)
    const pushCalls = mockFetch.mock.calls.filter(([url]: [string]) => url === 'https://push.example.com/og');
    expect(pushCalls.length).toBe(1);

    // Verify notification content is from 30-min handler (not daily briefing)
    // The push payload body is built by buildPushPayload — check the notifData passed to it
    // by inspecting the KV idempotency keys written
    const idempKey = await kv.get('idempotent:2026-02-18:opengym:9:00 AM:thirtyMin');
    expect(idempKey).toBe('1');
  });
});

describe('sport-30min', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('skips subscriber with empty sports array for sport-30min', async () => {
    const kv = createKVMock({
      'sub-nosports': makeSub({
        endpoint: 'https://push.example.com/nosports',
        sports: [],
      }),
    });
    const env = makeEnv(kv);

    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    global.fetch = mockFetch;

    const req = notifyRequest({
      type: 'sport-30min',
      sportId: 'basketball',
      sportLabel: 'Basketball',
      activities: [{ start: '10:00', end: '11:00', dayName: 'Wednesday' }],
    });

    const res = await worker.fetch(req, env as never);
    const data = await res.json() as { ok: boolean; result: { sent: number; skipped: number; cleaned: number } };

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.result.sent).toBe(0);
    expect(data.result.skipped).toBe(1);
  });

  it('sends push to subscriber with matching sport', async () => {
    const kv = createKVMock({
      'sub-bball': makeSub({
        endpoint: 'https://push.example.com/bball',
        sports: ['basketball'],
      }),
      'sub-nosport': makeSub({
        endpoint: 'https://push.example.com/nosport',
        sports: [],
      }),
    });
    const env = makeEnv(kv);
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    global.fetch = mockFetch;

    const res = await worker.fetch(
      new Request('https://worker.example.com/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': 'test-key' },
        body: JSON.stringify({
          type: 'sport-30min',
          sportId: 'basketball',
          sportLabel: 'Basketball',
          activities: [{ start: '5:00 PM', end: '7:00 PM', dayName: 'Monday' }],
        }),
      }),
      env as never,
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { result: { sent: number; skipped: number } };
    expect(body.result.sent).toBe(1);
    expect(body.result.skipped).toBe(1); // sub-nosport has sports: []

    const bballCalls = mockFetch.mock.calls.filter(
      ([url]: [string]) => url === 'https://push.example.com/bball',
    );
    expect(bballCalls.length).toBe(1);
  });
});

describe('/subscribe dailyBriefingHour validation', () => {
  it('returns 400 when dailyBriefingHour is 6 (below range)', async () => {
    const kv = createKVMock({});
    const env = makeEnv(kv);

    const req = new Request('https://example.com/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'https://push.example.com/sub-bad-hour',
        keys: { p256dh: 'dGVzdA==', auth: 'dGVzdA==' },
        prefs: { thirtyMin: true, dailyBriefing: true, sports: [], dailyBriefingHour: 6 },
      }),
    });

    const res = await worker.fetch(req, env as never);
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toBe('dailyBriefingHour must be 7, 8, 9, or 10');
  });
});

describe('/subscription (updatePrefs) dailyBriefingHour validation', () => {
  it('returns 400 when dailyBriefingHour is 11 (above range)', async () => {
    const endpoint = 'https://push.example.com/sub-update-bad-hour';
    const kv = createKVMock({});
    const env = makeEnv(kv);

    // Subscribe first so the subscription exists
    const subReq = new Request('https://example.com/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint,
        keys: { p256dh: 'dGVzdA==', auth: 'dGVzdA==' },
        prefs: { thirtyMin: true, dailyBriefing: true, sports: [], dailyBriefingHour: 8 },
      }),
    });
    const subRes = await worker.fetch(subReq, env as never);
    expect(subRes.status).toBe(201);

    // Now attempt to update with an out-of-range hour
    const patchReq = new Request('https://example.com/subscription', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint,
        prefs: { dailyBriefingHour: 11 },
      }),
    });

    const res = await worker.fetch(patchReq, env as never);
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toBe('dailyBriefingHour must be 7, 8, 9, or 10');
  });
});
