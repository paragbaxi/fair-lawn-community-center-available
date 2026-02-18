<script lang="ts">
  import type { GymState, ScheduleData } from './types.js';
  import StatusCard from './StatusCard.svelte';
  import NotificationSettings from './NotificationSettings.svelte';
  import { formatEasternDate } from './time.js';

  let { gymState, data }: {
    gymState: GymState;
    data: ScheduleData;
  } = $props();
</script>

<StatusCard {gymState} />

<NotificationSettings />

<footer class="micro-footer">
  <p>
    Unofficial &middot; Updated {formatEasternDate(data.scrapedAt)}
    &middot; Schedule may change without notice.
  </p>
</footer>

<style>
  .micro-footer {
    text-align: center;
    color: var(--color-text-secondary);
    font-size: 0.8rem;
    padding-top: 8px;
  }
</style>
