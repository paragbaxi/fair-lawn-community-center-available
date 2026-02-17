# Backlog

## Done

### ~~P1: Improve timeline bar segment contrast in dark mode~~
Bumped past segment opacity (open-gym 0.3→0.45, scheduled 0.25→0.4). Deployed 2026-02-15.

### ~~P1: Add PWA support (install to home screen)~~
Added manifest.json, service worker, and app icons. Deployed 2026-02-15.

### ~~P4: PWA offline support~~
Rewrote service worker with real caching (network-first HTML/data, cache-first hashed assets), added offline banner, auto-reload on SW update, enhanced manifest. Deployed 2026-02-16.

### ~~P2: Unofficial disclaimer with link to official site~~
Added disclaimer paragraph in footer with link to Borough of Fair Lawn. Deployed 2026-02-15.

### ~~P2: Auto-refresh live data~~
Extracted loadSchedule() and added visibilitychange listener to refresh after 5+ min away. Deployed 2026-02-15.

### ~~P3: Mobile timeline list — show end times~~
Added end times with ndash separator, adjusted min-width and font-size. Deployed 2026-02-15.

### ~~P3: Deployment cache busting~~
Resolved by P4 PWA offline support — service worker uses network-first for HTML and data, cache-first for hashed assets. Users get fresh content on every online visit.

### ~~P5: Accessibility audit & unit testing setup~~
Skip link, focus-visible styles, color contrast verification (all pass WCAG AA). Vitest with 62 tests for time.ts, emoji.ts, motivational.ts. Merged 2026-02-16.

### ~~P2: Subtle activity emoji animations~~
StatusCard already has `emoji-breathe` animation (scale 1→1.12, 3s, with `prefers-reduced-motion` support). WeeklySchedule intentionally omits animation — animating dozens of emojis in a static list would be distracting. Done.

### ~~P3: CI — run tests on push~~
Added `.github/workflows/ci.yml` with parallel `test` (vitest + build) and `e2e` (Playwright) jobs. Triggers on push/PR to main, ignores `public/data/**` bot commits. Merged 2026-02-16.

### ~~P4: Scraper test coverage~~
Extracted pure parsing functions to `scraper/parse.ts`, deduplicated types (imports from `src/lib/types.ts`), fixed `parseHeaderDate` TZ/year-boundary bugs. Added ~32 tests in `scraper/parse.test.ts` with committed fixture (`scraper/fixtures/page.txt`). Merged 2026-02-16.

### ~~P4: E2E smoke test with Playwright~~
Added `@playwright/test`, `playwright.config.ts`, and 4 E2E smoke tests in `e2e/smoke.spec.ts`: page load, status card render, skip link focus, weekly schedule toggle. Uses `vite preview` for production-like testing. Merged 2026-02-16.

### ~~P5: `computeGymState` gap behavior refinement~~
Won't fix. The scraper fills all gaps within open gym ranges with "Open Gym" slots, so gaps in `computeGymState` only occur when no open gym range is defined — an edge case that doesn't happen with real data. Current behavior (countdown to next activity) is reasonable.

### ~~P3: Scraper resilience monitoring~~
Added `scraper/validate.ts` with 8 validation rules (timestamp, day completeness, activity counts, time format/logic). Scraper exits non-zero on failure, preventing bad data from being committed. Workflow creates/updates a GitHub issue on failure with deduplication. 13 unit tests in `scraper/validate.test.ts`. Deployed 2026-02-16.

### ~~P4: Playwright browser caching in CI~~
Cache `~/.cache/ms-playwright` with `actions/cache@v4` keyed on exact Playwright version. On cache hit, only install OS deps (`install-deps`); on miss, full `install --with-deps`. Applied to both `ci.yml` and `scrape-and-deploy.yml`. Merged 2026-02-16.

### ~~P2: Day picker, filter chips, and activity filtering~~
DayPicker (Mon-Sun selector), FilterChips (sport/activity filtering with graceful fallback when no matches), shared `DISPLAY_DAYS` constant, stale-today prop threading, midnight auto-advance, tennis regex fix, emoji coverage for Tennis/Youth. 152 unit tests, 8 E2E tests. Merged 2026-02-16.

