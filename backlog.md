# Backlog

## Open

### P3: cancelAlertSports end-to-end device verification
The per-sport freed-slot filtering shipped in PR #36 has never been confirmed on a real device. **Logic is now unit-tested** (`worker/index.test.ts` — `describe('isSubscriberAllowed — cancelAlerts', ...)`, 5 cases covering all-sports mode, per-sport allow/deny, undefined sportId, and cancelAlerts=false guard). Remaining manual steps: (1) subscribe with `cancelAlerts=true`, `cancelAlertSports=['basketball']`; (2) trigger a freed-slot run with a volleyball cancellation → confirm no notification received; (3) trigger a basketball cancellation → confirm delivery. Real-device receipt is outside CI scope.

### ~~P3: Stale local branches — decide and clean up~~

### ~~P4: QA test for cancelAlertSports sport chips in NotifSheet~~

### ~~P3: Stale agent worktrees — prune~~

### P4: `/stats byPref` — no integration smoke test
The `byPref` breakdown added to `GET /stats` has unit tests but no integration verification. After next Worker deploy, curl `/stats` and confirm `byPref.thirtyMin`, `byPref.dailyBriefing`, `byPref.cancelAlerts`, and `byPref.sports` are present and plausible. Update this item when confirmed.

### ~~P4: QA Playwright test for `opening-soon` teal state~~
### ~~P4: Dark-mode visual verification for `opening-soon` card~~

### ~~P5: `check-sport-sync.mjs` does not cover `cancelAlertSports` sport ID path~~

### P4: `midnight.spec.ts` — audit Svelte 5 `$effect` + fake-timers interaction
`page.clock.install()` fakes `queueMicrotask`, blocking Svelte 5 `$effect` callbacks. The midnight tests currently pass because their assertions target `$derived` gym-state (responds directly to faked `new Date()`), not `$effect`-initialized component state. But if future midnight tests add assertions on any `$effect`-driven DOM (e.g. accordion expansion, notification badge state), they will silently fail. Quick audit: read `e2e/midnight.spec.ts` and confirm no assertion depends on `$effect`; add a comment documenting the constraint. See MEMORY.md for the full pattern.

### P5: Fair Lawn Public Library availability app
Build a similar scraper + availability app for the Fair Lawn Public Library. Key open questions before starting:
- **Coexistence model**: same repo (monorepo with shared `src/lib/`) vs. separate repo? Shared repo avoids duplicating the Svelte app scaffold and CI workflows, but complicates routing and deployment (two GitHub Pages sites vs. one multi-venue app).
- **Multi-venue app option**: a single app at a shared URL that lets the user toggle between Community Center and Library — may be a better long-term UX than two separate bookmarks.
- **Scraper source**: confirm the Library posts a machine-readable schedule (HTML table, calendar feed, etc.) and identify the target URL before committing to a scraper approach.
- **Data shape**: Library room-booking / hours / events may not map 1:1 to the gym's activity-slot model — the shared `ScheduleData` type may need extension or a new type.

## Done

