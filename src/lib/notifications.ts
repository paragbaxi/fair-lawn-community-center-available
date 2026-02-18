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

    await fetch(`${WORKER_URL}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, keys, prefs }),
    });

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
  const endpoint = localStorage.getItem(ENDPOINT_KEY);
  if (endpoint) {
    try {
      await fetch(`${WORKER_URL}/unsubscribe`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      });
    } catch (err) {
      console.error('Push unsubscribe failed:', err);
    }
    localStorage.removeItem(ENDPOINT_KEY);
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  } catch (err) {
    console.error('SW unsubscribe failed:', err);
  }

  localStorage.removeItem(PREFS_KEY);
}

/** Update notification preferences without re-subscribing. */
export async function updatePrefs(prefs: NotifPrefs): Promise<void> {
  const endpoint = localStorage.getItem(ENDPOINT_KEY);
  if (!endpoint) return;

  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));

  try {
    await fetch(`${WORKER_URL}/subscription`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, prefs }),
    });
  } catch (err) {
    console.error('Failed to update prefs on server:', err);
  }
}

/** Get the current notification subscription state. */
export async function getState(): Promise<NotifState> {
  if (!('PushManager' in window) || !('serviceWorker' in navigator)) {
    return 'unsupported';
  }

  if (Notification.permission === 'denied') return 'denied';

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) return 'subscribed';
  } catch {
    // ignore
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
  } catch {
    return null;
  }
}