### ~~P2: SportWeekCard — "When can I play...?"~~
Expandable card answering "When can I play [sport] this week?" with three states: collapsed → sport chip picker → week summary with day grouping, NOW badge, past/current styling. Resets selection on close. Derived from `SPORT_CATEGORIES` (filters.ts). Merged 2026-02-16.

### ~~P2: Cross-day next open gym in StatusCard~~
When all today's open gym slots are past, StatusCard now shows "Next Open Gym: [Day] at [Time]" instead of a dead-end "No more open gym today." Updated all 7 GymState return paths with `nextOpenGymDay` field. Also shows "First Open Gym" secondary line when closed after hours. 13 dedicated cross-day unit tests. Merged 2026-02-16.

### ~~P1: Tab-based navigation with 4 dedicated persona views~~
Restructured the entire app from a single scrolling page into 4 tab-based views: Status ("Is it open?"), Today ("What's the schedule?"), Sports ("When can I play X?"), Schedule ("Show me everything"). Bottom tab bar with roving tabindex, hash routing, CompactStatus strip, accordion schedule, persistent sport chips. Deleted FilterChips, UpNext, motivational.ts. 7 code review iterations fixed: ARIA tablist nesting, tick() focus timing, untrack() countdown sync, countdown label accuracy for between-activity states, Eastern timezone notice filtering, reactive dateRange, WeeklySchedule grammar. 132 unit tests, 9 E2E tests. Deployed 2026-02-17.

## Open

### P4: Service worker test coverage
The service worker has meaningful logic (network-first vs cache-first strategy, offline detection, auto-reload on update) but no tests. Add vitest tests to verify the caching strategy selection logic.

### ~~P3: E2E — timeline content verification on day switch~~
After clicking a different day, assert `.timeline-day` header text changes (with null guard) and at least one `.list-item` is visible when activities exist. Deployed 2026-02-17.

### ~~P3: E2E — Sports tab week summary content verification~~
After clicking a sport chip, assert result-row contains day abbreviation, en-dash time range, and activity name; click same chip to deselect and assert hint text reappears. Deployed 2026-02-17.

### ~~P3: `getEasternNow()` spec-safety~~
Replaced `toLocaleString` + `new Date(str)` with `Intl.DateTimeFormat.formatToParts()` using `hourCycle: 'h23'`. All 41 time tests pass. Deployed 2026-02-17.

### ~~P3: `isStale` derived doesn't re-evaluate over time~~
Added `let staleClock = $state(Date.now())` with hourly `setInterval` in `$effect`. `isStale` now reads `staleClock` instead of non-reactive `Date.now()`. Deployed 2026-02-17.

### P2: Shareable / deep-linkable URLs
Currently the URL stays at `#sports` even when a sport chip is selected — sharing the link loses the filter context. Users want to share things like "when can I play [sport] this week?" with a friend and have the URL pre-select that state. Full design reviewed by agent 2026-02-17.

**Complete URL pattern catalog:**
```
#status                      (existing, no change)
#today                       (existing, no change)
#today?day=Wednesday         (pre-select a day in Today tab)
#sports                      (existing, no change)
#sports?sport=basketball     (pre-select a sport chip)
#sports?sport=volleyball
#sports?sport=table-tennis
#sports?sport=badminton
#sports?sport=tennis
#sports?sport=youth
#schedule                    (existing, no change)
#schedule?day=Friday         (pre-expand a day in Schedule accordion)
```
Valid sport IDs come from `FilterCategory.id` in `filters.ts`. Valid day values are the 7 full day names from `DISPLAY_DAYS` (case-insensitive on parse, stored canonical).

**Design principles:**
- One shared utility `src/lib/url.ts` — `parseUrlState()` and `buildUrlHash()` — no component parses `location.hash` directly for sub-params (DRY)
- Graceful degrade: unknown sport/day → default state, no errors; `#schedule?day=Funday` → today expanded
- Bookmarkable and shareable; works on direct navigation; GitHub Pages hash routing unaffected
- `history.replaceState` (not `pushState`) to avoid polluting recipient's history
- No external library; `URLSearchParams` built-in suffices

