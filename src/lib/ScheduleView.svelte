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

<section class="about" aria-label="About this app">
  <dl class="faq">
    <div class="faq-item">
      <dt>Is this official?</dt>
      <dd>No — this is a community project, not run by the town. Schedule data comes from <a href="https://www.fairlawn.org/park-rec" target="_blank" rel="noopener">fairlawn.org</a> and refreshes daily.</dd>
    </div>
    <div class="faq-item">
      <dt>How do I know if it's up to date?</dt>
      <dd>The "Updated" date above tells you when we last grabbed the schedule. If something seems off, check <a href="https://www.fairlawn.org/park-rec" target="_blank" rel="noopener">fairlawn.org/park-rec</a> directly.</dd>
    </div>
    <div class="faq-item">
      <dt>Can I put this on my phone?</dt>
      <dd>Yes. On iPhone: tap Share → "Add to Home Screen". On Android: tap the browser menu → "Install app". Works like a real app after that.</dd>
    </div>
    <div class="faq-item">
      <dt>Does it work without wifi?</dt>
      <dd>After your first visit, yes — it loads from cache. You'll see a notice at the top if you're offline.</dd>
    </div>
    <div class="faq-item">
      <dt>Who can use the gym?</dt>
      <dd>Fair Lawn residents only. Bring your resident card.</dd>
    </div>
  </dl>
</section>

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

  .about {
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid var(--color-border);
  }

  .faq {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin: 0;
    padding: 0;
  }

  .faq-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .faq dt {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-text);
    letter-spacing: 0.01em;
  }

  .faq dd {
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    margin: 0;
    line-height: 1.5;
  }

  .faq dd a {
    color: var(--color-text-secondary);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  @media (hover: hover) {
    .faq dd a:hover {
      color: var(--color-text);
    }
  }
</style>
