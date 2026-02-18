// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// ─── Mock factories ────────────────────────────────────────────────────────

function makeSelf(origin = 'http://localhost') {
  const _listeners: Record<string, (e: unknown) => void> = {};
  return {
    location: { origin },
    skipWaiting: vi.fn().mockResolvedValue(undefined),
    clients: { claim: vi.fn().mockResolvedValue(undefined) },
    addEventListener(event: string, handler: (e: unknown) => void) {
      _listeners[event] = handler;
    },
    _listeners,
  };
}

function makeCacheStorage() {
  const _store = new Map<string, Map<string, Response>>();

  async function open(name: string) {
    if (!_store.has(name)) _store.set(name, new Map());
    const bucket = _store.get(name)!;
    return {
      put(req: { url: string } | string, res: Response) {
        bucket.set(typeof req === 'string' ? req : req.url, res);
        return Promise.resolve();
      },
      match(req: { url: string } | string) {
        return Promise.resolve(bucket.get(typeof req === 'string' ? req : req.url));
      },
    };
  }

  return {
    open,
    keys: () => Promise.resolve([..._store.keys()]),
    delete: (name: string) => Promise.resolve(_store.delete(name)),
    match(req: { url: string } | string) {
      const key = typeof req === 'string' ? req : req.url;
      for (const bucket of _store.values()) {
        const res = bucket.get(key);
        if (res) return Promise.resolve(res);
      }
      return Promise.resolve(undefined);
    },
    _store,
  };
}

function makeRequest(url: string, opts: { mode?: string } = {}) {
  return { url, mode: opts.mode ?? 'cors' } as unknown as Request;
}

async function loadSW(
  mockSelf: ReturnType<typeof makeSelf>,
  mockCaches: ReturnType<typeof makeCacheStorage>,
  mockFetch: ReturnType<typeof vi.fn>,
) {
  vi.stubGlobal('self', mockSelf);
  vi.stubGlobal('caches', mockCaches);
  vi.stubGlobal('fetch', mockFetch);
  vi.resetModules();
  await import('../public/sw.js');
}

async function dispatchFetch(
  listeners: Record<string, (e: unknown) => void>,
  req: ReturnType<typeof makeRequest>,
) {
  let respondWithCalled = false;
  let responsePromise: Promise<Response> | undefined;
  const event = {
    request: req,
    respondWith(p: Promise<Response>) {
      respondWithCalled = true;
      responsePromise = p;
    },
    waitUntil: vi.fn(),
  };
  listeners['fetch']?.(event);
  return { respondWithCalled, responsePromise };
}

async function dispatchActivate(listeners: Record<string, (e: unknown) => void>) {
  let waitUntilPromise: Promise<unknown> | undefined;
  const event = {
    waitUntil(p: Promise<unknown>) { waitUntilPromise = p; },
  };
  listeners['activate']?.(event);
  if (waitUntilPromise) await waitUntilPromise;
}

const flush = () => new Promise(r => setTimeout(r, 10));

// ─── Test suites ───────────────────────────────────────────────────────────

describe('navigate — network-first (online)', () => {
  const mockSelf = makeSelf();
  const mockCaches = makeCacheStorage();
  const mockFetch = vi.fn();
  let result: Awaited<ReturnType<typeof dispatchFetch>>;

  beforeAll(async () => {
    mockFetch.mockResolvedValue(
      new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } }),
    );
    await loadSW(mockSelf, mockCaches, mockFetch);
    result = await dispatchFetch(
      mockSelf._listeners,
      makeRequest('http://localhost/', { mode: 'navigate' }),
    );
    await result.responsePromise;
    await flush();
  });

  afterAll(() => vi.unstubAllGlobals());

  it('calls respondWith', () => {
    expect(result.respondWithCalled).toBe(true);
  });

  it('serves network response', async () => {
    // Dispatch again to get a fresh (un-consumed) response
    mockFetch.mockResolvedValue(
      new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } }),
    );
    const r = await dispatchFetch(
      mockSelf._listeners,
      makeRequest('http://localhost/', { mode: 'navigate' }),
    );
    const res = await r.responsePromise!;
    expect(res.status).toBe(200);
  });

  it('caches response in shell-v2', () => {
    expect(mockCaches._store.get('shell-v2')?.has('http://localhost/')).toBe(true);
  });
});

