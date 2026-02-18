<script lang="ts">
  import { tick } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { getAvailableSports } from './filters.js';
  import { activityEmoji } from './emoji.js';
  import { notifStore, handleEnable, handleDisable, savePrefs, toggleSport } from './notifStore.svelte.js';
  import type { GymState, ScheduleData } from './types.js';

  let { open, gymState, data, onClose }: {
    open: boolean;
    gymState: GymState | null;
    data: ScheduleData | null;
    onClose: () => void;
  } = $props();

  let panelEl: HTMLDivElement | null = $state(null);

  // Only show sports with sessions this week (matches SportWeekCard behavior)
  const notifiableSports = $derived(data ? getAvailableSports(data.schedule) : []);

  // Returns 0 when user prefers reduced motion, so transitions are instant
  function dur(ms: number): number {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : ms;
  }

  const focusableSelector =
    'button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

  // Body scroll lock + focus trap + Escape key
  $effect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';

    // Move initial focus into dialog after panel renders
    tick().then(() => {
      panelEl?.querySelector<HTMLElement>(focusableSelector)?.focus();
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key === 'Tab' && panelEl) {
        const focusable = Array.from(panelEl.querySelectorAll<HTMLElement>(focusableSelector));
        if (focusable.length === 0) { e.preventDefault(); return; }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeyDown);
      notifStore.error = null;  // clear error when sheet closes
    };
  });

  async function onEnableClick() {
    await handleEnable();
    // Stay in sheet — transitions to manage state if subscribed
  }
</script>

