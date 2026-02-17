import { test, expect } from '@playwright/test';

// Monday 2025-01-06 23:59:55 EST = 2025-01-07T04:59:55.000Z UTC
// Jan 6 2025 was a real Monday; after tick(10_000) the clock crosses midnight to Tuesday
const MONDAY_11_59_55_PM_EST = new Date('2025-01-07T04:59:55.000Z');

test.describe('midnight auto-advance', () => {
  test('advances selectedDay from Monday to Tuesday at midnight ET', async ({ page }) => {
    // Install clock BEFORE goto so the app boots at the mocked time
    await page.clock.install({ time: MONDAY_11_59_55_PM_EST });
    await page.goto('/#today');
    await expect(page.locator('#panel-today')).not.toHaveAttribute('hidden', '');

    // Verify app initialized with Monday selected
    await expect(
      page.locator('.day-btn[aria-pressed="true"] .day-label'),
    ).toHaveText('Mon');

    // Tick 10 seconds past midnight — triggers the 10s setInterval → gymState recomputes
    await page.clock.fastForward(10_000);

    // selectedDay should auto-advance to Tuesday
    await expect(
      page.locator('.day-btn[aria-pressed="true"] .day-label'),
    ).toHaveText('Tue', { timeout: 5000 });

    // URL reflects the new day
    await expect(page).toHaveURL(/#today\?day=Tuesday/);
  });

  test('does NOT advance when user manually selected a different day', async ({ page }) => {
    await page.clock.install({ time: MONDAY_11_59_55_PM_EST });
    await page.goto('/#today');
    await expect(page.locator('#panel-today')).not.toHaveAttribute('hidden', '');

    const wedBtn = page.locator('.day-btn').filter({ hasText: 'Wed' });
    if (await wedBtn.isDisabled()) {
      test.skip(true, 'Wednesday has no schedule — cannot test manual override');
      return;
    }
    await wedBtn.click();
    await expect(wedBtn).toHaveAttribute('aria-pressed', 'true');

    // Cross midnight
    await page.clock.fastForward(10_000);
    await page.waitForTimeout(500); // let reactive effects settle

    // Wednesday remains selected — user choice is preserved
    await expect(
      page.locator('.day-btn[aria-pressed="true"] .day-label'),
    ).toHaveText('Wed');
  });
});
