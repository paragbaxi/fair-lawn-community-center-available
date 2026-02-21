/**
 * QA test suite for P2: Context-Aware Bell Button
 *
 * Tests the contextual mini-sheet that appears when the bell is tapped on the
 * Sports tab with a sport chip selected (and the alert is not yet on).
 *
 * Two categories:
 *  - Headless defaults (denied/prompt): bell always opens full NotifSheet
 *  - Mocked subscribed state: bell opens 140px contextual mini-sheet
 *
 * Run with:  npx playwright test --config=playwright.qa.config.ts
 */

import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SHOTS = path.join(process.cwd(), '.qa-runs', 'screenshots');

// Allow sheet fly-in animation (300ms) to settle before screenshotting
const ANIM_MS = 350;

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
async function mockSubscribed(page: Page, prefs = {
  thirtyMin: false, dailyBriefing: true, sports: [] as string[], dailyBriefingHour: 8,
}) {
  await page.addInitScript((prefsJson: string) => {
    // Override Notification.permission
    Object.defineProperty(Notification, 'permission', {
      get: () => 'granted',
      configurable: true,
    });
    // Mock pushManager.getSubscription — makes getState() return 'subscribed'
    if (typeof PushManager !== 'undefined') {
      const fakeSubscription = { endpoint: 'https://fake.push.example.com/sub' };
      PushManager.prototype.getSubscription = () => Promise.resolve(fakeSubscription as PushSubscription);
    }
    // Set localStorage so getStoredPrefs() returns our test prefs
    localStorage.setItem('flcc-push-endpoint', 'https://fake.push.example.com/sub');
    localStorage.setItem('flcc-notif-prefs', prefsJson);
  }, JSON.stringify(prefs));

  // Intercept Cloudflare Worker API — savePrefs/toggleSport call PATCH /subscription
  await page.route('**/flcc-push.trueto.workers.dev/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
  );
}

/** Wait for the bell button to be ready (requires data + notifStore initialized). */
async function waitForBell(page: Page) {
  await page.waitForSelector('[aria-label="Notification settings"]', { timeout: 10000 });
}

// ─── Headless defaults (no mini-sheet) ───────────────────────────────────────

test('Status tab: bell opens full NotifSheet, no mini-sheet', async ({ page }) => {
  await page.goto('/');
  await waitForBell(page);

  const bell = page.locator('[aria-label="Notification settings"]');
  await bell.click();

  // Full sheet open
  await expect(page.locator('#sheet-title')).toBeVisible({ timeout: 3000 });
  await page.waitForTimeout(ANIM_MS);

  // Mini-sheet NOT open
  await expect(page.locator('#ctx-title')).not.toBeVisible();

  await page.screenshot({ path: shot('cb-01-status-tab-full-sheet.png') });
});

test('Sports tab, no chip selected: bell opens full NotifSheet', async ({ page }) => {
  await page.goto('/#sports');
  await waitForBell(page);

  const bell = page.locator('[aria-label="Notification settings"]');
  await bell.click();

  await expect(page.locator('#sheet-title')).toBeVisible({ timeout: 3000 });
  await page.waitForTimeout(ANIM_MS);
  await expect(page.locator('#ctx-title')).not.toBeVisible();

  await page.screenshot({ path: shot('cb-02-sports-no-chip-full-sheet.png') });
});

test('Sports tab, chip selected, push denied: bell opens full NotifSheet (blocked state)', async ({ page }) => {
  await page.goto('/#sports');
  await waitForBell(page);

  // Select first chip
  const chip = page.locator('#panel-sports .sport-chip').first();
  if (!await chip.isVisible({ timeout: 3000 }).catch(() => false)) {
    test.skip(true, 'No sport chips available — schedule data may be empty');
    return;
  }
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');

  // In headless Chromium, permission is denied → bell opens full sheet
  const bell = page.locator('[aria-label="Notification settings"]');
  await bell.click();

  await expect(page.locator('#sheet-title')).toBeVisible({ timeout: 3000 });
  await page.waitForTimeout(ANIM_MS);
  await expect(page.locator('#ctx-title')).not.toBeVisible();

  await page.screenshot({ path: shot('cb-03-chip-selected-denied-full-sheet.png') });
});

