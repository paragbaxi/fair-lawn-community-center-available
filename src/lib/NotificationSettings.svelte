<script lang="ts">
  import { onMount } from 'svelte';
  import type { NotifPrefs, GymState } from './types.js';
  import * as notifications from './notifications.js';
  import type { NotifState } from './notifications.js';
  import { SPORT_CATEGORIES } from './filters.js';

  let { gymState }: { gymState: GymState } = $props();

  let state: NotifState = $state('prompt');
  let prefs: NotifPrefs = $state({ thirtyMin: true, dailyBriefing: true, sports: [] });
  let expanded = $state(false);
  let isIos = $state(false);
  let isStandalone = $state(false);
  let loading = $state(false);

  const isSubscribed = $derived(state === 'subscribed');

  const ctaLabel = $derived(
    gymState?.nextOpenGym
      ? `Alert me before Open Gym at ${gymState.nextOpenGym.start}`
      : 'Get Open Gym alerts'
  );

  const activeSportChips = $derived(
    SPORT_CATEGORIES.filter(cat => (prefs.sports ?? []).includes(cat.id))
  );

  onMount(async () => {
    // iOS detection
    isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    isStandalone = window.matchMedia('(display-mode: standalone)').matches;

    state = await notifications.getState();
    const stored = notifications.getStoredPrefs();
    if (stored) prefs = stored;
  });

  async function handleEnable() {
    loading = true;
    // Must call subscribe directly in onclick — no await before this call
    // (Safari requires the gesture context to remain active)
    const result = await notifications.subscribe(prefs);
    loading = false;

    if (result === true) {
      state = 'subscribed';
      expanded = false;
    } else if (result === 'denied') {
      state = 'denied';
    }
    // 'unsupported' or false: stay in prompt state
  }

  async function handleDisable() {
    loading = true;
    await notifications.unsubscribe();
    loading = false;
    state = 'prompt';
    prefs = { thirtyMin: true, dailyBriefing: true, sports: [] };
    expanded = false;
  }

  function savePrefs() {
    notifications.updatePrefs(prefs);
  }

  async function removeSport(sportId: string) {
    const next = { ...prefs, sports: (prefs.sports ?? []).filter(id => id !== sportId) };
    prefs = next;
    await notifications.updatePrefs(next);
  }
</script>

{#if state === 'unsupported'}
  <!-- Hidden — browser doesn't support push -->
{:else if isIos && !isStandalone}
  <div class="notif-banner notif-hint">
    <span class="notif-icon">📲</span>
    Add to Home Screen to enable notifications
  </div>
{:else if state === 'denied'}
  <div class="notif-banner notif-denied">
    <span class="notif-icon">🔕</span>
    Notifications blocked — enable in browser Settings
  </div>
{:else if isSubscribed}
  <div class="notif-section notif-on">
    <div class="notif-header">
      <div class="notif-header-main">
        <span class="notif-status">Notifications on ✓</span>
        <span class="notif-success-copy">We'll alert you ~30 min before Open Gym.</span>
      </div>
      <button class="notif-toggle-btn" onclick={() => (expanded = !expanded)} aria-expanded={expanded}>
        <span class="notif-chevron" class:open={expanded}>▾</span>
      </button>
    </div>
    {#if expanded}
      <div class="notif-prefs">
        <label class="notif-pref-row">
          <input type="checkbox" bind:checked={prefs.thirtyMin} onchange={savePrefs} />
          30-min heads-up before Open Gym starts
        </label>
        <label class="notif-pref-row">
          <input type="checkbox" bind:checked={prefs.dailyBriefing} onchange={savePrefs} />
          Morning briefing — today's Open Gym times
        </label>
        {#if activeSportChips.length > 0}
          <div class="notif-sport-section">
            <span class="notif-sport-label">Sport alerts (tap to remove):</span>
            <div class="notif-sport-chips">
              {#each activeSportChips as sport}
                <button
                  class="notif-sport-chip"
                  onclick={() => removeSport(sport.id)}
                  title="Remove {sport.label} alert"
                >
                  {sport.label} ✕
                </button>
              {/each}
            </div>
          </div>
        {/if}
        <button class="notif-off-btn" onclick={handleDisable} disabled={loading}>
          {loading ? 'Turning off…' : 'Turn off notifications'}
        </button>
      </div>
    {/if}
  </div>
{:else}
  <div class="notif-section notif-off">
    <button
      class="notif-enable-btn"
      onclick={handleEnable}
      disabled={loading}
    >
      <span class="notif-icon">🔔</span>
      {loading ? 'Enabling…' : ctaLabel}
    </button>
  </div>
{/if}

<style>
  .notif-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
    padding: 10px 14px;
    border-radius: 8px;
    margin-top: 16px;
  }

  .notif-hint {
    background: var(--color-surface-alt, #f0f4f8);
    color: var(--color-text-secondary);
  }

  .notif-denied {
    background: var(--color-surface-alt, #f0f4f8);
    color: var(--color-text-secondary);
  }

  .notif-icon {
    font-size: 1.1rem;
  }

  .notif-section {
    margin-top: 16px;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 8px;
    overflow: hidden;
  }

  .notif-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    font-size: 0.9rem;
  }

  .notif-header-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .notif-status {
    color: var(--color-success, #38a169);
    font-weight: 500;
  }

  .notif-success-copy {
    font-size: 0.8rem;
    color: var(--color-text-secondary);
  }

  .notif-toggle-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.3rem;
    color: var(--color-text-secondary);
    padding: 4px 6px;
    line-height: 1;
  }

  .notif-toggle-btn:hover {
    color: var(--color-text-primary);
  }

  .notif-chevron {
    display: inline-block;
    transition: transform 0.2s;
    line-height: 1;
  }

  .notif-chevron.open {
    transform: rotate(180deg);
  }

  .notif-enable-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    padding: 10px 14px;
    background: var(--color-accent, #3182ce);
    color: white;
    border: none;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .notif-enable-btn:hover:not(:disabled) {
    background: var(--color-accent-hover, #2b6cb0);
  }

  .notif-enable-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .notif-prefs {
    padding: 8px 14px 14px;
    border-top: 1px solid var(--color-border, #e2e8f0);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .notif-pref-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 0.875rem;
    cursor: pointer;
    line-height: 1.4;
  }

  .notif-pref-row input[type='checkbox'] {
    margin-top: 2px;
    flex-shrink: 0;
  }

  .notif-sport-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .notif-sport-label {
    font-size: 0.8rem;
    color: var(--color-text-secondary);
  }

  .notif-sport-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .notif-sport-chip {
    padding: 4px 10px;
    border-radius: 16px;
    font-size: 0.8rem;
    font-weight: 500;
    border: 1px solid var(--color-border, #e2e8f0);
    background: var(--color-surface-alt, #f0f4f8);
    color: var(--color-text);
    cursor: pointer;
  }

  .notif-sport-chip:hover {
    background: var(--color-border, #e2e8f0);
  }

  .notif-off-btn {
    margin-top: 4px;
    padding: 8px 16px;
    border-radius: 6px;
    border: 1px solid var(--color-border, #e2e8f0);
    background: none;
    color: var(--color-text-secondary);
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    align-self: flex-start;
  }

  .notif-off-btn:hover:not(:disabled) {
    background: var(--color-surface-alt, #f7fafc);
  }

  .notif-off-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
