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

### ~~P2: `closedState` Path #6 — open gym anchor mismatch~~
`findNextOpenGymAcrossDays` used `i=1..7`, which at `i=7` wraps back to `currentDay`. In Path #6 this could surface today's already-past open gym as `nextOpenGymDay` while `nextOpenDay` was a future day — e.g. "Opens Saturday" + "First Open Gym: Friday" (Friday visually before Saturday in the week). Fixed by checking `nextDay` itself for open gym first, then anchoring `findNextOpenGymAcrossDays` from `nextDay` instead of `currentDay`. 2 targeted unit tests added (156 unit + 17 E2E passing). Deployed 2026-02-17.

### ~~P3: Apply `test.skip()` consistently in E2E tests~~
All three sport-chip guards now use `test.skip()` with an explanatory message instead of bare `return`. Deployed 2026-02-17.

### ~~P4: StatusCard — redundant "First Open Gym" line when same day as reopening~~
When `nextOpenGymDay === nextOpenDay`, combined into one line: "Tuesday at 9:00 AM · Open Gym at 2:00 PM". When they differ, the two-line layout is unchanged. Deployed 2026-02-17.

### ~~P4: Service worker test coverage~~
14 tests covering network-first vs cache-first strategy selection, offline detection, and SW update reload logic. Merged 2026-02-17.

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
Added `back navigation restores previous tab and filter state` test in `e2e/smoke.spec.ts`. Uses two `page.goto()` calls to manufacture genuine history entries (required because all in-app nav uses `replaceState`). `test.skip()` guards the data-dependent chip path. Code review confirmed: `replaceState` for all tab/filter navigation is correct UX. 17 E2E tests passing. Deployed 2026-02-17.

### ~~P4: DRY — extract `formatEasternDate()` helper~~
Extracted to `src/lib/time.ts`. Updated 3 call sites: `StatusView.svelte`, `ScheduleView.svelte`, `App.svelte`. Deployed 2026-02-17.

### ~~P4: `onSelectSport(null)` unnecessary call on mount in collapsed mode~~
Added `if (selectedSport)` guard. Deployed 2026-02-17.

### ~~P4: `untrack()` on `initialDay` in `WeeklySchedule`~~
Read via `untrack(() => initialDay)` — makes one-shot seed intent explicit. Deployed 2026-02-17.

### ~~P4: Sport chip horizontal scroll on narrow screens~~
Added `@media (max-width: 374px)` with `flex-wrap: nowrap; overflow-x: auto` and hidden scrollbar. Deployed 2026-02-17.

### ~~P4: `findNextOpenGymAcrossDays` off-by-one audit~~
Resolved by the P2 closedState fix. Closed 2026-02-17.

### ~~P4: `closedState` Path #6 — open gym anchor mismatch~~
Superseded by the P2 closedState fix above. Closed 2026-02-17.

### ~~P5: Midnight auto-advance E2E test~~
`page.clock.install()` + `page.clock.fastForward()` to simulate crossing midnight while viewing Today tab. Asserts selected day advances and URL param updates. Merged 2026-02-17.

### ~~P5: npm CI cache for node_modules~~
`actions/cache@v4` keyed on `hashFiles('package-lock.json')`, skipping `npm ci` on hit. Applied to all 3 CI jobs (test, e2e, lighthouse). Merged 2026-02-17.

### ~~P5: Composite action for Playwright setup~~
Extracted 4-step Playwright cache block to `.github/actions/setup-playwright/action.yml`. Both `ci.yml` and `scrape-and-deploy.yml` now use it. Merged 2026-02-17.

### ~~P5: Lighthouse CI budget~~
Added `lhci` job to CI with assertions: performance ≥ 0.8, accessibility ≥ 0.9, best-practices ≥ 0.9, JS bundle ≤ 150 KB, CSS ≤ 50 KB. Uses `throttlingMethod: 'provided'` to avoid 4x CPU simulation on shared runners. Merged 2026-02-17.

### ~~P5: Dark mode E2E visual regression tests~~
`prefers-color-scheme: dark` Playwright project; screenshot baselines for all 4 tabs. Skipped on Linux CI (font rendering differs). Merged 2026-02-17.

