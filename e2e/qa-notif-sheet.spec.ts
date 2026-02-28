/**
 * QA test suite for PR #20: Open Gym alerts discoverability
 *
 * Tests happy and unhappy paths for the NotifSheet SPORTS/DAILY restructure.
 * Run with:  npx playwright test --config=playwright.qa.config.ts
 * All screenshots go to .qa-runs/screenshots/ (gitignored, auto-listed in teardown).
 * Videos go to .qa-runs/artifacts/<test-name>/video.webm
 */

import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SHOTS = path.join(process.cwd(), '.qa-runs', 'screenshots');

function shot(name: string) {
  fs.mkdirSync(SHOTS, { recursive: true });
  return path.join(SHOTS, name);
}

/**
 * Sets up the page to appear in subscribed state.
 * - Mocks Notification.permission = 'granted'
 * - Mocks PushManager.prototype.getSubscription to return a fake subscription
 * - Sets localStorage with endpoint + prefs
 * - Routes worker API calls to succeed (so savePrefs/toggleSport don't throw)
 */
async function mockSubscribed(page: Page, prefs: {
  thirtyMin?: boolean;
  dailyBriefing?: boolean;
  sports?: string[];
  dailyBriefingHour?: number;
  cancelAlerts?: boolean;
  cancelAlertSports?: string[];
} = {
  thirtyMin: false, dailyBriefing: true, sports: [], dailyBriefingHour: 8,
}) {
  await page.addInitScript((prefsJson: string) => {
    Object.defineProperty(Notification, 'permission', {
      get: () => 'granted',
      configurable: true,
    });
    if (typeof PushManager !== 'undefined') {
      const fakeSubscription = { endpoint: 'https://fake.push.example.com/sub' };
      PushManager.prototype.getSubscription = () => Promise.resolve(fakeSubscription as PushSubscription);
    }
    localStorage.setItem('flcc-push-endpoint', 'https://fake.push.example.com/sub');
    localStorage.setItem('flcc-notif-prefs', prefsJson);
  }, JSON.stringify(prefs));

  await page.route('**/flcc-push.trueto.workers.dev/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
  );
}

// Allow sheet fly-in animation (300ms) to settle before screenshotting
const ANIM_MS = 350;

// ─── Happy Path 1: Open Gym chip visible and selectable ──────────────────────

test('Sports tab: Open Gym chip is visible and selectable', async ({ page }) => {
  await page.goto('/#sports');
  await page.waitForSelector('#panel-sports .sport-chip', { timeout: 8000 });

  const chip = page.locator('.sport-chip-opengym');
  if (!await chip.isVisible({ timeout: 3000 }).catch(() => false)) {
    test.skip(true, 'No Open Gym chip — no open gym sessions scheduled this week');
    return;
  }

  // ── Unselected state ──
  await expect(chip).toHaveAttribute('aria-pressed', 'false');
  await page.screenshot({ path: shot('01-sports-opengym-chip.png') });

  // ── Select chip ──
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');

  // Results or no-results must appear
  const results = page.locator('#panel-sports .week-results');
  const noResults = page.locator('#panel-sports .no-results');
  expect(
    await results.isVisible().catch(() => false) ||
    await noResults.isVisible().catch(() => false)
  ).toBe(true);

  await page.screenshot({ path: shot('02-opengym-chip-selected.png') });
});

// ─── Happy Path 2: Deep link pre-selects chip ───────────────────────────────

test('Deep link #sports?sport=open-gym pre-selects Open Gym chip', async ({ page }) => {
  await page.goto('/#sports?sport=open-gym');
  await page.waitForSelector('#panel-sports .sport-chip', { timeout: 8000 });

  const chip = page.locator('.sport-chip-opengym');
  if (!await chip.isVisible({ timeout: 3000 }).catch(() => false)) {
    test.skip(true, 'No Open Gym chip — no open gym sessions scheduled this week');
    return;
  }

  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: shot('03-opengym-deeplink.png') });
});

