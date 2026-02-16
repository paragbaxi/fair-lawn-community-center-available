<script lang="ts">
  import type { GymState } from './types.js';
  import { formatCountdown } from './time.js';
  import { getEasternNow } from './time.js';
  import { activityEmoji } from './emoji.js';
  import { getTimeBucket, buildCandidatePool, pickMessage, type TimeBucket, type MessageData } from './motivational.js';

  let { gymState, messages }: { gymState: GymState; messages: MessageData | null } = $props();

  let countdownMs = $state(0);
  let currentBucket = $state<TimeBucket | null>(null);
  let motivationalMessage = $state('');

  $effect(() => {
    countdownMs = gymState.countdownMs;
    const interval = setInterval(() => {
      countdownMs = Math.max(0, countdownMs - 1000);
    }, 1000);
    return () => clearInterval(interval);
  });

  const bucket = $derived(
    gymState.status === 'available' && countdownMs > 60_000
      ? getTimeBucket(countdownMs)
      : null
  );

  $effect(() => {
    if (bucket === null || !messages) {
      currentBucket = null;
      motivationalMessage = '';
      return;
    }
    if (bucket !== currentBucket) {
      currentBucket = bucket;
      const now = getEasternNow();
      const pool = buildCandidatePool(
        messages, bucket, gymState.dayName,
        now.getMonth() + 1, now.getDate()
      );
      motivationalMessage = pickMessage(pool);
    }
  });

  const statusConfig = $derived.by(() => {
    switch (gymState.status) {
      case 'available':
        return {
          icon: '\u2713',
          label: 'GYM AVAILABLE',
          cssClass: 'available',
          ariaLabel: 'Gym is available for open play',
        };
      case 'in-use':
        return {
          icon: '\u23F3',
          label: 'GYM IN USE',
          cssClass: 'in-use',
          ariaLabel: 'Gym is currently in use for a scheduled activity',
        };
      case 'closed':
        return {
          icon: '\u2715',
          label: 'CLOSED',
          cssClass: 'closed',
          ariaLabel: 'Community center is currently closed',
        };
    }
  });
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

  {#if gymState.status === 'available' && gymState.currentActivity}
    {@const emoji = activityEmoji(gymState.currentActivity.name)}
    <p class="status-detail">{#if emoji}<span class="activity-emoji" aria-hidden="true">{emoji}</span> {/if}{gymState.currentActivity.name} right now</p>
  {:else if gymState.status === 'in-use' && gymState.currentActivity}
    {@const emoji = activityEmoji(gymState.currentActivity.name)}
    <p class="status-detail">{#if emoji}<span class="activity-emoji" aria-hidden="true">{emoji}</span> {/if}{gymState.currentActivity.name} until {gymState.currentActivity.end}</p>
  {/if}

  {#if countdownMs > 0}
    <p class="countdown" aria-label="Time remaining: {formatCountdown(countdownMs)}">
      <span class="live-dot" aria-hidden="true"></span>
      {#if gymState.status === 'available'}
        {formatCountdown(countdownMs)} left
      {:else if gymState.status === 'in-use' && gymState.nextOpenGym}
        Available in {formatCountdown(countdownMs)}
      {:else if gymState.status === 'closed'}
        Opens in {formatCountdown(countdownMs)}
      {:else}
        {formatCountdown(countdownMs)}
      {/if}
    </p>
  {/if}

  {#if gymState.status === 'available' && gymState.currentActivity}
    <p class="status-subtext">{gymState.countdownLabel}</p>
  {:else if gymState.status === 'in-use' && gymState.nextOpenGym}
    <p class="status-subtext">Next: Open Gym at {gymState.nextOpenGym.start}</p>
  {:else if gymState.status === 'in-use' && !gymState.nextOpenGym}
    <p class="status-subtext">No more open gym today</p>
  {:else if gymState.status === 'closed' && gymState.nextOpenDay}
    <p class="status-subtext">{gymState.countdownLabel}</p>
  {/if}

  {#if motivationalMessage}
    <p class="motivational-message" aria-hidden="true">
      {motivationalMessage}
    </p>
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
    font-size: 0.85rem;
  }

  .motivational-message {
    color: var(--color-text-secondary);
    font-size: 0.85rem;
    font-style: italic;
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid var(--color-available-border);
    line-height: 1.4;
  }

  @media (prefers-color-scheme: dark) {
    .status-detail,
    .status-subtext,
    .motivational-message {
      color: rgba(255, 255, 255, 0.85);
    }
  }
</style>
