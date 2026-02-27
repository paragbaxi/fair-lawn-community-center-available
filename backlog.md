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

### ~~P2: Post-launch backlog sweep — CI hardening, error UX, validation, E2E~~
Six parallel agents tackled all open P2/P3/P4 items: (1) `push-notify.yml` Eastern-time gate (8 AM–10 PM ET) added to `check-and-notify.mjs` — script returns early outside gym hours; `deploy-worker.yml` gains inline `worker/package-lock.json` cache. (2) Scraper Rule 3 raised to `< 5` days (hard error), Rule 9 raised to `< 6` days and promoted from warning to error; named constants extracted (`RULE3_MIN_DAYS`, `RULE9_MIN_DAYS`); all tests updated. (3) `notifications.ts` `updatePrefs()` no longer swallows its own errors; `notifStore` `savePrefs` and `toggleSport` catch the rejections and set `notifStore.error`; `handleEnable` sets error on generic failure. (4) `SportWeekCard` shows "No {sport} sessions scheduled this week" for `kind:'none'`; `TodayView` shows "No schedule data for {day}" when `selectedSchedule` is null. (5) Worker `/stats` endpoint (GET, auth-gated); `fanOut` cursor pagination fixed to use `list_complete` discriminant; `PushSubscription` type fixed with `expirationTime: null`; 11 unit tests added in `worker/index.test.ts`; `tsconfig.json` gets `skipLibCheck` + test file exclusion. (6) `scripts/check-sport-sync.mjs` verifies FILTER_CATEGORIES vs SPORT_PATTERNS IDs in CI; SETUP.md gets full VAPID key rotation procedure. E2E: 6 new tests (bell visible, sheet opens, Escape focus return, backdrop close, DayPicker ArrowRight/ArrowLeft). Lighthouse performance gate re-enabled at 0.8. 25/25 E2E, 185/185 unit tests, 11/11 worker tests. Deployed 2026-02-18.

### ~~P1: Set Cloudflare Worker secrets + end-to-end push verification~~
Generated fresh VAPID key pair and hex NOTIFY_API_KEY (`openssl rand -hex 32` — no special chars). Root cause of prior failures: secrets set via `printf "..." | wrangler secret put` had `=`/`/` chars mangled by the zsh pipe; secrets set before the worker existed ("no worker found" warning) didn't persist to the live worker. Fix: all secrets set via heredoc (`<< 'EOF'`) after first successful deploy. Set all three Worker secrets (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NOTIFY_API_KEY`) and matching GitHub secrets (`VITE_VAPID_PUBLIC_KEY`, `NOTIFY_API_KEY`, `CLOUDFLARE_WORKER_URL`). Frontend redeployed to rebake new VAPID public key into bundle. End-to-end verified via `POST /notify` → `{"sent":1,"skipped":0,"cleaned":0}`. Done 2026-02-18.

### ~~P2: Multi-agent review sweep — silent failures, optimistic update correctness, worker robustness~~
Three parallel review agents (code quality, silent failures, test coverage) identified 10 issues; all fixed. CRITICAL: `handleNotify` double `request.json()` (body consumed twice on fallback auth path) — fixed to parse body once up front; `subscribe()` and `updatePrefs()` never checked HTTP response status — server 500 was treated as success — fixed to throw on non-ok. HIGH: `updatePrefs()` wrote localStorage before network call — now writes only after server confirms; `unsubscribe()` swallowed DELETE failures and cleared localStorage unconditionally — now throws on non-ok and only clears on success; `handleDisable()` had no try/finally — loading could stick at true — wrapped in try/catch/finally; `savePrefs`/`toggleSport` had no rollback on optimistic failure — now capture previous prefs and restore on catch; `fanOut` counted 4xx/5xx push delivery as `sent` — now only 2xx counts. MEDIUM: `getState()` bare catch swallows SecurityError — now console.warns; `getStoredPrefs` silent null on corrupt JSON — now logs and evicts; check-and-notify.mjs used console.log for Worker 4xx/5xx — now console.error; scraper outer catch lacked retry-count context — gotoWithRetry now logs "all retries exhausted" before final throw. 185/185 unit tests, 11/11 worker tests. Deployed 2026-02-18.

### ~~P3/P4: Scraper error classification, sport chip count badge, Lighthouse threshold~~
Three items shipped together: (1) `gotoWithRetry` now classifies errors as `dns`, `timeout`, `http_4xx`, `http_5xx`, or `unknown` using a shared `classifyError()` helper — eliminates DRY violation; 5xx throws so retry logic engages instead of silently treating server errors as success. (2) Each sport chip now shows session count for the week (`Basketball · 4`) via a `$derived.by()` map computed against `availableSports`; count span is `aria-hidden` with a paired `sr-only` sibling for screen readers; `SPORT_CATEGORIES` import removed since iteration switched to `availableSports`. (3) Lighthouse performance gate bumped from `minScore: 0.8` to `0.85`; CI consistently scores 1.0 with `throttlingMethod: 'provided'`. Deployed 2026-02-18.

