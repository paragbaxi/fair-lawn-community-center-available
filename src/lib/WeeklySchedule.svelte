<script lang="ts">
  import { untrack } from 'svelte';
  import type { ScheduleData } from './types.js';
  import { DISPLAY_DAYS } from './time.js';
  import { activityEmoji } from './emoji.js';

  let { data, today, expanded = false, initialDay = null }: {
    data: ScheduleData;
    today: string;
    expanded?: boolean;
    initialDay?: string | null;
  } = $props();

  // Collapsed <details> mode state
  let isOpen = $state(false);

  // Accordion mode: track which days are expanded (today expanded by default)
  let expandedDays = $state(new Set<string>());
  let prevToday = $state('');

  // Initialize with today expanded (and initialDay if provided); update when midnight rolls over
  $effect(() => {
    if (prevToday === '') {
      const initial = new Set([today]);
      const seedDay = untrack(() => initialDay);
      if (seedDay && seedDay !== today && data.schedule[seedDay]) {
        initial.add(seedDay);
      }
      expandedDays = initial;
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

{#if expanded}
  <!-- Accordion mode: per-day collapsible sections -->
  <div class="schedule-accordion">
    {#each DISPLAY_DAYS as day}
      {#if data.schedule[day.full]}
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
{:else}
  <!-- Original <details> mode -->
  <details class="weekly-schedule" bind:open={isOpen}>
    <summary class="weekly-toggle">
      <span class="toggle-label">Full Weekly Schedule</span>
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
    <div class="weekly-content">
      {#each DISPLAY_DAYS as day}
        {#if data.schedule[day.full]}
          <div class="day-block" class:is-today={day.full === today}>
            <h3 class="day-name">
              {day.full}
              {#if day.full === today}
                <span class="today-badge">Today</span>
              {/if}
            </h3>
            <p class="day-hours">{data.schedule[day.full].open} &mdash; {data.schedule[day.full].close}</p>
            <ul class="day-activities">
              {#each data.schedule[day.full].activities as act}
                {@const emoji = activityEmoji(act.name)}
                <li class:open-gym={act.isOpenGym}>
                  <span class="act-time">{act.start} &ndash; {act.end}</span>
                  <span class="act-name">{#if emoji}<span class="activity-emoji" aria-hidden="true">{emoji}</span> {/if}{act.name}</span>
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      {/each}
    </div>
  </details>
{/if}

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
  }

  /* Original details mode */
  .weekly-schedule {
    margin-bottom: 24px;
  }

  .weekly-toggle {
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

  .weekly-toggle::-webkit-details-marker {
    display: none;
  }

  .weekly-toggle::marker {
    content: '';
  }

  .weekly-toggle:active {
    opacity: 0.8;
  }

  @media (hover: hover) {
    .weekly-toggle:hover {
      background: var(--color-border);
    }
  }

  .toggle-label {
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

  .weekly-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow: hidden;
    animation: slideDown 0.25s ease;
    padding-top: 12px;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      max-height: 0;
    }
    to {
      opacity: 1;
      max-height: 2000px;
    }
  }

  .activity-emoji {
    font-size: 1em;
    margin-right: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .weekly-content {
      animation: none;
    }
    .chevron {
      transition: none;
    }
  }

  .day-block {
    padding: 12px 16px;
    border-radius: 8px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
  }

  .day-block.is-today {
    border-color: var(--color-available);
    border-width: 2px;
  }

  .day-name {
    font-size: 0.95rem;
    font-weight: 700;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .today-badge {
    font-size: 0.8rem;
    font-weight: 600;
    background: var(--color-available);
    color: white;
    padding: 1px 6px;
    border-radius: 8px;
  }

  .day-hours {
    font-size: 0.9rem;
    color: var(--color-text-secondary);
    margin-bottom: 8px;
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
