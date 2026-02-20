<script lang="ts">
  import { tick } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { notifStore, savePrefs, toggleSport } from './notifStore.svelte.js';
  import type { FilterCategory } from './filters.js';

  let { open, sport, onClose, onViewAll, onAlertOn }: {
    open: boolean;
    sport: FilterCategory | null;
    onClose: () => void;
    onViewAll: () => void;
    onAlertOn: (msg: string) => void;
  } = $props();

  let panelEl: HTMLDivElement | null = $state(null);
  let ctaButtonEl: HTMLButtonElement | null = $state(null);

  const isOpenGym = $derived(sport?.id === 'open-gym');

  // Returns 0 when user prefers reduced motion, so transitions are instant
  function dur(ms: number): number {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : ms;
  }

  const focusableSelector =
    'button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

  // Body scroll lock + focus trap + Escape key
  $effect(() => {
    if (!open) {
      notifStore.error = null;  // clear error when sheet closes
      return;
    }
    document.body.style.overflow = 'hidden';

    tick().then(() => {
      if (!open) return;
      ctaButtonEl?.focus();
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
      notifStore.error = null;
    };
  });

  // Swipe-down to dismiss
  let touchStartY = 0;
  function onTouchStart(e: TouchEvent) {
    touchStartY = e.touches[0].clientY;
  }
  function onTouchEnd(e: TouchEvent) {
    const deltaY = e.changedTouches[0].clientY - touchStartY;
    if (deltaY > 60) onClose();
  }

  async function handleTurnOn() {
    if (!sport) return;
    if (isOpenGym) {
      await savePrefs({ ...notifStore.prefs, thirtyMin: true });
      // Check pref state directly — do NOT check notifStore.error, which can be cleared
      // by the $effect cleanup if the sheet closes concurrently.
      if (notifStore.prefs.thirtyMin) {
        onAlertOn('Open Gym alerts on');
      }
    } else {
      await toggleSport(sport.id);
      if ((notifStore.prefs.sports ?? []).includes(sport.id)) {
        onAlertOn(`${sport.label} alerts on`);
      }
    }
    // On error: notifStore.error is set; inline error block is shown; sheet stays open for retry
  }
</script>

{#if open}
  <div
    class="ctx-backdrop"
    onclick={onClose}
    role="presentation"
    transition:fade={{ duration: dur(200) }}
  ></div>
  <div
    class="ctx-panel"
    bind:this={panelEl}
    role="dialog"
    aria-modal="true"
    aria-labelledby="ctx-title"
    tabindex="-1"
    ontouchstart={onTouchStart}
    ontouchend={onTouchEnd}
    transition:fly={{ y: 300, duration: dur(300), easing: cubicOut }}
  >
    <div class="ctx-handle" aria-hidden="true"></div>
    <div class="ctx-body">
      <div class="ctx-text">
        <p id="ctx-title" class="ctx-headline">Get notified before {sport?.label}</p>
        <p class="ctx-sub">~30 min heads-up before each session</p>
      </div>
      <div class="ctx-actions">
        {#if notifStore.error}
          <p role="alert" class="ctx-error">{notifStore.error}</p>
        {/if}
        <button
          class="ctx-cta"
          bind:this={ctaButtonEl}
          onclick={handleTurnOn}
          disabled={notifStore.loading}
        >
          {notifStore.loading ? 'Turning on…' : 'Turn on alerts'}
        </button>
        <button
          class="ctx-view-all"
          onclick={onViewAll}
          disabled={notifStore.loading}
        >
          View all alerts
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .ctx-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 60;
  }

  .ctx-panel {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 61;
    height: 140px;
    border-radius: 20px 20px 0 0;
    background: var(--color-bg);
    display: flex;
    flex-direction: column;
  }

  .ctx-handle {
    width: 36px;
    height: 4px;
    background: var(--color-border);
    border-radius: 2px;
    margin: 10px auto 0;
    flex-shrink: 0;
  }

  .ctx-body {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 20px 16px;
    gap: 12px;
    overflow: hidden;
  }

  .ctx-text {
    flex: 1;
    min-width: 0;
  }

  .ctx-headline {
    font-size: 0.95rem;
    font-weight: 600;
    margin: 0 0 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ctx-sub {
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    margin: 0;
  }

  .ctx-actions {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex-shrink: 0;
  }

  .ctx-error {
    font-size: 0.75rem;
    color: var(--color-closed);
    margin: 0;
    text-align: right;
    max-width: 140px;
  }

  .ctx-cta {
    height: 40px;
    padding: 0 16px;
    background: var(--color-accent, #3182ce);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    min-width: 130px;
    -webkit-tap-highlight-color: transparent;
  }

  .ctx-cta:hover:not(:disabled) {
    background: var(--color-accent-hover, #2b6cb0);
  }

  .ctx-cta:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .ctx-view-all {
    height: 36px;
    padding: 0 12px;
    background: none;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    cursor: pointer;
    white-space: nowrap;
    min-width: 130px;
    -webkit-tap-highlight-color: transparent;
  }

  .ctx-view-all:hover:not(:disabled) {
    background: var(--color-surface);
  }

  .ctx-view-all:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
