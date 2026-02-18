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

  // Verify a button is selected (using aria-pressed for reliability)
  const selectedBtn = page.locator('.day-btn[aria-pressed="true"]');
  await expect(selectedBtn).toHaveCount(1);

  // Capture the initial day header text (e.g. "Today (Tuesday)")
  // .timeline-day only renders when the selected day has a schedule
  const dayHeader = page.locator('.timeline-day');
  const initialHeader = await dayHeader.textContent();

  // Click a different day — find an enabled button that isn't currently pressed
  const allBtns = await buttons.all();
  for (const btn of allBtns) {
    const isDisabled = await btn.isDisabled();
    const isPressed = (await btn.getAttribute('aria-pressed')) === 'true';
    if (!isDisabled && !isPressed) {
      await btn.click();
      await expect(btn).toHaveAttribute('aria-pressed', 'true');

      // Day header should change to the clicked day name (only assertable if
      // the initial day had a schedule so the header was present)
      if (initialHeader) {
        await expect(dayHeader).not.toHaveText(initialHeader);
      }

      // Verify activity list items if the day has activities
      const listItemCount = await page.locator('.list-item').count();
      if (listItemCount > 0) {
        await expect(page.locator('.list-item').first()).toBeVisible();
      }
      break;
    }
  }
});

test('Rest of Week accordion shows today when a different day is selected', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.status-card')).toBeVisible();

  // Navigate to Schedule tab (Today tab, relabeled)
  await page.locator('#tab-today').click();

  // Switch to a day that isn't today so today appears in the Rest-of-Week accordion
  const dayBtns = page.locator('#panel-today .day-btn');
  // Find a day button that is NOT today (no .today-dot inside it)
  const nonTodayBtn = dayBtns.filter({ hasNot: page.locator('.today-dot') }).first();
  await nonTodayBtn.click();

  // Today's badge should now appear in the accordion section (not the Timeline)
  await expect(
    page.locator('#panel-today .schedule-accordion .accordion-item .today-badge')
  ).toBeVisible();
});

test('Sports tab shows chips and responds to selection', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.status-card')).toBeVisible();

  // Navigate to Sports tab
  await page.locator('#tab-sports').click();

  const sportChips = page.locator('#panel-sports .sport-chip');
  const chipCount = await sportChips.count();
  if (chipCount === 0) {
    test.skip(true, 'No sport chips available — cannot test chip interaction');
    return;
  }

  // Hint text should be visible before selection
  await expect(page.locator('#panel-sports .hint-text')).toBeVisible();

  // Click first sport chip
  const firstChip = sportChips.first();
  await firstChip.click();

  // Week summary rows should appear (or no-results message)
  const results = page.locator('#panel-sports .result-row');
  const noResults = page.locator('#panel-sports .no-results');
  const hasResults = await results.count() > 0;
  const hasNoResults = await noResults.isVisible().catch(() => false);
  expect(hasResults || hasNoResults).toBe(true);

  // If results exist, verify content structure
  if (hasResults) {
    // At least one result-row should contain a 3-letter day abbreviation,
    // a time range with en-dash, and an activity name
    const allRows = await results.all();
    let foundValidRow = false;
    for (const row of allRows) {
      const text = await row.textContent();
      if (!text) continue;
      const hasDayAbbrev = /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/.test(text);
      const hasTimeRange = /\d{1,2}:\d{2}\s*(AM|PM)\s*[–\u2013]\s*\d{1,2}:\d{2}\s*(AM|PM)/i.test(text);
      const hasActivityName = text.trim().length > 20; // day + time + name
      if (hasDayAbbrev && hasTimeRange && hasActivityName) {
        foundValidRow = true;
        break;
      }
    }
    expect(foundValidRow).toBe(true);
  }

  // Click the same chip again to deselect
  await firstChip.click();

  // Hint text should reappear
  await expect(page.locator('#panel-sports .hint-text')).toBeVisible();
});

// --- Deep-link / URL state tests ---