// ─── Happy Path 3: Alert CTA opens sheet ────────────────────────────────────

test('"Alert me before Open Gym" button opens My Alerts sheet', async ({ page }) => {
  await page.goto('/#sports?sport=open-gym');
  await page.waitForSelector('#panel-sports .sport-chip', { timeout: 8000 });

  const chip = page.locator('.sport-chip-opengym');
  if (!await chip.isVisible({ timeout: 3000 }).catch(() => false)) {
    test.skip(true, 'No Open Gym chip — no open gym sessions scheduled this week');
    return;
  }

  const alertBtn = page.locator('.sport-notif-btn');
  if (!await alertBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
    test.skip(true, 'No notification button — unsupported or iOS non-standalone context');
    return;
  }

  // Screenshot: button visible before click
  await page.screenshot({ path: shot('04-alert-btn-visible.png') });

  await alertBtn.click();

  // Wait for sheet + animation to settle before screenshotting
  await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 3000 });
  await expect(page.locator('#sheet-title')).toHaveText('My Alerts');
  await page.waitForTimeout(ANIM_MS);

  await page.screenshot({ path: shot('05-sheet-open.png') });
});

// ─── Happy Path 4: My Alerts sheet section structure ────────────────────────

test('My Alerts sheet shows correct section structure', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#tab-sports', { timeout: 8000 });

  // Locate bell / notification settings button
  const bellBtn = page.locator('[aria-label="Notification settings"]').first();
  if (!await bellBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    test.skip(true, 'Cannot locate Notification settings button');
    return;
  }

  await bellBtn.click();

  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible({ timeout: 3000 });
  await page.waitForTimeout(ANIM_MS);   // let fly-in animation settle

  // ── Branch on which state the sheet is in ──────────────────────────────────
  // NotifSheet has 4 states: loading / denied / subscribed / unsubscribed
  // Headless Chromium defaults to 'denied', so we must handle all branches.
  const sportsSection = dialog.locator('h3').filter({ hasText: /^sports$/i });
  const enableBtn     = dialog.locator('.sheet-enable-btn');
  const deniedMsg     = dialog.locator('.sheet-empty-state').filter({ hasText: /blocked/i });
  const loadingEl     = dialog.locator('.sheet-loading');

  if (await sportsSection.isVisible({ timeout: 1000 }).catch(() => false)) {
    // ── Subscribed: assert section order SPORTS → DAILY ──
    const sections = dialog.locator('h3');
    const count = await sections.count();
    const titles: string[] = [];
    for (let i = 0; i < count; i++) {
      titles.push((await sections.nth(i).textContent() ?? '').trim().toLowerCase());
    }
    const sportsIdx = titles.findIndex(t => t === 'sports');
    const dailyIdx  = titles.findIndex(t => t === 'daily');
    expect(sportsIdx).toBeGreaterThanOrEqual(0);
    expect(dailyIdx).toBeGreaterThanOrEqual(0);
    expect(sportsIdx).toBeLessThan(dailyIdx);

    // Open Gym row must appear inside SPORTS section
    await expect(dialog.locator('.sheet-toggle-row').filter({ hasText: /open gym/i })).toBeVisible();
    // Open Gym row must NOT contain the old row-level timing label
    const openGymText = await dialog.locator('.sheet-toggle-row').filter({ hasText: /open gym/i }).textContent();
    expect(openGymText).not.toContain('30-min heads-up');
    // Section subtitle must appear under Sports heading (scoped to Sports section)
    const sportsSect = dialog.locator('section').filter({ has: dialog.locator('h3', { hasText: /^sports$/i }) });
    await expect(sportsSect.locator('.sheet-section-sub')).toHaveText('~30 min before each activity');
    // Morning briefing must appear in DAILY section
    await expect(dialog.locator('.sheet-toggle-row').filter({ hasText: /morning briefing/i })).toBeVisible();
    // Section subtitle must appear under Daily heading (scoped to Daily section)
    const dailySect = dialog.locator('section').filter({ has: dialog.locator('h3', { hasText: /^daily$/i }) });
    await expect(dailySect.locator('.sheet-section-sub')).toHaveText("Today's schedule summary");

    await page.screenshot({ path: shot('06-sheet-subscribed-sections.png') });

  } else if (await enableBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    // ── Unsubscribed: enable CTA present ──
    await expect(enableBtn).toBeVisible();
    await page.screenshot({ path: shot('06-sheet-unsubscribed.png') });

  } else if (await deniedMsg.isVisible({ timeout: 1000 }).catch(() => false)) {
    // ── Denied: blocked-notifications message present ──
    // Valid production behavior in headless CI — sections not shown (correct).
    await expect(deniedMsg).toBeVisible();
    await page.screenshot({ path: shot('06-sheet-denied.png') });
    console.log('ℹ️  Notification permission denied (headless default) — section structure test skipped');

  } else if (await loadingEl.isVisible({ timeout: 500 }).catch(() => false)) {
    await page.screenshot({ path: shot('06-sheet-loading.png') });
    console.log('ℹ️  notifStore still loading — section structure test skipped');

  } else {
    await page.screenshot({ path: shot('06-sheet-unknown.png') });
    throw new Error('Sheet opened but no known state detected — see 06-sheet-unknown.png');
  }
});