// ─── Mocked subscribed state — mini-sheet appears ────────────────────────────

test('Chip selected + alert OFF + subscribed: mini-sheet slides up', async ({ page }) => {
  await mockSubscribed(page, { thirtyMin: false, dailyBriefing: true, sports: [], dailyBriefingHour: 8 });
  await page.goto('/#sports');
  await waitForBell(page);

  const chip = page.locator('#panel-sports .sport-chip').first();
  if (!await chip.isVisible({ timeout: 3000 }).catch(() => false)) {
    test.skip(true, 'No sport chips available — schedule data may be empty');
    return;
  }
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');

  const bell = page.locator('[aria-label="Notification settings"]');
  await bell.click();

  // Mini-sheet must be visible, full sheet must NOT be
  await expect(page.locator('#ctx-title')).toBeVisible({ timeout: 3000 });
  await expect(page.locator('#sheet-title')).not.toBeVisible();
  await page.waitForTimeout(ANIM_MS);

  // Headline format: "Get notified before <sport>"
  const headline = await page.locator('#ctx-title').textContent();
  expect(headline).toMatch(/Get notified before/i);

  // Both CTA and view-all buttons present
  await expect(page.locator('.ctx-cta')).toBeVisible();
  await expect(page.locator('.ctx-view-all')).toBeVisible();

  // bell aria-expanded is true
  await expect(bell).toHaveAttribute('aria-expanded', 'true');

  await page.screenshot({ path: shot('cb-04-mini-sheet-open.png') });
});

test('Open Gym chip + thirtyMin:false: headline reads "Get notified before Open Gym"', async ({ page }) => {
  await mockSubscribed(page, { thirtyMin: false, dailyBriefing: true, sports: [], dailyBriefingHour: 8 });
  await page.goto('/#sports');
  await waitForBell(page);

  const chip = page.locator('.sport-chip-opengym');
  if (!await chip.isVisible({ timeout: 3000 }).catch(() => false)) {
    test.skip(true, 'No Open Gym chip — no open gym sessions this week');
    return;
  }
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');

  await page.locator('[aria-label="Notification settings"]').click();

  await expect(page.locator('#ctx-title')).toBeVisible({ timeout: 3000 });
  await page.waitForTimeout(ANIM_MS);

  const headline = await page.locator('#ctx-title').textContent();
  expect(headline).toMatch(/Get notified before Open Gym/i);

  await page.screenshot({ path: shot('cb-05-open-gym-mini-sheet.png') });
});

test('"Turn on alerts" → snackbar appears, mini-sheet closes', async ({ page }) => {
  await mockSubscribed(page, { thirtyMin: false, dailyBriefing: true, sports: [], dailyBriefingHour: 8 });
  await page.goto('/#sports');
  await waitForBell(page);

  const chip = page.locator('#panel-sports .sport-chip').first();
  if (!await chip.isVisible({ timeout: 3000 }).catch(() => false)) {
    test.skip(true, 'No sport chips available');
    return;
  }
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');

  await page.locator('[aria-label="Notification settings"]').click();
  await expect(page.locator('#ctx-title')).toBeVisible({ timeout: 3000 });
  await page.waitForTimeout(ANIM_MS);

  // Click "Turn on alerts" CTA
  await page.locator('.ctx-cta').click();

  // Snackbar should appear with success message (use .snackbar — multiple role=status in DOM)
  await expect(page.locator('.snackbar')).toBeVisible({ timeout: 3000 });
  const msg = await page.locator('.snackbar').textContent();
  expect(msg).toMatch(/alerts on/i);

  // Mini-sheet should close
  await expect(page.locator('#ctx-title')).not.toBeVisible({ timeout: 2000 });
  await page.waitForTimeout(ANIM_MS);

  await page.screenshot({ path: shot('cb-06-snackbar-after-alert-on.png') });
});