### ~~P3: Test coverage gaps — classifyError, KV pagination, sportSessionCounts~~
Three test gaps from coverage review: (1) `classifyError()` exported from `scraper/index.ts`; 9 unit tests in `scraper/classifyError.test.ts` covering dns/timeout/unknown/non-Error values. (2) `getWeeklySessionCounts` extracted from `SportWeekCard.svelte` into `filters.ts` (pure, independently testable); 5 unit tests in `filters.test.ts`; `SportWeekCard` reduced to a single `$derived` call. (3) Worker `createPaginatedKVMock` added to `worker/index.test.ts` with pageSize parameter; `handleStats` pagination regression test (5 subs + 2 idempotency keys across 3 pages); `sport-30min` skips subscriber with `sports: []` (default empty state). 199 unit tests + 13 worker tests. Deployed 2026-02-18.

### ~~P1: CI broken — classifyError.test.ts imports scraper/index.ts triggering Playwright launch~~
Importing `scraper/index.ts` in vitest caused the top-level `scrape().catch(...)` to execute, launching Chromium which isn't installed in the `test` CI job (only `e2e` has it). Fixed by wrapping the call in a main-module guard: `if (process.argv[1] === fileURLToPath(import.meta.url))` — Node.js ESM equivalent of Python's `if __name__ == "__main__"`. 199/199 unit tests pass. Deployed 2026-02-18.

---

## Open

### ~~P3/P4/P5: fanOut failed counter, esbuild alert, getEasternNow doc, non-2xx test~~
Four items resolved: (1) `fanOut` return type now includes `failed` counter — increments on non-2xx/non-410/non-429 push delivery; idempotency early return includes `failed: 0`; `handleScheduled` log shows all 4 fields; 14 worker tests (added non-2xx regression test asserting `sent: 0, failed: 1` when push endpoint returns 400). (2) esbuild GHSA-67mh-4wv8-2f99 dismissed as `tolerable_risk` — only affects `esbuild --serve`, which this project never uses. (3) `getEasternNow()` in `check-and-notify.mjs` analyzed: arithmetic is genuinely correct because offsets cancel in epoch subtraction; added a detailed comment explaining the "Eastern-as-local" coordinate system, why `parseActivityTime` math is safe, and the fragility caveat for future contributors. (4) No code change needed for getEasternNow — comment is sufficient. 199 unit tests + 14 worker tests. Deployed 2026-02-18.

### ~~P3/P3/P4/P4: unsubscribe UX, failed CI highlight, sport E2E, duplicate notification dedup~~
Four items resolved: (1) `unsubscribe()` now removes browser PushManager subscription unconditionally first (try/catch), then attempts server DELETE — if server fails, user still stops receiving notifications; zombie KV entries self-clean via 410. (2) `check-and-notify.mjs` checks `result.results.some(r => r.failed > 0)` (open gym) and `result.result.failed > 0` (sport) after each Worker call and logs `console.error` with total failure count + "check VAPID keys" hint; `res.json()` moved inside ok/error branches. (3) Open gym deduplication: `upcoming` array now sends only `[upcoming[0]]` to Worker — earliest slot in the window; prevents duplicate notifications when two sessions start in the same 30-min cron window. (4) E2E: new test in `describe('Sports tab')` navigates to `#sports?sport=basketball`, waits 5.5s for SW timeout, asserts `.sport-notif-btn` is visible and matches `/notify|notifying/i`. 199 unit tests, 24 E2E tests. Deployed 2026-02-18.

---

### ~~P2/P2/P3/P3/P4: error visibility, visual baselines, daily briefing UX, sport-30min test, time-dependent test~~
Five items resolved in commit 82708eb: (1) `NotificationSettings.svelte` `onEnableClick` now opens sheet on error path (`notifStore.error` truthy) so user sees error feedback instead of silent re-enable. (2) Visual regression baselines regenerated — `status-dark.png`, `today-dark.png`, `sports-dark.png` updated to include bell button and header layout; all 3 visual tests pass locally. (3) `handleScheduled` returns early when `openGymSlots.length === 0` — no "No open gym today" push sent; `console.log` for observability. (4) `sport-30min` positive-path test added: subscriber with `sports:['basketball']` receives push, subscriber with `sports:[]` skipped; `sent: 1, skipped: 1`. (5) `dailyBriefing filtering` test uses `vi.useFakeTimers({ now: new Date('2026-02-18T12:00:00.000Z') })` so `handleScheduled`'s `Intl.DateTimeFormat(new Date())` always resolves to Wednesday regardless of real day; `afterEach(() => vi.useRealTimers())` restores timers. 15 worker tests. Deployed 2026-02-19.

