import { test, expect } from '@playwright/test';

test('page loads with correct title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Fair Lawn/);
});

test('status card renders with a status class', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('.status-card');
  await expect(card).toBeVisible();
  // Card should have one of: available, in-use, closed
  const classes = await card.getAttribute('class');
  expect(classes).toMatch(/available|in-use|closed/);
});

test('skip link becomes visible on focus', async ({ page }) => {
  await page.goto('/');
  const skipLink = page.locator('.skip-link');
  // Skip link is off-screen by default
  await expect(skipLink).not.toBeInViewport();
  // Focus it and verify it becomes visible (the :focus CSS makes it position: fixed)
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeInViewport();
});

test('tab switching shows correct panels', async ({ page }) => {
  await page.goto('/');
  // Wait for data to load
  await expect(page.locator('.status-card')).toBeVisible();

  // Default tab is Status — status panel should be visible
  const statusPanel = page.locator('#panel-status');
  await expect(statusPanel).not.toHaveAttribute('hidden', '');

  // Click Today tab
  await page.locator('#tab-today').click();
  await expect(page.locator('#panel-today')).not.toHaveAttribute('hidden', '');
  await expect(statusPanel).toHaveAttribute('hidden', '');

  // Click Sports tab
  await page.locator('#tab-sports').click();
  await expect(page.locator('#panel-sports')).not.toHaveAttribute('hidden', '');
  await expect(page.locator('#panel-today')).toHaveAttribute('hidden', '');

  // Click Schedule tab
  await page.locator('#tab-schedule').click();
  await expect(page.locator('#panel-schedule')).not.toHaveAttribute('hidden', '');
  await expect(page.locator('#panel-sports')).toHaveAttribute('hidden', '');

  // Click Status tab to go back
  await page.locator('#tab-status').click();
  await expect(statusPanel).not.toHaveAttribute('hidden', '');
});

test('compact status bar visible on Today tab only', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.status-card')).toBeVisible();

  // Status tab — no compact status
  await expect(page.locator('.compact-status')).not.toBeVisible();

  // Today tab — compact status visible
  await page.locator('#tab-today').click();
  await expect(page.locator('.compact-status')).toBeVisible();

  // Sports tab — no compact status
  await page.locator('#tab-sports').click();
  await expect(page.locator('.compact-status')).not.toBeVisible();

  // Schedule tab — no compact status
  await page.locator('#tab-schedule').click();
  await expect(page.locator('.compact-status')).not.toBeVisible();
});

test('hash routing navigates to correct tab', async ({ page }) => {
  await page.goto('/#sports');
  // Wait for data to load (tab bar appears after load)
  await expect(page.locator('#tab-sports')).toBeVisible({ timeout: 5000 });
  // Sports panel should be active
  await expect(page.locator('#panel-sports')).not.toHaveAttribute('hidden', '');
  await expect(page.locator('#tab-sports')).toHaveAttribute('aria-selected', 'true');
});

test('DayPicker renders and responds to clicks on Today tab', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.status-card')).toBeVisible();

  // Navigate to Today tab
  await page.locator('#tab-today').click();

  const buttons = page.locator('.day-btn');
  await expect(buttons).toHaveCount(7);

  // Verify a button is selected
  const selectedBtn = page.locator('.day-btn.selected');
  await expect(selectedBtn).toHaveCount(1);

  // Click a different day — pick the last button
  const lastBtn = buttons.last();
  await lastBtn.click();
  await expect(lastBtn).toHaveClass(/selected/);
});

test('Schedule tab accordion shows today expanded', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.status-card')).toBeVisible();

  // Navigate to Schedule tab
  await page.locator('#tab-schedule').click();

  // Today's accordion item should be visible with Today badge
  const todayBadge = page.locator('#panel-schedule .today-badge');
  await expect(todayBadge.first()).toBeVisible();

  // Click another accordion header to expand it
  const headers = page.locator('#panel-schedule .accordion-header');
  const count = await headers.count();
  if (count > 1) {
    // Find a header that doesn't have Today badge (i.e. collapsed)
    // Click the last header to expand it
    await headers.last().click();
    // Verify expanded content exists (last accordion item now has content)
    const lastItem = page.locator('#panel-schedule .accordion-item').last();
    await expect(lastItem.locator('.accordion-content')).toBeVisible();
  }
});

test('Sports tab shows chips and responds to selection', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.status-card')).toBeVisible();

  // Navigate to Sports tab
  await page.locator('#tab-sports').click();

  const sportChips = page.locator('#panel-sports .sport-chip');
  const chipCount = await sportChips.count();
  if (chipCount === 0) return; // No sports available

  // Hint text should be visible before selection
  await expect(page.locator('#panel-sports .hint-text')).toBeVisible();

  // Click first sport chip
  await sportChips.first().click();

  // Week summary rows should appear (or no-results message)
  const results = page.locator('#panel-sports .result-row');
  const noResults = page.locator('#panel-sports .no-results');
  const hasResults = await results.count() > 0;
  const hasNoResults = await noResults.isVisible().catch(() => false);
  expect(hasResults || hasNoResults).toBe(true);
});
