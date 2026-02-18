<script lang="ts">
  import type { ScheduleData, SportStatus } from './types.js';
  import type { FilterCategory } from './filters.js';
  import { getAvailableSports, getWeekSummary } from './filters.js';
  import { isActivityPast, isActivityCurrent, shortDayName, computeSportStatus, DISPLAY_DAYS } from './time.js';
  import { activityEmoji } from './emoji.js';
  import { clock } from './clock.svelte.js';

  let {
    data,
    expanded = false,
    selectedSport = null,
    onSelectSport = () => {},
  }: {
    data: ScheduleData;
    expanded?: boolean;
    selectedSport?: FilterCategory | null;
    onSelectSport?: (sport: FilterCategory | null) => void;
  } = $props();

  let isOpen = $state(false);

  const availableSports = $derived(getAvailableSports(data.schedule));

  const weekSummary = $derived.by(() => {
    if (!selectedSport) return [];
    return getWeekSummary(data.schedule, selectedSport);
  });

  // Date range for subheading (uses reactive `clock.now`)
  const dateRange = $derived.by(() => {
    const dayOfWeek = clock.now.getDay(); // 0=Sun
    const monday = new Date(clock.now);
    monday.setDate(clock.now.getDate() - ((dayOfWeek + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(monday)} – ${fmt(sunday)}`;
  });

  $effect(() => {
    if (!expanded && !isOpen) { if (selectedSport) onSelectSport(null); }
  });

  const todayName = $derived(
    ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][clock.now.getDay()]
  );

  const sportStatus = $derived.by((): SportStatus | null => {
    if (!selectedSport) return null;
    return computeSportStatus(data.schedule, selectedSport.match, clock.now, todayName);
  });
</script>

{#if availableSports.length > 0}
  {#if expanded}
    <!-- Expanded mode: no <details>, persistent chips -->
    <div class="sport-week-expanded">
      <h2 class="section-heading">When can I play...?</h2>
      <p class="date-range">{dateRange}</p>

      <div class="sport-chips" role="group" aria-label="Select sport">
        {#each availableSports as sport}
          {@const emoji = activityEmoji(sport.label)}
          <button
            class="sport-chip"
            class:sport-chip-active={selectedSport?.id === sport.id}
            aria-pressed={selectedSport?.id === sport.id}
            onclick={() => { onSelectSport(selectedSport?.id === sport.id ? null : sport); }}
          >
            {#if emoji}<span class="activity-emoji" aria-hidden="true">{emoji}</span> {/if}{sport.label}
          </button>
        {/each}
      </div>

      {#if sportStatus && sportStatus.kind !== 'none'}
        <div
          class="sport-status-banner"
          class:status-active={sportStatus.kind === 'active'}
          class:status-upcoming={sportStatus.kind !== 'active'}
          role="status"
          aria-live="polite"
        >
          <span class="sport-status-dot" aria-hidden="true"></span>
          {#if sportStatus.kind === 'active'}
            <span class="sport-status-text">
              <strong>{selectedSport?.label}</strong> is on now &mdash; ends at {sportStatus.time}
            </span>
          {:else if sportStatus.kind === 'upcoming-today'}
            <span class="sport-status-text">
              Next <strong>{selectedSport?.label}</strong> at {sportStatus.time} today
            </span>
          {:else}
            <span class="sport-status-text">
              Next <strong>{selectedSport?.label}</strong>: {shortDayName(sportStatus.day)} at {sportStatus.time}
            </span>
          {/if}
        </div>
      {/if}

      {#if selectedSport}
        {#if weekSummary.length === 0}
          <p class="no-results">No {selectedSport.label} scheduled this week</p>
        {:else}
          <div class="week-results">
            {#each weekSummary as entry}
              {#each entry.activities as act, i}
                <div
                  class="result-row"
                  class:is-today={entry.day === todayName}
                  class:is-past={isActivityPast(act.end, clock.now, entry.day === todayName)}
                  class:is-current={isActivityCurrent(act.start, act.end, clock.now, entry.day === todayName)}
                >
                  <span class="result-day">{#if i === 0}{shortDayName(entry.day)}{/if}</span>
                  <span class="result-time">{act.start} &ndash; {act.end}</span>
                  <span class="result-name">
                    {act.name}
                    {#if isActivityCurrent(act.start, act.end, clock.now, entry.day === todayName)}
                      <span class="now-badge">NOW</span>
                    {/if}
                  </span>
                </div>
              {/each}
            {/each}
          </div>
        {/if}
      {:else}
        <p class="hint-text">Tap a sport to see this week's times</p>
      {/if}
    </div>
  {:else}
    <!-- Collapsed mode: original <details> behavior -->
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
              <button class="back-btn" onclick={() => { onSelectSport(null); }} aria-label="Back to sport selection">
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
                      class:is-past={isActivityPast(act.end, clock.now, entry.day === todayName)}
                      class:is-current={isActivityCurrent(act.start, act.end, clock.now, entry.day === todayName)}
                    >
                      <span class="result-day">{#if i === 0}{shortDayName(entry.day)}{/if}</span>
                      <span class="result-time">{act.start} &ndash; {act.end}</span>
                      <span class="result-name">
                        {act.name}
                        {#if isActivityCurrent(act.start, act.end, clock.now, entry.day === todayName)}
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
                  aria-pressed={selectedSport?.id === sport.id}
                  onclick={() => { onSelectSport(selectedSport?.id === sport.id ? null : sport); }}
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
{/if}

<style>
  .sport-week-expanded {
    margin-bottom: 16px;
  }

  .section-heading {
    font-size: 1.1rem;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .date-range {
    font-size: 0.85rem;
    color: var(--color-text-secondary);
    margin-bottom: 12px;
  }

  .hint-text {
    font-size: 0.9rem;
    color: var(--color-text-secondary);
    text-align: center;
    padding: 16px;
  }

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
    margin-bottom: 12px;
  }

  @media (max-width: 374px) {
    .sport-chips {
      flex-wrap: nowrap;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      padding-bottom: 8px;
    }
    .sport-chips::-webkit-scrollbar {
      display: none;
    }
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

  .sport-chip-active {
    background: var(--color-text);
    border-color: var(--color-text);
    color: var(--color-bg);
  }

  @media (hover: hover) {
    .sport-chip:not(.sport-chip-active):hover {
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

  .sport-status-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 0.875rem;
    margin-bottom: 12px;
  }

  .sport-status-banner.status-active {
    background: var(--color-available-bg);
    color: var(--color-available);
    border: 1px solid var(--color-available-border);
  }

  .sport-status-banner.status-upcoming {
    background: var(--color-surface);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);
  }

  .sport-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentColor;
    flex-shrink: 0;
  }

  .sport-status-text strong {
    font-weight: 600;
    color: var(--color-text);
  }

  .status-active .sport-status-text strong {
    color: inherit;
  }
</style>