// ─── Unhappy Path 1: No chip selected → button absent ───────────────────────

test('Alert button absent when no Open Gym chip selected', async ({ page }) => {
  await page.goto('/#sports');
  await page.waitForSelector('#panel-sports .sport-chip', { timeout: 8000 });

  const chip = page.locator('.sport-chip-opengym');
  if (!await chip.isVisible({ timeout: 3000 }).catch(() => false)) {
    test.skip(true, 'No Open Gym chip — no open gym sessions scheduled this week');
    return;
  }

  // No chip selected → no alert button
  await expect(page.locator('.sport-notif-btn')).not.toBeVisible();
  // Hint text guides user to select a chip
  await expect(page.locator('.hint-text')).toBeVisible();

  await page.screenshot({ path: shot('08-no-chip-no-button.png') });
});

// ─── Unhappy Path 2: Chip deselect restores hint ────────────────────────────

test('Deselecting Open Gym chip restores hint text', async ({ page }) => {
  await page.goto('/#sports?sport=open-gym');
  await page.waitForSelector('#panel-sports .sport-chip', { timeout: 8000 });

  const chip = page.locator('.sport-chip-opengym');
  if (!await chip.isVisible({ timeout: 3000 }).catch(() => false)) {
    test.skip(true, 'No Open Gym chip — no open gym sessions scheduled this week');
    return;
  }

  // Chip pre-selected by URL
  await expect(chip).toHaveAttribute('aria-pressed', 'true');

  // Deselect and wait for animation to settle
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'false');
  await page.waitForTimeout(ANIM_MS);

  // Hint text returns; alert button gone
  await expect(page.locator('#panel-sports .hint-text')).toBeVisible();
  await expect(page.locator('.sport-notif-btn')).not.toBeVisible();

  await page.screenshot({ path: shot('09-chip-deselected.png') });
});

// ─── Happy Path 5: Enabled sports sort before disabled in SPORTS section ─────