describe('navigate — offline fallback', () => {
  const mockSelf = makeSelf();
  const mockCaches = makeCacheStorage();
  const mockFetch = vi.fn();

  beforeAll(async () => {
    const cache = await mockCaches.open('shell-v2');
    await cache.put('http://localhost/', new Response('<html cached>', { status: 200 }));
    mockFetch.mockRejectedValue(new Error('offline'));
    await loadSW(mockSelf, mockCaches, mockFetch);
  });

  afterAll(() => vi.unstubAllGlobals());

  it('falls back to cached response', async () => {
    const req = makeRequest('http://localhost/', { mode: 'navigate' });
    const { responsePromise } = await dispatchFetch(mockSelf._listeners, req);
    const res = await responsePromise!;
    const text = await res.text();
    expect(text).toBe('<html cached>');
  });
});

describe('/data/*.json — network-first with content-type check', () => {
  const mockSelf = makeSelf();
  const mockCaches = makeCacheStorage();
  const mockFetch = vi.fn();

  beforeAll(async () => {
    await loadSW(mockSelf, mockCaches, mockFetch);
  });

  afterAll(() => vi.unstubAllGlobals());

  it('respondWith is called and caches when content-type is application/json', async () => {
    mockFetch.mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const req = makeRequest('http://localhost/data/schedule.json');
    const { respondWithCalled, responsePromise } = await dispatchFetch(mockSelf._listeners, req);
    expect(respondWithCalled).toBe(true);
    await responsePromise;
    await flush();
    expect(mockCaches._store.get('data-v1')?.has('http://localhost/data/schedule.json')).toBe(true);
  });

  it('does NOT cache when content-type is wrong', async () => {
    mockFetch.mockResolvedValue(
      new Response('error', { status: 200, headers: { 'content-type': 'text/plain' } }),
    );
    const req = makeRequest('http://localhost/data/other.json');
    const { responsePromise } = await dispatchFetch(mockSelf._listeners, req);
    await responsePromise;
    await flush();
    const hasCached = mockCaches._store.get('data-v1')?.has('http://localhost/data/other.json') ?? false;
    expect(hasCached).toBe(false);
  });
});

describe('/data/*.json — offline fallback', () => {
  const mockSelf = makeSelf();
  const mockCaches = makeCacheStorage();
  const mockFetch = vi.fn();

  beforeAll(async () => {
    const cache = await mockCaches.open('data-v1');
    await cache.put('http://localhost/data/schedule.json', new Response('{"cached":true}', { status: 200 }));
    mockFetch.mockRejectedValue(new Error('offline'));
    await loadSW(mockSelf, mockCaches, mockFetch);
  });

  afterAll(() => vi.unstubAllGlobals());

  it('falls back to cached data', async () => {
    const req = makeRequest('http://localhost/data/schedule.json');
    const { responsePromise } = await dispatchFetch(mockSelf._listeners, req);
    const res = await responsePromise!;
    const text = await res.text();
    expect(text).toBe('{"cached":true}');
  });
});

