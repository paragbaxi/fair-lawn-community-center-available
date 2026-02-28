/**
 * QA spec for opening-soon gym status teal state.
 * Run with: npx playwright test --config=playwright.qa.config.ts qa-gym-status.spec.ts
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SHOTS = path.join(process.cwd(), '.qa-runs', 'screenshots');

function shot(name: string) {
  fs.mkdirSync(SHOTS, { recursive: true });
  return path.join(SHOTS, name);
}

// Monday 2026-02-23 9:30 AM ET = 14:30:00 UTC
// Building opens 7 AM, Open Gym starts 10 AM → opening-soon window
const OPENING_SOON_TIME = new Date('2026-02-23T14:30:00.000Z');

// ─── Test 1: opening-soon light mode ─────────────────────────────────────────

test('opening-soon status card is visible in light mode', async ({ page }) => {
  // Install clock BEFORE goto so the app boots at the mocked time
  await page.clock.install({ time: OPENING_SOON_TIME });
  await page.goto('/#status');

  await expect(page.locator('.status-card.opening-soon')).toBeVisible();
  await expect(page.locator('p.countdown')).toContainText('Opens in');
  await expect(page.locator('.status-subtext')).toHaveText(
    /Open Gym \d+:\d+ [AP]M\s*[–-]\s*\d+:\d+ [AP]M/
  );

  await page.screenshot({ path: shot('opening-soon-light.png') });
});

// ─── Test 2: opening-soon dark mode ──────────────────────────────────────────

test('opening-soon status card is visible in dark mode', async ({ page }) => {
  // Install clock BEFORE goto so the app boots at the mocked time
  await page.clock.install({ time: OPENING_SOON_TIME });
  await page.goto('/#status');
  await page.emulateMedia({ colorScheme: 'dark' });

  await expect(page.locator('.status-card.opening-soon')).toBeVisible();
  await expect(page.locator('p.countdown')).toContainText('Opens in');
  await expect(page.locator('.status-subtext')).toHaveText(
    /Open Gym \d+:\d+ [AP]M\s*[–-]\s*\d+:\d+ [AP]M/
  );

  await page.screenshot({ path: shot('opening-soon-dark.png') });
});
