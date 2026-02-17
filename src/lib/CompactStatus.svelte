<script lang="ts">
  import type { GymState } from './types.js';
  import { getStatusConfig } from './time.js';

  let { gymState, onTap }: {
    gymState: GymState;
    onTap: () => void;
  } = $props();

  const config = $derived(getStatusConfig(gymState.status));

  const detail = $derived.by(() => {
    if (gymState.status === 'available' && gymState.currentActivity) {
      return `Open Gym until ${gymState.currentActivity.end}`;
    }
    if (gymState.status === 'in-use' && gymState.currentActivity) {
      return `${gymState.currentActivity.name} until ${gymState.currentActivity.end}`;
    }
    if (gymState.status === 'closed' && gymState.countdownLabel) {
      return `Opens ${gymState.countdownLabel}`;
    }
    return config.label;
  });
</script>

<button
  class="compact-status {config.cssClass}"
  onclick={onTap}
  aria-label="View full status: {detail}"
>
  <span class="status-dot" aria-hidden="true"></span>
  <span class="status-text">{config.label}</span>
  <span class="status-detail">&mdash; {detail}</span>
</button>

<style>
  .compact-status {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 10px 16px;
    border: none;
    border-radius: var(--radius);
    font-size: 0.9rem;
    cursor: pointer;
    min-height: 40px;
    margin-bottom: 12px;
    -webkit-tap-highlight-color: transparent;
    text-align: left;
  }

  .compact-status.available {
    background: var(--color-available-bg);
    color: var(--color-available);
  }

  .compact-status.in-use {
    background: var(--color-inuse-bg);
    color: var(--color-inuse);
  }

  .compact-status.closed {
    background: var(--color-closed-bg);
    color: var(--color-closed);
  }

  @media (hover: hover) {
    .compact-status:hover {
      opacity: 0.85;
    }
  }

  .compact-status:active {
    opacity: 0.7;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentColor;
    flex-shrink: 0;
  }

  .status-text {
    font-weight: 700;
    font-size: 0.85rem;
    letter-spacing: 0.03em;
  }

  .status-detail {
    font-weight: 400;
    font-size: 0.85rem;
    opacity: 0.85;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
