<script lang="ts">
  import { notifStore, handleEnable } from './notifStore.svelte.js';
  import type { GymState } from './types.js';

  let { gymState, onManageAlerts = () => {} }: {
    gymState: GymState;
    onManageAlerts?: () => void;
  } = $props();

  const ctaLabel = $derived(
    gymState?.nextOpenGym
      ? `Alert me before Open Gym at ${gymState.nextOpenGym.start}`
      : 'Get Open Gym alerts'
  );

  async function onEnableClick() {
    await handleEnable();
    if (notifStore.state === 'subscribed') onManageAlerts();
  }
</script>

{#if !notifStore.initialized || notifStore.state === 'unsupported'}
  <!-- nothing -->
{:else if notifStore.isIos && !notifStore.isStandalone}
  <div class="notif-banner notif-hint">
    <span class="notif-icon">📲</span>
    Add to Home Screen to enable notifications
  </div>
{:else if notifStore.state === 'subscribed'}
  <button class="notif-row-btn" onclick={onManageAlerts}>
    <span class="notif-status">Notifications on ✓</span>
    <span class="notif-row-chevron">›</span>
  </button>
{:else if notifStore.state !== 'denied'}
  <button class="notif-enable-btn" onclick={onEnableClick} disabled={notifStore.loading}>
    <span class="notif-icon">🔔</span>
    {notifStore.loading ? 'Enabling…' : ctaLabel}
  </button>
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

  .notif-icon {
    font-size: 1.1rem;
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
    border-radius: 8px;
    margin-top: 16px;
    min-height: 44px;
  }

  .notif-enable-btn:hover:not(:disabled) {
    background: var(--color-accent-hover, #2b6cb0);
  }

  .notif-enable-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .notif-row-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 10px 14px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-surface);
    cursor: pointer;
    font-size: 0.9rem;
    margin-top: 16px;
    min-height: 44px;
  }

  .notif-status {
    color: var(--color-success, #38a169);
    font-weight: 500;
  }

  .notif-row-chevron {
    color: var(--color-text-secondary);
    font-size: 1.2rem;
  }
</style>
