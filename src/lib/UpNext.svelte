<script lang="ts">
  import type { DaySchedule } from './types.js';
  import { getEasternNow, parseTime } from './time.js';

  let { schedule }: { schedule: DaySchedule } = $props();

  const upcoming = $derived.by(() => {
    const now = getEasternNow();
    return schedule.activities.filter((act) => {
      const start = parseTime(act.start, now);
      return start > now;
    });
  });
</script>

{#if upcoming.length > 0}
  <div class="up-next">
    <h2 class="section-title">Up Next</h2>
    <ul class="activity-list" role="list">
      {#each upcoming as act}
        <li class="activity-item" class:open-gym={act.isOpenGym}>
          <span class="activity-time">{act.start}</span>
          <span class="activity-name">{act.name}</span>
          {#if act.isOpenGym}
            <span class="open-badge">Open</span>
          {/if}
        </li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .up-next {
    margin-bottom: 24px;
  }

  .section-title {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 8px;
  }

  .activity-list {
    list-style: none;
  }

  .activity-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid var(--color-border);
    min-height: 44px;
  }

  .activity-item:last-child {
    border-bottom: none;
  }

  .activity-time {
    font-size: 0.9rem;
    font-weight: 600;
    min-width: 80px;
    color: var(--color-text-secondary);
  }

  .activity-name {
    flex: 1;
    font-size: 0.95rem;
  }

  .open-badge {
    font-size: 0.7rem;
    font-weight: 600;
    background: var(--color-available);
    color: white;
    padding: 2px 8px;
    border-radius: 10px;
  }
</style>
