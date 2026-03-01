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
    if (gymState.status === 'opening-soon' && gymState.nextOpenGym) {
      return `Open Gym at ${gymState.nextOpenGym.start}`;
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
  <span class="status-chevron" aria-hidden="true">›</span>
</button>

<style>
  .compact-status {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 10px 16px;
    border: 1px solid transparent;
    border-radius: var(--radius);
    font-size: 0.9rem;
    cursor: pointer;
    min-height: 40px;
    margin-bottom: 12px;
    -webkit-tap-highlight-color: transparent;
    text-align: left;
    transition: background 0.4s ease, opacity 0.15s ease;
  }

  .compact-status.available {
    background: var(--color-available-bg);
    color: var(--color-available);
    border-color: var(--color-available-border);
  }

  .compact-status.in-use {
    background: var(--color-inuse-bg);
    color: var(--color-inuse);
    border-color: var(--color-inuse-border);
  }

  .compact-status.closed {
    background: var(--color-closed-bg);
    color: var(--color-closed);
    border-color: var(--color-closed-border);
  }

  .compact-status.opening-soon {
    background: var(--color-upcoming-bg);
    color: var(--color-upcoming);
    border-color: var(--color-upcoming-border);
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
    animation: dot-pulse 2.5s ease-in-out infinite;
  }

  @keyframes dot-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.75); }
  }

  .status-text {
    font-weight: 700;
    font-size: 0.85rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .status-detail {
    font-weight: 400;
    font-size: 0.85rem;
    opacity: 0.85;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .status-chevron {
    font-size: 1.1rem;
    opacity: 0.5;
    flex-shrink: 0;
  }

  @media (prefers-color-scheme: dark) {
    .compact-status.available    { background: var(--color-available-card-bg); }
    .compact-status.in-use       { background: var(--color-inuse-card-bg); }
    .compact-status.closed       { background: var(--color-closed-card-bg); }
    .compact-status.opening-soon { background: var(--color-upcoming-card-bg); }
  }

  @media (prefers-reduced-motion: reduce) {
    .status-dot { animation: none; }
  }
</style>
