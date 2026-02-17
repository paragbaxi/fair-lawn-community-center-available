<script lang="ts">
  import type { ScheduleData, GymState, DaySchedule } from './types.js';
  import CompactStatus from './CompactStatus.svelte';
  import DayPicker from './DayPicker.svelte';
  import Timeline from './Timeline.svelte';

  let { data, gymState, selectedDay, selectedSchedule, isSelectedToday, onSelectDay, onTabSwitch }: {
    data: ScheduleData;
    gymState: GymState;
    selectedDay: string;
    selectedSchedule: DaySchedule | null;
    isSelectedToday: boolean;
    onSelectDay: (day: string) => void;
    onTabSwitch: (tab: 'status') => void;
  } = $props();
</script>

<CompactStatus {gymState} onTap={() => onTabSwitch('status')} />

<DayPicker {data} {selectedDay} today={gymState.dayName} {onSelectDay} />

{#if selectedSchedule}
  <Timeline schedule={selectedSchedule} dayName={selectedDay} isToday={isSelectedToday} />
{/if}
