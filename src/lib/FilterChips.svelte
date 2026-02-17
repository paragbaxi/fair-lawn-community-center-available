<script lang="ts">
  import type { FilterCategory } from './filters.js';

  let { filters, activeFilter, onSelectFilter }: {
    filters: FilterCategory[];
    activeFilter: string;
    onSelectFilter: (id: string) => void;
  } = $props();
</script>

<div class="filter-chips" role="group" aria-label="Filter activities">
  {#each filters as filter}
    <button
      class="chip"
      class:active={activeFilter === filter.id}
      aria-pressed={activeFilter === filter.id}
      onclick={() => onSelectFilter(filter.id)}
    >
      {filter.label}
    </button>
  {/each}
</div>

<style>
  .filter-chips {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding: 2px 2px;
    margin-bottom: 16px;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .filter-chips::-webkit-scrollbar {
    display: none;
  }

  .chip {
    flex-shrink: 0;
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 0.9rem;
    font-weight: 500;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text);
    cursor: pointer;
    min-height: 36px;
    white-space: nowrap;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }

  .chip.active {
    background: var(--color-text);
    border-color: var(--color-text);
    color: var(--color-bg);
  }

  .chip:active {
    opacity: 0.8;
  }

  @media (hover: hover) {
    .chip:not(.active):hover {
      background: var(--color-border);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .chip {
      transition: none;
    }
  }
</style>