### ~~P2: Open Gym chip in Sports tab~~
Added Open Gym as the last chip in the Sports tab chip row. `OPEN_GYM_CATEGORY`, `getAvailableSportsAndOpenGym`, and `findSportById` exported from `filters.ts` — `SPORT_CATEGORIES` / worker / NotifSheet untouched. Green `--color-available-*` tokens (consistent with NOW badge / status banner). Open Gym notification CTA opens the alerts sheet (thirtyMin pref path) rather than calling `toggleSport`. `openGymAlertOn` derived from `notifStore.prefs.thirtyMin`. Stale-sport guard updated to `getAvailableSportsAndOpenGym` so `#sports?sport=open-gym` deep-links survive data load. 208 unit tests. Merged 2026-02-19.

### ~~P2: Open Gym alerts discoverability~~
Moved Open Gym 30-min toggle into the SPORTS section as the first row; renamed the remaining section "Daily" for morning briefing only. Added `highlight` prop to `NotifSheet` — tapping "Alert me before Open Gym" deep-links and pulses the 👟 Open Gym row. `disabled={notifStore.loading}` added to all three toggles for consistency. `.sheet-row-sub` CSS for the "(30-min heads-up)" sub-label. `aria-label="Open Gym 30-min heads-up"` restores screen-reader context. `clearTimeout` in `$effect` cleanup prevents stale highlight callbacks. Optional chaining on all `onManageAlerts?.()` call sites. QA tested 6/6 with video recording. Merged 2026-02-19.

### ~~P3: `fanOut` network-level send failures not counted in `failed`~~
Added `failed++` inside the `catch` block in `fanOut` (`worker/index.ts`). Network-level fetch throws now increment the counter and surface via `check-and-notify.mjs` monitoring. Worker test added for network failure path (`sent: 0, failed: 1`). Merged 2026-02-19.

### ~~P4: E2E test for Open Gym chip~~
Added 5 tests to `e2e/smoke.spec.ts`: chip visible + selectable, session count badge rendered, "Alert me before Open Gym" CTA visible after selection, deep-link `#sports?sport=open-gym` pre-selects chip, deselect restores hint text. All gated with `test.skip` where data may be absent. 29 E2E tests passing. Merged 2026-02-19.

### ~~P5: `getAvailableSportsAndOpenGym` double-flattens `allActivities`~~
Replaced inner `flatMap().some()` with a single `.some()` on the already-flattened array passed down from `getAvailableSports`. Merged 2026-02-19.

---

## Open

### ~~P3: Commit QA infrastructure to main~~
Committed in chore commit 34f5081. Done 2026-02-19.

### ~~P2: Local dev setup undocumented — `.env.local` required~~
Added "Local Development" section to `SETUP.md` with the two required env vars, exact values, and explanation of why they're safe to document. Done 2026-02-19.

### ~~P3: Worker `/unsubscribe` endpoint has no authentication~~
Adopted endpoint-as-self-authorization: the push endpoint URL is a 256-bit random value issued by the browser's push service, stored only in the user's own localStorage. Presenting it in the request body is sufficient proof of identity. Added JSDoc to `handleUnsubscribe` documenting this auth model explicitly. Added input validation rejecting requests where endpoint is missing (400 `Missing endpoint`) or does not start with `https://` (400 `Invalid endpoint`). New test: malformed endpoint → 400. 20/20 worker tests passing. Done 2026-02-19.

### ~~P3: `fanOut` network-level send failures not counted in `failed`~~
See PR #20 / done section above. Merged 2026-02-19.

### ~~P4: E2E test for "Manage all alerts →" link in SportWeekCard~~
Added test to `e2e/smoke.spec.ts` inside `describe('Sports tab')`. Navigates to `#sports?sport=basketball`, waits for sport week card, checks for `.sport-manage-inline` button; gracefully skips in headless CI (button only renders when subscribed). 29 E2E tests pass, 1 skipped. Done 2026-02-19.