test('Enabled sports sort before disabled in NotifSheet SPORTS section', async ({ page }) => {
  await mockSubscribed(page, { thirtyMin: false, dailyBriefing: true, sports: ['basketball'], dailyBriefingHour: 8 });
  await page.goto('/');
  await page.waitForSelector('[aria-label="Notification settings"]', { timeout: 10000 });
  await page.locator('[aria-label="Notification settings"]').click();

  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible({ timeout: 3000 });
  await page.waitForSelector('[role="dialog"] [data-notif-initialized]', { timeout: 6000 });
  await page.waitForTimeout(ANIM_MS);

  // Must be in subscribed state for the SPORTS section to appear
  const sportsSect = dialog.locator('section').filter({ has: dialog.locator('h3', { hasText: /^sports$/i }) });
  if (!await sportsSect.isVisible({ timeout: 1000 }).catch(() => false)) {
    test.skip(true, 'Not in subscribed state — cannot verify sort order');
    return;
  }

  // All per-sport toggles (excludes Open Gym, which has a distinct aria-label)
  const sportToggles = sportsSect.locator('button[role="switch"]:not([aria-label="Open Gym 30-min heads-up"]):not([aria-label="Cancelled session alerts"])');
  const count = await sportToggles.count();
  if (count < 2) {
    test.skip(true, 'Fewer than 2 sports scheduled this week — cannot verify sort order');
    return;
  }

  // Basketball must appear in the list to be the enabled sport for this test
  const hasBasketball = await sportsSect
    .locator('button[role="switch"][aria-label="Basketball"]')
    .isVisible({ timeout: 500 }).catch(() => false);
  if (!hasBasketball) {
    test.skip(true, 'Basketball not scheduled this week — cannot verify enabled sport sorts first');
    return;
  }

  // First toggle must be the enabled one (Basketball); all subsequent must be disabled
  await expect(sportToggles.first()).toHaveAttribute('aria-checked', 'true');
  await expect(sportToggles.first()).toHaveAttribute('aria-label', 'Basketball');
  for (let i = 1; i < count; i++) {
    await expect(sportToggles.nth(i)).toHaveAttribute('aria-checked', 'false');
  }

  await page.screenshot({ path: shot('10-sort-enabled-first.png') });
});

// ─── Happy Path 6: cancelAlerts toggle row present in SPORTS section ─────────

test('cancelAlerts toggle row is present in NotifSheet SPORTS section', async ({ page }) => {
  await mockSubscribed(page);
  await page.goto('/');
  await page.waitForSelector('[aria-label="Notification settings"]', { timeout: 10000 });
  await page.locator('[aria-label="Notification settings"]').click();

  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible({ timeout: 3000 });
  await page.waitForSelector('[role="dialog"] [data-notif-initialized]', { timeout: 6000 });
  await page.waitForTimeout(ANIM_MS);

  // Guard: must be in subscribed state for the SPORTS section to appear
  const sportsSect = dialog.locator('section').filter({ has: dialog.locator('h3', { hasText: /^sports$/i }) });
  if (!await sportsSect.isVisible({ timeout: 1000 }).catch(() => false)) {
    test.skip(true, 'Not in subscribed state — permission denied or store not initialized');
    return;
  }

  // The cancelAlerts toggle row must be visible inside the SPORTS section
  const cancelRow = sportsSect.locator('.sheet-toggle-row').filter({ hasText: /Alert me if a session is cancelled/i });
  await expect(cancelRow).toBeVisible();

  // The toggle button must have role="switch"
  const cancelToggle = cancelRow.locator('button[role="switch"][aria-label="Cancelled session alerts"]');
  await expect(cancelToggle).toBeVisible();

  // Default state is off (cancelAlerts is not set in default prefs → aria-checked="false")
  await expect(cancelToggle).toHaveAttribute('aria-checked', 'false');

  await page.screenshot({ path: shot('12-cancel-alerts-toggle.png') });
});

// ─── Unhappy Path 3: Network error on sport toggle ───────────────────────────

