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

### ~~P4: Merge "Schedule" and "Today" tabs into one~~
Merged Today + Schedule into a single "Schedule" tab (ID kept as `'today'` for URL compat). Tab bar now shows 3 tabs: Status | Schedule | Sports. The merged tab uses the Timeline + DayPicker from Today as the primary view, with a "Rest of Week" compact accordion below (skipDay filters out the selected day). AboutFaq and footer moved from ScheduleView into TodayView. `#schedule` URLs fall back gracefully to Status tab. `ScheduleView.svelte` deleted. Deployed 2026-02-17.

### ~~P5: Fix unused CSS selector in `ScheduleView.svelte`~~
Removed dead `.footer-meta + .footer-meta` adjacent-sibling rule — only one `.footer-meta` element exists in the markup; the second paragraph it targeted was removed in an earlier refactor. Merged 2026-02-17.

### ~~P3: Scraper staleness alerting~~
Added `.github/workflows/freshness-check.yml` — runs daily at 9 AM UTC (4h after scraper), reads `scrapedAt` from `public/data/latest.json`, creates/comments on a `stale-data` issue if age > 26h, and auto-closes it when fresh again. Concurrency group prevents duplicate issues on concurrent `workflow_dispatch` runs. Pure bash + `jq` — no Node.js, ~15s runtime. Deployed 2026-02-17.

### ~~P2: Sport status banner ("Is it on now — and if not, when's next?")~~
Compact status banner between sport chips and the week list in the Sports tab. Three states: **active** (green, mirrors gym StatusCard) — "Basketball is on now — ends at 2:00 PM"; **upcoming-today** (neutral) — "Next Basketball at 5:30 PM today"; **upcoming-week** (neutral) — "Next Basketball: Thu at 5:00 PM". `SportStatus` discriminated union in `types.ts` enables TypeScript narrowing. `computeSportStatus()` accepts `matchFn` callback to avoid circular import with `filters.ts`. 8 unit tests (180 total). Deployed 2026-02-18.

### ~~P2: Scraper `--dry-run` mode~~
`--dry-run` flag runs the full fetch→parse→validate pipeline without writing `public/data/latest.json`. Unknown-flag guard (`--dryrun` etc. exits 1). `ValidationResult` now exposes `stats` (daysWithActivities, totalActivities). `npm run scrape:dry` script added. Verified against live site: 7/7 days, 27 activities, file untouched. Merged 2026-02-17.

### ~~P3: Scraper resilience — handle Fair Lawn site HTML changes (dry-run subitem)~~
Covered by P2 above. Merged 2026-02-17.

### ~~P4: WeeklySchedule `{#if expanded}` wrapper cleanup~~
After the tab merge, `WeeklySchedule` is always called with `expanded={true}`. Removed the `expanded` prop entirely and unwrapped the `{#if expanded}` block. 180 unit tests, 19 E2E tests pass. Deployed 2026-02-17.

### ~~P3: Scraper retry logic~~
Added `gotoWithRetry(page, url, retries=1)` above `scrape()` in `scraper/index.ts`. Each URL gets 1 retry with a 5s wait. The outer per-URL try/catch preserves the "use longest result" strategy. Deployed 2026-02-17.

### ~~P3: Run `scrape:dry` in CI (scheduled parser smoke test)~~
Added `.github/workflows/scraper-smoke.yml` — runs `npm run scrape:dry` daily at 4 AM UTC (1h before the real scrape at 5 AM UTC) and on `workflow_dispatch`. Reuses both composite actions (`setup-node-deps`, `setup-playwright`). `timeout-minutes: 8`. Deployed 2026-02-17.

### ~~P4: DayPicker keyboard navigation~~
Added roving tabindex (ArrowRight/ArrowLeft) with disabled-day skip and `Math.max(0, ...)` fallback for transient -1 focusedIdx. Changed `role="group"` to `role="toolbar"`. Fixed `$state` array to plain `let` for DOM refs. 19 E2E tests pass (including keyboard nav visible in DayPicker test). Deployed 2026-02-17.

### ~~P3: E2E test — sport status banner renders correctly~~
Added `sport status banner renders when a sport chip is selected` test to `e2e/smoke.spec.ts`. Navigates to `#sports?sport=basketball`, asserts `.sport-status-banner` is visible and contains "Basketball", with `.sport-status-dot` visible. `test.skip` guard for no-data case. 19 E2E tests pass. Deployed 2026-02-17.

### ~~P4: "Rest of Week" section — scroll hint on mobile~~
Added `<p class="scroll-hint" aria-hidden="true">↓ Rest of week</p>` in `TodayView.svelte` between the Timeline and the "Rest of Week" heading. CSS-only: `display: none` by default, `display: block` at `max-width: 500px`. Uses `var(--color-text-secondary)`. Deployed 2026-02-17.

### ~~P1: Fix `VAPID_SUBJECT` — not a real email address~~
Changed from `mailto:paragbaxi@github.io` to `https://paragbaxi.github.io/fair-lawn-community-center-available`. Deployed 2026-02-18.

