<script lang="ts">
  import type { ScheduleData, GymState } from './lib/types.js';
  import { computeGymState } from './lib/time.js';
  import StatusCard from './lib/StatusCard.svelte';
  import Timeline from './lib/Timeline.svelte';
  import UpNext from './lib/UpNext.svelte';
  import WeeklySchedule from './lib/WeeklySchedule.svelte';

  let data: ScheduleData | null = $state(null);
  let error: string | null = $state(null);
  let gymState: GymState | null = $state(null);

  $effect(() => {
    fetch('./data/latest.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: ScheduleData) => {
        data = d;
        gymState = computeGymState(d);
      })
      .catch((e) => {
        error = e.message;
      });
  });

  // Re-compute gym state every 10 seconds
  $effect(() => {
    if (!data) return;
    const interval = setInterval(() => {
      gymState = computeGymState(data!);
    }, 10000);
    return () => clearInterval(interval);
  });

  const isStale = $derived.by(() => {
    if (!data) return false;
    const scraped = new Date(data.scrapedAt).getTime();
    const now = Date.now();
    return now - scraped > 48 * 60 * 60 * 1000;
  });
</script>

<main>
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
    {#if isStale}
      <div class="stale-banner" role="alert">
        Schedule data may be outdated. Last updated: {new Date(data.scrapedAt).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' })}
      </div>
    {/if}

    {#if data.notices.length > 0}
      <div class="notices" role="alert">
        {#each data.notices as notice}
          <p>{notice}</p>
        {/each}
      </div>
    {/if}

    <StatusCard {gymState} />

    {#if gymState.todaySchedule}
      <Timeline schedule={gymState.todaySchedule} dayName={gymState.dayName} />
      <UpNext schedule={gymState.todaySchedule} />
    {/if}

    <WeeklySchedule {data} />

    <footer class="footer">
      <p>
        Updated {new Date(data.scrapedAt).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' })}
        &middot;
        Source: <a href="https://www.fairlawn.org/park-rec" target="_blank" rel="noopener">fairlawn.org</a>
      </p>
      <p class="disclaimer">
        Fair Lawn residents only. Schedule may change without notice.
      </p>
    </footer>
  {/if}
</main>

<style>
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
    text-align: center;
    color: var(--color-text-secondary);
    font-size: 0.8rem;
    padding-top: 8px;
    border-top: 1px solid var(--color-border);
  }

  .footer a {
    color: var(--color-text-secondary);
    text-decoration: underline;
  }

  .disclaimer {
    margin-top: 4px;
    font-size: 0.75rem;
    opacity: 0.7;
  }
</style>
