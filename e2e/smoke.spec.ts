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

test('weekly schedule toggle opens and closes', async ({ page }) => {
  await page.goto('/');
  const details = page.locator('details.weekly-schedule');
  const summary = details.locator('summary');

  // Initially closed
  await expect(details).not.toHaveAttribute('open', '');

  // Click to open
  await summary.click();
  await expect(details).toHaveAttribute('open', '');

  // Click to close
  await summary.click();
  await expect(details).not.toHaveAttribute('open', '');
});
