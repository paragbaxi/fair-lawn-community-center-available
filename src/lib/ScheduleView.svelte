<script lang="ts">
  import type { ScheduleData } from './types.js';
  import WeeklySchedule from './WeeklySchedule.svelte';

  let { data, today, scrapedAt, initialDay = null }: {
    data: ScheduleData;
    today: string;
    scrapedAt: string;
    initialDay?: string | null;
  } = $props();
</script>

<WeeklySchedule {data} {today} expanded={true} {initialDay} />

<footer class="footer">
  <p class="footer-source">
    <span>Updated {new Date(scrapedAt).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' })}</span>
    <span class="footer-sep" aria-hidden="true">&middot;</span>
    <span>Source: <a href="https://www.fairlawn.org/park-rec" target="_blank" rel="noopener">fairlawn.org</a></span>
  </p>
  <p class="footer-notice">
    Fair Lawn residents only. Schedule may change without notice.
  </p>
  <p class="footer-meta">
    This is an unofficial community project, not affiliated with the
    <a href="https://www.fairlawn.org/community-center" target="_blank" rel="noopener">Borough of Fair Lawn</a>.
  </p>
  <p class="footer-meta">
    <a href="https://github.com/paragbaxi/fair-lawn-community-center-available/issues" target="_blank" rel="noopener">Feedback &amp; suggestions</a> welcome.
  </p>
</footer>

<style>
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

  .footer-meta + .footer-meta {
    margin-top: -6px;
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
