import * as notifications from './notifications.js';
import type { NotifPrefs } from './types.js';
import type { NotifState } from './notifications.js';

// Module-level $state object — all importers share the same reactive instance.
// Mutate properties (not reassign the variable). Arrays must be replaced by reference.
export const notifStore = $state({
  state: 'prompt' as NotifState,   // default 'prompt' until initNotifStore resolves
  prefs: { thirtyMin: true, dailyBriefing: true, sports: [], cancelAlerts: false } as NotifPrefs,
  loading: false,
  isIos: false,
  isStandalone: false,
  initialized: false,
  error: null as string | null,    // transient error message; null = no error
});

/** Call once from App.svelte onMount. Idempotent — no-op if already initialized. */
export async function initNotifStore(): Promise<void> {
  if (notifStore.initialized) return;
  notifStore.isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  notifStore.isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  notifStore.state = await notifications.getState();
  const stored = notifications.getStoredPrefs();
  if (stored) notifStore.prefs = stored;
  notifStore.initialized = true;
}

/**
 * Subscribe the user to push notifications.
 * SAFARI CONSTRAINT: Must not await anything before notifications.subscribe() —
 * Safari requires Notification.requestPermission() to run in the synchronous
 * microtask chain of the user gesture. notifStore.loading = true is synchronous, safe.
 */
export async function handleEnable(): Promise<void> {
  notifStore.loading = true;
  notifStore.error = null;
  const result = await notifications.subscribe(notifStore.prefs);
  notifStore.loading = false;
  if (result === true) {
    notifStore.state = 'subscribed';
    const stored = notifications.getStoredPrefs();
    if (stored) notifStore.prefs = stored;
  } else if (result === 'denied') {
    notifStore.state = 'denied';
  } else if (result !== 'unsupported') {
    // result === false: SW subscribe failed (network error etc.)
    notifStore.error = 'Failed to enable — please try again';
  }
}

/** Unsubscribe fully — removes from server (DELETE) and clears localStorage. */
export async function handleDisable(): Promise<void> {
  notifStore.loading = true;
  notifStore.error = null;
  try {
    await notifications.unsubscribe();
    notifStore.state = 'prompt';
    notifStore.prefs = { thirtyMin: true, dailyBriefing: true, sports: [], cancelAlerts: false };
  } catch {
    notifStore.error = 'Failed to unsubscribe — please try again.';
  } finally {
    notifStore.loading = false;
  }
}

/** Update a preference (thirtyMin or dailyBriefing). Optimistic update. */
export async function savePrefs(prefs: NotifPrefs): Promise<void> {
  notifStore.error = null;
  const previous = notifStore.prefs;
  notifStore.prefs = prefs;  // optimistic
  try {
    await notifications.updatePrefs(prefs);
  } catch {
    notifStore.prefs = previous;  // rollback
    notifStore.error = 'Failed to save preference. Check your connection.';
  }
}

/**
 * Toggle a sport notification.
 * Sport-first subscribe uses { thirtyMin: false, dailyBriefing: false } to
 * preserve user intent — same behavior as existing toggleSportNotif() in SportWeekCard.
 * Always reads fresh prefs from localStorage before mutating (avoids stale snapshot).
 */
export async function toggleSport(sportId: string): Promise<void> {
  notifStore.loading = true;
  notifStore.error = null;
  if (notifStore.state !== 'subscribed') {
    const result = await notifications.subscribe({
      thirtyMin: false, dailyBriefing: false, sports: [sportId],
    });
    if (result === true) {
      notifStore.state = 'subscribed';
      const stored = notifications.getStoredPrefs();
      if (stored) notifStore.prefs = stored;
    } else if (result === 'denied') {
      notifStore.state = 'denied';
    } else if (result !== 'unsupported') {
      notifStore.error = 'Failed to subscribe — please try again';
    }
  } else {
    const current = notifications.getStoredPrefs() ?? { thirtyMin: false, dailyBriefing: false, sports: [] };
    const currentSports = current.sports ?? [];
    const next = currentSports.includes(sportId)
      ? currentSports.filter(id => id !== sportId)
      : [...currentSports, sportId];
    const updated = { ...current, sports: next };
    const previous = notifStore.prefs;
    notifStore.prefs = updated;    // optimistic
    try {
      await notifications.updatePrefs(updated);
    } catch {
      notifStore.prefs = previous;  // rollback
      notifStore.error = 'Failed to save preference. Check your connection.';
    }
  }
  notifStore.loading = false;
}

/** Returns true if the given sport's alert is currently enabled. */
export function isSportAlertOn(sportId: string): boolean {
  if (!notifStore.initialized || notifStore.state !== 'subscribed') return false;
  if (sportId === 'open-gym') return notifStore.prefs.thirtyMin;
  return (notifStore.prefs.sports ?? []).includes(sportId);
}