### ~~P1: Improve timeline bar segment contrast in dark mode~~
### ~~P1: Add PWA support (install to home screen)~~
### ~~P1: Tab-based navigation with 4 dedicated persona views~~
### ~~P1: Fix `VAPID_SUBJECT` — not a real email address~~
### ~~P1: Worker deploy broken — missing `account_id` in `wrangler.toml`~~
### ~~P1: Per-sport notification alerts + notification UX overhaul~~
### ~~P1: Set Cloudflare Worker secrets + end-to-end push verification~~
### ~~P1: CI broken — classifyError.test.ts imports scraper/index.ts triggering Playwright launch~~
### ~~P1: Fix Dependabot high-severity rollup CVEs~~
### ~~⚠️ P1 URGENT: Restore Worker deploy automation + deploy new endpoints~~
### ~~⚠️ P1 URGENT: Fix push-notify.yml cron syntax — 30-min notifications were never firing~~
### ~~⚠️ P1: Verify 30-min push notifications end-to-end~~
### ~~⚠️ P1: Verify slot-freed pipeline end-to-end~~
### ~~P2: Unofficial disclaimer with link to official site~~
### ~~P2: Auto-refresh live data~~
### ~~P2: Subtle activity emoji animations~~
### ~~P2: Day picker, filter chips, and activity filtering~~
### ~~P2: SportWeekCard — "When can I play...?"~~
### ~~P2: Cross-day next open gym in StatusCard~~
### ~~P2: Shareable / deep-linkable URLs~~
### ~~P2: `closedState` Path #6 — open gym anchor mismatch~~
### ~~P2: Scraper `--dry-run` mode~~
### ~~P2: Post-launch backlog sweep — CI hardening, error UX, validation, E2E~~
### ~~P2: Multi-agent review sweep — silent failures, optimistic update correctness, worker robustness~~
### ~~P2: Sport status banner ("Is it on now — and if not, when's next?")~~
### ~~P2: Context-aware bell button — offer single-subject alert from current view~~
### ~~P2: Open Gym chip in Sports tab~~
### ~~P2: Open Gym alerts discoverability~~
### ~~P2: Local dev setup undocumented — `.env.local` required~~
### ~~P2: iCal / Google Calendar export for sport sessions~~
### ~~P2: Slot cancellation alerts — scraper delta-diff + Worker + UI~~
### ~~P2: Crowd-sourced occupancy indicator in Status tab~~
### ~~P2: Auto-correct reversed activity times~~
### ~~P2: Delete freed-slots.json from repo after notification is sent~~
### ~~P2: Unit tests for check-and-notify.mjs~~
### ~~P2: Device receipt of push notifications unconfirmed~~
### ~~P2: check-and-notify.mjs has no observability when nothing is in window~~
### ~~P2: Cron failure alerting — silent notification misses are invisible to the operator~~
### ~~P3: Mobile timeline list — show end times~~
### ~~P3: Deployment cache busting~~
### ~~P3: CI — run tests on push~~
### ~~P3: Scraper resilience monitoring~~
### ~~P3: E2E — timeline content verification on day switch~~
### ~~P3: E2E — Sports tab week summary content verification~~
### ~~P3: `getEasternNow()` spec-safety~~
### ~~P3: `isStale` derived doesn't re-evaluate over time~~
### ~~P3: E2E — back/forward navigation restores URL state~~
### ~~P3: Scraper retry logic~~
### ~~P3: Run `scrape:dry` in CI (scheduled parser smoke test)~~
### ~~P3: E2E test — sport status banner renders correctly~~
### ~~P3: Apply `test.skip()` consistently in E2E tests~~
### ~~P3: Lighthouse CI performance score reliability~~
### ~~P3: Scraper staleness alerting~~
### ~~P3: Scraper resilience — handle Fair Lawn site HTML changes (dry-run subitem)~~
### ~~P3: E2E ready-signal fragility + notif button timeout inconsistency~~
### ~~P3: Fix 30-min timing context in NotifSheet — move to section subtitle~~
### ~~P3: `waitForTimeout(5500)` hard wait in E2E sport notification tests~~
### ~~P3: `NotifSheet.svelte` build a11y warning — `sheet-time-chips` missing ARIA role~~
### ~~P3: `fanOut` network-level send failures not counted in `failed`~~
### ~~P3: `fanOut` network-level send failures not counted in `failed`~~
### ~~P3: Test coverage gaps — classifyError, KV pagination, sportSessionCounts~~
### ~~P3: E2E test for corrected-times badge~~
### ~~P3: `check-sport-sync.mjs` misses `check-and-notify.mjs` — three-way drift risk~~
### ~~P3: `check-sport-sync.mjs` not wired into CI~~
### ~~P3: 2 moderate Dependabot vulnerabilities on main branch~~
### ~~P3: E2E test for occupancy level button click~~
### ~~P3: Cron gap — 30-min ET window around 6:30–7:00 PM~~
### ~~P3: Pipeline verification sends fake notifications to real subscribers~~
### ~~P3: `check-and-notify.mjs` dry-run observability — off-hours runs silently return sent=0~~
### ~~P3: Worker `/unsubscribe` endpoint has no authentication~~
### ~~P3: `cancelAlerts` has no sport dimension — cross-sport freed-slot noise~~
### ~~P3: Subscriber count observability — no way to monitor reach or churn~~
### ~~P3: Gym status display — misleading color and missing open time~~
### ~~P3/P4: E2E coverage for iCal export, occupancy widget, cancelAlerts toggle~~
### ~~P3/P4/P5: fanOut failed counter, esbuild alert, getEasternNow doc, non-2xx test~~
### ~~P3/P3/P4/P4: unsubscribe UX, failed CI highlight, sport E2E, duplicate notification dedup~~
### ~~P3/P4: Scraper error classification, sport chip count badge, Lighthouse threshold~~
### ~~P4: PWA offline support~~
### ~~P4: Scraper test coverage~~
### ~~P4: E2E smoke test with Playwright~~
### ~~P4: Playwright browser caching in CI~~
### ~~P4: Service worker test coverage~~
### ~~P4: DRY — extract `formatEasternDate()` helper~~
### ~~P4: `onSelectSport(null)` unnecessary call on mount in collapsed mode~~
### ~~P4: `untrack()` on `initialDay` in `WeeklySchedule`~~
### ~~P4: Sport chip horizontal scroll on narrow screens~~
### ~~P4: `findNextOpenGymAcrossDays` off-by-one audit~~
### ~~P4: `closedState` Path #6 — open gym anchor mismatch~~
### ~~P4: DRY — extract shared reactive Eastern clock~~
### ~~P4: OpenGraph / social sharing meta tags~~
### ~~P4: WeeklySchedule `{#if expanded}` wrapper cleanup~~
### ~~P4: DayPicker keyboard navigation~~
### ~~P4: "Rest of Week" section — scroll hint on mobile~~
### ~~P4: StatusCard — redundant "First Open Gym" line when same day as reopening~~
### ~~P4: Merge "Schedule" and "Today" tabs into one~~
### ~~P4: Visual regression baselines may be stale after NotifSheet restructure~~
### ~~P4: Daily briefing timing not communicated~~
### ~~P4: Daily briefing fires even when Open Gym section is empty~~
### ~~P4: `data-notif-initialized` not set in the sheet itself~~
### ~~P4: Redundant `role="group"` + `role="radiogroup"` nesting in time picker~~
### ~~P4: Arrow-key handler fires `savePrefs` (API call) on every key-repeat event~~
### ~~P4: Missing unit tests for `dailyBriefingHour` out-of-range validation~~
### ~~P4: NotifSheet denied state visually sparse~~
### ~~P4: Redundant QA screenshot `06-sheet-any-state.png`~~
### ~~P4: Open Gym chip has no "live now" affordance~~
### ~~P4: Active toggle ordering in full NotifSheet SPORTS section~~
### ~~P4: Shift+Tab focus trap direction not tested in `qa-contextual-bell.spec.ts`~~
### ~~P4: Two `qa-notif-sheet.spec.ts` tests use `.sport-week-expanded` as ready signal on `/#sports` (no chip pre-selected)~~
### ~~P4: No QA test for `sortedSports` ordering in NotifSheet~~
### ~~P4: `NotifSheet.svelte` error-path not covered by QA~~
### ~~P4: E2E test for "Manage all alerts →" link in SportWeekCard~~
### ~~P4: Open Gym notification CTA — highlight thirtyMin toggle in sheet~~
### ~~P4: E2E test for Open Gym chip~~
### ~~P4: Visual test masking — Sports tab chip session counts cause spurious baseline drift~~
### ~~P4: Worker end-to-end re-verification after deploy~~
### ~~P4: `cancelAlerts` never delivered to a real device~~
### ~~P4: Worker `fanOut` — per-type dispatch could be its own function~~
### ~~P4: Test suite midnight-safety audit — other describe-scope `new Date()` calls~~
### ~~P4: Empty daily briefing — behavior when today has zero activities is implicit~~
### ~~P4: `dailyBriefingHour ?? 8` default is hardcoded in two places~~
### ~~P4: `freed-slots.json` staleness is unchecked~~
### ~~P5: Accessibility audit & unit testing setup~~
### ~~P5: `computeGymState` gap behavior refinement~~
### ~~P5: npm CI cache for node_modules~~
### ~~P5: Composite action for Playwright setup~~
### ~~P5: Lighthouse CI budget~~
### ~~P5: Dark mode E2E visual regression tests~~
### ~~P5: Clean up string concat workaround in `url.test.ts`~~
### ~~P5: App icon — sport-neutral favicon~~
### ~~P5: Scraper — forward schedule completeness check~~
### ~~P5: CI — extract node_modules cache into composite action~~
### ~~P5: Midnight auto-advance E2E test~~
### ~~P5: Fix unused CSS selector in `ScheduleView.svelte`~~
### ~~P5: `handleContextViewAll` 300ms magic number should reference animation duration~~
### ~~P5: Redundant `notifStore.error = null` in `$effect` `if (!open)` guard~~
### ~~P5: `BASE` URL hardcoded in both `qa-contextual-bell.spec.ts` and `playwright.qa.config.ts`~~
### ~~P5: Open Gym row categorically different from per-sport rows~~
### ~~P5: Visual regression baselines stale — all 3 dark-mode snapshots~~
### ~~P5: `getAvailableSportsAndOpenGym` double-flattens `allActivities`~~
### ~~P5: Notification body length has no hard truncation~~
### ~~P5: `check-sport-sync.mjs` pointing at deleted `scripts/check-and-notify.mjs`~~
### ~~P2/P2/P3/P3/P4: error visibility, visual baselines, daily briefing UX, sport-30min test, time-dependent test~~