{#if open}
  <div
    class="sheet-backdrop"
    onclick={onClose}
    role="presentation"
    transition:fade={{ duration: dur(200) }}
  ></div>
  <div
    class="sheet-panel"
    bind:this={panelEl}
    role="dialog"
    aria-modal="true"
    aria-labelledby="sheet-title"
    transition:fly={{ y: 300, duration: dur(300), easing: cubicOut }}
  >
    <div class="sheet-handle" aria-hidden="true"></div>
    <div class="sheet-header">
      <h2 id="sheet-title" class="sheet-title">My Alerts</h2>
      <!-- Close button ALWAYS present (focus trap anchor for info-only states) -->
      <button class="sheet-close" onclick={onClose} aria-label="Close">✕</button>
    </div>
    <div class="sheet-content">
      {#if notifStore.error}
        <p class="sheet-error" role="alert">{notifStore.error}</p>
      {/if}
      {#if !notifStore.initialized}
        <div class="sheet-loading" aria-busy="true">…</div>
      {:else if notifStore.isIos && !notifStore.isStandalone}
        <div class="sheet-empty-state">
          📲 Add to Home Screen to enable notifications
        </div>
      {:else if notifStore.state === 'denied'}
        <div class="sheet-empty-state">
          🔕 Notifications blocked — enable in browser Settings
        </div>
      {:else if notifStore.state === 'subscribed'}
        <!-- Open Gym section -->
        <section class="sheet-section">
          <h3 class="sheet-section-title">Open Gym</h3>
          <label class="sheet-toggle-row">
            🔔 30-min heads-up
            <button
              class="toggle"
              class:on={notifStore.prefs.thirtyMin}
              role="switch"
              aria-label="30-min heads-up"
              aria-checked={notifStore.prefs.thirtyMin}
              onclick={() => savePrefs({ ...notifStore.prefs, thirtyMin: !notifStore.prefs.thirtyMin })}
            >
              <span class="toggle-thumb"></span>
            </button>
          </label>
          <label class="sheet-toggle-row">
            ☀️ Morning briefing
            <button
              class="toggle"
              class:on={notifStore.prefs.dailyBriefing}
              role="switch"
              aria-label="Morning briefing"
              aria-checked={notifStore.prefs.dailyBriefing}
              onclick={() => savePrefs({ ...notifStore.prefs, dailyBriefing: !notifStore.prefs.dailyBriefing })}
            >
              <span class="toggle-thumb"></span>
            </button>
          </label>
        </section>
        <!-- Sports section (only when there are sports with sessions) -->
        {#if notifiableSports.length > 0}
          <section class="sheet-section">
            <h3 class="sheet-section-title">Sports</h3>
            {#each notifiableSports as sport}
              {@const emoji = activityEmoji(sport.label)}
              {@const on = (notifStore.prefs.sports ?? []).includes(sport.id)}
              <label class="sheet-toggle-row">
                {#if emoji}<span aria-hidden="true">{emoji}</span>{/if} {sport.label}
                <button
                  class="toggle"
                  class:on
                  role="switch"
                  aria-label={sport.label}
                  aria-checked={on}
                  onclick={() => toggleSport(sport.id)}
                  disabled={notifStore.loading}
                >
                  <span class="toggle-thumb"></span>
                </button>
              </label>
            {/each}
          </section>
        {/if}
        <button class="sheet-destructive" onclick={handleDisable} disabled={notifStore.loading}>
          {notifStore.loading ? 'Turning off…' : 'Turn off all alerts'}
        </button>
      {:else}
        <!-- Unsubscribed empty state -->
        <div class="sheet-empty-state">
          <div class="sheet-empty-icon">🔔</div>
          <h3>Stay in the loop</h3>
          <p>Get a heads-up ~30 min before Open Gym{gymState?.nextOpenGym ? ` at ${gymState.nextOpenGym.start}` : ''}, or before specific sports.</p>
          <button
            class="sheet-enable-btn"
            onclick={onEnableClick}
            disabled={notifStore.loading}
          >
            {notifStore.loading ? 'Enabling…' : 'Turn on notifications'}
          </button>
          <p class="sheet-fine-print">Manage anytime via the 🔔 button above.</p>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .sheet-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 60;
  }

  .sheet-panel {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 61;
    border-radius: 20px 20px 0 0;
    max-height: 85dvh;
    overflow-y: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    background: var(--color-bg);
  }

  .sheet-handle {
    width: 36px;
    height: 4px;
    background: var(--color-border);
    border-radius: 2px;
    margin: 12px auto 0;
  }

  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px 8px;
  }

  .sheet-title {
    font-size: 1.1rem;
    font-weight: 700;
    margin: 0;
  }

  .sheet-close {
    width: 44px;
    height: 44px;
    border: none;
    background: var(--color-surface);
    border-radius: 50%;
    cursor: pointer;
    font-size: 0.9rem;
    color: var(--color-text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .sheet-content {
    padding: 8px 20px 32px;
  }

  .sheet-error {
    background: var(--color-closed-bg);
    border: 1px solid var(--color-closed-border);
    color: var(--color-closed);
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 0.875rem;
    margin-bottom: 12px;
  }

  .sheet-loading {
    text-align: center;
    padding: 32px;
    color: var(--color-text-secondary);
  }

  .sheet-empty-state {
    text-align: center;
    padding: 24px 8px;
  }

  .sheet-empty-icon {
    font-size: 2.5rem;
    margin-bottom: 12px;
  }

  .sheet-empty-state h3 {
    font-size: 1.1rem;
    font-weight: 700;
    margin: 0 0 8px;
  }

  .sheet-empty-state p {
    font-size: 0.9rem;
    color: var(--color-text-secondary);
    margin: 0 0 16px;
  }

  .sheet-enable-btn {
    display: block;
    width: 100%;
    padding: 12px 16px;
    background: var(--color-accent, #3182ce);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    margin-bottom: 12px;
    min-height: 44px;
  }

  .sheet-enable-btn:hover:not(:disabled) {
    background: var(--color-accent-hover, #2b6cb0);
  }

  .sheet-enable-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .sheet-fine-print {
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    margin: 0;
  }

  .sheet-section {
    margin-bottom: 24px;
  }

  .sheet-section-title {
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-secondary);
    margin: 0 0 8px;
  }

  .sheet-toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 0;
    font-size: 0.95rem;
    border-bottom: 1px solid var(--color-border);
    gap: 12px;
  }

  .sheet-toggle-row:last-of-type {
    border-bottom: none;
  }

  /* iOS-style toggle */
  .toggle {
    width: 51px;
    height: 31px;
    border-radius: 16px;
    border: none;
    background: var(--color-border);
    position: relative;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.2s;
    -webkit-tap-highlight-color: transparent;
  }

  .toggle.on {
    background: #48bb78;
  }

  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 27px;
    height: 27px;
    border-radius: 50%;
    background: white;
    transition: transform 0.2s;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }

  .toggle.on .toggle-thumb {
    transform: translateX(20px);
  }

  .toggle:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (prefers-reduced-motion: reduce) {
    .toggle,
    .toggle-thumb {
      transition: none;
    }
  }

  .sheet-destructive {
    border: 1px solid var(--color-closed-border);
    background: var(--color-closed-bg);
    color: var(--color-closed);
    border-radius: 8px;
    padding: 12px 16px;
    width: 100%;
    cursor: pointer;
    margin-top: 16px;
    font-size: 0.9rem;
    min-height: 44px;
  }

  .sheet-destructive:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
