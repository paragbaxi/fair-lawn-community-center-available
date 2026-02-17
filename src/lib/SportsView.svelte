<script lang="ts">
  import type { ScheduleData } from './types.js';
  import type { FilterCategory } from './filters.js';
  import SportWeekCard from './SportWeekCard.svelte';

  let {
    data,
    selectedSport = null,
    onSelectSport = () => {},
  }: {
    data: ScheduleData;
    selectedSport?: FilterCategory | null;
    onSelectSport?: (sport: FilterCategory | null) => void;
  } = $props();
</script>

<SportWeekCard {data} expanded={true} {selectedSport} {onSelectSport} />
