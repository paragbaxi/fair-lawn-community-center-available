<script lang="ts">
  import type { ScheduleData } from './types.js';
  import type { FilterCategory } from './filters.js';
  import SportWeekCard from './SportWeekCard.svelte';

  let {
    data,
    selectedSport = null,
    onSelectSport = () => {},
    onManageAlerts = () => {},
  }: {
    data: ScheduleData;
    selectedSport?: FilterCategory | null;
    onSelectSport?: (sport: FilterCategory | null) => void;
    onManageAlerts?: (highlight?: 'thirtyMin' | null) => void;
  } = $props();
</script>

<SportWeekCard {data} expanded={true} {selectedSport} {onSelectSport} {onManageAlerts} />
