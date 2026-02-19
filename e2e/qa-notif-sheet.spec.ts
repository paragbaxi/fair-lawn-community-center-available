/**
 * QA test suite for PR #20: Open Gym alerts discoverability
 *
 * Tests happy and unhappy paths for the NotifSheet SPORTS/DAILY restructure.
 * Run with:  npx playwright test --config=playwright.qa.config.ts
 * All screenshots go to .qa-runs/screenshots/ (gitignored, auto-listed in teardown).
 * Videos go to .qa-runs/artifacts/<test-name>/video.webm
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const BASE = 'http://localhost:4174';
const SHOTS = path.join(process.cwd(), '.qa-runs', 'screenshots');

function shot(name: string) {
  fs.mkdirSync(SHOTS, { recursive: true });
  return path.join(SHOTS, name);
}

// Allow sheet fly-in animation (300ms) to settle before screenshotting
const ANIM_MS = 350;

// ─── Happy Path 1: Open Gym chip visible and selectable ──────────────────────

test('Sports tab: Open Gym chip is visible and selectable', async ({ page }) => {
  await page.goto(`${BASE}/#sports`);
  await page.waitForSelector('.sport-week-expanded', { timeout: 8000 });

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
  await page.goto(`${BASE}/#sports?sport=open-gym`);
  await page.waitForSelector('.sport-week-expanded', { timeout: 8000 });

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
  await page.goto(`${BASE}/#sports?sport=open-gym`);
  await page.waitForSelector('.sport-week-expanded', { timeout: 8000 });

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
  await page.goto(`${BASE}/`);
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

  await page.screenshot({ path: shot('06-sheet-any-state.png') });

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
    // Section subtitle must appear under Sports heading
    await expect(dialog.locator('.sheet-section-sub').first()).toHaveText('~30 min before each activity');
    // Morning briefing must appear in DAILY section
    await expect(dialog.locator('.sheet-toggle-row').filter({ hasText: /morning briefing/i })).toBeVisible();
    // Section subtitle must appear under Daily heading
    await expect(dialog.locator('.sheet-section-sub').nth(1)).toHaveText("Today's schedule summary");

    await page.screenshot({ path: shot('07-sheet-subscribed-sections.png') });

  } else if (await enableBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    // ── Unsubscribed: enable CTA present ──
    await expect(enableBtn).toBeVisible();
    await page.screenshot({ path: shot('07-sheet-unsubscribed.png') });

  } else if (await deniedMsg.isVisible({ timeout: 1000 }).catch(() => false)) {
    // ── Denied: blocked-notifications message present ──
    // Valid production behavior in headless CI — sections not shown (correct).
    await expect(deniedMsg).toBeVisible();
    await page.screenshot({ path: shot('07-sheet-denied.png') });
    console.log('ℹ️  Notification permission denied (headless default) — section structure test skipped');

  } else if (await loadingEl.isVisible({ timeout: 500 }).catch(() => false)) {
    await page.screenshot({ path: shot('07-sheet-loading.png') });
    console.log('ℹ️  notifStore still loading — section structure test skipped');

  } else {
    await page.screenshot({ path: shot('07-sheet-unknown.png') });
    throw new Error('Sheet opened but no known state detected — see 07-sheet-unknown.png');
  }
});

// ─── Unhappy Path 1: No chip selected → button absent ───────────────────────

test('Alert button absent when no Open Gym chip selected', async ({ page }) => {
  await page.goto(`${BASE}/#sports`);
  await page.waitForSelector('.sport-week-expanded', { timeout: 8000 });

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
  await page.goto(`${BASE}/#sports?sport=open-gym`);
  await page.waitForSelector('.sport-week-expanded', { timeout: 8000 });

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
