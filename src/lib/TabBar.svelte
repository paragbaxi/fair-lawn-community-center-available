<script lang="ts">
  type TabId = 'status' | 'today' | 'sports' | 'schedule';

  let { activeTab, onSelectTab }: {
    activeTab: TabId;
    onSelectTab: (tab: TabId) => void;
  } = $props();

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'status', label: 'Status', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z' },
    { id: 'today', label: 'Today', icon: 'M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z' },
    { id: 'sports', label: 'Sports', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM5.61 16.78C4.6 15.45 4 13.8 4 12s.6-3.45 1.61-4.78L7.8 9.42C7.29 10.2 7 11.07 7 12s.29 1.8.8 2.58l-2.19 2.2zM12 20c-1.8 0-3.45-.6-4.78-1.61l2.2-2.19C10.2 16.71 11.07 17 12 17s1.8-.29 2.58-.8l2.2 2.19C15.45 19.4 13.8 20 12 20zm0-5a3 3 0 110-6 3 3 0 010 6zm6.39 1.78l-2.19-2.2c.51-.78.8-1.65.8-2.58s-.29-1.8-.8-2.58l2.19-2.2C19.4 8.55 20 10.2 20 12s-.6 3.45-1.61 4.78zM12 4c1.8 0 3.45.6 4.78 1.61l-2.2 2.19C13.8 7.29 12.93 7 12 7s-1.8.29-2.58.8L7.22 5.61C8.55 4.6 10.2 4 12 4z' },
    { id: 'schedule', label: 'Schedule', icon: 'M3 14h4v-4H3v4zm0 5h4v-4H3v4zM3 9h4V5H3v4zm5 5h14v-4H8v4zm0 5h14v-4H8v4zM8 5v4h14V5H8z' },
  ];

  function handleKeydown(e: KeyboardEvent) {
    const idx = tabs.findIndex(t => t.id === activeTab);
    let newIdx = idx;

    if (e.key === 'ArrowRight') {
      newIdx = (idx + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      newIdx = (idx - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      newIdx = 0;
    } else if (e.key === 'End') {
      newIdx = tabs.length - 1;
    } else {
      return;
    }

    e.preventDefault();
    onSelectTab(tabs[newIdx].id);
    // Focus the new tab button
    const btn = document.getElementById(`tab-${tabs[newIdx].id}`);
    btn?.focus();
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<nav class="tab-bar" role="tablist" aria-label="Main navigation" onkeydown={handleKeydown}>
  {#each tabs as tab}
    <button
      id="tab-{tab.id}"
      class="tab-btn"
      class:active={activeTab === tab.id}
      role="tab"
      aria-selected={activeTab === tab.id}
      aria-controls="panel-{tab.id}"
      tabindex={activeTab === tab.id ? 0 : -1}
      onclick={() => onSelectTab(tab.id)}
    >
      <svg class="tab-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d={tab.icon} />
      </svg>
      <span class="tab-label">{tab.label}</span>
    </button>
  {/each}
</nav>

<style>
  .tab-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 50;
    display: flex;
    justify-content: space-around;
    align-items: stretch;
    height: calc(56px + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    background: var(--color-bg);
    border-top: 1px solid var(--color-border);
  }

  .tab-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    border: none;
    background: none;
    color: var(--color-text-secondary);
    cursor: pointer;
    padding: 6px 0;
    min-height: 44px;
    -webkit-tap-highlight-color: transparent;
    transition: color 0.15s;
  }

  .tab-btn.active {
    color: var(--color-available);
  }

  @media (hover: hover) {
    .tab-btn:not(.active):hover {
      color: var(--color-text);
    }
  }

  .tab-icon {
    width: 24px;
    height: 24px;
  }

  .tab-label {
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  @media (prefers-reduced-motion: reduce) {
    .tab-btn {
      transition: none;
    }
  }
</style>
