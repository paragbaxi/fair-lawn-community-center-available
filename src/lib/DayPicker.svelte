<script lang="ts">
  import type { ScheduleData } from './types.js';
  import { DISPLAY_DAYS } from './time.js';

  let { data, selectedDay, today, onSelectDay }: {
    data: ScheduleData;
    selectedDay: string;
    today: string;
    onSelectDay: (day: string) => void;
  } = $props();

  // Plain let — refs are used imperatively only; no reactive template reads
  let buttonEls: (HTMLButtonElement | null)[] = [];

  // Math.max(0, ...) fallback prevents -1 tabindex blackout on transient out-of-range selectedDay
  const focusedIdx = $derived(
    Math.max(0, DISPLAY_DAYS.findIndex(d => d.full === selectedDay))
  );

  function handleKeyDown(e: KeyboardEvent, idx: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    let nextIdx = idx;
    // Skip disabled days (no schedule data); loop guard prevents infinite cycle
    for (let step = 0; step < DISPLAY_DAYS.length; step++) {
      nextIdx = (nextIdx + dir + DISPLAY_DAYS.length) % DISPLAY_DAYS.length;
      if (data.schedule[DISPLAY_DAYS[nextIdx].full]) break;
    }
    if (nextIdx === idx) return; // all other days disabled — no-op
    onSelectDay(DISPLAY_DAYS[nextIdx].full);
    buttonEls[nextIdx]?.focus();
  }
</script>

<div class="day-picker" role="toolbar" aria-label="Select day">
  {#each DISPLAY_DAYS as day, i}
    <button
      bind:this={buttonEls[i]}
      class="day-btn"
      class:selected={selectedDay === day.full}
      class:is-today={today === day.full}
      tabindex={i === focusedIdx ? 0 : -1}
      aria-pressed={selectedDay === day.full}
      onclick={() => onSelectDay(day.full)}
      onkeydown={(e) => handleKeyDown(e, i)}
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
    border-radius: calc(var(--radius) * 0.6);
    font-size: 0.85rem;
    font-weight: 600;
    letter-spacing: 0.04em;
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
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: #fff;
  }

  .day-btn.is-today:not(.selected) {
    border-color: var(--color-available);
    color: var(--color-available);
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

  .day-btn.selected .today-dot {
    background: rgba(255, 255, 255, 0.8);
  }

  @media (prefers-reduced-motion: reduce) {
    .day-btn {
      transition: none;
    }
  }
</style>
