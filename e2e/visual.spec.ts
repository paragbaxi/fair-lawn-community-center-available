import { test, expect } from '@playwright/test';

const MASK = ['.countdown', '.compact-status'];

test.describe('dark mode visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' }); // explicit + project level
    await page.goto('/');
    await expect(page.locator('.status-card')).toBeVisible();
  });

  test('Status tab', async ({ page }) => {
    await expect(page).toHaveScreenshot('status-dark.png', {
      mask: MASK.map(s => page.locator(s)),
      maxDiffPixelRatio: 0.02,
    });
  });

  test('Today tab', async ({ page }) => {
    await page.locator('#tab-today').click();
    await expect(page.locator('#panel-today')).not.toHaveAttribute('hidden', '');
    await expect(page).toHaveScreenshot('today-dark.png', {
      mask: MASK.map(s => page.locator(s)),
      maxDiffPixelRatio: 0.02,
    });
  });

  test('Sports tab', async ({ page }) => {
    await page.locator('#tab-sports').click();
    await expect(page.locator('#panel-sports')).not.toHaveAttribute('hidden', '');
    const SPORTS_MASK = [...MASK, '.chip-count', '.sport-status-banner'];
    await expect(page).toHaveScreenshot('sports-dark.png', {
      mask: SPORTS_MASK.map(s => page.locator(s)),
      maxDiffPixelRatio: 0.02,
    });
  });

});