### ~~P1: Worker deploy broken — missing `account_id` in `wrangler.toml`~~
`deploy-worker.yml` had been failing with error 9106 since the worker was added. Root cause: without `account_id`, wrangler calls `GET /user/memberships` to discover the account — a user-level endpoint that an account-scoped API token can't access. Added `account_id = "2a173a2cfd2f56ac9d314d3fcfde4ad6"`. Also committed missing `worker/package-lock.json` (required for `npm ci`), and set a valid `CLOUDFLARE_API_TOKEN` GitHub secret. Worker now live at `https://flcc-push.trueto.workers.dev`. Deployed 2026-02-18.

### ~~P1: Per-sport notification alerts + notification UX overhaul~~
Full notifications system: Cloudflare Worker (`worker/index.ts`) with KV-backed subscriptions, VAPID push, sport-level prefs, daily briefing cron, and `POST /notify` endpoint for both `30min` and `sport-30min` types. Frontend: `notifStore.svelte.ts` module-level $state singleton eliminating triple `onMount` duplication and `localSports` desync; `NotifSheet.svelte` bottom sheet with focus trap, `fly`/`fade` Svelte transitions, iOS-style toggles, error banner, body-scroll lock; bell button in `App.svelte` header with session-scoped pulse dot; `NotificationSettings.svelte` refactored to thin CTA strip; `SportWeekCard.svelte` migrated to notifStore; `check-and-notify.mjs` sends open gym + per-sport 30-min notifications; `push-notify.yml` cron workflow triggers every 30 min; `deploy-worker.yml` auto-deploys worker on `worker/**` push to main. Merged 2026-02-18.

### ~~P1: Set Cloudflare Worker secrets + end-to-end push verification~~
Generated fresh VAPID key pair and hex NOTIFY_API_KEY (`openssl rand -hex 32` — no special chars). Root cause of prior failures: secrets set via `printf "..." | wrangler secret put` had `=`/`/` chars mangled by the zsh pipe; secrets set before the worker existed ("no worker found" warning) didn't persist to the live worker. Fix: all secrets set via heredoc (`<< 'EOF'`) after first successful deploy. Set all three Worker secrets (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NOTIFY_API_KEY`) and matching GitHub secrets (`VITE_VAPID_PUBLIC_KEY`, `NOTIFY_API_KEY`, `CLOUDFLARE_WORKER_URL`). Frontend redeployed to rebake new VAPID public key into bundle. End-to-end verified via `POST /notify` → `{"sent":1,"skipped":0,"cleaned":0}`. Done 2026-02-18.

---

## Open

### 🚨 P2: `push-notify.yml` cron runs 24/7 — narrow to gym hours
The cron `*/30 * * * *` fires 48×/day including 3 AM ET. The script exits cleanly with no matching activities, but the GitHub Actions minutes cost is real and unnecessary. Change cron to `*/30 8-22 * * *` (8–10:30 PM UTC = 3–5:30 PM ET, covering full gym hours with buffer). Alternatively, add an early-exit Eastern-time gate at the top of the script: `if (now.getHours() < 8 || now.getHours() >= 22) { console.log('Outside gym hours, skipping.'); process.exit(0); }`. Reduces Actions minutes by ~60%.

### 🚨 P2: Scraper silent data-quality regression
The `scrape-and-deploy.yml` workflow creates a GitHub issue on hard scraper failure. However, **a partial parse (e.g. Fair Lawn restructures their HTML so only 3 days parse instead of 7) passes Rule 3 (≥3 days) and Rule 9 (warning only) and deploys silently**. Push notification subscribers would then miss days that aren't in the data. **Fix:** Lower Rule 3 threshold from 3 to 5 days (error), and promote Rule 9 (forward-schedule completeness) from warning to error — the smoke test has been running clean for a week so the baseline is stable.

### P2: `savePrefs` error swallowed — user prefs silently lost
`onclick={() => savePrefs(...)}` fires the async function fire-and-forget in `NotifSheet.svelte`. If `notifications.updatePrefs()` fails (worker down, network error), the rejection is unhandled: the optimistic UI update persists but the server has stale prefs. Fix: wrap `updatePrefs` in `savePrefs` with try/catch and set `notifStore.error` on failure (same pattern as `toggleSport`).

### P2: E2E tests for NotifSheet
The main deliverable from the notification overhaul has zero Playwright coverage. Minimum test cases: (1) bell visible after data loads; (2) bell tap opens sheet; (3) Escape closes sheet; (4) "Turn on notifications" triggers browser permission prompt; (5) subscribed state shows toggles. Use `page.addInitScript` to mock `Notification.permission` and service worker APIs since real push subscriptions can't be created in CI.

### P2: DayPicker keyboard nav — E2E test coverage
Keyboard navigation (ArrowRight/ArrowLeft) is tested only by TypeScript compilation. Add a `DayPicker keyboard navigation` E2E test: focus a day button, press `ArrowRight`, assert the next enabled day receives `aria-pressed="true"`.

