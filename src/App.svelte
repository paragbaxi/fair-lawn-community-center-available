<script lang="ts">
  import type { ScheduleData, GymState, DaySchedule, Notice } from './lib/types.js';
  import { computeGymState, getEasternNow, getEasternDayName, DISPLAY_DAYS } from './lib/time.js';
  import TabBar from './lib/TabBar.svelte';
  import StatusView from './lib/StatusView.svelte';
  import TodayView from './lib/TodayView.svelte';
  import SportsView from './lib/SportsView.svelte';
  import ScheduleView from './lib/ScheduleView.svelte';

  // --- Tab routing ---
  type TabId = 'status' | 'today' | 'sports' | 'schedule';
  const VALID_TABS: TabId[] = ['status', 'today', 'sports', 'schedule'];

  function getTabFromHash(): TabId {
    const hash = location.hash.slice(1).toLowerCase();
    return VALID_TABS.includes(hash as TabId) ? (hash as TabId) : 'status';
  }

  let activeTab: TabId = $state(getTabFromHash());

  function setTab(tab: TabId) {
    activeTab = tab;
    history.replaceState(null, '', `#${tab}`);
    window.scrollTo(0, 0);
    document.getElementById(`panel-${tab}`)?.focus();
  }

  $effect(() => {
    const onHashChange = () => {
      const hash = location.hash.slice(1).toLowerCase();
      if (VALID_TABS.includes(hash as TabId)) {
        activeTab = hash as TabId;
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  });

  // --- Data state ---
  let data: ScheduleData | null = $state(null);
  let error: string | null = $state(null);
  let gymState: GymState | null = $state(null);
  let isOffline = $state(!navigator.onLine);
  let lastFetchedAt = Date.now();

  // Day picker state
  let selectedDay = $state(getEasternDayName());

  async function loadSchedule(): Promise<void> {
    const r = await fetch('./data/latest.json');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d: ScheduleData = await r.json();
    data = d;
    gymState = computeGymState(d);
    lastFetchedAt = Date.now();
  }

  // Initial load
  $effect(() => {
    loadSchedule().catch((e) => { error = e.message; });
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

  // Derived: is the selected day today?
  const isSelectedToday = $derived(selectedDay === gymState?.dayName);

  // Derived: the schedule for the selected day
  const selectedSchedule = $derived.by((): DaySchedule | null => {
    if (!data) return null;
    return data.schedule[selectedDay] ?? null;
  });

  // Auto-advance selectedDay when midnight rolls over (if user was viewing today)
  let previousToday = $state(getEasternDayName());

  $effect(() => {
    if (!gymState) return;
    const newToday = gymState.dayName;
    if (newToday !== previousToday) {
      if (selectedDay === previousToday) {
        selectedDay = newToday;
      }
      previousToday = newToday;
    }
  });

  // Validate selectedDay exists in schedule after data loads
  $effect(() => {
    if (!data) return;
    if (!data.schedule[selectedDay]) {
      const next = DISPLAY_DAYS.find(d => data!.schedule[d.full]);
      if (next) selectedDay = next.full;
    }
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

    <!-- Tab panels using hidden attribute to preserve state -->
    <div role="tabpanel" id="panel-status" aria-labelledby="tab-status" tabindex="-1" hidden={activeTab !== 'status'}>
      <StatusView {gymState} {data} />
    </div>

    <div role="tabpanel" id="panel-today" aria-labelledby="tab-today" tabindex="-1" hidden={activeTab !== 'today'}>
      <TodayView
        {data}
        {gymState}
        {selectedDay}
        {selectedSchedule}
        {isSelectedToday}
        onSelectDay={(day) => { selectedDay = day; }}
        onTabSwitch={(tab) => setTab(tab)}
      />
    </div>

    <div role="tabpanel" id="panel-sports" aria-labelledby="tab-sports" tabindex="-1" hidden={activeTab !== 'sports'}>
      <SportsView {data} />
    </div>

    <div role="tabpanel" id="panel-schedule" aria-labelledby="tab-schedule" tabindex="-1" hidden={activeTab !== 'schedule'}>
      <ScheduleView {data} today={gymState.dayName} scrapedAt={data.scrapedAt} />
    </div>

    <TabBar {activeTab} onSelectTab={setTab} />
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
    font-size: 0.95rem;
    text-align: center;
  }

  .stale-banner {
    background: var(--color-inuse-bg);
    border: 1px solid var(--color-inuse-border);
    color: var(--color-inuse);
    padding: 10px 16px;
    border-radius: var(--radius);
    margin-bottom: 16px;
    font-size: 0.95rem;
    text-align: center;
  }

  .notices {
    background: var(--color-inuse-bg);
    border: 1px solid var(--color-inuse-border);
    padding: 10px 16px;
    border-radius: var(--radius);
    margin-bottom: 16px;
    font-size: 0.95rem;
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
</style>
