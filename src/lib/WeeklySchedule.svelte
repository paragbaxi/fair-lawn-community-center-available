<script lang="ts">
  import type { ScheduleData } from './types.js';
  import { DISPLAY_DAYS } from './time.js';
  import { activityEmoji } from './emoji.js';

  let { data, today, skipDay = null }: {
    data: ScheduleData;
    today: string;
    skipDay?: string | null;
  } = $props();

  // Accordion mode: track which days are expanded (today expanded by default)
  let expandedDays = $state(new Set<string>());
  let prevToday = $state('');

  // Initialize with today expanded; update when midnight rolls over
  $effect(() => {
    if (prevToday === '') {
      expandedDays = new Set([today]);
      prevToday = today;
    } else if (today !== prevToday) {
      const next = new Set(expandedDays);
      next.delete(prevToday);
      next.add(today);
      expandedDays = next;
      prevToday = today;
    }
  });

  function toggleDay(day: string) {
    const next = new Set(expandedDays);
    if (next.has(day)) {
      next.delete(day);
    } else {
      next.add(day);
    }
    expandedDays = next;
  }
</script>

<!-- Accordion mode: per-day collapsible sections -->
<div class="schedule-accordion">
  {#each DISPLAY_DAYS as day}
    {#if data.schedule[day.full] && day.full !== skipDay}
      {@const schedule = data.schedule[day.full]}
      {@const dayExpanded = expandedDays.has(day.full)}
      <div class="accordion-item" class:is-today={day.full === today}>
        <button
          class="accordion-header"
          aria-expanded={dayExpanded}
          onclick={() => toggleDay(day.full)}
        >
          <div class="accordion-header-left">
            <span class="accordion-day">
              {day.full}
              {#if day.full === today}
                <span class="today-badge">Today</span>
              {/if}
            </span>
            <span class="accordion-meta">{schedule.open} &mdash; {schedule.close} &middot; {schedule.activities.length} {schedule.activities.length === 1 ? 'activity' : 'activities'}</span>
          </div>
          <svg
            class="chevron"
            class:chevron-open={dayExpanded}
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <path d="M6 8l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        {#if dayExpanded}
          <div class="accordion-content">
            <ul class="day-activities">
              {#each schedule.activities as act}
                {@const emoji = activityEmoji(act.name)}
                <li class:open-gym={act.isOpenGym}>
                  <span class="act-time">{act.start} &ndash; {act.end}</span>
                  <span class="act-name">{#if emoji}<span class="activity-emoji" aria-hidden="true">{emoji}</span> {/if}{act.name}</span>
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>
    {/if}
  {/each}
</div>

<style>
  /* Accordion mode */
  .schedule-accordion {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .accordion-item {
    border: 1px solid var(--color-border);
    border-radius: 8px;
    overflow: hidden;
  }

  .accordion-item.is-today {
    border-color: var(--color-available);
    border-width: 2px;
  }

  .accordion-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--color-surface);
    border: none;
    cursor: pointer;
    text-align: left;
    color: var(--color-text);
    min-height: 48px;
    -webkit-tap-highlight-color: transparent;
  }

  @media (hover: hover) {
    .accordion-header:hover {
      background: var(--color-border);
    }
  }

  .accordion-header-left {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .accordion-day {
    font-weight: 700;
    font-size: 0.95rem;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .accordion-meta {
    font-size: 0.85rem;
    color: var(--color-text-secondary);
  }

  .accordion-content {
    padding: 0 16px 12px;
    animation: accordionOpen 0.2s ease;
  }

  @keyframes accordionOpen {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .accordion-content {
      animation: none;
    }
    .chevron {
      transition: none;
    }
  }

  .activity-emoji {
    font-size: 1em;
    margin-right: 2px;
  }

  .chevron {
    flex-shrink: 0;
    transition: transform 0.25s ease;
    color: var(--color-text-secondary);
  }

  .chevron-open {
    transform: rotate(180deg);
  }

  .today-badge {
    font-size: 0.8rem;
    font-weight: 600;
    background: var(--color-available);
    color: white;
    padding: 1px 6px;
    border-radius: 8px;
  }

  .day-activities {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .day-activities li {
    display: flex;
    gap: 8px;
    font-size: 0.95rem;
    padding: 4px 0;
    border-left: 3px solid var(--color-timeline-scheduled);
    padding-left: 8px;
  }

  .day-activities li.open-gym {
    border-left-color: var(--color-available);
  }

  .act-time {
    min-width: 120px;
    color: var(--color-text-secondary);
    font-size: 0.9rem;
  }

  .act-name {
    font-weight: 500;
  }
</style>
