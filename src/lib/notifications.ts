import type { NotifPrefs } from './types.js';

export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;
export const WORKER_URL = import.meta.env.VITE_WORKER_URL as string;

const ENDPOINT_KEY = 'flcc-push-endpoint';
const PREFS_KEY = 'flcc-notif-prefs';

export type SubscribeResult = true | false | 'denied' | 'unsupported';
export type NotifState = 'unsupported' | 'denied' | 'prompt' | 'subscribed';

/** Convert a base64url-encoded VAPID public key to a Uint8Array. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

/** Subscribe the user to push notifications with the given prefs. */
export async function subscribe(prefs: NotifPrefs): Promise<SubscribeResult> {
  if (!('PushManager' in window) || !('serviceWorker' in navigator)) {
    return 'unsupported';
  }

  const permission = await Notification.requestPermission();
  if (permission === 'denied') return 'denied';
  if (permission !== 'granted') return false;

  try {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    const subJson = subscription.toJSON();
    const endpoint = subJson.endpoint!;
    const keys = subJson.keys as { p256dh: string; auth: string };

    const res = await fetch(`${WORKER_URL}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, keys, prefs }),
    });
    if (!res.ok) {
      throw new Error(`Worker /subscribe returned ${res.status}`);
    }

    localStorage.setItem(ENDPOINT_KEY, endpoint);
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    return true;
  } catch (err) {
    console.error('Push subscribe failed:', err);
    return false;
  }
}

/** Unsubscribe from push notifications. */
export async function unsubscribe(): Promise<void> {
  // Always remove browser-side subscription first — even if server call fails,
  // the user should stop receiving notifications immediately.
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  } catch (err) {
    console.error('SW unsubscribe failed:', err);
  }

  const endpoint = localStorage.getItem(ENDPOINT_KEY);
  if (!endpoint) return;

  const res = await fetch(`${WORKER_URL}/unsubscribe`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  });
  if (!res.ok) {
    throw new Error(`Worker /unsubscribe returned ${res.status}`);
  }
  localStorage.removeItem(ENDPOINT_KEY);
  localStorage.removeItem(PREFS_KEY);
}

/** Update notification preferences without re-subscribing.
 * Throws if the network request fails so callers can surface the error. */
export async function updatePrefs(prefs: NotifPrefs): Promise<void> {
  const endpoint = localStorage.getItem(ENDPOINT_KEY);
  if (!endpoint) return;

  const res = await fetch(`${WORKER_URL}/subscription`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint, prefs }),
  });
  if (!res.ok) {
    throw new Error(`Worker /subscription PATCH returned ${res.status}`);
  }
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

/** Get the current notification subscription state. */
export async function getState(): Promise<NotifState> {
  if (!('PushManager' in window) || !('serviceWorker' in navigator)) {
    return 'unsupported';
  }

  if (Notification.permission === 'denied') return 'denied';

  try {
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('SW timeout')), 3000)),
    ]);
    const sub = await reg.pushManager.getSubscription();
    if (sub) return 'subscribed';
  } catch (err) {
    console.warn('[notifications] getState SW probe failed, defaulting to prompt:', err);
  }

  return 'prompt';
}

/** Get stored notification preferences from localStorage. */
export function getStoredPrefs(): NotifPrefs | null {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Spread ensures `sports` always present even if absent in stored JSON (legacy records)
    return { sports: [], ...parsed } as NotifPrefs;
  } catch (err) {
    console.error('[notifications] Failed to parse stored prefs, resetting:', err);
    localStorage.removeItem(PREFS_KEY);
    return null;
  }
}
