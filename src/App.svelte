<script lang="ts">
  import type { ScheduleData, GymState, Notice } from './lib/types.js';
  import type { MessageData } from './lib/motivational.js';
  import { computeGymState, getEasternNow } from './lib/time.js';
  import StatusCard from './lib/StatusCard.svelte';
  import Timeline from './lib/Timeline.svelte';
  import UpNext from './lib/UpNext.svelte';
  import WeeklySchedule from './lib/WeeklySchedule.svelte';

  let data: ScheduleData | null = $state(null);
  let error: string | null = $state(null);
  let gymState: GymState | null = $state(null);
  let messages: MessageData | null = $state(null);
  let isOffline = $state(!navigator.onLine);
  let lastFetchedAt = Date.now();

  async function loadSchedule(): Promise<void> {
    const r = await fetch('./data/latest.json');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d: ScheduleData = await r.json();
    data = d;
    gymState = computeGymState(d);
    lastFetchedAt = Date.now();
  }

  async function loadMessages(): Promise<void> {
    const r = await fetch('./data/messages.json');
    if (r.ok) messages = await r.json();
  }

  // Initial load
  $effect(() => {
    loadSchedule().catch((e) => { error = e.message; });
    loadMessages().catch(() => {});
  });

  // Re-compute gym state every 10 seconds
  $effect(() => {
    if (!data) return;
    const interval = setInterval(() => {
      gymState = computeGymState(data!);
    }, 10000);
    return () => clearInterval(interval);
  });

  // Track online/offline state
  $effect(() => {
    const goOffline = () => { isOffline = true; };
    const goOnline = () => { isOffline = false; };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  });

  // Refresh data when tab returns after 5+ minutes
  $effect(() => {
    function onVisibilityChange() {
      if (document.visibilityState !== 'visible') return;
      navigator.serviceWorker?.getRegistration().then(r => r?.update());
      if (Date.now() - lastFetchedAt < 5 * 60 * 1000) return;
      loadSchedule().catch(() => {});
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  });

  const isStale = $derived.by(() => {
    if (!data) return false;
    const scraped = new Date(data.scrapedAt).getTime();
    const now = Date.now();
    return now - scraped > 48 * 60 * 60 * 1000;
  });

  // Only show notices for today or future dates
  const activeNotices = $derived.by((): Notice[] => {
    if (!data) return [];
    const today = getEasternNow().toISOString().split('T')[0];
    return data.notices.filter(n => n.date >= today);
  });
</script>

<main>
  <a href="#main-content" class="skip-link">Skip to content</a>
  <h1 class="title">Fair Lawn Community Center</h1>

  {#if error}
    <div class="error-banner" role="alert">
      Unable to load schedule data. Please try again later.
    </div>
  {:else if !data || !gymState}
    <div class="loading" aria-label="Loading schedule">
      <div class="spinner"></div>
    </div>
  {:else}
    <div id="main-content"></div>
    {#if isOffline}
      <div class="offline-banner" role="status">
        You're offline — showing cached schedule.
      </div>
    {/if}

    {#if isStale}
      <div class="stale-banner" role="alert">
        Schedule data may be outdated. Last updated: {new Date(data.scrapedAt).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' })}
      </div>
    {/if}

    {#if activeNotices.length > 0}
      <div class="notices" role="alert">
        {#each activeNotices as notice}
          <p>{notice.text}</p>
        {/each}
      </div>
    {/if}

    <StatusCard {gymState} {messages} />

    {#if gymState.todaySchedule}
      <Timeline schedule={gymState.todaySchedule} dayName={gymState.dayName} />
      <UpNext schedule={gymState.todaySchedule} />
    {/if}

    <WeeklySchedule {data} />

    <footer class="footer">
      <p class="footer-source">
        <span>Updated {new Date(data.scrapedAt).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' })}</span>
        <span class="footer-sep" aria-hidden="true">&middot;</span>
        <span>Source: <a href="https://www.fairlawn.org/park-rec" target="_blank" rel="noopener">fairlawn.org</a></span>
      </p>
      <p class="footer-notice">
        Fair Lawn residents only. Schedule may change without notice.
      </p>
      <p class="footer-meta">
        This is an unofficial community project, not affiliated with the
        <a href="https://www.fairlawn.org/community-center" target="_blank" rel="noopener">Borough of Fair Lawn</a>.
      </p>
      <p class="footer-meta">
        <a href="https://github.com/paragbaxi/fair-lawn-community-center-available/issues" target="_blank" rel="noopener">Feedback &amp; suggestions</a> welcome.
      </p>
    </footer>
  {/if}
</main>

<style>
  .skip-link {
    position: absolute;
    left: -9999px;
    top: auto;
    width: 1px;
    height: 1px;
    overflow: hidden;
    z-index: 100;
    padding: 8px 16px;
    background: var(--color-bg);
    color: var(--color-text);
    border: 2px solid var(--color-text);
    border-radius: var(--radius);
    font-size: 0.9rem;
    font-weight: 600;
    text-decoration: none;
  }

  .skip-link:focus {
    position: fixed;
    top: 8px;
    left: 8px;
    width: auto;
    height: auto;
  }

  main {
    padding: 8px 0 32px;
  }

  .title {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 20px;
    text-align: center;
  }

  .error-banner {
    background: var(--color-closed-bg);
    border: 1px solid var(--color-closed-border);
    color: var(--color-closed);
    padding: 12px 16px;
    border-radius: var(--radius);
    margin-bottom: 16px;
    text-align: center;
  }

  .offline-banner {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    color: var(--color-text-secondary);
    padding: 10px 16px;
    border-radius: var(--radius);
    margin-bottom: 16px;
    font-size: 0.85rem;
    text-align: center;
  }

  .stale-banner {
    background: var(--color-inuse-bg);
    border: 1px solid var(--color-inuse-border);
    color: var(--color-inuse);
    padding: 10px 16px;
    border-radius: var(--radius);
    margin-bottom: 16px;
    font-size: 0.85rem;
    text-align: center;
  }

  .notices {
    background: var(--color-inuse-bg);
    border: 1px solid var(--color-inuse-border);
    padding: 10px 16px;
    border-radius: var(--radius);
    margin-bottom: 16px;
    font-size: 0.85rem;
  }

  .loading {
    display: flex;
    justify-content: center;
    padding: 48px 0;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-text);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    text-align: center;
    color: var(--color-text-secondary);
    font-size: 0.8rem;
    padding-top: 16px;
    border-top: 1px solid var(--color-border);
  }

  .footer a {
    color: var(--color-text-secondary);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .footer-source {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .footer-notice,
  .footer-meta {
    font-size: 0.75rem;
  }

  .footer-notice {
    display: inline-block;
    max-width: 100%;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    padding: 2px 10px;
    border-radius: 8px;
  }

  .footer-meta + .footer-meta {
    margin-top: -6px;
  }

  @media (hover: hover) {
    .footer a:hover {
      color: var(--color-text);
    }
  }

  @media (max-width: 640px) {
    .footer-source {
      flex-direction: column;
      gap: 2px;
    }
    .footer-sep {
      display: none;
    }
  }
</style>