test('"View all alerts" → mini-sheet closes, full NotifSheet opens', async ({ page }) => {
  await mockSubscribed(page, { thirtyMin: false, dailyBriefing: true, sports: [], dailyBriefingHour: 8 });
  await page.goto('/#sports');
  await waitForBell(page);

  const chip = page.locator('#panel-sports .sport-chip').first();
  if (!await chip.isVisible({ timeout: 3000 }).catch(() => false)) {
    test.skip(true, 'No sport chips available');
    return;
  }
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');

  await page.locator('[aria-label="Notification settings"]').click();
  await expect(page.locator('#ctx-title')).toBeVisible({ timeout: 3000 });
  await page.waitForTimeout(ANIM_MS);

  await page.screenshot({ path: shot('cb-07a-mini-sheet-before-view-all.png') });

  // Click "View all alerts"
  await page.locator('.ctx-view-all').click();

  // Full sheet should open
  await expect(page.locator('#sheet-title')).toBeVisible({ timeout: 4000 });
  await expect(page.locator('#ctx-title')).not.toBeVisible();
  await page.waitForTimeout(ANIM_MS);

  await page.screenshot({ path: shot('cb-07b-full-sheet-after-view-all.png') });
});

test('Backdrop click → mini-sheet dismisses', async ({ page }) => {
  await mockSubscribed(page, { thirtyMin: false, dailyBriefing: true, sports: [], dailyBriefingHour: 8 });
  await page.goto('/#sports');
  await waitForBell(page);

  const chip = page.locator('#panel-sports .sport-chip').first();
  if (!await chip.isVisible({ timeout: 3000 }).catch(() => false)) {
    test.skip(true, 'No sport chips available');
    return;
  }
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');

  await page.locator('[aria-label="Notification settings"]').click();
  await expect(page.locator('#ctx-title')).toBeVisible({ timeout: 3000 });
  await page.waitForTimeout(ANIM_MS);

  // Click backdrop
  await page.locator('.ctx-backdrop').click();
  await expect(page.locator('#ctx-title')).not.toBeVisible({ timeout: 2000 });

  await page.screenshot({ path: shot('cb-08-backdrop-dismiss.png') });
});

test('Escape key → mini-sheet closes, focus returns to bell', async ({ page }) => {
  await mockSubscribed(page, { thirtyMin: false, dailyBriefing: true, sports: [], dailyBriefingHour: 8 });
  await page.goto('/#sports');
  await waitForBell(page);

  const chip = page.locator('#panel-sports .sport-chip').first();
  if (!await chip.isVisible({ timeout: 3000 }).catch(() => false)) {
    test.skip(true, 'No sport chips available');
    return;
  }
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');

  await page.locator('[aria-label="Notification settings"]').click();
  await expect(page.locator('#ctx-title')).toBeVisible({ timeout: 3000 });
  await page.waitForTimeout(ANIM_MS);

  await page.keyboard.press('Escape');
  await expect(page.locator('#ctx-title')).not.toBeVisible({ timeout: 2000 });

  // Focus returns to bell
  const focusedLabel = await page.evaluate(() =>
    document.activeElement?.getAttribute('aria-label')
  );
  expect(focusedLabel).toBe('Notification settings');

  await page.screenshot({ path: shot('cb-09-escape-dismiss.png') });
});

test('Tab key cycles focus within mini-sheet (focus trap)', async ({ page }) => {
  await mockSubscribed(page, { thirtyMin: false, dailyBriefing: true, sports: [], dailyBriefingHour: 8 });
  await page.goto('/#sports');
  await waitForBell(page);

  const chip = page.locator('#panel-sports .sport-chip').first();
  if (!await chip.isVisible({ timeout: 3000 }).catch(() => false)) {
    test.skip(true, 'No sport chips available');
    return;
  }
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');

  await page.locator('[aria-label="Notification settings"]').click();
  await expect(page.locator('#ctx-title')).toBeVisible({ timeout: 3000 });
  await page.waitForTimeout(ANIM_MS);

  // Initial focus is on CTA button
  const ctaFocused = await page.evaluate(() =>
    document.activeElement?.classList.contains('ctx-cta')
  );
  expect(ctaFocused).toBe(true);

  // Tab to "View all alerts" button
  await page.keyboard.press('Tab');
  const viewAllFocused = await page.evaluate(() =>
    document.activeElement?.classList.contains('ctx-view-all')
  );
  expect(viewAllFocused).toBe(true);

  // Tab again → wraps back to CTA (focus trap)
  await page.keyboard.press('Tab');
  const wrappedToCtaFocused = await page.evaluate(() =>
    document.activeElement?.classList.contains('ctx-cta')
  );
  expect(wrappedToCtaFocused).toBe(true);
});

