<script lang="ts">
  import type { ScheduleData } from './types.js';
  import type { FilterCategory } from './filters.js';
  import { getAvailableSports, getWeekSummary } from './filters.js';
  import { getEasternNow } from './time.js';
  import { activityEmoji } from './emoji.js';
  import { parseTime } from './time.js';

  let { data }: { data: ScheduleData } = $props();

  let isOpen = $state(false);
  let selectedSport = $state<FilterCategory | null>(null);

  const availableSports = $derived(getAvailableSports(data.schedule));

  const weekSummary = $derived.by(() => {
    if (!selectedSport) return [];
    return getWeekSummary(data.schedule, selectedSport);
  });

  // Time tracking for "NOW" badge — only active when detail is open + sport selected
  let now = $state(getEasternNow());

  $effect(() => {
    if (!isOpen || !selectedSport) return;
    now = getEasternNow();
    const interval = setInterval(() => { now = getEasternNow(); }, 60_000);
    return () => clearInterval(interval);
  });

  const todayName = $derived(
    ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()]
  );

  function isPast(act: { end: string }, day: string): boolean {
    if (day !== todayName) return false;
    return parseTime(act.end, now) <= now;
  }

  function isCurrent(act: { start: string; end: string }, day: string): boolean {
    if (day !== todayName) return false;
    return parseTime(act.start, now) <= now && now < parseTime(act.end, now);
  }

  function clearSport() {
    selectedSport = null;
  }

  // Short day names for display
  const SHORT_DAYS: Record<string, string> = {
    Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed',
    Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
  };
</script>

{#if availableSports.length > 0}
  <details class="sport-week-card" bind:open={isOpen}>
    <summary class="sport-week-summary">
      <span class="summary-label">When can I play...?</span>
      <svg
        class="chevron"
        class:chevron-open={isOpen}
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
      >
        <path d="M6 8l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </summary>

    {#if isOpen}
      <div class="sport-week-content">
        {#if selectedSport}
          {@const sportEmoji = activityEmoji(selectedSport.label)}
          <div class="sport-result-header">
            <button class="back-btn" onclick={clearSport} aria-label="Back to sport selection">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M10 12L6 8l4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <span class="sport-result-title">
              {#if sportEmoji}<span class="activity-emoji" aria-hidden="true">{sportEmoji}</span> {/if}{selectedSport.label}
            </span>
          </div>

          {#if weekSummary.length === 0}
            <p class="no-results">No {selectedSport.label} scheduled this week</p>
          {:else}
            <div class="week-results">
              {#each weekSummary as entry}
                {#each entry.activities as act, i}
                  <div
                    class="result-row"
                    class:is-today={entry.day === todayName}
                    class:is-past={isPast(act, entry.day)}
                    class:is-current={isCurrent(act, entry.day)}
                  >
                    <span class="result-day">{#if i === 0}{SHORT_DAYS[entry.day]}{/if}</span>
                    <span class="result-time">{act.start} &ndash; {act.end}</span>
                    <span class="result-name">
                      {act.name}
                      {#if isCurrent(act, entry.day)}
                        <span class="now-badge">NOW</span>
                      {/if}
                    </span>
                  </div>
                {/each}
              {/each}
            </div>
          {/if}
        {:else}
          <div class="sport-chips" role="group" aria-label="Select sport">
            {#each availableSports as sport}
              {@const emoji = activityEmoji(sport.label)}
              <button
                class="sport-chip"
                aria-pressed="false"
                onclick={() => { selectedSport = sport; }}
              >
                {#if emoji}<span class="activity-emoji" aria-hidden="true">{emoji}</span> {/if}{sport.label}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </details>
{/if}

<style>
  .sport-week-card {
    margin-bottom: 16px;
  }

  .sport-week-summary {
    cursor: pointer;
    font-weight: 600;
    font-size: 1rem;
    padding: 14px 16px;
    color: var(--color-text);
    min-height: 48px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    list-style: none;
  }

  .sport-week-summary::-webkit-details-marker {
    display: none;
  }

  .sport-week-summary::marker {
    content: '';
  }

  .sport-week-summary:active {
    opacity: 0.8;
  }

  @media (hover: hover) {
    .sport-week-summary:hover {
      background: var(--color-border);
    }
  }

  .summary-label {
    pointer-events: none;
  }

  .chevron {
    flex-shrink: 0;
    transition: transform 0.25s ease;
    color: var(--color-text-secondary);
  }

  .chevron-open {
    transform: rotate(180deg);
  }

  .sport-week-content {
    padding-top: 12px;
    animation: slideDown 0.25s ease;
  }

  @keyframes slideDown {
    from { opacity: 0; max-height: 0; }
    to { opacity: 1; max-height: 1000px; }
  }

  .sport-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 4px 0;
  }

  .sport-chip {
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 0.9rem;
    font-weight: 500;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text);
    cursor: pointer;
    min-height: 44px;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.15s, border-color 0.15s;
  }

  @media (hover: hover) {
    .sport-chip:hover {
      background: var(--color-border);
    }
  }

  .sport-chip:active {
    opacity: 0.8;
  }

  .activity-emoji {
    font-size: 1.1em;
    margin-right: 2px;
  }

  .sport-result-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  .back-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text);
    cursor: pointer;
    flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
  }

  @media (hover: hover) {
    .back-btn:hover {
      background: var(--color-border);
    }
  }

  .sport-result-title {
    font-weight: 600;
    font-size: 1rem;
  }

  .no-results {
    color: var(--color-text-secondary);
    font-size: 0.9rem;
    text-align: center;
    padding: 12px;
  }

  .week-results {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .result-row {
    display: grid;
    grid-template-columns: 40px 1fr 1fr;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 6px;
    font-size: 0.9rem;
    align-items: center;
  }

  .result-row.is-today {
    background: var(--color-available-bg);
  }

  .result-row.is-past {
    opacity: 0.5;
  }

  .result-row.is-current {
    border-left: 3px solid var(--color-available);
  }

  .result-day {
    font-weight: 700;
    font-size: 0.85rem;
  }

  .result-time {
    color: var(--color-text-secondary);
    font-size: 0.85rem;
    white-space: nowrap;
  }

  .result-name {
    font-weight: 500;
    overflow-wrap: break-word;
  }

  .now-badge {
    display: inline-block;
    font-size: 0.7rem;
    font-weight: 700;
    background: var(--color-available);
    color: white;
    padding: 1px 5px;
    border-radius: 4px;
    margin-left: 4px;
    vertical-align: middle;
  }

  @media (max-width: 640px) {
    .result-row {
      grid-template-columns: 40px 1fr;
    }

    .result-name {
      grid-column: 1 / -1;
      padding-left: 48px;
      margin-top: -2px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sport-week-content {
      animation: none;
    }
    .chevron {
      transition: none;
    }
    .sport-chip {
      transition: none;
    }
  }
</style>
