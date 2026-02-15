<script lang="ts">
  import type { ScheduleData } from './types.js';
  import { getEasternDayName } from './time.js';

  let { data }: { data: ScheduleData } = $props();

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const today = getEasternDayName();
</script>

<details class="weekly-schedule">
  <summary class="weekly-toggle">Full Weekly Schedule</summary>
  <div class="weekly-content">
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
              <li class:open-gym={act.isOpenGym}>
                <span class="act-time">{act.start} &ndash; {act.end}</span>
                <span class="act-name">{act.name}</span>
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
    padding: 12px 0;
    color: var(--color-text);
    min-height: 44px;
    display: flex;
    align-items: center;
  }

  .weekly-toggle::-webkit-details-marker {
    margin-right: 8px;
  }

  .weekly-content {
    padding-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 16px;
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