test('Shift+Tab key cycles focus backwards within mini-sheet (focus trap)', async ({ page }) => {
  await mockSubscribed(page, { thirtyMin: false, dailyBriefing: true, sports: [], dailyBriefingHour: 8 });
  await page.goto('/#sports');
  await waitForBell(page);

  const chip = page.locator('#panel-sports .sport-chip').first();
  if (!await chip.isVisible({ timeout: 3000 }).catch(() => false)) {
    test.skip(true, 'No sport chips available');
    return;
  }
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');

  await page.locator('[aria-label="Notification settings"]').click();
  await expect(page.locator('#ctx-title')).toBeVisible({ timeout: 3000 });
  await page.waitForTimeout(ANIM_MS);

  // Initial focus is on CTA (first focusable element)
  expect(await page.evaluate(() =>
    document.activeElement?.classList.contains('ctx-cta')
  )).toBe(true);

  // Shift+Tab from first → trap intercepts → wraps to last (View all)
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() =>
    document.activeElement?.classList.contains('ctx-view-all')
  )).toBe(true);

  // Shift+Tab from last → no trap → browser goes to prev DOM element = CTA
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() =>
    document.activeElement?.classList.contains('ctx-cta')
  )).toBe(true);
});

test('Sport alert already ON: bell opens full NotifSheet, no mini-sheet', async ({ page }) => {
  // basketball alert is ON
  await mockSubscribed(page, { thirtyMin: false, dailyBriefing: true, sports: ['basketball'], dailyBriefingHour: 8 });
  await page.goto('/#sports?sport=basketball');
  await waitForBell(page);

  // Wait for sport chip to be selected
  const chip = page.locator('.sport-chip[aria-pressed="true"]').first();
  if (!await chip.isVisible({ timeout: 3000 }).catch(() => false)) {
    test.skip(true, 'Basketball chip not available this week');
    return;
  }

  await page.locator('[aria-label="Notification settings"]').click();

  // Full sheet should open, NOT mini-sheet
  await expect(page.locator('#sheet-title')).toBeVisible({ timeout: 3000 });
  await expect(page.locator('#ctx-title')).not.toBeVisible();
  await page.waitForTimeout(ANIM_MS);

  await page.screenshot({ path: shot('cb-10-alert-on-opens-full-sheet.png') });
});

test('Snackbar auto-dismisses after 2.5s (clock fast-forward)', async ({ page }) => {
  await page.clock.install();
  await mockSubscribed(page, { thirtyMin: false, dailyBriefing: true, sports: [], dailyBriefingHour: 8 });
  await page.goto('/#sports');
  await waitForBell(page);

  const chip = page.locator('#panel-sports .sport-chip').first();
  if (!await chip.isVisible({ timeout: 3000 }).catch(() => false)) {
    test.skip(true, 'No sport chips available');
    return;
  }
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');

  await page.locator('[aria-label="Notification settings"]').click();
  await expect(page.locator('#ctx-title')).toBeVisible({ timeout: 3000 });
  await page.waitForTimeout(ANIM_MS);

  await page.locator('.ctx-cta').click();

  // Snackbar appears (use .snackbar — multiple role=status elements in DOM)
  await expect(page.locator('.snackbar')).toBeVisible({ timeout: 3000 });

  await page.screenshot({ path: shot('cb-11a-snackbar-visible.png') });

  // Fast-forward past the 2500ms dismiss timer
  await page.clock.fastForward(2600);

  await expect(page.locator('.snackbar')).not.toBeVisible({ timeout: 2000 });

  await page.screenshot({ path: shot('cb-11b-snackbar-dismissed.png') });
});

