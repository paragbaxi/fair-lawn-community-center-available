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
          <span class="list-name">{#if emoji}<span class="activity-emoji" aria-hidden="true">{emoji}</span> {/if}{act.name}</span>
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
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 8px;
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
    border-radius: 8px;
  }

  .timeline-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--color-border);
  }

  .list-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    min-height: 44px;
    background: var(--color-surface);
    border-left: 4px solid var(--color-timeline-scheduled);
  }

  .list-item.open-gym {
    border-left-color: var(--color-available);
  }

  .list-item.current {
    background: var(--color-available-bg);
    border-left-color: var(--color-available);
  }

  .list-item.past {
    opacity: 0.5;
  }

  .list-time {
    font-size: 0.95rem;
    font-weight: 600;
    min-width: 105px;
    white-space: nowrap;
    color: var(--color-text-secondary);
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
  }

  .activity-emoji {
    font-size: 1.1em;
    margin-right: 3px;
  }
</style>
