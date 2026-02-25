<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { OccupancyLevel, OccupancyReport } from './types.js';
  import { WORKER_URL } from './notifications.js';

  // ─── Constants ──────────────────────────────────────────────────────────────

  const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  const RATE_LIMIT_MS = 15 * 60 * 1000;   // 15 minutes
  const LS_KEY = 'flcc:occupancy:lastReport';

  const LEVELS: Array<{ value: OccupancyLevel; emoji: string; label: string }> = [
    { value: 'light',    emoji: '🟢', label: 'Light'    },
    { value: 'moderate', emoji: '🟡', label: 'Moderate' },
    { value: 'packed',   emoji: '🔴', label: 'Packed'   },
  ];

  // ─── State ──────────────────────────────────────────────────────────────────

  let report: OccupancyReport = $state({ level: null, reportedAt: null, expiresAt: null });
  let thanksVisible = $state(false);
  let isSubmitting = $state(false);
  let userReportedAt: number | null = $state(null);

  // ─── Derived ────────────────────────────────────────────────────────────────

  const isRateLimited = $derived(
    userReportedAt !== null && Date.now() - userReportedAt < RATE_LIMIT_MS,
  );

  const currentConfig = $derived(
    report.level ? LEVELS.find((l) => l.value === report.level) ?? null : null,
  );

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function relativeTime(isoString: string | null): string {
    if (!isoString) return '';
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin === 1) return '1 min ago';
    return `${diffMin} min ago`;
  }

  async function fetchOccupancy(): Promise<void> {
    if (!WORKER_URL) return;
    try {
      const res = await fetch(`${WORKER_URL}/occupancy`);
      if (!res.ok) return;
      const data = await res.json() as OccupancyReport;
      report = data;
    } catch {
      // Silently ignore — occupancy is best-effort
    }
  }

  async function submitLevel(level: OccupancyLevel): Promise<void> {
    if (isRateLimited || isSubmitting || !WORKER_URL) return;
    isSubmitting = true;

    // Optimistic update
    const now = new Date().toISOString();
    report = {
      level,
      reportedAt: now,
      expiresAt: new Date(Date.now() + RATE_LIMIT_MS).toISOString(),
    };

    try {
      const res = await fetch(`${WORKER_URL}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level }),
      });

      if (res.ok) {
        const data = await res.json() as { ok: boolean; level: OccupancyLevel; expiresAt: string };
        report = { level: data.level, reportedAt: now, expiresAt: data.expiresAt };
        userReportedAt = Date.now();
        localStorage.setItem(LS_KEY, String(userReportedAt));
        thanksVisible = true;
        setTimeout(() => { thanksVisible = false; }, 2000);
      } else if (res.status === 429) {
        // Another device already reported — treat as rate-limited
        userReportedAt = Date.now();
        localStorage.setItem(LS_KEY, String(userReportedAt));
      } else {
        // Revert optimistic update on other errors
        await fetchOccupancy();
      }
    } catch {
      // Revert optimistic update on network error
      await fetchOccupancy();
    } finally {
      isSubmitting = false;
    }
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  let pollTimer: ReturnType<typeof setInterval> | undefined;

  onMount(() => {
    // Restore rate-limit state from localStorage
    const stored = localStorage.getItem(LS_KEY);
    if (stored) {
      const ts = parseInt(stored, 10);
      if (!isNaN(ts) && Date.now() - ts < RATE_LIMIT_MS) {
        userReportedAt = ts;
      } else {
        localStorage.removeItem(LS_KEY);
      }
    }

    fetchOccupancy();
    pollTimer = setInterval(fetchOccupancy, POLL_INTERVAL_MS);
  });

  onDestroy(() => {
    clearInterval(pollTimer);
  });
</script>

<section class="occupancy-widget" aria-label="Gym busyness">
  <div class="occupancy-header">
    <span class="occupancy-title">How busy is it?</span>
    {#if thanksVisible}
      <span class="occupancy-thanks" aria-live="polite">Thanks!</span>
    {:else if report.level && currentConfig}
      <span class="occupancy-pill occupancy-pill--{report.level}" aria-live="polite">
        {currentConfig.emoji} {currentConfig.label}
      </span>
    {:else}
      <span class="occupancy-empty" aria-live="polite">Be first to report</span>
    {/if}
  </div>

  {#if report.level && report.reportedAt && !thanksVisible}
    <p class="occupancy-age">reported {relativeTime(report.reportedAt)}</p>
  {/if}

  <div class="occupancy-buttons" role="group" aria-label="Report busyness level">
    {#each LEVELS as lvl (lvl.value)}
      <button
        class="occupancy-btn occupancy-btn--{lvl.value}"
        class:occupancy-btn--active={report.level === lvl.value}
        disabled={isRateLimited || isSubmitting}
        onclick={() => submitLevel(lvl.value)}
        aria-pressed={report.level === lvl.value}
        title={isRateLimited ? 'You already reported recently' : `Report ${lvl.label}`}
      >
        <span aria-hidden="true">{lvl.emoji}</span>
        {lvl.label}
      </button>
    {/each}
  </div>

  {#if isRateLimited}
    <p class="occupancy-ratelimit">You can report again in a few minutes.</p>
  {/if}
</section>

<style>
  .occupancy-widget {
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 14px 16px;
    margin-bottom: 16px;
    background: var(--color-surface);
  }

  .occupancy-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .occupancy-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .occupancy-pill {
    font-size: 0.85rem;
    font-weight: 600;
    padding: 2px 10px;
    border-radius: 999px;
    line-height: 1.6;
  }

  .occupancy-pill--light {
    background: #f0fdf4;
    color: #15803d;
  }

  .occupancy-pill--moderate {
    background: #fffbeb;
    color: #b45309;
  }

  .occupancy-pill--packed {
    background: #fef2f2;
    color: #b91c1c;
  }

  @media (prefers-color-scheme: dark) {
    .occupancy-pill--light    { background: #052e16; color: #4ade80; }
    .occupancy-pill--moderate { background: #451a03; color: #fbbf24; }
    .occupancy-pill--packed   { background: #450a0a; color: #f87171; }
  }

  .occupancy-empty {
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    font-style: italic;
  }

  .occupancy-thanks {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-available);
  }

  .occupancy-age {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    margin-bottom: 10px;
  }

  .occupancy-buttons {
    display: flex;
    gap: 8px;
    margin-top: 10px;
  }

  .occupancy-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 8px 4px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 0.82rem;
    font-weight: 500;
    cursor: pointer;
    min-height: 44px;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .occupancy-btn:hover:not(:disabled) {
    border-color: var(--color-text-secondary);
    background: var(--color-surface);
  }

  .occupancy-btn--active {
    border-width: 2px;
  }

  .occupancy-btn--light.occupancy-btn--active {
    border-color: #16a34a;
    background: #f0fdf4;
    color: #15803d;
  }

  .occupancy-btn--moderate.occupancy-btn--active {
    border-color: #d97706;
    background: #fffbeb;
    color: #b45309;
  }

  .occupancy-btn--packed.occupancy-btn--active {
    border-color: #dc2626;
    background: #fef2f2;
    color: #b91c1c;
  }

  @media (prefers-color-scheme: dark) {
    .occupancy-btn--light.occupancy-btn--active    { border-color: #4ade80; background: #052e16; color: #4ade80; }
    .occupancy-btn--moderate.occupancy-btn--active { border-color: #fbbf24; background: #451a03; color: #fbbf24; }
    .occupancy-btn--packed.occupancy-btn--active   { border-color: #f87171; background: #450a0a; color: #f87171; }
  }

  .occupancy-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .occupancy-ratelimit {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    margin-top: 8px;
    text-align: center;
  }
</style>
