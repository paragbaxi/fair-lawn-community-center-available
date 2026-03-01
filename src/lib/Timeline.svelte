<script lang="ts">
  import type { DaySchedule } from './types.js';
  import { isActivityPast, isActivityCurrent } from './time.js';
  import { activityEmoji } from './emoji.js';
  import { clock } from './clock.svelte.js';

  let { schedule, dayName, isToday = true }: {
    schedule: DaySchedule;
    dayName: string;
    isToday?: boolean;
  } = $props();

  const activities = $derived(
    schedule.activities.map((act) => ({
      ...act,
      isPast: isActivityPast(act.end, clock.now, isToday),
      isCurrent: isActivityCurrent(act.start, act.end, clock.now, isToday),
    }))
  );

  const hasActivities = $derived(schedule.activities.length > 0);
</script>

<div class="timeline-section">
  <h2 class="section-title">{isToday ? 'Up Next' : 'Activities'}</h2>

  <div class="timeline-header">
    <span class="timeline-day">{isToday ? `Today (${dayName})` : dayName}</span>
    <span class="timeline-range">{schedule.open} &mdash; {schedule.close}</span>
  </div>

  {#if hasActivities}
    <div class="timeline-list" role="list" aria-label="{isToday ? 'Today' : dayName}'s schedule">
      {#each activities as act}
        {@const emoji = activityEmoji(act.name)}
        <div
          class="list-item"
          class:open-gym={act.isOpenGym}
          class:past={act.isPast}
          class:current={act.isCurrent}
          role="listitem"
        >
          <span class="list-time">{act.start}&ndash;{act.end}</span>
          <span class="list-name">{#if emoji}<span class="activity-emoji" aria-hidden="true">{emoji}</span> {/if}{act.name}{#if act.corrected}<span class="corrected-badge" title="Times were listed in reverse on the borough website and have been corrected">corrected</span>{/if}</span>
          {#if act.isCurrent}
            <span class="list-badge">NOW</span>
          {/if}
        </div>
      {/each}
    </div>
  {:else}
    <p class="no-activities">No activities scheduled</p>
  {/if}
</div>

<style>
  .timeline-section {
    margin-bottom: 24px;
  }

  .section-title {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }

  .section-title::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--color-border);
  }

  .timeline-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 12px;
  }

  .timeline-day {
    font-weight: 600;
    font-size: 1rem;
  }

  .timeline-range {
    color: var(--color-text-secondary);
    font-size: 0.9rem;
  }

  .no-activities {
    color: var(--color-text-secondary);
    font-size: 0.95rem;
    text-align: center;
    padding: 24px 16px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: calc(var(--radius) / 2);
  }

  .timeline-list {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .list-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    min-height: 44px;
    background: var(--color-surface);
    border-left: 3px solid var(--color-timeline-scheduled);
    border-radius: 0 calc(var(--radius) / 2) calc(var(--radius) / 2) 0;
    position: relative;
    transition: background 0.3s ease;
  }

  .list-item.open-gym {
    border-left-color: var(--color-available);
  }

  .list-item.current {
    background: var(--color-available-bg);
    border-left-color: var(--color-available);
    border-left-width: 4px;
  }

  .list-item.current::before {
    content: '';
    position: absolute;
    top: -4px;
    left: -3px;
    right: 0;
    height: 2px;
    background: var(--color-available);
    border-radius: 2px;
    box-shadow: 0 0 6px var(--color-available), 0 0 14px var(--color-available);
  }

  .list-item.past {
    opacity: 0.4;
    filter: saturate(0.3);
  }

  .list-time {
    font-size: 0.95rem;
    font-weight: 600;
    min-width: 105px;
    white-space: nowrap;
    color: var(--color-text-secondary);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
  }

  .list-item.current .list-time {
    color: var(--color-available);
  }

  .list-name {
    flex: 1;
    font-size: 0.95rem;
  }

  .list-badge {
    font-size: 0.8rem;
    font-weight: 700;
    background: var(--color-available);
    color: white;
    padding: 2px 8px;
    border-radius: 10px;
    letter-spacing: 0.08em;
    animation: badge-pulse 2s ease-in-out infinite;
  }

  @keyframes badge-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.65; }
  }

  @media (prefers-color-scheme: dark) {
    .list-item.current {
      background: rgba(74, 222, 128, 0.07);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .list-badge { animation: none; }
    .list-item { transition: none; }
  }

  .activity-emoji {
    font-size: 1.1em;
    margin-right: 3px;
  }

  .corrected-badge {
    margin-left: 6px;
    font-size: 0.72rem;
    color: var(--color-text-secondary);
  }
</style>
