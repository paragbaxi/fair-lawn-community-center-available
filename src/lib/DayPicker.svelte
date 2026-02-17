<script lang="ts">
  import type { ScheduleData } from './types.js';
  import { DISPLAY_DAYS } from './time.js';

  let { data, selectedDay, today, onSelectDay }: {
    data: ScheduleData;
    selectedDay: string;
    today: string;
    onSelectDay: (day: string) => void;
  } = $props();
</script>

<div class="day-picker" role="group" aria-label="Select day">
  {#each DISPLAY_DAYS as day}
    <button
      class="day-btn"
      class:selected={selectedDay === day.full}
      class:is-today={today === day.full}
      aria-pressed={selectedDay === day.full}
      onclick={() => onSelectDay(day.full)}
      disabled={!data.schedule[day.full]}
    >
      <span class="day-label">{day.short}</span>
      {#if today === day.full}
        <span class="today-dot" aria-hidden="true"></span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .day-picker {
    display: flex;
    gap: 4px;
    margin-bottom: 12px;
  }

  .day-btn {
    flex: 1;
    padding: 8px 0;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 600;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text);
    cursor: pointer;
    min-height: 44px;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }

  .day-btn.selected {
    background: var(--color-text);
    border-color: var(--color-text);
    color: var(--color-bg);
  }

  .day-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .day-btn:not(:disabled):active {
    opacity: 0.8;
  }

  @media (hover: hover) {
    .day-btn:not(:disabled):not(.selected):hover {
      background: var(--color-border);
    }
  }

  .today-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--color-available);
  }

  @media (prefers-reduced-motion: reduce) {
    .day-btn {
      transition: none;
    }
  }
</style>
