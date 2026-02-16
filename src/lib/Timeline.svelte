<script lang="ts">
  import type { DaySchedule } from './types.js';
  import { getEasternNow, parseTime } from './time.js';
  import { activityEmoji } from './emoji.js';

  let { schedule, dayName }: { schedule: DaySchedule; dayName: string } = $props();

  let now = $state(getEasternNow());

  $effect(() => {
    const interval = setInterval(() => {
      now = getEasternNow();
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  });

  const openTime = $derived(parseTime(schedule.open, now));
  const closeTime = $derived(parseTime(schedule.close, now));
  const totalMs = $derived(closeTime.getTime() - openTime.getTime());

  function pct(time: Date): number {
    return Math.max(0, Math.min(100, ((time.getTime() - openTime.getTime()) / totalMs) * 100));
  }

  const nowPct = $derived(pct(now));
  const isOpen = $derived(now >= openTime && now < closeTime);

  const segments = $derived(
    schedule.activities.map((act) => {
      const start = parseTime(act.start, now);
      const end = parseTime(act.end, now);
      const left = pct(start);
      const width = pct(end) - left;
      const isPast = end <= now;
      const isCurrent = start <= now && now < end;
      return { ...act, left, width, isPast, isCurrent };
    })
  );
</script>

<div class="timeline-section">
  <div class="timeline-header">
    <span class="timeline-day">Today ({dayName})</span>
    <span class="timeline-range">{schedule.open} &mdash; {schedule.close}</span>
  </div>

  <!-- Desktop: horizontal bar -->
  <div class="timeline-bar" aria-hidden="true">
    {#each segments as seg}
      <div
        class="segment"
        class:open-gym={seg.isOpenGym}
        class:scheduled={!seg.isOpenGym}
        class:past={seg.isPast}
        class:current={seg.isCurrent}
        style="left: {seg.left}%; width: {seg.width}%;"
        title="{seg.name}: {seg.start} - {seg.end}"
      >
        <span class="segment-label">{seg.name}</span>
      </div>
    {/each}
    {#if isOpen}
      <div class="now-marker" style="left: {nowPct}%;">
        <div class="now-line"></div>
        <span class="now-label">NOW</span>
      </div>
    {/if}
  </div>

  <div class="timeline-legend" aria-hidden="true">
    <span class="legend-item"><span class="legend-swatch open-gym"></span> Available</span>
    <span class="legend-item"><span class="legend-swatch scheduled"></span> Scheduled</span>
  </div>

  <!-- Mobile: vertical list -->
  <div class="timeline-list" role="list" aria-label="Today's schedule">
    {#each segments as seg}
      {@const emoji = activityEmoji(seg.name)}
      <div
        class="list-item"
        class:open-gym={seg.isOpenGym}
        class:past={seg.isPast}
        class:current={seg.isCurrent}
        role="listitem"
      >
        <span class="list-time">{seg.start}&ndash;{seg.end}</span>
        <span class="list-name">{#if emoji}<span class="activity-emoji" aria-hidden="true">{emoji}</span> {/if}{seg.name}</span>
        {#if seg.isCurrent}
          <span class="list-badge">NOW</span>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .timeline-section {
    margin-bottom: 24px;
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

  /* Desktop horizontal bar */
  .timeline-bar {
    position: relative;
    height: 48px;
    background: var(--color-surface);
    border-radius: 8px;
    border: 1px solid var(--color-border);
    overflow: hidden;
    margin-bottom: 8px;
  }

  .segment {
    position: absolute;
    top: 0;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    transition: opacity 0.3s;
  }

  .segment.open-gym {
    background: var(--color-available);
    opacity: 0.8;
  }

  .segment.open-gym.current {
    opacity: 1;
  }

  .segment.open-gym.past {
    opacity: 0.45;
  }

  .segment.scheduled {
    background: var(--color-timeline-scheduled);
    opacity: 0.6;
  }

  .segment.scheduled.current {
    opacity: 0.9;
  }

  .segment.scheduled.past {
    opacity: 0.4;
  }

  .segment-label {
    color: white;
    font-size: 0.8rem;
    font-weight: 600;
    padding: 0 4px;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    line-height: 1.2;
    max-width: 100%;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .now-marker {
    position: absolute;
    top: 0;
    height: 100%;
    transform: translateX(-50%);
    z-index: 10;
    pointer-events: none;
  }

  .now-line {
    width: 2px;
    height: 100%;
    background: var(--color-text);
  }

  .now-label {
    position: absolute;
    top: -18px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--color-text);
  }

  .timeline-legend {
    display: flex;
    gap: 16px;
    font-size: 0.85rem;
    color: var(--color-text-secondary);
    margin-bottom: 16px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .legend-swatch {
    width: 12px;
    height: 12px;
    border-radius: 3px;
  }

  .legend-swatch.open-gym {
    background: var(--color-available);
  }

  .legend-swatch.scheduled {
    background: var(--color-timeline-scheduled);
  }

  /* Mobile: vertical list */
  .timeline-list {
    display: none;
  }

  @media (max-width: 640px) {
    .timeline-bar,
    .timeline-legend {
      display: none;
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
  }
</style>
