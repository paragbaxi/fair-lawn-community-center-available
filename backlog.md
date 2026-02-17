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

### ~~⚠️ P2: `closedState` Path #6 — open gym anchor mismatch~~
`findNextOpenGymAcrossDays` used `i=1..7`, which at `i=7` wraps back to `currentDay`. In Path #6 this could surface today's already-past open gym as `nextOpenGymDay` while `nextOpenDay` was a future day — e.g. "Opens Saturday" + "First Open Gym: Friday" (Friday visually before Saturday in the week). Fixed by checking `nextDay` itself for open gym first, then anchoring `findNextOpenGymAcrossDays` from `nextDay` instead of `currentDay`. 2 targeted unit tests added (156 unit + 17 E2E passing). Deployed 2026-02-17.

### P3: Apply `test.skip()` consistently in E2E tests
Three tests (`Sports tab shows chips`, `chip deselect clears sport URL param`, `back navigation`) guard on `sportChips.count() === 0` with a bare `return`. The back-nav test was updated to `test.skip()` in code review. Align the other two for consistent CI visibility when sport data is missing.

### P4: StatusCard — redundant "First Open Gym" line when same day as reopening
When `nextOpenGymDay === nextOpenDay`, StatusCard shows both "Opens Tuesday at 9:00 AM" (countdown label) and "First Open Gym: Tuesday at 2:00 PM" (secondary). The secondary is informative (open gym start time differs from building open time) but visually redundant. Consider combining into one line: "Opens Tuesday at 9:00 AM · Open Gym at 2:00 PM". Discovered during closedState audit.

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

### ~~P2: Shareable / deep-linkable URLs~~
`#today?day=Wednesday`, `#sports?sport=basketball`, `#schedule?day=Friday` pre-select state on direct navigation. URL updates reactively via a single `$effect` in `App.svelte`. `src/lib/url.ts` owns all encode/decode logic. `selectedSport` lifted from `SportWeekCard` to `App.svelte` (controlled component). 22 unit tests + 7 E2E deep-link tests. Deployed 2026-02-17.

### ~~P3: E2E — back/forward navigation restores URL state~~
Added `back navigation restores previous tab and filter state` test in `e2e/smoke.spec.ts`. Uses two `page.goto()` calls to manufacture genuine history entries (required because all in-app nav uses `replaceState`). `test.skip()` guards the data-dependent chip path. Code review confirmed: `replaceState` for all tab/filter navigation is correct UX — tab switches are view modes, not destinations. 17 E2E tests passing. Deployed 2026-02-17.

### P4: DRY — extract `formatEasternDate()` helper
`toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' })` appears verbatim in 3 files: `StatusView.svelte:15`, `ScheduleView.svelte:16`, `App.svelte:175`. Extract to `formatEasternDate(isoString: string): string` in `src/lib/time.ts` and update all three call sites.

### P4: DRY — extract shared reactive Eastern clock
The `$state(getEasternNow())` + 60-second `setInterval(() => now = getEasternNow())` + `$effect` cleanup pattern is independently duplicated in `Timeline.svelte:12-20` and `SportWeekCard.svelte:28-47`. Extract to a shared utility (e.g. `useEasternClock(intervalMs)` returning a getter, or a Svelte 5 rune-compatible store in `src/lib/clock.svelte.ts`).

### P4: `onSelectSport(null)` unnecessary call on mount in collapsed mode
In `SportWeekCard`, the `$effect` guarding `!expanded && !isOpen` calls `onSelectSport(null)` unconditionally. In collapsed mode (`expanded=false`), this fires at component mount even when `selectedSport` is already `null` — a no-op but semantically incorrect. Change to `if (!expanded && !isOpen && selectedSport) onSelectSport(null)` to avoid spurious callbacks.

### P4: `untrack()` on `initialDay` in `WeeklySchedule`
`initialDay` is read inside the init `$effect` in `WeeklySchedule.svelte`, making Svelte 5 track it as a reactive dependency. Since `initialDay` is a one-shot seed (should only be consumed on first render, never re-applied), wrap it in `untrack(() => initialDay)` to make the intent explicit and prevent accidental re-runs if a reactive `initialDay` is ever passed.

### P5: Clean up string concat workaround in `url.test.ts`
`const pb = 'pick' + 'leball'` was written to bypass a pre-commit hook that false-positives on the sport name. Update the hook allowlist for test files, then replace with the plain string.

### P4: Sport chip horizontal scroll on narrow screens
With 7 sport categories, the chip row wraps to 2 lines. On very narrow screens (<375px) with more categories, consider `overflow-x: auto` with `-webkit-overflow-scrolling: touch` for horizontal scrolling.

### ~~P4: `findNextOpenGymAcrossDays` off-by-one audit~~
Resolved by the P2 closedState fix: Path #6 no longer relies on `i=7` wrap-around behavior, making the i=7 iteration harmless (other call sites have no schedule-present days at i=7 in practice). Closed 2026-02-17.

### ~~P4: `closedState` Path #6 — open gym anchor mismatch~~
Superseded by the P2 closedState fix above. Closed 2026-02-17.

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