test('network error on sport toggle: inline error shown, toggle reverts, sheet stays open', async ({ page }) => {
  await mockSubscribed(page, { thirtyMin: false, dailyBriefing: true, sports: [], dailyBriefingHour: 8 });
  // Override to 500 after mockSubscribed — LIFO order ensures this handler fires first
  await page.route('**/flcc-push.trueto.workers.dev/**', route =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"internal"}' })
  );
  await page.goto('/');
  await page.waitForSelector('[aria-label="Notification settings"]', { timeout: 10000 });
  await page.locator('[aria-label="Notification settings"]').click();

  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible({ timeout: 3000 });
  await page.waitForSelector('[role="dialog"] [data-notif-initialized]', { timeout: 6000 });
  await page.waitForTimeout(ANIM_MS);

  // Must be in subscribed state
  const sportsSect = dialog.locator('section').filter({ has: dialog.locator('h3', { hasText: /^sports$/i }) });
  if (!await sportsSect.isVisible({ timeout: 1000 }).catch(() => false)) {
    test.skip(true, 'Not in subscribed state — cannot test error path');
    return;
  }

  // Find first per-sport toggle (excludes Open Gym and cancelAlerts)
  const sportToggles = sportsSect.locator('button[role="switch"]:not([aria-label="Open Gym 30-min heads-up"]):not([aria-label="Cancelled session alerts"])');
  if (await sportToggles.count() === 0) {
    test.skip(true, 'No sports scheduled this week — cannot test toggle error path');
    return;
  }

  const firstToggle = sportToggles.first();
  await expect(firstToggle).toHaveAttribute('aria-checked', 'false');

  // Click toggle — worker returns 500 → notifStore sets error, rolls back optimistic update
  await firstToggle.click();

  // Inline error alert must appear inside the sheet
  await expect(dialog.locator('.sheet-error[role="alert"]')).toBeVisible({ timeout: 3000 });

  // Toggle must revert to unchecked (optimistic rollback)
  await expect(firstToggle).toHaveAttribute('aria-checked', 'false');

  // Sheet stays open so user can retry
  await expect(dialog).toBeVisible();

  await page.screenshot({ path: shot('11-error-toggle-reverts.png') });
});

// ─── cancelAlertSports chips ─────────────────────────────────────────────────

test.describe('cancelAlertSports chips', () => {
  test('chip group is visible and first chip toggles to pressed', async ({ page }) => {
    await mockSubscribed(page, {
      thirtyMin: false,
      dailyBriefing: true,
      sports: [],
      dailyBriefingHour: 8,
      cancelAlerts: true,
      cancelAlertSports: [],
    });

    await page.goto('/');
    await page.waitForSelector('[aria-label="Notification settings"]', { timeout: 10000 });
    await page.locator('[aria-label="Notification settings"]').click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 3000 });
    await page.waitForSelector('[role="dialog"] [data-notif-initialized]', { timeout: 6000 });
    await page.waitForTimeout(ANIM_MS);

    // Guard: must be in subscribed state for the SPORTS section to appear
    const sportsSect = dialog.locator('section').filter({ has: dialog.locator('h3', { hasText: /^sports$/i }) });
    if (!await sportsSect.isVisible({ timeout: 1000 }).catch(() => false)) {
      test.skip(true, 'Not in subscribed state — cannot verify cancelAlertSports chips');
      return;
    }

    // The cancellation alert sports chip group must be visible
    // aria-label from NotifSheet.svelte line 172: aria-label="Cancellation alert sports"
    const chipGroup = dialog.locator('[aria-label="Cancellation alert sports"]');
    await expect(chipGroup).toBeVisible();

    // Find the first sport chip in the group
    // Individual chips use aria-label="{sport.label} cancellation alert" and aria-pressed
    const firstChip = chipGroup.locator('button').first();

    // Initially unselected: cancelAlertSports is [] so no chip is pressed
    await expect(firstChip).toHaveAttribute('aria-pressed', 'false');

    // Override route to succeed (takes precedence over the mockSubscribed route via LIFO)
    await page.route('**/flcc-push.trueto.workers.dev/**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
    );

    // Click the chip — it should become pressed
    await firstChip.click();
    await expect(firstChip).toHaveAttribute('aria-pressed', 'true');

    await page.screenshot({ path: shot('cancel-alert-chips.png') });
  });
});
