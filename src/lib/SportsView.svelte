<script lang="ts">
  import type { ScheduleData } from './types.js';
  import SportWeekCard from './SportWeekCard.svelte';

  let { data }: { data: ScheduleData } = $props();
</script>

<SportWeekCard {data} expanded={true} />
