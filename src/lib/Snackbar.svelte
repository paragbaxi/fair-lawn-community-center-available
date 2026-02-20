<script lang="ts">
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  let { message, onDismiss }: {
    message: string | null;
    onDismiss: () => void;
  } = $props();

  // Returns 0 when user prefers reduced motion, so transitions are instant
  function dur(ms: number): number {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : ms;
  }

  $effect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, 2500);
    return () => clearTimeout(timer);
  });
</script>

{#if message}
  <div
    class="snackbar"
    role="status"
    aria-live="polite"
    aria-atomic="true"
    transition:fly={{ y: 40, duration: dur(220), easing: cubicOut }}
  >
    {message}
  </div>
{/if}

<style>
  .snackbar {
    position: fixed;
    bottom: calc(56px + env(safe-area-inset-bottom) + 8px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 55;
    pointer-events: none;
    background: var(--color-text);
    color: var(--color-bg);
    padding: 10px 20px;
    border-radius: 24px;
    font-size: 0.875rem;
    font-weight: 500;
    white-space: nowrap;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
</style>