**State ownership changes:**
- `selectedSport` must be lifted from `SportWeekCard.svelte` (currently local `$state`) up to `App.svelte` so App can encode/decode it
- `WeeklySchedule.svelte` gets a new optional `initialDay` prop to pre-expand a specific day

**Files to create/modify:**
1. **CREATE** `src/lib/url.ts` — `parseUrlState()` (reads `location.hash`, validates, returns `{tab, day, sport}`), `buildUrlHash(tab, opts)` (builds hash string)
2. **MODIFY** `App.svelte` — replace `getTabFromHash()` with `parseUrlState()`, add `selectedSport $state`, add unified `$effect` to call `buildUrlHash` on any state change, update `hashchange` listener
3. **MODIFY** `SportsView.svelte` — accept/forward `selectedSport` + `onSelectSport` props
4. **MODIFY** `SportWeekCard.svelte` — remove local `selectedSport $state`, accept as prop + callback; move stale-sport guard to `App.svelte`
5. **MODIFY** `ScheduleView.svelte` + `WeeklySchedule.svelte` — add `initialDay` prop, seed `expandedDays` with it on init

**Build sequence:** Phase 1 — `url.ts` + unit tests; Phase 2 — lift `selectedSport`; Phase 3 — wire URL encoding; Phase 4 — schedule accordion deep-link; Phase 5 — edge case validation (nonexistent sport ID, tab switch clears irrelevant params, back/forward restores state).

### P4: DRY — extract `formatEasternDate()` helper
`toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' })` appears verbatim in 3 files: `StatusView.svelte:15`, `ScheduleView.svelte:16`, `App.svelte:175`. Extract to `formatEasternDate(isoString: string): string` in `src/lib/time.ts` and update all three call sites.

### P4: DRY — extract shared reactive Eastern clock
The `$state(getEasternNow())` + 60-second `setInterval(() => now = getEasternNow())` + `$effect` cleanup pattern is independently duplicated in `Timeline.svelte:12-20` and `SportWeekCard.svelte:28-47`. Extract to a shared utility (e.g. `useEasternClock(intervalMs)` returning a getter, or a Svelte 5 rune-compatible store in `src/lib/clock.svelte.ts`).

### P4: Sport chip horizontal scroll on narrow screens
With 7 sport categories, the chip row wraps to 2 lines. On very narrow screens (<375px) with more categories, consider `overflow-x: auto` with `-webkit-overflow-scrolling: touch` for horizontal scrolling.

### P4: `findNextOpenGymAcrossDays` off-by-one audit
The function iterates `i = 1..7`, which on `i=7` wraps back to `currentDay` itself — a redundant check since the caller already examined today. Harmless but could be tightened to `i <= 6`. Very low risk.

### P4: `closedState` Path #6 — open gym anchor mismatch
`findNextOpenGymAcrossDays(data, currentDay)` anchors from today, but `nextOpenDay` (first day with any schedule) is found independently. The "Next Open Gym" subtext could show a day that's before the building actually reopens. Low probability with real data but a logic inconsistency.

### P4: Midnight auto-advance E2E test
Auto-advance logic (if viewing "today" and midnight passes, selectedDay advances) is only testable via Playwright clock manipulation (`page.clock`). Low priority since the logic is simple.

### P5: npm CI cache for node_modules
`actions/setup-node` caches `~/.npm` (download cache), but `npm ci` still reinstalls every run. Cache `node_modules` with `actions/cache@v4` keyed on `hashFiles('package-lock.json')` and skip `npm ci` on hit. Modest savings (~5-10s) but follows the same pattern as the Playwright cache.

### P5: Composite action for Playwright setup
Both `ci.yml` and `scrape-and-deploy.yml` have identical 4-step Playwright cache blocks with sync comments. If a third workflow needs Playwright (e.g., Lighthouse CI), extract to `.github/actions/setup-playwright/action.yml`. Not worth it with 2 consumers — revisit if a third is added.

### P5: Lighthouse CI budget
With CI in place, add a Lighthouse budget check to catch performance regressions (bundle size growth, accessibility score drops) automatically on PRs.

### P5: Dark mode E2E visual regression tests
All 4 tabs were visually verified in dark mode during development but have no automated checks. Add Playwright screenshot comparison tests with `prefers-color-scheme: dark` emulation.