### ~~P4: Open Gym notification CTA — highlight thirtyMin toggle in sheet~~
Implemented in the Open Gym discoverability fix (PR #20). Merged 2026-02-19.

### ~~P3: E2E ready-signal fragility + notif button timeout inconsistency~~
Three tests navigating to `/#sports` (no pre-selected sport) used `.sport-week-expanded` as their ready signal — that class only renders when a chip is already selected, causing silent 5s timeout burns before the test logic ran. Fixed to `#panel-sports .sport-chip`. "Alert me before Open Gym" test aligned from `isVisible({ timeout: 8000 })` to `waitForTimeout(5500)` + `isVisible({ timeout: 1000 })` — consistent with the other sport notification test. Added explanatory comment to `highlightTimer` in `NotifSheet.svelte`. 29 E2E tests pass. Done 2026-02-19.

### ~~P3: Fix 30-min timing context in NotifSheet — move to section subtitle~~
Removed `(30-min heads-up)` label from Open Gym row (false implied asymmetry vs per-sport rows). Added `~30 min before each activity` section subtitle under Sports heading and `Today's schedule summary` under Daily. Replaced `.sheet-row-sub` with `.sheet-section-sub` (`margin: -4px 0 8px` to tighten visual bond with h3). QA selectors upgraded to section-scoped locators. 6/6 QA tests pass. Merged 2026-02-19.

---

## Open

### ~~P3: `waitForTimeout(5500)` hard wait in E2E sport notification tests~~
Added `data-notif-initialized` attribute to `.sport-week-expanded` in `SportWeekCard.svelte` (present when `notifStore.initialized` is true). Both `waitForTimeout(5500)` hard waits in `smoke.spec.ts` replaced with `waitForSelector('[data-notif-initialized]', { timeout: 6000 })`. Tests 17 and 21 now run in <150ms vs ~7500ms previously — saves 11s per CI run. Merged 2026-02-19.

### ~~P4: Visual regression baselines may be stale after NotifSheet restructure~~
Refreshed `status-dark.png` and `today-dark.png` via `npx playwright test e2e/visual.spec.ts --update-snapshots`. `sports-dark.png` was unchanged (Sports tab layout unaffected by the NotifSheet changes). Merged 2026-02-19.

### ~~P4: Daily briefing timing not communicated~~
Daily section subtitle updated from `Today's schedule summary` to `Today's schedule summary · ~8 AM ET`. Cron is `0 12 * * *` UTC = 7 AM EST / 8 AM EDT. Merged 2026-02-19.

### ~~P5: Open Gym row categorically different from per-sport rows~~
Added a subtle dashed divider (`border-top: 1px dashed var(--color-border)`) between the Open Gym row and per-sport rows in the NotifSheet Sports section. Divider is `aria-hidden` and guarded by `{#if notifiableSports.length > 0}`. Merged 2026-02-19.

---

### ~~P4: Daily briefing fires even when Open Gym section is empty~~
`handleScheduled` rewritten in PR #23: now sends when any activities exist; explicitly says "No open gym today · Basketball: 10:00" when gym is open but only other sports are scheduled. Skips only when `allActivities.length === 0`. Cron expanded to 5 runs/day covering 7–10 AM ET year-round. Per-user delivery hour (7/8/9/10 AM ET) persisted in KV and routed via `etHour` param in `fanOut`. Merged 2026-02-19.

### ~~P4: `data-notif-initialized` not set in the sheet itself~~
Added `data-notif-initialized` to `<div class="sheet-content">` in `NotifSheet.svelte` — present when `notifStore.initialized` is true. Parallel to `SportWeekCard.svelte` attr added in PR #22. Merged 2026-02-19.

---

### ~~P4: Redundant `role="group"` + `role="radiogroup"` nesting in time picker~~
Collapsed to a single `role="radiogroup" aria-label="Briefing hour"` on `.sheet-time-row`; inner `.sheet-time-chips` div's role removed. Merged 2026-02-20.

### ~~P4: Arrow-key handler fires `savePrefs` (API call) on every key-repeat event~~
Added `if (e.repeat) return` guard at the top of the time-chip `onkeydown` handler. Merged 2026-02-20.

### ~~P4: Missing unit tests for `dailyBriefingHour` out-of-range validation~~
Added 2 worker tests: `handleSubscribe` with hour=6 → 400, `handleUpdatePrefs` with hour=11 → 400. Merged 2026-02-20.

### ~~P5: Notification body length has no hard truncation~~
Added `truncateBody(s, max=100)` helper in `worker/index.ts`; applied to all 6 notification body construction sites. Merged 2026-02-20.

### ~~P4: NotifSheet denied state visually sparse~~
Expanded from single emoji+text line to icon + `<h3>` + `<p>` structure, reusing existing `.sheet-empty-state` CSS. QA approved. Merged 2026-02-20.

### ~~P4: Redundant QA screenshot `06-sheet-any-state.png`~~
Removed the pre-branch "any state" screenshot that was always pixel-identical to the denied-state screenshot. Remaining `07-` variants renumbered to `06-`. Merged 2026-02-20.

### ~~P4: Open Gym chip has no "live now" affordance~~
Added conditional `NOW` badge (reusing existing `.now-badge` CSS) via `openGymIsActive` `$derived` in `SportWeekCard.svelte`; badge renders in both expanded and collapsed chip modes. QA approved. Merged 2026-02-20.

### ~~P5: `check-sport-sync.mjs` pointing at deleted `scripts/check-and-notify.mjs`~~
Script was silently broken since the worker migration. Updated to read `worker/index.ts` instead. CI passing again. Merged 2026-02-20.

---

### ~~P2: Context-aware bell button — offer single-subject alert from current view~~
140px contextual mini-sheet (`ContextualAlertSheet.svelte`) + auto-dismiss snackbar (`Snackbar.svelte`). Bell on Sports tab with chip selected and alert OFF shows mini-sheet; all other states fall through to full sheet. `isSportAlertOn()` helper centralises the `thirtyMin` vs `sports[]` asymmetry. `--color-accent`/`--color-accent-hover` promoted to `app.css` `:root` tokens. Focus trap, swipe-down, `env(safe-area-inset-bottom)` for home-indicator clearance. 14 QA tests in `e2e/qa-contextual-bell.spec.ts`. Merged 2026-02-20.

---

### ~~P3: Error-path QA test for contextual bell — inline retry flow is untested~~
Worker route overridden to 500 (registered after `mockSubscribed` so Playwright LIFO order ensures it fires first). Asserts: `.ctx-error[role="alert"]` visible, `.snackbar` not visible, mini-sheet stays open. 1 test added to `e2e/qa-contextual-bell.spec.ts` (15 total). Merged 2026-02-20.

### ~~P4: Shift+Tab focus trap direction not tested in `qa-contextual-bell.spec.ts`~~
New standalone test added: Shift+Tab from CTA (first) → trap intercepts → wraps to "View all" (last); Shift+Tab from last → browser native → lands on CTA. Both assertions use `classList.contains()` via `page.evaluate()`. 22 QA tests (21 existing + 1 new). Done 2026-02-20.

### ~~P4: Active toggle ordering in full NotifSheet SPORTS section~~
Added `sortedSports = $derived([...notifiableSports].sort(...))` — enabled sports (prefs match) sort first (key 0), disabled last (key 1); V8 stable sort preserves original order within each tier. `{#each sortedSports}` replaces `{#each notifiableSports}`. Divider visibility check still uses `notifiableSports.length` (unaffected). Done 2026-02-20.

### ~~P5: `handleContextViewAll` 300ms magic number should reference animation duration~~
Added inline comment `// 300ms must match ContextualAlertSheet.svelte fly transition: dur(300)` immediately before the `animDur` constant in `src/App.svelte`. Zero behavioral change. Done 2026-02-20.

### ~~P5: Redundant `notifStore.error = null` in `$effect` `if (!open)` guard~~
Removed the dead `notifStore.error = null` line from the early-return guard in `ContextualAlertSheet.svelte`. The `$effect` cleanup function already clears the error on `open → false`; the early-return path was never reached on that transition. Done 2026-02-20.

### ~~P5: `BASE` URL hardcoded in both `qa-contextual-bell.spec.ts` and `playwright.qa.config.ts`~~
Deleted `const BASE = 'http://localhost:4174'` from both QA spec files. All `page.goto()` calls converted to relative paths (`'/'`, `'/#sports'`, `'/#sports?sport=basketball'`, `'/#sports?sport=open-gym'`) — Playwright resolves these against `baseURL` in `playwright.qa.config.ts`, which remains the single source of truth. Done 2026-02-20.

---

## Open

### ~~P4: Two `qa-notif-sheet.spec.ts` tests use `.sport-week-expanded` as ready signal on `/#sports` (no chip pre-selected)~~
All 5 `waitForSelector('.sport-week-expanded', { timeout: 8000 })` calls replaced with `waitForSelector('#panel-sports .sport-chip', { timeout: 8000 })`. The two broken tests ("Open Gym chip visible and selectable", "Alert button absent") no longer burn 8s each — the chip selector is available immediately on page load regardless of selection state. The three `/#sports?sport=open-gym` tests also updated for consistency (they worked before but the new signal is faster). Done 2026-02-20.

### ~~P4: No QA test for `sortedSports` ordering in NotifSheet~~
Added `mockSubscribed` helper to `qa-notif-sheet.spec.ts`. New test mocks `sports: ['basketball']` enabled, opens full NotifSheet, scopes to the Sports section, excludes the Open Gym toggle (distinct `aria-label`), and asserts: (1) first per-sport toggle is `aria-checked="true"` with `aria-label="Basketball"`, (2) all subsequent toggles are `aria-checked="false"`. Guards: skips if not subscribed, <2 sports this week, or basketball not scheduled. Done 2026-02-20.

### ~~P4: `NotifSheet.svelte` error-path not covered by QA~~
New test in `qa-notif-sheet.spec.ts`: mocks subscribed with `sports: []`, overrides worker route to 500 (LIFO after the success route), opens full NotifSheet, clicks first per-sport toggle, waits for `.sheet-error[role="alert"]` to appear, then asserts toggle reverts to `aria-checked="false"` (optimistic rollback) and dialog stays visible. Parity with the contextual bell error-path test. Done 2026-02-20.

### ~~P5: Visual regression baselines stale — all 3 dark-mode snapshots~~
`status-dark.png`, `today-dark.png`, and `sports-dark.png` were all >2% different from the stored baselines (accumulated drift from the contextual bell, NotifSheet restructure, Open Gym chip, and NOW badge changes). Regenerated all three with `--update-snapshots`; 3/3 pass. Merged 2026-02-25.

---

## Open

### ~~P3: `NotifSheet.svelte` build a11y warning — `sheet-time-chips` missing ARIA role~~
`<div class="sheet-time-chips">` had an `onkeydown` handler but no ARIA role. Added `role="none"` — the parent `sheet-time-row` carries `role="radiogroup"`; this container is purely presentational. Build emits zero warnings. Done 2026-02-25.

### ~~P2: iCal / Google Calendar export for sport sessions~~
Pure `src/lib/ical.ts` helper (RFC 5545, no deps): VCALENDAR + one VEVENT per session with DTSTART/DTEND (America/New_York TZID), deterministic UID, line folding, CRLF. "📅 Add to Calendar" ghost button in SportWeekCard (visible when ≥1 session). 13 unit tests. Merged 2026-02-25.

### ~~P2: Slot cancellation alerts — scraper delta-diff + Worker + UI~~
`scraper/diff.ts`: pure `diffSchedules(prev, next) → FreedSlot[]` with shared `slotKey()` helper. Scraper writes `freed-slots.json` after each run (deleted if no changes, skipped on first run, diff failure non-fatal). Worker `slot-freed` notification type with `buildSlotFreedBody()` 3-case formatting; `fanOut()` extended with `cancelAlerts` filter. Frontend: `cancelAlerts` pref toggle in NotifSheet SPORTS section. `check-and-notify.mjs` reads `freed-slots.json` and POSTs (single 8 AM–10 PM ET gate). 13 diff tests + 7 worker slot-freed tests. Merged 2026-02-25.

### ~~P2: Crowd-sourced occupancy indicator in Status tab~~
Worker: `POST /checkin` (IP-hash rate-limit, KV TTL 900s), `GET /occupancy` (belt-and-suspenders expiresAt check). `OccupancyWidget.svelte`: polls every 5 min, optimistic updates, 15-min client-side cooldown via localStorage, Light/Moderate/Packed pill. Mounted in StatusView between StatusCard and NotifSettings. 10 new worker tests (47 total). Merged 2026-02-25.

### ~~P4: Visual test masking — Sports tab chip session counts cause spurious baseline drift~~
Two-pronged fix: (1) `e2e/visual.spec.ts` Sports tab test now masks `.chip-count` and `.sport-status-banner` (both contain schedule-driven dynamic text) via a `SPORTS_MASK` const that spreads the existing `MASK`. Baseline regenerated. (2) New structural E2E test in `smoke.spec.ts` — `'chip session count badge shows a number'` — asserts each `.chip-count` span matches `/\d+/` and parses to `≥0`; survives schedule changes without baseline regeneration. 30 E2E tests (1 pre-existing skip). Merged 2026-02-25.

### ~~P2: Auto-correct reversed activity times~~
`scraper/sanitize.ts`: pure `sanitizeSchedule()` with 3 rules — invalid format → skip; reversed both in [6AM–11:59PM] → swap + `corrected: true`; reversed outside range → skip (ambiguous overnight). `Activity.corrected?: boolean` and `ScheduleData.correctedActivities?: number` added to `types.ts`. Inline loop in `scraper/index.ts` replaced with single `sanitizeSchedule()` call. 8 tests in `scraper/sanitize.test.ts`. UI: `corrected` badge in `Timeline.svelte` + `WeeklySchedule.svelte`; footer notice in `TodayView.svelte` when `data.correctedActivities` is set. Merged 2026-02-26.

### ~~P3/P4: E2E coverage for iCal export, occupancy widget, cancelAlerts toggle~~
`smoke.spec.ts`: "Add to Calendar" button visible when sport with sessions selected; occupancy widget renders with level buttons (mocked GET /occupancy). `qa-notif-sheet.spec.ts`: cancelAlerts toggle present in SPORTS section; fixed ambiguous `[data-notif-initialized]` selector (scoped to dialog); extended per-sport toggle count exclusion to include cancelAlerts row. Merged 2026-02-26.

---

## Open

### ~~⚠️ P1 URGENT: Restore Worker deploy automation + deploy new endpoints~~
`deploy-worker.yml` was accidentally deleted on 2026-02-20. Worker has been stuck at the Feb 19 build — the occupancy `/checkin`/`/occupancy` and `slot-freed` notification endpoints added Feb 25 are 404 in production. Workflow recreated; Worker redeployed via `workflow_dispatch`. `/occupancy` verified live: `{"level":null,"reportedAt":null,"expiresAt":null}`. Done 2026-02-26.

### ~~⚠️ P1 URGENT: Fix push-notify.yml cron syntax — 30-min notifications were never firing~~
Cron `*/30 12-02 * * *` is invalid POSIX (range wraps midnight). Every push triggered a "workflow file issue" failure. Fixed to two entries (`*/30 12-23 * * *` + `*/30 0-3 * * *`). Deployed 2026-02-26.

### ~~P1: Fix Dependabot high-severity rollup CVEs~~
Added `"overrides": {"rollup": "^4.59.0"}` to both root and `worker/package.json`. Root: rollup 4.57.1 → 4.59.0 (via vite). Worker: clean reinstall also updated vitest 2.1.9 → 4.0.18 and vite 5 → 7 transitively. `npm audit` reports 0 vulnerabilities in both. Dependabot alerts #8 + #9 auto-close after re-scan. Done 2026-02-26.

### ~~P3: E2E test for corrected-times badge~~
Added `test.describe('Corrected times badge')` in `e2e/smoke.spec.ts` (3 tests). Uses `page.route('**/data/latest.json', ...)` to inject mock data with all 7 days having `corrected: true`. Asserts: badge visible + title text in Timeline, footer-notice visible, badge visible after expanding a WeeklySchedule accordion item. Done 2026-02-26.

### ~~P4: Worker end-to-end re-verification after deploy~~
Verified all three new endpoints live via curl: `GET /occupancy` → `{"level":null,...}`, `POST /checkin` with `"level":"moderate"` → `{"ok":true,...}`, `POST /notify` with slot-freed type → `{"error":"Unauthorized"}` (correct 401, not 404). Also exported `buildSlotFreedBody` from `worker/index.ts` and added 3 direct unit tests (single slot, multi same activity, mixed activities). Worker tests now 50 total. Done 2026-02-26.

---

## Open

### ~~⚠️ P1: Verify 30-min push notifications end-to-end~~
Worker pipeline confirmed end-to-end on 2026-02-26: `/stats` → `subscribers: 4`; `POST /notify type=30min` → `sent: 3, skipped: 1`; `POST /notify type=sport-30min` → `ok: true`; `workflow_dispatch` at 12:31 PM ET passed the time gate and ran cleanly (no activities in 20–45 min window, which is acceptable). `NOTIFY_API_KEY` rotated and synced to Cloudflare Worker, GitHub Actions secret, and local `.env.local`. Device receipt (Step 4) unconfirmed — the Worker reported `sent: 3`, meaning the push service accepted delivery, but visual confirmation on a subscribed device was not observed. Done 2026-02-26.

### ~~⚠️ P1: Verify slot-freed pipeline end-to-end~~
Verified 2026-02-26. Committed a test `freed-slots.json` (Basketball Thursday 2–4 PM), triggered `workflow_dispatch`, confirmed: `[check-and-notify] slot-freed (1 slot(s)): { ok: true, result: { sent: 0, skipped: 4, cleaned: 0, failed: 0 } }`. `sent: 0` is correct — all 4 current subscribers have `cancelAlerts: false`. Full pipeline (file → script → Worker → fanOut) confirmed working. Test file removed after verification. Done 2026-02-26.

### ~~P2: Delete freed-slots.json from repo after notification is sent~~
Fixed 2026-02-26 via idempotency redesign. Instead of deleting the file, the Worker now scopes the slot-freed idempotency key to `generatedAt` (the scraper-set timestamp from `freed-slots.json`) with a 48h TTL. Same file across midnight → same key → deduped. New scraper detection event → new `generatedAt` → sends. `check-and-notify.mjs` passes `generatedAt` in the POST body. 2 regression tests added (same `generatedAt` deduplicates; different `generatedAt` sends). Worker redeployed. Done 2026-02-26.

### ~~P2: Unit tests for check-and-notify.mjs~~
Fixed 2026-02-26. Extracted pure logic into `scripts/check-and-notify-logic.mjs` (`parseMinutes`, `findOpenGymSlot`, `findSportSlots`, `SPORT_PATTERNS`, window constants). 35 unit tests in `scripts/check-and-notify-logic.test.ts` covering window boundaries, sport pattern matching, table-tennis/tennis disambiguation, deduplication, and noon/midnight edge cases. `vitest.config.ts` include gains `scripts/**/*.test.ts`. `check-and-notify.mjs` updated to import from the logic module. Done 2026-02-26.

### P2: Device receipt of push notifications unconfirmed
`POST /notify` returned `sent: 3` on 2026-02-26 (Worker confirmed delivery to push service), but no one confirmed a notification appeared on a subscribed device. This is the last unverified link in the push chain. Confirm by sending another test during waking hours with a subscriber actively watching their device: `KEY=$(grep "^NOTIFY_API_KEY=" .env.local | cut -d= -f2) && curl -s -X POST https://flcc-push.trueto.workers.dev/notify -H "Content-Type: application/json" -H "X-Api-Key: $KEY" -d '{"type":"30min","activities":[{"start":"X:00 AM","end":"Y:00 AM","dayName":"Friday"}]}'` (use a unique start time to bypass 2h idempotency key). If push arrives: close the loop. If not: check browser notification permissions and Service Worker registration.

### ~~P3: `check-sport-sync.mjs` misses `check-and-notify-logic.mjs` — three-way drift risk~~
Fixed 2026-02-27. `check-sport-sync.mjs` now reads all three sources (`src/lib/filters.ts`, `worker/index.ts`, `scripts/check-and-notify-logic.mjs`) and uses a union-based loop — for each sport ID in any source, prints which sources have it and which are missing. Error message clearly names every divergent source. Done 2026-02-27.

### P3: E2E test for occupancy level button click
The existing E2E test only checks that the occupancy widget renders with three buttons. It does not test clicking a button (which fires `POST /checkin`). Add a test that mocks the `/checkin` endpoint, clicks "Moderate", and verifies the widget updates to show the selected level. Also test the 15-min cooldown lockout (localStorage-based).

### ~~P3: `check-sport-sync.mjs` not wired into CI~~
Already wired — `ci.yml` test job runs `node scripts/check-sport-sync.mjs` before `npm run test`. Step name updated to reflect the three-source check. Done 2026-02-27.

### P4: No live device receipt confirmation for push notifications
`POST /notify` returned `sent: 3` on 2026-02-26, meaning the push service accepted delivery — but no subscriber confirmed a notification appeared on their screen. This is the last unverified link. Send a test notification with a unique start time (to bypass 2h idempotency key) while a subscribed device is in view: `KEY=$(grep "^NOTIFY_API_KEY=" .env.local | cut -d= -f2) && curl -s -X POST https://flcc-push.trueto.workers.dev/notify -H "Content-Type: application/json" -H "X-Api-Key: $KEY" -d '{"type":"30min","activities":[{"start":"10:07 AM","end":"12:00 PM","dayName":"Thursday"}]}'`. If the notification arrives: loop is closed, mark done. If not: check browser notification permissions and Service Worker registration in DevTools.

### P4: `cancelAlerts` subscriber count is zero — no real-world coverage
All 4 current subscribers have `cancelAlerts: false`, so the slot-freed fanOut has never actually delivered to a device. To gain real coverage: subscribe with `cancelAlerts: true` enabled in the NotifSheet, commit a test `freed-slots.json`, trigger `workflow_dispatch`, and confirm delivery. Otherwise the pipeline is plumbed but untested end-to-end.

### ~~P2: check-and-notify.mjs has no observability when nothing is in window~~
Fixed 2026-02-26. Added `else` branch after open gym check and `if (sportsSeen.size === 0)` after sports loop. All three sections now log explicitly on every run. Confirmed in live `workflow_dispatch` logs: `No Open Gym in 20–45 min window.` / `No sports in 20–45 min window.` / `No freed-slots.json found`. Done 2026-02-26.

### ~~P3: Cron gap — 30-min ET window around 6:30–7:00 PM~~
Investigated 2026-02-26. The claimed 30-minute fire gap does not exist. `*/30 12-23` fires at 23:00 and **23:30** UTC; `*/30 0-3` fires at **0:00** UTC — the transition is a normal consecutive 30-minute interval. The only gap > 30 min is 3:30–12:00 UTC (intentional overnight quiet period). There is a structural 4-minute coverage gap (`*:16–:19` and `*:46–:49` of each UTC hour) inherent to a 25-minute window on a 30-minute cron, but every FLCC session starts on `:00` or `:30` — none fall in these windows. No fix needed. Closed 2026-02-26.

---

## Deferred / Future

### P5: Fair Lawn Public Library availability app
Build a similar scraper + availability app for the Fair Lawn Public Library. Key open questions before starting:
- **Coexistence model**: same repo (monorepo with shared `src/lib/`) vs. separate repo? Shared repo avoids duplicating the Svelte app scaffold and CI workflows, but complicates routing and deployment (two GitHub Pages sites vs. one multi-venue app).
- **Multi-venue app option**: a single app at a shared URL that lets the user toggle between Community Center and Library — may be a better long-term UX than two separate bookmarks.
- **Scraper source**: confirm the Library posts a machine-readable schedule (HTML table, calendar feed, etc.) and identify the target URL before committing to a scraper approach.
- **Data shape**: Library room-booking / hours / events may not map 1:1 to the gym's activity-slot model — the shared `ScheduleData` type may need extension or a new type.