test('Snackbar has correct ARIA role="status" and aria-live="polite"', async ({ page }) => {
  await mockSubscribed(page, { thirtyMin: false, dailyBriefing: true, sports: [], dailyBriefingHour: 8 });
  await page.goto('/#sports');
  await waitForBell(page);

  const chip = page.locator('#panel-sports .sport-chip').first();
  if (!await chip.isVisible({ timeout: 3000 }).catch(() => false)) {
    test.skip(true, 'No sport chips available');
    return;
  }
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');

  await page.locator('[aria-label="Notification settings"]').click();
  await expect(page.locator('#ctx-title')).toBeVisible({ timeout: 3000 });
  await page.waitForTimeout(ANIM_MS);

  await page.locator('.ctx-cta').click();

  // Use .snackbar class — multiple role=status elements exist in the DOM
  const snackbar = page.locator('.snackbar');
  await expect(snackbar).toBeVisible({ timeout: 3000 });
  await expect(snackbar).toHaveAttribute('role', 'status');
  await expect(snackbar).toHaveAttribute('aria-live', 'polite');
  await expect(snackbar).toHaveAttribute('aria-atomic', 'true');
});

test('Chip change while mini-sheet open → mini-sheet auto-closes', async ({ page }) => {
  await mockSubscribed(page, { thirtyMin: false, dailyBriefing: true, sports: [], dailyBriefingHour: 8 });
  await page.goto('/#sports');
  await waitForBell(page);

  const chips = page.locator('#panel-sports .sport-chip');
  const chipCount = await chips.count();
  if (chipCount < 2) {
    test.skip(true, 'Need at least 2 sport chips to test chip change');
    return;
  }

  // Select first chip and open mini-sheet
  const firstChip = chips.nth(0);
  await firstChip.click();
  await expect(firstChip).toHaveAttribute('aria-pressed', 'true');

  await page.locator('[aria-label="Notification settings"]').click();
  await expect(page.locator('#ctx-title')).toBeVisible({ timeout: 3000 });
  await page.waitForTimeout(ANIM_MS);

  await page.screenshot({ path: shot('cb-12a-mini-sheet-open-chip1.png') });

  // Navigate via URL to change selectedSport — can't click chip directly (backdrop intercepts).
  // The hashchange handler in App.svelte sets selectedSport = null when no sport param.
  await page.evaluate(() => { window.location.hash = '#sports'; });

  // Mini-sheet should auto-close (the $effect guard detects sport mismatch)
  await expect(page.locator('#ctx-title')).not.toBeVisible({ timeout: 3000 });

  await page.screenshot({ path: shot('cb-12b-mini-sheet-auto-closed.png') });
});

test('network error: inline error shown, snackbar NOT fired, sheet stays open for retry', async ({ page }) => {
  await mockSubscribed(page, { thirtyMin: false, dailyBriefing: true, sports: [], dailyBriefingHour: 8 });
  // Override worker route to return 500 — registered after mockSubscribed so Playwright
  // LIFO order ensures this handler fires first, making updatePrefs() throw.
  await page.route('**/flcc-push.trueto.workers.dev/**', route =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"internal"}' })
  );

  await page.goto('/#sports');
  await waitForBell(page);

  const chip = page.locator('#panel-sports .sport-chip').first();
  if (!await chip.isVisible({ timeout: 3000 }).catch(() => false)) {
    test.skip(true, 'No sport chips available');
    return;
  }
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');

  await page.locator('[aria-label="Notification settings"]').click();
  await expect(page.locator('#ctx-title')).toBeVisible({ timeout: 3000 });
  await page.waitForTimeout(ANIM_MS);

  // Click "Turn on alerts" — worker returns 500 → updatePrefs throws → notifStore.error set
  await page.locator('.ctx-cta').click();

  // Inline error alert must appear inside the sheet
  await expect(page.locator('.ctx-error[role="alert"]')).toBeVisible({ timeout: 3000 });

  // Snackbar must NOT appear (onAlertOn was never called)
  await expect(page.locator('.snackbar')).not.toBeVisible();

  // Sheet stays open so user can retry
  await expect(page.locator('#ctx-title')).toBeVisible();

  await page.screenshot({ path: shot('cb-13-error-path-inline-error.png') });
});
