<script lang="ts">
  import type { ScheduleData, GymState, DaySchedule, Notice, TabId } from './lib/types.js';
  import { computeGymState, getEasternNow, getEasternDayName, DISPLAY_DAYS, formatEasternDate } from './lib/time.js';
  import type { FilterCategory } from './lib/filters.js';
  import { SPORT_CATEGORIES, getAvailableSports } from './lib/filters.js';
  import { parseUrlState, buildUrlHash } from './lib/url.js';
  import { onMount, tick } from 'svelte';
  import TabBar from './lib/TabBar.svelte';
  import StatusView from './lib/StatusView.svelte';
  import TodayView from './lib/TodayView.svelte';
  import SportsView from './lib/SportsView.svelte';
  import NotifSheet from './lib/NotifSheet.svelte';
  import { initNotifStore, notifStore } from './lib/notifStore.svelte.js';

  // --- Notification sheet ---
  let sheetOpen = $state(false);
  let bellPulsing = $state(false);
  let bellTriggerEl: HTMLButtonElement | null = $state(null);

  function openMyAlerts() {
    sheetOpen = true;
    sessionStorage.setItem('flcc-bell-seen', '1');
    bellPulsing = false;
  }
  function closeMyAlerts() {
    sheetOpen = false;
    bellTriggerEl?.focus();
  }

  onMount(async () => {
    await initNotifStore();
    if (!sessionStorage.getItem('flcc-bell-seen')) {
      bellPulsing = true;
    }
  });

  // --- Tab routing ---
  // Parse URL once synchronously before any $state declarations
  const _initialUrl = parseUrlState();

  let activeTab: TabId = $state(_initialUrl.tab);
  let selectedDay = $state(_initialUrl.day ?? getEasternDayName());
  let selectedSport = $state<FilterCategory | null>(
    _initialUrl.sport ? (SPORT_CATEGORIES.find(c => c.id === _initialUrl.sport) ?? null) : null
  );
  async function setTab(tab: TabId, focusPanel = true) {
    activeTab = tab;
    window.scrollTo(0, 0);
    if (focusPanel) {
      await tick();
      document.getElementById(`panel-${tab}`)?.focus();
    }
  }

  $effect(() => {
    const onHashChange = () => {
      const { tab, day, sport } = parseUrlState();
      activeTab = tab;
      if (day) selectedDay = day;
      const newSport = sport ? (SPORT_CATEGORIES.find(c => c.id === sport) ?? null) : null;
      if (tab === 'sports') selectedSport = newSport; // only update sport when on sports tab
      // day persists across tab switches by design
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

  let staleClock = $state(Date.now());

  $effect(() => {
    const interval = setInterval(() => { staleClock = Date.now(); }, 60 * 60 * 1000);
    return () => clearInterval(interval);
  });

  const isStale = $derived.by(() => {
    if (!data) return false;
    const scraped = new Date(data.scrapedAt).getTime();
    return staleClock - scraped > 48 * 60 * 60 * 1000;
  });

  // Only show notices for today or future dates
  const activeNotices = $derived.by((): Notice[] => {
    if (!data) return [];
    const now = getEasternNow();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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

  // Stale-sport guard: reset selectedSport if it's no longer in the schedule
  $effect(() => {
    if (!data || !selectedSport) return;
    const available = getAvailableSports(data.schedule);
    if (!available.some(c => c.id === selectedSport!.id)) selectedSport = null;
  });

  // URL sync — declared after validation effects so state is already corrected
  $effect(() => {
    if (!data) return; // wait for data so validation effects have run first
    history.replaceState(null, '', buildUrlHash(activeTab, selectedDay, selectedSport?.id ?? null));
  });
</script>

<main>
  <a href="#main-content" class="skip-link">Skip to content</a>
  <header class="app-header">
    <h1 class="title">Fair Lawn Community Center</h1>
    {#if data && gymState && notifStore.initialized && notifStore.state !== 'unsupported'}
      <button
        class="bell-btn"
        bind:this={bellTriggerEl}
        onclick={openMyAlerts}
        aria-label="Notification settings"
        aria-expanded={sheetOpen}
      >
        {#if notifStore.state === 'subscribed'}
          🔔<span class="bell-badge" aria-hidden="true"></span>
        {:else}
          🔔
        {/if}
        {#if bellPulsing}
          <span class="bell-badge-new" aria-hidden="true"></span>
        {/if}
      </button>
    {/if}
  </header>

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
        Schedule data may be outdated. Last updated: {formatEasternDate(data.scrapedAt)}
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
      <StatusView {gymState} {data} onManageAlerts={openMyAlerts} />
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
      <SportsView {data} {selectedSport} onSelectSport={(s) => { selectedSport = s; }} onManageAlerts={openMyAlerts} />
    </div>

    <TabBar {activeTab} onSelectTab={setTab} />
    <NotifSheet open={sheetOpen} {gymState} {data} onClose={closeMyAlerts} />
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

  .app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }

  .title {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 0;
    text-align: center;
  }

  .bell-btn {
    position: relative;
    width: 44px;
    height: 44px;
    border: none;
    background: none;
    font-size: 1.4rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
  }

  @media (hover: hover) {
    .bell-btn:hover {
      background: var(--color-border);
    }
  }

  .bell-badge {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 8px;
    height: 8px;
    background: #48bb78;
    border-radius: 50%;
    border: 2px solid var(--color-bg);
  }

  .bell-badge-new {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 8px;
    height: 8px;
    background: #3182ce;
    border-radius: 50%;
    border: 2px solid var(--color-bg);
    animation: bell-pulse 1.5s ease-in-out infinite;
  }

  @keyframes bell-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.6); opacity: 0.5; }
  }

  @media (prefers-reduced-motion: reduce) {
    .bell-badge-new {
      animation: none;
    }
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