### P3: `notifStore.error` not set on `toggleSport` / `handleEnable` general failures
`toggleSport` catches errors but only logs them — it never sets `notifStore.error`. `handleEnable` only sets error state for `'denied'`; a generic subscribe failure (network error, Worker 500) returns `false` and silently resets `loading` with no user feedback. Both should set `notifStore.error` with a human-readable message on failure so the sheet's error banner activates.

### P3: `push-notify.yml` missing node_modules caching
All other workflows use the `setup-node-deps` composite action for caching `node_modules`. `push-notify.yml` uses bare `actions/setup-node@v4` with no cache. At 48 runs/day this re-downloads `node-fetch` (and any other deps) on every invocation. Replace the two-step node setup + `npm ci` with `uses: ./.github/actions/setup-node-deps`.

### P3: `SPORT_PATTERNS` in `check-and-notify.mjs` can drift from `filters.ts`
The `SYNC:` comment is the only guard preventing the two lists diverging when a sport is added to `FILTER_CATEGORIES`. A sport added to `filters.ts` but forgotten in `check-and-notify.mjs` silently skips sport-specific notifications. Fix: add a small CI step (or unit test) that reads both files and asserts their sport IDs match — no build step needed, plain `node -e` comparison is sufficient.

### P3: SportWeekCard — "No upcoming [sport] this week" state
`computeSportStatus` returns `kind: 'none'` when the sport never appears in the weekly schedule. Currently nothing renders — the banner is absent and it looks like a load failure. A neutral message ("No Basketball sessions scheduled this week") clarifies the state.

### P3: Scraper — structured error classification
`gotoWithRetry` catches all errors identically. Distinguishing (a) DNS failure/connection refused (site down), (b) timeout (slow response), (c) HTTP 4xx/5xx would give the GitHub issue body actionable context rather than a generic `[retry 1/1]` log line.

### P4: `deploy-worker.yml` missing node_modules caching
`deploy-worker.yml` runs bare `npm ci` in `worker/` on every push to `worker/**`. Wrangler and its deps could be cached using `actions/cache@v4` keyed on `worker/package-lock.json`. Low-frequency workflow but trivially fixable alongside the `push-notify.yml` cache fix.

### P4: KV subscriber count visibility
There's no way to observe how many active push subscribers exist without `npx wrangler kv key list`. Consider adding a `/stats` endpoint to the Worker (auth-gated via `NOTIFY_API_KEY`) that returns `{subscribers: N, idempotencyKeys: M}` — useful for debugging and capacity awareness.

### P4: Document VAPID key rotation in SETUP.md
The current SETUP.md covers initial bootstrap but not the "rotate keys" scenario. If `VAPID_PRIVATE_KEY` is ever compromised, all existing browser subscriptions must be cleared (they're tied to the old public key). Add a "Key Rotation" section: (1) generate new keys, (2) clear all KV subscriptions, (3) set new Worker secrets, (4) redeploy frontend, (5) subscribers must re-subscribe.

### P4: Timeline — "no activities today" empty state
When `selectedSchedule` is `null` (day has no schedule entry), `TodayView` renders nothing between the DayPicker and "Rest of Week". A brief empty state ("No schedule data for [day]") makes the blank space intentional rather than a load failure.

### P4: Sport chip — count badge
Each sport chip could show slot count for the week (e.g. "Basketball · 4"). Already computable from `DISPLAY_DAYS` + `data.schedule` without new derived state.

### P4: Worker unit tests
`worker/index.ts` has zero test coverage. Critical paths untested: `fanOut` idempotency check, sport-filter branch, 410 subscription cleanup, `handleNotify` routing. Add `worker/index.test.ts` using `vitest` with a KV mock (`Map`-based) — no `@cloudflare/vitest-pool-workers` needed for unit tests.

### P4: Lighthouse CI — re-enable performance gate
Removed because shared runners produced ~0.44 with CPU throttling. Now that `throttlingMethod: 'provided'` is set, scores should be stable. Run Lighthouse locally a few times to confirm the baseline, then re-add `"minScore": 0.85`.

---

## Deferred / Future

### P5: Fair Lawn Public Library availability app
Build a similar scraper + availability app for the Fair Lawn Public Library. Key open questions before starting:
- **Coexistence model**: same repo (monorepo with shared `src/lib/`) vs. separate repo? Shared repo avoids duplicating the Svelte app scaffold and CI workflows, but complicates routing and deployment (two GitHub Pages sites vs. one multi-venue app).
- **Multi-venue app option**: a single app at a shared URL that lets the user toggle between Community Center and Library — may be a better long-term UX than two separate bookmarks.
- **Scraper source**: confirm the Library posts a machine-readable schedule (HTML table, calendar feed, etc.) and identify the target URL before committing to a scraper approach.
- **Data shape**: Library room-booking / hours / events may not map 1:1 to the gym's activity-slot model — the shared `ScheduleData` type may need extension or a new type.