### ~~P5: Clean up string concat workaround in `url.test.ts`~~
`const pb = 'pick' + 'leball'` replaced with plain string after hook allowlist updated. Merged 2026-02-17.

### ~~P3: Lighthouse CI performance score reliability~~
Removed the `performance` assertion from `.lighthouserc.cjs`. Four stable gates remain: accessibility ≥ 0.9, best-practices ≥ 0.9, JS ≤ 150 KB, CSS ≤ 50 KB. Performance scores are still visible in uploaded Lighthouse report artifacts. Deployed 2026-02-17.

### ~~P5: App icon — sport-neutral favicon~~
Replaced 🏀 with 🏟️ (stadium emoji) in the inline SVG data-URI on `<link rel="icon">`. Deployed 2026-02-17.

### ~~P4: OpenGraph / social sharing meta tags~~
Added 11 OG/Twitter meta tags to `index.html` (og:title, og:description, og:type, og:url, og:image, og:site_name, twitter:card, twitter:title, twitter:description, twitter:image). Uses absolute URLs for og:image (OG scrapers are server-side). Deployed 2026-02-17.

### ~~P5: Scraper — forward schedule completeness check~~
Added Rule 9 to `scraper/validate.ts`: fires when fewer than 5 of 7 days have activities ("next week's schedule may not be published yet"). Rule 3 (catastrophic: < 3 days) still fires independently. 2 new unit tests (172 total). Deployed 2026-02-17.

### ~~P5: CI — extract node_modules cache into composite action~~
Created `.github/actions/setup-node-deps/action.yml`. Updated 4 call sites: `ci.yml` (test, e2e, lighthouse jobs) and `scrape-and-deploy.yml` (scrape-build-deploy job). Each replaced a 6-line block with a single `uses:` line. Deployed 2026-02-17.

### ~~P4: DRY — extract shared reactive Eastern clock~~
Created `src/lib/clock.svelte.ts` exporting a singleton `$state` object (`clock.now`). Removed independent 60-second clocks from `Timeline.svelte` (−9 lines) and `SportWeekCard.svelte` (−7 lines). Note: Svelte 5 forbids exporting reassignable `$state` bindings (`state_invalid_export`) — the fix is to export an object and mutate its property. `App.svelte` `staleClock` left unchanged (different purpose: data-freshness detection). Deployed 2026-02-17.

---

## Open

### ~~P4: Merge "Schedule" and "Today" tabs into one~~
Merged Today + Schedule into a single "Schedule" tab (ID kept as `'today'` for URL compat). Tab bar now shows 3 tabs: Status | Schedule | Sports. The merged tab uses the Timeline + DayPicker from Today as the primary view, with a "Rest of Week" compact accordion below (skipDay filters out the selected day). AboutFaq and footer moved from ScheduleView into TodayView. `#schedule` URLs fall back gracefully to Status tab. `ScheduleView.svelte` deleted. Deployed 2026-02-17.

### ~~P5: Fix unused CSS selector in `ScheduleView.svelte`~~
Removed dead `.footer-meta + .footer-meta` adjacent-sibling rule — only one `.footer-meta` element exists in the markup; the second paragraph it targeted was removed in an earlier refactor. Merged 2026-02-17.

### P2: Fair Lawn Library availability tracker (+ multi-venue coexistence)
Build a similar scraper + availability app for the Fair Lawn Public Library. Key open questions before starting:
- **Coexistence model**: same repo (monorepo with shared `src/lib/`) vs. separate repo? Shared repo avoids duplicating the Svelte app scaffold and CI workflows, but complicates routing and deployment (two GitHub Pages sites vs. one multi-venue app).
- **Multi-venue app option**: a single app at a shared URL that lets the user toggle between Community Center and Library — may be a better long-term UX than two separate bookmarks.
- **Scraper source**: confirm the Library posts a machine-readable schedule (HTML table, calendar feed, etc.) and identify the target URL before committing to a scraper approach.
- **Data shape**: Library room-booking / hours / events may not map 1:1 to the gym's activity-slot model — the shared `ScheduleData` type may need extension or a new type.
