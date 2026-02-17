<script lang="ts">
  import { untrack } from 'svelte';
  import type { GymState } from './types.js';
  import { formatCountdown, getStatusConfig } from './time.js';
  import { activityEmoji } from './emoji.js';

  let { gymState }: { gymState: GymState } = $props();

  let countdownMs = $state(0);

  // Sync from gymState when it drifts by more than 3s (avoids resetting on every 10s refresh)
  $effect(() => {
    const incoming = gymState.countdownMs;
    const current = untrack(() => countdownMs);
    const diff = Math.abs(incoming - current);
    if (diff > 3000 || current === 0) {
      countdownMs = incoming;
    }
  });

  // Independent 1-second tick (only runs when there's something to count down)
  $effect(() => {
    if (countdownMs <= 0) return;
    const interval = setInterval(() => {
      countdownMs = Math.max(0, countdownMs - 1000);
    }, 1000);
    return () => clearInterval(interval);
  });

  const statusConfig = $derived(getStatusConfig(gymState.status));
</script>

<div
  class="status-card {statusConfig.cssClass}"
  role="status"
  aria-live="polite"
  aria-label={statusConfig.ariaLabel}
>
  <div class="status-header">
    <span class="status-icon" aria-hidden="true">{statusConfig.icon}</span>
    <span class="status-label">{statusConfig.label}</span>
  </div>

  {#if gymState.status === 'available' && gymState.currentActivity && gymState.currentActivity.name !== 'Open Gym'}
    {@const emoji = activityEmoji(gymState.currentActivity.name)}
    <p class="status-detail">{#if emoji}<span class="activity-emoji" aria-hidden="true">{emoji}</span> {/if}{gymState.currentActivity.name} right now</p>
  {:else if gymState.status === 'in-use' && gymState.currentActivity}
    {@const emoji = activityEmoji(gymState.currentActivity.name)}
    <p class="status-detail">{#if emoji}<span class="activity-emoji" aria-hidden="true">{emoji}</span> {/if}{gymState.currentActivity.name} until {gymState.currentActivity.end}</p>
  {/if}

  {#if countdownMs > 0}
    <p class="countdown" aria-label="Countdown: {formatCountdown(countdownMs)}">
      <span class="live-dot" aria-hidden="true"></span>
      {#if gymState.status === 'available' && gymState.currentActivity}
        {formatCountdown(countdownMs)} left
      {:else if gymState.status === 'available'}
        Starts in {formatCountdown(countdownMs)}
      {:else if gymState.status === 'in-use' && gymState.nextOpenGym && !gymState.nextOpenGymDay}
        Next up in {formatCountdown(countdownMs)}
      {:else if gymState.status === 'in-use' && gymState.nextOpenGymDay && gymState.currentActivity}
        Closes in {formatCountdown(countdownMs)}
      {:else if gymState.status === 'in-use' && gymState.nextOpenGymDay}
        Next up in {formatCountdown(countdownMs)}
      {:else if gymState.status === 'closed'}
        Opens in {formatCountdown(countdownMs)}
      {:else}
        {formatCountdown(countdownMs)}
      {/if}
    </p>
  {/if}

  {#if gymState.status === 'available' && gymState.currentActivity}
    <p class="status-subtext">{gymState.countdownLabel}</p>
  {:else if gymState.status === 'in-use' && gymState.nextOpenGym && gymState.nextOpenGymDay}
    <p class="status-subtext">Next Open Gym: {gymState.nextOpenGymDay} at {gymState.nextOpenGym.start}</p>
  {:else if gymState.status === 'in-use' && gymState.nextOpenGym}
    <p class="status-subtext">Next: Open Gym at {gymState.nextOpenGym.start}</p>
  {:else if gymState.status === 'in-use' && !gymState.nextOpenGym}
    <p class="status-subtext">No more open gym this week</p>
  {:else if gymState.status === 'closed' && gymState.nextOpenDay}
    <p class="status-subtext">
      {gymState.countdownLabel}{#if gymState.nextOpenGym && gymState.nextOpenGymDay === gymState.nextOpenDay} · Open Gym at {gymState.nextOpenGym.start}{/if}
    </p>
    {#if gymState.nextOpenGymDay && gymState.nextOpenGym && gymState.nextOpenGymDay !== gymState.nextOpenDay}
      <p class="status-subtext-secondary">First Open Gym: {gymState.nextOpenGymDay} at {gymState.nextOpenGym.start}</p>
    {/if}
  {/if}
</div>

<style>
  .status-card {
    border-radius: var(--radius);
    padding: 24px;
    text-align: center;
    border-left: 4px solid;
    margin-bottom: 24px;
    transition: background-color 0.4s ease, border-color 0.4s ease;
  }

  .status-card.available {
    background: var(--color-available-bg);
    border-color: var(--color-available);
  }

  .status-card.in-use {
    background: var(--color-inuse-bg);
    border-color: var(--color-inuse);
  }

  .status-card.closed {
    background: var(--color-closed-bg);
    border-color: var(--color-closed);
  }

  .status-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    margin-bottom: 8px;
  }

  .status-icon {
    font-size: 1.5rem;
    line-height: 1;
  }

  .available .status-icon { color: var(--color-available); }
  .in-use .status-icon { color: var(--color-inuse); }
  .closed .status-icon { color: var(--color-closed); }

  .status-label {
    font-size: 1.25rem;
    font-weight: 700;
    letter-spacing: 0.05em;
  }

  .available .status-label { color: var(--color-available); }
  .in-use .status-label { color: var(--color-inuse); }
  .closed .status-label { color: var(--color-closed); }

  .status-detail {
    color: var(--color-text-secondary);
    font-size: 0.95rem;
    margin-bottom: 12px;
  }

  .countdown {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    font-size: 2rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    margin-bottom: 4px;
  }

  .live-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentColor;
    flex-shrink: 0;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.3; transform: scale(0.8); }
  }

  .activity-emoji {
    display: inline-block;
    font-size: 1.1em;
    line-height: 1;
    vertical-align: middle;
    margin-right: 4px;
    animation: emoji-breathe 3s ease-in-out infinite;
  }

  @keyframes emoji-breathe {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.12); }
  }

  @media (prefers-reduced-motion: reduce) {
    .live-dot {
      animation: none;
      opacity: 0.6;
    }
    .activity-emoji {
      animation: none;
    }
  }

  .available .countdown { color: var(--color-available); }
  .in-use .countdown { color: var(--color-inuse); }
  .closed .countdown { color: var(--color-closed); }

  .status-subtext {
    color: var(--color-text-secondary);
    font-size: 0.95rem;
  }

  .status-subtext-secondary {
    color: var(--color-text-secondary);
    font-size: 0.8rem;
    margin-top: 4px;
  }

  @media (prefers-color-scheme: dark) {
    .status-detail,
    .status-subtext,
    .status-subtext-secondary {
      color: rgba(255, 255, 255, 0.85);
    }
  }
</style>
