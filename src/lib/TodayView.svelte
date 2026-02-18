<script lang="ts">
  import type { ScheduleData, GymState, DaySchedule, TabId } from './types.js';
  import CompactStatus from './CompactStatus.svelte';
  import DayPicker from './DayPicker.svelte';
  import Timeline from './Timeline.svelte';
  import WeeklySchedule from './WeeklySchedule.svelte';
  import AboutFaq from './AboutFaq.svelte';
  import { formatEasternDate } from './time.js';

  let { data, gymState, selectedDay, selectedSchedule, isSelectedToday, onSelectDay, onTabSwitch }: {
    data: ScheduleData;
    gymState: GymState;
    selectedDay: string;
    selectedSchedule: DaySchedule | null;
    isSelectedToday: boolean;
    onSelectDay: (day: string) => void;
    onTabSwitch: (tab: TabId) => void;
  } = $props();
</script>

<CompactStatus {gymState} onTap={() => onTabSwitch('status')} />

<DayPicker {data} {selectedDay} today={gymState.dayName} {onSelectDay} />

{#if selectedSchedule}
  <Timeline schedule={selectedSchedule} dayName={selectedDay} isToday={isSelectedToday} />
{/if}

{#if Object.keys(data.schedule).some(d => d !== selectedDay)}
  <h2 class="rest-of-week-heading">Rest of Week</h2>
  <WeeklySchedule {data} today={gymState.dayName} expanded={true} skipDay={selectedDay} />
{/if}

<AboutFaq />

<footer class="footer">
  <p class="footer-source">
    <span>Updated {formatEasternDate(data.scrapedAt)}</span>
    <span class="footer-sep" aria-hidden="true">&middot;</span>
    <span>Source: <a href="https://www.fairlawn.org/park-rec" target="_blank" rel="noopener">fairlawn.org</a></span>
  </p>
  <p class="footer-notice">Schedule may change without notice.</p>
  <p class="footer-meta">
    <a href="https://github.com/paragbaxi/fair-lawn-community-center-available/issues" target="_blank" rel="noopener">Feedback &amp; suggestions</a> welcome.
  </p>
</footer>

<style>
  .rest-of-week-heading {
    font-size: 1rem;
    font-weight: 600;
    margin: 16px 0 8px;
  }

  .footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    text-align: center;
    color: var(--color-text-secondary);
    font-size: 0.85rem;
    padding-top: 16px;
    margin-top: 16px;
    border-top: 1px solid var(--color-border);
  }

  .footer a {
    color: var(--color-text-secondary);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .footer-source {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .footer-notice,
  .footer-meta {
    font-size: 0.85rem;
  }

  .footer-notice {
    display: inline-block;
    max-width: 100%;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    padding: 2px 10px;
    border-radius: 8px;
  }

  @media (hover: hover) {
    .footer a:hover {
      color: var(--color-text);
    }
  }

  @media (max-width: 640px) {
    .footer-source {
      flex-direction: column;
      gap: 2px;
    }
    .footer-sep {
      display: none;
    }
  }
</style>