test('deep link #today?day=Wednesday pre-selects Wednesday', async ({ page }) => {
  await page.goto('/#today?day=Wednesday');
  // Wait for data to load (tab bar appears after load)
  await expect(page.locator('#tab-today')).toBeVisible({ timeout: 5000 });

  // Today tab should be active
  await expect(page.locator('#tab-today')).toHaveAttribute('aria-selected', 'true');

  // Wednesday day button should be pressed
  const wedBtn = page.locator('.day-btn[aria-pressed="true"]');
  await expect(wedBtn).toHaveCount(1);
  const wedText = await wedBtn.textContent();
  expect(wedText).toMatch(/Wed/);
});

test('deep link #sports?sport=basketball pre-selects a sport chip', async ({ page }) => {
  await page.goto('/#sports?sport=basketball');
  // Wait for data to load (tab bar appears after load)
  await expect(page.locator('#tab-sports')).toBeVisible({ timeout: 5000 });

  // Sports tab should be active
  await expect(page.locator('#tab-sports')).toHaveAttribute('aria-selected', 'true');

  // At least one chip should be pressed (data-independent assertion)
  const pressedChip = page.locator('#panel-sports .sport-chip[aria-pressed="true"]').first();
  await expect(pressedChip).toBeVisible();
});

test('sport status banner renders when a sport chip is selected', async ({ page }) => {
  await page.goto('/#sports?sport=basketball');
  await expect(page.locator('#tab-sports')).toBeVisible({ timeout: 5000 });

  const pressedChip = page.locator('#panel-sports .sport-chip[aria-pressed="true"]').first();
  if (!(await pressedChip.isVisible({ timeout: 2000 }).catch(() => false))) {
    test.skip(true, 'No basketball chip selected — schedule has no basketball activities');
    return;
  }

  const banner = page.locator('#panel-sports .sport-status-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(/Basketball/i);
  await expect(banner.locator('.sport-status-dot')).toBeVisible();
});

test('URL updates reactively when user changes day on Today tab', async ({ page }) => {
  await page.goto('/#today');
  // Wait for data to load (tab bar appears after load)
  await expect(page.locator('#tab-today')).toBeVisible({ timeout: 5000 });
  // Tab is already active from the hash, no need to click
  await expect(page.locator('#panel-today')).not.toHaveAttribute('hidden', '');

  const buttons = page.locator('.day-btn');
  const allBtns = await buttons.all();
  for (const btn of allBtns) {
    const isDisabled = await btn.isDisabled();
    const isPressed = (await btn.getAttribute('aria-pressed')) === 'true';
    if (!isDisabled && !isPressed) {
      await btn.click();
      // URL should now contain #today?day=...
      await expect(page).toHaveURL(/#today\?day=/);
      break;
    }
  }
});

test('invalid day param degrades gracefully (#today?day=Funday)', async ({ page }) => {
  await page.goto('/#today?day=Funday');
  // Wait for data to load (tab bar appears after load)
  await expect(page.locator('#tab-today')).toBeVisible({ timeout: 5000 });

  // Page should load without crash; exactly one day button should be pressed
  await expect(page.locator('.day-btn[aria-pressed="true"]')).toHaveCount(1);
});

test('tab switch from sports clears sport param, day param persists', async ({ page }) => {
  await page.goto('/#sports?sport=basketball');
  // Wait for data to load (tab bar appears after load)
  await expect(page.locator('#tab-sports')).toBeVisible({ timeout: 5000 });

  // Click Today tab
  await page.locator('#tab-today').click();
  await expect(page.locator('#panel-today')).not.toHaveAttribute('hidden', '');

  // URL should contain #today (not sport=)
  await expect(page).toHaveURL(/#today/);
  const url = page.url();
  expect(url).not.toContain('sport=');
  // Day param should be present since selectedDay persists across tab switches
  expect(url).toContain('day=');
});

test('chip deselect clears sport URL param', async ({ page }) => {
  await page.goto('/#sports');
  // Wait for data to load (tab bar appears after load)
  await expect(page.locator('#tab-sports')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#tab-sports')).toHaveAttribute('aria-selected', 'true');

  const sportChips = page.locator('#panel-sports .sport-chip');
  if (await sportChips.count() === 0) {
    test.skip(true, 'No sport chips available — cannot test chip deselect');
    return;
  }

  const firstChip = sportChips.first();
  // Select chip — URL should gain sport param
  await firstChip.click();
  await expect(page).toHaveURL(/sport=/);

  // Deselect same chip — URL should drop sport param
  await firstChip.click();
  await expect(page.locator('#panel-sports .hint-text')).toBeVisible();
  const url = page.url();
  expect(url).not.toContain('sport=');
});

// --- Sports tab tests ---

test.describe('Sports tab', () => {
  test('sport notification button renders when a sport chip is selected', async ({ page }) => {
    // Navigate to sports tab with basketball pre-selected
    await page.goto('/#sports?sport=basketball');
    await page.waitForSelector('.sport-week-expanded', { timeout: 5000 });

    // Skip if no sport chips loaded (no data)
    const chip = page.locator('.sport-chip').first();
    if (!await chip.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip(true, 'No sport chips available — schedule data may be empty');
      return;
    }

    // Wait for notifStore to initialize (up to 5s for SW timeout + margin)
    // getState() has a 3-second SW timeout; allow up to 5.5 seconds total.
    await page.waitForTimeout(5500);

    // The sport-notif-btn should be visible
    const notifBtn = page.locator('.sport-notif-btn');
    await expect(notifBtn).toBeVisible({ timeout: 2000 });

    // Button text should contain the sport name or a notification action
    const btnText = await notifBtn.textContent();
    expect(btnText).toMatch(/notify|notifying/i);
  });
});

// --- Notification sheet tests ---

test.describe('notification sheet', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for data to load (status card appears after data fetch resolves)
    await expect(page.locator('.status-card')).toBeVisible();
  });

  test('bell button is visible after data loads', async ({ page }) => {
    // notifStore.initialized becomes true after initNotifStore() resolves.
    // getState() has a 3-second SW timeout; allow up to 5 seconds total.
    await page.waitForSelector('[aria-label="Notification settings"]', { timeout: 5000 });
    await expect(page.locator('[aria-label="Notification settings"]')).toBeVisible();
  });

  test('clicking bell opens the notification sheet', async ({ page }) => {
    await page.waitForSelector('[aria-label="Notification settings"]', { timeout: 5000 });
    await page.locator('[aria-label="Notification settings"]').click();

    // Sheet dialog should be visible
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Sheet title should read "My Alerts"
    await expect(page.locator('#sheet-title')).toHaveText('My Alerts');

    // Sheet content is visible regardless of permission state (prompt shows enable-btn,
    // denied shows blocked message — both render inside .sheet-empty-state or .sheet-section)
    await expect(page.locator('.sheet-content')).toBeVisible();
  });

  test('Escape key closes the sheet and returns focus to bell button', async ({ page }) => {
    await page.waitForSelector('[aria-label="Notification settings"]', { timeout: 5000 });
    await page.locator('[aria-label="Notification settings"]').click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Press Escape to close
    await page.keyboard.press('Escape');
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();

    // Focus should have returned to the bell button
    const focusedLabel = await page.evaluate(() =>
      document.activeElement?.getAttribute('aria-label')
    );
    expect(focusedLabel).toBe('Notification settings');
  });

  test('clicking backdrop closes the sheet', async ({ page }) => {
    await page.waitForSelector('[aria-label="Notification settings"]', { timeout: 5000 });
    await page.locator('[aria-label="Notification settings"]').click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Click the backdrop (outside the panel)
    await page.locator('.sheet-backdrop').click();
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });
});

// --- DayPicker keyboard navigation tests ---

test.describe('DayPicker keyboard navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#today');
    // Wait for data to load (tab bar appears after load)
    await expect(page.locator('#tab-today')).toBeVisible({ timeout: 5000 });
    // Ensure the Today panel is active
    await expect(page.locator('#panel-today')).not.toHaveAttribute('hidden', '');
  });

  test('ArrowRight moves focus to the next enabled day', async ({ page }) => {
    const toolbar = page.locator('[role="toolbar"][aria-label="Select day"]');
    await expect(toolbar).toBeVisible();

    // The currently selected day button has tabindex=0 (roving tabindex pattern)
    const activeBtn = page.locator('.day-btn[aria-pressed="true"]');
    await expect(activeBtn).toHaveCount(1);

    // Read the text of the currently focused/selected day
    const initialDayText = await activeBtn.textContent();

    // Focus the selected day button and press ArrowRight
    await activeBtn.focus();
    await page.keyboard.press('ArrowRight');

    // After ArrowRight, a different button should now be pressed
    // (DayPicker calls onSelectDay which updates selectedDay, which moves aria-pressed)
    const newActiveBtn = page.locator('.day-btn[aria-pressed="true"]');
    await expect(newActiveBtn).toHaveCount(1);
    const newDayText = await newActiveBtn.textContent();

    // The selected day should have changed
    expect(newDayText).not.toBe(initialDayText);
  });

  test('ArrowLeft from the first enabled day wraps focus to a later day', async ({ page }) => {
    const toolbar = page.locator('[role="toolbar"][aria-label="Select day"]');
    await expect(toolbar).toBeVisible();

    // Find the first enabled day button and click it to make it the selected/focused one
    const allBtns = page.locator('.day-btn');
    const allBtnEls = await allBtns.all();
    let firstEnabledBtn = null;
    for (const btn of allBtnEls) {
      if (!(await btn.isDisabled())) {
        firstEnabledBtn = btn;
        break;
      }
    }

    if (!firstEnabledBtn) {
      test.skip(true, 'No enabled day buttons found — cannot test ArrowLeft wrap');
      return;
    }

    // Click to select and focus the first enabled day
    await firstEnabledBtn.click();
    await firstEnabledBtn.focus();
    const firstDayText = await firstEnabledBtn.textContent();

    // Press ArrowLeft — should wrap to the last enabled day (not the first)
    await page.keyboard.press('ArrowLeft');

    // The newly selected/focused day should differ from the first enabled day
    const newActiveBtn = page.locator('.day-btn[aria-pressed="true"]');
    await expect(newActiveBtn).toHaveCount(1);
    const newDayText = await newActiveBtn.textContent();
    expect(newDayText).not.toBe(firstDayText);
  });
});