describe('/assets/* — cache-first', () => {
  const mockSelf = makeSelf();
  const mockCaches = makeCacheStorage();
  const mockFetch = vi.fn();

  beforeAll(async () => {
    const cache = await mockCaches.open('assets-v1');
    await cache.put('http://localhost/assets/main.js', new Response('cached-js', { status: 200 }));
    await loadSW(mockSelf, mockCaches, mockFetch);
  });

  afterAll(() => vi.unstubAllGlobals());

  it('cache hit: returns cached response without calling fetch', async () => {
    const req = makeRequest('http://localhost/assets/main.js');
    const { respondWithCalled, responsePromise } = await dispatchFetch(mockSelf._listeners, req);
    expect(respondWithCalled).toBe(true);
    const res = await responsePromise!;
    expect(await res.text()).toBe('cached-js');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('cache miss: fetches network and stores in assets-v1', async () => {
    mockFetch.mockResolvedValue(new Response('new-js', { status: 200 }));
    const req = makeRequest('http://localhost/assets/new.js');
    const { responsePromise } = await dispatchFetch(mockSelf._listeners, req);
    await responsePromise;
    await flush();
    expect(mockFetch).toHaveBeenCalled();
    expect(mockCaches._store.get('assets-v1')?.has('http://localhost/assets/new.js')).toBe(true);
  });
});

describe('non-matching requests', () => {
  const mockSelf = makeSelf();
  const mockCaches = makeCacheStorage();
  const mockFetch = vi.fn();

  beforeAll(async () => {
    await loadSW(mockSelf, mockCaches, mockFetch);
  });

  afterAll(() => vi.unstubAllGlobals());

  it('other same-origin URL does NOT call respondWith', async () => {
    const req = makeRequest('http://localhost/manifest.json');
    const { respondWithCalled } = await dispatchFetch(mockSelf._listeners, req);
    expect(respondWithCalled).toBe(false);
  });

  it('cross-origin URL does NOT call respondWith', async () => {
    const req = makeRequest('https://external.com/api/data');
    const { respondWithCalled } = await dispatchFetch(mockSelf._listeners, req);
    expect(respondWithCalled).toBe(false);
  });
});

// ─── Push event helpers ────────────────────────────────────────────────────

function makePushEvent(data: unknown) {
  const jsonFn = () => data;
  const textFn = () => JSON.stringify(data);
  return {
    data: { json: jsonFn, text: textFn },
    waitUntil: vi.fn((p: Promise<unknown>) => p),
  };
}

function makePushEventNoData() {
  return {
    data: null,
    waitUntil: vi.fn(),
  };
}

function makePushEventBadJson() {
  return {
    data: { json: () => { throw new SyntaxError('bad json'); }, text: () => 'raw text' },
    waitUntil: vi.fn((p: Promise<unknown>) => p),
  };
}

function makeNotificationClickEvent(url: string) {
  return {
    notification: { close: vi.fn(), data: { url } },
    waitUntil: vi.fn((p: Promise<unknown>) => p),
  };
}

function makeSelfWithPush(origin = 'http://localhost') {
  const base = makeSelf(origin);
  const showNotification = vi.fn().mockResolvedValue(undefined);
  return {
    ...base,
    registration: { showNotification },
    clients: {
      ...base.clients,
      matchAll: vi.fn(),
      openWindow: vi.fn().mockResolvedValue(undefined),
    },
  };
}

// ─── Push handler tests ─────────────────────────────────────────────────────

describe('push event — valid JSON', () => {
  const mockSelf = makeSelfWithPush();
  const mockCaches = makeCacheStorage();
  const mockFetch = vi.fn();

  beforeAll(async () => {
    await loadSW(mockSelf as unknown as ReturnType<typeof makeSelf>, mockCaches, mockFetch);
  });

  afterAll(() => vi.unstubAllGlobals());

  it('calls showNotification with correct title/body/tag', async () => {
    const event = makePushEvent({ title: 'Test Title', body: 'Test Body', tag: 'flcc-30min', url: '/test' });
    mockSelf._listeners['push']?.(event);
    await event.waitUntil.mock.calls[0]?.[0];
    expect(mockSelf.registration.showNotification).toHaveBeenCalledWith('Test Title', expect.objectContaining({
      body: 'Test Body',
      tag: 'flcc-30min',
    }));
  });
});

describe('push event — no data', () => {
  const mockSelf = makeSelfWithPush();
  const mockCaches = makeCacheStorage();
  const mockFetch = vi.fn();

  beforeAll(async () => {
    await loadSW(mockSelf as unknown as ReturnType<typeof makeSelf>, mockCaches, mockFetch);
  });

  afterAll(() => vi.unstubAllGlobals());

  it('does NOT call showNotification when event.data is null', () => {
    const event = makePushEventNoData();
    mockSelf._listeners['push']?.(event);
    expect(mockSelf.registration.showNotification).not.toHaveBeenCalled();
    expect(event.waitUntil).not.toHaveBeenCalled();
  });
});

describe('push event — malformed JSON', () => {
  const mockSelf = makeSelfWithPush();
  const mockCaches = makeCacheStorage();
  const mockFetch = vi.fn();

  beforeAll(async () => {
    await loadSW(mockSelf as unknown as ReturnType<typeof makeSelf>, mockCaches, mockFetch);
  });

  afterAll(() => vi.unstubAllGlobals());

  it('falls back to text body when JSON parsing fails', async () => {
    const event = makePushEventBadJson();
    mockSelf._listeners['push']?.(event);
    await event.waitUntil.mock.calls[0]?.[0];
    expect(mockSelf.registration.showNotification).toHaveBeenCalledWith(
      'FL Community Center',
      expect.objectContaining({ body: 'raw text' }),
    );
  });
});

describe('notificationclick — existing window focused', () => {
  const mockSelf = makeSelfWithPush();
  const mockCaches = makeCacheStorage();
  const mockFetch = vi.fn();

  beforeAll(async () => {
    await loadSW(mockSelf as unknown as ReturnType<typeof makeSelf>, mockCaches, mockFetch);
  });

  afterAll(() => vi.unstubAllGlobals());

  it('closes notification, navigates and focuses existing window', async () => {
    const mockClient = {
      url: 'http://localhost/app',
      focus: vi.fn().mockResolvedValue(undefined),
      navigate: vi.fn().mockResolvedValue(undefined),
    };
    mockSelf.clients.matchAll.mockResolvedValue([mockClient]);

    const event = makeNotificationClickEvent('http://localhost/fair-lawn-community-center-available/#status');
    mockSelf._listeners['notificationclick']?.(event);
    await event.waitUntil.mock.calls[0]?.[0];

    expect(event.notification.close).toHaveBeenCalled();
    expect(mockClient.navigate).toHaveBeenCalledWith('http://localhost/fair-lawn-community-center-available/#status');
    expect(mockClient.focus).toHaveBeenCalled();
  });
});

describe('notificationclick — no existing window', () => {
  const mockSelf = makeSelfWithPush();
  const mockCaches = makeCacheStorage();
  const mockFetch = vi.fn();

  beforeAll(async () => {
    await loadSW(mockSelf as unknown as ReturnType<typeof makeSelf>, mockCaches, mockFetch);
  });

  afterAll(() => vi.unstubAllGlobals());

  it('opens a new window when no existing window matches', async () => {
    mockSelf.clients.matchAll.mockResolvedValue([]);

    const event = makeNotificationClickEvent('/');
    mockSelf._listeners['notificationclick']?.(event);
    await event.waitUntil.mock.calls[0]?.[0];

    expect(event.notification.close).toHaveBeenCalled();
    expect(mockSelf.clients.openWindow).toHaveBeenCalledWith('/');
  });
});

describe('activate', () => {
  const mockSelf = makeSelf();
  const mockCaches = makeCacheStorage();
  const mockFetch = vi.fn();

  beforeAll(async () => {
    await mockCaches.open('old-cache-1');
    await mockCaches.open('old-cache-2');
    await mockCaches.open('shell-v2');
    await loadSW(mockSelf, mockCaches, mockFetch);
    await dispatchActivate(mockSelf._listeners);
  });

  afterAll(() => vi.unstubAllGlobals());

  it('deletes unknown caches', () => {
    expect(mockCaches._store.has('old-cache-1')).toBe(false);
    expect(mockCaches._store.has('old-cache-2')).toBe(false);
  });

  it('retains known caches', () => {
    expect(mockCaches._store.has('shell-v2')).toBe(true);
  });

  it('calls clients.claim()', () => {
    expect(mockSelf.clients.claim).toHaveBeenCalled();
  });
});
