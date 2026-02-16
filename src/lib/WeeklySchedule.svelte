<script lang="ts">
  import type { ScheduleData } from './types.js';
  import { getEasternDayName } from './time.js';
  import { activityEmoji } from './emoji.js';

  let { data }: { data: ScheduleData } = $props();

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const today = getEasternDayName();

  let isOpen = $state(false);
</script>

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
  <div class="weekly-content" class:weekly-content-open={isOpen}>
    {#each days as day}
      {#if data.schedule[day]}
        <div class="day-block" class:is-today={day === today}>
          <h3 class="day-name">
            {day}
            {#if day === today}
              <span class="today-badge">Today</span>
            {/if}
          </h3>
          <p class="day-hours">{data.schedule[day].open} &mdash; {data.schedule[day].close}</p>
          <ul class="day-activities">
            {#each data.schedule[day].activities as act}
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

<style>
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
    font-size: 0.7rem;
    font-weight: 600;
    background: var(--color-available);
    color: white;
    padding: 1px 6px;
    border-radius: 8px;
  }

  .day-hours {
    font-size: 0.8rem;
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
    font-size: 0.85rem;
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
    font-size: 0.8rem;
  }

  .act-name {
    font-weight: 500;
  }
</style>
