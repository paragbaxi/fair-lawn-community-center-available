# Accessibility Fixes & Testing Setup

## Context
The app has strong a11y foundations (ARIA roles, live regions, `prefers-reduced-motion`, semantic HTML). A codebase audit identified a few gaps to close. Separately, no test infrastructure exists — the core business logic (`time.ts`) should be tested since errors there break everything.

---

## Part 1: Accessibility Fixes

### 1.1 Skip Link
**File:** `src/App.svelte`

Add a visually-hidden skip link as the first element inside `<main>`, targeting `#main-content` on the content area. CSS: positioned off-screen, slides into view on `:focus`.

### 1.2 Focus-Visible Styles
**File:** `src/app.css`

Add global `:focus-visible` styles with `outline: 2px solid` using theme-aware colors. Works in both light and dark mode.

### 1.3 Color Contrast Verification
**Files:** `src/app.css` (if adjustments needed)

Check status label colors against their backgrounds using Lighthouse/DevTools:
- Available: `#16a34a` on `#f0fdf4` (light) / `#4ade80` on `#052e16` (dark)
- In-use: `#d97706` on `#fffbeb` (light) / `#fbbf24` on `#451a03` (dark)
- Closed: `#dc2626` on `#fef2f2` (light) / `#f87171` on `#450a0a` (dark)

If any fail WCAG AA (4.5:1 for normal text, 3:1 for large text), darken the light-mode status colors slightly.

### What we're NOT doing
- **Footer restructuring** — the footer has a few links spread across paragraphs. Adding `<nav>` + `<ul>` adds complexity for minimal benefit given the simple structure.
- **Component-level ARIA changes** — existing roles/labels are already good.

---

## Part 2: Testing Setup

### 2.1 Setup

**Install:** `vitest` (dev dependency only)

**Create `vitest.config.ts`:**
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    env: { TZ: 'America/New_York' },
  },
});
```

The `TZ` env var ensures `getEasternNow()` behaves predictably — consistent results regardless of the machine's local timezone.

**Add scripts to `package.json`:**
- `"test": "vitest run"`
- `"test:watch": "vitest"`

### 2.2 Test Files

#### `src/lib/emoji.test.ts` (simplest — ~15 tests)
Test `activityEmoji()`: known activities, word boundaries (dance vs Advanced, ADA vs Canada), case insensitivity, unknown returns empty string.

#### `src/lib/motivational.test.ts` (~20 tests, needs jsdom for localStorage)
Use `/** @vitest-environment jsdom */` directive.

- **`getTimeBucket()`** — boundary tests at 120/60/30 min
- **`getSeason()`** — month ranges for each season
- **`buildCandidatePool()`** — base messages + weighted contextual messages
- **`pickMessage()`** — picks unseen first, resets when all seen, handles empty pool

#### `src/lib/time.test.ts` (most critical — ~30 tests)
Use `vi.useFakeTimers()` to control `new Date()`.

- **`parseTime()`** — AM/PM, midnight, noon, invalid input
- **`formatCountdown()`** — each tier: >1h, >5min, 1-5min, <1min, 0/negative
- **`computeGymState()`** — the core logic:
  - During Open Gym → `available` with countdown
  - During scheduled activity → `in-use` with next-open info
  - Before/after hours → `closed` with next opening
  - Day with no schedule → `closed`
  - Gap between activities

### 2.3 Testing `computeGymState` Strategy
`computeGymState` calls `getEasternNow()` internally (same-module — can't mock via `vi.spyOn`). Solution: `vi.useFakeTimers()` + `TZ=America/New_York` in vitest config. `vi.setSystemTime()` controls what `new Date()` returns, and the TZ match makes `getEasternNow()`'s timezone conversion an identity transform.

---

## Files Changed

| File | Change |
|---|---|
| `src/App.svelte` | Add skip link + `#main-content` target |
| `src/app.css` | Add `:focus-visible` styles; adjust status colors if contrast fails |
| `vitest.config.ts` | **New** — Vitest configuration |
| `package.json` | Add vitest dep + test scripts |
| `src/lib/emoji.test.ts` | **New** — emoji mapping tests |
| `src/lib/motivational.test.ts` | **New** — message selection tests |
| `src/lib/time.test.ts` | **New** — core time/state logic tests |

## Verification
1. `npm run test` — all tests pass
2. `npm run build` — no errors
3. Playwright: verify skip link visible on Tab, focus outlines visible
4. Lighthouse accessibility score check