test('back navigation restores previous tab and filter state', async ({ page }) => {
  // Start on Sports tab, wait for data to load
  await page.goto('/#sports');
  await expect(page.locator('#tab-sports')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#tab-sports')).toHaveAttribute('aria-selected', 'true');

  // Click first available chip (data-independent; replaceState updates H1 to #sports?sport=X)
  const sportChips = page.locator('#panel-sports .sport-chip');
  const chipCount = await sportChips.count();
  if (chipCount === 0) {
    test.skip(true, 'No sport chips available — cannot test back-nav state restore');
    return;
  }
  const firstChip = sportChips.first();
  await firstChip.click();
  await expect(page).toHaveURL(/sport=/); // confirm URL was updated

  // Navigate to today tab — creates new history entry H2
  await page.goto('/#today');
  await expect(page.locator('#tab-today')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#tab-today')).toHaveAttribute('aria-selected', 'true');

  // Browser back → H1 (#sports?sport=X), fires hashchange
  // hashchange handler restores: activeTab='sports', selectedSport=X
  await page.goBack();
  await expect(page.locator('#tab-sports')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#panel-sports')).not.toHaveAttribute('hidden', '');
  await expect(page.locator('#panel-sports .sport-chip[aria-pressed="true"]').first()).toBeVisible();
  await expect(page).toHaveURL(/sport=/); // URL also reflects restored state
});
